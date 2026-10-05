// ATD-009: option-roll-tracker retired to the Trade Journal, keeping saved
// chains downloadable, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/roll_tracker_check.mjs
//
// Signed-in cases use the fake Supabase (scripts/browser/lib/fake_supabase.mjs);
// signed-out cases abort every non-localhost request.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, REF, UID } from './lib/fake_supabase.mjs';
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

const CHAIN = {
  meta: { ticker: 'SYNR', strategy: 'vertical', qty: 1, short: 50, long: 45, expiry: '2026-11-20', entry: 1.25, fees: 1.3, openDate: '2026-09-02' },
  legs: [{ kind: 'roll', date: '2026-10-01', qty: 1, short: 48, long: 43, expiry: '2026-12-18', credit: 0.9, debit: 0.6, fees: 1.3, desc: 'roll down, out' }],
  realizedPL: 0
};
const LOCAL = { meta: { ticker: 'SYNL', strategy: 'single', qty: 2, short: 30, long: null, expiry: '2026-11-20', entry: 0.8, fees: 0, openDate: '2026-09-10' }, legs: [], realizedPL: 0 };

const browser = await chromium.launch();
async function open({ signedIn, db, local, width, failCloud }) {
  const ctx = await browser.newContext({ viewport: { width: width || 1280, height: 900 }, acceptDownloads: true });
  let fake = null;
  const ls = local ? { option_roll_tracker_v1: JSON.stringify(local) } : null;
  if (signedIn) fake = await installFakeSupabase(ctx, db || {}, { localStorage: ls || {} });
  else {
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    if (ls) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, v); } }, ['option_roll_tracker_v1', ls.option_roll_tracker_v1]);
  }
  // Registered last, so it runs before the fake's handler.
  if (failCloud) await ctx.route(`https://${REF}.supabase.co/rest/v1/option_roll_chains*`, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic failure"}' }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/option-roll-tracker.html', { waitUntil: 'load' });
  return { ctx, p, errors, fake };
}
const onJournal = p => until(() => /\/trade-journal-pro\.html\?tab=option$/.test(p.url()), 10000);
const chainRows = p => p.evaluate(() => [...document.querySelectorAll('#chainList .chain')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));

// ── No saved chains: straight to the journal's Options tab ───────────────
{
  const { ctx, p, fake } = await open({ signedIn: true, db: { option_roll_chains: [] } });
  check('signed in, no chains: redirects to trade-journal-pro.html?tab=option', await onJournal(p), p.url());
  check('journal opens on Option Trades, with Find Rolls', await until(() => p.evaluate(() => {
    const t = document.getElementById('tab-option'), b = document.querySelector('.tab-btn[data-tab="option"]');
    return !!t && t.style.display !== 'none' && !!b && b.getAttribute('aria-selected') === 'true' && /Find Rolls/.test(t.textContent);
  }).catch(() => false)));
  check('nothing written', fake.writes.length === 0, fake.writes);
  await ctx.close();
}
{
  const { ctx, p } = await open({ signedIn: false });
  check('signed out, no browser save: redirects to the journal', await onJournal(p), p.url());
  await ctx.close();
}

// ── Saved chains are listed, with downloads, and the page stays ──────────
{
  const db = { option_roll_chains: [
    { id: 'c1', user_id: UID, name: 'SYNR put spread, "rolled"', state: CHAIN, updated_at: '2025-11-21T00:02:44Z' },
    { id: 'c2', user_id: UID, name: 'empty', state: { meta: null, legs: [] }, updated_at: '2025-10-27T00:00:00Z' }
  ] };
  const { ctx, p, errors, fake } = await open({ signedIn: true, db, local: LOCAL });
  const shown = await until(async () => (await chainRows(p)).length > 0);
  const rows = await chainRows(p);
  check('browser save and account chain both listed (empty chain skipped)', shown && rows.length === 2 && /SYNL/.test(rows[0]) && /SYNR put spread/.test(rows[1]) && /saved 2025-11-21/.test(rows[1]), rows);
  await sleep(1500);
  check('page does not redirect when chains exist', /option-roll-tracker\.html$/.test(p.url()), p.url());

  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#chainList .chain').nth(1).locator('button', { hasText: 'Download CSV' }).click()]);
  const csv = readFileSync(await dl.path(), 'utf8').split('\n');
  check('CSV: old tracker columns', csv[0] === 'type,date,ticker,strategy,qty,short,long,expiry,credit,debit,fees,desc', csv[0]);
  check('CSV: original open row', csv[1] === 'open,2026-09-02,SYNR,vertical,1,50,45,2026-11-20,1.25,,1.3,original open', csv[1]);
  check('CSV: roll row', csv[2] === 'roll,2026-10-01,SYNR,vertical,1,48,43,2026-12-18,0.9,0.6,1.3,"roll down, out"', csv[2]);
  check('CSV: file named after the chain', /^roll-chain-synr-put-spread-rolled\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());

  const [dj] = await Promise.all([p.waitForEvent('download'), p.locator('#chainList .chain').nth(1).locator('button', { hasText: 'Download JSON' }).click()]);
  const j = JSON.parse(readFileSync(await dj.path(), 'utf8'));
  check('JSON: full saved state round-trips', j.id === 'c1' && JSON.stringify(j.state) === JSON.stringify(CHAIN), j);
  check('chain name rendered as text, not HTML', await p.evaluate(() => document.querySelector('#chainList .chain:nth-child(2) .name').textContent === 'SYNR put spread, "rolled"'));
  check('nothing written or deleted', fake.writes.length === 0, fake.writes);
  check('browser save kept', await p.evaluate(() => !!localStorage.getItem('option_roll_tracker_v1')));
  check('links to the journal and Roll Coach', await p.evaluate(() => !!document.querySelector('a[href="trade-journal-pro.html?tab=option"]') && !!document.querySelector('a[href="options-hub.html?tab=roll"]')));
  check('chains page: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open({ signedIn: false, local: LOCAL });
  const shown = await until(async () => (await chainRows(p)).length === 1);
  check('signed out, browser save: listed, no redirect', shown && /option-roll-tracker\.html$/.test(p.url()), [await chainRows(p), p.url()]);
  await ctx.close();
}

// ── Account lookup fails: stay, say so ───────────────────────────────────
{
  const { ctx, p } = await open({ signedIn: true, db: {}, failCloud: true });
  const said = await until(() => p.evaluate(() => /Could not check your account/.test(document.getElementById('status').textContent)));
  await sleep(800);
  check('lookup failure: no redirect, message shown', said && /option-roll-tracker\.html$/.test(p.url()), p.url());
  await ctx.close();
}

// ── Phone width ──────────────────────────────────────────────────────────
{
  const db = { option_roll_chains: [{ id: 'c1', user_id: UID, name: 'A very long chain name that should wrap rather than push the page sideways on a phone', state: CHAIN, updated_at: '2025-11-21T00:02:44Z' }] };
  const { ctx, p } = await open({ signedIn: true, db, width: 375 });
  await until(async () => (await chainRows(p)).length === 1);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('375px: no horizontal page scroll', w <= 376, w);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
