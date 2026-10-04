// supabase/functions/arowana-ai-coach/index.ts
//
// Arowana Profits — coach chat for the Wheel Strategy Desk (Wheel Coach page
// and Trading Command's Coach tab).
//
// Brought into the repo from the deployed version 17, with one change: the
// coach may explain, never calculate. Every number in a reply must come from
// the user's own context or their own messages (_shared/number-guard.js).
// A reply with any other number is retried once with those numbers named;
// if it still has them, the user gets a fixed message pointing to the tools
// that do the math (Check a Trade, the wheel calculator) instead.
//
// Earlier changes kept from the deployed version:
//   - explains choices and hands the decision back (no BUY/SELL/HOLD);
//   - plan-based monthly allowance, metered in ap_usage as 'coach'.
//
// Required secrets: OPENAI_API_KEY (already set project-wide).
// Deploy: supabase functions deploy arowana-ai-coach   (verify_jwt stays on)

import { createClient } from "npm:@supabase/supabase-js@2";
import { verify } from "../_shared/number-guard.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Monthly, because what it protects is a token bill rather than a rate limit.
const LIMITS: Record<string, number> = { free: 0, pro: 30, elite: 30, founders: 60 };
const ALIVE = new Set(["active", "trialing", "past_due"]);
const MAX_HISTORY = 10;
const MAX_MESSAGE_LEN = 2000;

const NO_MATH_REPLY =
  "I can explain how this works, but I don't calculate numbers here, so nothing I say can be a figure I made up. " +
  "For the math on a specific trade, use **Check a Trade** in the Options Hub (yield, collateral, breakeven and your rules), " +
  "or the **Wheel Calculator**. Your campaign numbers and adjusted basis are on the **Income** tab in Portfolio Command.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!openaiKey) return json({ error: "The coach is not configured yet. Try again later." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/, "");
  if (!jwt) return json({ error: "Not signed in." }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);
  const userId = userData.user.id;

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const context = body?.context && typeof body.context === "object" ? body.context : {};

  const trimmed: { role: "user" | "assistant"; content: string }[] = messages
    .slice(-MAX_HISTORY)
    // deno-lint-ignore no-explicit-any
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    // deno-lint-ignore no-explicit-any
    .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, MAX_MESSAGE_LEN) }));

  if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") {
    return json({ error: "Last message must be from the user." }, 400);
  }

  // ── Plan decides the allowance ──
  const { data: profile } = await admin
    .from("profiles")
    .select("arowana_plan, arowana_plan_status, arowana_stripe_subscription_id, arowana_plan_renews_at")
    .eq("id", userId)
    .maybeSingle();
  let slug = String(profile?.arowana_plan ?? "free").toLowerCase();
  const status = profile?.arowana_plan_status ?? null;
  if (slug !== "free" && status && !ALIVE.has(status)) slug = "free";
  if (slug !== "free" && !profile?.arowana_stripe_subscription_id && profile?.arowana_plan_renews_at
      && Date.parse(profile.arowana_plan_renews_at) < Date.now()) slug = "free";
  const limit = LIMITS[slug] ?? 0;

  if (limit <= 0) {
    return json({
      error: "The coach chat is part of Pro. Your journal, scanners, roll coach and daily brief stay available.",
      upgrade: true,
    }, 402);
  }

  const period = new Date().toISOString().slice(0, 7);   // monthly
  const { data: claim, error: claimErr } = await admin.rpc("ap_claim_usage", {
    p_user: userId, p_feature: "coach", p_period: period, p_limit: limit, p_cost: 0,
  });
  if (claimErr) {
    console.error("[coach] quota check failed", claimErr);
    return json({ error: "The coach is temporarily unavailable." }, 500);
  }
  const row = Array.isArray(claim) ? claim[0] : claim;
  if (!row?.allowed) {
    return json({
      error: `You have used this month's ${limit} coach messages. The counter resets on the 1st — everything else on the desk is unlimited.`,
      remaining: 0,
    }, 429);
  }

  // ── Context, type-checked and length-capped ──
  const openPositions = typeof context.openPositions === "string" ? context.openPositions.slice(0, 800) : "None recorded";
  const wheelCapital = Number(context.wheelCapital) || null;
  const committed = Number(context.committed) || null;
  const monthPremium = typeof context.monthPremium === "string" ? context.monthPremium.slice(0, 120) : "Not available";
  const limitsNote = typeof context.limits === "string" ? context.limits.slice(0, 200) : "No limits set";

  const known = `Open positions: ${openPositions}
Wheel capital: ${wheelCapital ? "$" + wheelCapital.toLocaleString("en-US") : "not set"}
Currently committed as put collateral: ${committed ? "$" + committed.toLocaleString("en-US") : "not known"}
Premium realised this month: ${monthPremium}
Their own risk limits: ${limitsNote}`;

  const systemPrompt = `You are a coach for a trader running the wheel: selling cash-secured puts on stocks they want to own, and covered calls on shares they hold.

What you know about them:
${known}

How to answer:
- Explain mechanics and trade-offs in words. You may quote numbers from what you know about them above or from their own messages, written the same way. Do not calculate new numbers (no breakevens, yields, returns, totals, differences or projections). When a number would need working out, say which tool shows it: Check a Trade in the Options Hub, the Wheel Calculator, or the Income tab in Portfolio Command.
- Never tell them what to trade, never predict a price, never claim certainty about an outcome.
- When they ask "what should I do", lay out the real choices (hold, close, roll, take assignment), what each depends on, then say the decision is theirs.
- Assignment on a put is not a failure for a wheel trader if they chose a stock they wanted to own.
- Option prices in this product come from a delayed feed and are estimates; say so when a price matters to the answer.
- Be concise: under 200 words unless they ask for more.
- This is education, not individualised financial advice.`;

  // Numbers the reply may use: their context and everything they typed.
  const facts = [known, ...trimmed.filter((m) => m.role === "user").map((m) => m.content)];

  let inTok = 0, outTok = 0;
  try {
    const convo: { role: string; content: string }[] = [{ role: "system", content: systemPrompt }, ...trimmed];
    let reply = "";
    let guarded = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const aiRes = await fetch(Deno.env.get("OPENAI_API_URL") || "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o", max_tokens: 500, temperature: 0.4, messages: convo }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text().catch(() => "");
        console.error("[arowana-ai-coach] provider error", aiRes.status, errText.slice(0, 300));
        return json({ error: "The coach had trouble responding. Please try again." }, 502);
      }
      const data = await aiRes.json();
      inTok += data?.usage?.prompt_tokens ?? 0;
      outTok += data?.usage?.completion_tokens ?? 0;
      reply = data?.choices?.[0]?.message?.content || "";
      const check = verify(reply, facts);
      if (reply && check.ok) break;
      console.warn("[coach] unsupported numbers", check.unsupported);
      if (attempt === 1) { reply = NO_MATH_REPLY; guarded = true; break; }
      convo.push({ role: "assistant", content: reply });
      convo.push({ role: "user", content: `Your answer used numbers I did not give you: ${check.unsupported.join(", ")}. Answer again in words, quoting only numbers from my data or my messages, and name the tool that shows any figure that needs working out.` });
    }
    return json({ reply, remaining: row.remaining, limit, guarded });
  } catch (err) {
    console.error("[arowana-ai-coach] unhandled error:", err);
    return json({ error: "The coach is temporarily unavailable." }, 500);
  } finally {
    // Record spend separately from the counter. gpt-4o list pricing.
    const cost = inTok * (2.5 / 1_000_000) + outTok * (10 / 1_000_000);
    if (cost > 0) {
      admin.rpc("ap_add_usage_cost", { p_user: userId, p_feature: "coach", p_period: period, p_cost: cost })
        .then(({ error }: { error: unknown }) => { if (error) console.warn("[coach] cost not recorded", error); });
    }
  }
});
