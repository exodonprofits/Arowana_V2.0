// Home and pricing read as on sale (no waitlist wording, no trial that
// checkout doesn't give), and every paid button leads to checkout.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/pricing_open_check.mjs
//
// Signed out, every non-localhost request aborted.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`);
}

const browser = await chromium.launch();
async function open(path, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/' + path, { waitUntil: 'load' });
  return { ctx, p, errors };
}
const visible = p => p.evaluate(() => document.body.innerText);
const buttons = p => p.evaluate(() => [...document.querySelectorAll('a[data-checkout]')].map(a => ({ plan: a.dataset.checkout, text: a.textContent.trim(), href: a.getAttribute('href') })));

{
  const { ctx, p, errors } = await open('pricing.html');
  const text = await visible(p);
  check('pricing: no waitlist or "not on sale" wording', !/waitlist|aren.t on sale|checkout opens/i.test(text), (text.match(/.{0,60}(waitlist|on sale|checkout opens).{0,60}/i) || [])[0]);
  check('pricing: no trial promised', !/\b\d+-day trial|Try Pro for \d+ days/i.test(text) && /There is no trial period/.test(text));
  let b = await buttons(p);
  check('pricing: Pro buttons say Start Pro and go to monthly checkout', b.filter(x => x.plan === 'pro').length === 2 && b.filter(x => x.plan === 'pro').every(x => x.text === 'Start Pro' && x.href === 'checkout.html?plan=pro&cycle=monthly'), b);
  check('pricing: Founders button goes to checkout', b.some(x => x.plan === 'founders' && x.text === 'Become a founding member' && x.href === 'checkout.html?plan=founders'), b);
  check('pricing: Founders note says what is charged', /\$299 billed today, then yearly at the same rate\. 30-day money-back guarantee/.test(text));
  await p.click('[data-cycle="annual"]').catch(() => {});
  b = await buttons(p);
  check('pricing: annual toggle carries the cycle to checkout', b.filter(x => x.plan === 'pro').every(x => x.href === 'checkout.html?plan=pro&cycle=annual'), b);
  check('pricing: shipped tools not marked coming soon', !/Risk guardrails[^\n]*coming soon|pattern detection[^\n]*coming soon/i.test(text));
  check('pricing: unshipped tools still marked', /Daily brief on your open positions[\s\S]{0,20}Coming soon/i.test(text) && /5 custom alerts[\s\S]{0,20}Coming soon/i.test(text), text.match(/Daily brief.{0,40}/));
  check('pricing: guardrails FAQ names only real rules', !/time decay/i.test(text) && /an earnings date before your expiration/.test(text));
  const grid = await p.evaluate(() => [...document.querySelectorAll('.comparison-grid .comp-row')].map(r => [...r.children].map(c => c.textContent.trim())));
  check('pricing: comparison rows have Feature, Free, Pro (3 columns)', grid.length > 5 && grid.every(r => r.length === 3) && await p.evaluate(() => getComputedStyle(document.querySelector('.comparison-grid')).gridTemplateColumns.split(' ').length === 3), grid.filter(r => r.length !== 3));
  const roll = grid.find(r => /^Roll coach/.test(r[0])) || [];
  check('pricing: Pro includes roll coach, AI coach & patterns', roll[2] === '\u2713', roll);
  check('pricing: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('pricing.html', 375);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('pricing 375px: no horizontal page scroll', w <= 376, w);
  check('pricing 375px: menu has sign-in and every desktop link', await p.evaluate(() => { document.getElementById('navBurger').click(); const t = document.getElementById('mobileMenu').textContent; return document.getElementById('mobileMenu').dataset.open === 'true' && /Sign In/.test(t) && /Wheel calculator/.test(t) && /Support/.test(t); }));
  check('pricing 375px: no page errors', errors.length === 0, errors);
  await ctx.close();
}
for (const width of [1024, 1280, 1440, 1920]) {
  const { ctx, p } = await open('pricing.html', width);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check(`pricing ${width}px: no horizontal page scroll`, w <= width, w);
  await ctx.close();
}
{
  const { ctx, p, errors } = await open('index.html');
  const og = await p.evaluate(() => document.querySelector('meta[property="og:description"]').content);
  check('index: share description gives the Founders price, not a waitlist', /Founding members: \$299 a year\.$/.test(og) && !/waitlist/i.test(og), og);
  check('index: Founders button goes to checkout', await p.evaluate(() => [...document.querySelectorAll('#founders a')].some(a => a.getAttribute('href') === 'checkout.html?plan=founders' && /Become a founding member/.test(a.textContent))));
  const feats = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#inside .wd-feature')].map(f => [f.querySelector('h3').textContent.trim(), f.querySelector('.wd-status').textContent.trim()])));
  check('index: every wheel tool marked available with V2 plan labels', JSON.stringify(feats) === JSON.stringify({
    'Premium income tracker': 'Available now \u00b7 Pro', 'Covered call and put scanners': 'Available now \u00b7 Pro',
    'Roll and risk coach': 'Available now \u00b7 Pro', 'Check a trade before you place it': 'Available now \u00b7 Pro',
    'Your wheel, each morning': 'Available now', 'Trade journal': 'Available now \u00b7 Free' }), feats);
  const inside = await p.evaluate(() => document.getElementById('inside').innerText);
  check('index: no "being built" / "Founders first" wording; CSV import said to be Pro', !/being built now|Founders first/.test(inside) && /On Pro, import your broker's CSV/.test(inside), inside.slice(0, 300));
  const links = await p.evaluate(() => [...document.querySelectorAll('#wdNowLinks a')].map(a => a.getAttribute('href')));
  check('index: tool links include Wheel Coach, Check a trade and Income', ['arowana-trader.html', 'options-hub.html?tab=check', 'portfolio-command.html?tab=income'].every(h => links.includes(h)), links);
  const status = [];
  for (const h of links) { const r = await p.request.get(BASE + '/' + h.split('?')[0]); status.push([h, r.status()]); }
  check('index: every tool link resolves', status.every(([, c]) => c === 200), status);
  check('index: form messages offer updates, not "when checkout opens"', await p.evaluate(() => !/checkout opens|Join the waitlist/.test([...document.scripts].map(s => s.textContent).join('\n'))));
  check('index: no page errors', errors.length === 0, errors);
  await ctx.close();
}
{
  // Signed-in hero line (the page reads the cached user to decide).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.invalid' })); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  const foot = await p.evaluate(() => document.getElementById('wdHeroFoot').textContent.trim());
  check('index signed in: hero line offers Founders at $299, no waitlist', /Become a founding member: every wheel tool for \$299 a year\./.test(foot) && !/waitlist/i.test(foot), foot);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
