/* ============================================================================
   wheel-ledger.js — wheel campaigns from the trade journal
   ----------------------------------------------------------------------------
   A campaign is one run of the wheel on one ticker in one account: short puts,
   the shares they put you into, the calls sold against those shares, until
   you are out of both. This turns journal rows into those campaigns and the
   numbers a wheel trader actually asks about: what the premium bought down
   the basis to, how much capital it tied up, and what it returned.

   Pure and deterministic: no DOM, no network, no clock unless opts.today is
   left out. Works in the browser (window.AP_WHEEL) and in node (require).

   Use:
       AP_WHEEL.build(optionPayloads, stockPayloads, {
         today: '2026-09-25',          // open campaigns run to this date
         prices: { KO: 61.2 },         // optional last price, for unrealized
         graceDays: 7                  // flat this long ends a campaign
       })  →  [campaign, …] newest first

   Inputs are journal payloads (tj_options.payload / tj_stocks.payload, or the
   tj_options_v2 / tj_stocks_v2 arrays in localStorage).

   What counts
   - Wheel legs: options opened for a credit that are not spreads, condors,
     straddles, strangles, calendars or diagonals. Long options are left out.
   - Shares: long stock rows. Short stock is left out.
   - An option marked Assigned with no matching stock row (same ticker and
     account, 100 × contracts shares, within 5 days, price within 2% of the
     strike) is treated as shares bought (put) or sold (call) at the strike.
     The campaign carries a warning so the journal can be fixed.
   ========================================================================== */
(function (root) {
  'use strict';

  var DAY = 86400000;
  var MATCH_DAYS = 5;
  var MATCH_PRICE = 0.02;
  var NOT_WHEEL = /spread|condor|straddle|strangle|calendar|diagonal|butterfly|long/i;

  function num(v) { if (v == null || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
  function ms(d) { return Date.parse(d + 'T00:00:00Z'); }
  function daysBetween(a, b) { return Math.round((ms(b) - ms(a)) / DAY); }
  function isTrue(v) { return v === true || String(v) === 'true'; }
  function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }
  function account(p) { return String(p.broker || '').trim() || 'Default'; }

  /* One option payload → a wheel leg, or null. */
  function toLeg(p) {
    var ticker = String(p.ticker || '').trim().toUpperCase();
    if (!ticker || !isTrue(p.isCredit)) return null;
    if (NOT_WHEEL.test(String(p.strategy || ''))) return null;
    var type = String(p.optType || '').toLowerCase();
    if (type !== 'put' && type !== 'call') {
      type = /put/i.test(p.strategy) ? 'put' : /call/i.test(p.strategy) ? 'call' : null;
    }
    if (!type) return null;
    var qty = num(p.qty) || 1;
    var status = String(p.status || 'open').toLowerCase();
    var done = status === 'closed' || status === 'expired' || status === 'assigned';
    var expiry = day(p.expiry);
    var close = done ? (day(p.exitDate) || expiry) : null;
    var open = day(p.entryDate) || close;
    if (!open) return null;
    var pin = num(p.premiumIn), pout = num(p.premiumOut);
    var fees = (num(p.feeIn) || 0) + (num(p.feeOut) || 0) + (num(p.fees) || 0);
    var incomplete = pin == null;
    var pnl = null;
    if (done) {
      pnl = num(p.pnl);
      // The Expired / Assigned buttons don't write a P&L: the premium is kept.
      if (pnl == null) pnl = incomplete ? 0 : (pin - (pout || 0)) * qty * 100 - fees;
    }
    return {
      id: p.id || null, ticker: ticker, account: account(p), type: type,
      strike: num(p.strike) || 0, qty: qty, open: open, close: close, expiry: expiry,
      status: status, assigned: status === 'assigned',
      credit: incomplete ? 0 : pin * qty * 100, pnl: pnl, incomplete: incomplete
    };
  }

  /* One stock payload → a long lot, or null. */
  function toLot(p) {
    var ticker = String(p.ticker || '').trim().toUpperCase();
    if (!ticker) return null;
    if (String(p.side || 'long').toLowerCase() !== 'long') return null;
    var qty = num(p.qty) || 0, price = num(p.entryPrice);
    var buy = day(p.entryDate);
    if (qty <= 0 || price == null || !buy) return null;
    var exitPrice = num(p.exitPrice), sell = day(p.exitDate);
    var sold = String(p.status || '').toLowerCase() === 'closed' && exitPrice != null && !!sell;
    return {
      id: p.id || null, ticker: ticker, account: account(p), qty: qty, price: price,
      buy: buy, sell: sold ? sell : null, exitPrice: sold ? exitPrice : null,
      fees: num(p.fees) || 0, synthetic: false
    };
  }

  function near(a, b) { return a && b && Math.abs(daysBetween(a, b)) <= MATCH_DAYS; }
  function priceNear(price, strike) { return strike > 0 && Math.abs(price - strike) / strike <= MATCH_PRICE; }

  /* Assigned legs without a stock row behind them become shares at the strike. */
  function fillAssignments(legs, lots) {
    // One lot can back both a put assignment (its buy) and a call-away (its sell).
    var used = { put: [], call: [] }, notes = [];
    legs.forEach(function (leg) {
      if (!leg.assigned || !leg.close) return;
      var shares = leg.qty * 100;
      var hit = lots.find(function (l) {
        if (l.synthetic || used[leg.type].indexOf(l) >= 0 || l.ticker !== leg.ticker || l.account !== leg.account || l.qty !== shares) return false;
        return leg.type === 'put'
          ? near(l.buy, leg.close) && priceNear(l.price, leg.strike)
          : !!l.sell && near(l.sell, leg.close) && priceNear(l.exitPrice, leg.strike);
      });
      if (hit) { used[leg.type].push(hit); return; }
      if (leg.type === 'put') {
        lots.push({ id: 'assigned:' + (leg.id || leg.open), ticker: leg.ticker, account: leg.account, qty: shares,
                    price: leg.strike, buy: leg.close, sell: null, exitPrice: null, fees: 0, synthetic: true });
        notes.push({ ticker: leg.ticker, account: leg.account, date: leg.close,
                     text: 'Put assigned on ' + leg.close + ' with no stock row for the ' + shares + ' shares; counted as bought at $' + leg.strike + '.' });
      } else {
        leg.callAway = shares;
        notes.push({ ticker: leg.ticker, account: leg.account, date: leg.close,
                     text: 'Call assigned on ' + leg.close + ' but no stock row shows the ' + shares + ' shares sold; counted as sold at $' + leg.strike + '.' });
      }
    });
    return notes;
  }

  /* Events for one ticker/account, in the order they are applied within a day:
     money in (buys, new legs) before money out (closes, sells). */
  function eventsFor(legs, lots) {
    var ev = [];
    lots.forEach(function (l) {
      ev.push({ date: l.buy, rank: 0, kind: 'buy', lot: l });
      if (l.sell) ev.push({ date: l.sell, rank: 3, kind: 'sell', lot: l });
    });
    legs.forEach(function (g) {
      ev.push({ date: g.open, rank: 1, kind: 'open', leg: g });
      if (g.close) ev.push({ date: g.close, rank: 2, kind: 'close', leg: g });
    });
    return ev.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.rank - b.rank; });
  }

  function newCampaign(ticker, acct, date) {
    return {
      ticker: ticker, account: acct, start: date, end: null, status: 'open',
      optionIncome: 0, openPremium: 0, stockRealized: 0, puts: 0, calls: 0,
      assignments: 0, calledAway: 0, legs: [], lots: [], warnings: [],
      peakCapital: 0, capitalDays: 0,
      _held: [], _openLegs: [], _lastDate: date, _flatSince: null
    };
  }

  function heldShares(c) { return c._held.reduce(function (s, h) { return s + h.qty; }, 0); }
  function heldCost(c) { return c._held.reduce(function (s, h) { return s + h.qty * h.price; }, 0); }
  function capital(c) {
    var puts = c._openLegs.reduce(function (s, g) { return s + (g.type === 'put' ? g.strike * 100 * g.qty : 0); }, 0);
    // A call with no shares under it is naked; count its strike so the
    // capital figure is never zero while risk is on.
    var shares = heldShares(c);
    var naked = c._openLegs.reduce(function (s, g) { return s + (g.type === 'call' ? g.qty * 100 : 0); }, 0) - shares;
    var nakedCost = 0;
    if (naked > 0) {
      c._openLegs.forEach(function (g) { if (g.type === 'call' && naked > 0) { var n = Math.min(naked, g.qty * 100); nakedCost += n * g.strike; naked -= n; } });
    }
    return puts + heldCost(c) + nakedCost;
  }
  function exposure(c) { return c._openLegs.length + heldShares(c); }

  /* Take shares out FIFO (a sell without its own lot, i.e. a call-away). */
  function sellFifo(c, shares, price, date) {
    var left = shares, pnl = 0;
    while (left > 0 && c._held.length) {
      var h = c._held[0], n = Math.min(h.qty, left);
      pnl += (price - h.price) * n;
      h.qty -= n; left -= n;
      if (h.qty <= 0) c._held.shift();
    }
    if (left > 0) c.warnings.push('Sold ' + left + ' more shares on ' + date + ' than the journal shows held.');
    return pnl;
  }

  function apply(c, e) {
    if (e.kind === 'buy') {
      c._held.push({ lot: e.lot, qty: e.lot.qty, price: e.lot.price });
      c.lots.push(e.lot);
    } else if (e.kind === 'sell') {
      var idx = c._held.findIndex(function (h) { return h.lot === e.lot; });
      if (idx >= 0) {
        var h = c._held[idx];
        c.stockRealized += (e.lot.exitPrice - h.price) * h.qty - e.lot.fees;
        c._held.splice(idx, 1);
      }
    } else if (e.kind === 'open') {
      c._openLegs.push(e.leg);
      c.legs.push(e.leg);
      if (e.leg.type === 'put') c.puts++; else c.calls++;
      if (e.leg.incomplete) c.warnings.push((e.leg.type === 'put' ? 'A put' : 'A call') + ' closed on ' + e.leg.close + ' has no opening price; its premium is not counted.');
    } else if (e.kind === 'close') {
      c._openLegs = c._openLegs.filter(function (g) { return g !== e.leg; });
      c.optionIncome += e.leg.pnl || 0;
      if (e.leg.assigned) {
        if (e.leg.type === 'put') c.assignments++;
        else c.calledAway++;
      }
      if (e.leg.callAway) c.stockRealized += sellFifo(c, e.leg.callAway, e.leg.strike, e.date);
    }
  }

  function finish(c, endDate, prices) {
    var shares = heldShares(c), cost = heldCost(c);
    c.openPremium = c._openLegs.reduce(function (s, g) { return s + g.credit; }, 0);
    c.end = c.status === 'closed' ? endDate : null;
    c.days = Math.max(1, daysBetween(c.start, endDate));
    c.shares = shares;
    c.heldCost = round2(cost);
    c.avgCost = shares ? round2(cost / shares) : null;
    c.realized = round2(c.optionIncome + c.stockRealized);
    // What the shares you still hold cost you net of everything the campaign
    // has already banked (premium and any stock gains or losses).
    c.adjustedBasis = shares ? round2((cost - c.optionIncome - c.stockRealized) / shares) : null;
    var last = prices && num(prices[c.ticker]);
    c.last = shares && last != null ? last : null;
    c.unrealized = c.last != null ? round2(shares * c.last - cost) : null;
    c.total = round2(c.realized + (c.unrealized || 0));
    c.avgCapital = c.capitalDays > 0 ? round2(c.capitalDays / c.days) : null;
    c.returnOnPeak = c.peakCapital > 0 ? c.total / c.peakCapital * 100 : null;
    // Annualizing a few days of premium gives silly numbers; wait for a month.
    c.annualized = c.returnOnPeak != null && c.days >= 30 ? c.returnOnPeak * 365 / c.days : null;
    c.openLegs = c._openLegs.slice();
    c.optionIncome = round2(c.optionIncome);
    c.stockRealized = round2(c.stockRealized);
    c.openPremium = round2(c.openPremium);
    c.peakCapital = round2(c.peakCapital);
    c.capitalDays = round2(c.capitalDays);
    delete c._held; delete c._openLegs; delete c._lastDate; delete c._flatSince;
    return c;
  }

  function build(optionPayloads, stockPayloads, opts) {
    opts = opts || {};
    var today = day(opts.today) || new Date().toISOString().slice(0, 10);
    var grace = opts.graceDays == null ? 7 : opts.graceDays;
    var legs = (optionPayloads || []).map(toLeg).filter(Boolean);
    var lots = (stockPayloads || []).map(toLot).filter(Boolean);
    var notes = fillAssignments(legs, lots);

    var groups = {};
    function g(t, a) { var k = t + '|' + a; return groups[k] = groups[k] || { ticker: t, account: a, legs: [], lots: [] }; }
    legs.forEach(function (l) { g(l.ticker, l.account).legs.push(l); });
    lots.forEach(function (l) { g(l.ticker, l.account).lots.push(l); });

    var out = [];
    Object.keys(groups).forEach(function (k) {
      var grp = groups[k];
      // Stock-only tickers with no wheel legs are plain holdings, not campaigns.
      if (!grp.legs.length) return;
      var events = eventsFor(grp.legs, grp.lots);
      var c = null;
      // Share runs with no option sold against them (a swing trade years
      // before the wheel) are not campaigns.
      function keep(x) { if (x.legs.length) out.push(x); }

      function accrue(dateTo) {
        // Capital × days since the last event, for the average-capital figure.
        if (!c) return;
        var d = daysBetween(c._lastDate, dateTo);
        if (d > 0) c.capitalDays += capital(c) * d;
        c._lastDate = dateTo;
      }

      for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (c && c._flatSince && daysBetween(c._flatSince, e.date) > grace) {
          c.status = 'closed';
          keep(finish(c, c._flatSince, opts.prices));
          c = null;
        }
        if (!c) c = newCampaign(grp.ticker, grp.account, e.date);
        accrue(e.date);
        apply(c, e);
        var lastOfDay = i === events.length - 1 || events[i + 1].date !== e.date;
        if (lastOfDay) {
          c.peakCapital = Math.max(c.peakCapital, capital(c));
          c._flatSince = exposure(c) === 0 ? e.date : null;
        }
      }
      if (c) {
        if (c._flatSince) { c.status = 'closed'; keep(finish(c, c._flatSince, opts.prices)); }
        else { accrue(today > c._lastDate ? today : c._lastDate); keep(finish(c, today, opts.prices)); }
      }
    });

    notes.forEach(function (n) {
      var c = out.find(function (x) {
        return x.ticker === n.ticker && x.account === n.account && n.date >= x.start && (!x.end || n.date <= x.end);
      });
      if (c) c.warnings.push(n.text);
    });

    return out.sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      return (b.end || b.start) < (a.end || a.start) ? -1 : (b.end || b.start) > (a.end || a.start) ? 1 : 0;
    });
  }

  function summarize(campaigns) {
    var s = { campaigns: campaigns.length, open: 0, closed: 0, optionIncome: 0, stockRealized: 0, realized: 0, winners: 0 };
    campaigns.forEach(function (c) {
      if (c.status === 'open') s.open++; else { s.closed++; if (c.realized > 0) s.winners++; }
      s.optionIncome += c.optionIncome; s.stockRealized += c.stockRealized; s.realized += c.realized;
    });
    s.optionIncome = round2(s.optionIncome); s.stockRealized = round2(s.stockRealized); s.realized = round2(s.realized);
    return s;
  }

  var api = { build: build, summarize: summarize, _toLeg: toLeg, _toLot: toLot };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AP_WHEEL = api;
})(typeof window !== 'undefined' ? window : this);
