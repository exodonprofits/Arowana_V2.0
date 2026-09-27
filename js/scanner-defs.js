/* ============================================================================
   Arowana — Scanner Definitions  (js/scanner-defs.js)
   ----------------------------------------------------------------------------
   Every scan the platform offers, registered against js/scanners.js. Adding one
   here makes it appear in scanner.html with its filters, its data requirements
   and its disabled state — no change to that page.

   The honest position, stated once here rather than discovered per scan:

     A browser cannot rank a market. Finnhub's /quote is one request per symbol,
     carries no volume, and /stock/candle is 403 on the free tier. So anything
     that needs to sort thousands of symbols by relative volume, or compare
     price to a 52-week high, or measure an opening range, CANNOT run client
     side. Those scans are registered anyway, declaring needs:['candles'] or
     needs:['backend'], so the page shows them greyed with the reason instead of
     pretending. When the n8n scanner writes to Supabase, their run() bodies get
     filled in and they light up on their own.

     What genuinely works today is the quote-based scan of a KNOWN LIST — your
     watchlist, your holdings. That is a real, useful thing; it is just not a
     market scan, and it should not be dressed as one.
   ========================================================================== */
(function (window) {
  'use strict';
  if (!window.AP_SCANNERS) {
    console.warn('[scanner-defs] AP_SCANNERS not found — load js/scanners.js first.');
    return;
  }
  var R = window.AP_SCANNERS;

  // ── helpers ───────────────────────────────────────────────────────────────
  function finnhubKey() {
    try {
      var k = JSON.parse(localStorage.getItem('ap_user_api_keys') || '{}');
      return k.finnhub || (window.AP_USER_KEYS && window.AP_USER_KEYS.finnhub) || null;
    } catch (_) { return null; }
  }

  /** Symbols the user actually holds or tracks — the only universe a browser
      can legitimately cover one quote at a time. */
  function personalUniverse() {
    var syms = new Set();
    try {
      (JSON.parse(localStorage.getItem('tj_stocks_v2') || '[]') || []).forEach(function (t) {
        if (t && t.status !== 'closed' && t.ticker) syms.add(String(t.ticker).toUpperCase());
      });
    } catch (_) {}
    try {
      (JSON.parse(localStorage.getItem('stw_watchlist_v1') || '[]') || []).forEach(function (w) {
        if (w && w.symbol) syms.add(String(w.symbol).toUpperCase());
      });
    } catch (_) {}
    return Array.from(syms);
  }

  async function quoteFor(symbol, key) {
    var r = await fetch('https://finnhub.io/api/v1/quote?symbol=' +
                        encodeURIComponent(symbol) + '&token=' + encodeURIComponent(key));
    if (!r.ok) throw new Error('Finnhub ' + r.status);
    return await r.json();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WORKS TODAY — quote-based, over a list the user already has
  // ══════════════════════════════════════════════════════════════════════════
  R.register({
    id: 'my_movers',
    label: 'My Movers',
    category: 'Momentum',
    minMode: 'beginner',
    plan: 'free',
    blurb: 'Today\u2019s biggest moves among the symbols you hold or track.',
    needs: ['quote'],
    filters: [
      { id: 'minMove', label: 'Minimum move', type: 'select', default: '2',
        options: [
          { value: '1', label: '1% or more' },
          { value: '2', label: '2% or more' },
          { value: '5', label: '5% or more' }
        ] },
      { id: 'direction', label: 'Direction', type: 'select', default: 'both',
        options: [
          { value: 'both', label: 'Up or down' },
          { value: 'up',   label: 'Up only' },
          { value: 'down', label: 'Down only' }
        ] }
    ],
    async run(ctx) {
      var key = finnhubKey();
      var universe = personalUniverse();
      if (!universe.length) {
        return { rows: [], universeSize: 0,
          note: 'No open positions or watchlist symbols yet. This scan looks at what you already hold or track.' };
      }

      var minMove = parseFloat(ctx.filters.minMove) / 100;
      var dir = ctx.filters.direction;
      var rows = [];
      var checked = 0;

      /* Sequential and capped. One request per symbol is the constraint that
         makes a real market scan impossible here; hammering the rate limit for
         a personal list would just turn a working scan into a broken one. */
      for (var i = 0; i < universe.length && i < 40; i++) {
        try {
          var q = await quoteFor(universe[i], key);
          checked++;
          if (!q || !q.c || !q.pc) continue;
          var change = (q.c - q.pc) / q.pc;
          if (Math.abs(change) < minMove) continue;
          if (dir === 'up' && change < 0) continue;
          if (dir === 'down' && change > 0) continue;

          rows.push({
            symbol: universe[i],
            price: q.c,
            change: change,
            metrics: [{ label: 'Prev close', value: '$' + Number(q.pc).toFixed(2) }],
            verdict: Math.abs(change) >= 0.05 ? 'good' : 'neutral',
            reasons: [change >= 0 ? 'Up on the day' : 'Down on the day']
          });
        } catch (e) { /* one bad symbol should not end the scan */ }
      }

      rows.sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); });
      return {
        rows: rows,
        universeSize: checked,
        partial: universe.length > 40,
        note: universe.length > 40
          ? 'Checked the first 40 of ' + universe.length + ' symbols to stay inside the Finnhub rate limit.'
          : ''
      };
    }
  });

  R.register({
    id: 'gap_scan',
    label: 'Gap Scan',
    category: 'Momentum',
    minMode: 'guided',
    plan: 'free',
    blurb: 'Overnight gaps against the previous close, across your symbols.',
    needs: ['quote'],
    filters: [
      { id: 'minGap', label: 'Minimum gap', type: 'select', default: '2',
        options: [
          { value: '1', label: '1% or more' },
          { value: '2', label: '2% or more' },
          { value: '4', label: '4% or more' }
        ] },
      { id: 'direction', label: 'Direction', type: 'select', default: 'both',
        options: [
          { value: 'both', label: 'Gap up or down' },
          { value: 'up',   label: 'Gap up' },
          { value: 'down', label: 'Gap down' }
        ] }
    ],
    async run(ctx) {
      var key = finnhubKey();
      var universe = personalUniverse();
      if (!universe.length) {
        return { rows: [], universeSize: 0,
          note: 'No open positions or watchlist symbols yet.' };
      }

      var minGap = parseFloat(ctx.filters.minGap) / 100;
      var dir = ctx.filters.direction;
      var rows = [], checked = 0, usedLast = 0;

      for (var i = 0; i < universe.length && i < 40; i++) {
        try {
          var q = await quoteFor(universe[i], key);
          checked++;
          if (!q || !q.pc) continue;

          /* A gap is the OPEN against the previous close. Measuring (c - pc)
             reports the whole day's move instead, so a stock that opened flat
             and rallied 5% shows as a 5% "gap" — a different event entirely.
             Pre-open, `o` can be 0; fall back and SAY so rather than blur the
             two together. */
          var haveOpen = Number(q.o) > 0;
          if (!haveOpen) usedLast++;
          var gap = haveOpen ? (q.o - q.pc) / q.pc : (q.c - q.pc) / q.pc;

          if (Math.abs(gap) < minGap) continue;
          if (dir === 'up' && gap < 0) continue;
          if (dir === 'down' && gap > 0) continue;

          rows.push({
            symbol: universe[i],
            price: q.c,
            change: gap,
            metrics: [
              { label: 'Open', value: haveOpen ? '$' + Number(q.o).toFixed(2) : 'n/a' },
              { label: 'Prev close', value: '$' + Number(q.pc).toFixed(2) }
            ],
            verdict: Math.abs(gap) >= 0.04 ? 'good' : 'neutral',
            reasons: [haveOpen ? 'Gap measured from the open' : 'No open yet — using last price']
          });
        } catch (e) {}
      }

      rows.sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); });
      return {
        rows: rows,
        universeSize: checked,
        note: usedLast ? usedLast + ' symbol(s) had no opening price yet, so the day\u2019s move was used instead.' : ''
      };
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTERED BUT NOT YET POSSIBLE
  // Declared so the page lists them greyed WITH A REASON, rather than leaving
  // the user wondering whether the feature exists. run() bodies get written
  // when the backend scanner can supply the data.
  // ══════════════════════════════════════════════════════════════════════════
  function pending(id, label, category, blurb, needs, minMode, plan) {
    R.register({
      id: id, label: label, category: category, blurb: blurb,
      needs: needs, minMode: minMode || 'guided', plan: plan || 'pro', filters: [],
      async run() {
        /* Deliberately explicit. An empty table reads as "broken"; naming the
           missing piece reads as "not built yet", which is the truth and is
           also what tells you what to build next. */
        var miss = (needs || []).map(function (n) {
          var d = R.DATA_SOURCES[n];
          return d ? d.label : n;
        }).join(' and ');
        return { rows: [], universeSize: 0,
          note: 'This scan is ready to go as soon as ' + miss + ' is available. ' +
                'Nothing is broken — the data pipeline for it is not live yet.' };
      }
    });
  }

  pending('rvol_surge', 'Relative Volume Surge', 'Momentum',
    'Unusual volume against a symbol\u2019s own average.', ['candles'], 'guided', 'pro');
  pending('near_high', 'Near 52-Week High', 'Trend',
    'Price pressing against its yearly high.', ['candles'], 'guided', 'pro');
  pending('orb', 'Opening Range Breakout', 'Momentum',
    'Break of the first 15\u201330 minutes\u2019 range.', ['candles'], 'guided', 'pro');
  pending('sma_cross', 'Moving Average Cross', 'Trend',
    'Shorter average crossing a longer one.', ['candles'], 'guided', 'pro');
  pending('rsi_reversal', 'RSI Reversal', 'Mean Reversion',
    'Oversold or overbought turning back.', ['candles'], 'guided', 'pro');
  pending('short_squeeze', 'Short Squeeze Candidates', 'Special Situations',
    'High short interest meeting rising price.', ['fundamentals', 'candles'], 'advanced', 'elite');
  pending('post_earnings', 'Post-Earnings Drift', 'Special Situations',
    'Continuation after an earnings surprise.', ['fundamentals', 'candles'], 'advanced', 'elite');
  pending('market_movers', 'Market-Wide Movers', 'Momentum',
    'Biggest movers across the whole market, not just your list.', ['backend'], 'guided', 'pro');
  pending('covered_call', 'Covered Call Candidates', 'Options',
    'Premium worth writing against stock you own.', ['backend'], 'advanced', 'elite');
  pending('csp', 'Cash-Secured Put Candidates', 'Options',
    'Puts on names worth owning at assignment.', ['backend'], 'advanced', 'elite');
})(window);
