// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../js/digest.js');

const put = (o) => Object.assign({ optType: 'put', isCredit: true, qty: 1, status: 'open', broker: 'Schwab' }, o);
const call = (o) => Object.assign({ optType: 'call', isCredit: true, qty: 1, status: 'open', broker: 'Schwab' }, o);
const base = (o) => Object.assign({ today: '2026-09-29', options: [], stocks: [], prices: {}, earnings: {}, roll: [], capital: null, priceDate: '2026-09-28' }, o);

test('quiet day builds no email', async () => {
  const D = await load();
  const d = base({ options: [put({ ticker: 'KO', strike: 55, expiry: '2026-10-30', premiumIn: 0.8 })], prices: { KO: 62 } });
  assert.equal(D.buildDaily(d), null);
});

test('daily: near the strike, earnings before expiration, expiring soon', async () => {
  const D = await load();
  const d = base({
    options: [
      put({ ticker: 'KO', strike: 60, expiry: '2026-10-30', premiumIn: 0.8 }),          // 1% above strike
      call({ ticker: 'PFE', strike: 28, expiry: '2026-10-01', premiumIn: 0.4 }),        // ITM, expires in 2 days
      put({ ticker: 'MSFT', strike: 380, expiry: '2026-10-30', premiumIn: 4 }),         // far, but earnings inside
      put({ ticker: 'OLD', strike: 10, expiry: '2026-09-01', premiumIn: 1 }),           // past expiry, still open
      put({ ticker: 'X', strike: 10, expiry: '2026-10-30', premiumIn: 1, status: 'closed' })
    ],
    prices: { KO: 60.6, PFE: 28.5, MSFT: 430 }, earnings: { MSFT: '2026-10-22', KO: '2026-11-20' }
  });
  const e = D.buildDaily(d);
  assert.equal(e.kind, 'morning');
  assert.deepEqual(e.sections.map(s => s.id), ['stale', 'near', 'earnings', 'soon']);
  assert.deepEqual(e.sections[0].rows, [['OLD $10.00 put, Tue Sep 1', 'expired 28 days ago']]);
  assert.equal(e.sections[1].rows[0][0].startsWith('PFE'), true);          // deepest first
  assert.match(e.sections[1].rows[0][1], /1\.8% in the money/);
  assert.match(e.sections[1].rows[1][1], /1\.0% above the strike/);
  assert.equal(e.sections[2].rows.length, 1);
  assert.match(e.subject, /^1 past expiration still open, 2 positions near the strike, 1 earnings report before expiration, 1 expiring soon$/);
});

test('daily: idle cash from wheel capital', async () => {
  const D = await load();
  const d = base({ capital: 100000,
    options: [put({ ticker: 'KO', strike: 50, expiry: '2026-10-30', premiumIn: 1, qty: 2 })],
    stocks: [{ ticker: 'PFE', side: 'long', qty: 200, entryPrice: 30, status: 'open' }] });
  const e = D.buildDaily(d);
  assert.equal(e.sections[0].id, 'idle');
  assert.equal(e.sections[0].rows[0][0], '$84,000 free');   // 100k − 10k puts − 6k shares
});

test('expiration week lists this week with Roll Coach choices and ITM count', async () => {
  const D = await load();
  const d = base({ today: '2026-09-28',
    options: [
      put({ ticker: 'KO', strike: 60, expiry: '2026-10-02', premiumIn: 0.8 }),
      call({ ticker: 'PFE', strike: 28, expiry: '2026-10-02', premiumIn: 0.4 }),
      put({ ticker: 'MSFT', strike: 380, expiry: '2026-10-16', premiumIn: 4 })
    ],
    prices: { KO: 63, PFE: 29, MSFT: 382 },
    roll: [{ underlying: 'PFE', opt_type: 'call', strike: 28, expiry: '2026-10-02', computed_at: '2026-09-18T02:00:00Z',
      choices: [{ label: 'Let it be called away', detail: 'keep $40 + $0 gain' }, { label: 'Roll out', unavailable: true }, { label: 'Buy back', detail: 'costs $105' }] }] });
  const e = D.buildExpiryWeek(d);
  assert.equal(e.subject, 'Expiration week: 2 positions, 1 in the money');
  const s = e.sections[0];
  assert.equal(s.rows.length, 2);
  assert.deepEqual(s.details[1], ['Let it be called away: keep $40 + $0 gain', 'Buy back: costs $105']);
  assert.match(s.note, /Roll Coach last updated Fri Sep 18/);
  assert.ok(e.sections.some(x => x.id === 'near' && x.rows[0][0].startsWith('MSFT')));   // later expiry still watched
  const idle = D.buildExpiryWeek(Object.assign({}, d, { capital: 100000 })).sections.find(x => x.id === 'idle');
  assert.match(idle.note, /put collateral \$44,000/);   // this week's KO put + later MSFT put
  assert.equal(D.buildExpiryWeek(base({ today: '2026-09-28' })), null);
});

test('monthly statement counts closed, expired and assigned, by settle date', async () => {
  const D = await load();
  const d = base({ today: '2026-10-01', options: [
    put({ ticker: 'KO', strike: 60, expiry: '2026-09-18', premiumIn: 1, status: 'expired' }),                        // +100, no pnl stored
    put({ ticker: 'KO', strike: 60, expiry: '2026-09-25', premiumIn: 1, premiumOut: 1.5, exitDate: '2026-09-20', status: 'closed' }), // −50
    put({ ticker: 'PFE', strike: 30, expiry: '2026-09-18', premiumIn: 0.9, status: 'assigned', exitDate: '2026-09-18', pnl: 90 }),
    put({ ticker: 'PFE', strike: 30, expiry: '2026-08-21', premiumIn: 0.5, status: 'expired' }),                        // August +50
    call({ ticker: 'PFE', strike: 32, expiry: '2026-10-16', premiumIn: 0.3 })                                            // open
  ] });
  const e = D.buildMonthly(d, '2026-09');
  assert.equal(e.subject, 'September 2026 options income: $140');
  const sum = Object.fromEntries(e.sections[0].rows);
  assert.equal(sum['Trades settled'], '3 (2 profitable, 1 assigned)');
  assert.equal(sum['August 2026'], '$50');
  assert.equal(sum['Year to date'], '$190');
  assert.deepEqual(e.sections[1].rows, [['PFE (1 trade)', '$90'], ['KO (2 trades)', '$50']]);
  assert.equal(e.sections[2].id, 'open');
  assert.equal(D.buildMonthly(base({ today: '2026-10-01' }), '2026-09'), null);
});

test('render escapes journal text and includes unsubscribe', async () => {
  const D = await load();
  const e = D.buildDaily(base({ options: [put({ ticker: '<B>', strike: 10, expiry: '2026-10-01', premiumIn: 1 })], prices: {} }));
  const r = D.render(e, { app: 'https://arowanaprofits.com', settings: 'https://arowanaprofits.com/account.html#email', unsubscribe: 'https://x/u?t=1' });
  assert.ok(!r.html.includes('<B>'));
  assert.ok(r.html.includes('&lt;B&gt;'));
  assert.match(r.text, /Unsubscribe: https:\/\/x\/u\?t=1/);
  assert.match(r.html, /not investment advice/);
});

test('week end: Monday → Friday, Friday → same day, Saturday → next Friday', async () => {
  const D = await load();
  assert.equal(D._internals.weekEnd('2026-09-28'), '2026-10-02');
  assert.equal(D._internals.weekEnd('2026-10-02'), '2026-10-02');
  assert.equal(D._internals.weekEnd('2026-10-03'), '2026-10-09');
});

test('wheel status: always built, this week, checks, capital in use', async () => {
  const D = await load();
  const empty = D.wheelStatus(base({}));
  assert.deepEqual(empty.sections, []);
  assert.equal(empty.puts + empty.calls, 0);

  const s = D.wheelStatus(base({ today: '2026-09-28', capital: 100000,
    options: [
      put({ ticker: 'KO', strike: 60, expiry: '2026-10-02', premiumIn: 0.8 }),     // this week, 1% above
      call({ ticker: 'PFE', strike: 28, expiry: '2026-10-16', premiumIn: 0.4 }),
      put({ ticker: 'MSFT', strike: 380, expiry: '2026-10-30', premiumIn: 4 })      // earnings inside
    ],
    stocks: [{ ticker: 'PFE', side: 'long', qty: 100, entryPrice: 30, status: 'open' }],
    prices: { KO: 60.6, PFE: 27, MSFT: 430 }, earnings: { MSFT: '2026-10-22' } }));
  assert.deepEqual(s.sections.map(x => x.id), ['week', 'near', 'earnings', 'idle']);
  assert.match(s.sections[0].title, /Expiring by Fri Oct 2/);
  assert.match(s.sections[0].rows[0][1], /1\.0% above the strike · \$80 premium/);
  assert.equal(s.puts, 2); assert.equal(s.calls, 1);
  assert.equal(s.collateral, 44000); assert.equal(s.shares, 3000); assert.equal(s.free, 53000);
  assert.equal(s.credit, 520);
});

test('wheel status: options still open after expiration come first, oldest first', async () => {
  const D = await load();
  const s = D.wheelStatus(base({ today: '2026-09-28',
    options: [
      put({ ticker: 'KO', strike: 60, expiry: '2026-09-18', premiumIn: 0.8 }),                 // 10 days past
      call({ ticker: 'PFE', strike: 28, expiry: '2026-09-25', premiumIn: 0.4, qty: 2 }),       // 3 days past
      { ticker: 'AMD', optType: 'call', isCredit: false, strike: 150, expiry: '2026-09-26', status: 'open' },  // bought, 2 days past
      put({ ticker: 'X', strike: 10, expiry: '2026-09-01', premiumIn: 1, status: 'expired' }),  // handled already
      put({ ticker: 'MSFT', strike: 380, expiry: '2026-10-30', premiumIn: 4 })                  // still live
    ], prices: { MSFT: 430 } }));
  assert.equal(s.sections[0].id, 'stale');
  assert.deepEqual(s.sections[0].rows.map(r => r[0].split(' ')[0]), ['KO', 'PFE', 'AMD']);
  assert.equal(s.sections[0].rows[0][1], 'expired 10 days ago');
  assert.match(s.sections[0].rows[1][0], /PFE \$28\.00 call ×2/);
  assert.equal(s.puts, 1);                    // only MSFT counts as open
});

test('daily: a stale row alone is worth an email; expiration week lists them after this week', async () => {
  const D = await load();
  const stale = put({ ticker: 'KO', strike: 60, expiry: '2026-09-18', premiumIn: 0.8 });
  const e = D.buildDaily(base({ today: '2026-09-28', options: [stale] }));
  assert.deepEqual(e.sections.map(s => s.id), ['stale']);
  assert.equal(e.subject, '1 past expiration still open');
  assert.equal(e.sections[0].rows[0][1], 'expired 10 days ago');
  const w = D.buildExpiryWeek(base({ today: '2026-09-28', options: [stale, put({ ticker: 'MSFT', strike: 380, expiry: '2026-10-02', premiumIn: 4 })], prices: { MSFT: 430 } }));
  assert.deepEqual(w.sections.map(s => s.id), ['expiring', 'stale']);
  assert.match(w.subject, /^Expiration week: 1 position$/);
  assert.equal(D.buildExpiryWeek(base({ today: '2026-09-28', options: [stale] })), null);   // nothing expiring: Monday falls back to the daily
  assert.equal(D.buildMonthly(base({ today: '2026-10-01', options: [put({ ticker: 'KO', strike: 60, expiry: '2026-09-18', premiumIn: 0.8 })] }), '2026-09'), null);  // monthly unchanged
});
