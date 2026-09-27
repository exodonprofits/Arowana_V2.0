/* ============================================================================
   Arowana — Session User Repair  (js/session-user.js)
   ----------------------------------------------------------------------------
   Puts the user id back into gs_auth_user_v1 when it goes missing.

   THE PROBLEM THIS SOLVES
   Every page keys its data off `gs_auth_user_v1.id`:

     portfolio-advisor   getUID()        -> user_id=eq.<id>
     portfolio-command   pcGetAuthUser() -> returns null without .id
     trading-command     same pattern

   Something in the auth path can leave that object holding only
   { email, name, username, plan } — no id. The failure is quiet and
   misleading: auth-header.js still has the display name, so the rail shows
   the user and the page looks signed in, while every query silently returns
   nothing. Portfolio Command reports "Sign in to view your portfolio" next to
   a signed-in-looking header; the advisor falls back to a stale cache.

   THE REPAIR
   The Supabase session is the authority on who is signed in, and it survives
   independently of this cache. If the cached object is missing an id, take it
   from the live session and write it back — so the cache is correct for every
   page, not just the one that noticed.

   This is a safety net, not the fix. Whatever writes gs_auth_user_v1 without
   an id should be corrected at the source; this stops it costing an hour of
   confusion in the meantime.

   USAGE — load early, before page scripts read the cache:
     <script src="./js/session-user.js"></script>

     await AP_SESSION.ensureUserId();   // resolves to the id, or null
   ========================================================================== */
(function (window) {
  'use strict';
  if (window.AP_SESSION) return;

  var KEY = 'gs_auth_user_v1';

  function readCached() {
    try {
      var raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /* The live client auto-refreshes, so it is the most reliable source. Falls
     back to supabase-js's own persisted session (sb-<ref>-auth-token), which is
     written independently of this cache and so survives it being clobbered. */
  async function sessionUser() {
    try {
      if (window.supabaseClient && window.supabaseClient.auth &&
          typeof window.supabaseClient.auth.getSession === 'function') {
        var res = await window.supabaseClient.auth.getSession();
        var u = res && res.data && res.data.session && res.data.session.user;
        if (u && u.id) return u;
      }
    } catch (_) {}

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('sb-') !== 0 || k.indexOf('auth-token') === -1) continue;
        var parsed = JSON.parse(localStorage.getItem(k) || 'null');
        if (!parsed) continue;
        var sess = parsed.currentSession || parsed;
        if (sess && sess.user && sess.user.id) return sess.user;
      }
    } catch (_) {}

    return null;
  }

  /**
   * Returns the user id, repairing the cached object if it had lost one.
   * Never overwrites an id that is already there, and never invents one:
   * if there is no session, it resolves null and leaves the cache alone.
   */
  async function ensureUserId() {
    var cached = readCached();
    if (cached && cached.id) { enforceUserScope(cached.id); return cached.id; }

    var u = await sessionUser();
    if (!u || !u.id) return null;
    enforceUserScope(u.id);

    var merged = Object.assign({}, cached || {}, {
      id: u.id,
      /* Only fill gaps — a display name the user set should not be replaced
         by whatever the auth provider happens to hold. */
      email: (cached && cached.email) || u.email || null
    });

    try {
      localStorage.setItem(KEY, JSON.stringify(merged));
      console.info('[session-user] gs_auth_user_v1 was missing its id; restored from the live session.');
    } catch (_) {}

    return u.id;
  }

  // ==========================================================================
  // USER SCOPE — keep one person's data out of another person's session
  // ==========================================================================
  /**
   * localStorage belongs to the BROWSER, not the account. Roughly thirty keys
   * here hold user data — positions, watchlists, risk settings, API keys — and
   * none of them knew whose they were. Sign in as somebody else and you
   * inherited the lot: a brand-new user opening the AI Coach saw eight
   * positions with real entry prices that were not hers.
   *
   * journal-sync.js guards tj_stocks_v2 / tj_options_v2 and account-registry.js
   * guards ap_accounts_v1, because those needed bespoke handling. Everything
   * else is covered here.
   *
   * Quarantined, never deleted: some of these caches may hold the only copy of
   * something (the 39-trades-in-one-browser problem), and destroying data to
   * fix a display bug is the wrong trade. Anything moved aside keeps its
   * contents under ap_quarantine_<uid>_<key>.
   */
  var LAST_USER_KEY = 'ap_last_user_v1';

  /* Describes THIS BROWSER, not the person — survives a user change. */
  var DEVICE_KEYS = [
    'ap_interface_mode_v1',      // reset deliberately for new accounts at login
    'ap_rail_collapsed_v1',
    'ap_coach_rail_collapsed_v1',
    'pc_active_tab_v1', 'tc_active_tab_v1', 'ac_active_tab_v1',
    'mi_active_tab_v1', 'oh_active_tab_v1',
    'ap_last_user_v1', 'ap_known_users_v1',
    'ap_journal_owner_v1', 'ap_accounts_owner_v1'
  ];

  /* Belongs to a person. Prefixes catch the per-page keys without listing
     every one, which matters because new ones get added over time and an
     omission here is a silent leak rather than a visible error. */
  var USER_KEY_PREFIXES = ['ap_', 'tj_', 'lt_', 'pc_', 'tc_', 'ac_', 'mi_', 'oh_', 'stw_', 'gs_debug', 'finnhub_'];

  function isUserScoped(key) {
    if (!key) return false;
    if (DEVICE_KEYS.indexOf(key) !== -1) return false;
    if (key.indexOf('ap_quarantine_') === 0) return false;   // already set aside
    if (key === 'gs_auth_user_v1') return false;             // the session itself
    if (key.indexOf('sb-') === 0) return false;              // Supabase's own storage
    for (var i = 0; i < USER_KEY_PREFIXES.length; i++) {
      if (key.indexOf(USER_KEY_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function quarantineUserData(previousUid) {
    var prefix = 'ap_quarantine_' + (previousUid || 'unknown') + '_';
    var moved = [];
    var keys = [];
    try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (_) {}

    keys.forEach(function (k) {
      if (!isUserScoped(k)) return;
      try {
        var val = localStorage.getItem(k);
        if (val !== null && val !== '' && val !== '[]' && val !== '{}') {
          localStorage.setItem(prefix + k, val);
          moved.push(k);
        }
        localStorage.removeItem(k);
      } catch (_) {}
    });
    return moved;
  }

  /**
   * Called on every page once the user id is known. Does nothing at all when
   * the same person is still signed in — the overwhelmingly common case.
   */
  function enforceUserScope(uid) {
    if (!uid) return { changed: false };
    var last = null;
    try { last = localStorage.getItem(LAST_USER_KEY); } catch (_) {}

    if (last === uid) return { changed: false };

    if (last && last !== uid) {
      var moved = quarantineUserData(last);
      console.warn('[session-user] A different account signed in. Set aside ' +
        moved.length + ' local key(s) belonging to the previous user — nothing was deleted. ' +
        'They are under ap_quarantine_' + last + '_*');
      try { localStorage.setItem(LAST_USER_KEY, uid); } catch (_) {}
      return { changed: true, quarantined: moved };
    }

    /* First time we have ever recorded a user on this device. Claim it without
       touching anything: the data almost certainly belongs to this person
       (an existing install), and guessing otherwise would throw away their
       work on upgrade day. */
    try { localStorage.setItem(LAST_USER_KEY, uid); } catch (_) {}
    return { changed: false, claimed: true };
  }

  window.AP_SESSION = {
    KEY: KEY,
    enforceUserScope: enforceUserScope,
    isUserScoped: isUserScoped,
    readCached: readCached,
    sessionUser: sessionUser,
    ensureUserId: ensureUserId
  };
})(window);
