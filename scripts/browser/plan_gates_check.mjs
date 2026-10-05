// Plan gates: pages that used to read localStorage ap_is_pro_v1 now ask
// js/plan.js, which reads the plan from the server (profiles.arowana_plan).
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/plan_gates_check.mjs
//
// Each page is opened twice against the fake Supabase (scripts/browser/lib/
// fake_supabase.mjs): a Free account that has ap_is_pro_v1 set (the old
// console shortcut must not unlock anything) and a Pro account (must be
// treated as Pro; nothing ever set the old key, so Pro users were locked out).
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 300)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}

const browser = await chromium.launch();
async function open(path, plan) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const profile = { id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: plan === 'free' ? null : 'sub_synthetic' };
  await installFakeSupabase(ctx, { profiles: [profile] }, { localStorage: { ap_is_pro_v1: plan === 'free' ? '1' : '0' } });
  // retirement-planner checked 'true', the others '1'.
  if (plan === 'free') await ctx.addInitScript(() => { if (/retirement/.test(location.pathname)) localStorage.setItem('ap_is_pro_v1', 'true'); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  // Wait for plan.js where the page loads it.
  await p.evaluate(() => new Promise(r => { if (!window.AP_PLAN) return r(); AP_PLAN.ready().then(r, r); setTimeout(r, 8000); }));
  await sleep(600);
  return { ctx, p, errors };
}

const PAGES = [
  { path: 'arowana-trader.html', probe: () => ({ pro: !!(window.AP_PLAN && AP_PLAN.atLeast('pro')), banner: getComputedStyle(document.getElementById('upgradeBanner')).display !== 'none' }),
    free: r => !r.pro && r.banner, pro: r => r.pro && !r.banner },
  { path: 'portfolio-advisor.html', probe: () => ({ pro: !!(window.AP_PLAN && AP_PLAN.atLeast('pro')), banner: getComputedStyle(document.getElementById('upgradeBanner')).display !== 'none' }),
    free: r => !r.pro && r.banner, pro: r => r.pro && !r.banner },
  { path: 'options-analyzer.html', probe: () => ({ pro: !!(window.AP_PLAN && AP_PLAN.atLeast('pro')), gate: getComputedStyle(document.getElementById('proGate')).display !== 'none', tool: getComputedStyle(document.getElementById('toolContent')).display !== 'none' }),
    free: r => !r.pro && r.gate && !r.tool, pro: r => r.pro && !r.gate && r.tool },
  { path: 'whale-tracker.html', probe: () => ({ pro: !!(window.AP_PLAN && AP_PLAN.atLeast('pro')), banner: getComputedStyle(document.getElementById('upgradeBanner')).display !== 'none' }),
    free: r => !r.pro, pro: r => r.pro && !r.banner },   // banner only appears after a scan
  { path: 'analysis-central.html', probe: () => ({ pro: !!(window.AP_PLAN && AP_PLAN.atLeast('pro')), planLoaded: !!window.AP_PLAN }),
    free: r => r.planLoaded && !r.pro, pro: r => r.planLoaded && r.pro },
  // Its lock blocks target sections and tool tiers this page does not have
  // (same on main), so the page is judged by the plan it reads; the blocks
  // now run after the plan is known, and must not throw.
  { path: 'long-term-dashboard.html', probe: () => ({ plan: !!window.AP_PLAN, pro: !!(window.AP_PLAN && AP_PLAN.atLeast('pro')) }),
    free: r => r.plan && !r.pro, pro: r => r.plan && r.pro },
  // Loads plan.js since the managed write-up was wired up: Pro comes from
  // the server, and the old ap_is_pro_v1 flag still unlocks nothing.
  { path: 'retirement-planner.html', probe: () => ({ tier: getAccountTier() }), free: r => r.tier !== 'subscription', pro: r => r.tier === 'subscription' }
];

for (const pg of PAGES) {
  for (const plan of ['free', 'pro']) {
    const { ctx, p, errors } = await open(pg.path, plan);
    let r = null;
    await until(async () => { r = await p.evaluate(pg.probe).catch(e => ({ error: e.message })); return pg[plan](r); }, 6000);
    check(`${pg.path}: ${plan === 'free' ? 'Free account with ap_is_pro_v1 set stays Free' : 'Pro account (from the server) is Pro'}`, pg[plan](r), r);
    check(`${pg.path} (${plan}): no page errors`, errors.length === 0, errors);
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
