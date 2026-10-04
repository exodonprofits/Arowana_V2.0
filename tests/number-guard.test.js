// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../supabase/functions/_shared/number-guard.js');

const FACTS = [
  { label: 'Premium', value: '$95 ($0.95 × 100 shares)' },
  { label: 'Yield', value: '1.58% in 35 days, 16.47% a year' },
  { label: 'Collateral', value: '$12,480' },
  { label: 'Expiration', value: '2026-10-30' },
  { label: 'Rules broken', value: '3 of 8' }
];

test('numbers copied from the facts pass, in any reasonable format', async () => {
  const G = await load();
  const r = G.verify('You would collect $95, or 1.58% in 35 days (about 16.5% a year). The put ties up $12,480 (12.5k) until Oct 30. It breaks 3 of your 8 rules.', FACTS);
  assert.deepEqual(r, { ok: true, unsupported: [] });
});

test('a number the model worked out itself is rejected', async () => {
  const G = await load();
  const r = G.verify('Your breakeven is $59.05 and you would make $190 over two contracts.', FACTS);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unsupported, ['$59.05', '$190']);
});

test('rounding is allowed, recomputation is not', async () => {
  const G = await load();
  assert.equal(G.verify('about 16% a year', FACTS).ok, true);
  assert.equal(G.verify('about 17% a year', FACTS).ok, false);   // 16.47 does not round to 17
  assert.equal(G.verify('$12k', FACTS).ok, true);
  assert.equal(G.verify('$13k', FACTS).ok, false);
});

test('tickers, spelled numbers and the contract multiplier are not flagged', async () => {
  const G = await load();
  assert.equal(G.verify('Q3 results for S&P500 names; two rules; 100 shares per contract.', FACTS).ok, true);
});

test('extractNumbers reads thousands separators, percents and suffixes', async () => {
  const G = await load();
  const n = G.extractNumbers('$1,234.50 and 12% and 3.5M and 7k');
  assert.deepEqual(n.map(x => [x.raw, x.value, x.scale]), [['$1,234.50', 1234.5, 1], ['12%', 12, 1], ['3.5M', 3.5, 1e6], ['7k', 7, 1e3]]);
});

test('facts as a plain string work too', async () => {
  const G = await load();
  assert.equal(G.verify('Realized $1,420 in September.', 'Realized: $1,420; month: 2026-09').ok, true);
});
