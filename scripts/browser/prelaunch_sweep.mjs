// ATD-109 pre-launch sweep: opens every real page (not redirect stubs) in
// Chromium as a signed-in Pro member with synthetic data, at phone, tablet,
// laptop and large-desktop widths, and records what a visitor would hit:
// page errors, missing local files, sideways scroll, clipped controls,
// placeholder text on screen, small tap targets and sub-16px inputs on
// phones, and the fonts/colours each page uses (for the design audit).
// Writes JSON (and optional screenshots); it asserts nothing by itself.
//
//   BASE=http://127.0.0.1:8765 OUT=/tmp/sweep.json [SHOTS=/tmp/shots] \
//   [CHART_JS=/path/chart.umd.js] [PAGES=a.html,b.html] [WIDTHS=375,1280] \
//   [SIGNED_OUT=1] node scripts/browser/prelaunch_sweep.mjs
//
// SIGNED_OUT=1 visits as a stranger: no session, every Supabase call refused.
// Otherwise a synthetic session (fake Supabase, fake research and explain functions);
// every non-localhost request is answered with a fake or aborted. Without
// CHART_JS, pages that draw charts report "Chart is not defined"; that is
// counted separately as test-environment noise.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
import { fakeResearch } from './lib/fake_research.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const OUT = process.env.OUT || 'prelaunch_sweep.json';
const SHOTS = process.env.SHOTS || '';
const SIGNED_OUT = process.env.SIGNED_OUT === '1';
const WIDTHS = (process.env.WIDTHS || '375,768,1280,1920').split(',').map(Number);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

// Real pages = top-level .html that are not small redirect stubs.
function realPages() {
  return fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).filter(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return !(s.length < 6000 && /http-equiv="refresh"|location\.replace\(/.test(s));
  }).sort();
}
const PAGES = process.env.PAGES ? process.env.PAGES.split(',') : realPages();

const T = '2026-10-01T12:00:00Z';
const DB = () => ({
  profiles: [{ id: UID, arowana_plan: 'pro', arowana_plan_status: 'active', arowana_stripe_subscription_id: 'sub_synthetic', created_at: T }],
  watchlists: [{ id: 'w1', user_id: UID, name: 'Main', created_at: T }],
  watchlist_items: [{ id: 'i1', user_id: UID, watchlist_id: 'w1', symbol: 'AAPL', horizon: 'trade_idea', status: 'watching', inserted_at: T },
                    { id: 'i2', user_id: UID, watchlist_id: 'w1', symbol: 'KO', horizon: 'long_term', status: 'watching', inserted_at: T }],
  // Journal pages read tj_stocks / tj_options (payload rows); none are seeded,
  // so journal-driven panels show their empty states in this sweep.
});
const PLACEHOLDER = /\bundefined\b|\bNaN\b|\[object Object\]|lorem ipsum|coming soon|mock mode|demo data|\bTODO\b|n8n webhook|api key/i;
const NOISE = /Chart is not defined|Failed to load resource|net::ERR_|favicon/i;

const chartJs = process.env.CHART_JS && fs.existsSync(process.env.CHART_JS) ? fs.readFileSync(process.env.CHART_JS) : null;
const browser = await chromium.launch();
const results = [];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

for (const page of PAGES) {
  for (const width of WIDTHS) {
    const mobile = width < 500;
    const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : (width < 1000 ? 1024 : 900) }, isMobile: mobile, hasTouch: mobile });
    if (SIGNED_OUT) await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.hostname === '127.0.0.1') return r.continue();
      if (/supabase\.co$/.test(u.hostname)) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"msg":"no session"}' });
      return r.abort();
    });
    else await installFakeSupabase(ctx, DB(), { localStorage: { ap_onboarded_v1: '1' }, functions: {
      'arowana-research': fakeResearch([]),
      'arowana-explain': async () => ({ status: 200, json: { text: 'Synthetic explanation.' } }),
      'arowana-ai-coach': async () => ({ status: 200, json: { reply: 'Synthetic coach reply.' } }) } });
    if (chartJs) await ctx.route(/cdn\.jsdelivr\.net\/npm\/chart\.js|chart\.umd/i, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: chartJs }));
    const p = await ctx.newPage();
    const errors = [], consoleErrors = [], missing = [];
    p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    p.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
    p.on('response', r => { const u = new URL(r.url()); if (u.hostname === '127.0.0.1' && r.status() >= 400) missing.push(u.pathname + ' ' + r.status()); });
    const t0 = Date.now();
    let navError = null;
    try { await p.goto(BASE + '/' + page, { waitUntil: 'load', timeout: 30000 }); } catch (e) { navError = e.message.slice(0, 120); }
    await p.waitForTimeout(1800);
    const loadMs = Date.now() - t0;
    let m = {};
    try {
      m = await p.evaluate(({ src, mobile }) => {
        const re = new RegExp(src, 'i');
        const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && el.offsetParent !== null; };
        const text = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { const el = n.parentElement; if (el && vis(el) && !el.closest('script,style,noscript') && re.test(n.textContent)) text.push(n.textContent.trim().slice(0, 90)); }
        const clipped = [...document.querySelectorAll('main *, .main-content *, .container *, body > section *')].filter(e => {
          if (!vis(e) || getComputedStyle(e).position === 'fixed') return false;
          const r = e.getBoundingClientRect();
          if (!(r.right > innerWidth + 2 || r.left < -2)) return false;
          let a = e.parentElement; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; a = a.parentElement; }
          return true;
        });
        const small = mobile ? [...document.querySelectorAll('button, a.btn, [role=button], input[type=submit], select')].filter(e => vis(e) && e.getBoundingClientRect().height < 36 && !e.closest('.anv-mobile-bar')).length : 0;
        const tinyInputs = mobile ? [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select, textarea')].filter(e => vis(e) && parseFloat(getComputedStyle(e).fontSize) < 16).length : 0;
        const h1 = document.querySelector('h1');
        const btn = [...document.querySelectorAll('button')].find(vis);
        return {
          title: document.title, finalPath: location.pathname + location.search,
          overflow: document.documentElement.scrollWidth - innerWidth,
          clipped: clipped.length, clippedSample: clipped.slice(0, 3).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')),
          placeholder: [...new Set(text)].slice(0, 6),
          shell: !!document.querySelector('aside.anv-shell, #railMount .rail-nav, #railMount nav'),
          mobileBar: !!document.querySelector('.anv-mobile-bar'),
          small, tinyInputs,
          bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g, ''),
          bodyBg: getComputedStyle(document.body).backgroundColor,
          h1Font: h1 ? getComputedStyle(h1).fontFamily.split(',')[0].replace(/["']/g, '') : null,
          h1Size: h1 ? getComputedStyle(h1).fontSize : null,
          btnBg: btn ? getComputedStyle(btn).backgroundColor : null, btnRadius: btn ? getComputedStyle(btn).borderRadius : null,
          signInWall: /sign in/i.test((document.querySelector('main') || document.body).innerText.slice(0, 600)) && !document.querySelector('#userName'),
        };
      }, { src: PLACEHOLDER.source, mobile });
    } catch (e) { m = { evalError: e.message.slice(0, 120) }; }
    const chartNoise = errors.filter(e => /Chart is not defined/.test(e)).length;
    results.push({ page, width, loadMs, navError, errors: errors.filter(e => !/Chart is not defined/.test(e)), chartNoise, consoleErrors: [...new Set(consoleErrors)].slice(0, 4), missing: [...new Set(missing)], ...m });
    if (SHOTS && (width === 375 || width === 1280)) { try { await p.screenshot({ path: path.join(SHOTS, page.replace('.html', '') + '-' + width + '.png') }); } catch (e) {} }
    await ctx.close();
  }
  process.stdout.write('.');
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\n${results.length} loads of ${PAGES.length} pages written to ${OUT}`);
