// ATD-109 Long-Term desk: the hub links only working tools and shows what each
// step has saved; the ETF Core Screener runs (it shipped with no script), its
// plan reaches the IPS Builder, Pick My Mix uses age, and Learn loads its SDK.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/long_term_desk_check.mjs
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
async function until(fn, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; }

// A saved Asset Allocation Builder v2 snapshot: 60/35/5.
const ALLOC = { targets: { stocks: 60, bonds: 35, cash: 5 }, stock_tilts: { usCore: 40, intlDev: 25, em: 10, sv: 15, quality: 10 },
  bond_mix: { agg: 70, tips: 15, intlBond: 15 }, ts: '2026-10-01T12:00:00Z' };

const browser = await chromium.launch();
async function open(path, { width = 1280, ls = {}, signedIn = true } = {}) {
  const mobile = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  if (signedIn) await installFakeSupabase(ctx, {}, { localStorage: { ap_onboarded_v1: '1', ...ls } });
  else await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errors = [], missing = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => { if (r.status() === 404 && new URL(r.url()).hostname === '127.0.0.1') missing.push(r.url()); });
  p.on('dialog', d => d.accept());
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  await sleep(1000);
  return { ctx, p, errors, missing };
}

// ── Hub ──────────────────────────────────────────────────────────────────
{
  const { ctx, p, errors, missing } = await open('long-term-dashboard.html');
  const links = await p.evaluate(() => [...document.querySelectorAll('main a[href]')].map(a => a.getAttribute('href')));
  check('hub: 6 steps and 20 tool cards', await p.evaluate(() => document.querySelectorAll('#steps .step').length === 6 && document.querySelectorAll('#groups a.tool').length === 20));
  const bad = [];
  for (const href of [...new Set(links)]) {
    const r = await p.request.get(BASE + '/' + href.split('?')[0]);
    if (r.status() !== 200) bad.push(href + ' ' + r.status());
  }
  check('hub: every link opens a page that exists', bad.length === 0, bad);
  check('hub: links only to tools that work (no hidden or webhook pages)', !links.some(h => /technical-analysis|strategy-backtesting|scanner|swing|morning-brief|dividend|money-flow|account\.html#webhook/.test(h)), links);
  check('hub: no webhook, API key or "Soon" wording', await p.evaluate(() => !/webhook|api key|coming soon|\bSoon\b|mock mode/i.test(document.body.innerText)));
  check('hub: nothing saved → every step "Not started"', await p.evaluate(() => [...document.querySelectorAll('#steps .chip')].every(c => c.textContent === 'Not started')));
  check('hub: rail marks Long-Term as the current desk', await p.evaluate(() =>
    [...new Set([...document.querySelectorAll('[aria-current="page"][data-nav-id]')].map(n => n.getAttribute('data-nav-id')))].join() === 'desk-longterm'));
  check('hub: no page errors, no missing files', errors.length === 0 && missing.length === 0, { errors, missing });
  await ctx.close();
}
{
  const ls = { asset_allocation_builder_v2: JSON.stringify(ALLOC), ap_retirement_v1: JSON.stringify({ age: 40, retireAge: 65 }),
    etf_core_plan_v1: JSON.stringify({ lines: [{ sleeve: 'US Core', weight: 24 }, { sleeve: 'US Aggregate', weight: 24.5 }], weighted_er: 0.04 }),
    my_rules_longterm_v1: JSON.stringify({ eqPct: '60', rebalanceBand: '5' }) };
  const { ctx, p } = await open('long-term-dashboard.html', { ls });
  const chips = await p.evaluate(() => [...document.querySelectorAll('#steps .chip')].map(c => c.textContent));
  check('hub: saved work shows on its step', chips[1] === '✓ Age 40 → retire at 65' && chips[2] === '✓ Stocks 60 · bonds 35 · cash 5' &&
    chips[3] === '✓ 2 funds, 0.04% a year' && chips[4] === 'Not started' && chips[5] === '✓ 60% stocks, ±5% band', chips);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('long-term-dashboard.html', { width: 375 });
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, bar: !!document.querySelector('.anv-mobile-bar'),
    taps: [...document.querySelectorAll('main a.tool, main a.step')].every(a => a.getBoundingClientRect().height >= 44) }));
  check('hub phone: no sideways scroll, bottom bar, tall tap targets', r.over <= 1 && r.bar && r.taps, r);
  check('hub phone: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('long-term-dashboard.html', { signedIn: false });
  check('hub visitor: tools listed, no page errors', await p.evaluate(() => document.querySelectorAll('#groups a.tool').length === 20) && errors.length === 0, errors);
  await ctx.close();
}

// ── ETF Core Screener ────────────────────────────────────────────────────
const rows = p => p.evaluate(() => [...document.querySelectorAll('#tbl tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)));
{
  const { ctx, p, errors } = await open('etf-core-screener.html');
  let r = await rows(p);
  check('screener: lists funds on load (ER ≤ 0.20 by default)', r.length >= 20 && r.every(c => parseFloat(c[4]) <= 0.2), r.length);
  await p.evaluate(() => { document.getElementById('erMax').value = '0.05'; document.getElementById('erMax').dispatchEvent(new Event('change')); });
  r = await rows(p);
  check('screener: expense-ratio filter narrows the list', r.length > 0 && r.every(c => parseFloat(c[4]) <= 0.05), r.map(c => c[1] + ' ' + c[4]));
  await p.evaluate(() => { const s = document.getElementById('issuer'); s.value = 'Schwab'; s.dispatchEvent(new Event('change')); });
  r = await rows(p);
  check('screener: issuer filter', r.length > 0 && r.every(c => c[5] === 'Schwab'), r.map(c => c[1]));
  await p.evaluate(() => resetFilters());
  await p.fill('#searchBox', 'tips');
  r = await rows(p);
  check('screener: search by name or index', r.length >= 2 && r.every(c => /tips|inflation/i.test(c[2] + c[6])), r.map(c => c[1]));
  await p.evaluate(() => resetFilters());
  await p.click('text=Build ETF Plan');
  check('screener: no saved allocation → points to the Allocation Builder', await p.evaluate(() =>
    !!document.querySelector('#planBox a[href="asset-allocation-builder.html"]') && !localStorage.getItem('etf_core_plan_v1')));
  // CSV import adds a fund in a known sleeve, skips an unknown one.
  await p.setInputFiles('#csvFile', { name: 'mine.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Ticker,Name,Sleeve,ExpenseRatio,Issuer,Index\nFZROX,"Fidelity ZERO Total Market, Index",US Core,0,Fidelity,Fidelity US Total\nXYZ,Odd,Crypto,0.5,X,Y\n') });
  check('screener: CSV import adds funds, says what it skipped', await until(() => p.evaluate(() => /Imported 1 fund, skipped 1/.test(document.getElementById('resultNote').textContent))) &&
    (await rows(p)).some(c => c[1] === 'FZROX' && c[2] === 'Fidelity ZERO Total Market, Index'));
  const dl = p.waitForEvent('download');
  await p.click('text=Export Table (CSV)');
  const file = await dl;
  check('screener: table exports as CSV', file.suggestedFilename() === 'etf-screener.csv');
  check('screener: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('etf-core-screener.html', { ls: { asset_allocation_builder_v2: JSON.stringify(ALLOC) } });
  await p.click('text=Build ETF Plan');
  const plan = await p.evaluate(() => JSON.parse(localStorage.getItem('etf_core_plan_v1') || 'null'));
  const sum = plan ? Math.round(plan.lines.reduce((s, l) => s + l.weight, 0) * 10) / 10 : 0;
  check('screener: Build ETF Plan uses the saved v2 mix, one fund per sleeve', plan && plan.lines.length === 8 && sum === 95 && plan.cash === 5 &&
    plan.lines.find(l => l.sleeve === 'US Core').weight === 24 && plan.lines.every(l => l.ticker) && plan.lines.find(l => l.sleeve === 'US Core').ticker === 'VTI', plan && plan.lines);
  check('screener: picks the cheapest fund in each sleeve', plan && plan.lines.find(l => l.sleeve === 'Emerging').ticker === 'VWO' &&
    plan.lines.find(l => l.sleeve === 'US Aggregate').er === 0.03, plan && plan.lines);
  check('screener: plan table and weighted cost shown', await p.evaluate(() => document.querySelectorAll('#planBox tbody tr').length === 9 &&
    /Weighted expense ratio: 0\.\d{3}%/.test(document.getElementById('planBox').textContent)));
  check('screener plan: no page errors', errors.length === 0, errors);

  // The plan reaches the IPS Builder.
  await p.goto(BASE + '/ips-builder.html', { waitUntil: 'load' }); await sleep(600);
  await p.click('text=Import Saved Allocation');
  check('IPS: imports the v2 allocation (targets, tilts, bond mix)', await p.evaluate(() =>
    document.getElementById('st').value === '60' && document.getElementById('bd').value === '35' && document.getElementById('sv').value === '15' &&
    document.getElementById('bondMix').value === '70 / 15 / 15'), await p.evaluate(() => [st.value, bd.value, sv.value, bondMix.value]));
  await p.click('text=Load ETF Plan');
  await p.click('text=Generate Preview');
  const out = await p.textContent('#out');
  check('IPS: preview lists the screener\'s funds and weights', /VTI|ITOT|SCHB|VOO|IVV/.test(out) && /US Core/.test(out) && /\b24\b/.test(out) && /Cash/.test(out) && !/undefined/.test(out), out.slice(0, 600));
  check('IPS: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Pick My Mix uses age ─────────────────────────────────────────────────
{
  const { ctx, p, errors } = await open('pick-my-mix.html');
  const eq = (age, horizon, comfort = 3) => p.evaluate(([a, h, c]) => equityFrom(h, c, a), [age, horizon, comfort]);
  const r = { young: await eq(30, 35), old: await eq(70, 35), short: await eq(40, 2), mid: await eq(40, 10), bold: await eq(40, 10, 5) };
  check('pick-my-mix: long horizon → mostly stocks, short → mostly bonds', r.young === 90 && r.short <= 30 && r.mid === 60, r);
  check('pick-my-mix: capped at 120 minus age', r.old === 50, r);
  check('pick-my-mix: risk comfort moves it', r.bold === 72, r);
  check('pick-my-mix: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Learn loads its Supabase SDK (was a 404) ─────────────────────────────
{
  const { ctx, p, errors, missing } = await open('learn-investing.html');
  check('learn-investing: no missing scripts', missing.length === 0, missing);
  check('learn-investing: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
