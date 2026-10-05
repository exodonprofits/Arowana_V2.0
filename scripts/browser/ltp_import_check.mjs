// ATD-009 phase 4: long-term-portfolio retired; its saved holdings import
// into the Trade Journal on the user's click, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/ltp_import_check.mjs
//
// Signed-in cases use the fake Supabase (scripts/browser/lib/fake_supabase.mjs);
// the signed-out case aborts every non-localhost request.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, REF, UID } from './lib/fake_supabase.mjs';
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
const stk = p => ({ id: p.id, user_id: UID, status: p.status, symbol: p.ticker, updated_at: T, payload: Object.assign({ side: 'long', fees: 0, broker: 'Schwab', updatedAt: T }, p) });
const PORTFOLIO = () => [
  { id: 'p1', user_id: UID, symbol: 'SYNA', shares_owned: 50, avg_cost_basis: 20, purchase_date: '2025-03-01', account_type: 'Roth IRA', sector: 'Tech', risk_level: null, notes: null, created_at: T, account: 'acc_default' },
  { id: 'p2', user_id: UID, symbol: 'synb', shares_owned: 10, avg_cost_basis: 101.5, purchase_date: '2025-04-02', account_type: 'Brokerage', sector: null, risk_level: 'med', notes: 'core, "long"', created_at: T, account: 'acc_default' },
  { id: 'p3', user_id: UID, symbol: 'SYNB', shares_owned: 5, avg_cost_basis: 90, purchase_date: null, account_type: null, sector: null, risk_level: null, notes: null, created_at: '2025-06-07T12:00:00Z', account: 'acc_default' },
  { id: 'p4', user_id: UID, symbol: 'SYNC', shares_owned: 0, avg_cost_basis: 5, purchase_date: null, account_type: null, sector: null, risk_level: null, notes: null, created_at: T, account: 'acc_default' }
];
const JOURNAL = () => [stk({ id: 's1', ticker: 'SYNA', qty: 50, entryPrice: 20, entryDate: '2025-03-01', status: 'open' })];

const browser = await chromium.launch();
async function open(path, { signedIn = true, db, width, failJournal, ctx: reuse } = {}) {
  const ctx = reuse || await browser.newContext({ viewport: { width: width || 1280, height: 900 }, acceptDownloads: true });
  let fake = null;
  if (!reuse) {
    if (signedIn) fake = await installFakeSupabase(ctx, db, { localStorage: { ap_onboarded_v1: '1' } });
    else await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    if (failJournal) await ctx.route(`https://${REF}.supabase.co/rest/v1/tj_stocks*`, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic failure"}' }));
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  return { ctx, p, errors, fake };
}
const table = p => p.evaluate(() => [...document.querySelectorAll('#rows tr')].map(tr => {
  const b = tr.querySelector('input');
  return { sym: tr.children[1].textContent, checked: b.checked, disabled: b.disabled, status: tr.lastElementChild.textContent };
}));
const status = p => p.evaluate(() => document.getElementById('status').textContent);

// ── Nothing saved, or signed out ─────────────────────────────────────────
{
  const { ctx, p } = await open('long-term-portfolio.html', { db: { portfolio: [], tj_stocks: [], tj_options: [] } });
  check('no saved holdings: redirects to Portfolio Command', await until(() => /\/portfolio-command\.html$/.test(p.url())), p.url());
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('long-term-portfolio.html', { signedIn: false });
  check('signed out: asks to sign in, no redirect', await until(async () => /Sign in to see and import/.test(await status(p))) && /long-term-portfolio\.html$/.test(p.url()), await status(p));
  check('signed out: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Saved holdings: list, defaults, import ───────────────────────────────
{
  const db = { portfolio: PORTFOLIO(), tj_stocks: JOURNAL(), tj_options: [] };
  const { ctx, p, errors, fake } = await open('long-term-portfolio.html', { db });
  await until(async () => (await table(p)).length === 4 && !(await p.evaluate(() => document.getElementById('importBtn').disabled)));
  let rows = await table(p);
  const by = s => rows.filter(r => r.sym === s);
  check('lists the four saved holdings', rows.length === 4, rows);
  check('already open in the journal: unticked', by('SYNA')[0] && !by('SYNA')[0].checked && /Already open/.test(by('SYNA')[0].status), by('SYNA'));
  check('not in the journal: ticked (both SYNB lots, lower-case symbol normalised)', by('SYNB').length === 2 && by('SYNB').every(r => r.checked && /Not in your journal/.test(r.status)), by('SYNB'));
  check('no shares: skipped and disabled', by('SYNC')[0] && by('SYNC')[0].disabled && !by('SYNC')[0].checked, by('SYNC'));
  check('button counts the ticked rows', await p.textContent('#importBtn') === 'Import 2 into journal', await p.textContent('#importBtn'));

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csvBtn')]);
  const csv = readFileSync(await dl.path(), 'utf8').split('\n');
  check('CSV: header and quoted notes', csv[0] === 'symbol,shares_owned,avg_cost_basis,purchase_date,account_type,sector,risk_level,notes' && csv.includes('synb,10,101.5,2025-04-02,Brokerage,,med,"core, ""long"""'), csv);

  await p.click('#importBtn');
  const added = () => db.tj_stocks.filter(r => r.payload && r.payload.ticker === 'SYNB');
  check('import: two open SYNB lots written to the journal', await until(() => added().length === 2 && added().every(r => r.status === 'open')), db.tj_stocks.map(r => r.payload && r.payload.ticker));
  const a = added().find(r => r.payload.qty === 10) || {}, b = added().find(r => r.payload.qty === 5) || {};
  check('lot fields: qty, cost, date, account, note', a.payload && a.payload.entryPrice === 101.5 && a.payload.entryDate === '2025-04-02' && a.payload.broker === 'Brokerage' && a.payload.side === 'long' && a.payload.notes === '[Imported from Long-Term Portfolio] core, "long"', a.payload);
  check('lot with no purchase date uses the saved date', b.payload && b.payload.entryDate === '2025-06-07' && b.payload.entryPrice === 90 && b.payload.broker === '', b.payload);
  check('SYNA not duplicated', db.tj_stocks.filter(r => r.payload && r.payload.ticker === 'SYNA').length === 1);
  check('portfolio rows untouched (no writes to portfolio)', fake.writes.every(w => w.table !== 'portfolio') && db.portfolio.length === 4, fake.writes);
  await until(async () => /Imported 2 holdings/.test(await p.textContent('#msg')));
  rows = await table(p);
  check('rows marked Imported, button off', rows.filter(r => r.status === 'Imported').length === 2 && await p.evaluate(() => document.getElementById('importBtn').disabled), [rows, await p.textContent('#msg')]);
  check('browser journal cache has the new lots', await p.evaluate(() => JSON.parse(localStorage.getItem('tj_stocks_v2') || '[]').filter(t => t.ticker === 'SYNB').length === 2));
  check('import page: no page errors', errors.length === 0, errors);

  // Back again: nothing pre-ticked, so a second click cannot double-import.
  const again = await open('long-term-portfolio.html', { ctx });
  await until(async () => (await table(again.p)).length === 4);
  await sleep(1500);
  const r2 = await table(again.p);
  check('revisit: imported symbols now "Already open", nothing ticked', r2.every(r => !r.checked) && r2.filter(r => /Already open/.test(r.status)).length === 3 && await again.p.evaluate(() => document.getElementById('importBtn').disabled), r2);

  // Portfolio Command shows the imported holding.
  const pc = await open('portfolio-command.html', { ctx });
  await until(() => pc.p.evaluate(() => window.journalSync && window.journalSync.getStatus() === 'synced'), 15000);
  await pc.p.evaluate(() => switchTab('holdings'));
  check('Portfolio Command lists the imported SYNB lots as holdings', await until(() => pc.p.evaluate(() =>
    !!document.querySelector('.hold-row-edit[data-holding-id="tjstocks::SYNB::Brokerage"]') && !!document.querySelector('.hold-row-edit[data-holding-id^="tjstocks::SYNB::"]:not([data-holding-id$="Brokerage"])')), 15000),
    await pc.p.evaluate(() => [...document.querySelectorAll('.hold-row-edit')].map(b => b.getAttribute('data-holding-id'))));
  await ctx.close();
}

// ── Journal unreadable: no import ────────────────────────────────────────
{
  const { ctx, p } = await open('long-term-portfolio.html', { db: { portfolio: PORTFOLIO(), tj_stocks: JOURNAL(), tj_options: [] }, failJournal: true });
  await until(async () => (await table(p)).length === 4, 20000);
  const rows = await table(p);
  check('journal read fails: rows shown, every box off, button off', rows.length === 4 && rows.every(r => r.disabled) && await p.evaluate(() => document.getElementById('importBtn').disabled), rows);
  check('journal read fails: says so', /Import is off until it loads/.test(await p.textContent('#msg')), await p.textContent('#msg'));
  await ctx.close();
}

// ── Phone width ──────────────────────────────────────────────────────────
{
  const { ctx, p } = await open('long-term-portfolio.html', { db: { portfolio: PORTFOLIO(), tj_stocks: JOURNAL(), tj_options: [] }, width: 375 });
  await until(async () => (await table(p)).length === 4);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('375px: no horizontal page scroll (table scrolls in its box)', w <= 376, w);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
