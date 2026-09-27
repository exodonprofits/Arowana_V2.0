/**
 * format.js — shared display formatting
 * ============================================================
 * One implementation of every number the platform puts on screen.
 *
 * Before this file, each page carried its own copy: tcFmtUSD in
 * trading-command, pcFmtUSD in portfolio-command, smFmtUSD in options-hub,
 * toUSD/toPrice in arowana-trader, plus dozens of inline `toFixed()` calls.
 * They had drifted — percentages rendered at 1dp on one page and 2dp on
 * another, negatives used an ASCII hyphen in some places and a true minus
 * in others, missing values showed as '—' on four pages and '--' on a
 * fifth, and share counts were spelled three different ways.
 *
 * Load this in <head> as a plain <script> (no defer) so the helpers exist
 * before any page's inline script runs.
 *
 * Every page keeps its own short alias (tcFmtUSD, pcFmtUSD, smFmtUSD…)
 * delegating here, so existing call sites keep working and this file can
 * be adopted page by page.
 */
(function (global) {
  'use strict';

  var EM_DASH = '\u2014';   // — placeholder for missing values
  var MINUS   = '\u2212';   // − true minus sign, not a hyphen

  function isBlank(n) {
    return n == null || n === '' || (typeof n === 'number' && isNaN(n)) || isNaN(Number(n));
  }

  // Sign for a value. Zero is never signed: "+$0.00" reads as a gain.
  function signOf(n, wantSign) {
    if (n < 0) return MINUS;
    return (wantSign && n > 0) ? '+' : '';
  }

  /**
   * Currency.
   *   usd(1234.5)                       -> "$1,234.50"
   *   usd(1234.5, { cents: false })     -> "$1,235"
   *   usd(-42, { sign: true })          -> "−$42.00"
   *   usd(null)                         -> "—"
   */
  function usd(n, opts) {
    opts = opts || {};
    if (isBlank(n)) return EM_DASH;
    var v = Number(n);
    var digits = (opts.cents === false) ? 0 : 2;
    var body = Math.abs(v).toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
    return signOf(v, opts.sign) + '$' + body;
  }

  /**
   * Percentage. Default 2dp, matching returns and price changes.
   *   pct(8.667, { sign: true })  -> "+8.67%"
   *   pct(-2.5,  { sign: true })  -> "−2.50%"
   *   pct(0,     { sign: true })  -> "0.00%"
   *   pct(12.34, { dp: 1 })       -> "12.3%"
   */
  function pct(n, opts) {
    opts = opts || {};
    if (isBlank(n)) return EM_DASH;
    var v = Number(n);
    var dp = (opts.dp == null) ? 2 : opts.dp;
    return signOf(v, opts.sign) + Math.abs(v).toFixed(dp) + '%';
  }

  /** Portfolio weights and allocation shares — one decimal reads better. */
  function weight(n) {
    return pct(n, { dp: 1 });
  }

  /**
   * Share and contract counts.
   *   shares(1500)     -> "1,500"
   *   shares(10.5)     -> "10.5"
   *   shares(0.333333) -> "0.333"
   * Locale pinned to en-US so a European visitor doesn't read 1500 as "1.500".
   */
  function shares(n) {
    if (isBlank(n)) return EM_DASH;
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
  }

  /**
   * Large numbers in compact form, for market cap / revenue / volume.
   *   compact(2400000000) -> "2.4B"
   */
  function compact(n) {
    if (isBlank(n)) return EM_DASH;
    var v = Number(n);
    var a = Math.abs(v);
    var s = signOf(v, false);
    if (a >= 1e12) return s + (a / 1e12).toFixed(1) + 'T';
    if (a >= 1e9)  return s + (a / 1e9).toFixed(1) + 'B';
    if (a >= 1e6)  return s + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3)  return s + (a / 1e3).toFixed(1) + 'K';
    return s + String(a);
  }

  /** Price with currency, always 2dp — for quotes, strikes, entries, stops. */
  function price(n) {
    return usd(n, { cents: true });
  }

  /** Short date: "Mar 4, 2026". Invalid or missing input returns the dash. */
  function date(value) {
    if (value == null || value === '') return EM_DASH;
    var d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) return EM_DASH;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * Compact date for dense tables: "Mar 4, 26".
   * Accepts a bare "YYYY-MM-DD" without being shifted by the timezone,
   * which a plain new Date("2026-03-04") would do west of UTC.
   */
  function dateShort(value) {
    if (value == null || value === '') return EM_DASH;
    var d;
    if (value instanceof Date) {
      d = value;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      d = new Date(String(value) + 'T00:00:00');
    } else {
      d = new Date(value);
    }
    if (isNaN(d.getTime())) return EM_DASH;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }

  /** Month + day only: "Mar 4". For calendars and chart axes. */
  function dateDay(value) {
    if (value == null || value === '') return EM_DASH;
    var d = (value instanceof Date) ? value
          : (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(String(value) + 'T00:00:00') : new Date(value));
    if (isNaN(d.getTime())) return EM_DASH;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /** Clock time: "12:44 PM". No seconds — those belong in dev output only. */
  function time(value) {
    var d = (value == null) ? new Date() : ((value instanceof Date) ? value : new Date(value));
    if (isNaN(d.getTime())) return EM_DASH;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  global.AP_FMT = {
    usd: usd,
    price: price,
    pct: pct,
    weight: weight,
    shares: shares,
    compact: compact,
    date: date,
    dateShort: dateShort,
    dateDay: dateDay,
    time: time,
    EM_DASH: EM_DASH,
    MINUS: MINUS
  };
})(window);
