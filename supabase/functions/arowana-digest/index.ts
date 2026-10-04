// supabase/functions/arowana-digest/index.ts
//
// The three Arowana emails: the weekday email (Mondays: expiration week),
// and the monthly options income statement. Content is built by digest.js
// from each user's own journal — deterministic, no AI — and a day with
// nothing to say sends nothing.
//
// Three ways in (verify_jwt is false; each path checks its own auth):
//   POST  x-cron-secret: <Vault secret>       { kind: 'daily' | 'monthly', dryRun?, only? }
//           pg_cron, see supabase/migrations/20260926_ap_email_cron.sql
//   POST  Authorization: Bearer <user JWT>    { preview: 'daily' | 'expiry' | 'monthly' }
//           the signed-in user's own email, returned (never sent)
//   GET   ?unsubscribe=<token>
//           the link in every email; turns all three off
//
// Secrets (Project Settings → Edge Functions → Secrets):
//   DIGEST_CRON_SECRET   optional; by default the cron secret is read from Vault
//                        (arowana_digest_cron_secret(), 20261001_ap_email_cron_secret.sql)
//   RESEND_API_KEY       Resend API key; without it the cron path only builds
//   DIGEST_FROM          e.g. "Arowana Profits <desk@arowanaprofits.com>" (verified domain)
//   APP_URL              e.g. https://arowanaprofits.com
//   FINNHUB_PLATFORM_KEY already set for morning-brief-generate; used for earnings dates
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are provided by Supabase
//
// Who gets email: rows in ap_email_prefs with that email turned on, on a paid
// plan (pro / elite / founders, status active or trialing) or an admin role.
// ap_email_log keeps one row per user, email and day/month, so a re-run never
// sends twice.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildDaily, buildExpiryWeek, buildMonthly, render } from "./digest.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const PAID = ["pro", "elite", "founders"];
const ADMIN = ["gs_admin", "arowana_admin"];
const MAX_USERS_PER_RUN = 500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
function page(title: string, body: string, status = 200) {
  const html = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
    "<title>" + title + "</title><body style='font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#0d1b2a'>" +
    "<h1 style='font-size:22px'>" + title + "</h1><p>" + body + "</p></body>";
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Today in the desk's time zone (US markets), as YYYY-MM-DD and weekday.
function chicagoToday() {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const wd = new Date(d + "T00:00:00Z").getUTCDay();
  return { date: d, weekday: wd };
}
function previousMonth(date: string) {
  const [y, m] = date.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

async function pageAll(admin: SupabaseClient, table: string, userId: string) {
  const out: Record<string, unknown>[] = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await admin.from(table).select("payload,status").eq("user_id", userId).range(p * 1000, p * 1000 + 999);
    if (error) throw error;
    (data || []).forEach((r: { payload: Record<string, unknown>; status: string }) => out.push({ ...(r.payload || {}), status: r.status || r.payload?.status }));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Latest daily close for each symbol from the nightly cache.
async function closes(admin: SupabaseClient, symbols: string[]) {
  const prices: Record<string, number> = {};
  let priceDate: string | null = null;
  for (let i = 0; i < symbols.length; i += 100) {
    const chunk = symbols.slice(i, i + 100);
    const { data } = await admin.from("market_snapshots").select("symbol,ts,ohlcv").eq("tf", "1d")
      .in("symbol", chunk).order("ts", { ascending: false }).limit(chunk.length * 5);
    (data || []).forEach((r: { symbol: string; ts: string; ohlcv: { close?: number } }) => {
      if (prices[r.symbol] != null || r.ohlcv?.close == null) return;
      prices[r.symbol] = Number(r.ohlcv.close);
      const d = String(r.ts).slice(0, 10);
      if (!priceDate || d < priceDate) priceDate = d;   // report the oldest close used
    });
  }
  return { prices, priceDate };
}

// Next earnings date per symbol, one calendar call for the whole run.
async function earningsCalendar(today: string): Promise<Record<string, string>> {
  const key = Deno.env.get("FINNHUB_PLATFORM_KEY");
  if (!key) return {};
  const to = new Date(Date.parse(today + "T00:00:00Z") + 60 * 86400000).toISOString().slice(0, 10);
  try {
    const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${to}&token=${key}`);
    if (!res.ok) return {};
    const body = await res.json();
    const out: Record<string, string> = {};
    (body.earningsCalendar || []).forEach((e: { symbol: string; date: string }) => {
      if (!e.symbol || !e.date) return;
      if (!out[e.symbol] || e.date < out[e.symbol]) out[e.symbol] = e.date;
    });
    return out;
  } catch { return {}; }
}

async function userData(admin: SupabaseClient, userId: string, today: string, withRoll: boolean) {
  const [options, stocks, risk, roll] = await Promise.all([
    pageAll(admin, "tj_options", userId),
    pageAll(admin, "tj_stocks", userId),
    admin.from("ap_risk_settings").select("wheel_capital").eq("user_id", userId).maybeSingle(),
    withRoll ? admin.from("ap_roll_coach").select("underlying,opt_type,strike,expiry,choices,captured_pct,computed_at").eq("user_id", userId)
             : Promise.resolve({ data: [] }),
  ]);
  return { today, options, stocks, capital: risk.data?.wheel_capital ?? null, roll: roll.data || [] };
}

function symbolsOf(d: { options: Record<string, unknown>[] }) {
  const s = new Set<string>();
  d.options.forEach((p) => { if (String(p.status) === "open" && p.ticker) s.add(String(p.ticker).trim().toUpperCase()); });
  return [...s];
}

async function send(to: string, email: { subject: string; html: string; text: string }, unsubscribe: string) {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("DIGEST_FROM");
  if (!key || !from) throw new Error("RESEND_API_KEY / DIGEST_FROM not configured");
  const res = await fetch(Deno.env.get("RESEND_API_URL") || "https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from, to: [to], subject: email.subject, html: email.html, text: email.text,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body.id as string | undefined;
}

function links(fnUrl: string, token: string) {
  const app = (Deno.env.get("APP_URL") || "https://arowanaprofits.com").replace(/\/$/, "");
  return { app, settings: app + "/account.html#email", unsubscribe: `${fnUrl}?unsubscribe=${encodeURIComponent(token)}` };
}

// The function secret if set, else the Vault value the cron jobs send.
async function cronSecret(admin: SupabaseClient) {
  const env = Deno.env.get("DIGEST_CRON_SECRET");
  if (env) return env;
  const { data, error } = await admin.rpc("arowana_digest_cron_secret");
  if (error) console.error("[arowana-digest] cron secret lookup failed", error.message);
  return typeof data === "string" && data ? data : null;
}

type Built = ReturnType<typeof buildDaily>;

function build(kind: string, data: Record<string, unknown>, today: { date: string; weekday: number }, prefs: { morning?: boolean; expiry_week?: boolean }) {
  if (kind === "monthly") return buildMonthly(data, previousMonth(today.date));
  if (kind === "expiry") return buildExpiryWeek(data);
  // daily: Mondays are expiration-week for those who want it, so never two emails a day
  if (today.weekday === 1 && prefs.expiry_week) return buildExpiryWeek(data) || (prefs.morning ? buildDaily(data) : null);
  return prefs.morning ? buildDaily(data) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/arowana-digest`;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Unsubscribe (GET from the email link, POST from List-Unsubscribe=One-Click) ──
  const token = url.searchParams.get("unsubscribe");
  if (token) {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return page("Link not recognized", "This unsubscribe link is not valid.", 400);
    const { data, error } = await admin.from("ap_email_prefs")
      .update({ morning: false, expiry_week: false, monthly: false, updated_at: new Date().toISOString() })
      .eq("unsubscribe_token", token).select("user_id");
    if (error) return page("Something went wrong", "Please try again, or turn emails off in your account settings.", 500);
    if (!data || !data.length) return page("Link not recognized", "This unsubscribe link is not valid.", 404);
    return page("You're unsubscribed", "Arowana won't send you any more emails. You can turn them back on in your account settings.");
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const today = chicagoToday();

  // ── Preview: the signed-in user's own email, returned, never sent ──
  if (body.preview) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Sign in to preview" }, 401);
    const kind = ["daily", "expiry", "monthly"].includes(body.preview) ? body.preview : "daily";
    try {
      const data: Record<string, unknown> = await userData(admin, u.user.id, today.date, kind === "expiry");
      const c = await closes(admin, symbolsOf(data as { options: Record<string, unknown>[] }));
      Object.assign(data, c, { earnings: await earningsCalendar(today.date) });
      const email: Built = kind === "daily" ? buildDaily(data) : build(kind, data, today, {});
      if (!email) return json({ empty: true });
      const { data: pref } = await admin.from("ap_email_prefs").select("unsubscribe_token").eq("user_id", u.user.id).maybeSingle();
      return json({ empty: false, ...render(email, links(fnUrl, pref?.unsubscribe_token || "00000000-0000-0000-0000-000000000000")) });
    } catch (e) {
      console.error("[arowana-digest] preview failed", e);
      return json({ error: "Preview failed" }, 500);
    }
  }

  // ── Scheduled run ──
  const secret = await cronSecret(admin);
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const kind = body.kind === "monthly" ? "monthly" : "daily";
  const dryRun = body.dryRun === true;
  if (kind === "daily" && (today.weekday === 0 || today.weekday === 6)) return json({ ok: true, skipped: "weekend" });

  const col = kind === "monthly" ? "monthly" : null;
  let q = admin.from("ap_email_prefs").select("user_id,morning,expiry_week,monthly,unsubscribe_token");
  q = col ? q.eq(col, true) : q.or("morning.eq.true,expiry_week.eq.true");
  if (body.only) q = q.eq("user_id", String(body.only));
  const { data: prefs, error: pErr } = await q.limit(MAX_USERS_PER_RUN);
  if (pErr) return json({ error: pErr.message }, 500);
  if (!prefs?.length) return json({ ok: true, users: 0 });

  const { data: profiles } = await admin.from("profiles").select("id,email,arowana_plan,arowana_plan_status,gs_role")
    .in("id", prefs.map((p: { user_id: string }) => p.user_id));
  const eligible = new Map<string, string>();
  (profiles || []).forEach((p: { id: string; email: string; arowana_plan: string; arowana_plan_status: string | null; gs_role: string | null }) => {
    const paid = PAID.includes(String(p.arowana_plan)) && (!p.arowana_plan_status || ["active", "trialing"].includes(p.arowana_plan_status));
    if (p.email && (paid || ADMIN.includes(String(p.gs_role)))) eligible.set(p.id, p.email);
  });

  const period = kind === "monthly" ? previousMonth(today.date) : today.date;
  const earnings = kind === "monthly" ? {} : await earningsCalendar(today.date);
  const result = { ok: true, kind, period, dryRun, users: prefs.length, eligible: eligible.size, sent: 0, empty: 0, already: 0, failed: 0 };

  for (const pref of prefs) {
    const to = eligible.get(pref.user_id);
    if (!to) continue;
    try {
      // One weekday email per user per day, whichever kind it turned out to be.
      const kinds = kind === "monthly" ? ["monthly"] : ["morning", "expiry"];
      const { data: seen } = await admin.from("ap_email_log").select("kind").eq("user_id", pref.user_id).in("kind", kinds).eq("period", period).limit(1);
      if (seen && seen.length) { result.already++; continue; }
      const wantsRoll = kind !== "monthly" && today.weekday === 1 && !!pref.expiry_week;
      const data: Record<string, unknown> = await userData(admin, pref.user_id, today.date, wantsRoll);
      Object.assign(data, await closes(admin, symbolsOf(data as { options: Record<string, unknown>[] })), { earnings });
      const email = build(kind, data, today, pref);
      if (!email) { result.empty++; continue; }
      if (dryRun) { result.sent++; continue; }
      const id = await send(to, render(email, links(fnUrl, pref.unsubscribe_token)), links(fnUrl, pref.unsubscribe_token).unsubscribe);
      await admin.from("ap_email_log").insert({ user_id: pref.user_id, kind: email.kind, period, provider_id: id || null });
      result.sent++;
    } catch (e) {
      result.failed++;
      console.error("[arowana-digest] user failed", pref.user_id, e instanceof Error ? e.message : e);
    }
  }
  return json(result);
});
