/* ============================================================================
   explain.js — "Explain in plain English" for numbers the page already shows.
   ----------------------------------------------------------------------------
   The page passes the facts it calculated (label/value strings). The
   arowana-explain edge function has Claude describe them in a few sentences
   and rejects any reply containing a number that isn't in those facts, so
   the AI never produces a figure of its own.

   Use:
       AP_EXPLAIN.attach(button, outputElement, 'trade-check', function () {
         return [{ label: 'Premium', value: '$95' }, …];
       });

       AP_EXPLAIN.attachCase(button, outputElement, function () { return facts; });
         → Check a Trade's "Argue both sides": a case for and a case against,
           under the same number guard.

   Load after app-config.js (needs window.apGetAccessToken).
   ========================================================================== */
(function (window, document) {
  'use strict';
  if (window.AP_EXPLAIN) return;

  var FN = 'https://pbojacnagutipfhcxltj.supabase.co/functions/v1/arowana-explain';
  var MAX_FACTS = 40, MAX_LEN = 200;

  function clean(facts) {
    return (facts || []).filter(function (f) { return f && f.label; }).slice(0, MAX_FACTS).map(function (f) {
      return { label: String(f.label).slice(0, MAX_LEN), value: String(f.value == null ? '' : f.value).slice(0, MAX_LEN) };
    });
  }

  async function request(kind, facts) {
    var token = typeof window.apGetAccessToken === 'function' ? await window.apGetAccessToken() : null;
    if (!token) throw new Error('Sign in to get an explanation.');
    var res = await fetch(FN, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ kind: kind, facts: clean(facts) })
    });
    var body = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(body.error || 'The explanation could not be written right now.');
    return body;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function show(out, parts) {
    out.textContent = '';
    parts.forEach(function (p) { if (p) out.appendChild(p); });
    out.hidden = false;
  }

  function attach(button, out, kind, factsFn) {
    if (!button || !out) return;
    button.addEventListener('click', async function () {
      var label = button.textContent;
      button.disabled = true;
      button.textContent = 'Writing…';
      show(out, [el('p', 'ax-wait', 'Writing a plain-English summary of these numbers…')]);
      try {
        var r = await request(kind, factsFn());
        if (r.text) {
          show(out, [el('p', 'ax-text', r.text),
            el('p', 'ax-note', 'Written by AI from the numbers above. It can only repeat those numbers; a reply with any number of its own is thrown away.')]);
        } else {
          show(out, [el('p', 'ax-note', r.reason === 'refusal'
            ? 'No summary this time. The numbers above are the full picture.'
            : 'No summary this time: the AI kept adding numbers that are not in your data, so nothing is shown. The numbers above are the full picture.')]);
        }
      } catch (e) {
        show(out, [el('p', 'ax-note', e && e.message ? e.message : 'The explanation could not be written right now.')]);
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  }

  /* Case for / case against. Same request, kind 'trade-case'; the function
     answers { case: { for, against } } or { case: null, reason }. */
  function attachCase(button, out, factsFn) {
    if (!button || !out) return;
    button.addEventListener('click', async function () {
      var label = button.textContent;
      button.disabled = true;
      button.textContent = 'Writing…';
      show(out, [el('p', 'ax-wait', 'Writing the strongest case on each side…')]);
      try {
        var r = await request('trade-case', factsFn());
        if (r.case) {
          var cols = el('div', 'ax-case');
          [['for', 'The case for'], ['against', 'The case against']].forEach(function (s) {
            var c = el('div', 'ax-side ax-' + s[0]);
            c.appendChild(el('h4', null, s[1]));
            c.appendChild(el('p', 'ax-text', r.case[s[0]]));
            cols.appendChild(c);
          });
          show(out, [cols, el('p', 'ax-note', 'Written by AI from the points above. It does not pick a side, and any reply with a number of its own is thrown away. The decision is yours.')]);
        } else {
          show(out, [el('p', 'ax-note', r.reason === 'refusal'
            ? 'No write-up this time. The points above are the full picture.'
            : 'No write-up this time: the AI kept adding numbers that are not in your data, so nothing is shown. The points above are the full picture.')]);
        }
      } catch (e) {
        show(out, [el('p', 'ax-note', e && e.message ? e.message : 'The write-up could not be written right now.')]);
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  }

  if (!document.getElementById('ax-styles')) {
    var st = document.createElement('style');
    st.id = 'ax-styles';
    st.textContent =
      '.ax-out{margin-top:10px;border:1px solid var(--border,#e2e8f0);border-left:4px solid var(--brand,#0b4f8a);border-radius:10px;padding:10px 12px;background:var(--surface,#fff)}' +
      '.ax-out[hidden]{display:none}' +
      '.ax-text{margin:0;font-size:.9rem;line-height:1.55;color:var(--text-primary,#0d1b2a)}' +
      '.ax-wait{margin:0;font-size:.85rem;color:var(--text-muted,#64748b)}' +
      '.ax-note{margin:6px 0 0;font-size:.74rem;color:var(--text-muted,#64748b);line-height:1.45}' +
      '.ax-note:first-child{margin-top:0}' +
      '.ax-btn{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:var(--radius-sm,8px);border:1px solid var(--border-strong,#cbd5e1);background:var(--surface,#fff);color:var(--text-primary,#0d1b2a);font:600 .84rem var(--font-sans,system-ui);cursor:pointer}' +
      '.ax-btn[disabled]{opacity:.6;cursor:wait}' +
      '.ax-case{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
      '.ax-side h4{margin:0 0 4px;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}' +
      '.ax-for h4{color:var(--success,#0e9f6e)}.ax-against h4{color:var(--danger,#c81e4a)}' +
      '@media(max-width:640px){.ax-case{grid-template-columns:1fr}}';
    (document.head || document.documentElement).appendChild(st);
  }

  window.AP_EXPLAIN = { request: request, attach: attach, attachCase: attachCase };
})(window, document);
