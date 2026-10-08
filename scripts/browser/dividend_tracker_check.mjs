// ATD-109 Dividend Tracker without developer controls: no n8n webhook field or
// Mock Mode; Refresh fills prices through arowana-research and looks up the
// yearly dividend only for holdings that lack one (each lookup counts against
// the member's daily allowance); income, yields and the forecast compute; the
// page fits a phone.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/dividend_tracker_check.mjs
//
// Synthetic session (fake Supabase); every non-localhost request aborted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase } from './lib/fake_supabase.mjs';
import { fakeResearch } from './lib/fake_research.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; }

const HOLD = (t, shares, cost, divps = null) => ({ ticker: t, shares, cost, price: null, divps, freq: 'Q', exdate: '', paylag: 30, taxrate: null });
const browser = await chromium.launch();
async function open({ width = 1280, holdings, webhook, research } = {}) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile });
  const calls = [];
  const ls = { ap_onboarded_v1: '1' };
  if (holdings) ls.div_tracker = JSON.stringify({ holdings, taxDefault: 0, ...(webhook ? { webhook } : {}) });
  await installFakeSupabase(ctx, {}, { localStorage: ls, functions: { 'arowana-research': research ? research(calls) : fakeResearch(calls) } });
  const p = await ctx.newPage();
  const errors = [], outbound = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('request', r => { const u = r.url(); if (/finnhub\.io|n8n|hooks\.example/.test(u)) outbound.push(u); });
  p.on('dialog', d => d.accept());
  await p.goto(BASE + '/dividend-tracker.html', { waitUntil: 'load' });
  await sleep(1200);
  return { ctx, p, errors, calls, outbound };
}
const visibleText = p => p.evaluate(() => document.body.innerText);

{
  const { ctx, p, errors } = await open();
  const txt = await visibleText(p);
  check('no webhook field, no Mock Mode', !(await p.$('#webhook')) && !(await p.$('#mock')) && !/webhook|mock mode|n8n/i.test(txt));
  check('no page errors', errors.length === 0, errors);
  await p.click('#refreshBtn');
  check('Refresh with no holdings says to add one', /Add a holding first/.test(await p.textContent('#status')), await p.textContent('#status'));
  await p.fill('#ticker', 'KO'); await p.fill('#shares', '100'); await p.fill('#cost', '50');
  await p.click('#addBtn');
  check('Add Holding adds a row', await until(() => p.evaluate(() => document.querySelectorAll('#tbody tr').length === 1)));
  await ctx.close();
}
{
  // A webhook URL saved by the old field is dropped and never called.
  const { ctx, p, calls, outbound } = await open({ holdings: [HOLD('KO', 100, 50), HOLD('JNJ', 10, 140, 4.96)], webhook: 'https://hooks.example.invalid/div' });
  check('old saved webhook removed from storage', await p.evaluate(() => !('webhook' in JSON.parse(localStorage.getItem('div_tracker')))));
  await p.click('#refreshBtn');
  await until(() => p.evaluate(() => /Updated/.test(document.getElementById('status').textContent)));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('div_tracker')).holdings);
  check('Refresh: prices for every holding through arowana-research', st.every(h => h.price > 0) && calls.filter(c => c === '/quote').length === 2, { calls, st });
  check('Refresh: dividend looked up only where missing (one lookup, KO)', calls.filter(c => c === '/stock/metric').length === 1 &&
    st.find(h => h.ticker === 'KO').divps > 0 && st.find(h => h.ticker === 'JNJ').divps === 4.96, { calls, st });
  check('nothing sent to finnhub.io or a webhook directly', outbound.length === 0, outbound);
  const kpi = await p.evaluate(() => ({ inc: kpiIncome.textContent, yoc: kpiYOC.textContent, fwd: kpiFwd.textContent }));
  check('summary computes income and yields', /^\$[1-9]/.test(kpi.inc) && /[1-9]/.test(kpi.yoc) && /[1-9]/.test(kpi.fwd), kpi);
  await p.click('#forecastBtn');
  check('forecast with no ex-dates: one note, not twelve $0.00 months', await until(() => p.evaluate(() =>
    document.querySelectorAll('#calendar .month').length === 0 && /Not on the calendar: KO, JNJ/.test(document.getElementById('calendar').textContent))),
    await p.evaluate(() => document.getElementById('calendar').textContent));
  await p.click('#refreshBtn');
  await until(() => p.evaluate(() => /Updated/.test(document.getElementById('status').textContent)));
  check('second Refresh costs no lookups (dividends already known)', calls.filter(c => c === '/stock/metric').length === 1, calls);
  await ctx.close();
}
{
  // Dated forecast only where an ex-dividend date is known; an old one rolls forward.
  const old = new Date(); old.setFullYear(old.getFullYear() - 2); old.setDate(10);
  const exd = old.toISOString().slice(0, 10);
  const { ctx, p, errors } = await open({ holdings: [HOLD('KO', 100, 50, 2), { ...HOLD('JNJ', 10, 140, 4.8), exdate: exd, paylag: 30 }] });
  await p.click('#forecastBtn'); await sleep(300);
  const r = await p.evaluate(() => ({
    items: [...document.querySelectorAll('#calendar li')].map(li => li.textContent),
    note: (document.querySelector('#calendar .note') || {}).textContent || '' }));
  check('forecast: twelve month cards once any holding is dated', await p.evaluate(() => document.querySelectorAll('#calendar .month').length === 12));
  check('forecast: no dates invented for a holding without an ex-date', !r.items.some(t => /KO/.test(t)) && /Not on the calendar: KO/.test(r.note), r);
  check('forecast: holding with an ex-date gets 4 quarterly payments of $12.00, rolled forward from an old date', r.items.filter(t => /JNJ \$12\.00/.test(t)).length === 4, r.items);
  check('summary still counts the undated holding', await p.evaluate(() => kpiIncome.textContent) === '$248.00', await p.evaluate(() => kpiIncome.textContent));
  check('forecast: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  // Positions imported from the journal come in blank, so Refresh looks them up.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const calls = [];
  await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1', tj_stocks_v2: JSON.stringify([
    { ticker: 'pep', qty: 10, entryPrice: 150 }, { ticker: 'PEP', qty: 10, entryPrice: 170 }, { ticker: 'XOM', qty: 5, entryPrice: 100, exitDate: '2026-09-01' }]) },
    functions: { 'arowana-research': fakeResearch(calls) } });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/dividend-tracker.html', { waitUntil: 'load' }); await sleep(1000);
  await p.click('#dtImportBtn'); await sleep(300);
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('div_tracker') || '{"holdings":[]}').holdings);
  check('journal import: open lots merged at average cost, dividend blank (not zero)', st.length === 1 && st[0].ticker === 'PEP' && st[0].shares === 20 && st[0].cost === 160 && st[0].divps == null, st);
  await p.click('#refreshBtn');
  await until(() => p.evaluate(() => /Updated/.test(document.getElementById('status').textContent)));
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('div_tracker')).holdings);
  check('journal import → Refresh fills price and dividend', st[0].price > 0 && st[0].divps > 0 && calls.includes('/stock/metric'), { st, calls });
  await ctx.close();
}
{
  // Out of lookups: prices still update, the limit is said once, nothing is zeroed.
  const research = calls => { const base = fakeResearch(calls); return async req => (req.body && req.body.path === '/stock/metric')
    ? (calls.push('/stock/metric'), { status: 429, json: { error: 'limit', message: 'Free accounts get 5 ticker lookups a day. Pro raises that to 25.' } })
    : base(req); };
  const { ctx, p, calls, errors } = await open({ holdings: [HOLD('KO', 100, 50), HOLD('PEP', 20, 150), HOLD('O', 50, 55)], research });
  await p.click('#refreshBtn');
  await until(() => p.evaluate(() => /Updated/.test(document.getElementById('status').textContent)));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('div_tracker')).holdings);
  const msg = await p.textContent('#status');
  check('limit reached: stops after the first refused lookup', calls.filter(c => c === '/stock/metric').length === 1, calls);
  check('limit reached: prices still updated, dividends left blank (not zero)', st.every(h => h.price > 0 && h.divps == null), st);
  check('limit reached: says so in plain words', /lookups are used up/.test(msg) && /Updated 3 of 3/.test(msg), msg);
  check('limit reached: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open({ width: 375, holdings: [HOLD('KO', 100, 50, 1.94), HOLD('JNJ', 10, 140, 4.96), HOLD('VZ', 30, 40, 2.66)] });
  await p.click('#forecastBtn'); await sleep(300);
  const r = await p.evaluate(() => {
    // Clipped content counts too: the page hides overflow, so scrollWidth alone misses it.
    const wide = [...document.querySelectorAll('main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) &&
      !e.closest('[style*="overflow:auto"]') && getComputedStyle(e).position !== 'fixed' && e.offsetParent; })
      .slice(0, 4).map(e => e.tagName + '.' + e.className + '#' + e.id);
    return { over: document.documentElement.scrollWidth - innerWidth, wide };
  });
  check('phone: nothing wider than the screen or clipped (table scrolls in its own box)', r.over <= 1 && r.wide.length === 0, r);
  check('phone: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
