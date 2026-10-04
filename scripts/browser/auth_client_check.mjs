// ATD-108 S1: every page that loads js/sb.js ends up with ONE Supabase auth
// client. supabase-js logs "Multiple GoTrueClient instances detected" when a
// second session-sharing client is created in the tab; that warning is the
// signal checked here (no network needed: all non-localhost requests abort).
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/auth_client_check.mjs [--report]
//
// --report prints per-page counts without failing (used to measure main).
import { createRequire } from 'module';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const REPORT = process.argv.includes('--report');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Pages to check: every page that loads the local SDK (on main) or sb.js (on this branch).
const pages = readdirSync(ROOT).filter(f => f.endsWith('.html')).filter(f => {
  const s = readFileSync(join(ROOT, f), 'utf8');
  return /src="\.\/js\/(supabase_min|sb)\.js/.test(s) || /unpkg\.com\/@supabase/.test(s);
}).sort();

// Owner-parked pages that are deliberately not migrated yet (ATD-008 D5).
const KNOWN = new Set(['tradingcommand.html']);

const browser = await chromium.launch();
const results = []; let failed = 0;
for (const page of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort();
    if (/\/login\.html$/.test(u.pathname) && r.request().isNavigationRequest() && page !== 'login.html') return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: 'synthetic-test', email: 'synthetic@example.invalid' })); } catch (e) {} });
  const p = await ctx.newPage();
  const multi = [], guarded = [], errors = [];
  p.on('console', m => {
    const t = m.text();
    if (/Multiple GoTrueClient instances/.test(t)) multi.push(t);
    if (/\[sb\] createClient\(\) called again/.test(t)) guarded.push(t);
  });
  p.on('pageerror', e => errors.push(e.message));
  try { await p.goto(BASE + '/' + page, { waitUntil: 'load', timeout: 20000 }); } catch (e) { errors.push('goto: ' + e.message); }
  await p.waitForTimeout(2500);
  const state = await p.evaluate(() => ({
    sb: !!window.__apSb,
    client: !!(window.supabaseClient && window.supabaseClient.auth),
    same: !window.supabaseClient || !window.sbClient || window.supabaseClient === window.sbClient,
    token: typeof window.apGetAccessToken,
    url: location.pathname
  })).catch(() => ({ sb: false, client: false, same: true, token: 'n/a', url: '?' }));
  const ok = multi.length === 0 && (!state.sb || (state.client && state.same));
  const known = !ok && KNOWN.has(page);
  if (!ok && !known && !REPORT) failed++;
  results.push(`${ok ? 'PASS' : known ? 'KNOWN' : 'FAIL'} ${page} — multiple:${multi.length} guarded:${guarded.length} sb:${state.sb} client:${state.client} apGetAccessToken:${state.token}` +
    (errors.length ? ' pageErrors:' + errors.length : ''));
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
const multiPages = results.filter(r => !/multiple:0 /.test(r)).length;
console.log(`\n${pages.length} pages; ${multiPages} with multiple auth clients`);
process.exit(failed ? 1 : 0);
