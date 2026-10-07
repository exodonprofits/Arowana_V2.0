// node --test tests/*.test.js
//
// arowana-explain, run as written: the TypeScript is loaded with Node's type
// stripping, Supabase and the Anthropic SDK are faked, and Deno.serve hands
// over the handler. Covers the Thesis Builder's 'thesis' kind (three
// scenarios as fields, under the number guard) and checks 'trade-case' and
// plain-text kinds still answer as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'npm:@supabase/supabase-js@2') return { url: 'data:text/javascript,export const createClient=(...a)=>globalThis.__fakeSupabase(...a);', shortCircuit: true };
  if (spec === 'npm:@anthropic-ai/sdk') return { url: 'data:text/javascript,' + encodeURIComponent(
    'class APIError extends Error{};class RateLimitError extends APIError{};' +
    'export default class Anthropic{constructor(){this.beta={messages:{create:(b)=>globalThis.__fakeCreate(b)}}}' +
    'static APIError=APIError;static RateLimitError=RateLimitError}'), shortCircuit: true };
  return next(spec, ctx);
}`));

let plan = 'pro';
let replies = [];   // queued model replies: strings (text) or { refusal: true }
let sent = [];      // request bodies
globalThis.__fakeSupabase = () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { arowana_plan: plan, arowana_plan_status: 'active' } }) }) }) }),
  rpc: async (name) => name === 'ap_claim_usage' ? { data: [{ allowed: true, used: 1, remaining: 149 }], error: null } : { error: null },
});
globalThis.__fakeCreate = async (body) => {
  sent.push(JSON.parse(JSON.stringify(body)));
  const r = replies.shift();
  if (r && r.refusal) return { stop_reason: 'refusal', content: [], usage: { input_tokens: 5, output_tokens: 0 } };
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: r }], usage: { input_tokens: 10, output_tokens: 10 } };
};
const env = { ANTHROPIC_API_KEY: 'test-key', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test' };
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const ready = import(pathToFileURL(path.join(__dirname, '../supabase/functions/arowana-explain/index.ts')).href);
async function call(body) {
  await ready;
  const res = await handler(new Request('https://x.invalid/', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}

const FACTS = [
  { label: 'Company', value: 'Synthetic Corp (SYN), Technology' },
  { label: 'Revenue growth, last 12 months vs year before', value: '8.2%' },
  { label: 'Revenue growth, 5-year average', value: '11.4%' },
  { label: 'Return on equity, last 12 months', value: '24.1%' },
  { label: 'Price to earnings, last 12 months', value: '31.5' },
  { label: 'Debt to equity', value: '0.62' },
];
const GOOD = {
  bear: 'At a price to earnings of 31.5 the stock already assumes growth, while revenue growth of 8.2% is below the 11.4% five-year pace.',
  bear_if: 'Growth keeps slowing in the next reports and return on equity falls from 24.1%.',
  base: 'The business stays highly profitable with return on equity of 24.1% and modest debt at 0.62.',
  base_if: 'Revenue keeps growing near recent rates and margins hold.',
  bull: 'If growth returns toward the 11.4% five-year average, the premium valuation is easier to justify.',
  bull_if: 'Reports show growth speeding up again without more debt.',
};

test('thesis: three scenarios returned as fields, bear first in the schema', async () => {
  replies = [JSON.stringify(GOOD)]; sent = [];
  const r = await call({ kind: 'thesis', facts: FACTS });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.thesis, GOOD);
  const req = sent[0];
  assert.deepEqual(req.output_config.format.schema.required, ['bear', 'bear_if', 'base', 'base_if', 'bull', 'bull_if']);
  assert.equal(req.output_config.format.type, 'json_schema');
  const prompt = req.messages[0].content;
  assert.match(prompt, /one company's reported fundamentals/);
  assert.match(prompt, /worst first/);
  assert.match(prompt, /Do not estimate a fair value, a price target/);
  assert.match(prompt, /- Return on equity, last 12 months: 24\.1%/);
});

test('thesis: a scenario with a number not in the facts is retried, then dropped', async () => {
  const bad = { ...GOOD, bull: 'The stock could reach 250 within two years.' };
  replies = [JSON.stringify(bad), JSON.stringify(bad)]; sent = [];
  const r = await call({ kind: 'thesis', facts: FACTS });
  assert.equal(r.body.thesis, null);
  assert.equal(r.body.reason, 'numbers');
  assert.equal(sent.length, 2);
  assert.match(sent[1].messages[2].content, /not in the facts: 250/);
});

test('thesis: retry fixes it', async () => {
  const bad = { ...GOOD, bull: 'The stock could reach 250 within two years.' };
  replies = [JSON.stringify(bad), JSON.stringify(GOOD)]; sent = [];
  const r = await call({ kind: 'thesis', facts: FACTS });
  assert.deepEqual(r.body.thesis, GOOD);
});

test('thesis: missing fields asks for all six', async () => {
  replies = [JSON.stringify({ bear: GOOD.bear }), JSON.stringify(GOOD)]; sent = [];
  const r = await call({ kind: 'thesis', facts: FACTS });
  assert.deepEqual(r.body.thesis, GOOD);
  assert.match(sent[1].messages[2].content, /all six fields/);
});

test('thesis: Free plan is refused before any model call', async () => {
  plan = 'free'; replies = []; sent = [];
  const r = await call({ kind: 'thesis', facts: FACTS });
  plan = 'pro';
  assert.equal(r.status, 402);
  assert.equal(sent.length, 0);
});

test('trade-case still answers { case: { for, against } }', async () => {
  replies = [JSON.stringify({ for: 'Premium is $95.', against: 'Little room to the strike.' })]; sent = [];
  const r = await call({ kind: 'trade-case', facts: [{ label: 'Premium', value: '$95' }] });
  assert.deepEqual(r.body.case, { for: 'Premium is $95.', against: 'Little room to the strike.' });
  assert.deepEqual(sent[0].output_config.format.schema.required, ['for', 'against']);
});

test('plain-text kinds unchanged: no schema, text back', async () => {
  replies = ['Income was $95 this month.']; sent = [];
  const r = await call({ kind: 'income', facts: [{ label: 'Income', value: '$95' }] });
  assert.equal(r.body.text, 'Income was $95 this month.');
  assert.equal(sent[0].output_config.format, undefined);
});

test('unknown kind refused', async () => {
  const r = await call({ kind: 'price-forecast', facts: FACTS });
  assert.equal(r.status, 400);
});
