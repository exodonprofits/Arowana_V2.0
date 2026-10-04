/* ============================================================================
   trade-check.js — check a trade against your own rules before you place it
   ----------------------------------------------------------------------------
   The user proposes one short put or covered call. Each rule they have set
   comes back as pass, fail or skip, with the numbers behind it. Nothing is
   recommended and nothing is blocked: the rules are theirs, and so is the
   decision.

   Pure and deterministic: no DOM, no network. Browser: window.AP_TRADECHECK.
   Node: require('./js/trade-check.js').

   Use:
       AP_TRADECHECK.evaluate(trade, ctx, rules) → { math, checks, failed, passed, skipped }
       AP_TRADECHECK.cases(trade, ctx, result)   → { for, against, unchecked }

   trade  { ticker, type: 'put'|'call', strike, expiry: 'YYYY-MM-DD',
            premium (per share), contracts, today: 'YYYY-MM-DD' }
   ctx    { price,                      // last price, or null
            wantToOwn,                  // { TICKER: { target } } or null if not loaded
            earningsDate,               // undefined = not looked up, null = none found
            exDivDate,                  // null when unknown
            exposure: { total, byTicker, putsByTicker },   // open short puts (AP_RISK)
            holding: { shares, heldCost, adjustedBasis, coveredShares } }  // this ticker + account
   rules  AP_RISK.settings(): wheelCapital, maxTickerPct, maxTotalPct,
          maxPutsPerTicker, warnEarnings, minAnnualYield, minDte, maxDte,
          requireWantToOwn, putAtOrBelowTarget, callAboveBasis, warnExDiv
   ========================================================================== */
(function (root) {
  'use strict';

  var DAY = 86400000;

  function num(v) { if (v == null || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
  function days(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY); }
  function usd(v) {
    if (v == null) return '—';
    var neg = v < 0, a = Math.abs(v);
    var s = a >= 1000 ? Math.round(a).toLocaleString('en-US') : a.toFixed(2);
    return (neg ? '−$' : '$') + s;
  }
  function pct(v, dp) { return v == null ? '—' : v.toFixed(dp == null ? 1 : dp) + '%'; }

  /* The trade's own numbers, before any rule. */
  function math(t, ctx) {
    var holding = ctx.holding || {};
    var contracts = num(t.contracts) || 1;
    var strike = num(t.strike), premium = num(t.premium), price = num(ctx.price);
    var dte = (day(t.expiry) && day(t.today)) ? days(day(t.today), day(t.expiry)) : null;
    var isPut = t.type === 'put';
    // Yield is premium over the money at work: the strike for a put, the
    // share price for a call (basis when there is no price).
    var base = isPut ? strike : (price != null ? price : num(holding.adjustedBasis));
    var yieldPct = (premium != null && base) ? premium / base * 100 : null;
    var m = {
      contracts: contracts, shares: contracts * 100, dte: dte,
      premiumTotal: premium != null ? premium * 100 * contracts : null,
      collateral: isPut && strike != null ? strike * 100 * contracts : 0,
      yieldPct: yieldPct, yieldBase: base,
      annualized: (yieldPct != null && dte > 0) ? yieldPct * 365 / dte : null,
      breakeven: isPut && strike != null && premium != null ? strike - premium : null,
      otmPct: (price && strike != null) ? (isPut ? (price - strike) / price * 100 : (strike - price) / price * 100) : null
    };
    if (!isPut && strike != null && premium != null && num(holding.adjustedBasis) != null) {
      m.ifCalled = (strike - num(holding.adjustedBasis) + premium) * m.shares;
    }
    return m;
  }

  function evaluate(t, ctx, rules) {
    t = t || {}; ctx = ctx || {}; rules = rules || {};
    var out = [];
    var sym = String(t.ticker || '').trim().toUpperCase();
    var isPut = t.type === 'put';
    var strike = num(t.strike);
    var m = math(t, ctx);
    var holding = ctx.holding || {};
    var exp = ctx.exposure || { total: 0, byTicker: {}, putsByTicker: {} };

    function add(id, label, status, detail) { out.push({ id: id, label: label, status: status, detail: detail }); }

    // Days to expiration
    var minD = num(rules.minDte), maxD = num(rules.maxDte);
    if (minD == null && maxD == null) add('dte', 'Days to expiration', 'skip', 'No range set.');
    else if (m.dte == null) add('dte', 'Days to expiration', 'skip', 'Enter an expiration date.');
    else {
      var range = (minD != null ? minD : 0) + '–' + (maxD != null ? maxD : '∞') + ' days';
      var ok = (minD == null || m.dte >= minD) && (maxD == null || m.dte <= maxD);
      add('dte', 'Days to expiration', ok ? 'pass' : 'fail', m.dte + ' days; your range is ' + range + '.');
    }

    // Minimum yield
    var minY = num(rules.minAnnualYield);
    if (minY == null) add('yield', 'Minimum yield', 'skip', 'No minimum set.');
    else if (m.annualized == null) add('yield', 'Minimum yield', 'skip', 'Needs premium, expiration' + (isPut ? '' : ' and a share price') + '.');
    else add('yield', 'Minimum yield', m.annualized >= minY ? 'pass' : 'fail',
      usd(num(t.premium)) + ' ÷ ' + usd(m.yieldBase) + ' = ' + pct(m.yieldPct, 2) + ' in ' + m.dte + ' days, ' +
      pct(m.annualized) + ' a year. Your minimum is ' + pct(minY) + ' a year.');

    if (isPut) {
      // Want to Own
      var wto = ctx.wantToOwn;
      if (!rules.requireWantToOwn) add('wto', 'On your Want-to-Own list', 'skip', 'Rule is off.');
      else if (!wto) add('wto', 'On your Want-to-Own list', 'skip', 'Your list could not be loaded.');
      else add('wto', 'On your Want-to-Own list', wto[sym] ? 'pass' : 'fail',
        wto[sym] ? sym + ' is on your list.' : sym + ' is not on your list. A put can leave you owning it.');

      // Target buy price
      var target = wto && wto[sym] ? num(wto[sym].target) : null;
      if (!rules.putAtOrBelowTarget) add('target', 'Strike at or below your target price', 'skip', 'Rule is off.');
      else if (target == null) add('target', 'Strike at or below your target price', 'skip', 'No target price set for ' + sym + '.');
      else add('target', 'Strike at or below your target price', strike <= target ? 'pass' : 'fail',
        'Strike ' + usd(strike) + (m.breakeven != null ? ' (you would pay ' + usd(m.breakeven) + ' after premium)' : '') +
        '; your target is ' + usd(target) + '.');
    }

    // Earnings before expiration
    if (!rules.warnEarnings) add('earnings', 'No earnings before expiration', 'skip', 'Rule is off.');
    else if (ctx.earningsDate === undefined) add('earnings', 'No earnings before expiration', 'skip', 'Earnings date could not be looked up.');
    else if (!ctx.earningsDate) add('earnings', 'No earnings before expiration', 'pass', 'No earnings date found before ' + (day(t.expiry) || 'expiration') + '.');
    else {
      var e = day(ctx.earningsDate);
      var before = e && day(t.expiry) && e <= day(t.expiry) && (!day(t.today) || e >= day(t.today));
      add('earnings', 'No earnings before expiration', before ? 'fail' : 'pass',
        'Earnings ' + e + (before ? ', before the ' + day(t.expiry) + ' expiration. The stock can gap through your strike.' : ', after expiration.'));
    }

    if (!isPut) {
      // Ex-dividend before expiration: early assignment risk on calls
      if (!rules.warnExDiv) add('exdiv', 'No ex-dividend date before expiration', 'skip', 'Rule is off.');
      else if (!day(ctx.exDivDate)) add('exdiv', 'No ex-dividend date before expiration', 'skip', 'No ex-dividend date entered.');
      else {
        var x = day(ctx.exDivDate);
        var xb = day(t.expiry) && x <= day(t.expiry) && (!day(t.today) || x >= day(t.today));
        add('exdiv', 'No ex-dividend date before expiration', xb ? 'fail' : 'pass',
          'Ex-dividend ' + x + (xb ? ', before expiration. An in-the-money call is often assigned the day before.' : ', after expiration.'));
      }

      // Strike vs adjusted basis
      var basis = num(holding.adjustedBasis);
      if (!rules.callAboveBasis) add('basis', 'Strike at or above your adjusted basis', 'skip', 'Rule is off.');
      else if (basis == null) add('basis', 'Strike at or above your adjusted basis', 'skip', 'No shares of ' + sym + ' in this account in your journal.');
      else add('basis', 'Strike at or above your adjusted basis', strike >= basis ? 'pass' : 'fail',
        'Strike ' + usd(strike) + ' vs adjusted basis ' + usd(basis) + '. If called: ' + usd(m.ifCalled) + ' including premium.');

      // Shares to cover the call
      var sharesHeld = num(holding.shares), covered = num(holding.coveredShares) || 0;
      if (sharesHeld == null) add('cover', 'Shares to cover the call', 'skip', 'No shares of ' + sym + ' in this account in your journal.');
      else {
        var free = sharesHeld - covered;
        add('cover', 'Shares to cover the call', free >= m.shares ? 'pass' : 'fail',
          sharesHeld + ' shares held' + (covered ? ', ' + covered + ' already under open calls' : '') + '; this call needs ' + m.shares + '.');
      }
    }

    if (isPut) {
      var cap = num(rules.wheelCapital);
      var tickerNow = (exp.byTicker[sym] || 0) + (num(holding.heldCost) || 0);
      if (!cap) {
        add('ticker', 'Room in one name', 'skip', 'Set your wheel capital to check this.');
        add('total', 'Room for total put collateral', 'skip', 'Set your wheel capital to check this.');
      } else {
        var tickerAfter = tickerNow + m.collateral;
        var tp = tickerAfter / cap * 100;
        add('ticker', 'Room in one name', tp <= num(rules.maxTickerPct) ? 'pass' : 'fail',
          sym + ' would be ' + usd(tickerAfter) + ' (' + (tickerNow ? usd(tickerNow) + ' now + ' : '') + usd(m.collateral) + ' collateral) = ' +
          pct(tp) + ' of ' + usd(cap) + '. Your limit is ' + pct(num(rules.maxTickerPct)) + '.');
        var totalAfter = (exp.total || 0) + m.collateral;
        var ttp = totalAfter / cap * 100;
        add('total', 'Room for total put collateral', ttp <= num(rules.maxTotalPct) ? 'pass' : 'fail',
          'Put collateral would be ' + usd(totalAfter) + ' = ' + pct(ttp) + ' of ' + usd(cap) + '. Your limit is ' + pct(num(rules.maxTotalPct)) + '.');
      }
      var openPuts = exp.putsByTicker[sym] || 0, maxPuts = num(rules.maxPutsPerTicker);
      if (maxPuts == null) add('stack', 'Puts per ticker', 'skip', 'No limit set.');
      else add('stack', 'Puts per ticker', openPuts + m.contracts <= maxPuts ? 'pass' : 'fail',
        openPuts + ' open + ' + m.contracts + ' = ' + (openPuts + m.contracts) + ' on ' + sym + '. Your limit is ' + maxPuts + '.');
    }

    var failed = out.filter(function (c) { return c.status === 'fail'; }).length;
    var passed = out.filter(function (c) { return c.status === 'pass'; }).length;
    return { math: m, checks: out, failed: failed, passed: passed, skipped: out.length - failed - passed };
  }

  /* Case for / case against: what the card already knows, sorted into the
     two sides of the decision. No new judgement and no new numbers — every
     line is a rule result or a figure from math(). Nothing here says which
     side wins; that is the user's call.
     → { for: [text], against: [text], unchecked: n } */
  var NEAR = 3;   // "close to the strike": within 3%, as in the daily email
  function cases(t, ctx, r) {
    var m = r.math, isPut = t.type === 'put';
    var pro = [], con = [];
    var exp = day(t.expiry) || 'expiration';

    // The reward, and what it costs to hold.
    if (m.premiumTotal != null) {
      pro.push('You collect ' + usd(m.premiumTotal) + ' now' +
        (m.yieldPct != null ? ', ' + pct(m.yieldPct, 2) + (isPut ? ' on the cash set aside' : ' on the shares') +
          (m.annualized != null ? ' (' + pct(m.annualized) + ' a year)' : '') : '') + '.');
    }
    if (isPut && m.collateral) {
      con.push(usd(m.collateral) + ' of cash is tied up until ' + exp + '; if assigned you buy ' + m.shares + ' shares' +
        (m.breakeven != null ? ' at ' + usd(m.breakeven) + ' a share after premium' : '') + '.');
    }
    if (!isPut && num(t.strike) != null) {
      con.push('Your upside is capped at ' + usd(num(t.strike)) + ' a share until ' + exp + '.');
      if (m.ifCalled != null) (m.ifCalled >= 0 ? pro : con).push('If called away: ' + usd(m.ifCalled) +
        (m.ifCalled >= 0 ? ' over your adjusted basis' : ' below your adjusted basis') + ', premium included.');
    }

    // How much room the stock has before the strike.
    if (m.otmPct != null) {
      var d = Math.abs(m.otmPct);
      if (m.otmPct < 0) con.push('Already ' + pct(d) + ' in the money at the last price.');
      else if (m.otmPct < NEAR) con.push('Only ' + pct(d) + ' between the last price and the strike.');
      else pro.push(pct(d) + ' between the last price and the strike.');
    }

    // Your own rules: passes argue for, failures against. Named, not
    // repeated — the checklist right above has the numbers.
    var named = function (st) { return r.checks.filter(function (c) { return c.status === st; }).map(function (c) { return c.label.charAt(0).toLowerCase() + c.label.slice(1); }); };
    var ok = named('pass'), bad = named('fail');
    if (ok.length) pro.push('Meets ' + ok.length + ' of your rules: ' + ok.join('; ') + '.');
    if (bad.length) con.push('Breaks ' + bad.length + ' of your rules: ' + bad.join('; ') + '.');

    // Earnings before expiration still matter when the rule is switched off.
    var e = day(ctx.earningsDate);
    var earnCheck = r.checks.filter(function (c) { return c.id === 'earnings'; })[0];
    if (e && (!earnCheck || earnCheck.status === 'skip') && e <= exp && (!day(t.today) || e >= day(t.today))) {
      con.push('Earnings ' + e + ', before the ' + exp + ' expiration.');
    }

    var unchecked = r.checks.filter(function (c) { return c.status === 'skip' && !/^(Rule is off|No .* set)\.?$/.test(c.detail); }).length;
    return { 'for': pro, against: con, unchecked: unchecked };
  }

  var api = { evaluate: evaluate, math: math, cases: cases };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AP_TRADECHECK = api;
})(typeof window !== 'undefined' ? window : this);
