// Account's usage meters read ap_usage for every metered AI feature, on
// synthetic data; no placeholder "AI analyses" count.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/account_usage_check.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 12000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}
const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
const profile = plan => ({ id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: plan === 'free' ? null : 'sub_synthetic' });
const usage = [
  { user_id: UID, feature: 'research', period: today, used: 7 },
  { user_id: UID, feature: 'coach', period: month, used: 12 },
  { user_id: UID, feature: 'explain', period: month, used: 40 },
  { user_id: UID, feature: 'explain', period: '2000-01', used: 99 },
];

const browser = await chromium.launch();
async function open(plan, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await installFakeSupabase(ctx, { profiles: [profile(plan)], ap_usage: usage.map(r => ({ ...r })) }, { localStorage: { ap_onboarded_v1: '1' } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/account.html', { waitUntil: 'load' });
  return { ctx, p, errors };
}
const txt = (p, id) => p.evaluate(i => (document.getElementById(i) || {}).textContent || null, id);

for (const [plan, coach, explain, research] of [['pro', '12 / 30', '40 / 150', '7 / 25'], ['founders', '12 / 60', '40 / 300', '7 / 50']]) {
  const { ctx, p, errors } = await open(plan);
  check(`${plan}: explanations meter reads this month's ap_usage`, await until(async () => (await txt(p, 'usageExplain')) === explain), await txt(p, 'usageExplain'));
  check(`${plan}: coach and research meters`, (await txt(p, 'usageCoach')) === coach && (await txt(p, 'usageResearch')) === research, [await txt(p, 'usageCoach'), await txt(p, 'usageResearch')]);
  check(`${plan}: notes say what counts`, /Portfolio Advisor/.test(await txt(p, 'usageCoachNote') || '') || /left/.test(await txt(p, 'usageCoachNote') || ''), await txt(p, 'usageCoachNote'));
  check(`${plan}: no placeholder AI meter`, !(await p.evaluate(() => /AI analyses today/.test(document.body.textContent) || !!document.getElementById('meterAiValue'))));
  check(`${plan}: no page errors`, errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('free');
  check('free: coach and explanations not included', await until(async () => (await txt(p, 'usageExplain')) === 'Not included') && (await txt(p, 'usageCoach')) === 'Not included', [await txt(p, 'usageExplain'), await txt(p, 'usageCoach')]);
  check('free: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open('pro', 375);
  await until(async () => (await txt(p, 'usageExplain')) === '40 / 150');
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('375px: no horizontal page scroll', w <= 376, w);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
