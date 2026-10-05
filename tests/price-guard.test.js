// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../supabase/functions/arowana-checkout/price-guard.js');
const price = (o) => Object.assign({ active: true, currency: 'usd', unit_amount: 29900, recurring: { interval: 'year', interval_count: 1 } }, o);

test('founders at $299/year passes for both aliases; old prices are blocked', async () => {
  const G = await load();
  for (const key of ['founders:annual', 'founders:monthly']) {
    assert.deepEqual(G.checkPrice(key, price({})), { ok: true });
    for (const amount of [22900, 39900]) {
      const r = G.checkPrice(key, price({ unit_amount: amount }));
      assert.equal(r.ok, false);
      assert.equal(r.block, true);
      assert.equal(r.reason, 'amount ' + amount + ', page shows 29900');
    }
  }
});

test('refuses archived, wrong currency, wrong interval, missing price', async () => {
  const G = await load();
  assert.equal(G.checkPrice('founders:annual', price({ active: false })).ok, false);
  assert.equal(G.checkPrice('founders:annual', price({ currency: 'eur' })).ok, false);
  assert.equal(G.checkPrice('founders:annual', price({ recurring: { interval: 'month', interval_count: 1 } })).ok, false);
  assert.equal(G.checkPrice('founders:annual', price({ recurring: { interval: 'year', interval_count: 2 } })).ok, false);
  assert.equal(G.checkPrice('founders:annual', null).ok, false);
});

test('pro monthly and annual match the page; unlisted plans are not checked', async () => {
  const G = await load();
  assert.equal(G.checkPrice('pro:monthly', price({ unit_amount: 2900, recurring: { interval: 'month' } })).ok, true);
  assert.equal(G.checkPrice('pro:annual', price({ unit_amount: 29000 })).ok, true);
  const pro = G.checkPrice('pro:monthly', price({ unit_amount: 1900, recurring: { interval: 'month' } }));
  assert.equal(pro.ok, false);
  assert.equal(pro.block, false);            // Pro mismatches are logged, not blocked
  assert.equal(G.checkPrice('elite:monthly', price({ unit_amount: 1 })).ok, true);
});

test('EXPECTED matches the amounts checkout.html shows', async () => {
  const G = await load();
  const html = require('fs').readFileSync(require('path').join(__dirname, '../checkout.html'), 'utf8');
  const pro = html.match(/pro:\s*\{[\s\S]*?monthly:\s*(\d+),\s*annual:\s*(\d+)/);
  const fnd = html.match(/founders:\s*\{[\s\S]*?monthly:\s*(\d+),\s*annual:\s*(\d+)/);
  assert.equal(G.EXPECTED['pro:monthly'].amount, Number(pro[1]));
  assert.equal(G.EXPECTED['pro:annual'].amount, Number(pro[2]));
  assert.equal(G.EXPECTED['founders:annual'].amount, Number(fnd[2]));
});

// Cover the public offer and signed-in labels, not only the checkout table.
test('Founders offer is $299 across marketing and account pages', () => {
  const fs = require('fs'), path = require('path');
  for (const file of ['pricing.html', 'index.html', 'account.html', 'billing.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(html, /\$299/, file);
    assert.doesNotMatch(html, /\$(?:229|399)\b/, file);
  }
});
