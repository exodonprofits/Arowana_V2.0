// Trade Journal Pro option form: Max Risk / Max Profit preview.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/option_preview_check.mjs
//
// It used to show "Unlimited*" risk for every credit trade (including
// cash-secured puts and covered calls) and "Unlimited*" profit for every
// debit trade. Synthetic values; all non-localhost requests are aborted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail)}`);
}

const browser = await chromium.launch();
async function open(width) {
  const ctx = await browser.newContext({ viewport: { width: width || 1280, height: 900 } });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort();
    if (/\/login\.html$/.test(u.pathname) && r.request().isNavigationRequest()) return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
  await ctx.addInitScript(() => { localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: 'synthetic-test', email: 'synthetic@example.invalid' })); localStorage.setItem('tj_options_v2', '[]'); localStorage.setItem('tj_stocks_v2', '[]'); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/trade-journal-pro.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  return { ctx, p, errors };
}

// ── The calculation ──────────────────────────────────────────────────────
{
  const { ctx, p, errors } = await open();
  const cases = [
    // name, input, expected { risk, profit }
    ['cash-secured put 1 × $50 strike, $1.20', { type: 'put', strategy: 'Cash-Secured Put', credit: true, strike: 50, premium: 1.2, qty: 1 }, { risk: 4880, profit: 120 }],
    ['cash-secured put, 3 contracts', { type: 'put', strategy: 'Cash-Secured Put', credit: true, strike: 40, premium: 0.5, qty: 3 }, { risk: 11850, profit: 150 }],
    ['short put with no strike yet', { type: 'put', strategy: 'Cash-Secured Put', credit: true, strike: NaN, premium: 1, qty: 1 }, { risk: null, profit: 100 }],
    ['covered call', { type: 'call', strategy: 'Covered Call', credit: true, strike: 55, premium: 0.8, qty: 2 }, { risk: 'Covered by your shares', profit: 160 }],
    ['long call', { type: 'call', strategy: 'Long Call', credit: false, strike: 100, premium: 3, qty: 1 }, { risk: 300, profit: 'Unlimited' }],
    ['long put', { type: 'put', strategy: 'Long Put', credit: false, strike: 30, premium: 2, qty: 1 }, { risk: 200, profit: 2800 }],
    ['naked call (Other)', { type: 'call', strategy: 'Other', credit: true, strike: 20, premium: 1, qty: 1 }, { risk: 'Unlimited', profit: 100 }],
    ['credit call, no strategy chosen', { type: 'call', strategy: '', credit: true, strike: 20, premium: 1, qty: 1 }, { risk: 'Unlimited if uncovered', profit: 100 }],
    ['credit spread (width not recorded)', { type: 'put', strategy: 'Credit Spread', credit: true, strike: 50, premium: 1, qty: 1 }, { risk: null, profit: 100 }],
    ['debit spread', { type: 'call', strategy: 'Debit Spread', credit: false, strike: 50, premium: 2, qty: 1 }, { risk: 200, profit: null }],
    ['short strangle', { type: 'put', strategy: 'Strangle', credit: true, strike: 50, premium: 2, qty: 1 }, { risk: 'Unlimited', profit: 200 }],
    ['long straddle', { type: 'call', strategy: 'Straddle', credit: false, strike: 50, premium: 4, qty: 1 }, { risk: 400, profit: 'Unlimited' }],
    ['no premium yet', { type: 'put', strategy: 'Cash-Secured Put', credit: true, strike: 50, premium: 0, qty: 1 }, { risk: null, profit: null }]
  ];
  for (const [name, input, want] of cases) {
    const got = await p.evaluate(o => { o.strike = o.strike === null ? NaN : o.strike; return optMaxRiskProfit(o); }, input);
    const close = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-6 : a === b;
    check('calc: ' + name, close(got.risk, want.risk) && close(got.profit, want.profit), { got, want });
  }
  check('calc page: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── The form ─────────────────────────────────────────────────────────────
async function fill(p, f) {
  await p.evaluate(() => openModal('option'));
  await p.waitForTimeout(200);
  await p.evaluate(f => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
    setOptType(f.type);
    set('oStrategy', f.strategy); set('oCreditDebit', f.cd); set('oStrike', f.strike); set('oQty', f.qty); set('oPremiumIn', f.prem);
  }, f);
  return p.evaluate(() => ({ risk: document.getElementById('opMaxRisk').textContent, profit: document.getElementById('opMaxProfit').textContent }));
}
{
  const { ctx, p, errors } = await open();
  const csp = await fill(p, { type: 'put', strategy: 'Cash-Secured Put', cd: 'credit', strike: '40', qty: '1', prem: '1.25' });
  check('form: cash-secured put shows the real risk', /3,875/.test(csp.risk) && /125/.test(csp.profit) && !/Unlimited/.test(csp.risk), csp);
  const cc = await fill(p, { type: 'call', strategy: 'Covered Call', cd: 'credit', strike: '45', qty: '1', prem: '0.90' });
  check('form: covered call risk is covered by shares', cc.risk === 'Covered by your shares' && /90/.test(cc.profit), cc);
  const lp = await fill(p, { type: 'put', strategy: 'Long Put', cd: 'debit', strike: '30', qty: '2', prem: '1.50' });
  check('form: long put profit is bounded', /300/.test(lp.risk) && /5,700/.test(lp.profit), lp);
  // Changing only the strategy select refreshes the preview.
  await p.evaluate(() => { const s = document.getElementById('oStrategy'); s.value = 'Straddle'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  const st = await p.evaluate(() => document.getElementById('opMaxProfit').textContent);
  check('form: changing Strategy refreshes the preview', st === 'Unlimited', st);
  check('form page: no page errors', errors.length === 0, errors);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
