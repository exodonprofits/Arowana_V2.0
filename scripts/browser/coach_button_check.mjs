// Trading Command's phone AI Coach button: a round button above the bottom
// bar (clear of the iPhone home indicator), hidden on the Coach tab, tucked
// away while scrolling down or typing, and never sitting on the page's last
// content.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/coach_button_check.mjs
//
// Synthetic session (fake Supabase); every non-localhost request aborted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
async function open(width = 375, query = '?tab=positions') {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile });
  await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1' } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/trading-command.html' + query, { waitUntil: 'load' });
  await p.waitForSelector('.anv-mobile-bar', { timeout: 8000 }).catch(() => {});
  await sleep(800);
  return { ctx, p, errors };
}
const btn = p => p.evaluate(() => {
  const b = document.getElementById('mobileCoachShortcut');
  if (!b) return null;
  const r = b.getBoundingClientRect(), s = getComputedStyle(b);
  const bar = document.querySelector('.anv-mobile-bar');
  return { shown: s.display !== 'none' && s.opacity !== '0' && s.pointerEvents !== 'none', w: r.width, h: r.height, bottom: r.bottom,
    barTop: bar ? bar.getBoundingClientRect().top : null, tucked: b.classList.contains('is-tucked'),
    label: b.getAttribute('aria-label'), text: b.innerText.trim() };
});

{
  const { ctx, p, errors } = await open();
  const b = await btn(p);
  check('phone: coach button shown on Positions', b && b.shown, b);
  check('phone: round 52px button with an accessible name', b && Math.round(b.w) === 52 && Math.round(b.h) === 52 && b.label === 'Open the Wheel Coach', b);
  check('phone: button sits above the bottom bar, not on it', b && b.barTop !== null && b.bottom <= b.barTop - 8, b);
  const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
  check('phone: page leaves room under its last row for bar + button', pad >= 132, pad);

  await p.evaluate(() => window.scrollTo(0, 600));
  await sleep(400);
  await p.evaluate(() => window.scrollTo(0, 900));
  await sleep(500);
  check('phone: tucked away while scrolling down', (await btn(p)).tucked && !(await btn(p)).shown, await btn(p));
  await p.evaluate(() => window.scrollTo(0, 500));
  await sleep(500);
  check('phone: back on scroll up', !(await btn(p)).tucked && (await btn(p)).shown, await btn(p));

  await p.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  const typed = await p.evaluate(() => {
    const i = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea')].find(e => e.offsetParent);
    if (!i) return null;
    i.focus({ preventScroll: true });
    return true;
  });
  await sleep(300);
  check('phone: tucked away while typing in a field', typed && (await btn(p)).tucked, await btn(p));
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  await sleep(400);
  check('phone: back after typing ends', !(await btn(p)).tucked, await btn(p));

  await p.evaluate(() => typeof switchTab === 'function' && switchTab('coach'));
  await sleep(400);
  check('phone: hidden on the Coach tab (it has its own coach link)', !(await btn(p)).shown, await btn(p));
  await p.evaluate(() => { typeof switchTab === 'function' && switchTab('positions'); window.scrollTo(0, 0); });
  await sleep(400);
  check('phone: shown again on Positions', (await btn(p)).shown, await btn(p));
  check('phone: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  // Home-screen app on an iPhone: the bar grows by the home-indicator inset,
  // so the button must rise by the same inset (env() is 0 in this browser).
  const { ctx, p } = await open();
  const css = await p.evaluate(() => [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch (e) { return []; } })
    .flatMap(r => r.cssRules ? [...r.cssRules] : [r]).map(r => r.cssText).join('\n'));
  check('phone: button and bar both allow for the home-indicator inset',
    /\.mobile-ai-coach-shortcut[^}]*bottom: calc\(72px \+ env\(safe-area-inset-bottom\)\)/.test(css) &&
    /\.anv-mobile-bar[^}]*env\(safe-area-inset-bottom\)/.test(css));
  await ctx.close();
}
{
  const { ctx, p } = await open(375, '?tab=coach');
  check('phone, opened on ?tab=coach: button hidden', !(await btn(p)).shown, await btn(p));
  await ctx.close();
}
{
  const { ctx, p } = await open(1280);
  check('desktop: no floating coach button', !(await btn(p)).shown, await btn(p));
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
