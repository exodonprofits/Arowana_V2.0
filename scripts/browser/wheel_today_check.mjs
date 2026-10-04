// ATD-108 S6: "Your wheel today" on Arowana Trader, and the wheel summary in
// both coaches' context, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/wheel_today_check.mjs
//
// Runs against the fake Supabase (scripts/browser/lib/fake_supabase.mjs) with
// arowana-ai-coach stubbed; the journal comes from the browser's journal
// cache (tj_options_v2 / tj_stocks_v2), as on the live page.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 12000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}

// "Today" as wheel-status.js computes it (America/Chicago).
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const wd = new Date(Date.parse(today + 'T00:00:00Z')).getUTCDay();
const friday = addDays(today, wd === 6 ? 6 : 5 - wd);
const T = '2026-09-01T00:00:00.000Z';
const opt = p => Object.assign({ isCredit: true, qty: 1, status: 'open', broker: 'Schwab', entryDate: addDays(today, -10), updatedAt: T }, p);
const OPTIONS = [
  opt({ id: 'p-near', ticker: 'SYNK', optType: 'put', strategy: 'Cash-Secured Put', strike: 50, expiry: addDays(today, 30), premiumIn: 1.2 }),   // close 50.5: within 3%
  opt({ id: 'p-week', ticker: 'SYNW', optType: 'put', strategy: 'Cash-Secured Put', strike: 20, expiry: friday, premiumIn: 0.5 }),            // expires this week
  opt({ id: 'c-far', ticker: 'SYNF', optType: 'call', strategy: 'Covered Call', strike: 120, expiry: addDays(today, 40), premiumIn: 1 }),
  opt({ id: 'p-stale', ticker: 'SYNS', optType: 'put', strategy: 'Cash-Secured Put', strike: 30, expiry: addDays(today, -3), premiumIn: 0.4 })  // past expiration, still open
];
const STOCKS = [{ id: 's1', ticker: 'SYNF', side: 'long', qty: 100, entryPrice: 100, status: 'open', broker: 'Schwab', updatedAt: T }];
const db = () => ({
  ap_risk_settings: [{ user_id: UID, wheel_capital: 50000, max_ticker_pct: 20, max_total_pct: 60, max_puts_per_ticker: 2, warn_earnings: true, rules: {} }],
  market_snapshots: [
    { symbol: 'SYNK', tf: '1d', ts: addDays(today, -1) + 'T21:00:00Z', ohlcv: { close: 50.5 } },
    { symbol: 'SYNW', tf: '1d', ts: addDays(today, -1) + 'T21:00:00Z', ohlcv: { close: 24 } },
    { symbol: 'SYNF', tf: '1d', ts: addDays(today, -1) + 'T21:00:00Z', ohlcv: { close: 104 } }
  ],
  tj_options: [], tj_stocks: [], watchlists: [], watchlist_items: []
});
const LS = { tj_options_v2: JSON.stringify(OPTIONS), tj_stocks_v2: JSON.stringify(STOCKS), ap_journal_owner_v1: UID, ap_onboarded_v1: '1' };

const browser = await chromium.launch();
async function open(path, coachCalls) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await installFakeSupabase(ctx, db(), { localStorage: LS, functions: { 'arowana-ai-coach': async (req) => { coachCalls && coachCalls.push(req.body); return { json: { reply: 'Synthetic coach reply.' } }; } } });
  const p = await ctx.newPage();
  const errors = [], bad = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => { if (r.status() === 404 && new URL(r.url()).hostname === '127.0.0.1') bad.push(r.url()); });
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  return { ctx, p, errors, bad };
}

// ── Arowana Trader panel ─────────────────────────────────────────────────
{
  const coach = [];
  const { ctx, p, errors, bad } = await open('arowana-trader.html', coach);
  const ready = await until(() => p.evaluate(() => (document.getElementById('wheelKpis') || {}).children?.length >= 3));
  const r = await p.evaluate(() => ({
    kpis: [...document.querySelectorAll('#wheelKpis .kpi-card')].map(k => k.textContent.replace(/\s+/g, ' ').trim()),
    sections: [...document.querySelectorAll('#wheelSections .wheel-card')].map(c => ({ cls: c.className, title: c.querySelector('h3').textContent, rows: [...c.querySelectorAll('.wheel-row')].map(x => x.textContent) })),
    foot: (document.getElementById('wheelFoot') || {}).textContent,
    scan: !!document.getElementById('briefSection')
  }));
  check('panel renders three KPIs', ready && r.kpis.length === 3, r.kpis);
  // The past-expiration put is flagged, not counted as open (digest.js).
  check('open contracts: 2 puts, 1 call', /2 puts · 1 call/.test(r.kpis[0] || ''), r.kpis);
  // collateral: (50 + 20) strikes x 100 = $7,000 of $50,000 = 14%
  check('put collateral $7,000 = 14% of wheel capital', /\$7,000/.test(r.kpis[1] || '') && /14% of your \$50,000/.test(r.kpis[1] || ''), r.kpis);
  // free: 50,000 - 7,000 - 10,000 shares at cost
  check('cash not working $33,000', /\$33,000/.test(r.kpis[2] || ''), r.kpis);
  const sec = id => r.sections.find(s => s.cls.includes('wheel-' + id));
  check('past-expiration contract flagged first', r.sections[0] && r.sections[0].cls.includes('wheel-stale') && /SYNS/.test(r.sections[0].rows.join(' ')), r.sections.map(s => s.title));
  check('this week\'s expiration listed', !!sec('week') && /SYNW/.test(sec('week').rows.join(' ')), r.sections);
  check('near-the-strike put listed', !!sec('near') && /SYNK/.test(sec('near').rows.join(' ')), r.sections);
  check('footer names the sources', /From your trade journal/.test(r.foot || '') && /same checks as your daily email/.test(r.foot || ''), r.foot);
  check('Morning Brief scan kept below the panel', r.scan);
  check('digest module served from js/ (no 404s)', bad.length === 0 && await p.evaluate(async () => !!(await AP_WHEELSTATUS.digest()).wheelStatus), bad);

  // Coach context carries the wheel summary.
  await p.evaluate(() => { if (typeof switchTab === 'function') switchTab('chat'); });
  const sent = await p.evaluate(async () => {
    const input = document.getElementById('chatInput') || document.querySelector('#tab-chat textarea, #tab-chat input[type="text"]');
    if (!input) return 'no input';
    input.value = 'What needs me today?';
    const btn = document.getElementById('chatSend') || document.querySelector('#tab-chat button[type="submit"], #tab-chat .chat-send, #btnSend');
    if (btn) btn.click(); else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'sent';
  });
  const got = await until(() => coach.length > 0, 8000);
  const ctxSent = got ? (coach[0].context || {}) : {};
  check('Arowana Trader coach context includes open puts/calls and wheel capital', got && /put/i.test(String(ctxSent.openPositions || '')) && !!ctxSent.wheelCapital, { sent, ctx: ctxSent });
  check('arowana-trader: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Trading Command coach ────────────────────────────────────────────────
{
  const coach = [];
  const { ctx, p, errors } = await open('trading-command.html', coach);
  await p.waitForTimeout(1500);
  await p.evaluate(() => { if (typeof switchTab === 'function') switchTab('coach'); });
  await p.fill('#coachInput', 'What needs me today?').catch(() => p.evaluate(() => { document.getElementById('coachInput').value = 'What needs me today?'; }));
  await p.evaluate(() => document.getElementById('coachSend').click());
  const got = await until(() => coach.length > 0, 10000);
  const c = got ? (coach[0].context || {}) : {};
  check('Trading Command coach context includes the wheel summary', got && /put/i.test(String(c.openPositions || '')) && /Shares:/.test(String(c.openPositions || '')) && !!c.wheelCapital, c);
  check('trading-command: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
