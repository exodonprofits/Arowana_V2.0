// ATD-109: onboarding re-run, settings kept, CSV import link, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/onboarding_check.mjs
//
// Runs against the fake Supabase (scripts/browser/lib/fake_supabase.mjs).
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
async function open(db) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fake = await installFakeSupabase(ctx, db);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/onboarding.html', { waitUntil: 'load' });
  return { ctx, p, errors, fake };
}
const panel = p => p.evaluate(() => { const on = document.querySelector('.panel.on'); return on ? Number(on.getAttribute('data-panel')) : 0; });

// ── Returning user re-runs setup ─────────────────────────────────────────
{
  const db = {
    ap_risk_settings: [{ user_id: UID, wheel_capital: 80000, max_ticker_pct: 15, max_total_pct: 50, max_puts_per_ticker: 4, warn_earnings: false, rules: { minAnnualYield: 15, requireWantToOwn: true } }],
    watchlists: [{ id: 'w1', user_id: UID, name: 'Default' }],
    watchlist_items: [{ id: 'i1', user_id: UID, watchlist_id: 'w1', symbol: 'SYNA', want_to_own: true }, { id: 'i2', user_id: UID, watchlist_id: 'w1', symbol: 'SYNB', want_to_own: false }]
  };
  const { ctx, p, errors, fake } = await open(db);
  check('saved Want-to-Own list shown', await until(() => p.evaluate(() => { const h = document.getElementById('alreadyHint'); return !h.hidden && /Already on your Want-to-Own list: SYNA\./.test(h.textContent); })), await p.evaluate(() => document.getElementById('alreadyHint').textContent));
  check('Continue enabled with nothing new picked', await p.evaluate(() => !document.getElementById('next1').disabled));
  check('limits prefilled from saved settings', await until(() => p.evaluate(() => document.getElementById('capital').value === '80000' && document.getElementById('maxTicker').value === '15' && document.getElementById('maxTotal').value === '50')),
    await p.evaluate(() => [document.getElementById('capital').value, document.getElementById('maxTicker').value, document.getElementById('maxTotal').value]));
  await p.click('#next1');
  check('continues to step 2 without saving the list again', await until(async () => (await panel(p)) === 2) && !fake.writes.some(w => /watchlist/.test(w.table)), fake.writes);
  await p.fill('#capital', '90000');
  await p.click('#next2');
  check('step 3 reached', await until(async () => (await panel(p)) === 3));
  const row = db.ap_risk_settings[0];
  check('new limits saved', row.wheel_capital === 90000 && row.max_ticker_pct === 15 && row.max_total_pct === 50, row);
  check('settings the page does not ask about are kept', row.max_puts_per_ticker === 4 && row.warn_earnings === false && row.rules && row.rules.minAnnualYield === 15 && row.rules.requireWantToOwn === true, row);
  check('CSV link uses the journal\'s import deep link', await p.evaluate(() => document.querySelector('a.btn[href^="trade-journal-pro.html"]').getAttribute('href') === 'trade-journal-pro.html?action=import'));
  check('returning user: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── New user ─────────────────────────────────────────────────────────────
{
  const db = { ap_risk_settings: [], watchlists: [], watchlist_items: [] };
  const { ctx, p, errors } = await open(db);
  await sleep(1500);
  check('new user: hint hidden, Continue disabled until a pick', await p.evaluate(() => document.getElementById('alreadyHint').hidden && document.getElementById('next1').disabled));
  await p.click('#suggestChips .chip');
  check('pick enables Continue', await until(() => p.evaluate(() => !document.getElementById('next1').disabled)));
  await p.click('#next1');
  check('list saved as Want to Own', await until(() => db.watchlist_items.length === 1 && db.watchlist_items[0].want_to_own === true), db.watchlist_items);
  await until(async () => (await panel(p)) === 2);
  await p.fill('#capital', '25000');
  await p.click('#next2');
  check('limits saved with default puts/earnings', await until(() => db.ap_risk_settings.length === 1 && db.ap_risk_settings[0].wheel_capital === 25000 && db.ap_risk_settings[0].max_puts_per_ticker === 2 && db.ap_risk_settings[0].warn_earnings === true), db.ap_risk_settings);
  check('new user: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
