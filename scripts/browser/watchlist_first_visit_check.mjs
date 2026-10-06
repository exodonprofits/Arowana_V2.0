// Watchlist on a first visit (no lists yet), when the default list comes back
// empty, and with existing lists, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/watchlist_first_visit_check.mjs
import { createRequire } from 'module';
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
const profile = { id: UID, arowana_plan: 'pro', arowana_plan_status: 'active', arowana_stripe_subscription_id: 'sub_synthetic' };
const T = '2026-09-01T00:00:00.000Z';

const browser = await chromium.launch();
async function open(db, { emptyInsert } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fake = await installFakeSupabase(ctx, Object.assign({ profiles: [profile] }, db), { localStorage: { ap_onboarded_v1: '1' } });
  if (emptyInsert) await ctx.route(`https://${REF}.supabase.co/rest/v1/watchlists*`, r => r.request().method() === 'POST' ? r.fulfill({ status: 201, contentType: 'application/json', body: '' }) : r.fallback());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/watchlist.html', { waitUntil: 'load' });
  return { ctx, p, errors, fake, db };
}
const options = p => p.evaluate(() => [...document.querySelectorAll('#listSwitcher option')].map(o => o.textContent.trim()));

{
  const db = { watchlists: [] };
  const { ctx, p, errors } = await open(db);
  check('first visit: default "My Watchlist" created and selected', await until(async () => JSON.stringify(await options(p)) === '["My Watchlist"]'), await options(p));
  check('first visit: one row written, owned by the user', db.watchlists.length === 1 && db.watchlists[0].user_id === UID && !!db.watchlists[0].id, db.watchlists);
  check('first visit: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open({ watchlists: [] }, { emptyInsert: true });
  check('insert returns no row: switcher says "No lists yet"', await until(async () => JSON.stringify(await options(p)) === '["No lists yet"]'), await options(p));
  check('insert returns no row: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const db = { watchlists: [{ id: 'w1', user_id: UID, name: 'Income names', created_at: T }, { id: 'w2', user_id: UID, name: 'Wheel candidates', created_at: T }] };
  const { ctx, p, errors, fake } = await open(db);
  check('existing lists: both shown, none created', await until(async () => (await options(p)).length === 2) && JSON.stringify(await options(p)) === '["Income names","Wheel candidates"]' && !fake.writes.some(w => w.table === 'watchlists'), [await options(p), fake.writes]);
  check('existing lists: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
