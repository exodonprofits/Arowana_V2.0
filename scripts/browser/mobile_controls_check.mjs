// Phone dropdowns show their whole selected label at 16px (the size that
// stops iPhone zooming in), and pages render in the site font.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/mobile_controls_check.mjs
//
// Synthetic session (fake Supabase). Google Fonts is let through when the
// network allows it; the width check measures whatever font rendered.
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

// Every page the audit found with a cut-off dropdown on a phone.
const PAGES = ['tools.html', 'ai-moat-finder.html', 'atr-stop-planner.html', 'credit-spread-planner.html',
  'dcf-analyzer.html', 'discipline-scorecard.html', 'dividend-tracker.html', 'expectancy-matrix.html', 'kelly-calculator.html',
  'money-flow-alert.html', 'options-analyzer.html', 'portfolio-advisor.html', 'r-multiple.html', 'risk-comfort.html',
  'scanner.html', 'strategy-backtesting.html', 'tax-loss-harvester.html', 'technical-analysis.html', 'trading-command.html',
  'volatility-guardrails.html', 'watchlist.html', 'position-sizer.html', 'trade-plan-builder.html'];

const browser = await chromium.launch();
for (const file of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1' } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.continue().catch(() => r.abort()));
  const p = await ctx.newPage();
  await p.goto(BASE + '/' + file, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.fonts && document.fonts.ready);
  const r = await p.evaluate(() => {
    const vis = e => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
    const c = document.createElement('canvas').getContext('2d');
    const clipped = [...document.querySelectorAll('select')].filter(vis).filter(e => {
      const st = getComputedStyle(e), o = e.options[e.selectedIndex];
      if (!o) return false;
      c.font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
      return c.measureText(o.text).width + parseFloat(st.paddingLeft) + parseFloat(st.paddingRight) + 18 > e.clientWidth + 1;
    }).map(e => (e.id || e.className) + ': ' + e.options[e.selectedIndex].text);
    return { clipped, font: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g, ''), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  check(`${file} phone: no dropdown cuts off its label`, r.clipped.length === 0, r.clipped);
  check(`${file} phone: site font, no sideways scroll`, r.font === 'Plus Jakarta Sans' && r.overflow <= 1, r);
  await ctx.close();
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
