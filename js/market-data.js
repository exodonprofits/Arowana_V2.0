/* ============================================================================
   market-data.js — every market-data request goes through our licensed key.
   ----------------------------------------------------------------------------
   Pages used to call Finnhub straight from the browser with a key the user
   pasted into their account. Nobody should have to do that, so requests to
   finnhub.io are intercepted here and rerouted to the arowana-research edge
   function, which holds the key server-side.

   Responses come back untouched, so existing call sites need no changes.
   Load it after supabase_min.js and before the page's own scripts.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__apMarketDataShim) return;         // safe if a page loads it twice
  window.__apMarketDataShim = true;

  var FN = 'https://pbojacnagutipfhcxltj.supabase.co/functions/v1/arowana-research';
  var nativeFetch = window.fetch.bind(window);
  var lastUsage = null;

  function client() { return window.supabaseClient || window.sbClient || null; }

  async function accessToken() {
    var sb = client();
    if (!sb || !sb.auth) return null;
    try {
      var s = await sb.auth.getSession();
      return (s && s.data && s.data.session && s.data.session.access_token) || null;
    } catch (e) { return null; }
  }

  function notice(message) {
    var el = document.getElementById('apDataNotice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'apDataNotice';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;' +
        'max-width:92vw;background:#fdf3e2;color:#7c4a03;border:1px solid #f3d29a;border-radius:12px;' +
        'padding:12px 16px;font:600 .87rem system-ui,sans-serif;box-shadow:0 10px 30px rgba(13,27,42,.18)';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 8000);
  }

  function paintMeter() {
    var el = document.getElementById('researchUsage');
    if (!el || !lastUsage) return;
    el.textContent = lastUsage.remaining + ' of ' + lastUsage.limit + ' lookups left today';
    el.hidden = false;
  }

  window.AP_MARKET_USAGE = function () { return lastUsage; };

  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('finnhub.io/api/v1') === -1) return nativeFetch(input, init);

    var parsed;
    try { parsed = new URL(url); } catch (e) { return nativeFetch(input, init); }

    var path = parsed.pathname.replace('/api/v1', '');
    var query = {};
    parsed.searchParams.forEach(function (v, k) { if (k !== 'token') query[k] = v; });

    var token = await accessToken();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Sign in to load market data' }),
        { status: 401, headers: { 'content-type': 'application/json' } });
    }

    var res;
    try {
      res = await nativeFetch(FN, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ path: path, query: query })
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Market data is unreachable right now' }),
        { status: 503, headers: { 'content-type': 'application/json' } });
    }

    var lim = res.headers.get('x-usage-limit');
    if (lim) {
      lastUsage = {
        used: Number(res.headers.get('x-usage-used')),
        remaining: Number(res.headers.get('x-usage-remaining')),
        limit: Number(lim)
      };
      paintMeter();
    }
    if (res.status === 429 || res.status === 402) {
      var body = await res.clone().json().catch(function () { return {}; });
      notice(body.message || 'You have reached today\u2019s lookup limit.');
      if (body.usage) { lastUsage = body.usage; paintMeter(); }
    }
    return res;
  };
})();
