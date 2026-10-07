// ATD-109 launch: every page in the launch menu works for a signed-in member
// with no API key of their own. Market data goes through arowana-research
// (faked here), the "server" placeholder key never leaves the browser, and no
// page asks for a key. Plus the pre-launch fixes: R-Multiple, Scanners'
// default filter, the Tool Directory and Support wording.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/launch_menu_check.mjs
//
// Synthetic session (fake Supabase); every non-localhost request aborted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
import { fakeResearch } from './lib/fake_research.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; }

const T = '2026-10-01T12:00:00Z';
const DB = () => ({
  watchlists: [{ id: 'w1', user_id: UID, name: 'Main', created_at: T }],
  watchlist_items: [{ id: 'i1', user_id: UID, watchlist_id: 'w1', symbol: 'AAPL', horizon: 'trade_idea', status: 'watching', inserted_at: T }],
});
// Pages a member reaches from the launch menu and the Tool Directory.
const MENU = ['trading-command.html', 'analysis-central.html', 'intrinsic-value.html', 'tools.html', 'options-hub.html?tab=puts',
  'options-hub.html?tab=calls', 'options-hub.html?tab=check', 'options-hub.html?tab=roll', 'options-hub.html?tab=analyzer',
  'arowana-trader.html', 'wheel-strategy.html', 'credit-spread-planner.html', 'portfolio-command.html', 'portfolio-advisor.html',
  'my-rules.html', 'position-sizer.html', 'tax-loss-harvester.html', 'watchlist.html', 'trade-journal-pro.html',
  'expectancy-matrix.html', 'data-hygiene-audit.html', 'kelly-calculator.html', 'atr-stop-planner.html', 'dcf-analyzer.html',
  'ai-moat-finder.html', 'options-analyzer.html', 'trade-plan-builder.html', 'r-multiple.html', 'risk-comfort.html',
  'volatility-guardrails.html', 'discipline-scorecard.html', 'trading-journal-analysis.html', 'support.html', 'security.html',
  'long-term-dashboard.html', 'retirement-planner.html', 'retirement-calculator.html', 'withdrawal-planner.html', 'tax-advantaged-guide.html',
  'pick-my-mix.html', 'asset-allocation-builder.html', 'etf-core-screener.html', 'fee-analyzer.html', 'factor-tilt-planner.html',
  'dca-planner.html', 'college-savings.html', 'education-529-planner.html', 'buy-a-home.html', 'risk-quiz.html', 'ips-builder.html',
  'my-rules.html?tab=longterm', 'real-estate-analyzer.html', 'learn-investing.html'];
const KEY_TALK = /api key|finnhub key|add one free|add your[^.]{0,20}key|key rejected|alpha vantage key|twelve data key|fmp key/i;

const browser = await chromium.launch();
async function open(path, { width = 1280, ls = {} } = {}) {
  const calls = [], queries = [];
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const research = fakeResearch(calls);
  await installFakeSupabase(ctx, DB(), { localStorage: { ap_onboarded_v1: '1', ...ls }, functions: {
    'arowana-research': async req => { queries.push(req.body); return research(req); } } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const outbound = [];
  p.on('request', r => { if (/finnhub\.io/.test(r.url())) outbound.push(r.url()); });
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  await sleep(1800);
  return { ctx, p, errors, calls, queries, outbound };
}
const keyTalk = p => p.evaluate(src => {
  const re = new RegExp(src, 'i'), out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const el = n.parentElement; if (el && el.offsetParent && re.test(n.textContent)) out.push(n.textContent.trim().slice(0, 100)); }
  return out;
}, KEY_TALK.source);

for (const path of MENU) {
  const { ctx, p, errors, outbound } = await open(path);
  // Chart.js comes from a CDN this test blocks; that error is the test's, not the page's.
  const pageErrors = errors.filter(e => !/Chart is not defined/.test(e));
  const talk = (await keyTalk(p)).filter(t => !/never paste an API key|Do I need my own API key|No market data, no API key/i.test(t));
  check(`${path}: no API-key wording, no page errors, nothing sent to finnhub.io directly`, talk.length === 0 && pageErrors.length === 0 && outbound.length === 0,
    { talk, errors: pageErrors.slice(0, 2), outbound: outbound.slice(0, 2) });
  await ctx.close();
}

// No stored key at all: the placeholder lets pages fetch, through our server.
{
  const { ctx, p, calls, queries } = await open('watchlist.html');
  check('watchlist: live price loaded through arowana-research with no key stored', await until(() => p.evaluate(() =>
    /Updated \d+ price|Refresh Prices/.test(document.body.innerText) && !/not available right now/.test(document.body.innerText))) && calls.includes('/quote'), calls);
  check('placeholder token is never forwarded to the research function', queries.every(q => !('token' in (q.query || {}))), queries.slice(0, 2));
  check('placeholder stored only as the finnhub slot', await p.evaluate(() => JSON.parse(localStorage.getItem('ap_user_api_keys')).finnhub === 'arowana-server'));
  await ctx.close();
}
{
  const { ctx, p, calls } = await open('options-hub.html?tab=analyzer');
  await p.fill('#rec-ticker', 'KO');
  await p.press('#rec-ticker', 'Enter');
  await sleep(2500);
  check('options-hub analyzer: ticker lookup reaches the research function', calls.includes('/quote') || calls.includes('/stock/profile2'), calls);
  await ctx.close();
}
{
  const { ctx, p, calls } = await open('intrinsic-value.html');
  await p.fill('#ticker', 'AAPL');
  await p.click('#fetchBtn');
  check('intrinsic-value: Load data fills price and EPS from the research function',
    await until(() => p.evaluate(() => /Loaded AAPL/.test(document.body.innerText))) && calls.includes('/stock/metric'), calls);
  await ctx.close();
}
// A member who still has a personal key keeps it (the placeholder never overwrites it).
{
  const { ctx, p } = await open('watchlist.html', { ls: { ap_user_api_keys: JSON.stringify({ finnhub: 'personal-key' }) } });
  check('a personal key already stored is left alone', await p.evaluate(() => JSON.parse(localStorage.getItem('ap_user_api_keys')).finnhub === 'personal-key'));
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('r-multiple.html');
  await p.setViewportSize({ width: 500, height: 900 }); await sleep(200);
  await p.setViewportSize({ width: 1280, height: 900 }); await sleep(300);
  check('r-multiple: resizing across 641px throws nothing', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open('scanner.html');
  check('scanner: opens on "Ready now"', await p.evaluate(() => document.getElementById('categoryFilter').value === '__ready__'));
  await ctx.close();
}
{
  const { ctx, p } = await open('tools.html');
  check('tools: no Dividend Tracker or dead Dividend Screener card', await p.evaluate(() =>
    !document.querySelector('a.tool-card[href="dividend-tracker.html"], a.tool-card[href*="dividend_safety"]')));
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
