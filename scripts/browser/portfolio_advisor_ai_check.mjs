// Portfolio Advisor's AI (Analyze Stock and Ask Advisor) through the
// arowana-ai-coach edge function, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/portfolio_advisor_ai_check.mjs
//
// Runs against the fake Supabase (scripts/browser/lib/fake_supabase.mjs) with
// arowana-ai-coach stubbed; nothing reaches a real service.
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
const T = '2026-09-01T00:00:00.000Z';
const stk = p => ({ id: p.id, user_id: UID, status: 'open', symbol: p.ticker, updated_at: T, payload: Object.assign({ side: 'long', fees: 0, broker: 'Schwab', updatedAt: T, status: 'open' }, p) });

const ANALYSIS = {
  ticker: 'SYNT', name: 'Synthetic Corp <b>bold</b>', profile: 'Profitable, slow-growing, priced for stability',
  business: 'Sells subscriptions to businesses.', moat_score: 8, moat_description: 'Switching costs.',
  growth_score: 4, growth_description: 'New regions.', value_score: 6, value_description: 'Priced for stability.',
  dividend_score: null, dividend_description: 'No dividend.', thesis_requires: ['Customers keep renewing'],
  thesis_breaks_if: ['A cheaper rival wins share'], checks: ['Renewal rate in the annual report'], risks: ['Customer concentration'],
  time_horizon: 'long', suitable_for: ['value investor'],
};

const browser = await chromium.launch();
async function open(plan, coach, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const calls = [];
  await installFakeSupabase(ctx, { profiles: [profile(plan)], tj_stocks: [stk({ id: 's1', ticker: 'SYNA', qty: 10, entryPrice: 50, entryDate: '2025-03-01' })], tj_options: [] },
    { localStorage: { ap_onboarded_v1: '1' }, functions: { 'arowana-ai-coach': async (req) => { calls.push(req.body); return coach(req.body); } } });
  const p = await ctx.newPage();
  const errors = [], direct = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('request', r => { if (/api\.anthropic\.com|api\.openai\.com/.test(r.url())) direct.push(r.url()); });
  await p.goto(BASE + '/portfolio-advisor.html' + query, { waitUntil: 'load' });
  return { ctx, p, errors, calls, direct };
}
const result = p => p.evaluate(() => document.getElementById('analysisResult').textContent.replace(/\s+/g, ' ').trim());
const banner = p => p.evaluate(() => { const b = document.getElementById('upgradeBanner'); return b.style.display === 'none' ? '' : b.textContent.replace(/\s+/g, ' ').trim(); });
const lastAdvisor = p => p.evaluate(() => { const b = [...document.querySelectorAll('#chatArea .chat-bubble.advisor')]; return b.length ? b[b.length - 1].textContent.trim() : ''; });

// ── Pro: Analyze ─────────────────────────────────────────────────────────
{
  const { ctx, p, errors, calls, direct } = await open('pro', () => ({ json: { analysis: ANALYSIS, remaining: 29, limit: 30 } }));
  await p.evaluate(() => switchTab('analyze'));
  await p.fill('#analyzeInput', ' synt ');
  await p.click('#btnAnalyze');
  check('analysis rendered from the coach', await until(async () => /Sells subscriptions to businesses/.test(await result(p))), await result(p));
  const r = await result(p);
  check('request: mode company, cleaned ticker, nothing else', calls.length === 1 && JSON.stringify(calls[0]) === JSON.stringify({ mode: 'company', ticker: 'SYNT' }), calls);
  check('name escaped, lists and scores shown, missing score as a dash', r.includes('Synthetic Corp <b>bold</b>') && /Customers keep renewing/.test(r) && /8\/10/.test(r) && /—/.test(r) && !/null\/10/.test(r), r);
  check('no direct call to an AI provider', direct.length === 0, direct);
  check('pro: no upgrade banner', await until(async () => (await p.evaluate(() => window.AP_PLAN && AP_PLAN.slug())) === 'pro') && (await sleep(300), (await banner(p)) === ''), await banner(p));

  // Quick pick goes through the same path (window.analyzeStock).
  await p.click('button.chat-suggestion:has-text("MSFT")');
  check('quick pick calls the coach for MSFT', await until(() => calls.length === 2 && calls[1].ticker === 'MSFT'), calls);
  check('pro analyze: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Pro: guard rejected, quota, bad ticker in the URL ────────────────────
{
  const { ctx, p } = await open('pro', () => ({ json: { analysis: null, reason: 'numbers', remaining: 28, limit: 30 } }));
  await p.evaluate(() => switchTab('analyze'));
  await p.fill('#analyzeInput', 'SYNT');
  await p.click('#btnAnalyze');
  check('guard rejected: says no figures without a source', await until(async () => /figures it has no source for/.test(await result(p))), await result(p));
  await ctx.close();
}
{
  const { ctx, p } = await open('pro', () => ({ status: 429, json: { error: "You have used this month's 30 coach messages. The counter resets on the 1st." } }));
  await p.evaluate(() => switchTab('analyze'));
  await p.fill('#analyzeInput', 'SYNT');
  await p.click('#btnAnalyze');
  check('allowance used up: server message shown', await until(async () => /this month's 30 coach messages/.test(await result(p))), await result(p));
  await ctx.close();
}
{
  const { ctx, p, errors, calls } = await open('pro', () => ({ json: { analysis: ANALYSIS } }), '?analyze=' + encodeURIComponent('<img src=x onerror=window.__xss=1>'));
  await sleep(1500);
  check('?analyze= with markup: refused as a ticker, nothing injected, no call', /Enter a ticker symbol/.test(await result(p)) && !(await p.evaluate(() => !!document.querySelector('#analysisResult img') || !!window.__xss)) && calls.length === 0, { r: await result(p), calls });
  check('bad ticker: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, calls } = await open('pro', () => ({ json: { analysis: ANALYSIS } }), '?analyze=synt');
  check('?analyze=synt runs the analysis', await until(async () => /Sells subscriptions/.test(await result(p))) && calls[0] && calls[0].ticker === 'SYNT', calls);
  await ctx.close();
}

// ── Pro: Ask Advisor ─────────────────────────────────────────────────────
{
  const { ctx, p, errors, calls, direct } = await open('pro', () => ({ json: { reply: 'Your holdings include **SYNA**. The choice is yours.', remaining: 29, limit: 30, guarded: false } }));
  await p.evaluate(() => switchTab('chat'));
  check('holdings loaded from the trade log', await until(() => p.evaluate(() => /SYNA/.test(document.body.textContent) && /\$50\.00/.test(document.body.textContent)), 15000));
  await p.fill('#chatInput', 'What is a dividend?');
  await p.click('#chatSend');
  check('reply shown, bold kept, as text', await until(async () => (await lastAdvisor(p)) === 'Your holdings include SYNA. The choice is yours.') && await p.evaluate(() => { const b = [...document.querySelectorAll('#chatArea .chat-bubble.advisor')].pop(); return !!b.querySelector('strong'); }), await lastAdvisor(p));
  const b = calls[0] || {};
  const msgs = b.messages || [];
  check('request: mode investor, last message is the question', b.mode === 'investor' && msgs.length > 0 && msgs[msgs.length - 1].role === 'user' && msgs[msgs.length - 1].content === 'What is a dividend?', b);
  check('request: context carries the user\'s own figures and level', b.context && /SYNA \(10sh/.test(b.context.holdings) && typeof b.context.goals === 'string' && typeof b.context.portfolioValue === 'string' && b.context.level === 'beginner' && !('system' in b) && !('model' in b), b.context);
  check('chat: no direct call to an AI provider', direct.length === 0, direct);
  check('chat: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Free: the server says Pro; the page says so ──────────────────────────
{
  const upgrade = { status: 402, json: { error: 'The coach chat is part of Pro. Your journal, scanners, roll coach and daily brief stay available.', upgrade: true } };
  const { ctx, p, errors, calls } = await open('free', () => upgrade);
  check('free: banner says AI is part of Pro, no daily counter', await until(async () => /AI analysis and chat are part of Pro/.test(await banner(p))) && !/today/.test(await banner(p)), await banner(p));
  await p.evaluate(() => switchTab('analyze'));
  await p.fill('#analyzeInput', 'SYNT');
  await p.click('#btnAnalyze');
  check('free analyze: Pro message, upgrade modal', await until(async () => /AI analysis is part of Pro/.test(await result(p))) && await p.evaluate(() => document.getElementById('upgBackdrop').classList.contains('open')), await result(p));
  await p.evaluate(() => document.getElementById('upgClosBtn').click());
  await p.evaluate(() => switchTab('chat'));
  await p.fill('#chatInput', 'Hello');
  await p.click('#chatSend');
  check('free chat: Pro message in the chat', await until(async () => /AI chat is part of Pro/.test(await lastAdvisor(p))), await lastAdvisor(p));
  check('free: the server was asked (it decides), twice', calls.length === 2, calls.length);
  check('free: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
