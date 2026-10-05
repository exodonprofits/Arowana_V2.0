// ATD-109: Account email preferences (account.html#email), on synthetic data.
//
//   BASE=http://127.0.0.1:8765 node scripts/browser/email_prefs_check.mjs
//
// Runs against the fake Supabase (scripts/browser/lib/fake_supabase.mjs) with
// arowana-digest stubbed: previews are returned, never sent.
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
const profile = plan => ({ id: UID, arowana_plan: plan, arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: plan === 'free' ? null : 'sub_synthetic' });

const browser = await chromium.launch();
async function open({ plan = 'pro', prefs = [], digest } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const calls = [];
  const db = { profiles: [profile(plan)], ap_email_prefs: prefs };
  const fake = await installFakeSupabase(ctx, db, { functions: { 'arowana-digest': async (req) => { calls.push(req); return digest ? digest(req) : { json: { subject: 'Synthetic subject', html: '<p id="x">Synthetic email body</p>' } }; } } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/account.html#email', { waitUntil: 'load' });
  return { ctx, p, errors, db, fake, calls };
}
const state = p => p.evaluate(() => [...document.querySelectorAll('[data-email-pref]')].map(b => ({ k: b.getAttribute('data-email-pref'), on: b.checked, dis: b.disabled })));
const msg = p => p.evaluate(() => document.getElementById('emailMsg').textContent);

// ── Saved preferences load; toggling saves ───────────────────────────────
{
  const { ctx, p, errors, db, calls } = await open({ prefs: [{ user_id: UID, morning: true, expiry_week: false, monthly: false }] });
  check('#email section exists (the digest\'s "Email settings" link)', await p.evaluate(() => !!document.querySelector('#email .section-title')));
  check('saved preferences load and the toggles enable', await until(async () => { const s = await state(p); return s.length === 3 && s.every(x => !x.dis) && s[0].on && !s[1].on && !s[2].on; }), await state(p));
  await p.click('[data-email-pref="expiry_week"]');
  check('toggle saves all three to ap_email_prefs', await until(() => db.ap_email_prefs.length === 1 && db.ap_email_prefs[0].expiry_week === true && db.ap_email_prefs[0].morning === true && db.ap_email_prefs[0].monthly === false), db.ap_email_prefs);
  check('"Saved." shown', await until(async () => (await msg(p)) === 'Saved.'), await msg(p));

  await p.click('[data-email-preview="daily"]');
  check('preview built by arowana-digest with the user token', await until(() => calls.length === 1) && calls[0].body && calls[0].body.preview === 'daily' && /^Bearer /.test(calls[0].headers.authorization || ''), calls[0] && calls[0].body);
  check('preview shown in a sandboxed frame with its subject', await until(() => p.evaluate(() => !document.getElementById('emailPreview').hidden && /Synthetic email body/.test(document.getElementById('emailPreviewFrame').srcdoc) && document.getElementById('emailPreviewFrame').getAttribute('sandbox') === '' && /Synthetic subject/.test(document.getElementById('emailPreviewSubject').textContent))));
  await p.click('#emailPreviewClose');
  check('preview closes', await p.evaluate(() => document.getElementById('emailPreview').hidden));
  check('pro: no plan note', !/sent on Pro/.test(await p.textContent('#emailPlanNote')));
  check('no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── First save creates the row; empty preview; Free plan note ────────────
{
  const { ctx, p, errors, db } = await open({ plan: 'free', digest: () => ({ json: { empty: true } }) });
  check('no saved row: all off', await until(async () => { const s = await state(p); return s.length === 3 && s.every(x => !x.on && !x.dis); }), await state(p));
  await p.click('[data-email-pref="morning"]');
  check('first toggle creates the row', await until(() => db.ap_email_prefs.length === 1 && db.ap_email_prefs[0].user_id === UID && db.ap_email_prefs[0].morning === true), db.ap_email_prefs);
  await p.click('[data-email-preview="monthly"]');
  check('empty preview explains nothing would be sent', await until(async () => /no statement would be sent/.test(await msg(p))), await msg(p));
  check('free: note says emails are sent on Pro', await until(async () => /sent on Pro/.test(await p.textContent('#emailPlanNote'))));
  check('free: no page errors', errors.length === 0, errors);
  await ctx.close();
}

// ── Save fails: toggle reverts ───────────────────────────────────────────
{
  const { ctx, p } = await open();
  await until(async () => (await state(p)).every(x => !x.dis));
  await ctx.route('**/rest/v1/ap_email_prefs*', r => r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic"}' }) : r.fallback());
  await p.click('[data-email-pref="monthly"]');
  check('failed save: toggle reverts and says so', await until(async () => /not saved/.test(await msg(p)) && !(await state(p))[2].on), [await msg(p), await state(p)]);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
