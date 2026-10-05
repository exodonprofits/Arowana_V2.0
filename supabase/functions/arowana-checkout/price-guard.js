/* ============================================================================
   price-guard.js — never charge a different amount than the page shows.
   ----------------------------------------------------------------------------
   Checkout sends whatever Stripe price ID a secret points at. When the
   pricing pages change (Founders is now $299/year) and the secret
   still points at the old price, the buyer is charged the old amount. This
   checks the Stripe price against what pricing.html / checkout.html show
   before a session is created, and refuses when they disagree.

   EXPECTED must match checkout.html's PLANS table. Plans not listed here
   (elite, retired) are not checked. `block` decides what a mismatch does:
   Founders refuses the checkout; Pro only logs it, because its Stripe
   prices were never verified against the page and blocking every Pro sale
   on a guess would be worse than the risk it guards against. Set block on
   Pro once the logs show its prices match.

   Pure ES module: used by index.ts (Deno) and tests/price-guard.test.js.
   ========================================================================== */

export const EXPECTED = {
  'pro:monthly':      { amount: 2900,  interval: 'month', block: false },
  'pro:annual':       { amount: 29000, interval: 'year',  block: false },
  'founders:annual':  { amount: 29900, interval: 'year',  block: true },
  'founders:monthly': { amount: 29900, interval: 'year',  block: true },   // Founders is annual only
};

/* A Stripe Price object against the expected amount for plan:cycle.
   → { ok: true } or { ok: false, reason, block } */
export function checkPrice(key, price) {
  const want = EXPECTED[key];
  if (!want) return { ok: true };
  const r = mismatch(want, price);
  return r ? { ok: false, reason: r, block: want.block } : { ok: true };
}

function mismatch(want, price) {
  if (!price || typeof price !== 'object') return 'price not found';
  if (price.active === false) return 'price is archived';
  if (String(price.currency || '').toLowerCase() !== 'usd') return 'currency ' + price.currency;
  if (price.unit_amount !== want.amount) return 'amount ' + price.unit_amount + ', page shows ' + want.amount;
  const interval = price.recurring && price.recurring.interval;
  const count = (price.recurring && price.recurring.interval_count) || 1;
  if (interval !== want.interval || count !== 1) return 'billed every ' + count + ' ' + interval + ', page shows 1 ' + want.interval;
  return null;
}
