// ATD-109 Thesis Builder: a company's reported numbers through
// arowana-research, the bear/base/bull write-up through arowana-explain
// (Pro), the member's decision saved with a snapshot, and "What changed".
// Also its menu entries and the link from Ticker Research.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/thesis_builder_check.mjs
//
// Synthetic session (fake Supabase, fake research and explain functions);
// every non-localhost request aborted.
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
async function until(fn, ms = 10000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; }
const profile = plan => ({ id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: plan === 'free' ? null : 'sub_synthetic' });

const THESIS = {
  bear: 'At a price to earnings of 22.0 the stock prices in steady growth.', bear_if: 'Growth slows in the next two reports.',
  base: 'Return on equity of 18.0% shows a solid business.', base_if: 'Margins hold.',
  bull: 'Growth could pick up from here.', bull_if: 'Reports show faster growth without more debt.' };

const browser = await chromium.launch();
async function open(path, { plan = 'pro', width = 1280, ls = {}, explain, research } = {}) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  const calls = [], explained = [];
  const r = research ? research(calls) : fakeResearch(calls);
  await installFakeSupabase(ctx, { profiles: [profile(plan)] }, { localStorage: { ap_onboarded_v1: '1', ...ls }, functions: {
    'arowana-research': r,
    'arowana-explain': async req => { explained.push(req.body); return explain ? explain(req) : { status: 200, json: { thesis: THESIS, remaining: 140 } }; } } });
  const p = await ctx.newPage();
  const errors = [], outbound = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('request', q => { if (/finnhub\.io|anthropic/.test(q.url())) outbound.push(q.url()); });
  p.on('dialog', d => d.accept());
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  await sleep(1200);
  return { ctx, p, errors, calls, explained, outbound };
}
async function load(p, sym) {
  await p.fill('#symbol', sym);
  await p.click('#loadBtn');
  return until(() => p.evaluate(() => !document.getElementById('factsBox').hidden));
}

// ── Pro: the full flow ───────────────────────────────────────────────────
{
  const { ctx, p, errors, calls, explained, outbound } = await open('thesis-builder.html');
  check('loads the numbers for a ticker', await load(p, 'aapl'));
  const facts = await p.evaluate(() => ({ co: coName.textContent, groups: [...document.querySelectorAll('.fgroup h3')].map(h => h.textContent),
    roe: [...document.querySelectorAll('.fgroup dt')].some(d => d.textContent === 'Return on equity') }));
  check('company line, grouped figures (growth, profitability, valuation, balance sheet, dividend, price, analysts)',
    /AAPL Inc \(AAPL\)/.test(facts.co) && facts.roe && ['Profitability', 'Valuation', 'Balance sheet', 'Dividend', 'Price and risk'].every(g => facts.groups.includes(g)) &&
    facts.groups.some(g => /^Analysts/.test(g)), facts);
  check('uses quote, profile, metric and recommendation through arowana-research; nothing to finnhub.io directly',
    ['/quote', '/stock/profile2', '/stock/metric', '/stock/recommendation'].every(c => calls.includes(c)) && outbound.length === 0, { calls, outbound });
  check('steps 2-4 appear after loading', await p.evaluate(() => ['notesCard', 'scenCard', 'decCard'].every(id => !document.getElementById(id).hidden)));
  check('Pro: the write button is offered', await until(() => p.evaluate(() => !!document.getElementById('scenBtn'))));
  await p.fill('#myNote', 'New CEO from March');
  await p.click('#scenBtn');
  check('scenarios shown bear, base, bull in that order, each with its conditions', await until(() => p.evaluate(() =>
    [...document.querySelectorAll('#scenOut .sc h3')].map(h => h.textContent).join('|') === '🐻 Bear case|⚖️ Base case|🐂 Bull case' &&
    document.querySelectorAll('#scenOut .sc .if').length === 3 && /price to earnings of 22\.0/.test(document.getElementById('scenOut').textContent))));
  const req = explained[0] || {};
  const labels = (req.facts || []).map(f => f.label);
  check('explain request: kind thesis, the page\'s figures and the member\'s note, within limits', req.kind === 'thesis' &&
    labels.includes('Return on equity') && labels.includes('Price to earnings') && labels.includes('Company') &&
    (req.facts || []).some(f => f.label === "Investor's own note" && f.value === 'New CEO from March') &&
    req.facts.length <= 40 && req.facts.every(f => f.label.length <= 200 && String(f.value).length <= 200), req);

  // Decision
  await p.click('#saveBtn');
  check('save needs a decision', /Pick Buy or add/.test(await p.textContent('#saveStatus')));
  await p.check('input[name=dec][value=wait]');
  await p.click('#saveBtn');
  check('save needs a reason', /Write a line on why/.test(await p.textContent('#saveStatus')));
  await p.fill('#why', 'Good business, but the price already assumes a lot.');
  await p.fill('#change', 'Two quarters of falling revenue');
  await p.click('#saveBtn');
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('ap_thesis_log_v1') || '[]'));
  check('saved with decision, reasons, review date, figures snapshot and scenarios', log.length === 1 && log[0].symbol === 'AAPL' && log[0].decision === 'wait' &&
    log[0].change === 'Two quarters of falling revenue' && /^\d{4}-\d{2}-\d{2}$/.test(log[0].review) && log[0].snap.price > 0 && log[0].snap.roeTTM === 18 &&
    log[0].scen && log[0].scen.bear === THESIS.bear, log[0]);
  check('history lists it', await p.evaluate(() => /AAPL/.test(document.getElementById('hist').textContent) && /Wait/.test(document.getElementById('hist').textContent)));
  check('no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── What changed: today's figures beside the saved ones, no AI ──────────
{
  const saved = [{ id: 'a1', symbol: 'KO', name: 'KO Inc', date: '2026-07-01', decision: 'buy', why: 'Steady payer', change: 'Payout above 90%', review: '2026-09-30', note: '',
    snap: { price: 40, revenueGrowthTTMYoy: 9, epsGrowthTTMYoy: 3, netProfitMarginTTM: 20, roeTTM: 25, peTTM: 30, 'totalDebt/totalEquityQuarterly': 0.4, currentDividendYieldTTM: 3 }, scen: THESIS }];
  const { ctx, p, errors, explained } = await open('thesis-builder.html?view=history', { ls: { ap_thesis_log_v1: JSON.stringify(saved) } });
  check('history: past review date flagged', await p.evaluate(() => /Review due/.test(document.getElementById('hist').textContent)));
  await p.click('.entry button:has-text("What changed")');
  const t = await until(() => p.evaluate(() => document.querySelectorAll('.entry table.cmp tbody tr').length >= 5));
  const rows = await p.evaluate(() => [...document.querySelectorAll('.entry table.cmp tbody tr')].map(tr => [...tr.cells].map(c => c.textContent + (c.className ? '[' + c.className + ']' : ''))));
  check('What changed: a row per tracked figure, then and now', t && rows.find(r => r[0] === 'Price')[1] === '$40.00' && rows.find(r => r[0] === 'Return on equity')[1] === '25.0%', rows);
  check('What changed: lower P/E marked good, lower ROE marked bad', rows.find(r => r[0] === 'Price to earnings')[3] === '↓[up]' && rows.find(r => r[0] === 'Return on equity')[3] === '↓[down]', rows);
  check('What changed: reminds what would change their mind; no AI call', /Payout above 90%/.test(await p.textContent('.entry .detail')) && explained.length === 0);
  await p.click('.entry button:has-text("Scenarios")');
  check('saved scenarios reopen', await p.evaluate(() => document.querySelectorAll('.entry .detail .sc').length === 3));
  const nav = await p.evaluate(() => [...new Set([...document.querySelectorAll('[aria-current="page"][data-nav-id]')].map(n => n.getAttribute('data-nav-id')))].join());
  check('?view=history: menu marks Journal → Decision history', nav === 'journal-decisions', nav);
  // Export, then import into an empty browser.
  const dl = p.waitForEvent('download');
  await p.click('#exportBtn');
  const file = await dl;
  const path = await file.path();
  await p.evaluate(() => localStorage.removeItem('ap_thesis_log_v1'));
  await p.setInputFiles('#importFile', path);
  check('export → import round trip', await until(() => p.evaluate(() => /Imported 1 thesis\./.test(document.getElementById('histStatus').textContent) &&
    JSON.parse(localStorage.getItem('ap_thesis_log_v1')).length === 1)));
  await p.setInputFiles('#importFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  check('import refuses a file that is not an export', await until(() => p.evaluate(() => /not a thesis export/.test(document.getElementById('histStatus').textContent))));
  await p.click('.entry button:has-text("Delete")');
  check('delete removes it', await until(() => p.evaluate(() => JSON.parse(localStorage.getItem('ap_thesis_log_v1')).length === 0 && /Nothing saved yet/.test(document.getElementById('hist').textContent))));
  check('history: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Free: numbers and decisions free; write-up offered as Pro ────────────
{
  const { ctx, p, errors, explained } = await open('thesis-builder.html?symbol=MSFT', { plan: 'free' });
  check('?symbol= loads that ticker', await until(() => p.evaluate(() => /MSFT/.test(document.getElementById('coName').textContent))));
  check('Free: upsell instead of the write button, no explain call', await until(() => p.evaluate(() => !document.getElementById('scenBtn') &&
    /part of Pro and Founding Member/.test(document.getElementById('scenGate').textContent))) && explained.length === 0);
  const nav = await p.evaluate(() => [...new Set([...document.querySelectorAll('[aria-current="page"][data-nav-id]')].map(n => n.getAttribute('data-nav-id')))].join());
  check('menu marks Research → Thesis Builder', nav === 'research-thesis', nav);
  check('Free: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Failure paths ────────────────────────────────────────────────────────
{
  const { ctx, p } = await open('thesis-builder.html', { explain: () => ({ status: 200, json: { text: null, case: null, thesis: null, reason: 'numbers' } }) });
  await load(p, 'KO'); await until(() => p.evaluate(() => !!document.getElementById('scenBtn')));
  await p.click('#scenBtn');
  check('guard rejected: says nothing is shown and why', await until(() => p.evaluate(() => /kept adding numbers/.test(document.getElementById('scenOut').textContent))));
  await ctx.close();
}
{
  const { ctx, p } = await open('thesis-builder.html', { explain: () => ({ status: 400, json: { error: 'Nothing to explain.' } }) });
  await load(p, 'KO'); await until(() => p.evaluate(() => !!document.getElementById('scenBtn')));
  await p.click('#scenBtn');
  check('function not yet deployed with "thesis": says it is not switched on', await until(() => p.evaluate(() => /not switched on yet/.test(document.getElementById('scenOut').textContent))));
  await ctx.close();
}
{
  const research = calls => { const base = fakeResearch(calls); return async req => (req.body && req.body.path === '/stock/profile2')
    ? (calls.push('/stock/profile2'), { status: 429, json: { error: 'limit', message: 'Free accounts get 5 ticker lookups a day. Pro raises that to 25.' } }) : base(req); };
  const { ctx, p } = await open('thesis-builder.html', { plan: 'free', research });
  await p.fill('#symbol', 'KO'); await p.click('#loadBtn');
  check('out of lookups: the limit message, nothing half-loaded', await until(() => p.evaluate(() =>
    /5 ticker lookups a day/.test(document.getElementById('loadStatus').textContent) && document.getElementById('factsBox').hidden)));
  await ctx.close();
}

// ── Phone ────────────────────────────────────────────────────────────────
{
  const saved = [{ id: 'a1', symbol: 'KO', name: 'KO Inc', date: '2026-07-01', decision: 'buy', why: 'Steady payer', change: '', review: '', note: '', snap: { price: 40, roeTTM: 25 }, scen: null }];
  const { ctx, p, errors } = await open('thesis-builder.html', { width: 375, ls: { ap_thesis_log_v1: JSON.stringify(saved) } });
  await load(p, 'KO'); await until(() => p.evaluate(() => !!document.getElementById('scenBtn')));
  await p.click('#scenBtn'); await until(() => p.evaluate(() => document.querySelectorAll('#scenOut .sc').length === 3));
  await p.click('.entry button:has-text("What changed")'); await until(() => p.evaluate(() => !!document.querySelector('.entry table.cmp')));
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth,
    wide: [...document.querySelectorAll('main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.detail') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map(e => e.tagName + '.' + e.className),
    font: parseFloat(getComputedStyle(document.getElementById('symbol')).fontSize),
    taps: [...document.querySelectorAll('main button')].filter(b => b.offsetParent).every(b => b.getBoundingClientRect().height >= 40) }));
  check('phone: nothing wider than the screen (comparison table scrolls in its box), 16px inputs, tall buttons', r.over <= 1 && r.wide.length === 0 && r.font >= 16 && r.taps, r);
  check('phone: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Ticker Research links in with the ticker ─────────────────────────────
{
  const { ctx, p } = await open('analysis-central.html');
  await p.fill('#fundamentalSymbolInput', 'nvda');
  await p.evaluate(() => { const a = document.getElementById('thesisLink'); a.addEventListener('click', e => e.preventDefault()); });
  await p.click('#thesisLink');
  check('Ticker Research: "Build a thesis" carries the ticker', (await p.getAttribute('#thesisLink', 'href')) === 'thesis-builder.html?symbol=NVDA');
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
