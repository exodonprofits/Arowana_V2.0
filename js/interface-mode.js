/* ============================================================================
   Arowana — Shared Interface Mode  (js/interface-mode.js)
   ----------------------------------------------------------------------------
   Single owner of `ap_interface_mode_v1`, the Beginner / Guided / Full
   experience level. Before this module each page implemented modes its own way:

     position-sizer.html   body.className = 'mode-' + (advanced ? 'full' : mode)
     trading-command.html  body.classList.toggle('guided-mode', mode==='guided')
     watchlist.html        body.dataset.experienceMode = mode  (+ .experience-hidden)
     arowana-trader.html   body.classList.toggle('beginner-mode', mode==='beginner')

   Three dialects for one concept, so CSS written for one page was silently dead
   on the others. This module emits ALL THREE at once, which makes retrofitting
   safe: drop the script in, delete the page's own mode block, and whatever
   selectors that page already used keep matching. New pages should prefer the
   .mode-* classes.

   CANONICAL VALUES are 'beginner' | 'guided' | 'advanced'. Note the long-
   standing trap: the STORED value is 'advanced' but its BODY CLASS is
   'mode-full'. Use AP_MODE.get() / AP_MODE.is() and never compare strings by
   hand.

   USAGE
     <script src="./js/interface-mode.js"></script>

     AP_MODE.get()                  -> 'beginner' | 'guided' | 'advanced'
     AP_MODE.is('beginner')         -> boolean
     AP_MODE.atLeast('guided')      -> true for guided AND advanced
     AP_MODE.set('guided')          -> applies + persists + notifies
     AP_MODE.onChange(fn)           -> fn({mode, previous, first}); returns an
                                       unsubscribe function. Fires immediately
                                       with first:true so callers don't need a
                                       separate initial render call.
     AP_MODE.bindSelect(el)         -> keeps a <select> in sync, both ways
     AP_MODE.LABELS                 -> the agreed display names

     document.addEventListener('ap:mode:change', e => e.detail.mode)
     (dispatched on document with bubbles:true, so window listeners also fire)

   BEHAVIOUR NOTES
   - `?mode=` in the URL wins over storage on load, and is persisted.
   - Changing mode NEVER navigates. Pages that want to route on a given mode
     (Trading Command sends beginner -> arowana-trader.html) do that in their
     own onChange handler, so the routing decision stays visible on the page
     that owns it.
   - If the URL already carries ?mode=, it is kept in sync via replaceState.
     Clean URLs are left clean.
   - Another tab changing mode repaints this one (storage event).
   - Applies the body class as early as it can to avoid a flash of the wrong
     mode; safe to load from <head> or from the end of <body>.
   ========================================================================== */
(function (window, document) {
  'use strict';

  if (window.AP_MODE) return; // already loaded — never double-bind

  var KEY = 'ap_interface_mode_v1';
  var MODES = ['beginner', 'guided', 'advanced'];

  /* Display names. Trading Command still ships the older "Beginner / Guided
     Desk / Full Desk" wording; these are the agreed ones. */
  var LABELS = {
    beginner: 'Beginner Mode',
    guided: 'Guided Trade Desk',
    advanced: 'Full Trade Desk'
  };

  /* Stored value -> body class suffix. The 'advanced' -> 'full' mapping is the
     historical quirk this table exists to contain. */
  var CLASS_SUFFIX = { beginner: 'beginner', guided: 'guided', advanced: 'full' };
  var ALL_CLASSES = ['mode-beginner', 'mode-guided', 'mode-full'];

  var RANK = { beginner: 0, guided: 1, advanced: 2 };

  var current = null;
  var listeners = [];

  /* --- normalise -------------------------------------------------------- */
  /* Accepts the canonical values plus the aliases that exist in the wild:
     'full' (the class suffix), 'advance', and legacy 'pro'. */
  function normalise(value) {
    if (!value) return null;
    var v = String(value).trim().toLowerCase();
    if (v === 'full' || v === 'advance' || v === 'pro') v = 'advanced';
    if (v === 'basic' || v === 'new') v = 'beginner';
    return MODES.indexOf(v) === -1 ? null : v;
  }

  function readStored() {
    try {
      return normalise(localStorage.getItem(KEY));
    } catch (_) {
      return null; // private browsing / storage disabled
    }
  }

  function writeStored(mode) {
    try { localStorage.setItem(KEY, mode); } catch (_) {}
  }

  function readUrl() {
    try {
      return normalise(new URLSearchParams(window.location.search).get('mode'));
    } catch (_) {
      return null;
    }
  }

  /* --- apply ------------------------------------------------------------ */
  function applyToBody(mode) {
    var body = document.body;
    if (!body) return false;

    /* Dialect 1 — .mode-beginner / .mode-guided / .mode-full (preferred).
       Note position-sizer.html historically did body.className = '...', which
       WIPES every other class on <body>. Toggling is the safe equivalent. */
    ALL_CLASSES.forEach(function (cls) { body.classList.remove(cls); });
    body.classList.add('mode-' + CLASS_SUFFIX[mode]);

    /* Dialect 2 — the single-state classes: .guided-mode (Trading Command) and
       .beginner-mode (AI Trading Coach). Both are toggled every time so a page
       styled against either keeps working. */
    body.classList.toggle('guided-mode', mode === 'guided');
    body.classList.toggle('beginner-mode', mode === 'beginner');

    /* Dialect 3 — Watchlist's data attribute. */
    body.dataset.experienceMode = mode;

    return true;
  }

  /* Body may not exist yet if this is loaded from <head>. */
  function ensureBody(mode) {
    if (applyToBody(mode)) return;
    document.addEventListener('DOMContentLoaded', function () {
      applyToBody(mode);
    }, { once: true });
  }

  function syncUrl(mode) {
    /* Only maintain ?mode= if the page was already using it — don't append a
       param to an otherwise clean URL. */
    try {
      var params = new URLSearchParams(window.location.search);
      if (!params.has('mode')) return;
      if (params.get('mode') === mode) return;
      params.set('mode', mode);
      window.history.replaceState(null, '', window.location.pathname + '?' + params + window.location.hash);
    } catch (_) {}
  }

  function notify(mode, previous, first) {
    var detail = { mode: mode, previous: previous, first: !!first };

    listeners.slice().forEach(function (fn) {
      try { fn(detail); } catch (err) { console.error('[AP_MODE] listener failed:', err); }
    });

    try {
      document.dispatchEvent(new CustomEvent('ap:mode:change', { detail: detail, bubbles: true }));
    } catch (_) {}
  }

  /* --- selects ---------------------------------------------------------- */
  var boundSelects = [];

  function populate(select) {
    select.innerHTML = '';
    MODES.forEach(function (mode) {
      var opt = document.createElement('option');
      opt.value = mode;
      opt.textContent = LABELS[mode];
      select.appendChild(opt);
    });
  }

  function bindSelect(target, options) {
    var select = typeof target === 'string' ? document.getElementById(target) : target;
    if (!select || select.dataset.apModeBound === '1') return select || null;

    options = options || {};
    if (options.populate) populate(select);

    /* Normalise the option text from LABELS unless the caller opts out.
       Each page hardcoded its own wording, so one setting had two names —
       "Full Desk" on Trading Command, "Full Trade Desk" on Portfolio Command.
       LABELS is the single source: any select bound here shows the agreed
       words, and changing them in one place changes them everywhere. */
    if (options.labels !== false) {
      Array.prototype.forEach.call(select.options, function (opt) {
        var mode = normalise(opt.value);
        if (mode && LABELS[mode]) opt.textContent = LABELS[mode];
      });
    }

    select.dataset.apModeBound = '1';
    setSelectValue(select, current);

    select.addEventListener('change', function () {
      var next = normalise(select.value);
      if (!next) { select.value = current; return; }
      set(next, { source: 'select' });
    });

    boundSelects.push(select);
    return select;
  }

  /* A partial select (one missing an <option> for this mode) would be blanked
     by a plain assignment, so leave it alone instead. */
  function setSelectValue(select, mode) {
    if (select.value === mode) return;
    if (!select.querySelector('option[value="' + mode + '"]')) return;
    select.value = mode;
  }

  function syncSelects(mode) {
    boundSelects.forEach(function (select) {
      if (select.isConnected) setSelectValue(select, mode);
    });
  }

  /* --- public ----------------------------------------------------------- */
  function set(next, options) {
    options = options || {};
    var mode = normalise(next) || 'beginner';
    var previous = current;
    if (mode === previous && !options.force) return mode;

    current = mode;
    writeStored(mode);
    ensureBody(mode);
    syncUrl(mode);
    syncSelects(mode);
    notify(mode, previous, false);
    return mode;
  }

  function onChange(fn, options) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);

    /* Fire immediately so a caller can use one render path for init and for
       later changes, instead of duplicating the first paint. Opt out with
       {immediate:false}. */
    if (!options || options.immediate !== false) {
      try { fn({ mode: current, previous: null, first: true }); }
      catch (err) { console.error('[AP_MODE] listener failed:', err); }
    }

    return function unsubscribe() {
      var i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  window.AP_MODE = {
    KEY: KEY,
    MODES: MODES.slice(),
    LABELS: LABELS,

    get: function () { return current; },
    is: function (mode) { return current === normalise(mode); },
    atLeast: function (mode) {
      var floor = normalise(mode);
      return floor ? RANK[current] >= RANK[floor] : false;
    },
    label: function (mode) { return LABELS[normalise(mode) || current]; },
    bodyClass: function (mode) { return 'mode-' + CLASS_SUFFIX[normalise(mode) || current]; },

    set: set,
    onChange: onChange,
    bindSelect: bindSelect,
    populateSelect: populate,
    normalise: normalise
  };

  /* --- init ------------------------------------------------------------- */
  /* URL beats storage beats the beginner default — the same precedence every
     page already used individually. */
  current = readUrl() || readStored() || 'beginner';
  writeStored(current);
  ensureBody(current);
  syncUrl(current);

  function autoBind() {
    /* Zero-config for the selects already in the codebase, plus an explicit
       opt-in hook for new markup. Set data-mode-select="off" to skip one.
       IMPORTANT when retrofitting: delete the page's own change handler first,
       or the mode will be applied twice. */
    var found = document.querySelectorAll(
      '[data-mode-select], #experienceSwitch, #deskLevelSelect'
    );
    Array.prototype.forEach.call(found, function (select) {
      if (select.dataset.modeSelect === 'off') return;
      if (select.tagName !== 'SELECT') return;
      bindSelect(select);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBind, { once: true });
  } else {
    autoBind();
  }

  /* Another tab switched mode — follow it. A removed key means storage was
     cleared (sign-out), so fall back to the default rather than guessing. */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    var next = normalise(e.newValue) || 'beginner';
    if (next !== current) set(next, { source: 'storage' });
  });
})(window, document);
