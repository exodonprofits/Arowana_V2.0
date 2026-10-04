/* ============================================================================
   wheel-status.js — "your wheel today", loaded once for any page that needs it
   ----------------------------------------------------------------------------
   Reads the journal (localStorage tj_options_v2 / tj_stocks_v2), the nightly
   closes (market_snapshots), earnings dates (one Finnhub calendar call via
   js/market-data.js) and wheel capital (ap_risk_settings), then runs
   wheelStatus() from supabase/functions/arowana-digest/digest.js — the same
   code that builds the daily email, so pages and email cannot disagree.

   Use:
       var r = await AP_WHEELSTATUS.load({ force: false, quote: fetchPriceFn });
       r.status          wheelStatus() output: sections, puts, calls, credit,
                         collateral, shares, capital, free
       r.D               the digest module (usd(), openShorts(), …)
       r.symbols, r.priceDate, r.live, r.earningsOk, r.legs
       r.shorts          open short puts and calls (digest openShorts())
       r.prices          { SYM: price } used for the checks above
       await AP_WHEELSTATUS.digest()  → the digest module on its own
       AP_WHEELSTATUS.coachContext(r.status) → { openPositions, wheelCapital, committed }
                         the fields arowana-ai-coach reads

   `quote` is optional: a function(symbol) → price used only for symbols with
   no close on file. Market data is cached per day and symbol list for ten
   minutes; the journal is re-read on every call.

   Load after sb.js and market-data.js.
   ========================================================================== */
(function (window) {
  'use strict';
  if (window.AP_WHEELSTATUS) return;

  var SRC = (document.currentScript && document.currentScript.src) || (location.origin + '/js/wheel-status.js');
  /* V2.0 serves the digest module from js/ (a byte-for-byte copy of the deployed
     arowana-digest/digest.js, checked 2026-10-04); the edge-function source is
     not in this repository yet. */
  var DIGEST = new URL('./digest.js?v=20261004f', SRC).href;
  var TTL = 10 * 60000;
  var digest = null, cache = null;

  function client() {
    var c = window.supabaseClient || window.sbClient;
    return c && typeof c.from === 'function' ? c : null;
  }
  // YYYY-MM-DD in Chicago, the same "today" the emails use.
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()); }
  function read(key) {
    try { var v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  async function closes(sb, symbols) {
    var prices = {}, priceDate = null;
    if (!sb || !symbols.length) return { prices: prices, priceDate: priceDate };
    try {
      var r = await sb.from('market_snapshots').select('symbol,ts,ohlcv').eq('tf', '1d')
        .in('symbol', symbols).order('ts', { ascending: false }).limit(symbols.length * 5);
      (r.data || []).forEach(function (m) {
        var c = Number(m.ohlcv && m.ohlcv.close);
        if (prices[m.symbol] != null || !isFinite(c) || !c) return;
        prices[m.symbol] = c;
        var d = String(m.ts).slice(0, 10);
        if (!priceDate || d < priceDate) priceDate = d;      // report the oldest close used
      });
    } catch (e) { console.warn('[wheel] closes failed', e); }
    return { prices: prices, priceDate: priceDate };
  }

  async function earnings(symbols, day) {
    var out = {};
    if (!symbols.length) return { earnings: out, ok: false };
    try {
      var to = new Date(Date.parse(day + 'T00:00:00Z') + 60 * 86400000).toISOString().slice(0, 10);
      var r = await fetch('https://finnhub.io/api/v1/calendar/earnings?from=' + day + '&to=' + to);
      if (!r.ok) return { earnings: out, ok: false };
      var j = await r.json(), want = {};
      symbols.forEach(function (s) { want[s] = true; });
      ((j && j.earningsCalendar) || []).forEach(function (e) {
        if (!e || !want[e.symbol] || !e.date) return;
        if (!out[e.symbol] || e.date < out[e.symbol]) out[e.symbol] = e.date;
      });
      return { earnings: out, ok: true };
    } catch (e) { console.warn('[wheel] earnings failed', e); return { earnings: out, ok: false }; }
  }

  async function capital(sb) {
    if (!sb) return null;
    try {
      var s = await sb.auth.getSession();
      var u = s && s.data && s.data.session && s.data.session.user;
      if (!u) return null;
      var r = await sb.from('ap_risk_settings').select('wheel_capital').eq('user_id', u.id).maybeSingle();
      var v = Number(r.data && r.data.wheel_capital);
      return isFinite(v) && v > 0 ? v : null;
    } catch (e) { return null; }
  }

  async function getDigest() {
    if (!digest) digest = await import(DIGEST);
    return digest;
  }

  async function load(opts) {
    opts = opts || {};
    await getDigest();
    var D = digest, day = today();
    var options = read('tj_options_v2'), stocks = read('tj_stocks_v2');
    var legs = D.openShorts(options, day);
    var symbols = legs.map(function (l) { return l.ticker; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).sort();
    var key = day + '|' + symbols.join(',');

    if (opts.force || !cache || cache.key !== key || Date.now() - cache.at > TTL) {
      var sb = client();
      var got = await Promise.all([closes(sb, symbols), earnings(symbols, day), capital(sb)]);
      var m = { key: key, at: Date.now(), prices: got[0].prices, priceDate: got[0].priceDate, live: 0,
                earnings: got[1].earnings, earningsOk: got[1].ok, capital: got[2] };
      var missing = symbols.filter(function (s) { return m.prices[s] == null; });
      if (missing.length && typeof opts.quote === 'function') {
        for (var i = 0; i < missing.length; i++) {
          try { var p = await opts.quote(missing[i]); if (p) { m.prices[missing[i]] = p; m.live++; } } catch (e) { /* no price is fine */ }
        }
      }
      cache = m;
    }
    var c = cache;
    var status = D.wheelStatus({ today: day, options: options, stocks: stocks, prices: c.prices, priceDate: c.priceDate,
                                 earnings: c.earnings, capital: c.capital });
    return { status: status, D: D, legs: legs.length, shorts: legs, prices: c.prices, symbols: symbols, priceDate: c.priceDate, live: c.live, earningsOk: c.earningsOk };
  }

  /* The context fields arowana-ai-coach reads. Without them it tells the
     model "None recorded" and answers as if nothing were open. */
  function coachContext(st) {
    if (!st) return {};
    var lines = st.sections.filter(function (x) { return x.id !== 'idle'; }).map(function (x) {
      return x.title + ': ' + x.rows.map(function (r) { return r[0] + ' (' + r[1] + ')'; }).join('; ');
    });
    var out = {
      openPositions: st.puts + ' put' + (st.puts === 1 ? '' : 's') + ' and ' + st.calls + ' call' + (st.calls === 1 ? '' : 's') + ' open' +
        (lines.length ? '. ' + lines.join('. ') : '. Nothing near the strike, no earnings before expiration, nothing expiring this week.')
    };
    if (st.capital) out.wheelCapital = st.capital;
    if (st.collateral) out.committed = st.collateral;
    return out;
  }

  window.AP_WHEELSTATUS = { load: load, coachContext: coachContext, digest: getDigest };
})(window);
