// ATD-109 pre-launch quick fixes (docs/pre-launch-audit/IMPROVEMENT-ROADMAP.md
// R-1, R-3, R-4, R-7):
//  - Technical Analysis never turns ?from= or ?ticker= into HTML (a crafted
//    link used to run script on our origin, where the session lives);
//  - the public header fits tablets and small laptops (it scrolled sideways
//    from 701 to ~1160px, with Sign in / Sign up off-screen);
//  - My Movers and Gap Scan get quotes through arowana-research for a
//    signed-in member (they said "Sign in to load live quotes.");
//  - phone form fields are 16px, so iOS does not zoom when one is focused;
//  - (R-5) the retired tradingcommand.html and whale-tracker.html land on
//    trading-command.html and arowana-trader.html, query and hash kept.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/prelaunch_quickfix_check.mjs
//
// Every non-localhost request is answered here or aborted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
import { fakeResearch } from './lib/fake_research.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();

async function stranger(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (/supabase\.co$/.test(u.hostname)) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"msg":"no session"}' });
    return r.abort();
  });
  return ctx;
}

// ── R-1: Technical Analysis link parameters are text, never HTML ──
{
  const payload = encodeURIComponent('<img src=x onerror="window.__xss=1">');
  const cases = [
    ['?ticker=AAPL&from=' + payload, 'a crafted ?from='],
    ['?ticker=' + payload + '&from=trading-command', 'a crafted ?ticker='],
    ['?ticker=AAPL&from=%3Csvg%20onload%3D%22window.__xss%3D1%22%3E', 'an svg ?from='],
  ];
  for (const [q, label] of cases) {
    const ctx = await stranger({ width: 1280, height: 900 });
    const p = await ctx.newPage();
    await p.goto(BASE + '/technical-analysis.html' + q, { waitUntil: 'load' }); await sleep(1800);
    const r = await p.evaluate(() => ({ xss: window.__xss === 1, imgs: document.querySelectorAll('.alert img, .alert svg').length,
      ticker: (document.getElementById('tickerSymbol') || {}).value }));
    check(`technical-analysis: ${label} runs nothing`, !r.xss && r.imgs === 0, r);
    if (label === 'a crafted ?ticker=') check('technical-analysis: a ticker that is not a ticker is ignored', !/[<>"]/.test(r.ticker || ''), r.ticker);
    await ctx.close();
  }
  {
    const ctx = await stranger({ width: 1280, height: 900 });
    const p = await ctx.newPage();
    await p.goto(BASE + '/technical-analysis.html?ticker=aapl&from=trading-command', { waitUntil: 'load' }); await sleep(1800);
    const r = await p.evaluate(() => ({ text: (document.querySelector('main .alert.alert-success') || {}).textContent || '',
      ticker: (document.getElementById('tickerSymbol') || {}).value }));
    check('technical-analysis: a link from Trading Command still says so, with the ticker', /Connected from Trading Command/.test(r.text) && /AAPL/.test(r.text) && r.ticker === 'AAPL', r);
    const closed = await p.evaluate(() => { const b = document.querySelector('main .alert.alert-success button'); if (!b) return false; b.click(); return !document.querySelector('main .alert.alert-success'); });
    check('technical-analysis: the notice can be dismissed', closed);
    await ctx.close();
  }
  {
    const ctx = await stranger({ width: 1280, height: 900 });
    const p = await ctx.newPage();
    await p.goto(BASE + '/technical-analysis.html?ticker=AAPL&from=somewhere-else', { waitUntil: 'load' }); await sleep(1500);
    check('technical-analysis: an unknown source shows no notice', await p.evaluate(() => !document.querySelector('main .alert.alert-success')));
    await ctx.close();
  }
}

// ── R-3: the public header fits every width ──
const PUBLIC = ['about', 'blog', 'contact', 'disclosures', 'privacy', 'refunds', 'risk-disclosure', 'security', 'support', 'terms', 'wheel-calculator', 'assignment-risk'];
for (const page of PUBLIC) {
  const bad = [];
  for (const width of [375, 768, 1024, 1180, 1280, 1440]) {
    const ctx = await stranger({ width, height: 900 }, width < 500);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${page}.html`, { waitUntil: 'load' }); await sleep(400);
    const r = await p.evaluate(() => {
      const shown = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const signIn = document.getElementById('navSignIn');
      return { overflow: document.documentElement.scrollWidth - innerWidth, links: shown(document.querySelector('.nav-links')),
        burger: shown(document.querySelector('.nav-burger')), signInRight: signIn && shown(signIn) ? signIn.getBoundingClientRect().right : null };
    });
    if (r.overflow > 2) bad.push({ width, overflow: r.overflow });
    if (width >= 1280 && (!r.links || r.burger)) bad.push({ width, desktopRow: r });
    if (width <= 1180 && (r.links || !r.burger)) bad.push({ width, collapsed: r });
    if (r.signInRight !== null && r.signInRight > width) bad.push({ width, signInOffScreen: r.signInRight });
    if (width === 768 && r.burger) {
      await p.click('.nav-burger');
      const open = await p.evaluate(() => { const m = document.querySelector('.mob-menu'); return !!m && getComputedStyle(m).display !== 'none' && m.querySelectorAll('a').length > 3; });
      if (!open) bad.push({ width, menu: 'does not open with links' });
    }
    await ctx.close();
  }
  check(`${page}: header fits 375-1440 (links in the menu below 1181px, in the bar above)`, bad.length === 0, bad);
}

// ── R-7: phone form fields are at least 16px ──
for (const page of ['login', 'signup', 'reset-password', 'wheel-calculator', 'assignment-risk', 'index']) {
  const ctx = await stranger({ width: 375, height: 812 }, true);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${page}.html`, { waitUntil: 'load' }); await sleep(500);
  const small = await p.evaluate(() => [...document.querySelectorAll('input,select,textarea')]
    .filter(e => e.offsetParent && !['checkbox', 'radio', 'range', 'hidden'].includes(e.type) && parseFloat(getComputedStyle(e).fontSize) < 16)
    .map(e => (e.id || e.name || e.type) + ' ' + getComputedStyle(e).fontSize));
  check(`${page}: phone form fields are 16px or larger`, small.length === 0, small);
  await ctx.close();
}

// ── R-4: personal scans get quotes for a signed-in member ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const T = '2026-10-01T12:00:00Z', calls = [], direct = [];
  await installFakeSupabase(ctx, { profiles: [{ id: UID, arowana_plan: 'pro', arowana_plan_status: 'active', arowana_stripe_subscription_id: 'sub_synthetic', created_at: T }] },
    { localStorage: { ap_onboarded_v1: '1', tj_stocks_v2: JSON.stringify([{ ticker: 'AAPL', status: 'open' }, { ticker: 'KO', status: 'open' }]) },
      functions: { 'arowana-research': fakeResearch(calls) } });
  ctx.on('request', r => { if (/finnhub\.io/.test(new URL(r.url()).hostname)) direct.push(r.url().replace(/token=[^&]*/, 'token=…')); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/scanner.html', { waitUntil: 'load' }); await sleep(1500);
  const movers = await p.evaluate(() => AP_SCANNERS.run('my_movers', { filters: { minMove: '0', direction: 'both' } }));
  check('scanner: My Movers returns rows for a signed-in member', !movers.error && movers.universeSize === 2 && movers.rows.length === 2, movers);
  const gaps = await p.evaluate(() => AP_SCANNERS.run('gap_scan', { filters: { minGap: '0', direction: 'both' } }));
  check('scanner: Gap Scan runs for a signed-in member', !gaps.error && gaps.universeSize === 2, gaps);
  check('scanner: quotes go through arowana-research, never to finnhub.io', calls.filter(c => c === '/quote').length >= 2 && direct.length === 0, { calls, direct });
  check('scanner: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── R-5: retired duplicates land on the live pages ──
for (const [from, to] of [['/tradingcommand.html?tab=coach#x', '/trading-command.html?tab=coach#x'], ['/whale-tracker.html?symbol=KO', '/arowana-trader.html?symbol=KO']]) {
  const ctx = await stranger({ width: 1280, height: 900 });
  const p = await ctx.newPage();
  await p.goto(BASE + from, { waitUntil: 'load' }); await sleep(1200);
  const u = new URL(p.url());
  check(`${from.split('?')[0]} redirects to ${to.split('?')[0]}, keeping query and hash`, u.pathname + u.search + u.hash === to || (u.pathname === '/login.html' && decodeURIComponent(u.search).includes(to.split('#')[0])), p.url());
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
