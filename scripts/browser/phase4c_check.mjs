// ATD-009 phase 4c: the four browser-only journals/watchlists, on synthetic
// data. trade-journal and options-journal list their saved trades and import
// the ticked ones into the Trade Journal; my-watchlist and
// iv-watchlist-module redirect to Watchlist, which imports their saves.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/phase4c_check.mjs
//
// Signed-in cases use the fake Supabase (scripts/browser/lib/fake_supabase.mjs);
// signed-out cases abort every non-localhost request.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
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
const T = '2026-09-01T00:00:00.000Z';
const stk = p => ({ id: p.id, user_id: UID, status: p.status, symbol: p.ticker, updated_at: T, payload: Object.assign({ side: 'long', fees: 0, updatedAt: T }, p) });
const opt = p => ({ id: p.id, user_id: UID, status: p.status, updated_at: T, payload: Object.assign({ feeIn: 0, feeOut: 0, updatedAt: T }, p) });

const browser = await chromium.launch();
async function open(path, { signedIn = true, db, local, ctx: reuse, width } = {}) {
  const ctx = reuse || await browser.newContext({ viewport: { width: width || 1280, height: 900 }, acceptDownloads: true });
  let fake = null;
  if (!reuse) {
    const ls = Object.assign({ ap_onboarded_v1: '1' }, local || {});
    if (signedIn) fake = await installFakeSupabase(ctx, db || {}, { localStorage: ls });
    else {
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
      await ctx.addInitScript(l => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); Object.entries(l).forEach(([k, v]) => localStorage.setItem(k, v)); } }, ls);
    }
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  return { ctx, p, errors, fake };
}
const table = p => p.evaluate(() => [...document.querySelectorAll('#rows tr')].map(tr => {
  const b = tr.querySelector('input');
  return { text: tr.textContent, checked: b.checked, disabled: b.disabled, status: tr.lastElementChild.textContent };
}));
const ready = p => until(async () => (await table(p)).length > 0 && await p.evaluate(() => /journal|Imported|download|Sign in/i.test(document.getElementById('msg').textContent) || !document.getElementById('importBtn').disabled), 20000);
const path = p => { const u = new URL(p.url()); return u.pathname.replace(/^\//, '') + u.search; };

// ═══ trade-journal ═══════════════════════════════════════════════════════
const TJ_ROWS = [
  { id: 'a', date: '2026-08-03', ticker: 'syna', direction: 'Long', asset: 'Stock', setup: 'ORB', tags: 'gap,news', size: 100, fees: 2, entry: 10, stop: 9.5, target: 12, exit: 11, openTime: '09:31', closeTime: '10:05', screenshot: '', notes: 'clean break' },
  { id: 'b', date: '2026-08-04', ticker: 'SYNB', direction: 'Short', asset: 'Stock', setup: '', tags: '', size: 50, fees: 0, entry: 20, stop: 0, target: 0, exit: 0, openTime: '', closeTime: '', screenshot: '', notes: '' },
  { id: 'c', date: '2026-08-05', ticker: 'SYNO', direction: 'Long', asset: 'Option', size: 1, fees: 0, entry: 2, exit: 3 },
  { id: 'd', date: '2026-08-06', ticker: 'SYND', direction: 'Long', asset: 'Stock', size: 10, fees: 0, entry: 0, exit: 0 },
  { id: 'e', date: '2026-08-07', ticker: 'SYNE', direction: 'Long', asset: 'Stock', size: 10, fees: 0, entry: 30, exit: 0 }
];
{
  const { ctx, p } = await open('trade-journal.html', { db: { tj_stocks: [], tj_options: [] } });
  check('trade-journal, nothing saved: redirects to Trade Journal Pro', await until(() => path(p) === 'trade-journal-pro.html'), path(p));
  await ctx.close();
}
{
  const db = { tj_stocks: [stk({ id: 's1', ticker: 'SYNE', qty: 10, entryPrice: 30, entryDate: '2026-08-07', status: 'open' })], tj_options: [] };
  const { ctx, p, errors, fake } = await open('trade-journal.html', { db, local: { ap_trade_journal_v1: JSON.stringify(TJ_ROWS) } });
  await ready(p);
  let rows = await table(p);
  const row = s => rows.find(r => r.text.includes(s)) || {};
  check('trade-journal: five saved trades listed', rows.length === 5, rows);
  check('stock trades not in the journal: ticked', row('SYNA').checked && row('SYNB').checked, rows);
  check('option asset: download only, disabled', row('SYNO').disabled && /Option: download only/.test(row('SYNO').status), row('SYNO'));
  check('missing entry: skipped', row('SYND').disabled && /Missing/.test(row('SYND').status), row('SYND'));
  check('matches a journal trade: unticked', !row('SYNE').checked && /Already in your journal/.test(row('SYNE').status), row('SYNE'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csvBtn')]);
  const csv = readFileSync(await dl.path(), 'utf8').split('\n');
  check('CSV: every saved trade, original fields', csv.length === 6 && csv[0].startsWith('id,date,ticker,direction,asset') && /"gap,news"/.test(csv[1]), csv.slice(0, 2));
  await p.click('#importBtn');
  const got = t => db.tj_stocks.find(r => r.payload && r.payload.ticker === t);
  check('import: SYNA and SYNB written to the journal', await until(() => !!got('SYNA') && !!got('SYNB')), db.tj_stocks.map(r => r.payload && r.payload.ticker));
  const a = (got('SYNA') || {}).payload || {}, b = (got('SYNB') || {}).payload || {};
  check('closed long: exit, P&L, R, status', a.status === 'closed' && a.exitPrice === 11 && a.exitDate === '2026-08-03' && a.pnl === 98 && Math.abs(a.rMultiple - 1.96) < 1e-9 && a.stopLoss === 9.5 && a.target === 12 && a.setup === 'ORB', a);
  check('notes carry tags, times and the import tag', /^\[Imported from the old Trade Journal\] clean break Tags: gap,news Time: 09:31–10:05$/.test(a.notes || ''), a.notes);
  check('open short: side, no P&L', b.side === 'short' && b.status === 'open' && b.pnl === null && b.exitPrice === null, b);
  check('no duplicate of SYNE; old save untouched', db.tj_stocks.filter(r => r.payload && r.payload.ticker === 'SYNE').length === 1 && await p.evaluate(() => JSON.parse(localStorage.getItem('ap_trade_journal_v1')).length === 5));
  check('only journal writes', fake.writes.every(w => w.table === 'tj_stocks'), fake.writes);
  rows = await table(p);
  check('imported rows marked, button off', rows.filter(r => r.status === 'Imported').length === 2 && await p.evaluate(() => document.getElementById('importBtn').disabled));
  const again = await open('trade-journal.html', { ctx });
  await ready(again.p);
  await sleep(1000);
  const r2 = await table(again.p);
  check('revisit: nothing ticked, imported ones "Already in your journal"', r2.every(r => !r.checked) && r2.filter(r => /Already in your journal/.test(r.status)).length === 3, r2.map(r => r.status));
  check('trade-journal: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('trade-journal.html', { signedIn: false, local: { ap_trade_journal_v1: JSON.stringify(TJ_ROWS) } });
  await ready(p);
  const rows = await table(p);
  check('signed out: listed, every box off, asks to sign in', rows.length === 5 && rows.every(r => r.disabled) && /Sign in/.test(await p.textContent('#msg')), [rows.length, await p.textContent('#msg')]);
  check('signed out: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ═══ options-journal ═════════════════════════════════════════════════════
const OJ_ROWS = [
  { id: 'o1', ticker: 'SYNP', date: '2026-08-01', type: 'put', position: 'short', qty: '2', strike: '50', expiry: '2026-09-18', dte_at_open: '48', premium: '1.20', iv: '35', delta: '-0.25', strategy: 'sell_put', status: 'open', close_price: null, close_date: null, notes: 'want to own' },
  { id: 'o2', ticker: 'SYNC', date: '2026-07-01', type: 'call', position: 'long', qty: '1', strike: '100', expiry: '2026-08-15', premium: '3', strategy: 'buy_call', status: 'closed', close_price: '5', close_date: '2026-07-20', notes: '' },
  { id: 'o3', ticker: 'SYNX', date: '2026-06-01', type: 'call', position: 'short', qty: '1', strike: '30', expiry: '2026-06-20', premium: '0.5', strategy: 'spread', status: 'expired', close_price: null, close_date: null, notes: '' },
  { id: 'o4', ticker: 'SYNM', date: '2026-06-02', type: 'put', position: 'short', qty: '1', strike: '', expiry: '2026-06-20', premium: '1', strategy: 'sell_put', status: 'open' },
  { id: 'o5', ticker: 'SYNW', date: '2026-05-01', type: 'put', position: 'short', qty: '1', strike: '40', expiry: '2026-05-16', premium: '0.8', strategy: 'wheel', status: 'assigned', close_price: null }
];
{
  const { ctx, p } = await open('options-journal.html', { db: { tj_stocks: [], tj_options: [] } });
  check('options-journal, nothing saved: redirects to Option Trades', await until(() => path(p) === 'trade-journal-pro.html?tab=option'), path(p));
  await ctx.close();
}
{
  const db = { tj_stocks: [], tj_options: [opt({ id: 'x1', ticker: 'SYNW', optType: 'put', strike: 40, expiry: '2026-05-16', entryDate: '2026-05-01', qty: 1, status: 'assigned' })] };
  const { ctx, p, errors, fake } = await open('options-journal.html', { db, local: { oj_trades_v1: JSON.stringify(OJ_ROWS) } });
  await ready(p);
  const rows = await table(p);
  const row = s => rows.find(r => r.text.includes(s)) || {};
  check('options-journal: five saved trades listed', rows.length === 5, rows);
  check('ticks: three new, missing strike skipped, journal match unticked', row('SYNP').checked && row('SYNC').checked && row('SYNX').checked && row('SYNM').disabled && !row('SYNW').checked && /Already/.test(row('SYNW').status), rows.map(r => [r.text.slice(0, 20), r.checked, r.status]));
  await p.click('#importBtn');
  const got = t => (db.tj_options.find(r => r.payload && r.payload.ticker === t) || {}).payload;
  check('import: three option trades written', await until(() => !!got('SYNP') && !!got('SYNC') && !!got('SYNX')), db.tj_options.map(r => r.payload && r.payload.ticker));
  const P = got('SYNP') || {}, C = got('SYNC') || {}, X = got('SYNX') || {};
  check('short put: CSP, credit, fields', P.strategy === 'Cash-Secured Put' && P.isCredit === true && P.optType === 'put' && P.strike === 50 && P.qty === 2 && P.premiumIn === 1.2 && P.expiry === '2026-09-18' && P.entryDate === '2026-08-01' && P.status === 'open' && P.pnl === null, P);
  check('short put notes keep IV, delta, DTE', /want to own IV 35 Delta -0.25 DTE at open 48$/.test(P.notes || ''), P.notes);
  check('closed long call: debit, exit, P&L $200', C.strategy === 'Long Call' && C.isCredit === false && C.premiumOut === 5 && C.exitDate === '2026-07-20' && C.status === 'closed' && C.pnl === 200, C);
  check('expired short spread: Credit Spread, P&L $50', X.strategy === 'Credit Spread' && X.status === 'expired' && X.pnl === 50, X);
  check('only journal writes; SYNW not duplicated', fake.writes.every(w => w.table === 'tj_options') && db.tj_options.filter(r => r.payload && r.payload.ticker === 'SYNW').length === 1, fake.writes);
  check('options-journal: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open('options-journal.html', { db: { tj_stocks: [], tj_options: [] }, local: { oj_trades_v1: JSON.stringify(OJ_ROWS) }, width: 375 });
  await ready(p);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('375px: no horizontal page scroll', w <= 376, w);
  await ctx.close();
}

// ═══ my-watchlist / iv-watchlist-module → Watchlist ══════════════════════
const symbols = p => p.evaluate(() => (Array.isArray(window.watchlist) ? window.watchlist : []).map(r => r.symbol));
{
  const local = {
    stw_watchlist_v1: JSON.stringify([{ id: 'r1', symbol: 'SYNA', status: 'Watching', dateAdded: T }]),
    arowana_watchlist_v1: JSON.stringify([{ symbol: 'SYNM', note: 'earnings play', price: null, change: 0 }, { symbol: 'SYNA', note: 'dup' }]),
    ap_iv_watchlist_tickers: JSON.stringify(['SYNI', 'synm'])
  };
  const { ctx, p, errors } = await open('my-watchlist.html', { signedIn: false, local });
  check('my-watchlist redirects to Watchlist', await until(() => path(p) === 'watchlist.html'), path(p));
  await until(async () => (await symbols(p)).includes('SYNI'));
  const s = await symbols(p);
  check('both old lists imported, no duplicates', s.filter(x => x === 'SYNA').length === 1 && s.filter(x => x === 'SYNM').length === 1 && s.includes('SYNI') && s.length === 3, s);
  const m = await p.evaluate(() => (window.watchlist || []).find(r => r.symbol === 'SYNM'));
  check('imported row: trade idea, note kept, source tagged', m && m.horizon === 'trade_idea' && m.notes === 'earnings play' && m.screenerSource === 'My Watchlist (old)', m);
  check('flags set, old saves kept', await p.evaluate(() => !!localStorage.getItem('arowana_watchlist_v1_migrated_v1') && !!localStorage.getItem('ap_iv_watchlist_tickers_migrated_v1') && !!localStorage.getItem('arowana_watchlist_v1') && !!localStorage.getItem('ap_iv_watchlist_tickers')));
  // Runs once: a symbol the user deletes is not brought back.
  await p.evaluate(() => { const k = 'stw_watchlist_v1'; localStorage.setItem(k, JSON.stringify(JSON.parse(localStorage.getItem(k) || '[]').filter(r => r.symbol !== 'SYNI'))); });
  const again = await open('iv-watchlist-module.html', { ctx });
  check('iv-watchlist-module redirects to Watchlist', await until(() => path(again.p) === 'watchlist.html'), path(again.p));
  await sleep(1500);
  check('second visit: deleted symbol not re-imported', !(await symbols(again.p)).includes('SYNI'), await symbols(again.p));
  check('watchlist: no page errors', errors.length === 0 && again.errors.length === 0, errors.concat(again.errors));
  await ctx.close();
}
{
  // Signed in: the imported symbols join the server list.
  const db = { watchlists: [{ id: 'w1', user_id: UID, name: 'Default', created_at: '2026-09-18T00:00:00Z' }], watchlist_items: [] };
  const { ctx, p } = await open('iv-watchlist-module.html', { db, local: { ap_iv_watchlist_tickers: JSON.stringify(['SYNI']) } });
  check('signed in: imported symbol saved to the server list', await until(() => db.watchlist_items.some(r => r.symbol === 'SYNI' && r.watchlist_id === 'w1'), 15000), db.watchlist_items);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
