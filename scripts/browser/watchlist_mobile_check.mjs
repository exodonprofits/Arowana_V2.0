// Watchlist on a phone matches Trading Command: white top bar, compact
// header with a sync dot, the list right under a full-width Add button
// (the add form opens from it), one row of counts, a single empty state.
// Desktop keeps its layout.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/watchlist_mobile_check.mjs
//
// Synthetic session (fake Supabase); every non-localhost request aborted.
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
async function until(fn, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; }

const T = '2026-10-01T12:00:00Z';
const item = (id, symbol, horizon, extra = {}) => ({ id, user_id: UID, watchlist_id: 'w1', symbol, horizon, sector: 'Technology', signal: 'Watch',
  status: 'watching', current_price: 100, entry_price: 95, date_added: '2026-09-20', notes: '', inserted_at: T, ...extra });
const DATA = () => ({ watchlists: [{ id: 'w1', user_id: UID, name: 'Wheel candidates', created_at: T }],
  watchlist_items: [item('i1', 'AAPL', 'trade_idea'), item('i2', 'KO', 'long_term_hold'), item('i3', 'AMD', 'trade_idea', { status: 'entered' })] });

const browser = await chromium.launch();
async function open(db, width = 375) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile });
  const fake = await installFakeSupabase(ctx, db, { localStorage: { ap_onboarded_v1: '1' } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/watchlist.html', { waitUntil: 'load' });
  await until(() => p.evaluate(() => /Synced/.test(document.getElementById('syncPill').textContent)));
  return { ctx, p, errors, fake };
}
const box = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), st = getComputedStyle(e);
  return { top: r.top + scrollY, h: r.height, w: r.width, shown: st.display !== 'none' && r.height > 0, bg: st.backgroundColor, fs: st.fontSize }; }, sel);

{
  const { ctx, p, errors } = await open(DATA());
  check('phone: white top bar like Trading Command', (await box(p, '.mobile-topbar')).bg === 'rgb(255, 255, 255)', await box(p, '.mobile-topbar'));
  const pill = await box(p, '#syncPill');
  check('phone: sync status is a small dot with a tooltip', pill.w <= 14 && pill.h <= 14 && /Synced/.test(await p.getAttribute('#syncPill', 'title')), pill);
  const hidden = await p.evaluate(() => ['#btnBack', '#btnAllTools', '.workspace-subtitle', '.toolbar-context', '#btnImport', '#btnExport']
    .filter(s => { const e = document.querySelector(s); return e && e.getBoundingClientRect().height > 0; }));
  check('phone: header keeps only title, mode switch and status', hidden.length === 0, hidden);
  const add = await box(p, '#btnQuickAdd');
  check('phone: full-width Add button, 44px tall', add.w >= 330 && add.h >= 44, add);
  check('phone: add form closed until Add is tapped', !(await box(p, '#addSection')).shown);
  const firstCard = await box(p, '#watchlistMobile .mobile-card, #watchlistMobile > div');
  check('phone: first ticker card starts on the first screen', firstCard && firstCard.top < 700, firstCard);
  const kpis = await p.evaluate(() => [...document.querySelectorAll('#kpiSection .stat')].map(e => Math.round(e.getBoundingClientRect().top)));
  check('phone: the four counts sit in one row', kpis.length === 4 && new Set(kpis).size === 1, kpis);
  check('phone: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  await p.click('#btnQuickAdd');
  check('phone: Add opens the form right under the button and focuses the ticker',
    (await box(p, '#addSection')).shown && await p.evaluate(() => document.activeElement.id === 'addSymbol') &&
    (await box(p, '#addSection')).top > add.top && (await box(p, '#addSection')).top < add.top + 120 &&
    (await p.textContent('#btnQuickAdd')).includes('Done') && (await p.getAttribute('#btnQuickAdd', 'aria-expanded')) === 'true');
  await p.fill('#addSymbol', 'MSFT');
  await p.click('#addForm button[type=submit]');
  check('phone: added ticker shows in the list; form stays open for the next one',
    await until(() => p.evaluate(() => /MSFT/.test(document.getElementById('watchlistMobile').textContent))) && (await box(p, '#addSection')).shown);
  await p.click('#btnQuickAdd');
  check('phone: Done closes the form', !(await box(p, '#addSection')).shown && (await p.textContent('#btnQuickAdd')).includes('Add'));
  check('phone: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open({ watchlists: [{ id: 'w1', user_id: UID, name: 'My Watchlist', created_at: T }], watchlist_items: [] });
  const text = await p.evaluate(() => document.getElementById('listSection').innerText);
  check('phone, empty list: one empty state, not "No matches" as well', /Your watchlist is empty/.test(text) && !/No matches/.test(text), text.slice(0, 200));
  await ctx.close();
}
{
  const { ctx, p } = await open(DATA());
  await p.fill('#wlSearch', 'zzzz');
  await p.dispatchEvent('#wlSearch', 'input');
  await sleep(300);
  check('phone, search with no hits: "No matches" shown', /No matches/.test(await p.evaluate(() => document.getElementById('watchlistMobile').innerText)));
  await ctx.close();
}
{
  const { ctx, p, errors } = await open(DATA(), 1280);
  check('desktop: add form shown inline as before', (await box(p, '#addSection')).shown);
  check('desktop: sync pill keeps its words', (await box(p, '#syncPill')).w > 60);
  check('desktop: Back still in the header', (await box(p, '#btnBack')).shown);
  check('desktop: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
