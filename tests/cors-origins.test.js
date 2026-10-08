// node --test tests/*.test.js
//
// The browser-facing functions that check the caller's origin
// (arowana-research, -billing-portal, -coach, -checkout), run as written with
// their imports stubbed. A preflight from the site, on the bare domain or on
// www, must get its own origin back, or the browser never sends the request
// (on 2026-10-08 staging showed "Market data is unreachable" with 72
// preflights and no POSTs). Other origins still get the configured site.
const test = require('node:test');
const assert = require('node:assert/strict');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'jsr:@supabase/supabase-js@2' || spec === 'npm:@supabase/supabase-js@2')
    return { url: 'data:text/javascript,export const createClient=()=>({});', shortCircuit: true };
  if (spec === 'npm:stripe@^17.0.0')
    return { url: 'data:text/javascript,export default class Stripe{constructor(){}};', shortCircuit: true };
  return next(spec, ctx);
}`));

const env = { AROWANA_SITE_URL: 'https://arowanaprofits.com/', SUPABASE_URL: 'https://x.invalid', SUPABASE_SERVICE_ROLE_KEY: 't',
  STRIPE_SECRET_KEY: 'sk_test_x', ANTHROPIC_API_KEY: 'k', FINNHUB_API_KEY: 'k' };
const warnings = [];
console.warn = (...a) => warnings.push(a.join(' '));
const handlers = {};
let current = null;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handlers[current] = h; } };

async function load(fn) {
  current = fn;
  await import(pathToFileURL(path.join(__dirname, '../supabase/functions/' + fn + '/index.ts')).href + '?t=' + fn);
  return handlers[fn];
}
async function preflight(h, origin) {
  const headers = { 'Access-Control-Request-Method': 'POST' };
  if (origin) headers.Origin = origin;
  const res = await h(new Request('https://x.invalid/', { method: 'OPTIONS', headers }));
  return res.headers.get('access-control-allow-origin');
}

for (const fn of ['arowana-research', 'arowana-billing-portal', 'arowana-coach', 'arowana-checkout']) {
  test(fn + ': the site on the bare domain and on www gets its own origin back', async () => {
    const h = await load(fn);
    assert.equal(await preflight(h, 'https://arowanaprofits.com'), 'https://arowanaprofits.com');
    assert.equal(await preflight(h, 'https://www.arowanaprofits.com'), 'https://www.arowanaprofits.com');
    assert.equal(await preflight(h, 'http://localhost:8765'), 'http://localhost:8765');
  });
  test(fn + ': another origin gets the configured site (so the browser refuses it), and is logged', async () => {
    const h = handlers[fn] || await load(fn);
    warnings.length = 0;
    assert.equal(await preflight(h, 'https://evil.example'), 'https://arowanaprofits.com');
    assert.ok(warnings.some((w) => /origin not allowed: https:\/\/evil\.example/.test(w)), warnings.join('|'));
  });
}
