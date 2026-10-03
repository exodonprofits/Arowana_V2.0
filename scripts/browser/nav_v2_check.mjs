// ATD-008 browser checks: registry-driven navigation (slice 1 + wave 2,
// default-on with ap_nav_v2 = "0" opt-out) and the portfolio-command.html
// ?tab= fix.
//
// Not run in CI. Needs a separately installed Playwright (decision D11: no
// package manager in this repository) and a static server on the repo root:
//
//   python3 -m http.server 8765 --bind 127.0.0.1
//   PLAYWRIGHT_DIR=/path/to/node_modules/ node scripts/browser/nav_v2_check.mjs
//
// Every request not addressed to 127.0.0.1 is aborted, so the pages never
// reach Supabase or any provider. A synthetic cached user is set only to
// pass portfolio-command.html's client-side redirect; no session exists.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const results = []; let failed = 0;
const ok = (name, cond, extra='') => { results.push(`${cond?'PASS':'FAIL'} ${name}${extra?' — '+extra:''}`); if(!cond) failed++; };

const browser = await chromium.launch();
async function newPage(opts, flag) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  // flag: '1' / '0' sets ap_nav_v2; true means '1', false/null leaves it unset.
  const pref = flag === true ? '1' : (flag === false ? null : flag);
  await ctx.addInitScript(f => { try { if (f !== null) localStorage.setItem('ap_nav_v2', f); localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: 'synthetic-test', email: 'synthetic@example.invalid' })); } catch(e){} }, pref);
  const page = await ctx.newPage();
  page._errors = [];
  page.on('pageerror', e => page._errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && /arowana-nav/.test(m.text())) page._errors.push('console: '+m.text()); });
  return page;
}
const desktop = { viewport: { width: 1280, height: 900 } };
const mobile = { viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true };

// A. Opt-out (ap_nav_v2 = "0"): old rail unchanged
{ const p = await newPage(desktop, '0');
  await p.goto(BASE + '/tools.html'); await p.waitForTimeout(600);
  ok('A opt-out loads nav-rail.js', await p.evaluate(() => !!document.querySelector('script[src="./js/nav-rail.js"]')));
  ok('A opt-out renders old rail groups', (await p.locator('#railMount .rail-group').count()) === 5);
  ok('A opt-out has no v2 markup', (await p.locator('.anv-mobile-bar, #anvMoreSheet').count()) === 0);
  await p.context().close(); }

// B. Desktop v2
{ const p = await newPage(desktop, true);
  await p.goto(BASE + '/tools.html'); await p.waitForTimeout(600);
  const labels = await p.locator('#railMount nav.rail-nav > .rail-group .rail-item-row > .rail-item .rail-item-label').allInnerTexts();
  ok('B six primaries in approved order', JSON.stringify(labels) === JSON.stringify(['Trading Command','Research','Strategy Desks','Portfolio & Risk','Watchlists','Journal & Review']), labels.join(' | '));
  ok('B landmark named Primary', (await p.locator('nav[aria-label="Primary"]').count()) === 1);
  const cur = p.locator('#railMount [aria-current="page"]');
  ok('B exactly one aria-current in rail', (await cur.count()) === 1);
  ok('B current is Tool Directory', (await cur.first().getAttribute('href')) === 'tools.html');
  ok('B Research group expanded', (await p.locator('#railMount [data-nav-group="research"]').getAttribute('class')).includes('expanded'));
  ok('B Research primary marked contains-current, no aria-current', await p.evaluate(() => { const a = document.querySelector('#railMount a[data-nav-id="research"]'); return a.classList.contains('anv-contains-current') && !a.hasAttribute('aria-current'); }));
  const desks = p.locator('#railMount button[data-nav-id="desks"]');
  ok('B Strategy Desks is a button collapsed', (await desks.getAttribute('aria-expanded')) === 'false');
  await desks.click();
  ok('B Strategy Desks expands', (await desks.getAttribute('aria-expanded')) === 'true');
  const deskLabels = await p.locator('#anv-sub-desks > .anv-subitem .rail-subitem-label').allInnerTexts();
  ok('B five desks', deskLabels.map(s=>s.split('\n')[0].replace(/(PLANNED|LEGACY|Planned|Legacy)$/,'').trim()).join(',') === 'Swing,Wheel,Options,Growth,Long-Term', deskLabels.join(','));
  ok('B Growth planned is not a link', await p.evaluate(() => { const n = document.querySelector('#railMount [data-nav-id="desk-growth"]'); return n.tagName === 'DIV' && !n.hasAttribute('href') && /planned/i.test(n.textContent); }));
  ok('B no hrefs outside registry-safe pattern', await p.evaluate(() => [...document.querySelectorAll('#railMount a[href], .anv-mobile-bar a[href], #anvMoreSheet a[href]')].every(a => /^[a-z0-9][a-z0-9_\-]*\.html(\?[a-z0-9_\-=&]+)?$/i.test(a.getAttribute('href')))));
  // collapse
  await p.click('#railCollapseBtn');
  ok('B collapse persists key', await p.evaluate(() => localStorage.getItem('ap_rail_collapsed_v1') === '1' && document.body.classList.contains('rail-collapsed')));
  await p.reload(); await p.waitForTimeout(500);
  ok('B collapse survives reload', await p.evaluate(() => document.querySelector('#sidebarDrawer').classList.contains('rail-collapsed')));
  await p.click('#railCollapseBtn');
  // account disclosure
  await p.click('#userToggle');
  ok('B account menu opens', (await p.getAttribute('#userToggle','aria-expanded')) === 'true');
  await p.keyboard.press('Escape');
  ok('B Escape closes account menu, focus returns', await p.evaluate(() => document.getElementById('userToggle').getAttribute('aria-expanded') === 'false' && document.activeElement.id === 'userToggle'));
  ok('B mobile bar hidden on desktop', !(await p.locator('.anv-mobile-bar').isVisible()));
  ok('B no nav errors', p._errors.length === 0, p._errors.join('; '));

  // D. active-state resolution via same-origin history swap (no navigation)
  const cases = [
    ['/options-hub.html?tab=puts', 'wheel-puts'], ['/options-hub.html?tab=analyzer', 'options-recommender'],
    ['/options-hub.html', 'desk-options'], ['/options-hub.html?tab=quality', 'wheel-quality'],
    ['/portfolio-command.html?tab=performance', 'portfolio-performance'], ['/portfolio-command.html', 'portfolio-overview'],
    ['/trading-command.html', 'command-positions'], ['/trading-command.html#coach', 'command-coach'],
    ['/trading-command.html?tab=coach', 'command-coach'], ['/tradingcommand.html', null],
    ['/trade-journal-pro.html?from=trading-command', 'journal-trades'], ['/trade-journal-pro.html?tab=stats', 'journal-stats'],
    ['/watchlist.html', 'watchlists'], ['/settings.html', null], ['/analysis-central.html', 'research-instrument'],
  ];
  for (const [url, want] of cases) {
    const got = await p.evaluate(u => { history.replaceState(null, '', u); window.dispatchEvent(new PopStateEvent('popstate'));
      const c = document.querySelectorAll('[aria-current="page"]'); const ids = [...new Set([...c].map(n => n.getAttribute('data-nav-id')))];
      return ids.length ? ids.join(',') : null; }, url);
    ok('D active ' + url, got === want, 'got ' + got);
  }
  const nest = await p.evaluate(() => { history.replaceState(null, '', '/options-hub.html?tab=puts'); window.dispatchEvent(new PopStateEvent('popstate'));
    const vis = sel => [...document.querySelectorAll(sel)].map(n => n.hidden ? 'h' : 'v').join('');
    return vis('[data-nav-nest="desk-wheel"]') + '/' + vis('[data-nav-nest="desk-options"]'); });
  ok('D desk children shown only under current desk (rail+sheet)', nest === 'vv/hh', nest);
  await p.context().close(); }

// C. Mobile v2
for (const width of [320, 375, 768]) {
  const p = await newPage({ ...mobile, viewport: { width, height: 760 } }, true);
  await p.goto(BASE + '/tools.html'); await p.waitForTimeout(600);
  const items = await p.locator('.anv-mobile-bar .anv-mbn-label').allInnerTexts();
  ok(`C${width} bar order`, items.join(',') === 'Command,Watchlists,Portfolio,Journal,More', items.join(','));
  ok(`C${width} full accessible names`, await p.evaluate(() => [...document.querySelectorAll('.anv-mobile-bar a')].map(a=>a.getAttribute('aria-label')).join('|') === 'Trading Command|Watchlists|Portfolio & Risk|Journal & Review'));
  ok(`C${width} no horizontal scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await p.evaluate(() => document.documentElement.scrollWidth + '/' + window.innerWidth));
  ok(`C${width} hamburger hidden`, !(await p.locator('#sidebarTrigger').isVisible()));
  ok(`C${width} touch targets >=44px`, await p.evaluate(() => [...document.querySelectorAll('.anv-mbn-item')].every(n => n.getBoundingClientRect().height >= 44)));
  if (width === 375) {
    const more = p.locator('.anv-mobile-bar button[data-nav-slot="more"]');
    const histBefore = await p.evaluate(() => history.length);
    ok('C More marked active (Research page)', (await more.getAttribute('class')).includes('active') && /contains current/.test(await more.getAttribute('aria-label')));
    await more.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    ok('C sheet opens', await p.locator('#anvMoreSheet').isVisible());
    ok('C focus moved to sheet title', await p.evaluate(() => document.activeElement.id === 'anvMoreTitle'));
    ok('C background inert', await p.evaluate(() => document.querySelector('.main-container').inert === true));
    const secs = await p.locator('#anvMoreSheet .anv-sheet-heading').allInnerTexts();
    ok('C sheet sections', secs.map(s=>s.toLowerCase()).join(',') === 'research,strategy desks,account & help', secs.join(','));
    ok('C sheet shows current page', (await p.locator('#anvMoreSheet a[aria-current="page"]').getAttribute('href')) === 'tools.html');
    // Tab trap: tab many times, focus must stay inside sheet
    let inside = true;
    for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); inside = inside && await p.evaluate(() => document.getElementById('anvMoreSheet').contains(document.activeElement)); }
    ok('C focus trapped over 60 Tabs', inside);
    await p.keyboard.press('Shift+Tab');
    ok('C shift-tab stays inside', await p.evaluate(() => document.getElementById('anvMoreSheet').contains(document.activeElement)));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok('C Escape closes sheet', !(await p.locator('#anvMoreSheet').isVisible()));
    ok('C focus returned to More', await p.evaluate(() => document.activeElement.getAttribute('data-nav-slot') === 'more'));
    ok('C background restored', await p.evaluate(() => document.querySelector('.main-container').inert === false && !document.querySelector('.main-container').hasAttribute('aria-hidden')));
    // backdrop close
    await more.click(); await p.waitForTimeout(100);
    await p.mouse.click(180, 30); await p.waitForTimeout(100);
    ok('C backdrop click closes', !(await p.locator('#anvMoreSheet').isVisible()));
    ok('C no history entries from sheet', await p.evaluate(() => history.length) === histBefore, 'before ' + histBefore);
    // E. Back/Forward: navigate to watchlist via bar, then back
    await p.click('.anv-mobile-bar a[data-nav-slot="watchlists"]'); await p.waitForURL('**/watchlist.html'); await p.waitForTimeout(300);
    await p.goBack(); await p.waitForURL('**/tools.html'); await p.waitForTimeout(400);
    ok('E back restores tools.html active state', (await p.locator('.anv-mobile-bar').count()) === 1 && (await p.locator('#anvMoreSheet a[aria-current="page"]').getAttribute('href')) === 'tools.html');
    ok('E sheet closed after back', !(await p.locator('#anvMoreSheet').isVisible()));
    ok('C/E no nav errors', p._errors.length === 0, p._errors.join('; '));
  }
  await p.context().close();
}

// W. Wave 2: every migrated page, default (no preference) vs opt-out.
const MIGRATED = ['tools','ai-moat-finder','atr-stop-planner','credit-spread-planner','dcf-analyzer','discipline-scorecard',
  'dividend-tracker','expectancy-matrix','kelly-calculator','money-flow-alert','options-analyzer','r-multiple','risk-comfort',
  'strategy-backtesting','tax-loss-harvester','technical-analysis','tool-audit','volatility-guardrails','trading-journal-analysis'];
const EXPECT_CURRENT = { 'tools': 'research-tools', 'credit-spread-planner': 'options-spreads', 'expectancy-matrix': 'journal-expectancy',
  'strategy-backtesting': 'research-backtesting', 'tax-loss-harvester': 'portfolio-tax', 'technical-analysis': 'research-technical' };
async function survey(name, opts, flag) {
  const p = await newPage(opts, flag);
  await p.goto(BASE + '/' + name + '.html'); await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({
    primaries: [...document.querySelectorAll('#railMount nav.rail-nav > .rail-group .rail-item-row > .rail-item .rail-item-label')].map(n => n.textContent),
    oldGroups: document.querySelectorAll('#railMount .rail-group').length,
    v2: !!document.querySelector('.anv-mobile-bar'), oldBar: !!document.querySelector('.mobile-bottom-nav'),
    current: [...new Set([...document.querySelectorAll('[aria-current="page"]')].map(n => n.getAttribute('data-nav-id')))],
    bar: [...document.querySelectorAll('.anv-mobile-bar .anv-mbn-label')].map(n => n.textContent).join(','),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    hamburger: (() => { const t = document.getElementById('sidebarTrigger'); return !!(t && t.offsetParent); })(),
  }));
  r.errors = p._errors.slice();
  await p.context().close();
  return r;
}
for (const name of MIGRATED) {
  const d = await survey(name, desktop, null);
  ok(`W ${name} default: six primaries`, d.primaries.join('|') === 'Trading Command|Research|Strategy Desks|Portfolio & Risk|Watchlists|Journal & Review', d.primaries.join('|'));
  const want = EXPECT_CURRENT[name] || null;
  ok(`W ${name} current = ${want}`, (d.current[0] || null) === want && d.current.length <= 1, JSON.stringify(d.current));
  const m = await survey(name, mobile, null);
  const mo = await survey(name, mobile, '0');
  ok(`W ${name} mobile bar`, m.v2 && !m.oldBar && m.bar === 'Command,Watchlists,Portfolio,Journal,More', m.bar);
  ok(`W ${name} hamburger hidden`, !m.hamburger);
  ok(`W ${name} no new horizontal overflow`, m.overflow <= Math.max(1, mo.overflow), `new ${m.overflow} / old ${mo.overflow}`);
  const newErrs = m.errors.filter(e => !mo.errors.includes(e));
  ok(`W ${name} no new page errors`, newErrs.length === 0, newErrs.join('; '));
  ok(`W ${name} opt-out keeps old rail`, !mo.v2 && mo.oldBar && mo.oldGroups === 5);
}

// F. portfolio-command ?tab= (P1). Cached fake user only bypasses the page's
// client-side redirect; all network is blocked.
for (const [q, remembered, want] of [['?tab=performance', 'income', 'performance'], ['?tab=bogus', 'income', 'income'], ['', null, 'holdings'], ['?tab=analysis', null, 'analysis']]) {
  const p = await newPage(desktop, false);
  await p.addInitScript(r => { localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: 'synthetic-test', email: 'synthetic@example.invalid' })); if (r) localStorage.setItem('pc_active_tab_v1', r); else localStorage.removeItem('pc_active_tab_v1'); }, remembered);
  await p.goto(BASE + '/portfolio-command.html' + q); await p.waitForTimeout(1200);
  const active = await p.evaluate(() => { const b = document.querySelector('.portfolio-tab[aria-selected="true"]'); return b && b.dataset.tab; });
  ok(`F portfolio-command${q || ' (no tab)'} remembered=${remembered} -> ${want}`, active === want, 'got ' + active);
  await p.context().close();
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
