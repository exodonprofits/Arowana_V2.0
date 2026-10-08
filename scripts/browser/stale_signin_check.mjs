// ATD-109: a saved name on the device but an expired session (owner hit this
// on staging: the menu said "Jimmy Tran", the Thesis Builder said "Sign in to
// load market data" with no way forward). The menu now says "Sign in again",
// and a market-data call shows one notice with a link back to the same page.
// A real session still shows the name.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/stale_signin_check.mjs
//
// Every non-localhost request is answered here or aborted.
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
async function until(fn, ms = 10000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; }

const browser = await chromium.launch();
async function expired(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const calls = [];
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (/supabase\.co$/.test(u.hostname)) {
      calls.push(u.pathname);
      if (u.pathname === '/auth/v1/user') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"code":401,"msg":"session missing"}' });
      if (u.pathname === '/auth/v1/token') return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant","error_description":"Refresh Token Not Found"}' });
      if (u.pathname.startsWith('/rest/v1/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"no session"}' });
    }
    return r.abort();
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.invalid' }));
      localStorage.setItem('ap_onboarded_v1', '1');
    } catch (e) {}
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  await sleep(2000);
  return { ctx, p, errors, calls };
}

{
  const { ctx, p, errors, calls } = await expired('thesis-builder.html?symbol=AMD');
  const label = await p.evaluate(() => (document.getElementById('userName') || {}).textContent);
  check('expired session: the menu says "Sign in again", not the saved name', label === 'Sign in again', label);
  const n = await until(() => p.evaluate(() => { const e = document.getElementById('apDataNotice'); return !!e && e.style.display !== 'none' && /sign-in has expired/.test(e.textContent); }));
  const href = await p.evaluate(() => { const a = document.querySelector('#apDataNotice a'); return a && a.getAttribute('href'); });
  check('expired session: market data shows one notice with a link back to this page', n && href === 'login.html?next=' + encodeURIComponent('thesis-builder.html?symbol=AMD'), href);
  check('expired session: nothing sent to the research function', !calls.some(c => c.includes('arowana-research')), calls);
  check('expired session: the page itself still explains', /Sign in to load market data/.test(await p.textContent('#loadStatus')));
  check('expired session: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await expired('trading-command.html');
  const label = await p.evaluate(() => (document.getElementById('userName') || {}).textContent);
  check('trading-command, expired session: menu says "Sign in again"', label === 'Sign in again', label);
  check('trading-command: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  // A real session keeps the name.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1' } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/thesis-builder.html', { waitUntil: 'load' }); await sleep(2000);
  const label = await p.evaluate(() => (document.getElementById('userName') || {}).textContent);
  check('signed in: the menu shows the member, not "Sign in again"', label && label !== 'Sign in again' && label !== 'Account', label);
  check('signed in: no expired notice', await p.evaluate(() => { const e = document.getElementById('apDataNotice'); return !e || e.style.display === 'none'; }));
  await ctx.close();
}

{
  // A real session, but the network is down: keep the name (offline is not signed out).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1' } });
  await ctx.route(/\/auth\/v1\/user/, r => r.abort('internetdisconnected'));
  const p = await ctx.newPage();
  await p.goto(BASE + '/trading-command.html', { waitUntil: 'load' }); await sleep(2000);
  const label = await p.evaluate(() => (document.getElementById('userName') || {}).textContent);
  check('offline with a session: the menu keeps the name', label && label !== 'Sign in again', label);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
