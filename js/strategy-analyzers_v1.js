/* ══════════════════════════════════════════════════════════════════════
   strategy-analyzers.js — shared strategy-analysis registry
   ══════════════════════════════════════════════════════════════════════
   Extensible module: any page includes this once, registers/uses
   strategies via window.StrategyAnalyzers. New strategies are added with
   a single StrategyAnalyzers.register() call — no caller-side changes
   needed (watchlist.html's picker UI reads the registry dynamically).

   DATA REALITY (read before wiring a new analyzer):
   - Finnhub's free tier only covers /quote (current price). It does NOT
     cover /stock/candle (historical OHLCV) — that's premium-only as of
     this writing. So bars come from Twelve Data (primary) with Alpha
     Vantage as fallback, both BYOK, both read from the same
     `ap_user_api_keys` localStorage object the rest of the app already
     uses (keys: .twelvedata, .alphavantage). If neither key is present,
     analyzers that need bars fail with an honest message pointing at
     Account → API Keys — there is no silent fallback to fabricated data.
   - Wheel/CSP and Covered Call analyzers do NOT have a live options
     chain to draw from (no options-data source is wired into the stack
     yet — that's the Sprint 2 CC/CSP scanner work). They approximate
     "premium richness" from historical volatility instead of real IV.
     Every result from these two carries an explicit `disclaimer` field
     — surface it in the UI, don't drop it.
   - Momentum Zones is a placeholder: true intraday zone detection needs
     an intraday bar feed, which isn't wired here. It runs the same
     detector as Swing Zones but on a short daily lookback, labeled
     accordingly. Don't present it as real intraday granularity.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // ── API keys (same object watchlist.html's Finnhub BYOK already reads) ──
  function getKeys(){
    try{
      const raw = localStorage.getItem('ap_user_api_keys');
      if(!raw) return {};
      return JSON.parse(raw) || {};
    }catch(e){ return {}; }
  }

  // ── Bars fetch: Twelve Data primary, Alpha Vantage fallback ──
  const BARS_CACHE_PREFIX = 'sab_bars_cache_v1_';
  const BARS_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4h — daily bars don't need to be fresher than that

  async function fetchBarsTwelveData(symbol, key){
    const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=260&apikey=${key}`);
    const j = await res.json();
    if(j.status === 'error' || !Array.isArray(j.values)) throw new Error(j.message || 'Twelve Data request failed');
    return j.values.slice().reverse().map(v => ({
      t: v.datetime, o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0)
    }));
  }

  async function fetchBarsAlphaVantage(symbol, key){
    const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${key}`);
    const j = await res.json();
    const series = j['Time Series (Daily)'];
    if(!series) throw new Error(j['Note'] || j['Information'] || 'Alpha Vantage request failed');
    return Object.entries(series)
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([date, v]) => ({
        t: date, o: +v['1. open'], h: +v['2. high'], l: +v['3. low'], c: +v['4. close'], v: +v['5. volume']
      }));
  }

  async function getDailyBars(symbol){
    symbol = String(symbol || '').toUpperCase();
    const cacheKey = BARS_CACHE_PREFIX + symbol;
    try{
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if(cached && (Date.now() - cached.ts) < BARS_CACHE_TTL_MS) return cached.bars;
    }catch(e){ /* ignore cache-read errors, fall through to a live fetch */ }

    const keys = getKeys();
    let bars = null, lastErr = null;

    if(keys.twelvedata){
      try{ bars = await fetchBarsTwelveData(symbol, keys.twelvedata); }
      catch(e){ lastErr = e; }
    }
    if(!bars && keys.alphavantage){
      try{ bars = await fetchBarsAlphaVantage(symbol, keys.alphavantage); }
      catch(e){ lastErr = e; }
    }
    if(!bars){
      const hint = (keys.twelvedata || keys.alphavantage)
        ? (lastErr ? lastErr.message : 'Bars request failed')
        : 'No bars source configured — add a Twelve Data or Alpha Vantage API key in Account → API Keys.';
      throw new Error(hint);
    }

    try{ sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), bars })); }catch(e){ /* quota, non-fatal */ }
    return bars;
  }

  // ── Math helpers ──
  const mean = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  function computeHV(bars, period){
    period = period || 20;
    const closes = bars.slice(-(period + 1)).map(b => b.c);
    if(closes.length < 3) return null;
    const rets = [];
    for(let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const m = mean(rets);
    const variance = mean(rets.map(r => (r - m) ** 2));
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
  }

  function pctChange(bars, lookback){
    if(bars.length < lookback + 1) return null;
    const a = bars[bars.length - 1 - lookback].c;
    const b = bars[bars.length - 1].c;
    return ((b - a) / a) * 100;
  }

  // ── Trend badge (grid-mode column, not tied to any single strategy) ──
  function computeTrend(bars, lookback){
    lookback = lookback || 10;
    const pct = pctChange(bars, lookback);
    if(pct == null) return { direction: 'flat', pct: null };
    const direction = pct > 1.5 ? 'up' : pct < -1.5 ? 'down' : 'flat';
    return { direction, pct };
  }

  // ── Math helpers: RSI / EMA / SMA / Bollinger ──
  // Note: sma_cross needs ~200 bars. Twelve Data is fetched with enough
  // history (260) for this; the Alpha Vantage fallback uses 'compact'
  // (~100 points) and will legitimately fail sma_cross with a clear
  // "not enough history" message for Alpha-Vantage-only users — that's
  // an honest limitation, not a bug, given the fallback's scope.
  function smaSeries(closes, period){
    const out = new Array(closes.length).fill(null);
    for(let i = period - 1; i < closes.length; i++) out[i] = mean(closes.slice(i - period + 1, i + 1));
    return out;
  }

  function emaSeries(closes, period){
    const out = new Array(closes.length).fill(null);
    if(closes.length < period) return out;
    const k = 2 / (period + 1);
    let ema = mean(closes.slice(0, period));
    out[period - 1] = ema;
    for(let i = period; i < closes.length; i++){
      ema = closes[i] * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  function computeRSI(closes, period){
    period = period || 14;
    if(closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for(let i = 1; i <= period; i++){
      const diff = closes[i] - closes[i - 1];
      if(diff >= 0) gains += diff; else losses += -diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for(let i = period + 1; i < closes.length; i++){
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    }
    if(avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  function computeBollinger(closes, period, mult){
    period = period || 20; mult = mult || 2;
    if(closes.length < period) return null;
    const slice = closes.slice(-period);
    const sma = mean(slice);
    const variance = mean(slice.map(c => (c - sma) ** 2));
    const sd = Math.sqrt(variance);
    const upper = sma + mult * sd, lower = sma - mult * sd;
    const price = closes[closes.length - 1];
    const pctB = (upper - lower) !== 0 ? (price - lower) / (upper - lower) : 0.5;
    return { sma, upper, lower, pctB, price };
  }

  function computeMFI(bars, period){
    period = period || 14;
    if(bars.length < period + 1) return null;
    const tp = bars.map(b => (b.h + b.l + b.c) / 3);
    const rmf = bars.map((b, i) => tp[i] * b.v);
    let posFlow = 0, negFlow = 0;
    const start = bars.length - period;
    for(let i = start; i < bars.length; i++){
      if(tp[i] > tp[i - 1]) posFlow += rmf[i];
      else if(tp[i] < tp[i - 1]) negFlow += rmf[i];
    }
    if(negFlow === 0) return 100;
    const mfr = posFlow / negFlow;
    return 100 - (100 / (1 + mfr));
  }

  function computeATR(bars, period){
    period = period || 14;
    if(bars.length < period + 1) return null;
    const trs = [];
    for(let i = 1; i < bars.length; i++){
      const b = bars[i], prev = bars[i - 1];
      trs.push(Math.max(b.h - b.l, Math.abs(b.h - prev.c), Math.abs(b.l - prev.c)));
    }
    return mean(trs.slice(-period));
  }


  function findPivots(bars, window){
    window = window || 2;
    const pivots = [];
    for(let i = window; i < bars.length - window; i++){
      const slice = bars.slice(i - window, i + window + 1);
      const isHigh = bars[i].h === Math.max(...slice.map(b => b.h));
      const isLow = bars[i].l === Math.min(...slice.map(b => b.l));
      if(isHigh) pivots.push({ type: 'high', price: bars[i].h, vol: bars[i].v, date: bars[i].t });
      if(isLow) pivots.push({ type: 'low', price: bars[i].l, vol: bars[i].v, date: bars[i].t });
    }
    return pivots;
  }

  function clusterPivots(pivots, tolerancePct){
    const sorted = [...pivots].sort((a, b) => a.price - b.price);
    const clusters = [];
    for(const p of sorted){
      const c = clusters.find(cl => Math.abs(p.price - cl.avgPrice) / cl.avgPrice <= tolerancePct);
      if(c){
        c.points.push(p);
        c.avgPrice = mean(c.points.map(pt => pt.price));
      } else {
        clusters.push({ avgPrice: p.price, points: [p] });
      }
    }
    return clusters;
  }

  function detectZones(bars, opts){
    opts = opts || {};
    const lookback = opts.lookback || bars.length;
    const tolerancePct = opts.tolerancePct != null ? opts.tolerancePct : 0.015;
    const pivotWindow = opts.pivotWindow || 2;
    const minTouches = opts.minTouches || 2;

    const slice = bars.slice(-lookback);
    if(slice.length < pivotWindow * 2 + 3) return { supply: [], demand: [] };

    const pivots = findPivots(slice, pivotWindow);
    const avgVol = mean(slice.map(b => b.v)) || 1;

    function toZone(c, type){
      const touches = c.points.length;
      const totalVol = c.points.reduce((s, p) => s + p.vol, 0);
      const prices = c.points.map(p => p.price);
      return {
        type,
        priceLow: Math.min(...prices),
        priceHigh: Math.max(...prices),
        mid: c.avgPrice,
        touchCount: touches,
        strength: Math.round((touches * 2 + totalVol / avgVol) * 10) / 10,
        lastTouch: c.points.map(p => p.date).sort().slice(-1)[0]
      };
    }

    const supply = clusterPivots(pivots.filter(p => p.type === 'high'), tolerancePct)
      .filter(c => c.points.length >= minTouches).map(c => toZone(c, 'supply'))
      .sort((a, b) => b.strength - a.strength);
    const demand = clusterPivots(pivots.filter(p => p.type === 'low'), tolerancePct)
      .filter(c => c.points.length >= minTouches).map(c => toZone(c, 'demand'))
      .sort((a, b) => b.strength - a.strength);

    return { supply, demand };
  }

  function nearestZone(zones, currentPrice){
    if(!zones.length) return null;
    return zones.map(z => ({ ...z, distancePct: ((z.mid - currentPrice) / currentPrice) * 100 }))
      .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];
  }

  // ── Grid batch runner ──
  // Bars are cached per-symbol (see getDailyBars), so running N strategies
  // against the same symbol costs exactly ONE bars request, not N. This
  // only paces the network when a symbol's bars AREN'T already cached —
  // repeat runs (or overlapping strategy selections) cost nothing extra.
  // spacingMs is conservative for free-tier rate limits; lower it if you
  // upgrade a data-source plan.
  async function runGridAnalysis(symbols, strategyKeys, opts){
    opts = opts || {};
    const spacingMs = opts.spacingMs != null ? opts.spacingMs : 1200;
    const onSymbolDone = opts.onSymbolDone || function(){};
    const onSymbolError = opts.onSymbolError || function(){};

    for(const symbol of symbols){
      const cacheKey = BARS_CACHE_PREFIX + String(symbol).toUpperCase();
      let cachedBefore = false;
      try{
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        cachedBefore = !!(cached && (Date.now() - cached.ts) < BARS_CACHE_TTL_MS);
      }catch(e){ /* ignore */ }

      try{
        const bars = await getDailyBars(symbol);
        const trend = computeTrend(bars, 10);
        const results = {};
        for(const key of strategyKeys){
          try{ results[key] = await run(key, symbol); }
          catch(e){ results[key] = errorResult(key, key, e.message); }
        }
        onSymbolDone(symbol, { trend, results, currentPrice: bars[bars.length - 1].c });
      }catch(e){
        onSymbolError(symbol, e.message);
      }

      // Only throttle when we actually hit the network for this symbol —
      // a cache hit costs nothing, so don't slow the loop down for it.
      if(!cachedBefore) await new Promise(res => setTimeout(res, spacingMs));
    }
  }

  function errorResult(strategy, label, message){
    return { strategy, label, verdict: 'error', score: null, reasons: [message], details: {}, error: true };
  }

  // ── Analyzer: Swing Supply/Demand Zones ──
  async function analyzeSwingZones(ticker){
    const label = 'Swing Supply/Demand Zones';
    let bars;
    try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('swing_zones', label, e.message); }
    if(bars.length < 20) return errorResult('swing_zones', label, 'Not enough bar history yet — try again once more history is cached.');

    const currentPrice = bars[bars.length - 1].c;
    const { supply, demand } = detectZones(bars, { lookback: Math.min(bars.length, 150), pivotWindow: 3, tolerancePct: 0.02 });
    const nearSupply = nearestZone(supply, currentPrice);
    const nearDemand = nearestZone(demand, currentPrice);

    let verdict = 'neutral', reasons = [];
    if(nearDemand && Math.abs(nearDemand.distancePct) <= 2){
      verdict = 'good';
      reasons.push(`Price is within ${Math.abs(nearDemand.distancePct).toFixed(1)}% of a demand zone ($${nearDemand.priceLow.toFixed(2)}–$${nearDemand.priceHigh.toFixed(2)}, ${nearDemand.touchCount} touches) — a defined level to watch for a bounce.`);
    } else if(nearSupply && Math.abs(nearSupply.distancePct) <= 2){
      verdict = 'poor';
      reasons.push(`Price is within ${Math.abs(nearSupply.distancePct).toFixed(1)}% of a supply zone ($${nearSupply.priceLow.toFixed(2)}–$${nearSupply.priceHigh.toFixed(2)}, ${nearSupply.touchCount} touches) — overhead resistance close by.`);
    } else {
      reasons.push('Price is currently mid-range between the nearest detected zones.');
    }
    if(!supply.length && !demand.length) reasons.push('No clustered zones met the touch-count threshold over this lookback — thin price history or a strongly trending, low-consolidation stock.');

    return {
      strategy: 'swing_zones', label, verdict, score: null,
      reasons, details: { currentPrice, nearestSupply: nearSupply, nearestDemand: nearDemand },
      zones: { supply: supply.slice(0, 5), demand: demand.slice(0, 5) }
    };
  }

  // ── Analyzer: Momentum Zones (daily-bar proxy — see file header) ──
  async function analyzeMomentumZones(ticker){
    const label = 'Momentum Zones (daily-bar proxy)';
    let bars;
    try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('momentum_zones', label, e.message); }
    if(bars.length < 15) return errorResult('momentum_zones', label, 'Not enough bar history yet.');

    const currentPrice = bars[bars.length - 1].c;
    const { supply, demand } = detectZones(bars, { lookback: Math.min(bars.length, 20), pivotWindow: 1, tolerancePct: 0.01, minTouches: 2 });
    const nearSupply = nearestZone(supply, currentPrice);
    const nearDemand = nearestZone(demand, currentPrice);

    let verdict = 'neutral', reasons = [
      'Computed from daily bars, not intraday — treat this as a short-lookback bias check, not true intraday zone granularity. Wiring an intraday feed would sharpen this.'
    ];
    if(nearDemand && Math.abs(nearDemand.distancePct) <= 1.5){
      verdict = 'good';
      reasons.unshift(`Tight demand cluster ${Math.abs(nearDemand.distancePct).toFixed(1)}% away ($${nearDemand.priceLow.toFixed(2)}–$${nearDemand.priceHigh.toFixed(2)}).`);
    } else if(nearSupply && Math.abs(nearSupply.distancePct) <= 1.5){
      verdict = 'poor';
      reasons.unshift(`Tight supply cluster ${Math.abs(nearSupply.distancePct).toFixed(1)}% away ($${nearSupply.priceLow.toFixed(2)}–$${nearSupply.priceHigh.toFixed(2)}).`);
    } else {
      reasons.unshift('No tight zone within the recent 20-session window near current price.');
    }

    return {
      strategy: 'momentum_zones', label, verdict, score: null,
      reasons, details: { currentPrice, nearestSupply: nearSupply, nearestDemand: nearDemand },
      zones: { supply: supply.slice(0, 5), demand: demand.slice(0, 5) }
    };
  }

  // ── Analyzer: Wheel / CSP Suitability (HV-approximated, no live chain) ──
  async function analyzeWheel(ticker){
    const label = 'Wheel / CSP Suitability';
    let bars;
    try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('wheel_csp', label, e.message); }
    if(bars.length < 30) return errorResult('wheel_csp', label, 'Not enough bar history yet.');

    const currentPrice = bars[bars.length - 1].c;
    const hv = computeHV(bars, 20);
    const trend10 = pctChange(bars, 10);
    const { demand } = detectZones(bars, { lookback: Math.min(bars.length, 120), pivotWindow: 3, tolerancePct: 0.02 });
    const nearDemand = nearestZone(demand, currentPrice);

    let score = 50, reasons = [];
    if(hv != null){
      if(hv >= 30){ score += 15; reasons.push(`20d historical volatility ~${hv.toFixed(1)}% (annualized) — likely richer premium.`); }
      else if(hv < 15){ score -= 15; reasons.push(`20d historical volatility only ~${hv.toFixed(1)}% — premium is probably thin.`); }
    }
    if(nearDemand && nearDemand.distancePct <= 2 && nearDemand.distancePct >= -8){
      score += 15;
      reasons.push(`Nearby demand zone ($${nearDemand.priceLow.toFixed(2)}–$${nearDemand.priceHigh.toFixed(2)}) gives a defined anchor for a put strike.`);
    }
    if(trend10 != null){
      if(trend10 < -15){ score -= 20; reasons.push(`Down ${Math.abs(trend10).toFixed(1)}% over the last 10 sessions — elevated assignment/drawdown risk.`); }
      else if(trend10 > -15 && trend10 < 10){ score += 10; reasons.push('Range-bound to mildly trending over the last 10 sessions — a typical wheel-friendly tape.'); }
    }
    score = Math.max(0, Math.min(100, score));
    const verdict = score >= 65 ? 'good' : score >= 40 ? 'neutral' : 'poor';

    return {
      strategy: 'wheel_csp', label, verdict, score, reasons,
      details: { currentPrice, historicalVolatilityPct: hv, trend10Pct: trend10, nearestDemandZone: nearDemand },
      disclaimer: 'No live options chain is wired in yet — this approximates premium richness from historical volatility, not actual IV. Real IV/skew is planned for the Sprint 2 CC/CSP scanner.'
    };
  }

  // ── Analyzer: Covered Call Suitability (HV-approximated, no live chain) ──
  async function analyzeCoveredCall(ticker){
    const label = 'Covered Call Suitability';
    let bars;
    try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('covered_call', label, e.message); }
    if(bars.length < 30) return errorResult('covered_call', label, 'Not enough bar history yet.');

    const currentPrice = bars[bars.length - 1].c;
    const hv = computeHV(bars, 20);
    const trend10 = pctChange(bars, 10);
    const { supply } = detectZones(bars, { lookback: Math.min(bars.length, 120), pivotWindow: 3, tolerancePct: 0.02 });
    const nearSupply = nearestZone(supply, currentPrice);

    let score = 50, reasons = [];
    if(hv != null){
      if(hv >= 25){ score += 15; reasons.push(`20d historical volatility ~${hv.toFixed(1)}% — likely decent call premium.`); }
      else if(hv < 12){ score -= 15; reasons.push(`20d historical volatility only ~${hv.toFixed(1)}% — call premium is probably thin.`); }
    }
    if(nearSupply && nearSupply.distancePct >= -2 && nearSupply.distancePct <= 8){
      score += 15;
      reasons.push(`Nearby supply zone ($${nearSupply.priceLow.toFixed(2)}–$${nearSupply.priceHigh.toFixed(2)}) gives a defined anchor for a call strike.`);
    }
    if(trend10 != null){
      if(trend10 > 20){ score -= 15; reasons.push(`Up ${trend10.toFixed(1)}% over the last 10 sessions — strong runs risk capping upside you'd rather keep.`); }
      else if(trend10 >= -5 && trend10 <= 15){ score += 10; reasons.push('Flat-to-mildly-up over the last 10 sessions — a typical covered-call-friendly tape.'); }
    }
    score = Math.max(0, Math.min(100, score));
    const verdict = score >= 65 ? 'good' : score >= 40 ? 'neutral' : 'poor';

    return {
      strategy: 'covered_call', label, verdict, score, reasons,
      details: { currentPrice, historicalVolatilityPct: hv, trend10Pct: trend10, nearestSupplyZone: nearSupply },
      disclaimer: 'No live options chain is wired in yet — this approximates premium richness from historical volatility, not actual IV. Real IV/skew is planned for the Sprint 2 CC/CSP scanner.'
    };
  }

  // ── Analyzer: RSI Reversal ──
  async function analyzeRsiReversal(ticker){
    const label = 'RSI Reversal';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('rsi_reversal', label, e.message); }
    if(bars.length < 20) return errorResult('rsi_reversal', label, 'Not enough bar history yet.');
    const closes = bars.map(b => b.c);
    const rsi = computeRSI(closes, 14);
    if(rsi == null) return errorResult('rsi_reversal', label, 'Could not compute RSI.');

    let verdict = 'neutral', reasons = [];
    if(rsi <= 30){ verdict = 'good'; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — oversold, a reversal-up candidate.`); }
    else if(rsi >= 70){ verdict = 'good'; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — overbought, a reversal-down candidate.`); }
    else if(rsi > 40 && rsi < 60){ verdict = 'poor'; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — mid-range, no reversal edge here.`); }
    else { reasons.push(`RSI(14) at ${rsi.toFixed(1)} — approaching an extreme but not there yet.`); }

    return { strategy: 'rsi_reversal', label, verdict, score: Math.round(Math.abs(rsi - 50) * 2), reasons, details: { rsi, currentPrice: closes[closes.length - 1] } };
  }

  // ── Analyzer: EMA Snapback ──
  async function analyzeEmaSnapback(ticker){
    const label = 'EMA Snapback';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('ema_snapback', label, e.message); }
    if(bars.length < 21) return errorResult('ema_snapback', label, 'Not enough bar history yet.');
    const closes = bars.map(b => b.c);
    const ema20 = emaSeries(closes, 20).slice(-1)[0];
    if(ema20 == null) return errorResult('ema_snapback', label, 'Could not compute EMA.');
    const price = closes[closes.length - 1];
    const distPct = ((price - ema20) / ema20) * 100;

    let verdict = 'neutral', reasons = [];
    if(Math.abs(distPct) >= 5){ verdict = 'good'; reasons.push(`Price is ${distPct.toFixed(1)}% from the 20-day EMA — stretched enough for a snapback watch.`); }
    else if(Math.abs(distPct) < 1.5){ verdict = 'poor'; reasons.push(`Price is only ${distPct.toFixed(1)}% from the 20-day EMA — not stretched, low snapback signal.`); }
    else { reasons.push(`Price is ${distPct.toFixed(1)}% from the 20-day EMA — moderate stretch.`); }

    return { strategy: 'ema_snapback', label, verdict, score: Math.min(100, Math.round(Math.abs(distPct) * 10)), reasons, details: { ema20, distPct, currentPrice: price } };
  }

  // ── Analyzer: BB Snapback ──
  async function analyzeBbSnapback(ticker){
    const label = 'BB Snapback';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('bb_snapback', label, e.message); }
    if(bars.length < 20) return errorResult('bb_snapback', label, 'Not enough bar history yet.');
    const bb = computeBollinger(bars.map(b => b.c), 20, 2);
    if(!bb) return errorResult('bb_snapback', label, 'Could not compute Bollinger Bands.');

    let verdict = 'neutral', reasons = [];
    if(bb.pctB <= 0){ verdict = 'good'; reasons.push(`Price is below the lower Bollinger Band ($${bb.lower.toFixed(2)}) — oversold stretch.`); }
    else if(bb.pctB >= 1){ verdict = 'good'; reasons.push(`Price is above the upper Bollinger Band ($${bb.upper.toFixed(2)}) — overbought stretch.`); }
    else if(bb.pctB > 0.4 && bb.pctB < 0.6){ verdict = 'poor'; reasons.push('Price is near the middle band — no edge here.'); }
    else { reasons.push(`%B at ${bb.pctB.toFixed(2)} — moderate position within the bands.`); }

    return { strategy: 'bb_snapback', label, verdict, score: Math.min(100, Math.round(Math.abs(bb.pctB - 0.5) * 200)), reasons, details: bb };
  }

  // ── Analyzer: 50/200 SMA Cross ──
  async function analyzeSmaCross(ticker){
    const label = '50/200 SMA Cross';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('sma_cross', label, e.message); }
    if(bars.length < 200) return errorResult('sma_cross', label, `Need ~200 days of history — only got ${bars.length} from your bars source.`);
    const closes = bars.map(b => b.c);
    const sma50s = smaSeries(closes, 50), sma200s = smaSeries(closes, 200);
    const sma50 = sma50s[sma50s.length - 1], sma200 = sma200s[sma200s.length - 1];
    const prev50 = sma50s[sma50s.length - 2], prev200 = sma200s[sma200s.length - 2];
    if(sma50 == null || sma200 == null) return errorResult('sma_cross', label, 'Could not compute SMAs.');

    const goldenNow = sma50 > sma200;
    const goldenPrev = (prev50 != null && prev200 != null) ? prev50 > prev200 : goldenNow;
    let verdict = 'neutral', reasons = [];
    if(goldenNow && !goldenPrev){ verdict = 'good'; reasons.push('Golden cross just formed — 50-day SMA crossed above the 200-day.'); }
    else if(!goldenNow && goldenPrev){ verdict = 'poor'; reasons.push('Death cross just formed — 50-day SMA crossed below the 200-day.'); }
    else if(goldenNow){ reasons.push('Already in a golden-cross regime (50 SMA above 200 SMA) — established uptrend structure.'); }
    else { reasons.push('Already in a death-cross regime (50 SMA below 200 SMA) — established downtrend structure.'); }

    return { strategy: 'sma_cross', label, verdict, score: null, reasons, details: { sma50, sma200, currentPrice: closes[closes.length - 1] } };
  }

  // ── Analyzer: Relative Volume Surge ──
  async function analyzeRvol(ticker){
    const label = 'Relative Volume Surge';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('rvol', label, e.message); }
    if(bars.length < 21) return errorResult('rvol', label, 'Not enough bar history yet.');
    const todayVol = bars[bars.length - 1].v;
    const avgVol = mean(bars.slice(-21, -1).map(b => b.v));
    if(!avgVol) return errorResult('rvol', label, 'Could not compute average volume.');
    const rvol = todayVol / avgVol;

    let verdict = 'neutral', reasons = [];
    if(rvol >= 1.5){ verdict = 'good'; reasons.push(`Volume running ${rvol.toFixed(1)}x the 20-day average — elevated participation.`); }
    else if(rvol < 0.7){ verdict = 'poor'; reasons.push(`Volume running only ${rvol.toFixed(1)}x the 20-day average — thin, low-conviction tape.`); }
    else { reasons.push(`Volume at ${rvol.toFixed(1)}x the 20-day average — normal participation.`); }

    return { strategy: 'rvol', label, verdict, score: Math.min(100, Math.round(rvol * 33)), reasons, details: { rvol, todayVol, avgVol } };
  }

  // ── Analyzer: Gap & Go ──
  async function analyzeGapGo(ticker){
    const label = 'Gap & Go';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('gap_go', label, e.message); }
    if(bars.length < 2) return errorResult('gap_go', label, 'Not enough bar history yet.');
    const today = bars[bars.length - 1], prev = bars[bars.length - 2];
    const gapPct = ((today.o - prev.c) / prev.c) * 100;
    const heldGap = today.c >= today.o;

    let verdict = 'neutral', reasons = [];
    if(Math.abs(gapPct) >= 2 && gapPct > 0 && heldGap){ verdict = 'good'; reasons.push(`Gapped up ${gapPct.toFixed(1)}% and closed at/above the open — continuation held.`); }
    else if(Math.abs(gapPct) < 0.5){ verdict = 'poor'; reasons.push(`Only a ${gapPct.toFixed(1)}% gap — not meaningful for a gap-and-go setup.`); }
    else { reasons.push(`Gapped ${gapPct >= 0 ? 'up' : 'down'} ${Math.abs(gapPct).toFixed(1)}%, ${heldGap ? 'held' : 'faded'} through the session.`); }

    return { strategy: 'gap_go', label, verdict, score: null, reasons, details: { gapPct, heldGap, currentPrice: today.c } };
  }

  // ── Analyzer: Gap Fade ──
  async function analyzeGapFade(ticker){
    const label = 'Gap Fade';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('gap_fade', label, e.message); }
    if(bars.length < 2) return errorResult('gap_fade', label, 'Not enough bar history yet.');
    const today = bars[bars.length - 1], prev = bars[bars.length - 2];
    const gapPct = ((today.o - prev.c) / prev.c) * 100;
    const faded = (gapPct > 0 && today.c < today.o) || (gapPct < 0 && today.c > today.o);

    let verdict = 'neutral', reasons = [];
    if(Math.abs(gapPct) >= 3 && faded){ verdict = 'good'; reasons.push(`Stretched ${gapPct.toFixed(1)}% gap that already faded back through the session — fade continuation candidate.`); }
    else if(Math.abs(gapPct) < 1){ verdict = 'poor'; reasons.push(`Only a ${gapPct.toFixed(1)}% gap — too small for a fade setup.`); }
    else { reasons.push(`Gapped ${Math.abs(gapPct).toFixed(1)}%, ${faded ? 'showing fade behavior' : 'held direction so far'}.`); }

    return { strategy: 'gap_fade', label, verdict, score: null, reasons, details: { gapPct, faded, currentPrice: today.c } };
  }

  // ── Analyzer: Volatility Guardrails ──
  async function analyzeVolGuardrails(ticker){
    const label = 'Volatility Guardrails';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('vol_guardrails', label, e.message); }
    if(bars.length < 21) return errorResult('vol_guardrails', label, 'Not enough bar history yet.');
    const hv = computeHV(bars, 20);
    if(hv == null) return errorResult('vol_guardrails', label, 'Could not compute volatility.');

    let verdict = 'good', reasons = [];
    if(hv >= 60){ verdict = 'poor'; reasons.push(`20d historical volatility ~${hv.toFixed(1)}% — high risk regime, consider smaller size.`); }
    else if(hv >= 35){ verdict = 'neutral'; reasons.push(`20d historical volatility ~${hv.toFixed(1)}% — elevated, size with care.`); }
    else { reasons.push(`20d historical volatility ~${hv.toFixed(1)}% — normal range for standard sizing.`); }

    return { strategy: 'vol_guardrails', label, verdict, score: null, reasons, details: { historicalVolatilityPct: hv } };
  }

  // ── Analyzer: Trendline Break (reuses zone detection as a level proxy) ──
  async function analyzeTrendlineBreak(ticker){
    const label = 'Trendline Break';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('trendline_break', label, e.message); }
    if(bars.length < 30) return errorResult('trendline_break', label, 'Not enough bar history yet.');
    const { supply, demand } = detectZones(bars, { lookback: Math.min(bars.length, 90), pivotWindow: 2, tolerancePct: 0.02 });
    const closes = bars.map(b => b.c);
    const price = closes[closes.length - 1];
    const recent = closes.slice(-6, -1);

    const brokenSupply = supply.find(z => price > z.priceHigh && recent.some(c => c <= z.priceHigh));
    const brokenDemand = demand.find(z => price < z.priceLow && recent.some(c => c >= z.priceLow));
    let verdict = 'neutral', reasons = [];
    if(brokenSupply){ verdict = 'good'; reasons.push(`Broke above a supply zone ($${brokenSupply.priceLow.toFixed(2)}–$${brokenSupply.priceHigh.toFixed(2)}) in the last few sessions — bullish structure break.`); }
    else if(brokenDemand){ verdict = 'poor'; reasons.push(`Broke below a demand zone ($${brokenDemand.priceLow.toFixed(2)}–$${brokenDemand.priceHigh.toFixed(2)}) in the last few sessions — bearish structure break.`); }
    else { reasons.push('No recent break through a detected zone.'); }

    return { strategy: 'trendline_break', label, verdict, score: null, reasons, details: { currentPrice: price }, zones: { supply: supply.slice(0, 5), demand: demand.slice(0, 5) } };
  }

  // ── Analyzer: Daily Bias ──
  async function analyzeDailyBias(ticker){
    const label = 'Daily Bias';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('daily_bias', label, e.message); }
    if(bars.length < 21) return errorResult('daily_bias', label, 'Not enough bar history yet.');
    const closes = bars.map(b => b.c);
    const price = closes[closes.length - 1];
    const ema20 = emaSeries(closes, 20).slice(-1)[0];
    const rsi = computeRSI(closes, 14);
    const chg1d = pctChange(bars, 1);
    if(ema20 == null || rsi == null || chg1d == null) return errorResult('daily_bias', label, 'Could not compute bias inputs.');

    let bull = 0, bear = 0, reasons = [];
    if(price > ema20){ bull++; reasons.push(`Price is above the 20-day EMA ($${ema20.toFixed(2)}).`); }
    else { bear++; reasons.push(`Price is below the 20-day EMA ($${ema20.toFixed(2)}).`); }
    if(rsi > 50){ bull++; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — momentum leans positive.`); }
    else { bear++; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — momentum leans negative.`); }
    if(chg1d > 0){ bull++; reasons.push(`Closed up ${chg1d.toFixed(1)}% last session.`); }
    else if(chg1d < 0){ bear++; reasons.push(`Closed down ${Math.abs(chg1d).toFixed(1)}% last session.`); }

    let verdict = 'neutral', direction = 'flat';
    if(bull === 3){ verdict = 'good'; direction = 'bullish'; }
    else if(bear === 3){ verdict = 'good'; direction = 'bearish'; }
    else if(bull > bear){ direction = 'bullish'; }
    else if(bear > bull){ direction = 'bearish'; }
    else { verdict = 'poor'; }
    reasons.unshift(verdict === 'good' ? `All signals agree — bias leans ${direction} for the next session.` : verdict === 'poor' ? 'Signals are split evenly — no bias for the next session.' : `Signals lean ${direction} but aren't unanimous.`);

    return { strategy: 'daily_bias', label, verdict, score: Math.round((Math.max(bull, bear) / (bull + bear || 1)) * 100), reasons, details: { price, ema20, rsi, chg1dPct: chg1d, direction } };
  }

  // ── Analyzer: Buy / Sell Signal (broader composite than Daily Bias) ──
  async function analyzeBuySellSignal(ticker){
    const label = 'Buy / Sell Signal';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('buy_sell_signal', label, e.message); }
    if(bars.length < 51) return errorResult('buy_sell_signal', label, 'Need at least 50 days of history for this composite read.');
    const closes = bars.map(b => b.c);
    const price = closes[closes.length - 1];
    const ema20 = emaSeries(closes, 20).slice(-1)[0];
    const sma50 = smaSeries(closes, 50).slice(-1)[0];
    const rsi = computeRSI(closes, 14);
    const trend10 = pctChange(bars, 10);
    const avgVol20 = mean(bars.slice(-21, -1).map(b => b.v));
    const todayVol = bars[bars.length - 1].v;
    if(ema20 == null || sma50 == null || rsi == null || trend10 == null) return errorResult('buy_sell_signal', label, 'Could not compute composite inputs.');

    let bull = 0, bear = 0, reasons = [];
    if(price > ema20 && price > sma50){ bull++; reasons.push(`Price is above both the 20-EMA and 50-SMA ($${ema20.toFixed(2)} / $${sma50.toFixed(2)}) — constructive trend structure.`); }
    else if(price < ema20 && price < sma50){ bear++; reasons.push(`Price is below both the 20-EMA and 50-SMA — weak trend structure.`); }
    else reasons.push('Price is mixed relative to the 20-EMA/50-SMA — no clean trend alignment.');

    if(rsi >= 55){ bull++; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — momentum favors buyers.`); }
    else if(rsi <= 45){ bear++; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — momentum favors sellers.`); }
    else reasons.push(`RSI(14) at ${rsi.toFixed(1)} — neutral momentum.`);

    if(trend10 > 3){ bull++; reasons.push(`Up ${trend10.toFixed(1)}% over the last 10 sessions.`); }
    else if(trend10 < -3){ bear++; reasons.push(`Down ${Math.abs(trend10).toFixed(1)}% over the last 10 sessions.`); }

    if(avgVol20 && (todayVol / avgVol20) >= 1.2){
      if(bull > bear){ bull++; reasons.push('Above-average volume is confirming the move up.'); }
      else if(bear > bull){ bear++; reasons.push('Above-average volume is confirming the move down.'); }
    }

    let verdict = 'neutral', call = 'Hold';
    if(bull >= 3 && bull > bear){ verdict = 'good'; call = 'Buy lean'; }
    else if(bear >= 3 && bear > bull){ verdict = 'good'; call = 'Sell lean'; }
    else if(bull === bear){ verdict = 'poor'; call = 'Hold — no edge'; }
    reasons.unshift(`${call}: ${bull} bullish factor${bull === 1 ? '' : 's'} vs ${bear} bearish factor${bear === 1 ? '' : 's'}.`);

    return { strategy: 'buy_sell_signal', label, verdict, score: Math.round((Math.max(bull, bear) / (bull + bear || 1)) * 100), reasons, details: { price, ema20, sma50, rsi, trend10Pct: trend10, rvol: avgVol20 ? todayVol / avgVol20 : null, call } };
  }

  // ── Analyzer: Money Flow Index (volume-weighted RSI, not live order-flow) ──
  async function analyzeMoneyFlow(ticker){
    const label = 'Money Flow Index';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('money_flow', label, e.message); }
    if(bars.length < 15) return errorResult('money_flow', label, 'Not enough bar history yet.');
    const mfi = computeMFI(bars, 14);
    if(mfi == null) return errorResult('money_flow', label, 'Could not compute Money Flow Index.');

    let verdict = 'neutral', reasons = [];
    if(mfi >= 80){ verdict = 'good'; reasons.push(`MFI(14) at ${mfi.toFixed(1)} — strong buying pressure, overbought on a volume-weighted basis.`); }
    else if(mfi <= 20){ verdict = 'good'; reasons.push(`MFI(14) at ${mfi.toFixed(1)} — strong selling pressure, oversold on a volume-weighted basis.`); }
    else if(mfi > 40 && mfi < 60){ verdict = 'poor'; reasons.push(`MFI(14) at ${mfi.toFixed(1)} — mid-range, nothing to flag.`); }
    else reasons.push(`MFI(14) at ${mfi.toFixed(1)} — approaching an extreme but not there yet.`);

    return {
      strategy: 'money_flow', label, verdict, score: Math.round(Math.abs(mfi - 50) * 2), reasons,
      details: { mfi, currentPrice: bars[bars.length - 1].c },
      disclaimer: 'This is the classic Money Flow Index (volume-weighted RSI), not true institutional order-flow or dark-pool data — no Level 2/order-flow source is wired into the stack.'
    };
  }

  // ── Analyzer: Opening Drive (daily-bar proxy — see file header) ──
  async function analyzeOpeningDrive(ticker){
    const label = 'Opening Drive (daily-bar proxy)';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('opening_drive', label, e.message); }
    if(bars.length < 2) return errorResult('opening_drive', label, 'Not enough bar history yet.');
    const today = bars[bars.length - 1];
    const range = today.h - today.l;
    if(range <= 0) return errorResult('opening_drive', label, 'No usable range on the latest bar.');
    const driveRatio = (today.c - today.o) / range;

    let verdict = 'poor', reasons = [
      'Computed from the latest daily bar\'s own open/high/low/close — a proxy for session drive strength, not true first-30-minutes intraday tracking (no intraday feed is wired in).'
    ];
    if(driveRatio >= 0.5){ verdict = 'good'; reasons.unshift(`Closed strong in the upper half of the day's range (drive ${(driveRatio * 100).toFixed(0)}%) — bullish follow-through from the open.`); }
    else if(driveRatio <= -0.5){ verdict = 'good'; reasons.unshift(`Closed weak in the lower half of the day's range (drive ${(driveRatio * 100).toFixed(0)}%) — bearish follow-through from the open.`); }
    else reasons.unshift(`Drive ${(driveRatio * 100).toFixed(0)}% — indecisive session, closed near the middle of the range.`);

    return { strategy: 'opening_drive', label, verdict, score: Math.round(Math.abs(driveRatio) * 100), reasons, details: { driveRatio, open: today.o, high: today.h, low: today.l, close: today.c } };
  }

  // ── Analyzer: Range Breakout (20-day Donchian — daily-bar proxy for ORB/intraday breakout) ──
  async function analyzeRangeBreakout(ticker){
    const label = 'Range Breakout (20-day)';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('range_breakout', label, e.message); }
    if(bars.length < 22) return errorResult('range_breakout', label, 'Not enough bar history yet.');
    const period = 20;
    const priorBars = bars.slice(-(period + 1), -1);
    const today = bars[bars.length - 1];
    const priorHigh = Math.max(...priorBars.map(b => b.h));
    const priorLow = Math.min(...priorBars.map(b => b.l));

    let verdict = 'poor', reasons = [
      'Uses daily bars for a 20-session high/low channel — a swing-style breakout read, not an intraday opening-range breakout (no intraday feed is wired in).'
    ];
    if(today.c > priorHigh){ verdict = 'good'; reasons.unshift(`Closed above the prior 20-day high ($${priorHigh.toFixed(2)}) — range breakout to the upside.`); }
    else if(today.c < priorLow){ verdict = 'good'; reasons.unshift(`Closed below the prior 20-day low ($${priorLow.toFixed(2)}) — range breakdown to the downside.`); }
    else {
      const distToHighPct = ((priorHigh - today.c) / today.c) * 100;
      const distToLowPct = ((today.c - priorLow) / today.c) * 100;
      reasons.unshift(`Still inside the 20-day range ($${priorLow.toFixed(2)}–$${priorHigh.toFixed(2)}) — ${distToHighPct.toFixed(1)}% below the high, ${distToLowPct.toFixed(1)}% above the low.`);
    }

    return { strategy: 'range_breakout', label, verdict, score: null, reasons, details: { currentPrice: today.c, priorHigh, priorLow } };
  }

  // ── Analyzer: Short Setup Screener (bearish mirror of the bullish trend/momentum checks) ──
  async function analyzeShortSetup(ticker){
    const label = 'Short Setup Screener';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('short_setup', label, e.message); }
    if(bars.length < 21) return errorResult('short_setup', label, 'Not enough bar history yet.');
    const closes = bars.map(b => b.c);
    const price = closes[closes.length - 1];
    const ema20 = emaSeries(closes, 20).slice(-1)[0];
    const rsi = computeRSI(closes, 14);
    const trend10 = pctChange(bars, 10);
    if(ema20 == null || rsi == null || trend10 == null) return errorResult('short_setup', label, 'Could not compute inputs.');

    let weak = 0, reasons = [];
    if(price < ema20){ weak++; reasons.push(`Price is below the 20-day EMA ($${ema20.toFixed(2)}) — weak trend structure.`); }
    if(trend10 < -3){ weak++; reasons.push(`Down ${Math.abs(trend10).toFixed(1)}% over the last 10 sessions — active downside momentum.`); }
    if(rsi < 45 && rsi > 20){ weak++; reasons.push(`RSI(14) at ${rsi.toFixed(1)} — bearish momentum without being oversold, room to keep falling.`); }
    else if(rsi <= 20){ reasons.push(`RSI(14) at ${rsi.toFixed(1)} — already oversold, bounce risk for a fresh short entry.`); }

    const verdict = weak >= 2 ? 'good' : weak === 1 ? 'neutral' : 'poor';
    reasons.unshift(verdict === 'good' ? 'Multiple technical weakness signals line up for a short setup.' : verdict === 'neutral' ? 'Some weakness present, not a clean setup yet.' : 'No meaningful technical weakness detected.');

    return { strategy: 'short_setup', label, verdict, score: Math.round((weak / 3) * 100), reasons, details: { price, ema20, rsi, trend10Pct: trend10 } };
  }

  // ── Analyzer: ATR Stop Planner ──
  async function analyzeAtrStops(ticker){
    const label = 'ATR Stop Planner';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('atr_stops', label, e.message); }
    if(bars.length < 15) return errorResult('atr_stops', label, 'Not enough bar history yet.');
    const atr = computeATR(bars, 14);
    if(atr == null) return errorResult('atr_stops', label, 'Could not compute ATR.');
    const price = bars[bars.length - 1].c;
    const atrPct = (atr / price) * 100;

    let verdict = 'neutral', reasons = [];
    if(atrPct >= 5){ verdict = 'poor'; reasons.push(`ATR(14) is ~${atrPct.toFixed(1)}% of price ($${atr.toFixed(2)}) — wide daily swings mean a technically sound stop needs real room, size down accordingly.`); }
    else if(atrPct < 1.5){ verdict = 'good'; reasons.push(`ATR(14) is only ~${atrPct.toFixed(1)}% of price ($${atr.toFixed(2)}) — tight daily range allows a close, well-defined stop.`); }
    else reasons.push(`ATR(14) is ~${atrPct.toFixed(1)}% of price ($${atr.toFixed(2)}) — normal daily range for stop planning.`);

    return {
      strategy: 'atr_stops', label, verdict, score: null, reasons,
      details: { atr, atrPct, currentPrice: price, suggestedStops: { '1x ATR': +(atr).toFixed(2), '1.5x ATR': +(atr * 1.5).toFixed(2), '2x ATR': +(atr * 2).toFixed(2) } }
    };
  }

  // ── Analyzer: Volatility Squeeze (Bollinger Band-width contraction — pattern-scanner proxy) ──
  async function analyzeVolSqueeze(ticker){
    const label = 'Volatility Squeeze (pattern proxy)';
    let bars; try{ bars = await getDailyBars(ticker); }catch(e){ return errorResult('vol_squeeze', label, e.message); }
    if(bars.length < 80) return errorResult('vol_squeeze', label, 'Need more history for a reliable squeeze baseline.');
    const closes = bars.map(b => b.c);
    const bandWidths = [];
    for(let i = 20; i < closes.length; i++){
      const bb = computeBollinger(closes.slice(0, i + 1), 20, 2);
      if(bb) bandWidths.push((bb.upper - bb.lower) / bb.sma);
    }
    const current = bandWidths[bandWidths.length - 1];
    const baseline = mean(bandWidths.slice(-60));
    if(current == null || !baseline) return errorResult('vol_squeeze', label, 'Could not compute band width.');
    const ratio = current / baseline;

    let verdict = 'neutral', reasons = [
      'Approximates chart-pattern-style contraction (flags/triangles) via Bollinger Band width vs its own recent average — not geometric trendline/pattern detection.'
    ];
    if(ratio <= 0.7){ verdict = 'good'; reasons.unshift(`Band width is ${(ratio * 100).toFixed(0)}% of its 60-day average — a real volatility squeeze, often precedes a directional expansion.`); }
    else if(ratio >= 1.3){ verdict = 'poor'; reasons.unshift(`Band width is ${(ratio * 100).toFixed(0)}% of its 60-day average — already expanded, not a squeeze setup.`); }
    else reasons.unshift(`Band width is ${(ratio * 100).toFixed(0)}% of its 60-day average — no notable contraction yet.`);

    return { strategy: 'vol_squeeze', label, verdict, score: Math.round(Math.max(0, (1 - ratio)) * 100), reasons, details: { currentBandWidthRatio: ratio, currentPrice: closes[closes.length - 1] } };
  }

  // ── Registry ──
  const registry = {};
  function register(key, config){ registry[key] = config; }
  async function run(key, ticker){
    const cfg = registry[key];
    if(!cfg) throw new Error('Unknown strategy: ' + key);
    return cfg.fn(ticker);
  }

  register('swing_zones',     { label: 'Swing Supply/Demand Zones', icon: '📐', fn: analyzeSwingZones });
  register('momentum_zones',  { label: 'Momentum Zones (daily proxy)', icon: '⚡', fn: analyzeMomentumZones });
  register('wheel_csp',       { label: 'Wheel / CSP Suitability', icon: '🎡', fn: analyzeWheel });
  register('covered_call',    { label: 'Covered Call Suitability', icon: '📞', fn: analyzeCoveredCall });
  register('rsi_reversal',    { label: 'RSI Reversal', icon: '🔁', fn: analyzeRsiReversal });
  register('ema_snapback',    { label: 'EMA Snapback', icon: '📌', fn: analyzeEmaSnapback });
  register('bb_snapback',     { label: 'BB Snapback', icon: '🎯', fn: analyzeBbSnapback });
  register('sma_cross',       { label: '50/200 SMA Cross', icon: '📐', fn: analyzeSmaCross });
  register('rvol',            { label: 'Relative Volume Surge', icon: '📊', fn: analyzeRvol });
  register('gap_go',          { label: 'Gap & Go', icon: '🌅', fn: analyzeGapGo });
  register('gap_fade',        { label: 'Gap Fade', icon: '🕳️', fn: analyzeGapFade });
  register('vol_guardrails',  { label: 'Volatility Guardrails', icon: '🌊', fn: analyzeVolGuardrails });
  register('trendline_break', { label: 'Trendline Break', icon: '📏', fn: analyzeTrendlineBreak });
  register('daily_bias',      { label: 'Daily Bias', icon: '📊', fn: analyzeDailyBias });
  register('buy_sell_signal', { label: 'Buy / Sell Signal', icon: '🧭', fn: analyzeBuySellSignal });
  register('money_flow',      { label: 'Money Flow Index', icon: '💸', fn: analyzeMoneyFlow });
  register('opening_drive',   { label: 'Opening Drive', icon: '🚪', fn: analyzeOpeningDrive });
  register('range_breakout',  { label: 'Range Breakout', icon: '🌄', fn: analyzeRangeBreakout });
  register('short_setup',     { label: 'Short Setup Screener', icon: '🔻', fn: analyzeShortSetup });
  register('atr_stops',       { label: 'ATR Stop Planner', icon: '🛑', fn: analyzeAtrStops });
  register('vol_squeeze',     { label: 'Volatility Squeeze', icon: '🚩', fn: analyzeVolSqueeze });

  window.StrategyAnalyzers = {
    registry, register, run, getDailyBars, detectZones, computeHV, computeTrend, runGridAnalysis,
    computeRSI, computeBollinger, smaSeries, emaSeries, computeMFI, computeATR
  };
})();
