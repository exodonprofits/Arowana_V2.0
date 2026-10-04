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
  function pending(id, label, category, blurb, needs, minMode, plan, filters) {
    R.register({
      id: id, label: label, category: category, blurb: blurb,
      needs: needs, minMode: minMode || 'guided', plan: plan || 'pro', filters: filters || [],
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
  // ══════════════════════════════════════════════════════════════════════════
  // FROM THE RETIRED STANDALONE SCANNER PAGES (ATD-009 phase 2)
  // Each old page (bb-snapback.html, hod-scanner.html, …) now redirects to
  // scanner.html?scan=<id>. Their main filters are kept here so the scan is
  // ready to wire up when its data source goes live; the old pages showed
  // demo or webhook rows, not market data.
  // ══════════════════════════════════════════════════════════════════════════
  function sel(id, label, def, opts) {
    return { id: id, label: label, type: 'select', default: def,
      options: opts.map(function (o) { return { value: o[0], label: o[1] }; }) };
  }
  function num(id, label, def) { return { id: id, label: label, type: 'number', default: def }; }
  var PRICE_BAND = sel('priceBand', 'Price band', 'all',
    [['all', 'All prices'], ['0-5', 'Under $5'], ['5-20', '$5–$20'], ['20-100', '$20–$100'], ['100+', 'Over $100']]);
  var INTRADAY_TF = sel('tf', 'Timeframe', '5m',
    [['1m', '1 minute'], ['5m', '5 minutes'], ['15m', '15 minutes'], ['1h', '1 hour']]);

  pending('base_breakout', 'Base Breakout', 'Trend',
    'Tight bases about to break their pivot.', ['candles'], 'guided', 'pro', [
      sel('timeframe', 'Timeframe', 'daily', [['daily', 'Daily'], ['weekly', 'Weekly'], ['4h', '4 hour']]),
      num('minDays', 'Minimum days in base', '5'), PRICE_BAND,
      sel('sortBy', 'Sort by', 'prox', [['prox', '% to pivot'], ['rvol', 'Relative volume'], ['squeeze', 'Squeeze score'], ['days', 'Days in base']])]);
  pending('bb_snapback', 'Bollinger Band Snapback', 'Mean Reversion',
    'Stretched outside a Bollinger Band and turning back.', ['candles'], 'guided', 'pro', [
      sel('touch', 'Band', 'lower', [['lower', 'Lower band'], ['upper', 'Upper band'], ['both', 'Both bands']]),
      sel('outside', 'Close', 'no', [['no', 'Touch is enough'], ['yes', 'Must close outside']]),
      num('sigma', 'Band width (standard deviations)', '2.0')]);
  pending('day_trade', 'Day Trade Setups', 'Momentum',
    'Gappers with volume, price and float limits.', ['candles', 'fundamentals'], 'guided', 'pro', [
      num('minGap', 'Minimum gap %', '2'), num('minRvol', 'Minimum relative volume', '1.5'),
      num('minPrice', 'Minimum price', ''), num('maxPrice', 'Maximum price', ''),
      num('floatMax', 'Maximum float (millions)', '')]);
  pending('ema_snapback', 'EMA Snapback', 'Mean Reversion',
    'Price reclaiming or rejecting a fast EMA after stretching away from it.', ['candles'], 'guided', 'pro', [
      num('fastEma', 'Fast EMA', '9'),
      sel('tf', 'Timeframe', '15m', [['5m', '5 minutes'], ['15m', '15 minutes'], ['30m', '30 minutes'], ['1h', '1 hour'], ['d', 'Daily']]),
      sel('side', 'Setup', 'both', [['reclaim', 'Reclaim (long)'], ['reject', 'Reject (short)'], ['both', 'Both']]),
      num('minDist', 'Minimum distance from EMA (%)', '0.6'), PRICE_BAND]);
  pending('gap_fade', 'Gap Fade', 'Mean Reversion',
    'Opening gaps stretched far enough to fade.', ['candles'], 'guided', 'pro', [
      sel('fadeType', 'Fade', 'up', [['up', 'Fade gap up (short bias)'], ['down', 'Fade gap down (long bias)']]),
      num('gapPctMin', 'Minimum gap %', '1.5'),
      sel('cap', 'Market cap', 'all', [['all', 'All'], ['large', 'Large ($10B+)'], ['mid', 'Mid ($2B–$10B)'], ['small', 'Small (under $2B)']])]);
  pending('high_short_float', 'High Short Float + Outflow', 'Special Situations',
    'Heavily shorted names that are overbought with money leaving.', ['fundamentals', 'candles'], 'advanced', 'elite', [
      num('shortFloat', 'Minimum short float %', '15'), num('priceFloor', 'Minimum price', '2'),
      sel('universe', 'Universe', 'SP500', [['SP500', 'S&P 500'], ['NASDAQ100', 'Nasdaq-100'], ['RUSSELL2000', 'Russell 2000']])]);
  pending('hod', 'High of Day', 'Momentum',
    'Breaking or rejecting the high of the day.', ['candles'], 'guided', 'pro', [
      sel('setup', 'Setup', 'both', [['both', 'Both'], ['breakout', 'Breakout'], ['rejection', 'Rejection']]),
      num('maxPctFromHod', 'Maximum % from high of day', '0.2'), num('minRvol', 'Minimum relative volume', '2.0')]);
  pending('intraday_breakout', 'Intraday Breakout', 'Momentum',
    'Range breaks in the middle of the session.', ['candles'], 'guided', 'pro', [
      num('brkPct', 'Breakout % over high of day', '0.5'), PRICE_BAND]);
  pending('fib_pullback', 'Fibonacci Pullback', 'Trend',
    'Pullbacks to a Fibonacci level inside a trend.', ['candles'], 'guided', 'pro', [
      INTRADAY_TF,
      sel('depth', 'Pullback depth', '0.382', [['0.236', 'Shallow (23.6%)'], ['0.382', 'Moderate (38.2%)'], ['0.5', 'Mid (50%)'], ['0.618', 'Deep (61.8%)']]),
      sel('strategy', 'Strategy', 'breakout', [['breakout', 'Trend continuation'], ['fade', 'Counter-trend fade'], ['both', 'Both']])]);
  pending('opening_drive', 'Opening Drive', 'Momentum',
    'Strong one-directional moves out of the open.', ['candles'], 'guided', 'pro', [
      num('driveMinutes', 'Drive window (minutes)', '15'), PRICE_BAND]);
  pending('chart_patterns', 'Chart Patterns', 'Trend',
    'Flags, triangles and other continuation patterns.', ['candles'], 'guided', 'pro');
  pending('scalp', 'Scalp Setups', 'Momentum',
    'Fast-timeframe setups aligned with the higher timeframe.', ['candles'], 'advanced', 'pro', [
      sel('tf', 'Timeframe', '1', [['1', '1 minute'], ['2', '2 minutes'], ['5', '5 minutes']]),
      sel('emaAlign', 'EMA 9/20', 'ANY', [['ANY', 'Any'], ['BULL', '9 above 20'], ['BEAR', '9 below 20']]),
      sel('htfAlign', 'Versus 200 EMA', 'ANY', [['ANY', 'Any'], ['BULL', 'Above'], ['BEAR', 'Below']]),
      num('rsiMin', 'Minimum RSI(7)', '0')]);
  pending('short_entry', 'Short Entry', 'Special Situations',
    'Technically weak, liquid names for short setups.', ['candles'], 'advanced', 'pro', [
      num('minLiquidity', 'Minimum 20-day average volume (millions)', '3'), num('rsiThresh', 'Minimum RSI', '70'),
      num('maBreak', 'Price versus 50/200 MA (%, at most)', '-1'), num('atrStop', 'ATR stop multiple', '2')]);
  pending('swing_multi', 'Swing Multi-Signal', 'Trend',
    'RSI, volume, moving-average and % change conditions together.', ['candles'], 'guided', 'pro', [
      sel('rsi', 'RSI', '30', [['30', 'Below 30 (oversold)'], ['70', 'Above 70 (overbought)'], ['50', 'Around 50']]),
      sel('volMult', 'Volume', '2', [['2', '2× average'], ['3', '3× average'], ['5', '5× average']]),
      sel('smaFast', 'Fast SMA', '20', [['10', '10-day'], ['20', '20-day'], ['30', '30-day']]),
      sel('smaSlow', 'Slow SMA', '50', [['50', '50-day'], ['100', '100-day'], ['200', '200-day']]),
      sel('minChange', 'Minimum change', '2', [['1', '1%+'], ['2', '2%+'], ['3', '3%+'], ['5', '5%+']])]);
  pending('trendline_break', 'Trendline Break', 'Trend',
    'Confirmed breaks of a rising or falling trendline.', ['candles'], 'guided', 'pro', [
      sel('trendType', 'Trend', 'upward', [['upward', 'Rising (breakdowns)'], ['downward', 'Falling (breakouts)']]),
      num('lookback', 'Lookback (days)', '50')]);
  pending('vwap_pullback', 'VWAP Pullback', 'Mean Reversion',
    'Pullbacks to VWAP after the trend is confirmed.', ['candles'], 'guided', 'pro', [
      sel('side', 'Setup', 'both', [['both', 'Both'], ['long', 'Long pullback'], ['short', 'Short pop']]),
      num('maxSigma', 'Maximum distance from VWAP (std dev)', '1.0'), num('minRvol', 'Minimum relative volume', '0')]);
  pending('dividend_safety', 'Dividend Safety', 'Fundamentals',
    'Well-covered dividend payers, ranked by a safety score.', ['fundamentals'], 'guided', 'pro', [
      num('minYield', 'Minimum dividend yield %', '5'), num('maxPayout', 'Maximum payout ratio %', '90'),
      num('maxFcfPayout', 'Maximum FCF payout %', '90'), num('maxDebtEbitda', 'Maximum debt / EBITDA', '5'),
      num('minCoverage', 'Minimum interest coverage', '2'),
      sel('sortBy', 'Sort by', 'score', [['score', 'Safety score'], ['yield', 'Yield'], ['payout', 'Payout ratio'], ['debt', 'Debt'], ['ticker', 'Ticker']])]);
  // ══════════════════════════════════════════════════════════════════════════
  // QUALITY COMPOUNDERS (from the retired quality-screener.html, ATD-009)
  // Runs for real when an n8n `quality_screener` webhook is configured: the
  // workflow returns company metrics for an index or a ticker list, and the
  // thresholds and composite rank below are the old page's, unchanged. Its
  // "mock mode" (five hardcoded companies) is not carried over.
  // ══════════════════════════════════════════════════════════════════════════
  /* Company shape: {ticker, name, sector, price, mcapB, roic, gm, fcfm, rev5,
     eps5, de, ic, pe, evebit, pfcf, yield, fscore, zscore, adr} */
  function qualityPasses(c, f) {
    var n = function (v, d) { var x = Number(v); return v === '' || v == null || !isFinite(x) ? d : x; };
    var deMax = n(f.debtToEqMax, Infinity), peMax = n(f.peMax, Infinity),
        evMax = n(f.evEbitMax, Infinity), pfcfMax = n(f.pfcfMax, Infinity);
    if (f.excludeADR === 'yes' && c.adr) return false;
    if (c.mcapB < n(f.mcapMin, 0)) return false;
    if (c.roic < n(f.roicMin, 0)) return false;
    if (c.gm < n(f.gmMin, 0)) return false;
    if (c.fcfm < n(f.fcfMarginMin, 0)) return false;
    if (c.rev5 < n(f.revCAGRMin, 0)) return false;
    if (c.eps5 < n(f.epsCAGRMin, 0)) return false;
    if (c.de > deMax) return false;
    if (c.ic < n(f.interestCovMin, 0)) return false;
    if (isFinite(peMax) && c.pe > peMax) return false;
    if (isFinite(evMax) && c.evebit > evMax) return false;
    if (isFinite(pfcfMax) && c.pfcf > pfcfMax) return false;
    if (c.yield < n(f.yieldMin, 0)) return false;
    if (c.fscore < n(f.fscoreMin, 0)) return false;
    if (c.zscore < n(f.zscoreMin, 0)) return false;
    return true;
  }
  /* Composite: quality 60% + growth 20% + valuation 20%, each metric scaled
     into 0..1 with soft caps. */
  function qualityScore(c) {
    var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    var q = clamp(c.roic / 30, 0, 1) * 0.35 + clamp(c.gm / 60, 0, 1) * 0.15 + clamp(c.fcfm / 20, 0, 1) * 0.15 +
            clamp(c.ic / 30, 0, 1) * 0.10 + clamp((c.fscore - 3) / 6, 0, 1) * 0.15 + clamp((c.zscore - 1.8) / 2.2, 0, 1) * 0.10;
    var g = clamp(c.rev5 / 15, 0, 1) * 0.5 + clamp(c.eps5 / 15, 0, 1) * 0.5;
    var v = clamp(35 / (c.pe || 35), 0, 1) * 0.34 + clamp(25 / (c.evebit || 25), 0, 1) * 0.33 + clamp(30 / (c.pfcf || 30), 0, 1) * 0.33;
    return 0.6 * q + 0.2 * g + 0.2 * v;
  }
  window.AP_QUALITY = { passes: qualityPasses, score: qualityScore };

  R.register({
    id: 'quality_compounders',
    label: 'Quality Compounders',
    category: 'Fundamentals',
    minMode: 'guided',
    plan: 'free',
    blurb: 'Durable businesses: high returns on capital, cash generation and a sound balance sheet, ranked by a quality-first score.',
    needs: ['backend'],
    filters: [
      sel('index', 'Universe', 'SP500', [['SP500', 'S&P 500'], ['NASDAQ100', 'Nasdaq-100'], ['RUSSELL1000', 'Russell 1000'], ['CUSTOM', 'My tickers']]),
      { id: 'tickers', label: 'Tickers (for "My tickers")', type: 'text', default: '' },
      { id: 'sector', label: 'Sector contains', type: 'text', default: '' },
      num('mcapMin', 'Market cap at least ($B)', '5'),
      num('roicMin', 'ROIC at least (%)', '10'),
      num('gmMin', 'Gross margin at least (%)', '35'),
      num('fcfMarginMin', 'FCF margin at least (%)', '5'),
      num('revCAGRMin', '5-yr revenue growth at least (%)', '5'),
      num('epsCAGRMin', '5-yr EPS growth at least (%)', '5'),
      num('debtToEqMax', 'Debt / equity at most', '1.0'),
      num('interestCovMin', 'Interest coverage at least (×)', '5'),
      num('peMax', 'P/E at most (blank = any)', ''),
      num('evEbitMax', 'EV/EBIT at most (blank = any)', ''),
      num('pfcfMax', 'P/FCF at most (blank = any)', ''),
      num('yieldMin', 'Dividend yield at least (%)', ''),
      num('fscoreMin', 'Piotroski F-Score at least', '6'),
      num('zscoreMin', 'Altman Z-Score at least', '2.5'),
      sel('excludeADR', 'ADRs', 'no', [['no', 'Include'], ['yes', 'Exclude']])
    ],
    async run(ctx) {
      var f = ctx.filters || {};
      var url = window.AP_WEBHOOKS && window.AP_WEBHOOKS.quality_screener;
      if (!url || !/^https:\/\//i.test(String(url))) {
        return { rows: [], universeSize: 0,
          note: 'This scan needs the quality_screener n8n workflow, which is not configured yet. Nothing is broken — the data pipeline for it is not live.' };
      }
      var tickers = String(f.tickers || '').trim();
      if (f.index === 'CUSTOM' && !tickers) return { rows: [], universeSize: 0, note: 'Add tickers for "My tickers", separated by commas.' };
      var data = await window.callWebhook(String(url), { index: f.index || 'SP500', tickers: tickers || null, sector: String(f.sector || '').trim() || null });
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
      var sector = String(f.sector || '').trim().toLowerCase();
      if (sector) list = list.filter(function (c) { return String(c && c.sector || '').toLowerCase().indexOf(sector) !== -1; });
      var ranked = list.filter(function (c) { return c && c.ticker && qualityPasses(c, f); })
        .map(function (c) { return { c: c, s: qualityScore(c) }; })
        .sort(function (a, b) { return b.s - a.s; });
      var pct = function (v) { return isFinite(Number(v)) ? Number(v).toFixed(1) + '%' : '—'; };
      var x1 = function (v) { return isFinite(Number(v)) ? Number(v).toFixed(1) : '—'; };
      return {
        universeSize: list.length,
        rows: ranked.map(function (r, i) {
          var c = r.c, reasons = [];
          if (c.roic >= 20) reasons.push('High ROIC');
          if (c.fcfm >= 20) reasons.push('Strong FCF');
          if (c.evebit <= 20) reasons.push('Reasonable EV/EBIT');
          if (c.adr) reasons.push('ADR');
          return {
            symbol: String(c.ticker).toUpperCase(),
            price: isFinite(Number(c.price)) ? Number(c.price) : null,
            change: null,
            metrics: [
              { label: '#' + (i + 1) + ' score', value: (r.s * 100).toFixed(0) },
              { label: 'ROIC', value: pct(c.roic) }, { label: 'GM', value: pct(c.gm) }, { label: 'FCF', value: pct(c.fcfm) },
              { label: 'Rev 5y', value: pct(c.rev5) }, { label: 'EV/EBIT', value: x1(c.evebit) },
              { label: 'F', value: c.fscore != null ? String(c.fscore) : '—' }, { label: 'Z', value: x1(c.zscore) }
            ],
            verdict: r.s >= 0.7 ? 'good' : 'neutral',
            reasons: reasons.concat(c.name ? [String(c.name)] : [])
          };
        }),
        note: list.length ? ranked.length + ' of ' + list.length + ' companies pass your thresholds.' : 'The workflow returned no companies.'
      };
    }
  });
})(window);
