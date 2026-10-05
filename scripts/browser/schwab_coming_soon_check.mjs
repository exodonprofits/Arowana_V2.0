// Schwab connection: coming soon, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/schwab_coming_soon_check.mjs
//
// Broker Connections runs against the fake Supabase (signed in); the OAuth
// return page is opened with a synthetic code/state and must call nothing.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
}
const browser = await chromium.launch();

// ── Broker Connections ───────────────────────────────────────────────────
for (const width of [1280, 375]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await installFakeSupabase(ctx, {});
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/broker-connections.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const main = await p.evaluate(() => document.querySelector('main').innerText);
  if (width === 1280) {
    check('says Schwab is coming soon and nothing is connected', /Coming soon/i.test(main) && /not available yet/.test(main) && /No broker is connected/.test(main), main.slice(0, 300));
    check('no sample connection, accounts or sync history', !/● Connected|Last sync|Schwab IRA|Sync All Now|webhook/.test(main), main.slice(0, 300));
    check('links to the journal CSV import', await p.evaluate(() => !!document.querySelector('main a[href="trade-journal-pro.html?action=import"]')));
    check('header and menu kept', await p.evaluate(() => !!document.querySelector('header') && !!document.getElementById('mobileMenu')));
    check('broker connections: no page errors', errors.length === 0, errors);
  } else {
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    check('375px: no horizontal page scroll', w <= 376, w);
  }
  await ctx.close();
}

// ── OAuth return page ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const requests = [];
  await ctx.route('**/*', r => { requests.push(r.request().url()); return new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/schwab-callback.html?code=SYNTHETIC_CODE&state=SYNTHETIC_STATE', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  const u = new URL(p.url());
  check('callback: code and state removed from the address bar', u.search === '' && /schwab-callback\.html$/.test(u.pathname), p.url());
  check('callback: only the page itself is requested', requests.length === 1 && /schwab-callback\.html/.test(requests[0]), requests);
  check('callback: says coming soon, nothing stored', /coming soon/i.test(await p.textContent('h1')) && /nothing was connected/.test(await p.textContent('body')));
  check('callback: no-referrer', await p.evaluate(() => document.querySelector('meta[name="referrer"]').content === 'no-referrer'));
  check('callback: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
