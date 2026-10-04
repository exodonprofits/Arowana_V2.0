// ATD-108 S5: plain-English explanations and small fixes, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/explain_fixes_check.mjs
//
// arowana-explain is answered by a stub (scripts/browser/lib/fake_supabase.mjs);
// every other non-localhost request is aborted. Checks that the buttons send
// only the page's own figures with the user's token, render the reply as text,
// and pass on the server's Pro message; plus the Wheel Calculator, scanner
// plan, roll-tracker and Options Hub fixes.
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
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const T = '2026-09-01T00:00:00.000Z';
const HOSTILE = '<img src=x onerror="window.__xss=1">Premium drove the result.';

const browser = await chromium.launch();
async function page(path, db, explain, width) {
  const ctx = await browser.newContext({ viewport: { width: width || 1280, height: 900 } });
  const calls = [];
  const fake = await installFakeSupabase(ctx, db, { functions: { 'arowana-explain': async (req) => { calls.push(req); return explain(req); } } });
  const p = await ctx.newPage();
  const errors = [], bad = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => { if (r.status() === 404) bad.push(r.url()); });
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  return { ctx, p, calls, errors, bad, fake };
}

// ── Portfolio Command → Income: "Explain in plain English" ───────────────
{
  const db = {
    tj_options: [{ id: 'o1', user_id: UID, status: 'expired', updated_at: T, payload: { id: 'o1', ticker: 'SYNP', optType: 'put', strategy: 'Cash-Secured Put', isCredit: true, qty: 1, strike: 150, expiry: '2026-03-20', entryDate: '2026-02-20', exitDate: '2026-03-20', premiumIn: 2, premiumOut: 0, pnl: 200, broker: 'Schwab', updatedAt: T } }],
    tj_stocks: []
  };
  const { ctx, p, calls, errors } = await page('portfolio-command.html?tab=income', db, () => ({ json: { text: HOSTILE, remaining: 149 } }));
  check('income: explain button shown when there are closed trades', await until(() => p.evaluate(() => !!document.getElementById('pi-explain-btn')), 15000));
  await p.click('#pi-explain-btn');
  await until(() => p.evaluate(() => /Premium drove/.test((document.getElementById('pi-explain-out') || {}).textContent || '')));
  const req = calls[0] || {};
  const facts = (req.body && req.body.facts) || [];
  check('income: request is kind "income" with the page\'s own figures', req.body && req.body.kind === 'income' && facts.some(f => f.label === 'Realized premium' && /\$200/.test(f.value)), req.body);
  check('income: sent with the user\'s session token', /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test((req.headers || {}).authorization || ''), (req.headers || {}).authorization);
  const out = await p.evaluate(() => ({ html: document.getElementById('pi-explain-out').innerHTML, xss: !!window.__xss, img: !!document.querySelector('#pi-explain-out img') }));
  check('income: reply rendered as text, never as HTML', !out.xss && !out.img && /&lt;img/.test(out.html), out);
  check('income: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Options Hub → Check a Trade: "Argue both sides", and the Pro message ─
{
  const base = () => ({
    ap_risk_settings: [{ user_id: UID, wheel_capital: 100000, max_ticker_pct: 20, max_total_pct: 60, max_puts_per_ticker: 2, warn_earnings: true, rules: { minAnnualYield: 12 } }],
    watchlists: [], market_snapshots: [{ symbol: 'SYNK', tf: '1d', ts: day(-1), ohlcv: { close: 60 } }], tj_options: [], tj_stocks: []
  });
  const q = `options-hub.html?tab=check&ticker=SYNK&type=put&strike=55&expiry=${day(35)}&premium=1.10`;
  {
    const { ctx, p, calls, errors, bad } = await page(q, base(), () => ({ json: { case: { for: 'You collect $110.00 now.', against: HOSTILE }, remaining: 148 } }));
    await until(() => p.evaluate(() => document.getElementById('checkTab').classList.contains('active')));
    await p.click('#tc-go');
    const btn = await until(() => p.evaluate(() => [...document.querySelectorAll('#tc-result .ax-btn')].some(b => /Argue both sides/.test(b.textContent))));
    check('check: "Argue both sides" shown with the result', btn);
    await p.evaluate(() => [...document.querySelectorAll('#tc-result .ax-btn')].find(b => /Argue both sides/.test(b.textContent)).click());
    await until(() => p.evaluate(() => !!document.querySelector('#tc-result .ax-case')));
    const r = await p.evaluate(() => ({ for: (document.querySelector('#tc-result .ax-for') || {}).textContent, img: !!document.querySelector('#tc-result .ax-case img'), xss: !!window.__xss }));
    check('check: request is kind "trade-case" with the trade facts', calls[0] && calls[0].body.kind === 'trade-case' && calls[0].body.facts.some(f => f.label === 'Trade'), calls[0] && calls[0].body);
    check('check: both sides rendered as text', /You collect \$110\.00 now/.test(r.for || '') && !r.img && !r.xss, r);
    check('options hub: no 404s (the missing options-hub-trading-layout.js tag is gone)', bad.length === 0, bad);
    check('check: no page errors', errors.length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, p } = await page(q, base(), () => ({ status: 402, json: { error: 'Plain-English explanations are part of Pro.', upgrade: true } }));
    await until(() => p.evaluate(() => document.getElementById('checkTab').classList.contains('active')));
    await p.click('#tc-go');
    await until(() => p.evaluate(() => [...document.querySelectorAll('#tc-result .ax-btn')].length > 0));
    await p.evaluate(() => [...document.querySelectorAll('#tc-result .ax-btn')].find(b => /Argue both sides/.test(b.textContent)).click());
    check('check: server refusal (not Pro) is shown as its message', await until(() => p.evaluate(() => /part of Pro/.test(document.getElementById('tc-result').textContent))));
    await ctx.close();
  }
}

// ── Wheel Calculator: covered-call "expires worthless" row uses cost basis
{
  const ctx = await browser.newContext();
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE + '/wheel-calculator.html');
  await p.click('[data-leg="call"]');
  for (const [id, v] of [['price', '50'], ['strike', '52'], ['premium', '1'], ['dte', '30'], ['contracts', '1'], ['basis', '40']]) await p.fill('#' + id, v);
  await p.waitForTimeout(300);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#scenTable tbody tr')].map(tr => [...tr.children].map(td => td.textContent)));
  const num = s => Number(String(s).replace(/[^0-9.\-−]/g, '').replace('−', '-'));
  const unchanged = rows.find(r => /unchanged/.test(r[0])) || [];
  const called = rows.find(r => /called away/.test(r[1])) || [];
  check('calculator: unchanged price, kept shares = premium + (price − basis) × 100 = $1,100', num(unchanged[2]) === 1100, rows);
  check('calculator: called away = premium + (strike − basis) × 100 = $1,300', num(called[2]) === 1300, rows);
  const fit = await p.evaluate(() => { const t = document.getElementById('scenTable'); return t.getBoundingClientRect().width <= t.parentElement.getBoundingClientRect().width + 1; });
  check('calculator: scenario table fits its card (result column visible)', fit);
  check('calculator: note explains the reference', /cost basis of \$40/.test(await p.textContent('#scenNote')), await p.textContent('#scenNote'));
  await ctx.close();
}

// ── Scanner: plan.js decides Pro locks; ap_is_pro_v1 no longer unlocks ───
// scanners.js unlocks every scan on localhost (devUnlocked), so this page is
// served as http://arowana.test, mapped to the local server.
const HOST = 'arowana.test';
const prodBrowser = await chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
async function scannerLocks(plan, extraLs) {
  const ctx = await prodBrowser.newContext();
  await installFakeSupabase(ctx, { profiles: [{ id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_stripe_subscription_id: plan === 'free' ? null : 'sub_synthetic' }] }, { localStorage: extraLs, localHost: HOST });
  const p = await ctx.newPage();
  await p.goto(BASE.replace('127.0.0.1', HOST) + '/scanner.html');
  await p.evaluate(() => new Promise(r => { if (!window.AP_PLAN) return r(); AP_PLAN.ready().then(r); setTimeout(r, 6000); }));
  const r = await p.evaluate(() => {
    const items = AP_SCANNERS.listForMode('advanced');
    const planOf = i => i.planNeeded;
    return { dev: AP_SCANNERS.devUnlocked(), plan: AP_SCANNERS.currentPlan(), total: items.length,
             proLocked: items.filter(i => planOf(i) === 'pro' && i.planLocked).length,
             proTotal: items.filter(i => planOf(i) === 'pro').length,
             eliteLocked: items.filter(i => planOf(i) === 'elite' && i.planLocked).length,
             eliteTotal: items.filter(i => planOf(i) === 'elite').length };
  });
  await ctx.close();
  return r;
}
{
  const free = await scannerLocks('free', { ap_is_pro_v1: '1', gs_auth_user_v1: JSON.stringify({ id: UID, email: 'synthetic@example.invalid', plan: 'pro' }) });
  check('scanner: free account stays free despite ap_is_pro_v1 and a "pro" user object', free.plan === 'free' && free.proTotal > 0 && free.proLocked === free.proTotal, free);
  const pro = await scannerLocks('pro');
  check('scanner: Pro account (from the server) unlocks Pro scans; Elite stay locked', pro.plan === 'pro' && pro.proLocked === 0 && pro.eliteLocked === pro.eliteTotal, pro);
}

// ── Option roll tracker: no Twelve Data polling ──────────────────────────
{
  const ctx = await browser.newContext();
  const hits = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (/twelvedata/.test(u)) hits.push(u); return new URL(u).hostname === '127.0.0.1' ? r.continue() : r.abort(); });
  await ctx.addInitScript(() => { try { localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: 'synthetic-test', email: 'synthetic@example.invalid' })); } catch (e) {} });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/option-roll-tracker.html');
  await p.waitForTimeout(1500);
  check('roll tracker: no Twelve Data requests', hits.length === 0, hits);
  check('roll tracker: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
await prodBrowser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
