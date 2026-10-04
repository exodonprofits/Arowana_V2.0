/* ============================================================================
   number-guard.js — AI may explain numbers, never produce them.
   ----------------------------------------------------------------------------
   Every number in a model's reply must already appear in the facts the app
   gave it (the app's own, deterministic calculations). A reply that carries
   any other number is rejected; the caller retries once with the offending
   numbers named, then falls back to showing no AI text at all.

   Matching is deliberately forgiving about *formatting* and strict about
   *values*:
     - $1,234.50  1234.5  1,234  → same value
     - a fact of 16.47 may be written 16.5 or 16 (rounded, not recomputed)
     - a fact of 12,480 may be written 12.5k / 12k; 1,250,000 as 1.25M
     - signs are ignored (dates like 2026-10-30 would otherwise read as -10)
   Spelled-out numbers ("two") are not checked.

   Pure ES module: used by the arowana-explain and arowana-ai-coach edge
   functions (Deno) and by tests/number-guard.test.js (node).
   ========================================================================== */

// Values any options explanation may use without them being in the facts.
var ALWAYS = [100];   // shares per contract

var NUM = /\$?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?%|[kKM](?![A-Za-z]))?/g;

/* Every number in a piece of text: { raw, value, scale } where scale is
   1, 1e3 (k) or 1e6 (M), and value is the number as written (before scale). */
export function extractNumbers(text) {
  var out = [], m;
  var s = String(text == null ? '' : text);
  NUM.lastIndex = 0;
  while ((m = NUM.exec(s))) {
    // Skip digits glued to letters on the left (e.g. "Q3", "S&P500"); tickers
    // and labels are not quantities the model computed.
    var prev = m.index > 0 ? s[m.index - 1] : '';
    if (/[A-Za-z]/.test(prev)) continue;
    var suffix = (m[2] || '').trim();
    out.push({
      raw: m[0].trim(),
      value: Number(m[1].replace(/,/g, '')),
      scale: suffix === 'k' || suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : 1
    });
  }
  return out;
}

function roundTo(v, dp) { var f = Math.pow(10, dp); return Math.round(v * f) / f; }
function same(a, b) { return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)); }

/* Does the written number n (value + scale) represent the fact a? */
function represents(n, a) {
  a = Math.abs(a);
  if (n.scale === 1) {
    if (same(n.value, a)) return true;
    for (var dp = 0; dp <= 2; dp++) if (same(n.value, roundTo(a, dp))) return true;
    return false;
  }
  var scaled = a / n.scale;
  for (var d = 0; d <= 2; d++) if (same(n.value, roundTo(scaled, d))) return true;
  return false;
}

/* The numbers the facts allow, as plain values. `facts` may be a string, an
   array of strings, or an array of { label, value } objects. */
export function allowedValues(facts) {
  var texts = [];
  (Array.isArray(facts) ? facts : [facts]).forEach(function (f) {
    if (f == null) return;
    if (typeof f === 'object') { texts.push(String(f.label || '')); texts.push(String(f.value == null ? '' : f.value)); }
    else texts.push(String(f));
  });
  var vals = [];
  extractNumbers(texts.join('\n')).forEach(function (n) { vals.push(n.value * n.scale); });
  return vals.concat(ALWAYS);
}

/* { ok, unsupported: [raw, …] } — ok when every number in the reply is one
   of the allowed values (see the matching rules above). */
export function verify(reply, facts) {
  var allowed = allowedValues(facts);
  var unsupported = [];
  extractNumbers(reply).forEach(function (n) {
    var fine = allowed.some(function (a) { return represents(n, a); });
    if (!fine && unsupported.indexOf(n.raw) === -1) unsupported.push(n.raw);
  });
  return { ok: unsupported.length === 0, unsupported: unsupported };
}
