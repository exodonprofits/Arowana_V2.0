// ATD-108 S4: Options Hub "Check a trade", on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/trade_check_check.mjs
//
// The page runs unmodified against a fake Supabase (scripts/browser/lib/
// fake_supabase.mjs); every other non-localhost request is aborted, so the
// last price comes from the market_snapshots fallback.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { installFakeSupabase, UID } from './lib/fake_supabase.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const EXP = day(35);

const db = {
  ap_risk_settings: [{ user_id: UID, wheel_capital: 100000, max_ticker_pct: 20, max_total_pct: 60, max_puts_per_ticker: 2, warn_earnings: true,
    rules: { minAnnualYield: 12, minDte: 20, maxDte: 50, requireWantToOwn: true, putAtOrBelowTarget: true, callAboveBasis: true, warnExDiv: true } }],
  watchlists: [{ id: 'w1', user_id: UID }],
  watchlist_items: [{ watchlist_id: 'w1', symbol: 'SYNK', target_buy_price: 56, want_to_own: true }],
  market_snapshots: [{ symbol: 'SYNK', tf: '1d', ts: day(-1), ohlcv: { close: 60 } }, { symbol: 'SYNZ', tf: '1d', ts: day(-1), ohlcv: { close: 30 } }],
  tj_options: [], tj_stocks: []
};

const browser = await chromium.launch();
async function open(query, width) {
  const ctx = await browser.newContext({ viewport: { width: width || 1280, height: 900 } });
  const fake = await installFakeSupabase(ctx, db);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/options-hub.html' + query, { waitUntil: 'load' });
  return { ctx, p, errors, fake };
}
const verdict = p => p.evaluate(() => { const v = document.querySelector('#tc-result .tc-verdict strong'); return v ? v.textContent : ''; });
const failed = p => p.evaluate(() => [...document.querySelectorAll('#tc-result .tc-check.fail b')].map(b => b.textContent));
async function runCheck(p) {
  await p.evaluate(() => { const r = document.getElementById('tc-result'); if (r) r.textContent = ''; });
  await p.click('#tc-go');
  await until(async () => !!(await verdict(p)));
}

// ── Deep link, rules from the server ─────────────────────────────────────
{
  const { ctx, p, errors, fake } = await open(`?tab=check&ticker=synk&type=put&strike=55&expiry=${EXP}&premium=1.10&contracts=1`);
  check('?tab=check opens the tab, prefilled', await until(() => p.evaluate(() =>
    document.getElementById('checkTab').classList.contains('active') && document.getElementById('tc-ticker').value === 'SYNK' && document.getElementById('tc-strike').value === '55')));
  check('nav: Check a Trade entry is current', await until(() => p.evaluate(() => {
    const a = document.querySelector('#railMount a[data-nav-id="wheel-check"]');
    return !!a && a.getAttribute('aria-current') === 'page';
  })));
  await until(() => p.evaluate(() => document.getElementById('tc-r-yield').value === '12'));
  check('rules editor shows the server rules', await p.evaluate(() => document.getElementById('tc-r-yield').value === '12' && document.getElementById('tc-r-mindte').value === '20'));

  await runCheck(p);
  check('put on a Want-to-Own ticker at/below target meets the rules', /^Meets all \d+ rules checked$/.test(await verdict(p)), [await verdict(p), await failed(p)]);
  const href = await p.evaluate(() => { const a = [...document.querySelectorAll('#tc-result a')].find(x => /journal/.test(x.textContent)); return a && a.getAttribute('href'); });
  const q = href ? new URL(href, BASE + '/').searchParams : new URLSearchParams();
  check('"Log it" links to the journal option prefill', !!href && href.startsWith('trade-journal-pro.html?') && q.get('asset') === 'option' && q.get('ticker') === 'SYNK' && q.get('type') === 'put' && q.get('strike') === '55' && q.get('premium') === '1.1', href);

  await p.fill('#tc-strike', '58');
  await runCheck(p);
  check('strike above the target price fails that rule', /^Breaks 1 of your rules$/.test(await verdict(p)) && (await failed(p)).length === 1, [await verdict(p), await failed(p)]);

  await p.fill('#tc-ticker', 'SYNZ'); await p.fill('#tc-strike', '28'); await p.fill('#tc-premium', '0.60');
  await runCheck(p);
  check('ticker not on the Want-to-Own list fails that rule', /Breaks/.test(await verdict(p)), [await verdict(p), await failed(p)]);

  // Save a stricter yield rule: reaches the server and changes the result.
  await p.evaluate(() => { const d = document.getElementById('tc-rules'); if (d && 'open' in d) d.open = true; });
  await p.fill('#tc-r-yield', '40');
  await p.click('#tc-r-save');
  check('saving rules writes ap_risk_settings.rules', await until(() => (db.ap_risk_settings[0].rules || {}).minAnnualYield === 40), db.ap_risk_settings[0]);
  check('save message confirms the server copy', /^Rules saved\.$/.test(await p.textContent('#tc-r-msg')), await p.textContent('#tc-r-msg'));
  await p.fill('#tc-ticker', 'SYNK'); await p.fill('#tc-strike', '55'); await p.fill('#tc-premium', '1.10');
  await runCheck(p);
  check('stricter yield rule now fails the same trade', /Breaks/.test(await verdict(p)), [await verdict(p), await failed(p)]);
  db.ap_risk_settings[0].rules.minAnnualYield = 12;

  // A scanner card's "Check this trade" button (same delegated handler).
  await p.evaluate(() => { switchTab('puts'); });
  await p.evaluate((exp) => {
    const b = document.createElement('button');
    b.setAttribute('data-tc-check', ''); b.setAttribute('data-type', 'call'); b.setAttribute('data-symbol', 'SYNK');
    b.setAttribute('data-strike', '65'); b.setAttribute('data-expiry', exp); b.setAttribute('data-premium', '0.9'); b.setAttribute('data-contracts', '1');
    b.id = 'synthetic-card-btn'; document.getElementById('putsTab').appendChild(b);
  }, EXP);
  await p.evaluate(() => { const r = document.getElementById('tc-result'); if (r) r.textContent = ''; });
  await p.click('#synthetic-card-btn');
  check('card button switches to Check and runs it', await until(async () =>
    (await p.evaluate(() => document.getElementById('checkTab').classList.contains('active') && document.getElementById('tc-strike').value === '65')) && !!(await verdict(p))));
  check('no write to anything but ap_risk_settings', fake.writes.every(w => w.table === 'ap_risk_settings'), fake.writes);
  check('check page: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Existing tabs still open; phone width ────────────────────────────────
{
  const { ctx, p, errors } = await open('?tab=analyzer');
  check('?tab=analyzer still opens the Recommender', await until(() => p.evaluate(() => document.getElementById('analyzerTab').classList.contains('active'))));
  check('analyzer page: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p } = await open(`?tab=check&ticker=SYNK&type=put&strike=55&expiry=${EXP}&premium=1.10`, 375);
  await p.click('#tc-go');
  await until(async () => !!(await verdict(p)));
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('375px: result renders with no horizontal page scroll', !!(await verdict(p)) && w <= 376, w);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
