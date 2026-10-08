// arowana-research — market data through OUR licensed key, so no user brings
// their own. An allow-listed proxy: the page asks for a Finnhub path, this
// checks it, adds the key, and returns the provider's JSON untouched so every
// existing call site keeps working.
//
// Two protections sit in front of the provider:
//   • a per-user quota on deliberate research lookups (ap_usage), and
//   • a platform-wide daily ceiling (ap_provider_calls), so a runaway page or
//     a scripted client cannot run the account past a rate limit overnight.
//
// POST { path: '/stock/profile2', query: { symbol: 'AAPL' } }
// Secrets: FINNHUB_API_KEY, AROWANA_SITE_URL, optional AROWANA_DAILY_CALL_CAP
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = (Deno.env.get('AROWANA_SITE_URL') ?? '').replace(/\/$/, '');
// The site is reached on the bare domain and on www (and /staging/ is the
// same origin), so all of these count as ours alongside AROWANA_SITE_URL.
const OURS = new Set([SITE, 'https://arowanaprofits.com', 'https://www.arowanaprofits.com'].filter(Boolean));
function allowOrigin(origin: string | null): string {
  if (!origin) return SITE || '*';
  if (OURS.has(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  // A refused origin used to fail silently in the browser; say which one.
  console.warn('[cors] origin not allowed:', origin, '(AROWANA_SITE_URL is', JSON.stringify(SITE) + ')');
  return SITE || '*';
}
const corsFor = (req: Request) => ({
  'Access-Control-Allow-Origin': allowOrigin(req.headers.get('origin')),
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-usage-used, x-usage-remaining, x-usage-limit',
  'Vary': 'Origin',
});
const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(req), ...extra, 'content-type': 'application/json' } });

const ALLOWED = new Set([
  '/stock/profile2', '/stock/metric', '/stock/peers', '/stock/financials-reported',
  '/stock/recommendation', '/stock/price-target', '/stock/candle', '/quote',
  '/news-sentiment', '/company-news', '/stock/earnings', '/calendar/earnings',
  '/stock/social-sentiment',
]);

// Price and calendar lookups are what the desk pages poll to keep positions
// marked; charging a research lookup for opening a page would be absurd.
// They still count toward the platform ceiling below.
const FREE_PATHS = new Set(['/quote', '/calendar/earnings', '/stock/candle']);

const LIMITS: Record<string, number> = { free: 5, pro: 25, elite: 25, founders: 50 };
const ALIVE = new Set(['active', 'trialing', 'past_due']);
const DAILY_CAP = Number(Deno.env.get('AROWANA_DAILY_CALL_CAP') ?? '20000');

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
    const path = String(body.path ?? '').trim();
    if (!ALLOWED.has(path)) return json(req, { error: 'That data is not available here' }, 400);

    const query = new URLSearchParams();
    const raw = (body.query ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(raw)) {
      if (v == null) continue;
      if (k.toLowerCase() === 'token') continue;              // never pass a caller key through
      query.set(k, String(v).slice(0, 64));
    }
    const symbol = String(query.get('symbol') ?? '').toUpperCase();
    if (symbol && !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) return json(req, { error: 'Enter a ticker' }, 400);
    if (symbol) query.set('symbol', symbol);

    const { data: profile } = await supabase
      .from('profiles').select('arowana_plan, arowana_plan_status, arowana_stripe_subscription_id, arowana_plan_renews_at')
      .eq('id', user.id).maybeSingle();
    let slug = String(profile?.arowana_plan ?? 'free').toLowerCase();
    const status = profile?.arowana_plan_status ?? null;
    if (slug !== 'free' && status && !ALIVE.has(status)) slug = 'free';
    if (slug !== 'free' && !profile?.arowana_stripe_subscription_id && profile?.arowana_plan_renews_at
        && Date.parse(profile.arowana_plan_renews_at) < Date.now()) slug = 'free';
    const limit = LIMITS[slug] ?? LIMITS.free;

    const today = new Date().toISOString().slice(0, 10);

    let usage = { used: 0, remaining: limit, limit };
    if (!FREE_PATHS.has(path)) {
      const { data: claim, error: claimErr } = await supabase.rpc('ap_claim_usage', {
        p_user: user.id, p_feature: 'research', p_period: today, p_limit: limit, p_cost: 0,
      });
      if (claimErr) throw claimErr;
      const row = Array.isArray(claim) ? claim[0] : claim;
      if (!row?.allowed) {
        return json(req, {
          error: 'limit',
          message: slug === 'free'
            ? `Free accounts get ${limit} ticker lookups a day. Pro raises that to 25.`
            : `You have used today's ${limit} lookups. The counter resets at midnight UTC.`,
          usage: { used: row?.used ?? limit, remaining: 0, limit },
        }, 429);
      }
      usage = { used: row.used, remaining: row.remaining, limit };
    }

    const key = Deno.env.get('FINNHUB_API_KEY');
    if (!key) return json(req, { error: 'Market data is not configured yet' }, 503);

    // Count the call and read the platform total for today. Recording happens
    // before the fetch so a provider timeout still counts — an overnight loop
    // that times out is exactly the case this is meant to stop.
    let todayTotal = 0;
    const { data: total, error: recErr } = await supabase.rpc('ap_record_provider_call', {
      p_day: today, p_provider: 'finnhub', p_path: path, p_user: user.id, p_error: false,
    });
    if (recErr) console.warn('[research] call not recorded', recErr.message);
    else todayTotal = Number(total) || 0;

    if (DAILY_CAP > 0 && todayTotal > DAILY_CAP) {
      console.error('[research] daily cap reached', todayTotal, '>', DAILY_CAP);
      return json(req, {
        error: 'paused',
        message: 'Market data is paused for today while we check unusual traffic. Your data is safe and this will clear shortly.',
      }, 503);
    }

    const res = await fetch(`https://finnhub.io/api/v1${path}?${query.toString()}`, {
      headers: { 'X-Finnhub-Token': key },
    });
    if (!res.ok) {
      console.error('[research] provider', path, res.status);
      supabase.rpc('ap_record_provider_call', {
        p_day: today, p_provider: 'finnhub', p_path: path, p_user: user.id, p_error: true,
      }).then(() => {}, () => {});
      return json(req, { error: 'Data provider did not answer. Try again shortly.' }, 502);
    }
    const data = await res.json();

    return json(req, data, 200, {
      'x-usage-used': String(usage.used),
      'x-usage-remaining': String(usage.remaining),
      'x-usage-limit': String(usage.limit),
    });
  } catch (err) {
    console.error('[arowana-research]', err);
    return json(req, { error: 'Could not fetch data' }, 500);
  }
});