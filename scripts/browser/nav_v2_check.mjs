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
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort();
    // Auth-gated pages (e.g. arowana-trader.html) redirect to login.html when
    // there is no real Supabase session. A 204 makes Chromium keep the current
    // page, so the page under test stays on screen; no session is created.
    if (/\/login\.html$/.test(u.pathname) && r.request().isNavigationRequest()) return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
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
  // ATD-109 launch menu: planned and hidden desks are not rendered.
  ok('B launch desks: Wheel, Options and Long-Term', deskLabels.map(s=>s.split('\n')[0].trim()).join(',') === 'Wheel,Options,Long-Term', deskLabels.join(','));
  ok('B planned and hidden entries are not rendered, and no Legacy/Planned badges', await p.evaluate(() =>
    ['desk-growth','desk-swing','command-whatchanged','command-queue','research-technical','research-scanners','research-backtesting','portfolio-accounts']
      .every(id => !document.querySelector('[data-nav-id="' + id + '"]')) && !document.querySelector('#railMount .anv-badge, #anvMoreSheet .anv-badge')));
  ok('B Thesis Builder and Decision history are in the menu', await p.evaluate(() =>
    document.querySelector('#railMount a[data-nav-id="research-thesis"]')?.getAttribute('href') === 'thesis-builder.html' &&
    document.querySelector('#railMount a[data-nav-id="journal-decisions"]')?.getAttribute('href') === 'thesis-builder.html?view=history'));
  ok('B no hrefs outside registry-safe pattern', await p.evaluate(() => [...document.querySelectorAll('#railMount a[href], .anv-mobile-bar a[href], #anvMoreSheet a[href]')].every(a => /^[a-z0-9][a-z0-9_\-]*\.html(\?[a-z0-9_\-=&]+)?$/i.test(a.getAttribute('href')))));
  // collapse
  await p.click('#railCollapseBtn');
  ok('B collapse persists key', await p.evaluate(() => localStorage.getItem('ap_rail_collapsed_v1') === '1' && document.body.classList.contains('rail-collapsed')));
  await p.reload(); await p.waitForTimeout(500);
  ok('B collapse survives reload', await p.evaluate(() => document.querySelector('#sidebarDrawer').classList.contains('rail-collapsed')));
  await p.click('#railCollapseBtn');
  // account disclosure
  await p.click('#userToggle'); await p.waitForTimeout(50);   // toggle is deferred one tick (double-handler guard)
  ok('B account menu opens', (await p.getAttribute('#userToggle','aria-expanded')) === 'true');
  await p.keyboard.press('Escape');
  ok('B Escape closes account menu, focus returns', await p.evaluate(() => document.getElementById('userToggle').getAttribute('aria-expanded') === 'false' && document.activeElement.id === 'userToggle'));
  ok('B mobile bar hidden on desktop', !(await p.locator('.anv-mobile-bar').isVisible()));
  ok('B no nav errors', p._errors.length === 0, p._errors.join('; '));

  // D. active-state resolution via same-origin history swap (no navigation)
  const cases = [
    ['/options-hub.html?tab=puts', 'wheel-puts'], ['/options-hub.html?tab=analyzer', 'options-recommender'],
    ['/options-hub.html', 'wheel-calls'], ['/options-hub.html?tab=quality', 'wheel-quality'],
    ['/portfolio-command.html?tab=performance', 'portfolio-performance'], ['/portfolio-command.html', 'portfolio-overview'],
    ['/trading-command.html', 'command-positions'], ['/trading-command.html#coach', 'command-coach'],
    ['/trading-command.html?tab=coach', 'command-coach'], ['/tradingcommand.html', null],
    ['/trade-journal-pro.html?from=trading-command', 'journal-trades'], ['/trade-journal-pro.html?tab=stats', 'journal-stats'],
    ['/watchlist.html', 'watchlists'], ['/settings.html', null], ['/analysis-central.html', 'research-instrument'],
    // Extensionless URLs, as served by hosts such as Cloudflare Pages.
    ['/options-hub?tab=puts', 'wheel-puts'], ['/trading-command', 'command-positions'], ['/tools', 'research-tools'], ['/', null],
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
  'strategy-backtesting','tax-loss-harvester','technical-analysis','tool-audit','volatility-guardrails','trading-journal-analysis','trading-command',
  'portfolio-command','options-hub','analysis-central','intrinsic-value','portfolio-advisor',
  'arowana-trader','watchlist','scanner','position-sizer','trade-plan-builder','wheel-strategy','trade-journal-pro'];
const NO_RAIL_MOUNT = ['arowana-trader'];   // sidebar is the coach panel: mobile bar + More sheet only
const EXPECT_CURRENT = { 'tools': 'research-tools', 'trading-command': 'command-positions', 'portfolio-command': 'portfolio-overview', 'options-hub': 'wheel-calls',
  'analysis-central': 'research-instrument', 'intrinsic-value': 'research-valuation', 'portfolio-advisor': 'portfolio-advisor',
  'arowana-trader': 'wheel-coach', 'watchlist': 'watchlists', 'scanner': null, 'position-sizer': 'portfolio-sizer',
  'wheel-strategy': 'wheel-strategy', 'trade-journal-pro': 'journal-trades', 'credit-spread-planner': 'options-spreads', 'expectancy-matrix': 'journal-expectancy',
  'strategy-backtesting': null, 'tax-loss-harvester': 'portfolio-tax', 'technical-analysis': null, 'dividend-tracker': 'portfolio-dividends' };  // null: hidden from the ATD-109 launch menu
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
    hamburger: [...document.querySelectorAll('#sidebarTrigger, [data-nav-drawer-trigger]')].some(t => !!t.offsetParent),
  }));
  r.errors = p._errors.slice();
  await p.context().close();
  return r;
}
for (const name of MIGRATED) {
  const d = await survey(name, desktop, null);
  if (!NO_RAIL_MOUNT.includes(name)) ok(`W ${name} default: six primaries`, d.primaries.join('|') === 'Trading Command|Research|Strategy Desks|Portfolio & Risk|Watchlists|Journal & Review', d.primaries.join('|'));
  const want = EXPECT_CURRENT[name] || null;
  ok(`W ${name} current = ${want}`, (d.current[0] || null) === want && d.current.length <= 1, JSON.stringify(d.current));
  const m = await survey(name, mobile, null);
  const mo = await survey(name, mobile, '0');
  ok(`W ${name} mobile bar`, m.v2 && !m.oldBar && m.bar === 'Command,Watchlists,Portfolio,Journal,More', m.bar);
  ok(`W ${name} hamburger hidden`, !m.hamburger);
  ok(`W ${name} no new horizontal overflow`, m.overflow <= Math.max(1, mo.overflow), `new ${m.overflow} / old ${mo.overflow}`);
  const newErrs = m.errors.filter(e => !mo.errors.includes(e));
  ok(`W ${name} no new page errors`, newErrs.length === 0, newErrs.join('; '));
  ok(`W ${name} opt-out keeps old rail`, !mo.v2 && mo.oldBar && mo.oldGroups === (NO_RAIL_MOUNT.includes(name) ? 0 : 5));
}

// T. Wave 3: trading-command.html specifics.
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => { try { localStorage.removeItem('tc_active_tab_v1'); } catch (e) {} });
  await p.goto(BASE + '/trading-command.html'); await p.waitForTimeout(1500);
  const cur = async () => p.evaluate(() => [...new Set([...document.querySelectorAll('[aria-current="page"]')].map(n => n.getAttribute('data-nav-id')))].join(','));
  ok('T fresh visit: Positions current', (await cur()) === 'command-positions', await cur());
  ok('T no retired links in rail', await p.evaluate(() => !document.querySelector('#railMount a[href*="market-intelligence"], #railMount a[href*="momentum-hunter"]')));
  ok('T one rail only', await p.evaluate(() => document.querySelectorAll('#railMount nav').length === 1 && !document.querySelector('.mobile-bottom-nav')));
  await p.evaluate(() => { window.__noReload = 1; });
  await p.click('#railMount a[data-nav-id="command-coach"]'); await p.waitForTimeout(300);
  ok('T rail Coach switches in place (no reload)', await p.evaluate(() => window.__noReload === 1 && location.search === ''));
  ok('T Coach tab visible', await p.evaluate(() => document.getElementById('coachTab').classList.contains('active')));
  ok('T nav follows tab', (await cur()) === 'command-coach', await cur());
  await p.click('#railMount a[data-nav-id="command-positions"]'); await p.waitForTimeout(300);
  ok('T back to Positions in place', await p.evaluate(() => window.__noReload === 1 && document.getElementById('positionsTab').classList.contains('active')) && (await cur()) === 'command-positions');
  // Account menu: page handler + nav handler both attached; one click must open it.
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok('T account menu opens with both handlers', await p.evaluate(() => document.getElementById('userMenu').classList.contains('open') && document.getElementById('userToggle').getAttribute('aria-expanded') === 'true'));
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok('T second click closes it', await p.evaluate(() => !document.getElementById('userMenu').classList.contains('open') && document.getElementById('userToggle').getAttribute('aria-expanded') === 'false'));
  await p.click('#userToggle'); await p.waitForTimeout(150);
  await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  ok('T Escape closes and returns focus', await p.evaluate(() => !document.getElementById('userMenu').classList.contains('open') && document.activeElement.id === 'userToggle'));
  ok('T no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => localStorage.setItem('tc_active_tab_v1', 'coach'));
  await p.goto(BASE + '/trading-command.html'); await p.waitForTimeout(1500);
  ok('T remembered Coach tab highlighted without URL change', await p.evaluate(() => document.getElementById('coachTab').classList.contains('active') && location.search === '' &&
    document.querySelector('#railMount [aria-current="page"]').getAttribute('data-nav-id') === 'command-coach'));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/trading-command.html?tab=coach'); await p.waitForTimeout(1500);
  ok('T ?tab=coach opens Coach and highlights it', await p.evaluate(() => document.getElementById('coachTab').classList.contains('active') &&
    document.querySelector('#railMount [aria-current="page"]').getAttribute('data-nav-id') === 'command-coach'));
  await p.context().close(); }
{ const p = await newPage(mobile, null);
  await p.addInitScript(() => localStorage.removeItem('tc_active_tab_v1'));
  await p.goto(BASE + '/trading-command.html'); await p.waitForTimeout(1500);
  ok('T mobile Command slot marked active', await p.evaluate(() => document.querySelector('.anv-mobile-bar a[data-nav-slot="command"]').classList.contains('active')));
  await p.evaluate(() => { window.__noReload = 1; });
  await p.click('.anv-mobile-bar button[data-nav-slot="more"]'); await p.waitForTimeout(150);
  ok('T More sheet opens on Command page, More not active', await p.evaluate(() => !document.getElementById('anvMoreSheet').hidden && !document.querySelector('[data-nav-slot="more"]').classList.contains('active')));
  await p.keyboard.press('Escape');
  ok('T mobile no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }

// W4. Wave 4 page specifics.
const curIds = p => p.evaluate(() => [...new Set([...document.querySelectorAll('#railMount [aria-current="page"]')].map(n => n.getAttribute('data-nav-id')))].join(','));
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => localStorage.removeItem('oh_active_tab_v1'));
  await p.goto(BASE + '/options-hub.html?tab=analyzer'); await p.waitForTimeout(1500);
  ok('W4 options-hub ?tab=analyzer -> Options > Strategy Recommender', (await curIds(p)) === 'options-recommender', await curIds(p));
  ok('W4 Options desk children shown, Wheel children hidden', await p.evaluate(() => !document.querySelector('#railMount [data-nav-nest="desk-options"]').hidden && document.querySelector('#railMount [data-nav-nest="desk-wheel"]').hidden));
  await p.evaluate(() => { window.__noReload = 1; });
  await p.click('#railMount a[data-nav-id="desk-wheel"]'); await p.waitForTimeout(400);
  ok('W4 Wheel desk link switches in place to Puts', await p.evaluate(() => window.__noReload === 1 && document.getElementById('putsTab').classList.contains('active')) && (await curIds(p)) === 'wheel-puts', await curIds(p));
  await p.click('#railMount a[data-nav-id="wheel-roll"]'); await p.waitForTimeout(400);
  ok('W4 Roll Coach in place', await p.evaluate(() => window.__noReload === 1 && document.getElementById('rollTab').classList.contains('active')) && (await curIds(p)) === 'wheel-roll');
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok('W4 options-hub account menu opens (page + nav handlers)', await p.evaluate(() => document.getElementById('userMenu').classList.contains('open')));
  ok('W4 options-hub no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => localStorage.setItem('oh_active_tab_v1', 'watchlist'));
  await p.goto(BASE + '/options-hub.html'); await p.waitForTimeout(1500);
  ok('W4 options-hub remembered Vol Watchlist highlighted', (await curIds(p)) === 'options-vol' && await p.evaluate(() => document.getElementById('watchlistTab').classList.contains('active')), await curIds(p));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => localStorage.setItem('pc_active_tab_v1', 'income'));
  await p.goto(BASE + '/portfolio-command.html?tab=performance'); await p.waitForTimeout(1500);
  ok('W4 portfolio ?tab=performance -> Performance', (await curIds(p)) === 'portfolio-performance' && await p.evaluate(() => document.getElementById('performanceTab').classList.contains('active')), await curIds(p));
  await p.evaluate(() => { window.__noReload = 1; });
  await p.click('#railMount a[data-nav-id="portfolio-overview"]'); await p.waitForTimeout(400);
  ok('W4 Portfolio Overview opens Overview in place', await p.evaluate(() => window.__noReload === 1 && document.getElementById('overviewTab').classList.contains('active')) && (await curIds(p)) === 'portfolio-overview', await curIds(p));
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok('W4 portfolio account menu opens', await p.evaluate(() => document.getElementById('userMenu').classList.contains('open')));
  ok('W4 portfolio no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/analysis-central.html'); await p.waitForTimeout(1500);
  ok('W4 analysis-central clock still runs', await p.evaluate(() => /Chicago/.test((document.getElementById('workspaceClock') || {}).textContent || '')));
  ok('W4 analysis-central collapse button labelled by nav', await p.evaluate(() => /navigation/i.test(document.getElementById('railCollapseBtn').getAttribute('aria-label'))));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/portfolio-advisor.html'); await p.waitForTimeout(1500);
  ok('W4 portfolio-advisor keeps page signOut/openSupport', await p.evaluate(() => typeof window.signOut === 'function' && typeof window.openSupport === 'function'));
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok('W4 portfolio-advisor account menu opens', await p.evaluate(() => document.getElementById('userMenu').classList.contains('open')));
  ok('W4 portfolio-advisor no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }

// W5. Wave 5 page specifics.
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/watchlist.html'); await p.waitForTimeout(1500);
  ok('W5 watchlist keeps its own header account menu (nav skips its own)', await p.evaluate(() => !!document.getElementById('user-menu-toggle') && !document.getElementById('userToggle')));
  ok('W5 watchlist Watchlists current', (await curIds(p)) === 'watchlists', await curIds(p));
  ok('W5 watchlist no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/arowana-trader.html'); await p.waitForTimeout(1500);
  ok('W5 arowana-trader keeps desktop top bar and coach sidebar', await p.evaluate(() => !!document.querySelector('.nav-links') && !!document.getElementById('coachSidebar') && !document.getElementById('railMount')));
  await p.evaluate(() => { location.hash = 'chat'; }); await p.waitForTimeout(300);
  ok('W5 arowana-trader hash tabs still work', await p.evaluate(() => document.getElementById('tab-chat').classList.contains('active')));
  ok('W5 arowana-trader no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const p = await newPage(mobile, null);
  await p.goto(BASE + '/arowana-trader.html'); await p.waitForTimeout(1500);
  await p.click('.anv-mobile-bar button[data-nav-slot="more"]'); await p.waitForTimeout(150);
  ok('W5 arowana-trader More sheet marks Wheel Coach', await p.evaluate(() => { const a = document.querySelector('#anvMoreSheet a[aria-current="page"]'); return !!a && a.getAttribute('data-nav-id') === 'wheel-coach'; }));
  await p.context().close(); }
for (const name of ['position-sizer', 'trade-plan-builder']) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + name + '.html'); await p.waitForTimeout(1500);
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok(`W5 ${name} account menu opens (page code + nav)`, await p.evaluate(() => document.getElementById('userMenu').classList.contains('open')));
  // This page has a saved name but no Supabase session, which the nav now
  // reports as an expired sign-in (stale_signin_check.mjs covers both cases).
  ok(`W5 ${name} account area painted (name, or "Sign in again" with no session)`, await p.evaluate(() => /synthetic|Sign in again/.test(document.getElementById('userName').textContent || '') && /synthetic|expired/.test(document.getElementById('menuUserEmail').textContent || '')));
  ok(`W5 ${name} no nav errors`, p._errors.length === 0, p._errors.join('; '));
  await p.context().close();
}
{ const p = await newPage(desktop, null);
  await p.context().addInitScript(() => { try { localStorage.setItem('tc_active_tab_v1', 'coach'); } catch (e) {} });
  await p.goto(BASE + '/ai-morning-brief.html?x=1'); await p.waitForTimeout(1800);
  const u = new URL(p.url());
  ok('W5 ai-morning-brief -> trading-command?view=brief, query kept', u.pathname === '/trading-command.html' && u.searchParams.get('view') === 'brief' && u.searchParams.get('x') === '1', p.url());
  const r = await p.evaluate(() => ({ cur: [...new Set([...document.querySelectorAll('[aria-current="page"][data-nav-id]')].map(n => n.getAttribute('data-nav-id')))].join(),
    tab: (document.querySelector('.trading-tab.active') || {}).dataset?.tab, brief: !!document.getElementById('dbRoot') && document.getElementById('dbRoot').getBoundingClientRect().top < innerHeight }));
  ok('W5 ?view=brief: Positions tab (even after Coach was last), brief on screen, menu marks Morning Brief', r.cur === 'command-brief' && r.tab === 'positions' && r.brief, JSON.stringify(r));
  await p.context().close(); }

// W6. Wave 6: trade-journal-pro.html.
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => { try { Object.keys(localStorage).filter(k => /^tj_.*tab/i.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
  await p.goto(BASE + '/trade-journal-pro.html?tab=stats'); await p.waitForTimeout(1500);
  ok('W6 journal: auth-guard.js not loaded', await p.evaluate(() => ![...document.scripts].some(s => /auth-guard/.test(s.src))));
  ok('W6 journal ?tab=stats -> Stats & Analysis current', (await curIds(p)) === 'journal-stats', await curIds(p));
  ok('W6 journal: only the new rail rendered', await p.evaluate(() => document.querySelectorAll('#railMount nav.rail-nav').length === 1 && !document.querySelector('#railMount a[href*="market-intelligence"]') && !document.querySelector('.mobile-bottom-nav')));
  await p.evaluate(() => { window.__noReload = 1; });
  await p.click('#railMount a[data-nav-id="journal-trades"]'); await p.waitForTimeout(400);
  ok('W6 journal: Trade Journal link switches to Stock tab in place', await p.evaluate(() => window.__noReload === 1 && document.getElementById('tab-stock').style.display !== 'none' && !/tab=/.test(location.search)) && (await curIds(p)) === 'journal-trades', await curIds(p));
  await p.click('#railMount a[data-nav-id="journal-stats"]'); await p.waitForTimeout(400);
  ok('W6 journal: Stats link in place, URL updated by page', await p.evaluate(() => window.__noReload === 1 && /tab=stats/.test(location.search)) && (await curIds(p)) === 'journal-stats');
  await p.click('#userToggle'); await p.waitForTimeout(150);
  ok('W6 journal account menu opens', await p.evaluate(() => document.getElementById('userMenu').classList.contains('open')));
  ok('W6 journal no nav errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }

// CO. Close-out: tool pages highlight their home section without aria-current.
const HOMES = { 'kelly-calculator': ['portfolio', 'portfolio'], 'dcf-analyzer': ['research', 'more'],
  'options-analyzer': ['desks', 'more'], 'r-multiple': ['journal', 'journal'], 'trade-plan-builder': ['command', 'command'],
  'tool-audit': ['research', 'more'] };
for (const [name, [group, slot]] of Object.entries(HOMES)) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + name + '.html'); await p.waitForTimeout(1200);
  const r = await p.evaluate(g => ({
    current: document.querySelectorAll('[aria-current="page"]').length,
    expanded: document.querySelector('#railMount [data-nav-group="' + g + '"]').classList.contains('expanded'),
    marked: !!document.querySelector('#railMount [data-nav-group="' + g + '"] .rail-item.anv-contains-current'),
  }), group);
  ok(`CO ${name}: home ${group} expanded + marked, no aria-current`, r.current === 0 && r.expanded && r.marked, JSON.stringify(r));
  await p.context().close();
  const m = await newPage(mobile, null);
  await m.goto(BASE + '/' + name + '.html'); await m.waitForTimeout(1200);
  ok(`CO ${name}: mobile ${slot} slot active`, await m.evaluate(sl => document.querySelector('.anv-mobile-bar [data-nav-slot="' + sl + '"]').classList.contains('active'), slot));
  await m.context().close();
}
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/options-analyzer.html'); await p.waitForTimeout(1200);
  ok('CO options-analyzer: Options desk children shown', await p.evaluate(() => !document.querySelector('#railMount [data-nav-nest="desk-options"]').hidden));
  await p.context().close(); }

// S. ATD-009 phase 1: pages without a sidebar get a renderer-built shell rail.
const SHELL = { 'swing-trader': [null, '.nav-links'], 'long-term-dashboard': ['desk-longterm', '.topbar nav'],   // null: hidden from the launch menu
  'my-rules': ['portfolio-rules', 'nav#nav'], 'data-hygiene-audit': ['journal-quality', null] };
for (const [name, [want, legacy]] of Object.entries(SHELL)) {
  const look = (p, sel) => p.evaluate(sel => {
    const shell = document.querySelector('aside.anv-shell');
    const leg = sel && document.querySelector(sel);
    return { shell: !!shell, shellVisible: !!(shell && getComputedStyle(shell).display !== 'none' && shell.getBoundingClientRect().width > 0),
      primaries: [...document.querySelectorAll('.anv-shell #railMount nav.rail-nav > .rail-group .rail-item-row > .rail-item .rail-item-label')].length,
      current: [...new Set([...document.querySelectorAll('[aria-current="page"][data-nav-id]')].map(n => n.getAttribute('data-nav-id')))],
      pad: parseFloat(getComputedStyle(document.body).paddingLeft), legacyShown: !!(leg && leg.offsetParent !== null),
      bar: !!document.querySelector('.anv-mobile-bar'), oldBar: !!document.querySelector('.mobile-bottom-nav'),
      overflow: document.documentElement.scrollWidth - window.innerWidth };
  }, sel);
  const d = await newPage(desktop, null);
  await d.goto(BASE + '/' + name + '.html'); await d.waitForTimeout(1200);
  const r = await look(d, legacy);
  ok(`S ${name} desktop shell rail`, r.shell && r.shellVisible && r.primaries === 6 && r.pad >= 248, JSON.stringify(r));
  ok(`S ${name} current = ${want}`, want === null ? r.current.length === 0 : (r.current.length === 1 && r.current[0] === want), JSON.stringify(r.current));
  if (legacy) ok(`S ${name} legacy top links hidden`, !r.legacyShown);
  ok(`S ${name} desktop no overflow`, r.overflow <= 1, String(r.overflow));
  const dErr = d._errors.slice(); await d.context().close();
  const m = await newPage(mobile, null);
  await m.goto(BASE + '/' + name + '.html'); await m.waitForTimeout(1200);
  const rm = await look(m, legacy);
  await m.context().close();
  const o = await newPage(mobile, '0');
  await o.goto(BASE + '/' + name + '.html'); await o.waitForTimeout(1200);
  const ro = await look(o, legacy); const oErr = o._errors.slice();
  await o.context().close();
  ok(`S ${name} mobile: bar, no shell, no overflow`, rm.bar && !rm.shellVisible && rm.pad < 248 && rm.overflow <= Math.max(1, ro.overflow), JSON.stringify(rm));
  ok(`S ${name} opt-out (mobile): no nav added`, !ro.shell && !ro.bar && !ro.oldBar, JSON.stringify(ro));
  const od = await newPage(desktop, '0');
  await od.goto(BASE + '/' + name + '.html'); await od.waitForTimeout(1000);
  const rod = await look(od, legacy); await od.context().close();
  ok(`S ${name} opt-out (desktop): own top nav back, no rail`, !rod.shell && rod.pad < 248 && (!legacy || rod.legacyShown), JSON.stringify(rod));
  const newErrs = dErr.filter(e => !oErr.includes(e));
  ok(`S ${name} no new page errors`, newErrs.length === 0, newErrs.join('; '));
}
{ const d = await newPage(desktop, null);
  await d.goto(BASE + '/swing-trader.html'); await d.waitForTimeout(1200);
  await d.click('.anv-shell #railCollapseBtn'); await d.waitForTimeout(300);
  const c = await d.evaluate(() => ({ collapsed: document.querySelector('aside.anv-shell').classList.contains('rail-collapsed'),
    pad: parseFloat(getComputedStyle(document.body).paddingLeft), w: document.querySelector('aside.anv-shell').getBoundingClientRect().width }));
  ok('S swing-trader collapse narrows rail and padding', c.collapsed && c.w <= 80 && c.pad <= 80, JSON.stringify(c));
  await d.click('.anv-shell #userToggle').catch(e => d._errors.push('no account toggle: ' + e.message.split('\n')[0]));
  await d.waitForTimeout(150);
  ok('S swing-trader shell account menu opens', await d.evaluate(() => { const m = document.querySelector('.anv-shell .user-menu'); return !!(m && m.classList.contains('open')); }));
  await d.context().close(); }

// L2. ATD-109: the old Features page (and its two retired twins) land on the
// home page's "What's inside", which describes what each plan includes.
for (const from of ['features', 'feature_body', 'feature_new']) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?x=1#screeners'); await p.waitForTimeout(900);
  const u = new URL(p.url());
  ok(`L2 ${from} -> index.html#inside`, u.pathname === '/index.html' && u.hash === '#inside', p.url());
  await p.context().close();
}
// L. ATD-009 phase 1: retired catalogues redirect, keeping query and hash.
for (const [from, to] of [['advanced-trading-tools', 'tools'], ['features-tools-directory', 'tools']]) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?x=1#screeners'); await p.waitForTimeout(800);
  const u = new URL(p.url());
  ok(`L ${from} -> ${to}.html keeps query + hash`, u.pathname === '/' + to + '.html' && u.search === '?x=1' && u.hash === '#screeners', p.url());
  await p.context().close();
}

// P2. ATD-009 phase 2: retired scanner pages open their scan in scanner.html.
for (const [from, id, label] of [['bb-snapback', 'bb_snapback', 'Bollinger Band Snapback'], ['gap-and-go', 'gap_scan', null],
  ['momentum-hunter-complete', 'my_movers', 'My Movers'], ['volume-spike', 'rvol_surge', 'Relative Volume Surge'], ['trade-scanner', 'swing_multi', 'Swing Multi-Signal']]) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?tickers=AAPL#x'); await p.waitForTimeout(1200);
  const u = new URL(p.url());
  const r = await p.evaluate(() => ({ title: document.getElementById('runTitle').textContent,
    active: (document.querySelector('.scan-item.active') || {}).dataset?.id || null,
    filters: document.querySelectorAll('#filterGrid .filter-field').length }));
  ok(`P2 ${from} -> scanner ?scan=${id}`, u.pathname === '/scanner.html' && u.searchParams.get('scan') === id && u.searchParams.get('tickers') === 'AAPL' && u.hash === '#x', p.url());
  ok(`P2 ${from} opens ${id}`, (!label || r.title === label) && (id === 'rvol_surge' || r.filters > 0) && (r.active === id || r.active === null), JSON.stringify(r));
  ok(`P2 ${from} no page errors`, p._errors.length === 0, p._errors.join('; '));
  await p.context().close();
}
for (const [from, path, scan] of [['my-rules-short', '/my-rules.html', null], ['risk-calculator', '/position-sizer.html', null],
  ['position-sizer_fresh', '/position-sizer.html', null], ['dividend-screener', '/scanner.html', 'dividend_safety'],
  ['automated-trading-plan', '/trade-plan-builder.html', null], ['news-trading', '/trade-plan-builder.html', null], ['stock-checker', '/intrinsic-value.html', null]]) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?a=1#h'); await p.waitForTimeout(1000);
  const u = new URL(p.url());
  ok(`P2 ${from} -> ${path}${scan ? '?scan=' + scan : ''} keeps query + hash`, u.pathname === path && u.searchParams.get('a') === '1' && u.hash === '#h' && (!scan || u.searchParams.get('scan') === scan), p.url());
  await p.context().close();
}
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/scanner.html?scan=nope'); await p.waitForTimeout(1000);
  const anyActive = await p.evaluate(() => !!document.querySelector('.scan-item.active'));
  ok('P2 unknown ?scan= ignored', p._errors.length === 0 && !anyActive);
  await p.context().close(); }

// R. ATD-009: long-term rules and habits merged into my-rules.html, reading the old keys.
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => {
    localStorage.setItem('my_rules_longterm_v1', JSON.stringify({ eqPct: '60', bondPct: '40', rebalanceBand: '7', rebalanceFreq: 'Quarterly',
      rulesBehavior: 'Never sell in a panic\nSecond rule', rulesTriggers: 'Review in January', savedAt: '2026-01-02T03:04:05Z' }));
    localStorage.setItem('my_rules_longterm_check', JSON.stringify({ ck1: true }));
    localStorage.setItem('gs_discipline_v1', JSON.stringify({ prefs: { carryForward: true }, scope: 'daily', streaks: {},
      items: { daily: [{ id: 'a1', t: '<img src=x onerror="window.__xss=1">Log trades', d: true, n: 'note <b>x</b>' }, { id: 'a2', t: 'Stop at -2R', d: false, n: '' }],
               weekly: [{ id: 'w1', t: 'Review week', d: false, n: '' }], monthly: [] } }));
  });
  await p.goto(BASE + '/my-rules-long.html'); await p.waitForTimeout(1200);
  const lt = await p.evaluate(() => ({ url: location.pathname + location.search,
    panel: !document.getElementById('mrPanelLongterm').hidden && document.getElementById('mrPanelTrading').hidden,
    eq: document.getElementById('ltEqPct').value, freq: document.getElementById('ltRebalanceFreq').value,
    behavior: document.getElementById('ltBehavior').value.split('\n')[0],
    checks: [...document.querySelectorAll('#ltChecklist input')].map(c => c.checked),
    first: document.querySelector('#ltChecklist li:nth-child(3) label').textContent,
    selected: document.querySelector('.mr-tabs [aria-selected="true"]').dataset.tab }));
  ok('R my-rules-long -> my-rules?tab=longterm with saved rules', lt.url === '/my-rules.html?tab=longterm' && lt.panel && lt.eq === '60' && lt.freq === 'Quarterly' &&
     lt.behavior === 'Never sell in a panic' && lt.checks.join() === 'false,true,false,false,false' && lt.first === 'Rules set: Never sell in a panic' && lt.selected === 'longterm', JSON.stringify(lt));
  await p.fill('#ltEqPct', '55'); await p.click('#ltSave'); await p.click('#lt_ck0');
  const saved = await p.evaluate(() => [JSON.parse(localStorage.getItem('my_rules_longterm_v1')).eqPct, JSON.parse(localStorage.getItem('my_rules_longterm_check')).ck0]);
  ok('R long-term save + tick use the old keys', saved[0] === '55' && saved[1] === true, JSON.stringify(saved));
  await p.goto(BASE + '/discipline-checklist.html'); await p.waitForTimeout(1200);
  const hb = await p.evaluate(() => ({ url: location.pathname + location.search, panel: !document.getElementById('mrPanelHabits').hidden,
    texts: [...document.querySelectorAll('#hbList .hb-text')].map(n => n.textContent), imgs: document.querySelectorAll('#hbList img').length,
    xss: !!window.__xss, daily: document.getElementById('hbKpiDaily').textContent, note: document.querySelector('#hbList .hb-note').value }));
  ok('R discipline-checklist -> my-rules?tab=habits with saved habits, text not HTML', hb.url === '/my-rules.html?tab=habits' && hb.panel &&
     hb.texts.length === 2 && hb.texts[0].startsWith('<img') && hb.imgs === 0 && !hb.xss && hb.daily === '50%' && hb.note === 'note <b>x</b>', JSON.stringify(hb));
  await p.fill('#hbNew', 'Journal before close'); await p.press('#hbNew', 'Enter');
  await p.click('.hb-scopes [data-scope="weekly"]');
  const after = await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('gs_discipline_v1'));
    return { daily: st.items.daily.length, scope: st.scope, prefs: st.prefs.carryForward, shown: document.querySelectorAll('#hbList .hb-item').length }; });
  ok('R habits add + period switch saved to gs_discipline_v1', after.daily === 3 && after.scope === 'weekly' && after.prefs === true && after.shown === 1, JSON.stringify(after));
  await p.click('.mr-tabs [data-tab="trading"]');
  ok('R Trading tab restores the original page and clears ?tab', await p.evaluate(() => !document.getElementById('mrPanelTrading').hidden && location.search === '' && !!document.getElementById('riskPct').offsetParent));
  ok('R my-rules no page errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const m = await newPage(mobile, null);
  await m.goto(BASE + '/my-rules.html?tab=habits'); await m.waitForTimeout(1200);
  ok('R my-rules habits tab: no horizontal overflow on mobile', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1));
  await m.context().close(); }

// V. ATD-009: valuation pages' models live in intrinsic-value.html's "More models".
for (const from of ['ai-valuation', 'intrinsic-value-rsi', 'long-term-intrinsic-value']) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?t=1#h'); await p.waitForTimeout(800);
  const u = new URL(p.url());
  ok(`V ${from} -> intrinsic-value.html keeps query + hash`, u.pathname === '/intrinsic-value.html' && u.search === '?t=1' && u.hash === '#h', p.url());
  await p.context().close();
}
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/intrinsic-value.html'); await p.waitForTimeout(1500);
  await p.fill('#price', '150'); await p.waitForTimeout(500);
  const before = await p.evaluate(() => ['gn','ri','epv','pe','fcf'].map(k => document.getElementById(k + 'Why').textContent));
  ok('V price only: each card says what it needs', before.every(t => t.length > 5), JSON.stringify(before));
  await p.click('#cardMore > summary');
  const set = async (id, v) => { await p.fill('#' + id, String(v)); };
  await set('price', 150); await set('eps', 6); await set('growth', 8); await set('years', 10); await set('discount', 9); await set('terminalMultiple', 15);
  await set('mxBvps', 24); await set('mxRoe', 20); await set('mxPayout', 25); await set('mxPhi', 0.5); await set('mxHair', 10); await set('mxPe', 18);
  await set('mxFcf', 9500); await set('mxShares', 1250); await set('mxNetDebt', 3000); await set('mxG1', 10); await set('mxG2', 4); await set('mxGt', 2.5);
  await p.waitForTimeout(600);
  const got = await p.evaluate(() => ({ gn: gnIV.textContent, ri: riIV.textContent, epv: epvIV.textContent, pe: peIV.textContent, fcf: fcfIV.textContent,
    fcfWhy: fcfWhy.textContent, peUp: peUpside.textContent,
    exp: { gn: computeGrahamNumber(6, 24).v, ri: computeResidualIncome(24, 0.2, 0.09, 0.25, 10, 0.5).v, epv: 6 * 0.9 / 0.09,
           fcf: computeFcfDcf(9500, 1250, 3000, 0.10, 0.04, 0.025, 0.09, 10).v } }));
  const money = v => '$' + v.toFixed(2);
  ok('V cards show the ported models', got.gn === money(got.exp.gn) && got.ri === money(got.exp.ri) && got.epv === money(got.exp.epv) &&
     got.pe === '$108.00' && got.peUp === '-28.0%' && got.fcf === money(got.exp.fcf) && /terminal value/.test(got.fcfWhy), JSON.stringify(got));
  await set('mxGt', 9.5); await p.waitForTimeout(500);
  ok('V FCF DCF refuses terminal growth >= discount, with the reason', await p.evaluate(() => fcfIV.textContent === '—' && /below the discount rate/.test(fcfWhy.textContent)));
  await set('mxNetDebt', 999999); await set('mxGt', 2.5); await p.waitForTimeout(500);
  ok('V negative value is named, not shown as a positive price', await p.evaluate(() => fcfIV.textContent === '—' && /at or below zero/.test(fcfWhy.textContent)));
  const snap = await p.evaluate(() => { const o = ivSnapshot(); return [o.mxBvps, o.mxFcf, o.mxPe]; });
  ok('V saved valuations keep the new inputs', snap.join() === '24,9500,18', snap.join());
  ok('V intrinsic-value no page errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const m = await newPage(mobile, null);
  await m.goto(BASE + '/intrinsic-value.html'); await m.waitForTimeout(1200);
  await m.click('#cardMore > summary'); await m.waitForTimeout(200);
  ok('V More models: no horizontal overflow on mobile', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1));
  await m.context().close(); }

// AI. ATD-009: stock-analyzer + chart-analysis-form merged into analysis-central's AI Analysis tab.
{ const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const p = await newPage(desktop, null);
  const calls = [];
  let mode = 'ok';
  await p.route('https://n8n.example.test/**', async r => {
    calls.push({ url: r.request().url(), body: JSON.parse(r.request().postData() || '{}') });
    if (mode === 'fail') return r.fulfill({ status: 500, body: 'boom' });
    if (r.request().url().includes('analyze')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ json: {
      ticker: 'MSFT', fundamentals: 8, valuation: 6, technical: 7, market: 7.5, strategy: '<b>Buy in stages</b>', summary: 'Solid.',
      insights: ['<img src=x onerror="window.__x=1">One', 'Two'] } }]) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: {
      verdict: 'Bullish', entry: '101.5', stop: '99', target1: '105', rr: '2.1', summary: '<script>window.__y=1</script>Higher lows' } }) });
  });
  await p.goto(BASE + '/stock-analyzer.html?ticker=msft'); await p.waitForTimeout(1600);
  const s0 = await p.evaluate(() => ({ url: location.pathname + location.search, active: document.getElementById('aiTab').classList.contains('active'),
    sym: document.getElementById('aiSymbol').value }));
  ok('AI stock-analyzer -> analysis-central?tab=ai, ticker carried', s0.url === '/analysis-central.html?tab=ai&ticker=msft' && s0.active && s0.sym === 'MSFT', JSON.stringify(s0));
  await p.click('#aiScoreRun'); await p.waitForTimeout(300);
  ok('AI scorecard with no webhook says so and shows nothing made up', await p.evaluate(() =>
    /not connected/.test(aiScoreStatus.textContent) && document.getElementById('aiScoreResult').hidden) && calls.length === 0);
  await p.evaluate(() => localStorage.setItem('arowana_analyzer_webhook_url', 'http://n8n.example.test/webhook/analyze'));
  await p.click('#aiScoreRun'); await p.waitForTimeout(300);
  ok('AI scorecard ignores a non-https saved URL', calls.length === 0);
  await p.evaluate(() => localStorage.setItem('arowana_analyzer_webhook_url', 'https://n8n.example.test/webhook/analyze'));
  await p.selectOption('#aiMode', 'options'); await p.fill('#aiNotes', 'check IV');
  await p.click('#aiScoreRun'); await p.waitForTimeout(800);
  const s1 = await p.evaluate(() => ({ text: aiScoreResult.innerText, imgs: aiScoreResult.querySelectorAll('img').length + [...aiScoreResult.querySelectorAll('b')].filter(b => /Buy in stages/.test(b.textContent)).length, x: !!window.__x,
    pill: aiScoreResult.querySelector('.ai-pill').textContent, hist: JSON.parse(localStorage.getItem('ac_ai_scorecard_history_v1') || '[]').length }));
  ok('AI scorecard sends the old payload', calls.length === 1 && JSON.stringify(calls[0].body) === JSON.stringify({ ticker: 'MSFT', mode: 'options', timeframe: '1-3y', notes: 'check IV' }), JSON.stringify(calls[0] && calls[0].body));
  ok('AI scorecard renders scores; webhook HTML stays text', s1.pill === 'Neutral · 7.1' && /<b>Buy in stages<\/b>/.test(s1.text) && /onerror/.test(s1.text) && s1.imgs === 0 && !s1.x && s1.hist === 1, JSON.stringify(s1));
  mode = 'fail'; await p.click('#aiScoreRun'); await p.waitForTimeout(600);
  ok('AI scorecard error is reported, no demo fallback', await p.evaluate(() => /HTTP 500/.test(aiScoreStatus.textContent) && aiScoreStatus.className.includes('err')));
  mode = 'ok';
  // Chart analysis
  await p.evaluate(() => localStorage.setItem('arowana_chart_webhook_url', 'https://n8n.example.test/webhook/chart'));
  await p.setInputFiles('#aiChartFile', { name: 'c.png', mimeType: 'image/png', buffer: PNG });
  await p.setInputFiles('#aiChartFile', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await p.waitForTimeout(300);
  await p.click('#aiChartInd .ai-chip:first-child');
  const before = calls.length;
  await p.click('#aiChartRun'); await p.waitForTimeout(1000);
  const c1 = await p.evaluate(() => ({ thumbs: aiChartThumbs.querySelectorAll('img').length, pill: aiChartResult.querySelector('.ai-pill').textContent,
    entry: aiChartResult.querySelectorAll('.ai-level b')[0].textContent, y: !!window.__y, scripts: aiChartResult.querySelectorAll('script').length,
    hist: JSON.parse(localStorage.getItem('arowana_chart_history_v2') || '[]'), scans: localStorage.getItem('ap_chart_scan_count') }));
  const body = calls[before] && calls[before].body;
  ok('AI chart sends the old payload shape with the image', body && /^data:image\/png/.test(body.chartImage) && body.ticker === 'MSFT' && body.indicators[0] === 'VWAP' &&
     body.timeframe === '15m' && body.imageCount === 1 && body.source === 'analysis-central', JSON.stringify(body && Object.keys(body)));
  ok('AI chart renders levels; text-only, history + scan count saved', c1.thumbs === 1 && c1.pill === 'Bullish' && c1.entry === '$101.5' && !c1.y && c1.scripts === 0 &&
     c1.hist.length === 1 && /^data:image\/jpeg/.test(c1.hist[0].thumb || '') && c1.scans === '1', JSON.stringify({ ...c1, hist: c1.hist.length }));
  await p.evaluate(() => { localStorage.setItem('ap_chart_scan_count', '5'); localStorage.setItem('ap_chart_scan_date', new Date().toISOString().slice(0, 10)); });
  const n = calls.length; await p.click('#aiChartRun'); await p.waitForTimeout(300);
  ok('AI chart daily free limit kept', calls.length === n && await p.evaluate(() => /free chart analyses/.test(aiChartStatus.textContent)));
  ok('AI analysis-central no page errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
{ const p = await newPage(desktop, null);
  await p.addInitScript(() => localStorage.setItem('arowana_chart_history_v2', JSON.stringify([
    { ts: new Date().toISOString(), ticker: '<img src=x onerror="window.__z=1">', tf: '1d', verdict: 'Bearish', summary: 'old', thumb: 'javascript:alert(1)', raw: { verdict: 'Bearish' } }])));
  await p.goto(BASE + '/chart-analysis-form.html'); await p.waitForTimeout(1500);
  const h = await p.evaluate(() => ({ url: location.pathname + location.search, items: aiChartHist.querySelectorAll('li').length, imgs: aiChartHist.querySelectorAll('img').length, z: !!window.__z }));
  ok('AI chart-analysis-form -> ?tab=ai; old history shown as text, unsafe thumb dropped', h.url === '/analysis-central.html?tab=ai' && h.items === 1 && h.imgs === 0 && !h.z, JSON.stringify(h));
  await p.context().close(); }
{ const m = await newPage(mobile, null);
  await m.goto(BASE + '/analysis-central.html?tab=ai'); await m.waitForTimeout(1500);
  ok('AI tab: no horizontal overflow on mobile', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1 && document.getElementById('aiTab').classList.contains('active')));
  await m.context().close(); }

// Q. ATD-009: quality-screener -> Quality Compounders scan; buy-sell-signal -> Trade Plan Builder signal check.
{ const p = await newPage(desktop, null);
  const calls = [];
  await p.route('https://n8n.example.test/**', async r => {
    calls.push({ url: r.request().url(), body: JSON.parse(r.request().postData() || '{}') });
    if (r.request().url().includes('quality')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [
      { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', price: 430, mcapB: 3300, roic: 28, gm: 69, fcfm: 34, rev5: 14, eps5: 18, de: 0.4, ic: 48, pe: 35, evebit: 27, pfcf: 31, yield: 0.7, fscore: 8, zscore: 8.5, adr: false },
      { ticker: 'AAPL', name: '<img src=x onerror="window.__q=1">Apple', sector: 'Technology', price: 230, mcapB: 3600, roic: 33, gm: 45, fcfm: 26, rev5: 8, eps5: 11, de: 1.7, ic: 35, pe: 32, evebit: 25, pfcf: 28, yield: 0.5, fscore: 7, zscore: 7.1, adr: false },
      { ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', price: 160, mcapB: 380, roic: 19, gm: 51, fcfm: 17, rev5: 5, eps5: 8, de: 0.6, ic: 20, pe: 26, evebit: 22, pfcf: 24, yield: 2.5, fscore: 7, zscore: 5.0, adr: false } ] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signal: 'BUY', entry_price: 100, target_price: 112, stop_loss: 95,
      support_level: 94, confidence: 72, score: 70, trend: 'uptrend', reason: '<b>Breakout</b> over resistance', warnings: ['<img src=x onerror="window.__s=1">Earnings in 3 days'] }) });
  });
  await p.addInitScript(() => { window.__setWH = () => { window.AP_WEBHOOKS = Object.assign(window.AP_WEBHOOKS || {}, {
    quality_screener: 'https://n8n.example.test/webhook/quality', signal: 'https://n8n.example.test/webhook/signal' }); }; });
  await p.goto(BASE + '/quality-screener.html'); await p.waitForTimeout(1600);
  const q0 = await p.evaluate(() => ({ url: location.pathname + location.search, title: runTitle.textContent, filters: document.querySelectorAll('#filterGrid .filter-field').length }));
  ok('Q quality-screener -> scanner ?scan=quality_compounders with its filters', q0.url === '/scanner.html?scan=quality_compounders' && q0.title === 'Quality Compounders' && q0.filters === 18, JSON.stringify(q0));
  await p.evaluate(() => window.__setWH());
  await p.click('#runBtn'); await p.waitForTimeout(1200);
  const q1 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#resultsBody tr, .results-table tbody tr')].map(t => t.querySelector('td strong') && t.querySelector('td strong').textContent).filter(Boolean),
    imgs: document.querySelectorAll('#resultsBody img, .results-table tbody img').length, x: !!window.__q }));
  ok('Q quality scan posts {index,tickers,sector} and ranks with the old formula', calls.length === 1 && calls[0].body.index === 'SP500' && calls[0].body.tickers === null &&
     q1.rows.join() === 'MSFT,PG' && q1.imgs === 0 && !q1.x, JSON.stringify({ q1, body: calls[0] && calls[0].body }));
  await p.goto(BASE + '/buy-sell-signal.html?ticker=nvda'); await p.waitForTimeout(1500);
  const s0 = await p.evaluate(() => ({ url: location.pathname + location.search, sym: document.getElementById('symbol').value }));
  ok('Q buy-sell-signal -> trade-plan-builder, ticker carried', s0.url === '/trade-plan-builder.html?ticker=nvda' && s0.sym === 'NVDA', JSON.stringify(s0));
  const before = calls.length;
  await p.evaluate(() => { window.AP_WEBHOOKS = Object.assign(window.AP_WEBHOOKS || {}, { signal: '' }); try { localStorage.removeItem('ap_wh_signal'); } catch (e) {} });
  await p.click('#sigBtn'); await p.waitForTimeout(300);
  ok('Q signal check with no webhook: no request, no proposal', calls.length === before && await p.evaluate(() => document.getElementById('sigProposal').hidden));
  await p.evaluate(() => window.__setWH());
  await p.click('#sigOpts > summary'); await p.check('#sigDeep');
  await p.click('#sigBtn'); await p.waitForTimeout(800);
  const s1 = await p.evaluate(() => ({ shown: !document.getElementById('sigProposal').hidden, text: sigProposalBody.textContent,
    imgs: sigProposalBody.querySelectorAll('img').length + [...sigProposalBody.querySelectorAll('b')].filter(b => b.textContent === 'Breakout').length, s: !!window.__s }));
  const sb = calls[calls.length - 1].body;
  ok('Q signal check sends the old payload', sb.ticker === 'NVDA' && sb.timeframe === '1d' && sb.deep === true && sb.quick === false, JSON.stringify(sb));
  ok('Q signal shown as text with R:R and warnings', s1.shown && /BUY/.test(s1.text) && /1:2\.4/.test(s1.text) && /<b>Breakout<\/b>/.test(s1.text) && /onerror/.test(s1.text) && !s1.s &&
     s1.imgs === 0, JSON.stringify(s1));
  await p.click('#sigApplyBtn'); await p.waitForTimeout(300);
  const s2 = await p.evaluate(() => ({ e: entryPrice.value, st: stopPrice.value, t: targetPrice.value, dir: document.querySelector('[data-direction].active').dataset.direction, th: thesis.value }));
  ok('Q Use these levels fills the plan', s2.e === '100' && s2.st === '95' && s2.t === '112' && s2.dir === 'long' && /Breakout/.test(s2.th), JSON.stringify(s2));
  ok('Q no page errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }

// P3. ATD-009 phase 3: retired dashboard and options pages.
for (const [from, path, q] of [['daytrade', '/trading-command.html', ''], ['ai-trading-agent', '/arowana-trader.html', ''], ['earning-watcher', '/trading-command.html', ''],
  ['sector-sentiment', '/trading-command.html', ''], ['sector-sentiment-gauge', '/trading-command.html', ''], ['option-recommender', '/options-hub.html', 'calls'],
  ['option-trader', '/options-hub.html', 'analyzer'], ['wheel_strategy_web_tool', '/wheel-strategy.html', 'import']]) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?x=1#h'); await p.waitForTimeout(1200);
  const u = new URL(p.url());
  ok(`P3 ${from} -> ${path}${q ? '?tab=' + q : ''} keeps query + hash`, u.pathname === path && u.searchParams.get('x') === '1' && u.hash === '#h' && (!q || u.searchParams.get('tab') === q), p.url());
  if (from === 'wheel_strategy_web_tool') ok('P3 wheel-strategy opens the Import tab from ?tab=import', await p.evaluate(() => document.getElementById('importTab').classList.contains('active')));
  await p.context().close();
}

// P3b. ATD-009 phase 3: short-term-dashboard saved signals, plus three owner-approved retirements.
{ const p = await newPage(desktop, null);
  await p.goto(BASE + '/short-term-dashboard.html'); await p.waitForTimeout(1000);
  ok('P3b short-term-dashboard with no saved signals -> trading-command', new URL(p.url()).pathname === '/trading-command.html', p.url());
  await p.evaluate(() => { localStorage.removeItem('ap_saved_signals_seen_v1'); localStorage.setItem('arowana_journal_v1', JSON.stringify([
    { id: 2, date: '2026-09-01T10:00:00Z', symbol: 'NVDA', entry: '$100.25', stop: '$97.80', targets: '$105.50 / $110', setup: 'Quick Signal', source: 'dashboard', notes: '' },
    { id: 1, date: '2026-08-15T10:00:00Z', ticker: '<img src=x onerror="window.__j=1">amd', direction: 'short', entry_price: 150, stop_loss: 156, exit_price: 140, notes: 'Lower highs' } ])); });
  await p.goto(BASE + '/short-term-dashboard.html'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ path: location.pathname, shown: !document.getElementById('savedSignals').hidden,
    rows: [...document.querySelectorAll('#savedSignalsList li strong')].map(n => n.textContent), imgs: document.querySelectorAll('#savedSignalsList img').length, j: !!window.__j,
    seen: localStorage.getItem('ap_saved_signals_seen_v1') }));
  ok('P3b first visit with saved signals -> plan builder card lists them safely', r.path === '/trade-plan-builder.html' && r.shown && r.rows.join() === 'NVDA,IMGSRCXONE' && r.imgs === 0 && !r.j && r.seen === '1', JSON.stringify(r));
  await p.click('#savedSignalsList li:nth-child(2) button'); await p.waitForTimeout(300);
  const f = await p.evaluate(() => ({ sym: symbol.value, e: entryPrice.value, st: stopPrice.value, t: targetPrice.value, dir: document.querySelector('[data-direction].active').dataset.direction }));
  await p.click('#savedSignalsList li:nth-child(1) button'); await p.waitForTimeout(300);
  const f1 = await p.evaluate(() => ({ e: entryPrice.value, st: stopPrice.value, t: targetPrice.value }));
  ok('P3b Plan it parses both saved shapes', f.e === '150' && f.st === '156' && f.t === '140' && f.dir === 'short' && f1.e === '100.25' && f1.st === '97.8' && f1.t === '105.5', JSON.stringify({ f, f1 }));
  await p.goto(BASE + '/short-term-dashboard.html?x=1#h'); await p.waitForTimeout(1000);
  const u = new URL(p.url());
  ok('P3b later visits -> trading-command, query + hash kept', u.pathname === '/trading-command.html' && u.search === '?x=1' && u.hash === '#h', p.url());
  ok('P3b saved signals untouched', await p.evaluate(() => JSON.parse(localStorage.getItem('arowana_journal_v1')).length === 2));
  ok('P3b no page errors', p._errors.length === 0, p._errors.join('; '));
  await p.context().close(); }
for (const [from, path, q] of [['daily-bias', '/trade-plan-builder.html', ''], ['daily-summary', '/trading-command.html', ''], ['option-roll-analyzer', '/options-hub.html', 'roll']]) {
  const p = await newPage(desktop, null);
  await p.goto(BASE + '/' + from + '.html?x=1#h'); await p.waitForTimeout(1000);
  const u = new URL(p.url());
  ok(`P3b ${from} -> ${path}${q ? '?tab=' + q : ''}`, u.pathname === path && u.searchParams.get('x') === '1' && u.hash === '#h' && (!q || u.searchParams.get('tab') === q), p.url());
  await p.context().close();
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
