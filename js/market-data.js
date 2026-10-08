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

  // Token comes from the shared helper in app-config.js, which waits for
  // the shared client and refreshes once before calling anyone signed out.
  // Some pages load app-config.js after this file, so give it a moment to
  // define the helper instead of reading window.supabaseClient at a time
  // it may not exist yet (that was one source of false "Sign in" errors).
  function waitForHelper(ms) {
    if (typeof window.apGetAccessToken === 'function') return Promise.resolve(true);
    return new Promise(function (resolve) {
      var deadline = Date.now() + ms;
      (function poll() {
        if (typeof window.apGetAccessToken === 'function') return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(poll, 100);
      })();
    });
  }

  async function accessToken(forceRefresh) {
    if (!(await waitForHelper(10000))) return null;
    try { return await window.apGetAccessToken({ forceRefresh: !!forceRefresh }); }
    catch (e) { return null; }
  }

  function callResearch(token, path, query) {
    return nativeFetch(FN, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ path: path, query: query })
    });
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

  /* Pages still ask "is there a Finnhub key?" before they fetch, from when
     users pasted their own (Account now clears those). Every finnhub.io call
     is answered server-side below, so give those checks a placeholder: the
     token is dropped before the request leaves (see `if (k !== 'token')`). */
  var SERVER_KEY = 'arowana-server';
  window.AP_SERVER_MARKET_DATA = true;
  try {
    var stored = JSON.parse(window.localStorage.getItem('ap_user_api_keys') || '{}') || {};
    if (!stored.finnhub) {
      stored.finnhub = SERVER_KEY;
      window.localStorage.setItem('ap_user_api_keys', JSON.stringify(stored));
    }
  } catch (e) { /* storage blocked: pages fall back to their own messages */ }
  window.AP_USER_KEYS = window.AP_USER_KEYS || {};
  if (!window.AP_USER_KEYS.finnhub) window.AP_USER_KEYS.finnhub = SERVER_KEY;

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
      res = await callResearch(token, path, query);
      // 401 with a token we believed was good: it expired or was rotated
      // under us. Swap in a fresh one and retry once before giving up.
      if (res.status === 401) {
        var fresh = await accessToken(true);
        if (fresh && fresh !== token) res = await callResearch(fresh, path, query);
      }
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
