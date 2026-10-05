// ATD-109: sign-up follows only a same-site page in ?next=, and checkout
// survives login → sign-up, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/signup_next_check.mjs
//
// Signed-in cases use the fake Supabase; signed-out cases abort every
// non-localhost request except Supabase auth sign-up, which is captured.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, REF } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const HOST = new URL(BASE).host;

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
const browser = await chromium.launch();
const where = p => { const u = new URL(p.url()); return u.host === HOST ? u.pathname.replace(/^\//, '') + u.search : u.href; };

// ── Signed in: signup sends you on to ?next=, same-site pages only ───────
const CASES = [
  ['https://evil.example/phish', 'trading-command.html'],
  ['//evil.example/phish', 'trading-command.html'],
  ['javascript:alert(1)', 'trading-command.html'],
  ['/\\evil.example', 'trading-command.html'],
  ['checkout.html?plan=pro&cycle=annual', 'checkout.html?plan=pro&cycle=annual'],
  ['portfolio-command.html?tab=income', 'portfolio-command.html?tab=income']
];
for (const [next, want] of CASES) {
  const ctx = await browser.newContext();
  await installFakeSupabase(ctx, { tj_stocks: [], tj_options: [] }, { localStorage: { ap_onboarded_v1: '1' } });
  const offsite = [];
  ctx.on('request', r => { if (r.isNavigationRequest() && new URL(r.url()).hostname === 'evil.example') offsite.push(r.url()); });
  const p = await ctx.newPage();
  await p.goto(BASE + '/signup.html?next=' + encodeURIComponent(next), { waitUntil: 'load' });
  const ok = await until(() => where(p) === want, 8000);
  check(`signed in, next=${next} → ${want}`, ok && offsite.length === 0, { at: where(p), offsite });
  await ctx.close();
}

// ── Signed out: checkout banner, login carries next, email link ──────────
async function signedOut() {
  const ctx = await browser.newContext();
  const signups = [];
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (u.hostname === `${REF}.supabase.co` && u.pathname === '/auth/v1/signup') {
      signups.push({ url: u.href, body: JSON.parse(r.request().postData() || '{}') });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000009', email: 'new@example.invalid', identities: [{}], confirmation_sent_at: new Date().toISOString() }) });
    }
    if (u.hostname === `${REF}.supabase.co` && u.pathname === '/auth/v1/user') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"no session"}' });
    return r.abort();
  });
  return { ctx, signups };
}
{
  const { ctx } = await signedOut();
  const p = await ctx.newPage();
  await p.goto(BASE + '/login.html?next=' + encodeURIComponent('checkout.html?plan=founders'), { waitUntil: 'load' });
  check('login carries next to "Create one free"', await until(() => p.evaluate(() => document.getElementById('signupLink').getAttribute('href') === 'signup.html?next=' + encodeURIComponent('checkout.html?plan=founders'))), await p.evaluate(() => document.getElementById('signupLink').getAttribute('href')));
  const plain = await (async () => { const q = await ctx.newPage(); await q.goto(BASE + '/login.html', { waitUntil: 'load' }); await sleep(800); const h = await q.evaluate(() => document.getElementById('signupLink').getAttribute('href')); await q.close(); return h; })();
  check('login without next keeps the plain link', plain === 'signup.html', plain);
  await ctx.close();
}
{
  const { ctx, signups } = await signedOut();
  const p = await ctx.newPage();
  await p.goto(BASE + '/signup.html?next=' + encodeURIComponent('checkout.html?plan=founders'), { waitUntil: 'load' });
  check('checkout banner shown', await until(() => p.evaluate(() => document.getElementById('proBanner').classList.contains('visible') && /One step before checkout/.test(document.getElementById('proBanner').textContent))));
  check('no "$19/mo" anywhere', await p.evaluate(() => !/\$19/.test(document.querySelector('main').innerText)));
  await p.fill('#fullName', 'Synthetic Person'); await p.fill('#email', 'new@example.invalid'); await p.fill('#password', 'Synthetic-pass-123'); await p.fill('#confirm', 'Synthetic-pass-123');
  await p.check('#agree');
  await p.click('#btnSubmit');
  const got = await until(() => signups.length === 1);
  const redirect = got ? (new URL(signups[0].url).searchParams.get('redirect_to') || '') : '';
  check('email confirmation link returns to checkout on this site', got && redirect === new URL('/checkout.html?plan=founders', BASE).href, { redirect, url: signups[0] && signups[0].url });
  await ctx.close();
}
{
  const { ctx, signups } = await signedOut();
  const p = await ctx.newPage();
  await p.goto(BASE + '/signup.html?next=' + encodeURIComponent('https://evil.example/phish'), { waitUntil: 'load' });
  check('off-site next: no checkout banner', await p.evaluate(() => !document.getElementById('proBanner').classList.contains('visible')));
  await p.fill('#fullName', 'Synthetic Person'); await p.fill('#email', 'new@example.invalid'); await p.fill('#password', 'Synthetic-pass-123'); await p.fill('#confirm', 'Synthetic-pass-123');
  await p.check('#agree');
  await p.click('#btnSubmit');
  const got = await until(() => signups.length === 1);
  const redirect = got ? (new URL(signups[0].url).searchParams.get('redirect_to') || '') : '';
  check('off-site next: confirmation link goes to the dashboard here', got && redirect === new URL('/trading-command.html', BASE).href, redirect);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
