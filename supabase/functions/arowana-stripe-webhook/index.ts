// arowana-stripe-webhook — the only writer of arowana_plan.
//
// Stripe → this function → profiles.arowana_plan / _status / _renews_at.
// Deployed with JWT verification OFF: Stripe signs its own requests, which
// this verifies with STRIPE_WEBHOOK_SECRET before doing anything.
//
// Secrets required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import Stripe from 'npm:stripe@^17.0.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Stripe status → what the app stores.
const STATUS: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due', unpaid: 'past_due',
  canceled: 'canceled', incomplete: 'incomplete', incomplete_expired: 'canceled', paused: 'canceled',
};
const PAID = new Set(['active', 'trialing', 'past_due']);

function planFrom(sub: Stripe.Subscription): string | null {
  const fromMeta = String(sub.metadata?.plan ?? '').toLowerCase();
  if (['pro', 'elite', 'founders'].includes(fromMeta)) return fromMeta;
  const nick = String(sub.items.data[0]?.price?.nickname ?? '').toLowerCase();
  if (nick.includes('founder')) return 'founders';
  if (nick.includes('elite')) return 'elite';
  if (nick.includes('pro')) return 'pro';
  return null;
}

async function findUserId(sub: Stripe.Subscription, customerId: string): Promise<string | null> {
  const metaId = String(sub.metadata?.supabase_user_id ?? '');
  if (metaId) return metaId;
  const { data } = await supabase.from('profiles').select('id')
    .eq('arowana_stripe_customer_id', customerId).maybeSingle();
  return data?.id ?? null;
}

async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await findUserId(sub, customerId);
  if (!userId) { console.warn('[webhook] no profile for customer', customerId); return; }

  const status = STATUS[sub.status] ?? 'incomplete';
  const plan = PAID.has(sub.status) ? (planFrom(sub) ?? 'pro') : 'free';
  const renews = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

  const { error } = await supabase.from('profiles').update({
    arowana_plan: plan,
    arowana_plan_status: status,
    arowana_stripe_customer_id: customerId,
    arowana_stripe_subscription_id: sub.id,
    arowana_plan_renews_at: renews,
    arowana_plan_updated_at: new Date().toISOString(),
  }).eq('id', userId);
  if (error) throw error;
  console.log('[webhook]', userId, plan, status);
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!sig || !secret) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (err) {
    console.error('[webhook] bad signature', err);
    return new Response('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          // Carry the buyer through even if Stripe didn't copy the metadata.
          if (!sub.metadata?.supabase_user_id && session.client_reference_id) {
            sub.metadata = { ...sub.metadata, supabase_user_id: session.client_reference_id, plan: String(session.metadata?.plan ?? '') };
          }
          await applySubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;   // everything else is ignored on purpose
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[webhook] handler failed', event.type, err);
    return new Response('Handler error', { status: 500 });   // Stripe retries
  }
});
