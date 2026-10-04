// ATD-108 S2: journal reliability, on synthetic data only.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/journal_sync_check.mjs
//
// 1. Two "devices" (separate browser contexts, so separate localStorage) run
//    js/journal-sync.js against one in-memory server kept in Node:
//      - a delete on device A disappears on device B;
//      - a server that suddenly returns no rows (what a broken session looks
//        like under row-level security) does not wipe B's journal.
// 2. trade-journal-pro.html:
//      - an expired / assigned option settles with premium kept and P&L set;
//      - ?q=SYMBOL fills the stock search;
//      - ?asset=option&... opens a pre-filled option form without saving;
//      - "Delete All" deletes in chunks of 200, scoped to the session user.
// All non-localhost requests are aborted; no real Supabase is contacted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const USER = 'synthetic-user-1';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}

// ── In-memory server ────────────────────────────────────────────────────
const server = { tj_stocks: new Map(), tj_options: new Map(), hideAll: false };
function serve(q) {
  const t = server[q.table];
  const match = r => q.filters.every(f =>
    f.op === 'eq' ? r[f.col] === f.val : f.op === 'in' ? f.val.includes(r[f.col]) : true);
  if (q.op === 'upsert') {
    q.rows.forEach(r => t.set(r.id, { ...r }));
    return { data: q.rows.map(r => ({ id: r.id })), error: null };
  }
  if (q.op === 'delete') {
    const ids = [...t.values()].filter(match).map(r => r.id);
    ids.forEach(id => t.delete(id));
    return { data: null, error: null };
  }
  // select
  let rows = server.hideAll ? [] : [...t.values()].filter(match);
  if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
  if (q.cols && q.cols !== '*') {
    const cols = q.cols.split(',');
    rows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
  }
  return { data: rows, error: null };
}

// Mock supabase-js client, installed before js/journal-sync.js loads.
// Every query is sent to Node through window.__srv.
const MOCK_CLIENT = `
  (function(){
    function builder(table){
      var q = { table: table, op: 'select', filters: [], cols: '*' };
      var b = {
        select: function(c){ if (q.op === 'select') q.cols = c || '*'; return b; },
        upsert: function(rows){ q.op = 'upsert'; q.rows = rows; return b; },
        delete: function(){ q.op = 'delete'; return b; },
        eq: function(c, v){ q.filters.push({ op: 'eq', col: c, val: v }); return b; },
        in: function(c, v){ q.filters.push({ op: 'in', col: c, val: v }); return b; },
        range: function(a, z){ q.range = [a, z]; return b; },
        then: function(ok, bad){ return window.__srv(q).then(ok, bad); }
      };
      return b;
    }
    window.sbClient = {
      from: builder,
      auth: {
        getSession: function(){ return Promise.resolve({ data: { session: { access_token: 't', user: { id: '${USER}', email: 'synthetic@example.invalid' } } } }); },
        onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; }
      }
    };
  })();`;
const HARNESS = `<!doctype html><meta charset="utf-8"><title>sync harness</title>
<script>${MOCK_CLIENT}</script><script src="/js/journal-sync.js"></script>`;

const browser = await chromium.launch();

async function device(seed) {
  const ctx = await browser.newContext();
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort();
    if (u.pathname === '/__s2_harness.html') return r.fulfill({ status: 200, contentType: 'text/html', body: HARNESS });
    return r.continue();
  });
  await ctx.exposeFunction('__srv', q => serve(q));
  if (seed) await ctx.addInitScript(s => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v));
  }, seed);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  pageerror:', e.message));
  await p.goto(BASE + '/__s2_harness.html');
  return { ctx, p };
}
const localIds = p => p.evaluate(() => JSON.parse(localStorage.getItem('tj_stocks_v2') || '[]').map(r => r.id).sort());
const statusOf = p => p.evaluate(() => window.journalSync && window.journalSync.getStatus && window.journalSync.getStatus());

// ── 1. Two devices ──────────────────────────────────────────────────────
const t0 = '2026-09-01T00:00:00.000Z';
const trades = Array.from({ length: 10 }, (_, i) => ({ id: 'st-' + i, ticker: 'SYN' + i, status: 'closed', pnl: i, updatedAt: t0 }));
const A = await device({ tj_stocks_v2: JSON.stringify(trades), tj_options_v2: '[]', ap_journal_owner_v1: USER });
check('A: uploads its 10 trades', await until(() => server.tj_stocks.size === 10), server.tj_stocks.size);

const B = await device(null);
check('B: clean browser downloads all 10', await until(async () => (await localIds(B.p)).length === 10), await localIds(B.p));

await A.p.evaluate(() => {
  const rows = JSON.parse(localStorage.getItem('tj_stocks_v2')).filter(r => r.id !== 'st-3');
  localStorage.setItem('tj_stocks_v2', JSON.stringify(rows));
  window.journalSync.deleteStock('st-3');
});
check('A: delete reaches the server', await until(() => !server.tj_stocks.has('st-3')), [...server.tj_stocks.keys()]);
await A.p.reload();
await until(async () => (await statusOf(A.p)) === 'synced');
check('A: deleted trade stays deleted after reload', !(await localIds(A.p)).includes('st-3'), await localIds(A.p));

await B.p.reload();
check('B: delete made on A propagates', await until(async () => {
  const ids = await localIds(B.p); return ids.length === 9 && !ids.includes('st-3');
}), await localIds(B.p));

server.hideAll = true;   // every select returns [] with no error
await B.p.reload();
await until(async () => (await statusOf(B.p)) === 'synced');
await sleep(500);
check('B: empty server response does not wipe the journal', (await localIds(B.p)).length === 9, await localIds(B.p));
server.hideAll = false;
check('server still has 9 rows (nothing re-deleted)', server.tj_stocks.size === 9, server.tj_stocks.size);
await A.ctx.close(); await B.ctx.close();

// ── 2. trade-journal-pro.html ───────────────────────────────────────────
async function tjp(query, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort();
    if (/\/login\.html$/.test(u.pathname) && r.request().isNavigationRequest()) return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
  await ctx.addInitScript(s => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: 'synthetic-test', email: 'synthetic@example.invalid' }));
    Object.entries(s || {}).forEach(([k, v]) => localStorage.setItem(k, v));
  }, seed);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/trade-journal-pro.html' + (query || ''), { waitUntil: 'load' });
  await p.waitForTimeout(800);
  return { ctx, p, errors };
}

const opts = [
  { id: 'o-csp', ticker: 'SYNA', type: 'put', strategy: 'Cash-Secured Put', qty: 2, premiumIn: 1.5, isCredit: true, feeIn: 1.3, status: 'open', expiry: '2026-09-19', entryDate: '2026-08-20' },
  { id: 'o-long', ticker: 'SYNB', type: 'call', strategy: 'Long Call', qty: 1, premiumIn: 2, isCredit: false, status: 'open', expiry: '2099-01-15', entryDate: '2026-08-20' },
  { id: 'o-done', ticker: 'SYNC', type: 'put', strategy: 'Cash-Secured Put', qty: 1, premiumIn: 1, isCredit: true, status: 'open', premiumOut: 0.4, pnl: 60, expiry: '2026-09-19' }
];
{
  const { ctx, p, errors } = await tjp('', { tj_options_v2: JSON.stringify(opts), tj_stocks_v2: '[]' });
  const r = await p.evaluate(() => {
    markOptStatus('o-csp', 'expired'); markOptStatus('o-long', 'expired'); markOptStatus('o-done', 'assigned');
    const all = JSON.parse(localStorage.getItem('tj_options_v2'));
    return Object.fromEntries(all.map(o => [o.id, o]));
  });
  const today = new Date().toISOString().slice(0, 10);
  const csp = r['o-csp'], lc = r['o-long'], done = r['o-done'];
  check('settle: short put expired keeps premium less fees', csp.pnl === 298.7 && csp.premiumOut === 0 && Math.abs(csp.pnlPct - 298.7 / 3) < 1e-9, csp);
  check('settle: past expiry is the exit date', csp.exitDate === '2026-09-19' && csp.status === 'expired', csp);
  check('settle: long call expired loses the debit; exit date today', lc.pnl === -200 && lc.exitDate === today, lc);
  check('settle: existing P&L is not overwritten', done.pnl === 60 && done.premiumOut === 0.4 && done.status === 'assigned', done);
  check('settle: updatedAt stamped', !!(csp.updatedAt && done.updatedAt), [csp.updatedAt, done.updatedAt]);
  const setupHead = await p.evaluate(() => {
    const el = document.getElementById('statsBySetup');
    if (typeof switchTab === 'function') switchTab('stats');
    return { head: el.closest('.card').querySelector('h3').textContent, text: el.textContent };
  });
  check('stats: setup table includes option strategies', /Setup & Strategy/.test(setupHead.head) && /Cash-Secured Put/.test(setupHead.text), setupHead);
  check('settle page: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await tjp('?q=SYNQ');
  check('?q= fills the stock search', await p.$eval('#stockSearch', el => el.value) === 'SYNQ');
  check('?q= page: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await tjp('?asset=option&ticker=synx&type=call&strike=40&expiry=2026-12-18&premium=1.25&contracts=3', { tj_options_v2: '[]', tj_stocks_v2: '[]' });
  await p.waitForTimeout(300);
  const f = await p.evaluate(() => {
    const v = id => (document.getElementById(id) || {}).value;
    return { t: v('oTicker'), s: v('oStrategy'), k: v('oStrike'), e: v('oExpiry'), q: v('oQty'), pr: v('oPremiumIn'), cd: v('oCreditDebit'), st: v('oStatus'),
             saved: JSON.parse(localStorage.getItem('tj_options_v2') || '[]').length };
  });
  check('option prefill fills the form', f.t === 'SYNX' && f.s === 'Covered Call' && f.k === '40' && f.e === '2026-12-18' && f.q === '3' && f.pr === '1.25' && f.cd === 'credit' && f.st === 'open', f);
  check('option prefill saves nothing', f.saved === 0, f);
  check('prefill page: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await tjp('');
  const r = await p.evaluate(async (USER) => {
    const calls = [];
    let failChunk = -1;
    window.apGetAccessToken = async () => 'synthetic-token';
    window.supabaseClient = {
      auth: { getSession: async () => ({ data: { session: { user: { id: USER } } } }) },
      from: table => {
        const c = { table, filters: [] }; calls.push(c);
        const b = {
          delete() { c.op = 'delete'; return b; },
          in(col, v) { c.filters.push(['in', col, v.length]); return b; },
          eq(col, v) { c.filters.push(['eq', col, v]); return b; },
          then(ok) { return Promise.resolve({ error: calls.length - 1 === failChunk ? { message: 'boom' } : null }).then(ok); }
        };
        return b;
      }
    };
    const ids = Array.from({ length: 450 }, (_, i) => 'd-' + i);
    const ok = await tjDirectSupabaseDelete('tj_stocks', ids);
    const sizes = calls.map(c => c.filters.find(f => f[0] === 'in')[2]);
    const scoped = calls.every(c => c.op === 'delete' && c.table === 'tj_stocks' && c.filters.some(f => f[0] === 'eq' && f[1] === 'user_id' && f[2] === USER));
    calls.length = 0; failChunk = 1;
    const bad = await tjDirectSupabaseDelete('tj_stocks', ids);
    window.supabaseClient = null;
    const none = await tjDirectSupabaseDelete('tj_stocks', ids);
    return { ok, sizes, scoped, bad, none };
  }, USER);
  check('delete all: 450 ids go in chunks of 200/200/50', r.ok.ok === true && r.sizes.join() === '200,200,50', r);
  check('delete all: every chunk scoped to the session user', r.scoped, r);
  check('delete all: a failed chunk is reported, not hidden', r.bad.ok === false && /^200 of 450 not removed: boom/.test(r.bad.reason), r.bad);
  check('delete all: no client reports no-auth', r.none.ok === false && r.none.reason === 'no-auth-or-config', r.none);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
