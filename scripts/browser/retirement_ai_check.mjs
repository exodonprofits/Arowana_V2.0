// Retirement Planner's managed AI write-up, and the index.html plan-name
// typo, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/retirement_ai_check.mjs
//
// Runs against the fake Supabase (scripts/browser/lib/fake_supabase.mjs) with
// arowana-explain stubbed; nothing reaches a real service.
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
const profile = plan => ({ id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: plan === 'free' ? null : 'sub_synthetic' });

const browser = await chromium.launch();
async function open(plan, explain) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const calls = [];
  if (plan) await installFakeSupabase(ctx, { profiles: [profile(plan)] }, { functions: { 'arowana-explain': async (req) => { calls.push(req.body); return explain(req); } } });
  else await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/retirement-planner.html', { waitUntil: 'load' });
  return { ctx, p, errors, calls };
}
async function buildRoadmap(p) {
  await p.evaluate(() => {
    const set = (id, v) => { document.getElementById(id).value = v; };
    set('age', 40); set('retireAge', 65); set('location', 'Synthetic Town'); set('income', 90000);
    set('currentSavings', 120000); set('monthlyContrib', 800); set('employerMatch', 200);
    set('ssPension', 2000); set('desiredSpending', 6000); set('debtBalance', 0); set('debtRate', 0);
    document.getElementById('lifeExpectancy').value = document.getElementById('lifeExpectancy').options[0].value;
    document.getElementById('roadmapForm').requestSubmit();
  });
  await until(() => p.evaluate(() => !!window.__lastProjection));
}
const gate = p => p.evaluate(() => document.getElementById('aiNarrativeGate').textContent.replace(/\s+/g, ' ').trim());
const out = p => p.evaluate(() => document.getElementById('aiNarrative').textContent.trim());

// ── Pro: managed write-up through arowana-explain ────────────────────────
{
  const { ctx, p, errors, calls } = await open('pro', () => ({ json: { text: 'Synthetic write-up of the three scenarios.' } }));
  check('Pro account (from the server) gets the managed button', await until(async () => /Generate narrative \(managed\)/.test(await gate(p))), await gate(p));
  check('tier is subscription', await p.evaluate(() => getAccountTier() === 'subscription'));
  await buildRoadmap(p);
  await p.click('#aiNarrativeBtn');
  check('write-up shown as text', await until(async () => (await out(p)) === 'Synthetic write-up of the three scenarios.'), await out(p));
  const body = calls[0] || {};
  const facts = body.facts || [];
  const val = l => (facts.find(f => f.label === l) || {}).value;
  check('request: kind "retirement"', body.kind === 'retirement', body.kind);
  check('request: within arowana-explain limits (≤40 facts, ≤200 chars)', facts.length > 0 && facts.length <= 40 && facts.every(f => f.label.length <= 200 && String(f.value).length <= 200), facts.length);
  check('facts: inputs as entered', val('Current age') === '40' && val('Target retirement age') === '65' && val('Years until retirement') === '25' && val('Current retirement savings') === '$120,000' && val('Monthly saving including employer match') === '$1,000' && val('Desired monthly spending in retirement') === '$6,000', facts.slice(0, 9));
  const proj = await p.evaluate(() => window.__lastProjection.proj.results.map(r => ({ label: r.label, ret: Math.round(r.nominalReturn * 100), fv: '$' + Math.round(r.fv).toLocaleString('en-US') })));
  check('facts: each scenario\'s savings match the page\'s projection', proj.length === 3 && proj.every(r => val(`${r.label} scenario (${r.ret}% yearly return): savings at retirement`) === r.fv), { proj, facts: facts.filter(f => /savings at retirement/.test(f.label)) });
  check('facts: free-text location not sent', !facts.some(f => /Synthetic Town/.test(f.value) || /location/i.test(f.label)));
  check('pro: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Deployed function without the 'retirement' kind ──────────────────────
{
  const { ctx, p } = await open('pro', () => ({ status: 400, json: { error: 'Nothing to explain.' } }));
  await until(async () => /managed/.test(await gate(p)));
  await buildRoadmap(p);
  await p.click('#aiNarrativeBtn');
  check('kind not deployed yet: says the write-up is not switched on', await until(async () => /isn't switched on yet/.test(await out(p))), await out(p));
  await ctx.close();
}
{
  const { ctx, p } = await open('pro', () => ({ status: 429, json: { error: "You have used this month's 50 explanations. The counter resets on the 1st." } }));
  await until(async () => /managed/.test(await gate(p)));
  await buildRoadmap(p);
  await p.click('#aiNarrativeBtn');
  check('quota error passed through', await until(async () => /this month's 50 explanations/.test(await out(p))), await out(p));
  await ctx.close();
}

// ── Free and signed out ──────────────────────────────────────────────────
{
  const { ctx, p, errors, calls } = await open('free', () => ({ json: { text: 'should not be called' } }));
  await sleep(1500);
  const g = await gate(p);
  check('free: BYOK or upgrade choice, real plan names', /Bring your own key/.test(g) && /Pro and Founding Member plans/.test(g) && !/Elite/.test(g), g);
  check('free: tier is not subscription', await p.evaluate(() => getAccountTier() !== 'subscription'));
  check('free: no explain call', calls.length === 0);
  check('free: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open(null);
  await sleep(1000);
  check('signed out: sign-in prompt', /Sign in to unlock this/.test(await gate(p)), await gate(p));
  check('signed out: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Free with their own key (BYOK): unchanged path ───────────────────────
{
  const { ctx, p, errors, calls } = await open('free', () => ({ json: { text: 'should not be called' } }));
  const hook = [];
  await ctx.route('https://byok.example.invalid/**', async r => { hook.push(JSON.parse(r.request().postData() || '{}')); await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ narrative: 'Synthetic BYOK narrative.' }) }); });
  await until(async () => /Bring your own key/.test(await gate(p)));
  await buildRoadmap(p);
  await p.fill('#byokWebhookInput', 'https://byok.example.invalid/hook');
  await p.click('#saveByokBtn');
  check('BYOK: key saved, button uses it', await until(async () => /using your key/.test(await gate(p))), await gate(p));
  await p.click('#aiNarrativeBtn');
  check('BYOK: posts the projection to their endpoint, shows the narrative', await until(async () => (await out(p)) === 'Synthetic BYOK narrative.') && hook.length === 1 && !!hook[0].proj && calls.length === 0, { out: await out(p), hook: hook.length, calls: calls.length });
  check('BYOK: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── index.html plan names ────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  const link = await p.evaluate(() => [...document.querySelectorAll('a[href="pricing.html"]')].map(a => a.textContent.trim()));
  check('index: monthly link names Pro at $29/month, no "Pro and Pro"', link.includes('Pro at $29/month') && !link.some(t => /Pro and Pro/.test(t)), link);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
