/**
 * Arowana Profits — Stock Price Fetcher
 * ============================================================================
 * File:      /js/price-fetcher.js
 * Purpose:   Lightweight, reusable module for fetching real-time stock quotes
 *            via the user's Finnhub API key (BYOK). Used by trade-journal-pro.html
 *            to auto-populate `currentPrice` on open stock positions for
 *            unrealized P/L computation in the dossier.
 *
 * Scope notes — what this DOES NOT do
 * -----------------------------------
 *   - Does NOT fetch options chains. Finnhub free tier has no options data
 *     and the paid tier still lacks per-contract bid/ask. Option marks must
 *     stay manual until Tradier/Polygon are wired (Sprint 4+).
 *   - Does NOT cache to Supabase. Cached values live where the journal puts
 *     them — on each trade record's `currentPrice` / `currentPriceAt` fields.
 *   - Does NOT auto-poll. The caller decides when to fetch (button click,
 *     dossier open, etc.). On-demand only by design.
 *
 * BYOK / cost model
 * -----------------
 * Reads the user's Finnhub key from window.AP_USER_KEYS.finnhub (set by
 * app-config.js from localStorage 'ap_user_api_keys'). No platform-wide key.
 * If the key is missing, fetchStock() returns null and the caller shows a
 * "set your Finnhub key in Settings" message.
 *
 * Rate limiting
 * -------------
 * Finnhub free tier = 60 calls/min. fetchAllOpenStocks() respects this with
 * a small inter-request delay. Burst behavior is acceptable for ~30 tickers
 * but if you ever exceed, callers see partial results plus a "rate limited"
 * toast.
 *
 * Public API
 * ----------
 *   window.priceFetcher.fetchStock(ticker)         → Promise<number|null>
 *   window.priceFetcher.fetchAllOpenStocks(arr)    → Promise<{updated, failed, missing}>
 *   window.priceFetcher.hasKey()                   → boolean (cheap check)
 *
 * ============================================================================
 */

(function () {
  'use strict';

  const FINNHUB_BASE = 'https://finnhub.io/api/v1';
  const FETCH_DELAY_MS = 120;   // ~8 req/sec, well under the 60/min limit
  const TIMEOUT_MS = 8000;

  function getKey() {
    try {
      if (window.AP_USER_KEYS && window.AP_USER_KEYS.finnhub) return window.AP_USER_KEYS.finnhub;
      // Fallback: AP_USER_KEYS may not have hydrated yet (app-config.js
      // populates it asynchronously and fires 'ap:keys:ready' when done —
      // callers that fire early, e.g. on page load, can race it). Read the
      // raw localStorage key directly rather than reporting no-key in the
      // meantime. Matches the same fallback already used independently in
      // trading-command.html / portfolio-command.html.
      const raw = localStorage.getItem('ap_user_api_keys');
      if (!raw) return '';
      const keys = JSON.parse(raw);
      return (keys && keys.finnhub) || '';
    }
    catch { return ''; }
  }

  function hasKey() {
    return !!getKey();
  }

  // ---- Fetch with timeout (defensive against slow networks) -------------
  async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Single ticker ----------------------------------------------------
  async function fetchStock(ticker) {
    if (!ticker) return null;
    const key = getKey();
    if (!key) return null;
    const sym = String(ticker).trim().toUpperCase();
    const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`;
    try {
      const r = await fetchWithTimeout(url, TIMEOUT_MS);
      if (!r.ok) {
        if (r.status === 429) throw new Error('rate_limited');
        return null;
      }
      const data = await r.json();
      // Finnhub /quote returns: { c: current, h, l, o, pc, t }
      // For unknown symbols or zero data, c is 0 — treat as null.
      const c = parseFloat(data?.c);
      if (!isFinite(c) || c <= 0) return null;
      return c;
    } catch (err) {
      if (err.message === 'rate_limited') throw err;
      console.warn('[price-fetcher] fetchStock failed for', ticker, err);
      return null;
    }
  }

  // ---- Batch over an array of trade records -----------------------------
  // Each input trade should have { id, ticker } at minimum. The caller is
  // responsible for updating its own data structures (we don't write to
  // localStorage or Supabase directly — separation of concerns).
  // Returns { updated:[{id, ticker, price}], failed:[{ticker, reason}], missing:0 }
  async function fetchAllOpenStocks(trades) {
    if (!Array.isArray(trades) || trades.length === 0) {
      return { updated: [], failed: [], missing: 0, rateLimited: false };
    }
    if (!hasKey()) {
      return { updated: [], failed: [], missing: trades.length, noKey: true };
    }

    // De-duplicate tickers — multiple positions on same ticker share one fetch
    const tickerSet = new Set();
    const byTicker = new Map(); // ticker -> trades[]
    trades.forEach(t => {
      const sym = (t.ticker || '').toUpperCase();
      if (!sym) return;
      tickerSet.add(sym);
      if (!byTicker.has(sym)) byTicker.set(sym, []);
      byTicker.get(sym).push(t);
    });

    const updated = [];
    const failed = [];
    let rateLimited = false;

    for (const ticker of tickerSet) {
      try {
        const price = await fetchStock(ticker);
        if (price != null) {
          // Spread the price across every trade with this ticker
          for (const t of byTicker.get(ticker)) {
            updated.push({ id: t.id, ticker, price });
          }
        } else {
          failed.push({ ticker, reason: 'no_data' });
        }
      } catch (err) {
        if (err.message === 'rate_limited') {
          rateLimited = true;
          failed.push({ ticker, reason: 'rate_limited' });
          break; // stop fetching — give up gracefully
        }
        failed.push({ ticker, reason: 'error' });
      }
      // Polite delay between requests
      await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
    }

    return { updated, failed, missing: 0, rateLimited, noKey: false };
  }

  // ---- Expose ----------------------------------------------------------
  window.priceFetcher = {
    fetchStock,
    fetchAllOpenStocks,
    hasKey
  };
})();
