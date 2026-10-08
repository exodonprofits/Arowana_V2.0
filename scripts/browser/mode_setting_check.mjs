// Experience level (Beginner / Guided / Full) is chosen once, in Account.
// No tool page shows its own switch any more, and every page still applies
// the saved level.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/mode_setting_check.mjs
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

const PAGES = ['ai-moat-finder.html', 'atr-stop-planner.html', 'credit-spread-planner.html',
  'dcf-analyzer.html', 'discipline-scorecard.html', 'dividend-tracker.html', 'expectancy-matrix.html', 'kelly-calculator.html',
  'money-flow-alert.html', 'options-analyzer.html', 'position-sizer.html', 'r-multiple.html', 'risk-comfort.html',
  'scanner.html', 'strategy-backtesting.html', 'tax-loss-harvester.html', 'technical-analysis.html', 'tools.html',
  'trade-plan-builder.html', 'volatility-guardrails.html', 'watchlist.html', 'whale-tracker.html'];
const CLASS = { beginner: 'mode-beginner', guided: 'mode-guided', advanced: 'mode-full' };

const browser = await chromium.launch();
async function open(path, mode, width = 375) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile });
  const ls = { ap_onboarded_v1: '1' };
  if (mode) ls.ap_interface_mode_v1 = mode;
  await installFakeSupabase(ctx, {}, { localStorage: ls });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  await sleep(900);
  return { ctx, p, errors };
}
const switchShown = p => p.evaluate(() => [...document.querySelectorAll('#deskLevelSelect,#experienceSwitch,select.desk-level-select,select.pc-desk-level,select.experience-switch')]
  .some(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; }));

for (const file of PAGES) {
  for (const width of [375, 1280]) {
    const { ctx, p, errors } = await open(file, 'guided', width);
    check(`${file} ${width}px: no experience switch shown`, !(await switchShown(p)));
    if (width === 375) {
      check(`${file}: saved Guided level still applied`, await p.evaluate(() => document.body.classList.contains('mode-guided')),
        await p.evaluate(() => document.body.className));
      check(`${file}: no page errors`, errors.filter(e => !/Chart is not defined/.test(e)).length === 0, errors);
    }
    await ctx.close();
  }
}

// Account is where the level is chosen.
{
  const { ctx, p, errors } = await open('account.html', 'beginner');
  check('account: Experience level section with three choices', await p.evaluate(() => document.querySelectorAll('#experience input[name=apMode]').length === 3));
  check('account: the saved level is selected', await p.evaluate(() => document.querySelector('#experience input[value=beginner]').checked));
  await p.click('#experience input[value=advanced]');
  await sleep(200);
  check('account: choosing Full saves it and says so', await p.evaluate(() => localStorage.getItem('ap_interface_mode_v1') === 'advanced') &&
    /Full/.test(await p.textContent('#modeMsg')));
  const label = await p.evaluate(() => { const r = document.querySelector('#experience .mode-row').getBoundingClientRect(); return r.height; });
  check('account phone: each choice is a tall tap target', label >= 44, label);
  await p.goto(BASE + '/tools.html', { waitUntil: 'load' });
  await sleep(600);
  check('account → tools: the new level applies on the next page', await p.evaluate(() => document.body.classList.contains('mode-full')),
    await p.evaluate(() => document.body.className));
  check('account: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
