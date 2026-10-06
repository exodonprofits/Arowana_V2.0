// The site served from a subfolder, as the staging deploy is
// (https://arowanaprofits.com/staging/): signing in returns to the page you
// came from inside that folder, on synthetic data.
//
//   SUB=$(mktemp -d) && ln -s "$PWD" "$SUB/staging"
//   python3 -m http.server 8766 --bind 127.0.0.1 --directory "$SUB"
//   BASE=http://127.0.0.1:8766/staging node scripts/browser/subfolder_login_check.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, REF } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8766/staging';
const DIR = new URL(BASE + '/').pathname;          // "/staging/"

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
const path = p => { const u = new URL(p.url()); return u.pathname + u.search; };
const browser = await chromium.launch();

// Signed out, open the app's start page: bounced to login, sign in with a
// password, land back on it inside /staging/.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installFakeSupabase(ctx, { tj_stocks: [], tj_options: [] }, { localStorage: { ap_onboarded_v1: '1' } });
  await ctx.route(u => /\/login\.html$/.test(new URL(u).pathname), r => r.continue());  // the fake blocks login.html by default
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('signedOutOnce')) { sessionStorage.setItem('signedOutOnce', '1'); Object.keys(localStorage).filter(k => /auth|gs_auth_user|ap_plan/.test(k)).forEach(k => localStorage.removeItem(k)); } } catch (e) {} });
  const p = await ctx.newPage();
  const seen = [];
  p.on('framenavigated', f => { if (f === p.mainFrame()) seen.push(path(p)); });
  await p.goto(BASE + '/trading-command.html', { waitUntil: 'commit' });
  check('signed out: Trading Command sends you to login in the same folder', await until(() => path(p).startsWith(DIR + 'login.html?next=')), path(p));
  await p.waitForSelector('#email');
  await p.fill('#email', 'synthetic@example.invalid');
  await p.fill('#password', 'Synthetic-pass-123');
  await p.click('#btnSubmit');
  check('after sign-in: back on Trading Command under ' + DIR, await until(() => path(p) === DIR + 'trading-command.html', 12000), seen);
  check('never sent to a doubled folder', !seen.some(s => s.includes(DIR.replace(/\/$/, '') + DIR)), seen);
  await ctx.close();
}

// Already signed in: ?next= forms all resolve inside the folder.
const CASES = [
  [DIR + 'portfolio-command.html?tab=income', DIR + 'portfolio-command.html?tab=income'],
  ['portfolio-command.html?tab=income', DIR + 'portfolio-command.html?tab=income'],
  ['', DIR + 'trading-command.html'],
  ['https://evil.example/phish', DIR + 'trading-command.html'],
];
for (const page of ['login.html', 'signup.html']) {
  for (const [next, want] of CASES) {
    const ctx = await browser.newContext();
    await installFakeSupabase(ctx, { tj_stocks: [], tj_options: [] }, { localStorage: { ap_onboarded_v1: '1' } });
    await ctx.route(u => /\/login\.html$/.test(new URL(u).pathname), r => r.continue());
    const p = await ctx.newPage();
    await p.goto(BASE + '/' + page + (next ? '?next=' + encodeURIComponent(next) : ''), { waitUntil: 'commit' });
    check(`${page} signed in, next=${next || '(none)'} → ${want}`, await until(() => path(p) === want, 8000), path(p));
    await ctx.close();
  }
}

// Sign-up email confirmation link points back inside the folder.
{
  const ctx = await browser.newContext();
  const signups = [];
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (u.hostname === `${REF}.supabase.co` && u.pathname === '/auth/v1/signup') {
      signups.push(u.href);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000009', email: 'new@example.invalid', identities: [{}], confirmation_sent_at: new Date().toISOString() }) });
    }
    if (u.hostname === `${REF}.supabase.co` && u.pathname === '/auth/v1/user') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"no session"}' });
    return r.abort();
  });
  const p = await ctx.newPage();
  await p.goto(BASE + '/signup.html?next=' + encodeURIComponent('checkout.html?plan=founders'), { waitUntil: 'load' });
  await p.fill('#fullName', 'Synthetic Person'); await p.fill('#email', 'new@example.invalid'); await p.fill('#password', 'Synthetic-pass-123'); await p.fill('#confirm', 'Synthetic-pass-123');
  await p.check('#agree');
  await p.click('#btnSubmit');
  const got = await until(() => signups.length === 1);
  const redirect = got ? (new URL(signups[0]).searchParams.get('redirect_to') || '') : '';
  check('sign-up confirmation link returns to checkout inside the folder', redirect === new URL(DIR + 'checkout.html?plan=founders', BASE).href, redirect);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
