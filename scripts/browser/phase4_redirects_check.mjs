// ATD-009 phase 4a: four duplicate pages redirect to their canonical page,
// and the watchlist data they saved shows up there, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/phase4_redirects_check.mjs
//
// Signed-in cases use the fake Supabase (scripts/browser/lib/fake_supabase.mjs);
// signed-out cases abort every non-localhost request.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}

const browser = await chromium.launch();
async function open(path, { signedIn, db, local } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (signedIn) await installFakeSupabase(ctx, db || {}, { localStorage: Object.assign({ ap_onboarded_v1: '1' }, local || {}) });
  else {
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    if (local) await ctx.addInitScript(l => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); Object.entries(l).forEach(([k, v]) => localStorage.setItem(k, v)); } }, local);
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' }).catch(() => {});
  return { ctx, p, errors };
}
const path = p => { const u = new URL(p.url()); return u.pathname.replace(/^\//, '') + u.search + u.hash; };
const symbols = p => p.evaluate(() => (Array.isArray(window.watchlist) ? window.watchlist : []).map(r => r.symbol + ':' + (r.horizon || '')));

// ── Each old URL lands on its target, query and hash kept ────────────────
for (const [from, to] of [
  ['master-journal.html', 'trade-journal-pro.html'],
  ['portfolio-tracker.html', 'portfolio-command.html'],
  ['short-term-watchlist.html', 'watchlist.html'],
  ['long-term-watchlist.html', 'watchlist.html']
]) {
  const { ctx, p } = await open(from + '?x=1#h', { signedIn: true });
  const ok = await until(() => path(p) === to + '?x=1#h');
  check(`${from} → ${to} (query and hash kept)`, ok, path(p));
  await ctx.close();
}

// ── Signed out: the old pages' browser saves appear in Watchlist ─────────
{
  const row = { id: 'r1', symbol: 'SYNA', status: 'Watching', signal: 'Buy', entryPrice: 12.5, dateAdded: '2026-09-01T00:00:00Z', notes: 'from stw' };
  const { ctx, p, errors } = await open('short-term-watchlist.html', { local: { stw_watchlist_v1: JSON.stringify([row]) } });
  await until(() => path(p).startsWith('watchlist.html'));
  check('short-term watchlist browser save shows in Watchlist', await until(async () => (await symbols(p)).some(s => s.startsWith('SYNA:'))), await symbols(p));
  check('watchlist (signed out): no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const old = [{ id: 'o1', symbol: 'SYNL', currentPrice: 40, entryPrice: 35, targetAllocation: 5, valuation: 'Undervalued', category: 'Core', dateAdded: '2026-08-01T00:00:00Z', notes: 'long hold' }];
  const { ctx, p } = await open('long-term-watchlist.html', { local: { arowanaLongTermWatchlist: JSON.stringify(old) } });
  await until(() => path(p).startsWith('watchlist.html'));
  check('long-term watchlist browser save imported as a long-term hold', await until(async () => (await symbols(p)).includes('SYNL:long_term_hold')), await symbols(p));
  const kept = await p.evaluate(() => { const r = (window.watchlist || []).find(x => x.symbol === 'SYNL'); return r && r.valuationStatus === 'Undervalued' && r.targetAllocation === 5; });
  check('long-term fields carried (valuation, target allocation)', kept);
  check('old browser save left in place', await p.evaluate(() => !!localStorage.getItem('arowanaLongTermWatchlist')));
  await ctx.close();
}

// ── Signed in: the list short-term-watchlist created is Watchlist's list ─
{
  const db = {
    watchlists: [{ id: 'w1', user_id: UID, name: 'Default', created_at: '2026-09-18T00:00:00Z' }],
    watchlist_items: [{ id: 'i1', user_id: UID, watchlist_id: 'w1', symbol: 'SYNS', status: 'Watching', horizon: 'trade_idea', date_added: '2026-09-18T00:00:00Z' }]
  };
  const { ctx, p, errors } = await open('short-term-watchlist.html', { signedIn: true, db });
  await until(() => path(p).startsWith('watchlist.html'));
  check('signed in: the server "Default" list and its items show in Watchlist', await until(async () => (await symbols(p)).some(s => s.startsWith('SYNS:')), 12000), await symbols(p));
  check('watchlist (signed in): no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Targets load cleanly ─────────────────────────────────────────────────
for (const from of ['master-journal.html', 'portfolio-tracker.html']) {
  const { ctx, p, errors } = await open(from, { signedIn: true, db: { tj_stocks: [], tj_options: [] } });
  await sleep(2500);
  check(`${from}: target loads with no page errors`, errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
