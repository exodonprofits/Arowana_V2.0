// arowana-coach — the only feature with real per-message cost, so it is the
// only one metered monthly. Runs on OUR Anthropic key; the user supplies
// nothing. A cap is what keeps one heavy user from outspending their $29.
//
// POST { message, context? }
// Auth: the caller's Supabase access token.
// Returns { reply, usage: { used, remaining, limit } }
//
// Secrets: ANTHROPIC_API_KEY, AROWANA_SITE_URL
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = (Deno.env.get('AROWANA_SITE_URL') ?? '').replace(/\/$/, '');
function allowOrigin(origin: string | null): string {
  if (!origin) return SITE || '*';
  if (SITE && origin === SITE) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return SITE || '*';
}
const corsFor = (req: Request) => ({
  'Access-Control-Allow-Origin': allowOrigin(req.headers.get('origin')),
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(req), 'content-type': 'application/json' } });

const LIMITS: Record<string, number> = { free: 0, pro: 30, elite: 30, founders: 60 };
const ALIVE = new Set(['active', 'trialing', 'past_due']);
const MODEL = 'claude-sonnet-4-6';
// Sonnet list price per token, used only to log a rough spend figure.
const COST_IN = 3 / 1_000_000, COST_OUT = 15 / 1_000_000;

const SYSTEM = [
  'You are a coach for a trader who sells cash-secured puts and covered calls (the wheel).',
  'You explain mechanics, arithmetic and trade-offs. You never tell the user what to trade,',
  'never predict prices, and never claim certainty about outcomes. When their own numbers are',
  'provided, reason from those. If asked for a recommendation, lay out the choices and what each',
  'depends on, and say the decision is theirs. Keep answers short and concrete. Option prices in',
  'this product are delayed estimates; say so if a price matters to the answer.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) });
  if (req.method !== 'POST') return json(req, { error: 'Use POST' }, 405);

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json(req, { error: 'Sign in first' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json(req, { error: 'Sign in first' }, 401);

    const body = await req.json().catch(() => ({}));
    const message = String(body.message ?? '').trim().slice(0, 4000);
    if (!message) return json(req, { error: 'Type a question first' }, 400);

    const { data: profile } = await supabase
      .from('profiles').select('arowana_plan, arowana_plan_status, arowana_stripe_subscription_id, arowana_plan_renews_at')
      .eq('id', user.id).maybeSingle();
    let slug = String(profile?.arowana_plan ?? 'free').toLowerCase();
    const status = profile?.arowana_plan_status ?? null;
    if (slug !== 'free' && status && !ALIVE.has(status)) slug = 'free';
    if (slug !== 'free' && !profile?.arowana_stripe_subscription_id && profile?.arowana_plan_renews_at
        && Date.parse(profile.arowana_plan_renews_at) < Date.now()) slug = 'free';
    const limit = LIMITS[slug] ?? 0;

    if (limit <= 0) {
      return json(req, { error: 'limit', message: 'The coach chat is part of Pro. Your journal, scanners and brief stay free.',
                         usage: { used: 0, remaining: 0, limit: 0 } }, 402);
    }

    const period = new Date().toISOString().slice(0, 7);   // monthly
    const { data: claim, error: claimErr } = await supabase.rpc('ap_claim_usage', {
      p_user: user.id, p_feature: 'coach', p_period: period, p_limit: limit, p_cost: 0,
    });
    if (claimErr) throw claimErr;
    const row = Array.isArray(claim) ? claim[0] : claim;
    if (!row?.allowed) {
      return json(req, { error: 'limit',
        message: `You have used this month's ${limit} coach messages. The counter resets on the 1st. Everything else on the desk is unlimited.`,
        usage: { used: row?.used ?? limit, remaining: 0, limit } }, 429);
    }

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json(req, { error: 'The coach is not configured yet' }, 503);

    const context = typeof body.context === 'string' ? body.context.slice(0, 6000) : '';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 700, system: SYSTEM,
        messages: [{ role: 'user', content: context ? `My positions and figures:\n${context}\n\nQuestion: ${message}` : message }],
      }),
    });
    if (!res.ok) {
      console.error('[coach] provider', res.status, (await res.text()).slice(0, 200));
      return json(req, { error: 'The coach could not answer just now. Try again shortly.' }, 502);
    }
    const out = await res.json();
    const reply = (out.content ?? []).filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text).join('\n').trim();

    // Log what it actually cost, so cost per user is measured rather than guessed.
    // Separate from the counter, so recording spend can never consume an extra
    // message from the user's allowance.
    const inTok = out.usage?.input_tokens ?? 0, outTok = out.usage?.output_tokens ?? 0;
    const cost = inTok * COST_IN + outTok * COST_OUT;
    if (cost > 0) {
      const { error: costErr } = await supabase.rpc('ap_add_usage_cost', {
        p_user: user.id, p_feature: 'coach', p_period: period, p_cost: cost,
      });
      if (costErr) console.warn('[coach] cost not recorded', costErr.message);
    }

    return json(req, { reply, usage: { used: row.used, remaining: row.remaining, limit }, model: MODEL });
  } catch (err) {
    console.error('[arowana-coach]', err);
    return json(req, { error: 'The coach could not answer' }, 500);
  }
});
