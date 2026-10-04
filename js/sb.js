/* ============================================================================
   sb.js — the ONE Supabase client for the page.
   ----------------------------------------------------------------------------
   Load it immediately after supabase_min.js, before any page script:

     <script src="./js/supabase_min.js?v=..."></script>
     <script src="./js/sb.js?v=..."></script>

   Why this file exists
   --------------------
   The client used to be built by app-config.js after an async config.json
   fetch. Until that finished there was no client, so pages and shared
   scripts each built their own. Several GoTrueClients in one tab all
   auto-refresh the same rotating refresh token; the loser gets
   "refresh token already used" and supabase-js wipes the stored session —
   signed-in users then see "Sign in" / 401 from Edge Functions.

   The URL and anon key are public by design (RLS protects the data), so
   there is nothing to wait for: the client is created synchronously here,
   and window.supabaseClient exists before any page script runs.

   Guard: window.supabase.createClient is wrapped so that any later call for
   this project that would share the session storage returns this client
   instead of creating a second one. Calls that opt out of the shared
   session (persistSession:false, or their own auth.storageKey — e.g. the
   read-only fallback in plan.js) pass through untouched.

   Ported from the Wheel repository (ATD-108 slice S1). In V2.0 this is the
   canonical copy of the public URL + anon key; app-config.js and
   supabase-init.js adopt the client built here.

   NEVER put a service-role key in this file.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__apSb) return;                    // safe if loaded twice

  var SB_URL = 'https://pbojacnagutipfhcxltj.supabase.co';
  var SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0';

  var lib = window.supabase;
  if (!lib || typeof lib.createClient !== 'function') {
    console.error('[sb] Supabase SDK not loaded — include ./js/supabase_min.js before ./js/sb.js');
    return;
  }

  var originalCreate = lib.createClient;
  var client = originalCreate.call(lib, SB_URL, SB_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  lib.createClient = function (url, key, opts) {
    var auth = (opts && opts.auth) || {};
    var sharesSession = auth.persistSession !== false && !auth.storageKey;
    if (url === SB_URL && sharesSession) {
      console.warn('[sb] createClient() called again — returning the shared client. Use window.supabaseClient instead.');
      return client;
    }
    return originalCreate.apply(lib, arguments);
  };

  window.__apSb = { url: SB_URL, anonKey: SB_ANON_KEY };
  window.supabaseClient = client;
  window.sbClient = client;
  window.GSClient = window.GSClient || {};
  window.GSClient.getAsync = function () { return Promise.resolve(client); };
})();
