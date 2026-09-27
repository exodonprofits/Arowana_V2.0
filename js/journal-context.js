/**
 * journal-context.js — what has THIS user done with THIS thing before?
 * ============================================================================
 * The platform has ~19 tools. Most of them are calculators: type a ticker, get
 * a number, leave. Interchangeable with what any broker gives away free.
 *
 * The one thing no competitor can copy is the user's own trade history, and
 * until now only about half the tools read it — Options Hub, the most
 * sophisticated page in the product, read it zero times. It would happily
 * recommend a cash-secured put without mentioning that the user has sold 14 of
 * them and lost on all three that had earnings inside the expiry.
 *
 * This module is the shared answer to "what happened last time I did this?".
 * Any page can ask, and the reply is grounded entirely in trades the user
 * actually recorded.
 *
 * ----------------------------------------------------------------------------
 * WHAT IT WILL AND WILL NOT DO
 * ----------------------------------------------------------------------------
 * It reports. It does not predict, score, or advise. A win rate over 6 trades
 * is not an edge and this module says so rather than presenting 67% as though
 * it meant something. Sample size travels with every statistic, and anything
 * below MIN_MEANINGFUL is returned flagged as anecdotal.
 *
 * It never invents. No smoothing, no priors, no "typical trader" fallback. If
 * the user has no history with a symbol, the answer is null and the caller
 * shows nothing — an empty panel is honest, a made-up baseline is not.
 *
 * Usage:
 *   const ctx = await JournalContext.forTicker('NVDA');
 *   if (ctx) show(ctx.summary);            // null means: no history, say nothing
 *
 *   const s = await JournalContext.forStrategy('cash-secured-put');
 *   const o = await JournalContext.forOutcome({ hasEarningsInWindow: true });
 */
(function () {
  'use strict';

  /* Below this many closed trades, a win rate is noise. Six coin flips come up
     4-2 about a third of the time. Callers get the number AND this flag; what
     they must not do is show "67% win rate" with the same weight as a figure
     drawn from forty trades. */
  var MIN_MEANINGFUL = 8;

  var STOCK_KEYS  = ['tj_stocks_v2', 'tj_stocks'];
  var OPTION_KEYS = ['tj_options_v2', 'tj_options'];

  var _cache = null;
  var _cacheAt = 0;
  var CACHE_MS = 60 * 1000;

  function readLocal(keys) {
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (_) { /* corrupt entry — try the next key rather than throwing */ }
    }
    return [];
  }

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /* A trade counts as closed when it has an exit. Open positions are excluded
     from win rates — counting an unrealised gain as a win is how people talk
     themselves into thinking a losing strategy works. */
  function isClosed(t) {
    return !!(t && (t.exitDate || t.exitPrice != null || t.status === 'closed'));
  }

  function pnlOf(t) {
    if (t.pnl != null) return num(t.pnl);
    var ep = num(t.entryPrice != null ? t.entryPrice : t.entry_price);
    var xp = num(t.exitPrice  != null ? t.exitPrice  : t.exit_price);
    var q  = num(t.qty != null ? t.qty : t.shares);
    if (ep == null || xp == null || q == null) return null;
    var gross = (xp - ep) * q * (String(t.side || '').toLowerCase() === 'short' ? -1 : 1);
    var fees  = (num(t.feeIn) || 0) + (num(t.feeOut) || 0) + (num(t.fees) || 0);
    return gross - fees;
  }

  function loadAll() {
    if (_cache && (Date.now() - _cacheAt) < CACHE_MS) return _cache;
    var stocks  = readLocal(STOCK_KEYS).map(function (t) { return Object.assign({ __kind: 'stock'  }, t); });
    var options = readLocal(OPTION_KEYS).map(function (t) { return Object.assign({ __kind: 'option' }, t); });
    _cache = stocks.concat(options);
    _cacheAt = Date.now();
    return _cache;
  }

  /* Core statistics. Everything downstream is a filter plus this. */
  function summarise(trades) {
    var closed = trades.filter(isClosed);
    var withPnl = closed
      .map(function (t) { return { t: t, p: pnlOf(t) }; })
      .filter(function (x) { return x.p != null; });

    var wins   = withPnl.filter(function (x) { return x.p > 0; });
    var losses = withPnl.filter(function (x) { return x.p < 0; });

    var totalPnl = withPnl.reduce(function (s, x) { return s + x.p; }, 0);
    var avgWin   = wins.length   ? wins.reduce(function (s, x) { return s + x.p; }, 0) / wins.length : null;
    var avgLoss  = losses.length ? losses.reduce(function (s, x) { return s + x.p; }, 0) / losses.length : null;

    return {
      total: trades.length,
      open: trades.length - closed.length,
      closed: closed.length,
      /* Scored only on closed trades where a P&L could be derived. If a user
         has 20 closed trades but only 12 have usable numbers, the win rate is
         out of 12 and `scored` says so. */
      scored: withPnl.length,
      wins: wins.length,
      losses: losses.length,
      winRate: withPnl.length ? (wins.length / withPnl.length) * 100 : null,
      totalPnl: withPnl.length ? totalPnl : null,
      avgWin: avgWin,
      avgLoss: avgLoss,
      /* Below MIN_MEANINGFUL the win rate is reported but must not be
         presented as a finding. Callers should render it quietly, or as
         "3 of 5" rather than "60%". */
      meaningful: withPnl.length >= MIN_MEANINGFUL,
      minMeaningful: MIN_MEANINGFUL
    };
  }

  function tickerOf(t) {
    return String(t.ticker || t.symbol || t.underlying || '').trim().toUpperCase();
  }

  function phrase(sym, s) {
    if (!s.scored) {
      return s.open
        ? 'You hold ' + s.open + ' open position' + (s.open === 1 ? '' : 's') + ' in ' + sym + ', none closed yet.'
        : 'You have ' + s.total + ' ' + sym + ' trade' + (s.total === 1 ? '' : 's') + ' on record, none closed yet.';
    }
    var base = 'You have traded ' + sym + ' ' + s.scored + ' time' + (s.scored === 1 ? '' : 's') + ': ' +
               s.wins + ' up, ' + s.losses + ' down';
    /* Deliberately "n of m" rather than a percentage under the threshold —
       a percentage implies a rate, and five trades do not establish one. */
    if (s.meaningful) base += ' (' + Math.round(s.winRate) + '% win rate)';
    if (s.open) base += ', with ' + s.open + ' still open';
    return base + '.';
  }

  var JournalContext = {
    MIN_MEANINGFUL: MIN_MEANINGFUL,

    /** Force a re-read; call after the journal syncs. */
    refresh: function () { _cache = null; _cacheAt = 0; },

    /** Has this user recorded anything at all? Lets a caller skip the UI. */
    hasHistory: function () { return loadAll().length > 0; },

    /**
     * The user's history with one symbol.
     * Returns null when there is none — the caller should render nothing
     * rather than an empty state saying "0 trades", which reads as a defect.
     */
    forTicker: function (symbol) {
      var sym = String(symbol || '').trim().toUpperCase();
      if (!sym) return null;
      var mine = loadAll().filter(function (t) { return tickerOf(t) === sym; });
      if (!mine.length) return null;

      var s = summarise(mine);
      var dates = mine.map(function (t) { return t.entryDate || t.date; }).filter(Boolean).sort();

      return Object.assign({
        ticker: sym,
        firstTraded: dates[0] || null,
        lastTraded: dates[dates.length - 1] || null,
        stockTrades:  mine.filter(function (t) { return t.__kind === 'stock';  }).length,
        optionTrades: mine.filter(function (t) { return t.__kind === 'option'; }).length,
        summary: phrase(sym, s),
        trades: mine
      }, s);
    },

    /**
     * History with a named setup or strategy — whatever the user typed in the
     * journal's `setup` field, or the option structure recorded on the trade.
     * Matching is loose because the field is free text: "CSP", "cash secured
     * put" and "Cash-Secured Put" should all find each other.
     */
    forStrategy: function (name) {
      var q = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
      if (!q) return null;
      var mine = loadAll().filter(function (t) {
        var hay = [t.setup, t.strategy, t.optType, t.type, t.notes]
          .filter(Boolean).join(' ').toLowerCase().replace(/[^a-z]/g, '');
        return hay.indexOf(q) !== -1;
      });
      if (!mine.length) return null;

      var s = summarise(mine);
      var label = String(name);
      var text;
      if (!s.scored) {
        text = 'You have ' + s.total + ' ' + label + ' trade' + (s.total === 1 ? '' : 's') + ' on record, none closed yet.';
      } else {
        text = 'You have taken ' + label + ' ' + s.scored + ' time' + (s.scored === 1 ? '' : 's') +
               ': ' + s.wins + ' up, ' + s.losses + ' down' +
               (s.meaningful ? ' (' + Math.round(s.winRate) + '% win rate)' : '') + '.';
      }
      return Object.assign({ strategy: label, summary: text, trades: mine }, s);
    },

    /**
     * Compare the user's results when a condition held against when it did not.
     * This is the version worth showing — "your three losses all had earnings
     * inside the expiry" is far more useful than an overall win rate.
     *
     * predicate receives each trade; return true when the condition applied.
     * Returns null unless BOTH sides have enough trades to be worth comparing,
     * because a split of 11 versus 1 is not a comparison.
     */
    compare: function (predicate, opts) {
      opts = opts || {};
      var pool = opts.trades || loadAll();
      var yes = [], no = [];
      pool.forEach(function (t) {
        try { (predicate(t) ? yes : no).push(t); } catch (_) { /* skip unusable rows */ }
      });
      var a = summarise(yes), b = summarise(no);
      var floor = opts.minEach || 3;
      if (a.scored < floor || b.scored < floor) return null;
      return {
        when: a,
        otherwise: b,
        /* Positive means the condition helped. Reported as a difference in
           percentage points, not as a causal claim. */
        winRateDelta: (a.winRate != null && b.winRate != null) ? (a.winRate - b.winRate) : null,
        meaningful: a.meaningful && b.meaningful
      };
    },

    /** Overall record, for a dashboard line. */
    overall: function () {
      var all = loadAll();
      if (!all.length) return null;
      return Object.assign({ trades: all }, summarise(all));
    }
  };

  window.JournalContext = JournalContext;
})();
