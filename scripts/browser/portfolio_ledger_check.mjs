// ATD-108 S3: Portfolio Command's wheel campaigns panel and journal-backed
// Add / Edit / Delete Holding, on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/portfolio_ledger_check.mjs
//
// The page runs unmodified against a fake Supabase: a synthetic session in
// localStorage, and a small in-memory PostgREST behind page.route() for
// <project>.supabase.co. Every other non-localhost request is aborted, so no
// real service is contacted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const REF = 'pbojacnagutipfhcxltj';
const UID = '00000000-0000-4000-8000-000000000001';

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

// ── Synthetic journal ────────────────────────────────────────────────────
const T = '2026-09-01T00:00:00.000Z';
const opt = (p) => ({ id: p.id, user_id: UID, status: p.status, updated_at: T, payload: Object.assign({ isCredit: true, qty: 1, feeIn: 0, feeOut: 0, broker: 'Schwab', updatedAt: T }, p) });
const stk = (p) => ({ id: p.id, user_id: UID, status: p.status, symbol: p.ticker, updated_at: T, payload: Object.assign({ side: 'long', fees: 0, broker: 'Schwab', updatedAt: T }, p) });
const db = {
  tj_options: [
    opt({ id: 'o1', ticker: 'SYNK', optType: 'put', strategy: 'Cash-Secured Put', strike: 60, expiry: '2026-06-19', entryDate: '2026-06-01', premiumIn: 1.2, status: 'assigned', exitDate: '2026-06-19' }),
    opt({ id: 'o2', ticker: 'SYNK', optType: 'call', strategy: 'Covered Call', strike: 63, expiry: '2099-11-20', entryDate: '2026-09-20', premiumIn: 0.8, status: 'open' }),
    opt({ id: 'o3', ticker: 'SYNP', optType: 'put', strategy: 'Cash-Secured Put', strike: 150, expiry: '2026-03-20', entryDate: '2026-02-20', premiumIn: 2, status: 'expired', exitDate: '2026-03-20', premiumOut: 0, pnl: 200 })
  ],
  tj_stocks: [
    stk({ id: 's1', ticker: 'SYNK', qty: 100, entryPrice: 60, entryDate: '2026-06-19', status: 'open' }),
    stk({ id: 's2', ticker: 'SYNM', qty: 10, entryPrice: 400, entryDate: '2026-04-01', status: 'open' }),
    stk({ id: 's3', ticker: 'SYNM', qty: 5, entryPrice: 420, entryDate: '2026-05-01', status: 'open' })
  ]
};
const writes = [];   // every non-GET REST request: { method, table }

function parseVal(v) { return v.replace(/^"(.*)"$/, '$1'); }
function filtersOf(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    let m;
    if ((m = /^eq\.(.*)$/.exec(v))) out.push(r => String(r[k] ?? '') === parseVal(m[1]));
    else if ((m = /^in\.\((.*)\)$/.exec(v))) { const set = m[1].split(',').map(parseVal); out.push(r => set.includes(String(r[k]))); }
    else if ((m = /^not\.in\.\((.*)\)$/.exec(v))) { const set = m[1].split(',').map(parseVal); out.push(r => !set.includes(String(r[k]))); }
  }
  return out;
}
async function rest(route) {
  const req = route.request();
  const url = new URL(req.url());
  const table = url.pathname.replace('/rest/v1/', '');
  const method = req.method();
  const json = (status, body, headers) => route.fulfill({ status, contentType: 'application/json', headers: headers || {}, body: body == null ? '' : JSON.stringify(body) });
  if (method !== 'GET' && method !== 'HEAD') writes.push({ method, table });
  if (table === 'profiles') {
    const row = { id: UID, arowana_plan: 'pro', arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: 'sub_synthetic' };
    return /vnd\.pgrst\.object/.test(req.headers()['accept'] || '') ? json(200, row) : json(200, [row]);
  }
  const rows = db[table];
  if (!rows) return method === 'GET' ? json(200, []) : json(201, null);
  const match = r => filtersOf(url).every(f => f(r));
  if (method === 'GET' || method === 'HEAD') {
    let out = rows.filter(match);
    const off = Number(url.searchParams.get('offset') || 0), lim = url.searchParams.get('limit');
    out = out.slice(off, lim == null ? undefined : off + Number(lim));
    return json(200, out, { 'content-range': `${off}-${off + out.length - 1}/*` });
  }
  if (method === 'POST') {
    const body = JSON.parse(req.postData() || '[]');
    const list = Array.isArray(body) ? body : [body];
    list.forEach(r => { const i = rows.findIndex(x => x.id === r.id); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push({ ...r }); });
    return /return=representation/.test(req.headers()['prefer'] || '') ? json(201, list) : json(201, null);
  }
  if (method === 'PATCH') {
    const body = JSON.parse(req.postData() || '{}');
    rows.forEach((r, i) => { if (match(r)) rows[i] = { ...r, ...body }; });
    return json(204, null);
  }
  if (method === 'DELETE') {
    for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1);
    return json(204, null);
  }
  return json(405, null);
}

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {} };
const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: UID, exp, role: 'authenticated', aud: 'authenticated', email: user.email }) + '.c3ludGhldGlj';
const session = { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/*', r => {
  const u = new URL(r.request().url());
  if (u.hostname === `${REF}.supabase.co`) {
    if (u.pathname.startsWith('/rest/v1/')) return rest(r);
    if (u.pathname === '/auth/v1/user') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (u.pathname === '/auth/v1/token') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    return r.fulfill({ status: 503, body: '' });
  }
  if (u.hostname !== '127.0.0.1') return r.abort();
  if (/\/login\.html$/.test(u.pathname) && r.request().isNavigationRequest()) return r.fulfill({ status: 204, body: '' });
  return r.continue();
});
await ctx.addInitScript(([s, ref, u]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
  localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: u.id, email: u.email }));
}, [session, REF, user]);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('dialog', d => d.accept());

// ── Income tab: wheel campaigns ──────────────────────────────────────────
await p.goto(BASE + '/portfolio-command.html?tab=income', { waitUntil: 'load' });
const gotPanel = await until(() => p.evaluate(() => /Wheel campaigns/.test((document.getElementById('pi-body') || {}).textContent || '')), 15000);
const income = await p.evaluate(() => (document.getElementById('pi-body') || {}).textContent || '');
check('income: wheel campaigns panel renders', gotPanel, income.slice(0, 300));
check('income: running campaign with premium-adjusted basis', /Running now/.test(income) && /SYNK/.test(income) && /58\.80/.test(income), income.slice(0, 600));
check('income: finished campaign listed for the period', /Finished in this period/.test(income) && /SYNP/.test(income), income.slice(0, 600));
check('income: old "Cost basis after premium" panel replaced', !/Cost basis after premium/.test(income));
await p.setViewportSize({ width: 375, height: 800 });
await p.waitForTimeout(300);
const w375 = await p.evaluate(() => document.documentElement.scrollWidth);
check('income at 375px: no horizontal page scroll (tables scroll in their panel)', w375 <= 376, w375);
await p.setViewportSize({ width: 1280, height: 900 });
check('income: settled = closed, expired or assigned', /settled trades \(closed, expired or assigned\)/.test(await p.textContent('#incomeTab')));

// ── Holdings: journal-backed edit ────────────────────────────────────────
await p.evaluate(() => switchTab('holdings'));
const rowsReady = await until(() => p.evaluate(() => document.querySelectorAll('.hold-row-edit').length >= 2), 15000);
check('holdings: rows built from journal lots', rowsReady);
await until(() => p.evaluate(() => window.journalSync && window.journalSync.getStatus() === 'synced'), 15000);
check('journal-sync runs on the page, pill hidden', await p.evaluate(() => window.journalSync.getStatus() === 'synced' && document.getElementById('journalSyncPill').hidden));

// Multi-lot holding: notice + link, no form.
await p.click('.hold-row-edit[data-holding-id="tjstocks::SYNM::Schwab"]');
const notice = await p.evaluate(() => {
  const r = document.getElementById('pcHoldModalRoot');
  const a = r && r.querySelector('a');
  return r ? { text: r.textContent, href: a && a.getAttribute('href'), form: !!r.querySelector('#hmShares') } : null;
});
check('multi-lot edit: notice links to the journal search', notice && /2 separate buys/.test(notice.text) && notice.href === 'trade-journal-pro.html?tab=stock&from=portfolio-command&q=SYNM' && !notice.form, notice);
await p.evaluate(() => document.getElementById('pcHoldModalRoot').remove());

// Single-lot holding: edit writes the journal lot.
await p.click('.hold-row-edit[data-holding-id="tjstocks::SYNK::Schwab"]');
await p.fill('#hmShares', '150');
await p.click('#hmSaveBtn');
check('single-lot edit: server lot updated', await until(() => (db.tj_stocks.find(r => r.id === 's1') || {}).payload?.qty === 150), db.tj_stocks.find(r => r.id === 's1'));
check('single-lot edit: holdings table shows it', await until(() => p.evaluate(() => /150/.test((document.querySelector('.hold-row-edit[data-holding-id="tjstocks::SYNK::Schwab"]') || {}).closest?.('tr')?.textContent || ''))));

// Add.
await p.click('#pcAddHoldingBtn');
await p.fill('#hmSymbol', 'synq');
await p.fill('#hmShares', '10');
await p.fill('#hmAvgCost', '25');
await p.evaluate(() => { const s = document.getElementById('hmAccount'); if (s && !s.value && s.options.length) s.value = s.options[0].value; });
await p.click('#hmSaveBtn');
check('add: new open lot in the journal', await until(() => db.tj_stocks.some(r => r.payload && r.payload.ticker === 'SYNQ' && r.payload.qty === 10 && r.status === 'open')), db.tj_stocks.map(r => r.payload && r.payload.ticker));

// Delete.
await until(() => p.evaluate(() => !document.getElementById('pcHoldModalRoot')));
await p.click('.hold-row-edit[data-holding-id="tjstocks::SYNK::Schwab"]');
await p.click('#hmDeleteBtn');
check('delete: journal lot removed on the server', await until(() => !db.tj_stocks.some(r => r.id === 's1')), db.tj_stocks.map(r => r.id));
check('nothing written to the retired portfolio table', !writes.some(w => w.table === 'portfolio'), writes);
check('no page errors', errors.length === 0, errors);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
