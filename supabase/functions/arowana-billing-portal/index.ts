// arowana-billing-portal — opens Stripe's customer portal for the signed-in
// user so they can change card, switch plan, or cancel without emailing us.
//
// POST { return_url? }   ← only honoured when it points at our own site
// Auth: the caller's Supabase access token in the Authorization header.
// Returns { url }.
//
// Secrets required: STRIPE_SECRET_KEY, AROWANA_SITE_URL
import Stripe from 'npm:stripe@^17.0.0';
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

    const { data: profile } = await supabase
      .from('profiles').select('arowana_stripe_customer_id').eq('id', user.id).maybeSingle();
    const customerId = profile?.arowana_stripe_customer_id;
    if (!customerId) return json(req, { error: 'No billing account yet — subscribe first' }, 400);

    const body = await req.json().catch(() => ({}));
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: safeUrl(body.return_url, `${SITE}/account.html`),
    });

    return json(req, { url: session.url });
  } catch (err) {
    console.error('[arowana-billing-portal]', err);
    const message = err instanceof Error ? err.message : 'Could not open billing';
    return json(req, { error: message.slice(0, 200) }, 500);
  }
});
