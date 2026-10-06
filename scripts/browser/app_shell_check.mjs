// Every signed-in page has the same navigation: the account pages and the
// Long-Term tools now show the shared rail (desktop) and bottom bar (phone)
// to signed-in members, and keep their own header for visitors. Sign Out
// works on pages that define no signOut() of their own, phone form fields
// are 16px (no iPhone zoom on focus), and no page links outside the site
// folder with "../".
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/app_shell_check.mjs
//
// Synthetic session (fake Supabase); every non-localhost request aborted.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, REF } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}

const MEMBER = ['account.html', 'billing.html', 'broker-connections.html', 'retirement-planner.html',
  'retirement-calculator.html', 'withdrawal-planner.html', 'tax-advantaged-guide.html', 'asset-allocation-builder.html',
  'etf-core-screener.html', 'fee-analyzer.html', 'ips-builder.html', 'dca-planner.html', 'factor-tilt-planner.html',
  'pick-my-mix.html', 'risk-quiz.html', 'buy-a-home.html', 'college-savings.html', 'education-529-planner.html',
  'real-estate-analyzer.html'];
// Chart.js comes from a CDN, which the check blocks.
const realErrors = errs => errs.filter(e => !/Chart is not defined/.test(e));

const browser = await chromium.launch();
async function open(file, { width = 375, signedIn = true } = {}) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile });
  if (signedIn) await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1' } });
  else await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + file, { waitUntil: 'load' });
  await p.waitForFunction(() => document.body.classList.contains('anv-v2') || document.readyState === 'complete');
  await p.waitForTimeout(700);
  return { ctx, p, errors };
}
const state = p => p.evaluate(() => {
  const vis = e => { if (!e) return false; const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
  return {
    bar: vis(document.querySelector('.anv-mobile-bar')),
    rail: vis(document.querySelector('.anv-shell .rail-nav')),
    legacyShown: [...document.querySelectorAll('[data-nav-legacy]')].filter(vis).length,
    legacyTotal: document.querySelectorAll('[data-nav-legacy]').length,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
});

for (const file of MEMBER) {
  {
    const { ctx, p, errors } = await open(file);
    const s = await state(p);
    check(`${file} phone, signed in: bottom bar shown, old site links hidden, no sideways scroll`,
      s.bar && s.legacyShown === 0 && s.overflow <= 1, s);
    const small = await p.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]),select,textarea')]
      .filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id || e.name || e.tagName));
    check(`${file} phone: form fields are at least 16px`, small.length === 0, small);
    check(`${file} phone: no page errors`, realErrors(errors).length === 0, errors);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(file, { width: 1280 });
    const s = await state(p);
    check(`${file} desktop, signed in: shared rail shown, old site links hidden`, s.rail && s.legacyShown === 0 && s.overflow <= 1, s);
    await ctx.close();
  }
}

// Visitors keep the page's own header on public calculators and get no app nav.
for (const file of ['retirement-calculator.html', 'dca-planner.html', 'asset-allocation-builder.html']) {
  const { ctx, p } = await open(file, { signedIn: false });
  const s = await state(p);
  check(`${file} signed out: no app navigation; own header kept`, !s.bar && !s.rail && s.legacyTotal > 0 && await p.evaluate(() => !document.body.classList.contains('anv-v2')), s);
  await ctx.close();
}

// Logos that pointed at ../shared/images now load.
for (const file of ['buy-a-home.html', 'college-savings.html', 'dca-planner.html', 'pick-my-mix.html']) {
  const { ctx, p } = await open(file, { signedIn: false });
  const ok = await p.evaluate(() => { const i = document.querySelector('img.logo-img'); return !!i && i.complete && i.naturalWidth > 0; });
  check(`${file}: logo loads`, ok);
  await ctx.close();
}

// Sign Out on a page with no signOut() of its own (Tools) ends the local session.
{
  const { ctx, p } = await open('tools.html');
  await ctx.route(/\/login\.html/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>login</title>' }));
  check('tools.html: page defines no signOut() (fallback path)', await p.evaluate(() => typeof window.signOut !== 'function'));
  p.on('dialog', d => d.accept());
  await p.click('[data-nav-slot="more"]');
  await p.click('.anv-sheet button.danger');
  await p.waitForURL(/login\.html/, { timeout: 5000 }).catch(() => {});
  const after = await p.evaluate(ref => ({ url: location.pathname, token: localStorage.getItem(`sb-${ref}-auth-token`), user: localStorage.getItem('gs_auth_user_v1') }), REF);
  check('tools.html phone: More → Sign Out goes to sign-in and clears the stored session', /login\.html$/.test(after.url) && !after.token && !after.user, after);
  await ctx.close();
}
{
  const { ctx, p } = await open('tools.html');
  p.on('dialog', d => d.dismiss());
  await p.click('[data-nav-slot="more"]');
  await p.click('.anv-sheet button.danger');
  await p.waitForTimeout(400);
  check('tools.html: cancelling the sign-out prompt keeps you signed in', /tools\.html$/.test(new URL(p.url()).pathname) && await p.evaluate(ref => !!localStorage.getItem(`sb-${ref}-auth-token`), REF));
  await ctx.close();
}

// Phone form fields on an existing nav page (Intrinsic Value had 34 under 16px).
{
  const { ctx, p } = await open('intrinsic-value.html');
  const small = await p.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea')]
    .filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length);
  check('intrinsic-value.html phone: every form field is 16px or larger', small === 0, small);
  check('intrinsic-value.html phone: no sideways scroll', (await state(p)).overflow <= 1);
  await ctx.close();
}
{
  const { ctx, p } = await open('intrinsic-value.html', { width: 1280 });
  const fs13 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('input')).fontSize));
  check('intrinsic-value.html desktop: form field size left to the page', fs13 < 16, fs13);
  await ctx.close();
}

// No page reaches outside the site folder (on /staging/ that was the old site).
const up = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && /(?:href|src)="\.\.\//.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
check('no page links or loads "../" paths', up.length === 0, up);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
