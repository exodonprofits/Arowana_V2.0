// The site installs as a home-screen app: a valid manifest Chromium accepts
// as installable, icons that load, and the iOS tags, on synthetic pages.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/home_screen_app_check.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}

const browser = await chromium.launch();
for (const path of ['index.html', 'pricing.html', 'login.html']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  const cdp = await ctx.newCDPSession(p);
  const man = await cdp.send('Page.getAppManifest');
  check(`${path}: manifest found and parsed without errors`, /manifest\.json$/.test(man.url) && man.errors.length === 0 && !!man.data, man.errors);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  check(`${path}: Chromium says it is installable`, inst.installabilityErrors.length === 0, inst.installabilityErrors);
  const tags = await p.evaluate(() => ({
    capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
    touch: document.querySelector('link[rel="apple-touch-icon"]')?.href,
    theme: document.querySelectorAll('meta[name="theme-color"]').length,
  }));
  check(`${path}: iOS full-screen tags and one theme colour`, tags.capable === 'yes' && tags.title === 'Arowana' && /images\/app-icon-180\.png$/.test(tags.touch) && tags.theme === 1, tags);
  await ctx.close();
}
{
  const ctx = await browser.newContext();
  const m = await (await ctx.request.get(BASE + '/manifest.json')).json();
  check('manifest: standalone, opens Trading Command, relative so /staging/ works', m.display === 'standalone' && m.start_url === './trading-command.html' && m.scope === './', m);
  const icons = [];
  for (const i of m.icons) { const r = await ctx.request.get(BASE + '/' + i.src); icons.push([i.src, r.status(), r.headers()['content-type']]); }
  check('manifest: every icon loads as PNG, including a maskable one', icons.every(([, s, t]) => s === 200 && /png/.test(t)) && m.icons.some(i => i.purpose === 'maskable'), icons);
  const t = await ctx.request.get(BASE + '/images/app-icon-180.png');
  check('apple-touch-icon loads', t.status() === 200);
  await ctx.close();
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
