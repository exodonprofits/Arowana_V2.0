// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/trade-check.js');

const RULES = { wheelCapital: 100000, maxTickerPct: 20, maxTotalPct: 60, maxPutsPerTicker: 2, warnEarnings: true,
  minAnnualYield: 12, minDte: 20, maxDte: 50, requireWantToOwn: true, putAtOrBelowTarget: true, callAboveBasis: true, warnExDiv: true };
const EMPTY = { total: 0, byTicker: {}, putsByTicker: {} };
const status = (r, id) => r.checks.find(c => c.id === id).status;

test('a put that meets every rule', () => {
  const r = C.evaluate(
    { ticker: 'ko', type: 'put', strike: 58, expiry: '2026-10-30', premium: 0.9, contracts: 1, today: '2026-09-25' },
    { price: 61, wantToOwn: { KO: { target: 60 } }, earningsDate: '2026-10-21', exposure: EMPTY, holding: {} },
    Object.assign({}, RULES, { warnEarnings: false }));
  assert.equal(r.math.dte, 35);
  assert.equal(r.math.collateral, 5800);
  assert.equal(r.math.premiumTotal, 90);
  assert.equal(r.math.breakeven, 57.1);
  assert.ok(Math.abs(r.math.annualized - 0.9 / 58 * 100 * 365 / 35) < 1e-9);
  assert.equal(r.failed, 0);
  assert.deepEqual(r.checks.map(c => c.id), ['dte', 'yield', 'wto', 'target', 'earnings', 'ticker', 'total', 'stack']);
  assert.equal(status(r, 'earnings'), 'skip');
});

test('a put that breaks the list, target, earnings, yield and room rules', () => {
  const r = C.evaluate(
    { ticker: 'XYZ', type: 'put', strike: 100, expiry: '2026-11-20', premium: 0.5, contracts: 2, today: '2026-09-25' },
    { price: 104, wantToOwn: { KO: {} }, earningsDate: '2026-10-28',
      exposure: { total: 50000, byTicker: { XYZ: 10000 }, putsByTicker: { XYZ: 1 } }, holding: {} },
    RULES);
  ['dte', 'yield', 'wto', 'earnings', 'ticker', 'total', 'stack'].forEach(id => assert.equal(status(r, id), 'fail', id));
  assert.equal(status(r, 'target'), 'skip');     // not on the list, so no target
  assert.match(r.checks.find(c => c.id === 'ticker').detail, /\$30,000.*30\.0% of \$100,000/);
});

test('earnings: not looked up is skipped, none found passes', () => {
  const t = { ticker: 'KO', type: 'put', strike: 58, expiry: '2026-10-30', premium: 0.9, contracts: 1, today: '2026-09-25' };
  assert.equal(status(C.evaluate(t, { wantToOwn: {} }, RULES), 'earnings'), 'skip');
  assert.equal(status(C.evaluate(t, { wantToOwn: {}, earningsDate: null }, RULES), 'earnings'), 'pass');
  assert.equal(status(C.evaluate(t, { wantToOwn: {}, earningsDate: '2026-11-02' }, RULES), 'earnings'), 'pass');
});

test('without wheel capital the percentage rules are skipped, not guessed', () => {
  const r = C.evaluate({ ticker: 'KO', type: 'put', strike: 58, expiry: '2026-10-30', premium: 0.9, contracts: 1, today: '2026-09-25' },
    { wantToOwn: null, exposure: EMPTY }, Object.assign({}, RULES, { wheelCapital: null }));
  assert.equal(status(r, 'ticker'), 'skip');
  assert.equal(status(r, 'total'), 'skip');
  assert.equal(status(r, 'wto'), 'skip');
});

test('a covered call below adjusted basis, not enough free shares, ex-div inside', () => {
  const r = C.evaluate(
    { ticker: 'PFE', type: 'call', strike: 28, expiry: '2026-10-16', premium: 0.4, contracts: 2, today: '2026-09-25' },
    { price: 27.5, earningsDate: null, exDivDate: '2026-10-09',
      holding: { shares: 200, heldCost: 6000, adjustedBasis: 28.6, coveredShares: 100 } },
    RULES);
  assert.equal(status(r, 'basis'), 'fail');
  assert.equal(status(r, 'cover'), 'fail');
  assert.equal(status(r, 'exdiv'), 'fail');
  assert.equal(r.math.ifCalled, (28 - 28.6 + 0.4) * 200);
  assert.ok(Math.abs(r.math.yieldPct - 0.4 / 27.5 * 100) < 1e-9);
  assert.ok(!r.checks.some(c => c.id === 'wto' || c.id === 'ticker'));
});

test('a covered call that passes', () => {
  const r = C.evaluate(
    { ticker: 'PFE', type: 'call', strike: 30, expiry: '2026-10-30', premium: 0.35, contracts: 1, today: '2026-09-25' },
    { price: 29, earningsDate: null, exDivDate: null, holding: { shares: 100, adjustedBasis: 28.6, coveredShares: 0 } },
    RULES);
  assert.equal(r.failed, 0);
  assert.equal(status(r, 'exdiv'), 'skip');
});

test('rules turned off are reported as skipped', () => {
  const off = { requireWantToOwn: false, putAtOrBelowTarget: false, warnEarnings: false };
  const r = C.evaluate({ ticker: 'KO', type: 'put', strike: 58, expiry: '2026-10-30', premium: 0.9, contracts: 1, today: '2026-09-25' },
    { wantToOwn: {}, exposure: EMPTY }, off);
  assert.equal(r.failed, 0);
  assert.equal(r.passed, 0);
  assert.equal(r.skipped, r.checks.length);
});

test('cases: rule passes argue for, failures and obligations against', () => {
  const t = { ticker: 'XYZ', type: 'put', strike: 100, expiry: '2026-11-20', premium: 0.5, contracts: 2, today: '2026-09-25' };
  const ctx = { price: 101, wantToOwn: { KO: {} }, earningsDate: '2026-10-28',
    exposure: { total: 50000, byTicker: { XYZ: 10000 }, putsByTicker: { XYZ: 1 } }, holding: {} };
  const k = C.cases(t, ctx, C.evaluate(t, ctx, RULES));
  assert.match(k.for[0], /^You collect \$100\.00 now, 0\.50% on the cash set aside/);
  assert.match(k.against[0], /^\$20,000 of cash is tied up until 2026-11-20; if assigned you buy 200 shares at \$99\.50/);
  assert.ok(k.against.some(x => /^Only 1\.0% between the last price and the strike/.test(x)));
  assert.ok(k.against.some(x => /^Breaks 7 of your rules: .*room in one name/.test(x)));
  assert.ok(!k.for.some(x => /rules/.test(x)));
  assert.equal(k.unchecked, 1);                 // target: not on the list, so no target
});

test('cases: earnings still count against when the rule is off; calls cap upside', () => {
  const t = { ticker: 'KO', type: 'call', strike: 64, expiry: '2026-10-30', premium: 0.6, contracts: 1, today: '2026-09-25' };
  const ctx = { price: 58, earningsDate: '2026-10-21', exposure: EMPTY, holding: { shares: 100, adjustedBasis: 60, coveredShares: 0 } };
  const k = C.cases(t, ctx, C.evaluate(t, ctx, Object.assign({}, RULES, { warnEarnings: false })));
  assert.ok(k.against.includes('Your upside is capped at $64.00 a share until 2026-10-30.'));
  assert.ok(k.for.some(x => /^If called away: \$460/.test(x)));
  assert.ok(k.against.includes('Earnings 2026-10-21, before the 2026-10-30 expiration.'));
  assert.ok(k.for.some(x => /^10\.3% between the last price and the strike/.test(x)));
});
