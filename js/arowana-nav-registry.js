/**
 * arowana-nav-registry.js — navigation registry (data only)
 * ============================================================
 * ATD-008. The single description of Arowana's signed-in navigation:
 * the six owner-approved destinations, the five strategy desks, their
 * children, utilities and the mobile shortcuts. js/arowana-nav.js renders
 * it; this file contains no DOM code.
 *
 * The block between the REGISTRY-JSON markers must stay strict JSON
 * (double quotes, no comments, no trailing commas): the repository test
 * scripts/test_nav_registry.py parses it with json.loads to check that
 * every route exists and the approved structure holds.
 *
 * Entry fields
 *   id        stable identifier, never shown
 *   parent    id of the parent entry (absent for primary destinations)
 *   label     display label; shortLabel is used on the mobile bar
 *   icon      emoji icon (D12: emoji kept for now)
 *   status    available | legacy | planned
 *   route     { path, query } — same-origin page; absent when planned
 *   activeWhen  extra rules that mark the entry current:
 *             [{ path, query: { key: [values] }, hash: [values] }]
 *             a null inside a values list means "parameter absent"
 *   mobile    command | watchlists | portfolio | journal | more
 *   note      short reason shown for planned/legacy entries
 *
 * homes: tool pages that are not menu items themselves. On such a page the
 * named entry (and its parents) is marked as containing the current page;
 * nothing gets aria-current, because the page is not that item.
 *
 * Navigation is presentation, not authorization. Pages and the server
 * still enforce sign-in, ownership and entitlements.
 */
(function () {
  'use strict';

  /* REGISTRY-JSON-START */
  var REGISTRY = {
    "version": "2026-10-03.3",
    "entries": [
      { "id": "command", "label": "Trading Command", "shortLabel": "Command", "icon": "⚡",
        "status": "available", "route": { "path": "trading-command.html" }, "mobile": "command" },
      { "id": "command-positions", "parent": "command", "label": "Positions & Live Scan", "icon": "📊",
        "desc": "Open positions and today's scan", "status": "available",
        "route": { "path": "trading-command.html", "query": { "tab": "positions" } },
        "activeWhen": [ { "path": "trading-command.html", "query": { "tab": [null] }, "hash": [null, "positions"] } ] },
      { "id": "command-brief", "parent": "command", "label": "Morning Brief", "icon": "🌅",
        "desc": "Before-the-open summary", "status": "legacy", "route": { "path": "ai-morning-brief.html" },
        "note": "Existing page; migrating into Trading Command" },
      { "id": "command-coach", "parent": "command", "label": "Coach", "icon": "🧭",
        "desc": "Ask about your positions and plan", "status": "available",
        "route": { "path": "trading-command.html", "query": { "tab": "coach" } },
        "activeWhen": [ { "path": "trading-command.html", "hash": ["coach"] } ] },
      { "id": "command-whatchanged", "parent": "command", "label": "What Changed", "icon": "🔄",
        "status": "planned", "note": "Planned" },
      { "id": "command-queue", "parent": "command", "label": "Decision queue", "icon": "🗂️",
        "status": "planned", "note": "Planned" },

      { "id": "research", "label": "Research", "icon": "🔍",
        "status": "available", "route": { "path": "analysis-central.html" }, "mobile": "more" },
      { "id": "research-instrument", "parent": "research", "label": "Instrument Research", "icon": "🔎",
        "desc": "Fundamentals and sentiment for one ticker", "status": "available",
        "route": { "path": "analysis-central.html" } },
      { "id": "research-technical", "parent": "research", "label": "Technical Analysis", "icon": "📈",
        "desc": "Indicators and charts", "status": "available", "route": { "path": "technical-analysis.html" } },
      { "id": "research-valuation", "parent": "research", "label": "Fundamentals & Valuation", "icon": "💰",
        "desc": "DCF and fair value estimates", "status": "available", "route": { "path": "intrinsic-value.html" } },
      { "id": "research-scanners", "parent": "research", "label": "Scanners", "icon": "📡",
        "desc": "Every scan in one place", "status": "available", "route": { "path": "scanner.html" } },
      { "id": "research-backtesting", "parent": "research", "label": "Backtesting", "icon": "🔬",
        "desc": "Test your strategies", "status": "available", "route": { "path": "strategy-backtesting.html" } },
      { "id": "research-tools", "parent": "research", "label": "Tool Directory", "icon": "🧩",
        "desc": "Every calculator and tool", "status": "available", "route": { "path": "tools.html" } },

      { "id": "desks", "label": "Strategy Desks", "icon": "🎯", "mobile": "more" },
      { "id": "desk-swing", "parent": "desks", "label": "Swing", "icon": "🌊",
        "status": "legacy", "route": { "path": "swing-trader.html" }, "note": "Existing page; desk not yet migrated" },
      { "id": "desk-wheel", "parent": "desks", "label": "Wheel", "icon": "🛞",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "puts" } },
        "activeWhen": [ { "path": "options-hub.html", "query": { "tab": [null, "puts", "calls", "check", "roll", "quality"] } } ] },
      { "id": "wheel-quality", "parent": "desk-wheel", "label": "Want to Own", "icon": "⭐",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "quality" } } },
      { "id": "wheel-puts", "parent": "desk-wheel", "label": "Cash-Secured Puts", "icon": "🪙",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "puts" } } },
      { "id": "wheel-calls", "parent": "desk-wheel", "label": "Covered Calls", "icon": "📞",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "calls" } },
        "activeWhen": [ { "path": "options-hub.html", "query": { "tab": [null] } } ] },
      { "id": "wheel-check", "parent": "desk-wheel", "label": "Check a Trade", "icon": "✅",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "check" } } },
      { "id": "wheel-roll", "parent": "desk-wheel", "label": "Roll Coach", "icon": "🔁",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "roll" } } },
      { "id": "wheel-coach", "parent": "desk-wheel", "label": "Wheel Coach", "icon": "🧭",
        "status": "available", "route": { "path": "arowana-trader.html" } },
      { "id": "wheel-strategy", "parent": "desk-wheel", "label": "Wheel Strategy", "icon": "📘",
        "status": "legacy", "route": { "path": "wheel-strategy.html" }, "note": "Existing page; parity review pending" },
      { "id": "desk-options", "parent": "desks", "label": "Options", "icon": "📈",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "analyzer" } },
        "activeWhen": [ { "path": "options-hub.html", "query": { "tab": ["analyzer", "strategies", "watchlist"] } } ] },
      { "id": "options-recommender", "parent": "desk-options", "label": "Strategy Recommender", "icon": "📊",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "analyzer" } } },
      { "id": "options-matrix", "parent": "desk-options", "label": "Strategy Matrix", "icon": "⚡",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "strategies" } } },
      { "id": "options-vol", "parent": "desk-options", "label": "Vol Watchlist", "icon": "🌡️",
        "status": "available", "route": { "path": "options-hub.html", "query": { "tab": "watchlist" } } },
      { "id": "options-spreads", "parent": "desk-options", "label": "Credit Spread Planner", "icon": "📐",
        "status": "available", "route": { "path": "credit-spread-planner.html" } },
      { "id": "desk-growth", "parent": "desks", "label": "Growth", "icon": "🌱",
        "status": "planned", "note": "Planned; AI will be a theme filter here" },
      { "id": "desk-longterm", "parent": "desks", "label": "Long-Term", "icon": "🏛️",
        "status": "legacy", "route": { "path": "long-term-dashboard.html" }, "note": "Existing page; desk not yet migrated" },

      { "id": "portfolio", "label": "Portfolio & Risk", "shortLabel": "Portfolio", "icon": "🏦",
        "status": "available", "route": { "path": "portfolio-command.html" }, "mobile": "portfolio" },
      { "id": "portfolio-overview", "parent": "portfolio", "label": "Portfolio Overview", "icon": "🏦",
        "desc": "Holdings, income and allocation", "status": "available",
        "route": { "path": "portfolio-command.html", "query": { "tab": "overview" } },
        "activeWhen": [ { "path": "portfolio-command.html", "query": { "tab": [null, "overview", "holdings", "income", "analysis"] } } ] },
      { "id": "portfolio-performance", "parent": "portfolio", "label": "Performance", "icon": "📊",
        "desc": "Account returns over time", "status": "available",
        "route": { "path": "portfolio-command.html", "query": { "tab": "performance" } } },
      { "id": "portfolio-advisor", "parent": "portfolio", "label": "Portfolio Advisor", "icon": "🧭",
        "desc": "Foundation checks, breadth and goals", "status": "available", "route": { "path": "portfolio-advisor.html" } },
      { "id": "portfolio-rules", "parent": "portfolio", "label": "Risk Rules", "icon": "✅",
        "status": "legacy", "route": { "path": "my-rules.html" }, "note": "Existing page; not yet migrated" },
      { "id": "portfolio-sizer", "parent": "portfolio", "label": "Position Sizing", "icon": "🧮",
        "desc": "Shares from your risk budget", "status": "available", "route": { "path": "position-sizer.html" } },
      { "id": "portfolio-tax", "parent": "portfolio", "label": "Tax-Loss Harvester", "icon": "🧾",
        "desc": "Loss candidates and wash-sale flags", "status": "available", "route": { "path": "tax-loss-harvester.html" } },
      { "id": "portfolio-accounts", "parent": "portfolio", "label": "Accounts & Cash", "icon": "💵",
        "status": "planned", "note": "Planned; waits on account-ownership fixes" },

      { "id": "watchlists", "label": "Watchlists", "icon": "👁️",
        "status": "available", "route": { "path": "watchlist.html" }, "mobile": "watchlists" },

      { "id": "journal", "label": "Journal & Review", "shortLabel": "Journal", "icon": "📝",
        "status": "available", "route": { "path": "trade-journal-pro.html" }, "mobile": "journal" },
      { "id": "journal-trades", "parent": "journal", "label": "Trade Journal", "icon": "📝",
        "desc": "Stock and option trades", "status": "available", "route": { "path": "trade-journal-pro.html" },
        "activeWhen": [ { "path": "trade-journal-pro.html", "query": { "tab": [null, "stock", "option"] } } ] },
      { "id": "journal-stats", "parent": "journal", "label": "Stats & Analysis", "icon": "📊",
        "desc": "Expectancy and execution quality", "status": "available",
        "route": { "path": "trade-journal-pro.html", "query": { "tab": "stats" } } },
      { "id": "journal-expectancy", "parent": "journal", "label": "Expectancy Matrix", "icon": "🧮",
        "desc": "Is your edge real?", "status": "available", "route": { "path": "expectancy-matrix.html" } },
      { "id": "journal-quality", "parent": "journal", "label": "Data Quality", "icon": "🩺",
        "desc": "Check journal data quality", "status": "available", "route": { "path": "data-hygiene-audit.html" } },
      { "id": "journal-decisions", "parent": "journal", "label": "Decision history", "icon": "🗃️",
        "status": "planned", "note": "Planned" }
    ],
    "utilities": [
      { "id": "util-account", "label": "Account Settings", "icon": "⚙️", "route": { "path": "account.html" } },
      { "id": "util-billing", "label": "Billing", "icon": "💳", "route": { "path": "billing.html" } },
      { "id": "util-broker", "label": "Broker Connections (read-only)", "icon": "🔗", "route": { "path": "broker-connections.html" } }
    ],
    "homes": [
      { "path": "ai-moat-finder.html", "entry": "research" },
      { "path": "dcf-analyzer.html", "entry": "research" },
      { "path": "money-flow-alert.html", "entry": "research" },
      { "path": "tool-audit.html", "entry": "research-tools" },
      { "path": "options-analyzer.html", "entry": "desk-options" },
      { "path": "atr-stop-planner.html", "entry": "portfolio" },
      { "path": "kelly-calculator.html", "entry": "portfolio" },
      { "path": "risk-comfort.html", "entry": "portfolio" },
      { "path": "volatility-guardrails.html", "entry": "portfolio" },
      { "path": "dividend-tracker.html", "entry": "portfolio" },
      { "path": "discipline-scorecard.html", "entry": "journal" },
      { "path": "r-multiple.html", "entry": "journal" },
      { "path": "trading-journal-analysis.html", "entry": "journal" },
      { "path": "trade-plan-builder.html", "entry": "command" }
    ],
    "brand": { "signedIn": "trading-command.html", "signedOut": "index.html" },
    "support": { "path": "support.html" },
    "pricing": { "path": "pricing.html" },
    "mobileOrder": ["command", "watchlists", "portfolio", "journal", "more"]
  };
  /* REGISTRY-JSON-END */

  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) {
      if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]);
    });
    return Object.freeze(o);
  }

  window.ArowanaNavRegistry = deepFreeze(REGISTRY);
})();
