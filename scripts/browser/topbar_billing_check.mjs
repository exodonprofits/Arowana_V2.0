// Account-area and shell pages: the page's own site header becomes the white
// Trading Command bar on phones and is hidden on desktop (the rail carries
// the brand) for signed-in members; visitors keep the original header.
// Billing reads Arowana's plan columns and offers the plans on sale.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/topbar_billing_check.mjs
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

const PAGES = ['account.html', 'billing.html', 'broker-connections.html', 'asset-allocation-builder.html', 'buy-a-home.html',
  'college-savings.html', 'dca-planner.html', 'long-term-dashboard.html', 'my-rules.html', 'pick-my-mix.html',
  'retirement-calculator.html', 'retirement-planner.html'];

const browser = await chromium.launch();
async function open(file, { width = 375, signedIn = true, profile } = {}) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile });
  if (signedIn) await installFakeSupabase(ctx, profile ? { profiles: [profile] } : {}, { localStorage: { ap_onboarded_v1: '1' } });
  else await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + file, { waitUntil: 'load' });
  await sleep(900);
  return { ctx, p, errors };
}
const bar = p => p.evaluate(() => {
  const e = document.querySelector('[data-nav-topbar]');
  if (!e) return null;
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  const brand = [...e.querySelectorAll('a,span,div')].find(x => x.offsetParent && /Arowana/.test(x.textContent) && x.children.length <= 2);
  return { shown: s.display !== 'none' && r.height > 0, bg: s.backgroundColor, img: s.backgroundImage, h: Math.round(r.height),
    brandColor: brand ? getComputedStyle(brand).color : null };
});

for (const file of PAGES) {
  {
    const { ctx, p, errors } = await open(file);
    const b = await bar(p);
    check(`${file} phone, member: white top bar with blue brand`, b && b.shown && b.bg === 'rgb(255, 255, 255)' && b.img === 'none' &&
      b.brandColor === 'rgb(23, 78, 113)', b);
    check(`${file} phone: no page errors`, errors.filter(e => !/Chart is not defined/.test(e)).length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(file, { width: 1280 });
    const b = await bar(p);
    check(`${file} desktop, member: no second brand bar beside the rail`, b && !b.shown, b);
    await ctx.close();
  }
}
for (const file of ['retirement-calculator.html', 'dca-planner.html']) {
  const { ctx, p } = await open(file, { signedIn: false });
  const b = await bar(p);
  check(`${file} visitor: keeps the page's own header`, b && b.shown && b.bg !== 'rgb(255, 255, 255)', b);
  await ctx.close();
}
{
  const { ctx, p } = await open('long-term-dashboard.html');
  check('long-term-dashboard member: old header user menu hidden (the rail has the account menu)',
    await p.evaluate(() => { const u = document.getElementById('v1UserDrop'); return !u || !u.closest('[data-nav-legacy]') ? false : u.getBoundingClientRect().height === 0; }));
  await ctx.close();
}

// Billing
const renews = '2026-11-05T00:00:00Z';
const prof = plan => ({ id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_plan_renews_at: renews,
  arowana_stripe_subscription_id: 'sub_synthetic', created_at: '2026-09-01T00:00:00Z' });
{
  const { ctx, p, errors } = await open('billing.html', { profile: prof('pro') });
  check('billing, Pro member: shows Pro, not Free', await until(async () => (await p.textContent('#planName')) === 'Pro'), await p.textContent('#planName'));
  check('billing: status and renewal come from the arowana_* columns',
    /active/i.test(await p.textContent('#planBadge')) && /2026/.test(await p.textContent('#metaRenews')), [await p.textContent('#planBadge'), await p.textContent('#metaRenews')]);
  const tiles = await p.evaluate(() => [...document.querySelectorAll('#upgradeGrid .upgrade-tile')].map(t => ({
    name: t.querySelector('h4').textContent, current: t.classList.contains('current'), href: (t.querySelector('a') || {}).getAttribute ? t.querySelector('a').getAttribute('href') : null })));
  check('billing: tiles are the plans on sale (Free, Pro, Founding Member), no Elite',
    JSON.stringify(tiles.map(t => t.name)) === '["Free","Pro","Founding Member"]', tiles);
  check('billing: Pro tile marked current; Founding goes to its checkout',
    tiles.find(t => t.name === 'Pro')?.current && tiles.find(t => t.name === 'Founding Member')?.href === 'checkout.html?plan=founders', tiles);
  const card = await p.evaluate(() => document.querySelector('.subscription-status').getBoundingClientRect().height);
  check('billing phone: plan card is not a tall empty box', card < 200, card);
  check('billing: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open('billing.html', { profile: prof('founders') });
  check('billing, Founder: shows Founding Member, Founding tile current',
    await until(async () => (await p.textContent('#planName')) === 'Founding Member') &&
    await p.evaluate(() => [...document.querySelectorAll('#upgradeGrid .upgrade-tile.current h4')].map(h => h.textContent).join() === 'Founding Member'));
  await ctx.close();
}
{
  const { ctx, p } = await open('billing.html', { profile: { ...prof('free'), plan: 'pro' } });
  check('billing: another product\'s "plan" column is ignored', await until(async () => (await p.textContent('#planName')) === 'Free') &&
    !(await p.evaluate(() => (document.getElementById('planName').textContent) === 'Pro')));
  await ctx.close();
}

{
  // "Open billing portal" calls the deployed arowana-billing-portal function
  // with the user's token and goes to the URL it returns.
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  let seen = null;
  await installFakeSupabase(ctx, { profiles: [prof('pro')] }, { localStorage: { ap_onboarded_v1: '1' }, functions: {
    'arowana-billing-portal': async ({ body, headers }) => { seen = { body, auth: headers.authorization || headers.Authorization || '' };
      return { status: 200, json: { url: BASE + '/support.html?portal=1' } }; } } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/billing.html', { waitUntil: 'load' });
  await sleep(800);
  await p.click('#portalBtn');
  const went = await p.waitForURL(/support\.html\?portal=1/, { timeout: 6000 }).then(() => true).catch(() => false);
  check('billing: "Open billing portal" calls arowana-billing-portal with the session and opens the portal', went && !!seen &&
    /^Bearer /.test(seen.auth) && /billing\.html/.test(JSON.stringify(seen.body)), seen);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
