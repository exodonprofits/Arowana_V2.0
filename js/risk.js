/* ============================================================================
   risk.js — wheel guardrails.
   ----------------------------------------------------------------------------
   Limits the user sets in advance, checked against what they already hold
   before they sell another option. Every warning states the rule and the
   numbers behind it; nothing is hidden or auto-blocked, because it's the
   user's money and their call.

   Load after app-config.js + supabase_min.js:
       <script src="./js/risk.js"></script>

   Use:
       await AP_RISK.load();                  // settings + open positions
       AP_RISK.settings()                     // { wheelCapital, maxTickerPct, ... }
       AP_RISK.exposure()                     // { total, byTicker, putsByTicker }
       AP_RISK.checkCandidate({ symbol, strike, contracts, earningsBefore })
         → [{ level:'warn'|'block', rule, message }]
       AP_RISK.summary()                      // current standing vs each limit
       AP_RISK.save(partialSettings)          // persists, returns settings
       AP_RISK.rulesOnServer()                // false until the rules column exists

   The pre-trade check rules (min yield, DTE range, Want-to-Own, target
   price, basis, ex-dividend) live in ap_risk_settings.rules (jsonb; the
   column exists in production, added from the Wheel repo's migration
   20260925_ap_risk_settings_rules.sql). If it is ever missing they are kept
   in this browser only (ap_risk_rules_v1), per user.
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULTS = { wheelCapital: null, maxTickerPct: 20, maxTotalPct: 60, maxPutsPerTicker: 2, warnEarnings: true };
  // Rules for the pre-trade check. Off-by-default numbers stay null so an
  // unset rule is reported as skipped, never judged against a made-up value.
  var RULE_DEFAULTS = { minAnnualYield: null, minDte: null, maxDte: null, requireWantToOwn: true,
                        putAtOrBelowTarget: true, callAboveBasis: true, warnExDiv: true };
  var RULE_KEYS = Object.keys(RULE_DEFAULTS);
  var LOCAL_RULES = 'ap_risk_rules_v1';          // { [userId]: rules } when the column is missing
  var state = { settings: Object.assign({}, DEFAULTS, RULE_DEFAULTS), positions: null, loaded: false, userId: null, rulesOnServer: false };

  function cleanRules(r) {
    var out = {};
    RULE_KEYS.forEach(function (k) {
      var v = r && r[k];
      if (typeof RULE_DEFAULTS[k] === 'boolean') out[k] = v == null ? RULE_DEFAULTS[k] : !!v;
      else out[k] = num(v);
    });
    return out;
  }
  function localRules(uid) {
    try { var all = JSON.parse(localStorage.getItem(LOCAL_RULES) || '{}'); return all[uid] || null; } catch (e) { return null; }
  }
  function saveLocalRules(uid, rules) {
    try {
      var all = JSON.parse(localStorage.getItem(LOCAL_RULES) || '{}');
      all[uid] = rules;
      localStorage.setItem(LOCAL_RULES, JSON.stringify(all));
    } catch (e) {}
  }

  function num(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function money(v) {
    v = num(v); if (v == null) return '—';
    return (window.AP_FMT && window.AP_FMT.usd) ? window.AP_FMT.usd(v, { cents: false })
      : '$' + Math.round(v).toLocaleString('en-US');
  }
  function pct(v) { v = num(v); return v == null ? '—' : v.toFixed(1) + '%'; }

  // Only ever the shared client from app-config.js. This used to call
  // createClient() when the shared one wasn't there yet — which it isn't
  // at ap:config:ready — adding a second GoTrueClient to the page that
  // raced the shared one over refresh-token rotation.
  function getClient() {
    return window.supabaseClient || window.sbClient || null;
  }
  function waitForClient(ms) {
    return new Promise(function (resolve) {
      var c = getClient();
      if (c && c.auth) return resolve(c);
      var done = false;
      function finish() { if (done) return; var x = getClient(); if (x && x.auth) { done = true; cleanup(); resolve(x); } }
      function cleanup() { window.removeEventListener('ap:client:ready', finish); clearInterval(poll); }
      window.addEventListener('ap:client:ready', finish);
      var poll = setInterval(finish, 200);
      setTimeout(function () { if (!done) { done = true; cleanup(); resolve(null); } }, ms);
    });
  }

  // What the user already has committed, from the journal.
  function shapePositions(optionRows) {
    var byTicker = {}, putsByTicker = {}, total = 0;
    (optionRows || []).forEach(function (r) {
      var p = r.payload || {};
      if (String(p.optType).toLowerCase() !== 'put') return;
      if (String(p.isCredit) !== 'true' && p.isCredit !== true) return;
      var sym = String(p.ticker || '').trim().toUpperCase();
      var strike = num(p.strike), qty = num(p.qty) || 1;
      if (!sym || strike == null) return;
      var collateral = strike * 100 * qty;
      byTicker[sym] = (byTicker[sym] || 0) + collateral;
      putsByTicker[sym] = (putsByTicker[sym] || 0) + qty;
      total += collateral;
    });
    return { total: total, byTicker: byTicker, putsByTicker: putsByTicker };
  }

  async function load(force) {
    if (state.loaded && !force) return snapshot();
    var sb = await waitForClient(5000);
    if (!sb) { state.loaded = true; return snapshot(); }
    try {
      var sess = await sb.auth.getSession();
      var user = sess && sess.data && sess.data.session && sess.data.session.user;
      if (!user) { state.loaded = true; return snapshot(); }
      state.userId = user.id;

      var s = await sb.from('ap_risk_settings')
        .select('wheel_capital, max_ticker_pct, max_total_pct, max_puts_per_ticker, warn_earnings')
        .eq('user_id', user.id).maybeSingle();
      if (!s.error && s.data) {
        state.settings = Object.assign({}, state.settings, {
          wheelCapital: num(s.data.wheel_capital),
          maxTickerPct: num(s.data.max_ticker_pct) || DEFAULTS.maxTickerPct,
          maxTotalPct: num(s.data.max_total_pct) || DEFAULTS.maxTotalPct,
          maxPutsPerTicker: num(s.data.max_puts_per_ticker) || DEFAULTS.maxPutsPerTicker,
          warnEarnings: s.data.warn_earnings !== false
        });
      }

      // Asked for separately: a missing column must not lose the limits above.
      var r = await sb.from('ap_risk_settings').select('rules').eq('user_id', user.id).maybeSingle();
      state.rulesOnServer = !r.error;
      var stored = (!r.error && r.data && r.data.rules && Object.keys(r.data.rules).length) ? r.data.rules : localRules(user.id);
      if (stored) Object.assign(state.settings, cleanRules(stored));

      var o = await sb.from('tj_options').select('payload').eq('user_id', user.id).eq('status', 'open');
      state.positions = shapePositions(o.data || []);
    } catch (e) {
      console.warn('[risk] load failed', e);
    }
    state.loaded = true;
    window.dispatchEvent(new CustomEvent('ap:risk:ready', { detail: snapshot() }));
    return snapshot();
  }

  async function save(patch) {
    var sb = await waitForClient(4000);
    if (!sb || !state.userId) throw new Error('not signed in');
    var next = Object.assign({}, state.settings, patch || {});
    var row = {
      user_id: state.userId,
      wheel_capital: next.wheelCapital == null ? null : Number(next.wheelCapital),
      max_ticker_pct: Number(next.maxTickerPct),
      max_total_pct: Number(next.maxTotalPct),
      max_puts_per_ticker: Math.round(Number(next.maxPutsPerTicker)),
      warn_earnings: !!next.warnEarnings,
      updated_at: new Date().toISOString()
    };
    var rules = cleanRules(next);
    if (state.rulesOnServer) row.rules = rules;
    var res = await sb.from('ap_risk_settings').upsert(row, { onConflict: 'user_id' });
    if (res.error) throw res.error;
    saveLocalRules(state.userId, rules);
    state.settings = Object.assign(next, rules);
    window.dispatchEvent(new CustomEvent('ap:risk:ready', { detail: snapshot() }));
    return next;
  }

  function snapshot() {
    return {
      settings: Object.assign({}, state.settings),
      exposure: state.positions || { total: 0, byTicker: {}, putsByTicker: {} },
      loaded: state.loaded
    };
  }

  /* Checks one candidate before it's sold. Returns [] when nothing trips.
     Without a capital figure the percentage rules can't be judged, so they
     are skipped rather than guessed at. */
  function checkCandidate(c) {
    var out = [];
    if (!c || !c.symbol) return out;
    var st = state.settings;
    var exp = state.positions || { total: 0, byTicker: {}, putsByTicker: {} };
    var sym = String(c.symbol).toUpperCase();
    var contracts = num(c.contracts) || 1;
    var strike = num(c.strike);
    var added = strike != null ? strike * 100 * contracts : 0;

    if (st.wheelCapital && added > 0) {
      var tickerAfter = (exp.byTicker[sym] || 0) + added;
      var tickerPct = tickerAfter / st.wheelCapital * 100;
      if (tickerPct > st.maxTickerPct) {
        out.push({ level: 'warn', rule: 'concentration',
          message: 'This would put ' + money(tickerAfter) + ' (' + pct(tickerPct) + ' of your ' +
                   money(st.wheelCapital) + ' wheel capital) into ' + sym + '. Your limit is ' + pct(st.maxTickerPct) + '.' });
      }
      var totalAfter = exp.total + added;
      var totalPct = totalAfter / st.wheelCapital * 100;
      if (totalPct > st.maxTotalPct) {
        out.push({ level: 'warn', rule: 'total-collateral',
          message: 'Total put collateral would reach ' + money(totalAfter) + ' (' + pct(totalPct) +
                   ' of your capital). Your limit is ' + pct(st.maxTotalPct) + '.' });
      }
    }

    var openPuts = exp.putsByTicker[sym] || 0;
    if (openPuts + contracts > st.maxPutsPerTicker) {
      out.push({ level: 'warn', rule: 'stacking',
        message: 'You already have ' + openPuts + ' put' + (openPuts === 1 ? '' : 's') + ' open on ' + sym +
                 '. This would make ' + (openPuts + contracts) + ', above your limit of ' + st.maxPutsPerTicker + '.' });
    }

    if (st.warnEarnings && c.earningsBefore) {
      out.push({ level: 'warn', rule: 'earnings',
        message: 'Earnings' + (c.earningsDate ? ' on ' + c.earningsDate : '') +
                 ' land before this expiration, so the stock can gap through your strike.' });
    }
    return out;
  }

  // Where the user stands right now, before adding anything.
  function summary() {
    var st = state.settings;
    var exp = state.positions || { total: 0, byTicker: {}, putsByTicker: {} };
    var tickers = Object.keys(exp.byTicker).sort(function (a, b) { return exp.byTicker[b] - exp.byTicker[a]; });
    var rows = tickers.map(function (t) {
      return { ticker: t, collateral: exp.byTicker[t], puts: exp.putsByTicker[t] || 0,
               pct: st.wheelCapital ? exp.byTicker[t] / st.wheelCapital * 100 : null,
               overTicker: st.wheelCapital ? (exp.byTicker[t] / st.wheelCapital * 100) > st.maxTickerPct : false,
               overStack: (exp.putsByTicker[t] || 0) > st.maxPutsPerTicker };
    });
    return {
      capital: st.wheelCapital,
      committed: exp.total,
      committedPct: st.wheelCapital ? exp.total / st.wheelCapital * 100 : null,
      overTotal: st.wheelCapital ? (exp.total / st.wheelCapital * 100) > st.maxTotalPct : false,
      tickers: rows,
      breaches: rows.filter(function (r) { return r.overTicker || r.overStack; })
    };
  }

  window.AP_RISK = {
    load: load, save: save, settings: function () { return Object.assign({}, state.settings); },
    exposure: function () { return snapshot().exposure; },
    checkCandidate: checkCandidate, summary: summary, snapshot: snapshot,
    rulesOnServer: function () { return state.rulesOnServer; },
    fmtMoney: money, fmtPct: pct
  };
})();
