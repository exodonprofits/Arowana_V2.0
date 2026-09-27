/* ============================================================================
   Arowana — Scanner Registry  (js/scanners.js)
   ----------------------------------------------------------------------------
   One scanner page, many scanners. Same idea as js/strategy-analyzers.js, which
   already proves it works: watchlist.html builds its picker from
   window.StrategyAnalyzers.registry, so adding a fifth analyzer needs no change
   to that page at all.

   WHY
   The tools directory lists ~20 scanner pages — orb-scanner, gap-and-go,
   rvol-scanner, hod-scanner, pattern-scanner, rsi-reversal-scanner,
   sma-cross-scanner, short-squeeze-scanner, vwap-pullback, ema-snapback,
   bb-snapback, trendline-break, post-earnings-drift, opening-drive,
   gap-fade-scanner, intraday-breakout and more. Each is a full HTML page with
   its own copy of the auth gate, the nav rail, mode handling and the
   config-wait. Every platform-wide fix has to be made twenty times, which is
   how bugs survive in the corners.

   WHAT THIS DOES NOT FIX
   Consolidating the shell does not make a scanner work. A scanner needs to RANK
   A MARKET, and the browser cannot: Finnhub's /quote is one request per symbol,
   returns no volume and no candles, and the free tier blocks /stock/candle
   outright. momentum-hunter-complete.html demonstrates the ceiling — it checks
   a hardcoded list of ten tickers and calls it a scan.

   So every scanner declares the data it NEEDS, and the shell disables it with a
   reason when that data is unavailable, rather than quietly serving demo rows.
   A scanner backed by nothing should look unavailable, not empty.

   ---------------------------------------------------------------------------
   REGISTERING

     AP_SCANNERS.register({
       id:        'gap_and_go',
       label:     'Gap & Go',
       category:  'Momentum',
       blurb:     'Overnight gaps holding their opening range.',
       minMode:   'guided',              // beginner | guided | advanced
       needs:     ['backend'],           // see DATA_SOURCES below
       filters: [
         { id:'minGap', label:'Minimum gap', type:'select', default:'3',
           options:[{value:'2',label:'2%+'},{value:'3',label:'3%+'},{value:'5',label:'5%+'}] },
       ],
       async run(ctx) {
         // ctx = { filters, universe, data, signal }
         return { rows: [...], asOf: '2026-09-06T13:30:00Z', universeSize: 4200 };
       }
     });

   RESULT CONTRACT — one renderer serves every scanner, exactly as
   factors/hardStops do for the analyzers:

     {
       rows: [{
         symbol:   'NVDA',
         price:    182.44,
         change:   0.0324,        // fraction, not percent — the renderer formats
         metrics:  [ {label:'Gap', value:'+4.2%'}, {label:'RVOL', value:'3.1x'} ],
         verdict:  'good' | 'neutral' | 'poor',
         reasons:  ['Gapped above yesterday's high', 'Holding opening range'],
       }],
       asOf:         ISO string — when the DATA was computed, not when it rendered
       universeSize: how many symbols were actually examined
       partial:      true when the scan could not cover its full universe
       note:         optional caveat shown with the results
     }
   ========================================================================== */
(function (window) {
  'use strict';
  if (window.AP_SCANNERS) return;

  /* What a scanner can depend on, and how to tell whether it is really there.
     Availability is CHECKED, never assumed — the whole point is that a scanner
     with no data says so instead of rendering something that looks live. */
  var DATA_SOURCES = {
    quote: {
      label: 'Live quotes',
      detail: 'Finnhub /quote — price and previous close, one request per symbol.',
      available: function () {
        try {
          var k = JSON.parse(localStorage.getItem('ap_user_api_keys') || '{}');
          return !!(k.finnhub || (window.AP_USER_KEYS && window.AP_USER_KEYS.finnhub));
        } catch (_) { return false; }
      },
      missing: 'Add a Finnhub API key in Account Settings.'
    },

    candles: {
      label: 'Historical candles',
      detail: 'Needed for RVOL, 52-week highs, moving averages and opening ranges.',
      /* Deliberately hardcoded false. The Finnhub free tier returns 403 for
         /stock/candle, and momentum-hunter-complete.html spent months with
         filters that read from the form and silently did nothing because that
         was never checked. If a paid tier or another vendor is wired up later,
         this becomes a real probe — not before. */
      available: function () { return false; },
      missing: 'Historical candles are not available on the current data plan. The backend scanner supplies these.'
    },

    fundamentals: {
      label: 'Fundamentals',
      detail: 'Market cap, float, short interest, earnings dates.',
      available: function () { return false; },
      missing: 'Fundamental data requires a provider that is not configured yet.'
    },

    backend: {
      label: 'Backend scanner',
      detail: 'n8n ranks the market on a schedule and writes results to Supabase. ' +
              'The only source here that can scan a real universe rather than a fixed list.',
      available: function () {
        return !!(window.AP_WEBHOOKS && window.callWebhook);
      },
      missing: 'The n8n scanner is not configured for this account.'
    }
  };

  var registry = {};
  var MODE_RANK = { beginner: 0, guided: 1, advanced: 2 };

  /* Plan gating.
     ------------------------------------------------------------------------
     This is the gate that decides what a user may USE. Data availability is a
     separate axis: it decides what a scan can currently RETURN. Conflating the
     two would mean a Pro subscriber seeing "Relative Volume Surge" greyed out
     as though they had not paid for it, which is the wrong message — they have;
     the data pipeline just is not live yet.

     So: plan decides enabled/locked, data decides what happens when it runs. */
  var PLAN_RANK = { free: 0, pro: 1, elite: 2 };

  /* Development unlock.
     ------------------------------------------------------------------------
     Plan gating is real product behaviour and stays in the code — stripping it
     out "for now" is how it never comes back. Instead it is bypassed when the
     app is running in development, so you can see and test all twelve scans
     without a paid account.

     Three ways in, checked in order:
       1. app-config.js reports environment: 'development'  (automatic on localhost)
       2. AP_DEV_CONFIG.unlockAllScanners === true          (explicit opt-in)
       3. localStorage ap_dev_unlock_scanners_v1 === '1'    (one browser, one session)

     None of these are true on the deployed site, so production still gates. */
  function devUnlocked() {
    /* Hostname first, and deliberately so.
       app-config.js logs `environment: 'development'`, but that object is not
       reliably exposed under a name this module can read, and even if it were,
       listForMode() runs during boot — possibly before app-config has finished.
       Reading location is synchronous, needs no other module, and cannot race. */
    try {
      var h = String(location.hostname || '').toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
          h === '0.0.0.0' || h.slice(-6) === '.local' ||
          /^192\.168\./.test(h) || /^10\./.test(h)) {
        return true;
      }
    } catch (_) {}

    try {
      var cfg = window.APP_CONFIG || window.AP_CONFIG || window.AROWANA_CONFIG || {};
      if (cfg.environment === 'development') return true;
      if (window.AP_DEV_CONFIG && window.AP_DEV_CONFIG.unlockAllScanners === true) return true;
      if (localStorage.getItem('ap_dev_unlock_scanners_v1') === '1') return true;
    } catch (_) {}
    return false;
  }

  function currentPlan() {
    if (devUnlocked()) return 'elite';
    try {
      if (localStorage.getItem('ap_is_pro_v1') === '1') return 'pro';
      var u = JSON.parse(localStorage.getItem('gs_auth_user_v1') || 'null');
      var p = u && u.plan ? String(u.plan).toLowerCase() : 'free';
      if (p.indexOf('elite') === 0) return 'elite';
      if (p.indexOf('pro') === 0 || p.indexOf('founder') === 0) return 'pro';
      return 'free';
    } catch (_) { return 'free'; }
  }

  function register(def) {
    if (!def || !def.id) {
      console.warn('[scanners] register() needs an id'); return null;
    }
    if (registry[def.id]) {
      console.warn('[scanners] "' + def.id + '" is already registered — ignoring the duplicate.');
      return registry[def.id];
    }
    if (typeof def.run !== 'function') {
      console.warn('[scanners] "' + def.id + '" has no run() — not registered.');
      return null;
    }

    registry[def.id] = {
      id:       def.id,
      label:    def.label || def.id,
      category: def.category || 'Other',
      blurb:    def.blurb || '',
      minMode:  def.minMode || 'beginner',
      plan:     def.plan || 'free',
      needs:    Array.isArray(def.needs) ? def.needs : [],
      filters:  Array.isArray(def.filters) ? def.filters : [],
      run:      def.run
    };
    return registry[def.id];
  }

  /**
   * Can this scanner run right now, and if not, why?
   *
   * Returns { ok, missing:[{source,label,reason}] } so the shell can disable the
   * control AND say what is wrong — the pattern we retro-fitted by hand onto
   * Momentum Hunter's dead filters. Doing it from a declaration means a new
   * scanner cannot forget to.
   */
  function availability(id) {
    var s = registry[id];
    if (!s) return { ok: false, missing: [{ source: '?', label: 'Unknown scanner', reason: 'Not registered.' }] };

    var missing = s.needs.reduce(function (acc, key) {
      var src = DATA_SOURCES[key];
      if (!src) {
        acc.push({ source: key, label: key, reason: 'Unknown data source.' });
      } else if (!src.available()) {
        acc.push({ source: key, label: src.label, reason: src.missing });
      }
      return acc;
    }, []);

    return { ok: missing.length === 0, missing: missing };
  }

  /* Scanners visible at the current experience level. Same rule the rest of the
     platform uses: mode gates EMPHASIS, and anything withheld is named rather
     than silently absent — the shell shows these greyed with their minimum. */
  function listForMode(mode) {
    var rank = MODE_RANK[mode] != null ? MODE_RANK[mode] : 0;
    var planRank = PLAN_RANK[currentPlan()] || 0;

    return Object.keys(registry).map(function (id) {
      var s = registry[id];
      var needsPlan = PLAN_RANK[s.plan] || 0;
      return {
        scanner: s,
        /* Every scan is now SELECTABLE unless the plan locks it. Data problems
           no longer disable the button — they are reported when it runs, so a
           user can always see what a scan is and what it would need. */
        allowed: true,
        modeHint: rank >= (MODE_RANK[s.minMode] || 0),
        planLocked: planRank < needsPlan,
        planNeeded: s.plan,
        availability: availability(id)
      };
    });
  }

  /**
   * Runs a scanner and normalises whatever it returns.
   *
   * Never throws at the caller: a scanner that fails returns an error result the
   * shared renderer can display, so one broken scanner cannot take down the page
   * hosting the other nineteen.
   */
  async function run(id, ctx) {
    var s = registry[id];
    if (!s) return errorResult(id, 'That scanner is not registered.');

    var avail = availability(id);
    if (!avail.ok) {
      return {
        scanner: id, label: s.label, error: true, unavailable: true,
        rows: [], universeSize: 0,
        note: avail.missing.map(function (m) { return m.reason; }).join(' ')
      };
    }

    try {
      var out = await s.run(ctx || {});
      var rows = Array.isArray(out && out.rows) ? out.rows : [];
      return {
        scanner: id,
        label: s.label,
        rows: rows,
        /* asOf is when the DATA was computed, not when this rendered. A cached
           backend scan from 08:00 must not look like a live 14:30 result — the
           distinction that made stale options data look current on Portfolio
           Command. */
        asOf: (out && out.asOf) || null,
        universeSize: (out && out.universeSize) != null ? out.universeSize : rows.length,
        partial: !!(out && out.partial),
        note: (out && out.note) || '',
        error: false
      };
    } catch (e) {
      console.warn('[scanners] "' + id + '" failed:', e);
      return errorResult(id, (e && e.message) || 'Scan failed.', s.label);
    }
  }

  function errorResult(id, message, label) {
    return {
      scanner: id, label: label || id, error: true, unavailable: false,
      rows: [], universeSize: 0, note: message
    };
  }

  window.AP_SCANNERS = {
    DATA_SOURCES: DATA_SOURCES,
    registry: registry,
    register: register,
    availability: availability,
    listForMode: listForMode,
    currentPlan: currentPlan,
    devUnlocked: devUnlocked,
    PLAN_RANK: PLAN_RANK,
    run: run
  };
})(window);
