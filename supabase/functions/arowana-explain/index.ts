// supabase/functions/arowana-explain/index.ts
//
// Plain-English explanations of numbers the app has already calculated.
// The page sends the facts (label/value strings from its own deterministic
// math); Claude writes 2–4 sentences about them. It may not produce a number
// of its own: every number in the reply is checked against the facts
// (_shared/number-guard.js). One retry names the offending numbers; if the
// reply still carries any, nothing is shown.
//
// POST  Authorization: Bearer <user JWT>
//       { kind: 'trade-check' | 'income' | 'campaign' | 'trade-case' | 'retirement' | 'thesis',
//         facts: [{ label, value }, …] }
//   →   { text }                     verified explanation
//       { case: { for, against } }   'trade-case' only: both sides of one trade
//       { thesis: { bear, bear_if, base, base_if, bull, bull_if } }
//                                    'thesis' only: three scenarios for one company
//       { text: null, reason }       'numbers' (guard kept rejecting) or 'refusal'
//
// Secrets: ANTHROPIC_API_KEY (new), EXPLAIN_MODEL (optional, default claude-opus-5).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Paid plans only; metered in ap_usage as feature 'explain' (monthly).

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verify } from "../_shared/number-guard.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const LIMITS: Record<string, number> = { free: 0, pro: 150, elite: 150, founders: 300 };
const ALIVE = new Set(["active", "trialing", "past_due"]);
const ADMIN = new Set(["gs_admin", "arowana_admin"]);
const MAX_FACTS = 40;
const MAX_LEN = 200;
// List price per token for the default model, to record spend per user.
const PRICE_IN = 5 / 1_000_000, PRICE_OUT = 25 / 1_000_000;

const KINDS: Record<string, string> = {
  "trade-check": "These are the results of checking one proposed option trade against the trader's own written rules. Each rule passed, failed or was skipped, with the numbers behind it.",
  "income": "These are the trader's realized options income figures for a period, from their own trade journal.",
  "campaign": "These are the figures for one wheel campaign on one stock: puts sold, shares assigned, calls sold, and the result so far.",
  "trade-case": "These are the facts about one proposed option trade, already sorted by the app into points for taking it and points against, plus the trader's own rule results.",
  // Retirement Planner's managed write-up (ATD-009). Not trading figures.
  // Thesis Builder (ATD-109): one company's reported fundamentals.
  "thesis": "These are not trading figures. They are one company's reported fundamentals and the analyst rating counts, as loaded by the app for a long-term investor who is deciding whether to own the stock, plus that investor's own notes if any.",
  "retirement": "These are not trading figures. They are a retirement projection the app calculated from the person's own inputs: three growth scenarios, each with projected savings at retirement, monthly income in retirement and any monthly shortfall or surplus, all in today's dollars. Say what the scenarios show and what drives the difference between them.",
};

// Case for / case against (Check a Trade). Structured output, so the two
// sides come back as fields rather than text to split.
const CASE_TASK = `Write the strongest honest case FOR taking this trade and the strongest honest case AGAINST it, each in 2 or 3 short sentences, as a thoughtful wheel trader would weigh them.

You may name trade-offs the facts point to that a checklist would miss, in words only: for example what an unusually high yield tends to signal, what assignment would mean for how concentrated they are, or why little room to the strike matters. Every number must still come from the facts.

Do not say which side is stronger, do not recommend taking or skipping the trade, and do not end with advice. Plain sentences, no lists or markdown.`;
const CASE_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: { for: { type: "string" }, against: { type: "string" } },
    required: ["for", "against"],
    additionalProperties: false,
  },
};

// Thesis Builder: bear case first, then base and bull, each with the
// conditions that would have to hold. Same number guard as everything else.
const THESIS_TASK = `Write three scenarios for owning this company, worst first, as a careful long-term investor would set them out before deciding.

For each scenario write the case in 2 or 3 short sentences, then separately say what would have to happen for it to play out, in 1 or 2 sentences, naming things an investor could watch in future reports (for example growth slowing or speeding up, margins, debt, return on equity, the dividend). Use the facts to say what supports or weakens each case. The bear case should be the strongest honest argument against owning the stock at today's price.

Every number must come from the facts, written the same way. Do not estimate a fair value, a price target, a future price or a return, do not say which scenario is most likely, and do not recommend buying, holding or selling. Plain sentences, no lists or markdown.`;
const THESIS_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      bear: { type: "string" }, bear_if: { type: "string" },
      base: { type: "string" }, base_if: { type: "string" },
      bull: { type: "string" }, bull_if: { type: "string" },
    },
    required: ["bear", "bear_if", "base", "base_if", "bull", "bull_if"],
    additionalProperties: false,
  },
};

// Kinds answered with fields instead of text: the task, the schema, the
// response key, and the retry hint when fields come back missing.
const STRUCTURED: Record<string, { task: string; format: unknown; key: string; fields: string[]; hint: string }> = {
  "trade-case": { task: CASE_TASK, format: CASE_FORMAT, key: "case", fields: ["for", "against"],
    hint: "Give both fields, for and against, each with 2 or 3 sentences." },
  "thesis": { task: THESIS_TASK, format: THESIS_FORMAT, key: "thesis", fields: ["bear", "bear_if", "base", "base_if", "bull", "bull_if"],
    hint: "Give all six fields: bear, bear_if, base, base_if, bull and bull_if, each in 1 to 3 sentences." },
};

const SYSTEM = `You explain a trader's own numbers in plain English. The trader sells cash-secured puts and covered calls. Every figure you are given was calculated by the app from their data.

Write 2 to 4 short sentences that say what the figures show and what is driving them.

Rules:
- Use only numbers that appear in the facts, written the same way. Do not add, subtract, multiply, divide, average, annualize or project anything. When a comparison would need a new number, say it in words (higher, lower, most, the main reason).
- Do not tell the trader what to do, recommend a trade, or predict a price.
- If a rule was skipped or a figure is missing, say so plainly rather than guessing.
- Plain text only: no headings, lists or markdown.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

type Fact = { label: string; value: string };

function cleanFacts(raw: unknown): Fact[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_FACTS) return null;
  const out: Fact[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") return null;
    const label = String((f as Fact).label ?? "").slice(0, MAX_LEN).trim();
    const value = String((f as Fact).value ?? "").slice(0, MAX_LEN).trim();
    if (!label) return null;
    out.push({ label, value });
  }
  return out;
}

function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join("").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Explanations are not configured yet." }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Not signed in." }, 401);
  const { data: u, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !u?.user) return json({ error: "Invalid session." }, 401);
  const userId = u.user.id;

  let body: { kind?: string; facts?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const kind = String(body.kind || "");
  const facts = cleanFacts(body.facts);
  if (!KINDS[kind] || !facts) return json({ error: "Nothing to explain." }, 400);

  // ── Plan and allowance ──
  const { data: profile } = await admin.from("profiles").select("arowana_plan, arowana_plan_status, gs_role").eq("id", userId).maybeSingle();
  let slug = String(profile?.arowana_plan ?? "free").toLowerCase();
  if (slug !== "free" && profile?.arowana_plan_status && !ALIVE.has(profile.arowana_plan_status)) slug = "free";
  const limit = ADMIN.has(String(profile?.gs_role)) ? 1000 : (LIMITS[slug] ?? 0);
  if (limit <= 0) return json({ error: "Plain-English explanations are part of Pro.", upgrade: true }, 402);

  const period = new Date().toISOString().slice(0, 7);
  const { data: claim, error: claimErr } = await admin.rpc("ap_claim_usage", {
    p_user: userId, p_feature: "explain", p_period: period, p_limit: limit, p_cost: 0,
  });
  if (claimErr) { console.error("[explain] quota check failed", claimErr); return json({ error: "Explanations are unavailable right now." }, 500); }
  const row = Array.isArray(claim) ? claim[0] : claim;
  if (!row?.allowed) return json({ error: `You have used this month's ${limit} explanations. The counter resets on the 1st.` }, 429);

  // ── Ask, verify, retry once ──
  const client = new Anthropic({ apiKey });
  const model = Deno.env.get("EXPLAIN_MODEL") || "claude-opus-5";
  const factText = facts.map((f) => `- ${f.label}: ${f.value}`).join("\n");
  const shape = STRUCTURED[kind] || null;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `${KINDS[kind]}\n\nFacts:\n${factText}` + (shape ? `\n\n${shape.task}` : "") }];
  let tokensIn = 0, tokensOut = 0;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const msg = await client.beta.messages.create({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        messages,
        output_config: shape ? { effort: "low", format: shape.format } : { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        // Re-run a declined request on Anthropic's recommended fallback model.
        fallbacks: "default",
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      tokensIn += msg.usage?.input_tokens ?? 0;
      tokensOut += msg.usage?.output_tokens ?? 0;
      if (msg.stop_reason === "refusal") return json({ text: null, reason: "refusal" });

      const text = textOf(msg);
      let parts: Record<string, string> | null = null;
      if (shape) {
        try {
          const p = JSON.parse(text);
          if (shape.fields.every((f) => typeof p?.[f] === "string" && p[f].trim())) {
            parts = {};
            for (const f of shape.fields) parts[f] = p[f].trim();
          }
        } catch { /* treated like a guard failure below */ }
      }
      const check = verify(shape ? (parts ? shape.fields.map((f) => parts![f]).join("\n") : "") : text, facts);
      if (shape && parts && check.ok) return json({ [shape.key]: parts, remaining: row.remaining });
      if (!shape && text && check.ok) return json({ text, remaining: row.remaining });

      console.warn("[explain] rejected", shape && !parts ? "missing fields" : check.unsupported);
      messages.push({ role: "assistant", content: text || "(no text)" });
      messages.push({ role: "user", content: shape && !parts
        ? shape.hint
        : `These numbers are not in the facts: ${check.unsupported.join(", ")}. Rewrite the explanation using only numbers that appear in the facts, or describe the comparison in words.` });
    }
    return json({ text: null, case: null, thesis: null, reason: "numbers" });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Explanations are busy. Try again in a minute." }, 429);
    if (err instanceof Anthropic.APIError) { console.error("[explain] API error", err.status, err.message); return json({ error: "The explanation could not be written right now." }, 502); }
    console.error("[explain] failed", err);
    return json({ error: "The explanation could not be written right now." }, 500);
  } finally {
    const cost = tokensIn * PRICE_IN + tokensOut * PRICE_OUT;
    if (cost > 0) {
      admin.rpc("ap_add_usage_cost", { p_user: userId, p_feature: "explain", p_period: period, p_cost: cost })
        .then(({ error }: { error: unknown }) => { if (error) console.warn("[explain] cost not recorded", error); });
    }
  }
});
