/* ============================================================================
   plan.js — one place that answers "what plan is this user on?"
   ----------------------------------------------------------------------------
   Every page that gates a feature must use this rather than reading
   localStorage or querying profiles itself. The server is the only authority:
   profiles.arowana_plan is written solely by the Stripe webhook.

   Load order (after app-config.js + supabase_min.js):
       <script src="./js/plan.js"></script>

   Use:
       await AP_PLAN.ready();            // resolves once the server answered
       AP_PLAN.slug()                    // 'free' | 'pro' | 'elite' | 'founders'
       AP_PLAN.atLeast('pro')            // true for pro, elite, founders
       AP_PLAN.can('scanners')           // feature check
       AP_PLAN.status()                  // 'active' | 'past_due' | ... | null
       AP_PLAN.renewsAt()                // ISO string or null
       window.addEventListener('ap:plan:ready', fn)

   The cached value paints instantly on load, then the server value replaces
   it. Cache is a convenience only — never a way to unlock anything, because
   the tables behind every paid feature are protected by their own policies.
   ========================================================================== */
(function () {
  'use strict';

  var CACHE_KEY = 'ap_plan_v1';          // slug only, kept for older pages
  var CACHE_FULL = 'ap_plan_state_v1';   // slug + status + renewal + fetch time
  var FRESH_MS = 5 * 60 * 1000;

  var ORDER = { free: 0, pro: 1, elite: 2, founders: 3 };
  var FEATURES = {
    free:     { journal: true, csv: false, options: false, scanners: false, income: false, brief: false, guardrails: false, coach: false, screens: false, export: false },
    // Elite was folded into Pro: two features did not justify $50 more, and a
    // single paid plan is easier to sell honestly. 'elite' stays a valid slug
    // because existing accounts (and comps) still carry it.
    pro:      { journal: true, csv: true,  options: true,  scanners: true,  income: true,  brief: true,  guardrails: true,  coach: true,  screens: true,  export: true },
    elite:    { journal: true, csv: true,  options: true,  scanners: true,  income: true,  brief: true,  guardrails: true,  coach: true,  screens: true,  export: true },
    founders: { journal: true, csv: true,  options: true,  scanners: true,  income: true,  brief: true,  guardrails: true,  coach: true,  screens: true,  export: true }
  };
  // A lapsed payment keeps access until Stripe cancels; a cancelled plan does not.
  var ACTIVE_STATUSES = { active: true, trialing: true, past_due: true };

  var state = { slug: 'free', status: null, renewsAt: null, loaded: false, source: 'default' };
  var readyResolve;
  var readyPromise = new Promise(function (r) { readyResolve = r; });

  try {
    var raw = localStorage.getItem(CACHE_FULL);
    if (raw) {
      var cached = JSON.parse(raw);
      if (cached && ORDER[cached.slug] != null) {
        state.slug = cached.slug; state.status = cached.status || null;
        state.renewsAt = cached.renewsAt || null; state.source = 'cache';
      }
    } else {
      var legacy = localStorage.getItem(CACHE_KEY);
      if (legacy && ORDER[legacy] != null) { state.slug = legacy; state.source = 'cache'; }
    }
  } catch (e) { /* storage blocked — server value still applies */ }

  /* Shared client only — no side effects.
     ------------------------------------------------------------------------
     This used to be one getClient() that returned the shared client if it
     existed and otherwise CREATED a private one. That made waitForClient()
     below unreachable: its first line called getClient(), got a freshly
     minted private client back, saw a truthy .auth and resolved immediately.
     The poll, the ap:config:ready listener and the timeout never ran.

     The race was never close. AP_WEBHOOKS is set the moment config.json
     lands, which is well before app-config.js finishes
     initSharedSupabaseClient() — so the private branch won on every load, on
     every page that copied this pair (three more in trading-command.html
     alone). Four auth clients on one storage key is what GoTrue is warning
     about, and it is the same class of bug as a stale gs_auth_user_v1: two
     things that each believe they own the session. */
  function sharedClient() {
    var c = window.supabaseClient || window.sbClient;
    return (c && c.auth) ? c : null;
  }

  /* Genuine last resort, only after the wait below has timed out.
     Deliberately NOT an auth client: persistSession/autoRefreshToken off and
     its own storageKey, so it can read public data without competing for the
     session that the shared client owns. It will not see a login — which is
     correct, because if we got here the shared client never arrived and the
     honest answer is 'offline'. */
  function fallbackClient() {
    try {
      var cfg = window.AP_WEBHOOKS && window.AP_WEBHOOKS.supabase;
      if (!window.supabase || !cfg || !cfg.url) return null;
      var fb = window.supabase.createClient(cfg.url, cfg.anonKey || cfg.anon_key, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: 'ap_plan_fallback' }
      });
      fb.__apFallback = true;   // load() must not read "no session" as "signed out"
      return fb;
    } catch (e) { return null; }
  }

  function getClient() { return sharedClient(); }

  function waitForClient(ms) {
    return new Promise(function (resolve) {
      var c = sharedClient();
      if (c) return resolve(c);
      var done = false;
      function finish() {
        if (done) return;
        var x = sharedClient();
        if (x) { done = true; cleanup(); resolve(x); }
      }
      function cleanup() { window.removeEventListener('ap:config:ready', finish); clearInterval(poll); }
      window.addEventListener('ap:config:ready', finish);
      var poll = setInterval(finish, 200);
      setTimeout(function () {
        if (done) return;
        done = true; cleanup();
        console.warn('[plan] shared Supabase client never arrived in ' + ms + 'ms.');
        resolve(fallbackClient());
      }, ms);
    });
  }

  function settle(slug, status, renewsAt, source) {
    state.slug = ORDER[slug] != null ? slug : 'free';
    state.status = status || null;
    state.renewsAt = renewsAt || null;
    state.loaded = true;
    state.source = source;
    try {
      localStorage.setItem(CACHE_KEY, state.slug);
      localStorage.setItem(CACHE_FULL, JSON.stringify({
        slug: state.slug, status: state.status, renewsAt: state.renewsAt, at: Date.now()
      }));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('ap:plan:ready', { detail: snapshot() }));
    readyResolve(snapshot());
  }

  function snapshot() {
    return { slug: state.slug, status: state.status, renewsAt: state.renewsAt, source: state.source,
             features: FEATURES[state.slug] || FEATURES.free };
  }

  async function load(force) {
    if (state.loaded && !force) return snapshot();
    try {
      var sb = await waitForClient(5000);
      if (!sb) { settle(state.slug, state.status, state.renewsAt, 'offline'); return snapshot(); }

      /* The fallback client carries no session by design, so "no user" from it
         means "we could not ask", not "signed out". Downgrading here would
         drop a paying user to free — and gate their own features — purely
         because the shared client was slow. Keep what we had. */
      if (sb.__apFallback) { settle(state.slug, state.status, state.renewsAt, 'offline'); return snapshot(); }

      var sess = await sb.auth.getSession();
      var user = sess && sess.data && sess.data.session && sess.data.session.user;
      if (!user) { settle('free', null, null, 'signed-out'); return snapshot(); }

      var res = await sb.from('profiles')
        .select('arowana_plan, arowana_plan_status, arowana_plan_renews_at, arowana_stripe_subscription_id')
        .eq('id', user.id).maybeSingle();
      if (res.error) {
        console.warn('[plan] lookup failed:', res.error.message);
        settle(state.slug, state.status, state.renewsAt, 'error');
        return snapshot();
      }
      var row = res.data || {};
      var slug = String(row.arowana_plan || 'free').toLowerCase();
      var status = row.arowana_plan_status || null;
      var renews = row.arowana_plan_renews_at || null;
      // Cancelled or incomplete subscriptions fall back to free.
      if (slug !== 'free' && status && !ACTIVE_STATUSES[status]) slug = 'free';
      // A plan with no Stripe subscription behind it is a comp (a tester or a
      // support gesture). Those carry an end date and must lapse on their own,
      // or a free trial quietly becomes free forever.
      if (slug !== 'free' && !row.arowana_stripe_subscription_id && renews) {
        var endsAt = Date.parse(renews);
        if (isFinite(endsAt) && endsAt < Date.now()) { slug = 'free'; status = 'expired'; }
      }
      settle(slug, status, renews, 'server');
    } catch (e) {
      console.warn('[plan] lookup threw:', e);
      settle(state.slug, state.status, state.renewsAt, 'error');
    }
    return snapshot();
  }

  window.AP_PLAN = {
    ready: function () { return readyPromise; },
    refresh: function () { return load(true); },
    slug: function () { return state.slug; },
    status: function () { return state.status; },
    renewsAt: function () { return state.renewsAt; },
    source: function () { return state.source; },
    isPaid: function () { return state.slug !== 'free'; },
    atLeast: function (tier) { return (ORDER[state.slug] || 0) >= (ORDER[tier] || 0); },
    can: function (feature) { return !!(FEATURES[state.slug] || FEATURES.free)[feature]; },
    features: function () { return Object.assign({}, FEATURES[state.slug] || FEATURES.free); },
    snapshot: snapshot,
    /* Locks a container for users below `tier`: dims it, blocks clicks, and
       drops an upgrade panel on top. Call again after re-rendering. */
    gate: function (el, tier, opts) {
      if (!el || this.atLeast(tier)) return false;
      opts = opts || {};
      if (el.querySelector(':scope > .ap-lock')) return true;
      el.style.position = el.style.position || 'relative';
      var wrap = document.createElement('div');
      wrap.className = 'ap-lock';
      wrap.setAttribute('role', 'note');
      wrap.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:24px;' +
        'background:rgba(248,250,252,.86);backdrop-filter:blur(2px);text-align:center';
      var name = tier === 'elite' ? 'Elite' : 'Pro';
      wrap.innerHTML =
        '<div style="max-width:380px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;box-shadow:0 8px 24px rgba(13,27,42,.10)">' +
          '<div style="font:700 1.05rem system-ui,sans-serif;color:#0f172a;margin-bottom:6px">' + (opts.title || (name + ' feature')) + '</div>' +
          '<p style="font:400 .88rem/1.5 system-ui,sans-serif;color:#64748b;margin:0 0 14px">' +
            (opts.body || ('This is part of the ' + name + ' plan. Your data stays exactly as it is — upgrading just unlocks the view.')) + '</p>' +
          '<a href="checkout.html?plan=' + (tier === 'elite' ? 'elite' : 'pro') + '&cycle=monthly" ' +
            'style="display:inline-block;background:#0b4f8a;color:#fff;border-radius:10px;padding:10px 18px;font:700 .88rem system-ui,sans-serif;text-decoration:none">' +
            'See ' + name + ' plans</a>' +
        '</div>';
      el.appendChild(wrap);
      return true;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { load(false); });
  } else { load(false); }
})();
