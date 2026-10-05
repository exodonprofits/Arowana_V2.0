// /shared/js/auth-header.js
// Edge-safe header auth: the primary path does NOT depend on the Supabase
// SDK — it reads a small cached user object stored at login time
// (first-party storage), so the header can paint instantly with no async
// wait. If that cache is empty, though, it no longer just gives up and
// shows "Log in" forever — see tryLiveSessionFallback() below.

(function () {
  const KEY_USER = "gs_auth_user_v1";

  // Optional overrides (for different folder structures)
  let LOGIN_URL = "../onboarding/login.html";
  let AFTER_LOGOUT_URL = "../index.html";

  // ── onAuthChange notification ────────────────────────────────────
  // trade-journal-pro.html (and now several other pages) assign a
  // callback to window.GSAuthHeader.onAuthChange expecting it to fire
  // whenever the displayed login state changes — but this module never
  // actually called it. That made those assignments silently dead code.
  //
  // Two things had to be true for this to actually work for real pages:
  //   1. Real changes (login/logout, cross-tab storage events) notify
  //      the current handler, de-duped so repeated refreshHeader() calls
  //      with an unchanged user don't re-fire consumers redundantly.
  //   2. Handlers assigned AFTER the initial auto-refresh already ran
  //      (the common case — auth-header.js self-invokes and refreshes
  //      immediately on load, but consuming pages typically assign
  //      .onAuthChange later in their own boot sequence) still get told
  //      the CURRENT state immediately, instead of only hearing about
  //      the next change. Without this, a page that loads already-
  //      logged-in would never learn that from onAuthChange at all,
  //      since "logged in" wouldn't count as a "change" from nothing.
  let _authChangeHandler = null;
  let _lastNotifiedKey; // undefined until the first real notification

  function _keyFor(user) {
    return user && user.id != null ? String(user.id) : (user ? JSON.stringify(user) : null);
  }

  function _fireAuthChangeHandler(user) {
    try {
      if (typeof _authChangeHandler === "function") _authChangeHandler(user || null);
    } catch (e) {
      console.warn("[auth-header] onAuthChange handler threw:", e);
    }
  }

  function _notifyAuthChange(user) {
    const key = _keyFor(user);
    if (key === _lastNotifiedKey) return; // no real change — skip
    _lastNotifiedKey = key;
    _fireAuthChangeHandler(user);
  }

  function safeParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function getCachedUser() {
    try {
      const a = localStorage.getItem(KEY_USER);
      if (a) return safeParse(a);
    } catch (_) {}

    try {
      const b = sessionStorage.getItem(KEY_USER);
      if (b) return safeParse(b);
    } catch (_) {}

    return null;
  }

  function setCachedUser(user, preferSession) {
    const payload = JSON.stringify(user || null);

    try { localStorage.removeItem(KEY_USER); } catch (_) {}
    try { sessionStorage.removeItem(KEY_USER); } catch (_) {}

    try {
      (preferSession ? sessionStorage : localStorage).setItem(KEY_USER, payload);
    } catch (_) {
      // If storage is blocked, do nothing.
    }
  }

  function clearCachedUser() {
    try { localStorage.removeItem(KEY_USER); } catch (_) {}
    try { sessionStorage.removeItem(KEY_USER); } catch (_) {}
  }

  function displayNameFromUser(u) {
    if (!u) return "";
    return (
      u.full_name ||
      u.name ||
      u.username ||
      (u.email ? String(u.email).split("@")[0] : "") ||
      "Account"
    );
  }

  function $(id) { return document.getElementById(id); }

  function setLoggedOutUI() {
    const nameEl = $("user-name-label");
    const loginBtn = $("user-auth-action");
    const logoutBtn = $("user-signout-btn");

    if (nameEl) nameEl.textContent = "Log in";
    if (loginBtn) {
      loginBtn.textContent = "Log in / Sign up";
      loginBtn.onclick = () => {
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        location.href = LOGIN_URL + "?next=" + next;
      };
    }
    if (logoutBtn) logoutBtn.style.display = "none";

    _notifyAuthChange(null);
  }

  function setLoggedInUI(user) {
    const nameEl = $("user-name-label");
    const loginBtn = $("user-auth-action");
    const logoutBtn = $("user-signout-btn");

    if (nameEl) nameEl.textContent = displayNameFromUser(user);
    if (loginBtn) {
      loginBtn.textContent = "Account";
      loginBtn.onclick = () => { location.href = "account.html"; };
    }
    if (logoutBtn) {
      logoutBtn.style.display = "block";
      logoutBtn.onclick = async () => {
        clearCachedUser();
        setLoggedOutUI();

        // Best-effort Supabase sign out (if your global GSClient exists)
        try {
          if (window.GSClient && window.GSClient.getAsync) {
            const c = await window.GSClient.getAsync();
            if (c?.auth?.signOut) await c.auth.signOut();
          }
        } catch (_) {}

        location.href = AFTER_LOGOUT_URL;
      };
    }

    _notifyAuthChange(user);
  }

  // ── Live-session fallback ─────────────────────────────────────────
  // Root cause this fixes: gs_auth_user_v1 is written once, at the moment
  // login.html runs, by that page's own code. It's a *cache*, not the
  // real session — the real, auto-refreshing session lives inside the
  // Supabase SDK's own storage (managed by persistSession:true) and is
  // exposed app-wide as window.GSClient.getAsync() by app-config.js
  // specifically so scripts like this one can reach it.
  //
  // Those two can legitimately disagree: a user can have a completely
  // valid, live Supabase session (proven elsewhere on the same page by
  // e.g. journal-sync.js calling client.auth.getSession() directly) while
  // gs_auth_user_v1 is empty or stale — e.g. if the session was
  // established or restored by a path that never happened to (re)write
  // that cache key. Previously this script only ever looked at the cache,
  // so that case rendered as "Log in" even for a genuinely signed-in user.
  //
  // This runs only when the synchronous cache check below found nothing,
  // so it never slows down or changes behavior for the common case where
  // the cache is already correct.
  let _fallbackAttempted = false;

  async function tryLiveSessionFallback() {
    if (_fallbackAttempted) return;
    _fallbackAttempted = true;

    // window.GSClient is created asynchronously by app-config.js (it has
    // to wait for both config.json and the Supabase SDK <script> tag to
    // load), so it may not exist the instant this file runs. Poll briefly
    // rather than assume a load order this file doesn't control.
    const deadline = Date.now() + 10_000;
    while (!(window.GSClient && typeof window.GSClient.getAsync === "function")) {
      if (Date.now() > deadline) return; // app-config.js never became ready — stay logged-out
      await new Promise((r) => setTimeout(r, 250));
    }

    try {
      const client = await window.GSClient.getAsync();
      if (!client || !client.auth) return;

      const { data } = await client.auth.getSession();
      const session = data && data.session;
      if (!session || !session.user) return; // genuinely no session — "Log in" was correct

      // Something else (a same-tab call to setCachedUser(), or a
      // cross-tab storage event) may have already resolved this while we
      // were polling/awaiting above — don't clobber a state that's
      // already correct.
      if (getCachedUser()) return;

      const user = {
        id: session.user.id,
        email: session.user.email,
        full_name:
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          null,
        access_token: session.access_token,
      };

      // Repair the cache, not just the UI — other same-tab code that
      // reads gs_auth_user_v1 directly (e.g. Analysis Central's
      // performance-data fetch) benefits from this too, and it means
      // the next page load won't need this fallback at all.
      setCachedUser(user);
      setLoggedInUI(user);
    } catch (e) {
      console.warn("[auth-header] Live session fallback failed:", e);
    }
  }

  /* Is the cached user actually the one signed in?
     ----------------------------------------------------------------------
     The cache is written once at login and never checked afterwards, so a
     stale record survives a sign-in as somebody else: the header showed
     "Jimmy Tran" while the live session was victorianails349. Four products
     share this storage key, which makes the mismatch routine rather than
     exotic.

     This runs in the background AFTER painting, so the fast path is unchanged
     — the header still renders instantly from cache. It only corrects itself
     if the live session disagrees. */
  let _verifyAttempted = false;

  async function verifyAgainstLiveSession(cached) {
    if (_verifyAttempted) return;
    _verifyAttempted = true;

    const deadline = Date.now() + 10000;
    while (!(window.GSClient && typeof window.GSClient.getAsync === "function")) {
      if (Date.now() > deadline) return;
      await new Promise((r) => setTimeout(r, 250));
    }

    try {
      const client = await window.GSClient.getAsync();
      const { data } = await client.auth.getSession();
      const live = data && data.session && data.session.user;
      if (!live) return;                 // offline or no session — keep the cache
      if (live.id === cached.id) return; // agrees; nothing to do

      console.warn('[auth-header] Cached user (' + (cached.email || cached.id) +
        ') does not match the signed-in session (' + (live.email || live.id) +
        '). Correcting the header.');

      const user = {
        id: live.id,
        email: live.email,
        full_name: live.user_metadata?.full_name || live.user_metadata?.name || null,
        access_token: data.session.access_token,
      };
      setCachedUser(user);
      setLoggedInUI(user);
    } catch (e) {
      console.warn("[auth-header] Session verification failed:", e);
    }
  }

  function wireDropdown() {
    const toggle = $("user-menu-toggle");
    const dd = $("user-menu-dropdown");
    if (!toggle || !dd) return;

    function close() {
      dd.style.display = "none";
      toggle.setAttribute("aria-expanded", "false");
    }
    function open() {
      dd.style.display = "block";
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = dd.style.display === "block";
      isOpen ? close() : open();
    });

    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target) && !toggle.contains(e.target)) close();
    });
  }

  function wireDropdownNavButtons() {
    document.querySelectorAll(".dropdown-nav").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target) location.href = target;
      });
    });
  }

  function refreshHeader() {
    const cached = getCachedUser();

    /* A cached user with no id is not usable.
       --------------------------------------------------------------------
       gs_auth_user_v1 is shared across every product on this Supabase project,
       and they do not all write the same shape. One of them stores
       { email, name, username, plan } with no id at all. Arowana's pages key
       every query off that id — portfolio-advisor's getUID(), portfolio-
       command's pcGetAuthUser(), journal-sync's entire write path — so an
       id-less cache renders as "signed in" in this header while every page
       silently loads nothing. That failure looks like a network or permissions
       problem and is genuinely hard to trace back to here.

       Treat it as a cache miss instead: the live-session fallback below can
       rebuild a complete record, id included. */
    if (cached && !cached.id) {
      console.warn('[auth-header] Cached user has no id — treating as stale and ' +
                   'rebuilding from the live session.');
      clearCachedUser();
      setLoggedOutUI();
      tryLiveSessionFallback();
      return;
    }

    if (cached) {
      setLoggedInUI(cached);
      verifyAgainstLiveSession(cached);
      return;
    }
    // No cache — show the honest default immediately, then upgrade to
    // "logged in" in the background if a live session turns out to exist.
    setLoggedOutUI();
    tryLiveSessionFallback();
  }

  window.GSAuthHeader = {
    // Backwards compatible init() so older pages don't crash.
    // Usage: GSAuthHeader.init({ loginUrl, afterLogoutUrl })
    init(opts){
      try{
        if(opts?.loginUrl) LOGIN_URL = opts.loginUrl;
        if(opts?.afterLogoutUrl) AFTER_LOGOUT_URL = opts.afterLogoutUrl;
      }catch(_){ }
      refreshHeader();
    },
    setCachedUser,
    clearCachedUser,
    refreshHeader
  };

  // onAuthChange as a getter/setter (not a plain property) so that
  // ASSIGNING a handler immediately replays the current auth state to
  // it — covers the common case of a page assigning .onAuthChange after
  // this script's own initial refreshHeader() already ran (see comment
  // above _authChangeHandler). Plain property assignment can't do this;
  // it can only be told about changes that happen after assignment.
  Object.defineProperty(window.GSAuthHeader, "onAuthChange", {
    configurable: true,
    get() { return _authChangeHandler; },
    set(fn) {
      _authChangeHandler = fn;
      if (typeof fn === "function") {
        // Replay current state immediately for this newly-assigned
        // handler. Bypasses the de-dup key deliberately — a handler
        // that just subscribed has never heard the current state yet,
        // regardless of whether _lastNotifiedKey already matches it
        // from some earlier (unheard) notification.
        _fireAuthChangeHandler(getCachedUser());
      }
    }
  });

  wireDropdown();
  wireDropdownNavButtons();
  refreshHeader();

  window.addEventListener("storage", (e) => {
    if (e.key === KEY_USER) refreshHeader();
  });
})();
