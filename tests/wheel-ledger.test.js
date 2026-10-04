// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/wheel-ledger.js');

const put = (o) => Object.assign({ ticker: 'KO', optType: 'put', strategy: 'Cash-Secured Put', isCredit: true, qty: 1, feeIn: 0, feeOut: 0, broker: 'Schwab' }, o);
const call = (o) => Object.assign({ ticker: 'KO', optType: 'call', strategy: 'Covered Call', isCredit: true, qty: 1, feeIn: 0, feeOut: 0, broker: 'Schwab' }, o);
const shares = (o) => Object.assign({ ticker: 'KO', side: 'long', qty: 100, fees: 0, broker: 'Schwab' }, o);
const OPTS = { today: '2026-09-25' };

// Put assigned (Assigned button: no exit date, no P&L), shares bought, call
// assigned, shares called away.
const wheelOptions = [
  put({ id: 'p1', strike: 45, expiry: '2026-01-16', entryDate: '2026-01-02', premiumIn: 1.0, status: 'assigned' }),
  call({ id: 'c1', strike: 47, expiry: '2026-02-20', entryDate: '2026-01-20', premiumIn: 0.8, status: 'assigned' })
];

test('full wheel with stock rows: income, stock gain, capital, dates', () => {
  const stocks = [shares({ id: 's1', entryDate: '2026-01-16', entryPrice: 45, status: 'closed', exitDate: '2026-02-20', exitPrice: 47 })];
  const [c, ...rest] = W.build(wheelOptions, stocks, OPTS);
  assert.equal(rest.length, 0);
  assert.equal(c.status, 'closed');
  assert.equal(c.start, '2026-01-02');
  assert.equal(c.end, '2026-02-20');
  assert.equal(c.optionIncome, 180);
  assert.equal(c.stockRealized, 200);
  assert.equal(c.realized, 380);
  assert.equal(c.peakCapital, 4500);
  assert.equal(c.assignments, 1);
  assert.equal(c.calledAway, 1);
  assert.equal(c.shares, 0);
  assert.deepEqual(c.warnings, []);
  assert.equal(c.days, 49);
  assert.ok(Math.abs(c.returnOnPeak - 380 / 4500 * 100) < 1e-9);
  assert.ok(Math.abs(c.annualized - 380 / 4500 * 100 * 365 / 49) < 1e-9);
});

test('assignments with no stock rows are filled in at the strike, with warnings', () => {
  const [c] = W.build(wheelOptions, [], OPTS);
  assert.equal(c.optionIncome, 180);
  assert.equal(c.stockRealized, 200);
  assert.equal(c.shares, 0);
  assert.equal(c.status, 'closed');
  assert.equal(c.warnings.length, 2);
});

test('open campaign: adjusted basis, unrealized, open premium', () => {
  const options = [
    put({ strike: 45, expiry: '2026-01-16', entryDate: '2026-01-02', premiumIn: 1.0, status: 'assigned', exitDate: '2026-01-16' }),
    call({ strike: 47, expiry: '2026-02-20', entryDate: '2026-01-20', premiumIn: 0.8, premiumOut: 0.3, exitDate: '2026-02-10', status: 'closed' }),
    call({ strike: 46, expiry: '2026-10-16', entryDate: '2026-09-15', premiumIn: 0.6, status: 'open' })
  ];
  const stocks = [shares({ entryDate: '2026-01-16', entryPrice: 45, status: 'open' })];
  const [c] = W.build(options, stocks, Object.assign({ prices: { KO: 44 } }, OPTS));
  assert.equal(c.status, 'open');
  assert.equal(c.end, null);
  assert.equal(c.optionIncome, 150);
  assert.equal(c.shares, 100);
  assert.equal(c.avgCost, 45);
  assert.equal(c.adjustedBasis, 43.5);
  assert.equal(c.unrealized, -100);
  assert.equal(c.total, 50);
  assert.equal(c.openPremium, 60);
  assert.equal(c.openLegs.length, 1);
});

test('expired via the button (no exit date) counts full premium on expiry', () => {
  const [c] = W.build([put({ strike: 50, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 1.25, feeIn: 0.65, status: 'expired' })], [], OPTS);
  assert.equal(c.end, '2026-03-20');
  assert.equal(c.optionIncome, 124.35);
  assert.equal(c.peakCapital, 5000);
});

test('a flat gap longer than the grace period starts a new campaign', () => {
  const a = put({ strike: 50, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 1, status: 'expired' });
  const near = put({ strike: 50, expiry: '2026-04-17', entryDate: '2026-03-23', premiumIn: 1, status: 'expired' });
  const far = put({ strike: 50, expiry: '2026-06-19', entryDate: '2026-05-20', premiumIn: 1, status: 'expired' });
  assert.equal(W.build([a, near], [], OPTS).length, 1);
  assert.equal(W.build([a, far], [], OPTS).length, 2);
});

test('spreads, long options and debit trades are not wheel legs', () => {
  const rows = [
    put({ strategy: 'Credit Spread', strike: 40, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 0.5, status: 'expired' }),
    call({ strategy: 'Long Call', isCredit: false, strike: 60, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 2, status: 'expired' }),
    put({ strategy: 'Iron Condor', strike: 40, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 1, status: 'expired' })
  ];
  assert.equal(W.build(rows, [], OPTS).length, 0);
});

test('share runs without options are not campaigns; held shares + calls are', () => {
  const stocks = [
    shares({ entryDate: '2023-02-01', entryPrice: 30, status: 'closed', exitDate: '2023-03-01', exitPrice: 33 }),
    shares({ entryDate: '2025-06-02', entryPrice: 40, status: 'open' })
  ];
  const options = [call({ strike: 44, expiry: '2026-02-20', entryDate: '2026-01-20', premiumIn: 0.5, status: 'expired' })];
  const list = W.build(options, stocks, OPTS);
  assert.equal(list.length, 1);
  assert.equal(list[0].start, '2025-06-02');
  assert.equal(list[0].stockRealized, 0);
  assert.equal(list[0].adjustedBasis, 39.5);
});

test('accounts are kept apart', () => {
  const rows = [
    put({ strike: 50, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 1, status: 'expired' }),
    put({ strike: 50, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 1, status: 'expired', broker: 'IRA' })
  ];
  const list = W.build(rows, [], OPTS);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(c => c.account).sort(), ['IRA', 'Schwab']);
});

test('a roll (closed at a loss, reopened same day) stays in one campaign', () => {
  const rows = [
    put({ strike: 50, expiry: '2026-03-20', entryDate: '2026-03-01', premiumIn: 1, premiumOut: 2.5, exitDate: '2026-03-18', status: 'closed' }),
    put({ strike: 48, expiry: '2026-04-17', entryDate: '2026-03-18', premiumIn: 2.8, status: 'expired' })
  ];
  const list = W.build(rows, [], OPTS);
  assert.equal(list.length, 1);
  assert.equal(list[0].optionIncome, 130);
  assert.equal(list[0].puts, 2);
});

test('summary adds up', () => {
  const s = W.summarize(W.build(wheelOptions, [], OPTS));
  assert.deepEqual(s, { campaigns: 1, open: 0, closed: 1, optionIncome: 180, stockRealized: 200, realized: 380, winners: 1 });
});
