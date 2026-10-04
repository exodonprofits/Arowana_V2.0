// arowana-checkout — creates a Stripe Checkout Session for the signed-in user.
//
// POST { plan: 'pro' | 'elite' | 'founders', cycle?: 'monthly' | 'annual',
//        success_url?, cancel_url? }   ← only honoured when they point at our own site
// Auth: the caller's Supabase access token in the Authorization header.
// Returns { url } to redirect the browser to.
//
// Secrets required: STRIPE_SECRET_KEY, AROWANA_SITE_URL,
//   STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL,
//   STRIPE_PRICE_ELITE_MONTHLY, STRIPE_PRICE_ELITE_ANNUAL, STRIPE_PRICE_FOUNDERS
//
// Brought into the repo from deployed version 12, with one change: before a
// session is created, the Stripe price is checked against what the pricing
// and checkout pages show (price-guard.js). For Founders a mismatch refuses
// the checkout instead of charging a different amount than the buyer saw;
// for Pro it is logged (see price-guard.js for why).
import Stripe from 'npm:stripe@^17.0.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkPrice } from './price-guard.js';

// Allow the live site plus localhost, so local testing works without
// re-pointing the secret at a dev machine.
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

const PRICE_ENV: Record<string, string> = {
  'pro:monthly': 'STRIPE_PRICE_PRO_MONTHLY',
  'pro:annual': 'STRIPE_PRICE_PRO_ANNUAL',
  'elite:monthly': 'STRIPE_PRICE_ELITE_MONTHLY',
  'elite:annual': 'STRIPE_PRICE_ELITE_ANNUAL',
  'founders:annual': 'STRIPE_PRICE_FOUNDERS',
  'founders:monthly': 'STRIPE_PRICE_FOUNDERS',
};

// A caller-supplied return URL is only used if it stays on our own site or
// on localhost — otherwise checkout could be used to bounce people anywhere.
function safeUrl(candidate: unknown, fallback: string): string {
  const raw = typeof candidate === 'string' ? candidate.trim() : '';
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    const okSite = SITE && raw.startsWith(SITE);
    const okLocal = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    return (okSite || okLocal) ? raw : fallback;
  } catch { return fallback; }
}

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
    const plan = String(body.plan ?? '').toLowerCase();
    const cycle = String(body.cycle ?? 'monthly').toLowerCase() === 'annual' ? 'annual' : 'monthly';
    const envName = PRICE_ENV[`${plan}:${cycle}`];
    if (!envName) return json(req, { error: 'Unknown plan' }, 400);
    const price = Deno.env.get(envName);
    if (!price) return json(req, { error: `Price not configured (${envName})` }, 500);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

    // Charge only what the page showed. If the secret still points at an old
    // price, stop here — before a customer record or a session exists.
    const stripePrice = await stripe.prices.retrieve(price).catch(() => null);
    const priceCheck = checkPrice(`${plan}:${cycle}`, stripePrice);
    if (!priceCheck.ok) {
      console.error('[arowana-checkout] price mismatch', envName, priceCheck.reason, priceCheck.block ? '(blocked)' : '(logged only)');
      if (priceCheck.block) {
        return json(req, { error: 'This plan is being updated. Please try again shortly. You have not been charged.' }, 503);
      }
    }

    // Reuse this user's Stripe customer so plan changes stay on one record.
    const { data: profile } = await supabase
      .from('profiles').select('arowana_stripe_customer_id, email').eq('id', user.id).maybeSingle();
    let customerId = profile?.arowana_stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email ?? undefined,
        metadata: { supabase_user_id: user.id, product: 'arowana' },
      });
      customerId = customer.id;
      await supabase.from('profiles')
        .update({ arowana_stripe_customer_id: customerId, arowana_plan_updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      metadata: { supabase_user_id: user.id, plan },
      allow_promotion_codes: true,
      success_url: safeUrl(body.success_url, `${SITE}/account.html?checkout=success&plan=${encodeURIComponent(plan)}`),
      cancel_url: safeUrl(body.cancel_url, `${SITE}/pricing.html?checkout=cancelled`),
    });

    return json(req, { url: session.url });
  } catch (err) {
    console.error('[arowana-checkout]', err);
    const message = err instanceof Error ? err.message : 'Could not start checkout';
    return json(req, { error: message.slice(0, 200) }, 500);
  }
});
