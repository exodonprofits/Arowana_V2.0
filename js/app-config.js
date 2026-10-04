/**
 * Arowana Profits - Enhanced App Configuration
 * Integrates config.json with webhook configuration and Supabase authentication
 */

// Configuration loading
let APP_CONFIG = null;
let SUPABASE_CONFIG = null;

// Load configuration from config.json
// Path resolution order:
//   1. <meta name="gs-config" content="..."> tag on the page (preferred)
//   2. ./js/config.json  (relative to the current page)
//   3. ./config.json     (site root — legacy path, kept for safety)
// The first path that returns a 200 wins.
async function loadAppConfig() {
  // Build ordered list of candidate paths
  const metaTag = document.querySelector('meta[name="gs-config"]');
  const candidates = [];
  if (metaTag && metaTag.getAttribute('content')) {
    candidates.push(metaTag.getAttribute('content').trim());
  }
  candidates.push('./js/config.json', './config.json');

  // Try each path in order; remember the last error for reporting if all fail
  let lastError = null;
  for (const path of candidates) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        lastError = new Error(`Config load failed at ${path}: ${response.status}`);
        continue;
      }

      const config = await response.json();
      APP_CONFIG = config;
      SUPABASE_CONFIG = config.supabase;

      console.log('✅ Config loaded from', path, {
        version: config.version,
        supabase: !!config.supabase?.url,
        webhooks: Object.keys(config.webhooks || {}).length
      });

      return config;
    } catch (error) {
      lastError = error;
      // Network/parse error on this path — try the next candidate
    }
  }

  // All candidate paths failed — fall back to hardcoded config
  console.error('❌ Failed to load config.json from any path:', lastError);

  // Fallback configuration with real keys from config.json
  APP_CONFIG = {
    version: '1.2-fallback',
    supabase: {
      url: 'https://pbojacnagutipfhcxltj.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0'
    },
    webhooks: {
      morningBrief: 'https://exodonprofits.app.n8n.cloud/webhook/arowana-morning-scan'
    },
    app: {
      name: 'Arowana Profits',
      platform: 'GenieSphere'
    }
  };
  SUPABASE_CONFIG = APP_CONFIG.supabase;

  return APP_CONFIG;
}

// Enhanced authentication helper with Supabase integration
window.getAuthHeaders = function() {
  const user = JSON.parse(localStorage.getItem('gs_auth_user_v1') || '{}');
  const apiKeys = JSON.parse(localStorage.getItem('ap_user_api_keys') || '{}');
  
  return {
    'Content-Type': 'application/json',
    'X-User-ID': user.id || 'anonymous',
    'X-User-Plan': user.plan || 'free',
    'X-Finnhub-Key': apiKeys.finnhub || '',
    'X-Claude-Key': apiKeys.claude || '',
    'X-Alpha-Key': apiKeys.alphavantage || '',
    'X-Request-ID': generateRequestId()
  };
};

// Supabase authentication headers
window.getSupabaseHeaders = function() {
  if (!SUPABASE_CONFIG) {
    console.warn('Supabase config not loaded');
    return {};
  }
  
  // Synchronous, so it can't await a refresh: uses the latest token the
  // shared client reported (kept current by onAuthStateChange, including
  // TOKEN_REFRESHED). Never gs_auth_user_v1.access_token, which goes stale.
  return {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${_apLiveAccessToken || SUPABASE_CONFIG.anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };
};

// Supabase client helper
window.createSupabaseClient = function() {
  if (!SUPABASE_CONFIG) {
    throw new Error('Supabase config not loaded');
  }
  
  return {
    url: SUPABASE_CONFIG.url,
    key: SUPABASE_CONFIG.anonKey,
    // Getter, not a snapshot: this object is built once at init, so a
    // fixed headers value would keep sending the token from page load.
    get headers() { return getSupabaseHeaders(); },
    
    // Helper methods for common operations
    async get(table, query = '') {
      const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`Supabase GET failed: ${response.status}`);
      }
      
      return response.json();
    },
    
    async post(table, data) {
      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Supabase POST failed: ${response.status}`);
      }
      
      return response.json();
    },
    
    async patch(table, query, data) {
      const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
        method: 'PATCH',
        headers: { ...this.headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Supabase PATCH failed: ${response.status}`);
      }
      
      return response.json();
    },
    
    async delete(table, query) {
      const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
        method: 'DELETE',
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`Supabase DELETE failed: ${response.status}`);
      }
      
      return response.ok;
    }
  };
};

// Request ID generator
function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Production Webhook Configuration
const PRODUCTION_WEBHOOKS = {
  // Momentum Scanner Endpoints
  breakoutScanner: 'https://exodonprofits.app.n8n.cloud/webhook/momentum-breakout-scan',
  volumeScanner: 'https://hooks.n8n.io/webhook/momentum-volume-scan',
  gapScanner: 'https://hooks.n8n.io/webhook/momentum-gap-scan',
  hodScanner: 'https://hooks.n8n.io/webhook/momentum-hod-scan',
  fadeScanner: 'https://hooks.n8n.io/webhook/momentum-fade-scan',
  earningsScanner: 'https://hooks.n8n.io/webhook/momentum-earnings-scan',
  
  // Utility Endpoints
  marketStatus: 'https://exodonprofits.app.n8n.cloud/webhook/market-status',
  symbolLookup: 'https://hooks.n8n.io/webhook/symbol-lookup',
  bulkQuotes: 'https://hooks.n8n.io/webhook/bulk-quotes',
  
  // Analysis Endpoints
  chartAnalysis: 'https://hooks.n8n.io/webhook/chart-analysis',
  positionSizing: 'https://hooks.n8n.io/webhook/position-sizing',
  riskCalculation: 'https://hooks.n8n.io/webhook/risk-calculation',
  
  // Morning Brief (from config.json)
  morningBrief: 'https://exodonprofits.app.n8n.cloud/webhook/arowana-morning-scan'
};

// Environment detection
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('dev');

// Rate limiting configuration
const RATE_LIMITS = {
  production: {
    scanRequestsPerHour: 10,
    scanRequestsPerDay: 100,
    apiCallsPerScan: 50
  },
  development: {
    scanRequestsPerHour: 100,
    scanRequestsPerDay: 1000,
    apiCallsPerScan: 100
  }
};

// Cache configuration
const CACHE_CONFIG = {
  quotesTtl: 30000,        // 30 seconds
  profileTtl: 3600000,     // 1 hour
  scanResultsTtl: 300000   // 5 minutes
};

// Rate limiting helper
window.checkRateLimit = function(endpoint) {
  const rateLimits = isDevelopment ? RATE_LIMITS.development : RATE_LIMITS.production;
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  
  const usage = JSON.parse(localStorage.getItem('ap_rate_usage') || '{}');
  
  // Clean old entries
  usage.hourly = (usage.hourly || []).filter(timestamp => timestamp > now - hour);
  usage.daily = (usage.daily || []).filter(timestamp => timestamp > now - day);
  
  // Check limits
  if (usage.hourly.length >= rateLimits.scanRequestsPerHour) {
    return { allowed: false, reason: 'Hourly limit exceeded' };
  }
  
  if (usage.daily.length >= rateLimits.scanRequestsPerDay) {
    return { allowed: false, reason: 'Daily limit exceeded' };
  }
  
  // Record usage
  usage.hourly.push(now);
  usage.daily.push(now);
  localStorage.setItem('ap_rate_usage', JSON.stringify(usage));
  
  return { allowed: true };
};

// Enhanced webhook caller
//
// Accepts EITHER a webhook name to look up ('morningBrief') OR a full URL
// to call directly (e.g. what WH.alerts/WH.main getters resolve to in
// short-term-dashboard.html, arowana-trader.html, etc.). Both calling
// styles are already in use across pages that share this global, so this
// has to support both rather than picking one.
window.callWebhook = async function(endpoint, data) {
  try {
    const rateCheck = checkRateLimit(endpoint);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.reason);
    }
    
    const headers = getAuthHeaders();
    
    // Merge config.json webhooks with defaults
    const allWebhooks = { ...PRODUCTION_WEBHOOKS, ...(APP_CONFIG?.webhooks || {}) };
    const url = /^https?:\/\//i.test(endpoint) ? endpoint : allWebhooks[endpoint];
    
    if (!url) {
      throw new Error(`Webhook endpoint '${endpoint}' not configured`);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        ...data,
        timestamp: Date.now(),
        requestId: headers['X-Request-ID']
      })
    });
    
    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error(`Webhook call failed for ${endpoint}:`, error);
    throw error;
  }
};

// Cache helpers
window.getCachedData = function(key) {
  try {
    const item = localStorage.getItem(`ap_cache_${key}`);
    if (!item) return null;
    
    const cached = JSON.parse(item);
    if (Date.now() > cached.expires) {
      localStorage.removeItem(`ap_cache_${key}`);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
};

window.setCachedData = function(key, data, ttl = CACHE_CONFIG.quotesTtl) {
  try {
    const cached = {
      data: data,
      expires: Date.now() + ttl,
      created: Date.now()
    };
    
    localStorage.setItem(`ap_cache_${key}`, JSON.stringify(cached));
  } catch (error) {
    console.error('Cache write error:', error);
  }
};

// ============================================================
// USER API KEY HYDRATION
//
// Problem: The user saves their Finnhub/Claude/AlphaVantage keys on
// account.html, which writes to BOTH localStorage AND the Supabase
// `user_api_keys` table (via the Supabase JS SDK). Cross-device sync
// only works if the user opens account.html on the new device — every
// other page reads localStorage directly and finds it empty.
//
// Fix: hydrate localStorage from Supabase on every page load whenever
// the user is authenticated AND localStorage is empty. This makes any
// page that uses keys work on any device the user signs into.
//
// Strategy:
//   - localStorage already populated → no fetch, do nothing
//   - Authenticated + empty localStorage → fetch from user_api_keys
//   - Anonymous or no Supabase config → leave localStorage alone
//
// Emits `ap:keys:ready` event when hydration completes (or is skipped),
// so tools that need to wait for keys can listen rather than poll.
// ============================================================

const _AP_USER_KEYS_LS = 'ap_user_api_keys';
const _AP_USER_AUTH_LS = 'gs_auth_user_v1';

function _apGetAuthedUser() {
  try {
    const raw = localStorage.getItem(_AP_USER_AUTH_LS)
             || sessionStorage.getItem(_AP_USER_AUTH_LS);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.id ? u : null;
  } catch (e) { return null; }
}

function _apLocalStorageHasKeys() {
  try {
    const raw = localStorage.getItem(_AP_USER_KEYS_LS);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    return obj && Object.keys(obj).length > 0;
  } catch (e) { return false; }
}

// Fetch user's API keys from Supabase REST API directly, with the user's
// live access token from apGetAccessToken() (RLS handles authorization).
async function _apFetchKeysFromSupabase(user, cfg) {
  if (!user || !cfg || !cfg.url || !cfg.anonKey) return null;

  // Live token from the shared client (refreshes once if needed). This used
  // to send gs_auth_user_v1.access_token, written once at login and expired
  // within the hour — after that RLS saw no user and returned nothing.
  const token = await apGetAccessToken();
  if (!token) return null;

  const url = `${cfg.url}/rest/v1/user_api_keys?user_id=eq.${encodeURIComponent(user.id)}&select=service,api_key`;
  const headers = {
    'apikey': cfg.anonKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn('[hydrateUserKeys] Supabase returned', res.status);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return {};

    const keys = {};
    rows.forEach(row => {
      if (row.service && row.api_key) keys[row.service] = row.api_key;
    });
    return keys;
  } catch (e) {
    clearTimeout(timeout);
    console.warn('[hydrateUserKeys] fetch failed:', e.message || e);
    return null;
  }
}

// Module-level in-flight tracker. Concurrent calls to hydrateUserKeys()
// (e.g. one from initializeApp() and one from pcEnsureFinnhubKey() in
// portfolio-command.html, racing during page load) return the same promise
// instead of triggering duplicate Supabase fetches.
//
// Cleared after the in-flight resolves so a fresh call later in the session
// (e.g. after sign-in or after a manual sync trigger) still works.
let _apHydratePromise = null;

async function hydrateUserKeys() {
  // If a hydration is already running, wait on it instead of starting another
  if (_apHydratePromise) return _apHydratePromise;

  _apHydratePromise = (async () => {
    try {
      // Fast path: already have keys in localStorage
      if (_apLocalStorageHasKeys()) {
        window.AP_USER_KEYS = JSON.parse(localStorage.getItem(_AP_USER_KEYS_LS));
        window.dispatchEvent(new CustomEvent('ap:keys:ready', {
          detail: { source: 'localStorage', count: Object.keys(window.AP_USER_KEYS).length }
        }));
        return window.AP_USER_KEYS;
      }

      // Not authenticated → nothing to hydrate
      const user = _apGetAuthedUser();
      if (!user) {
        window.AP_USER_KEYS = {};
        window.dispatchEvent(new CustomEvent('ap:keys:ready', {
          detail: { source: 'anonymous', count: 0 }
        }));
        return {};
      }

      // Supabase config missing → can't hydrate
      if (!SUPABASE_CONFIG || !SUPABASE_CONFIG.url) {
        window.AP_USER_KEYS = {};
        window.dispatchEvent(new CustomEvent('ap:keys:ready', {
          detail: { source: 'no-config', count: 0 }
        }));
        return {};
      }

      // Authenticated + empty localStorage → fetch from Supabase
      console.log('🔑 Hydrating API keys from Supabase (new device or cleared cache)...');
      const keys = await _apFetchKeysFromSupabase(user, SUPABASE_CONFIG);

      if (keys && Object.keys(keys).length > 0) {
        localStorage.setItem(_AP_USER_KEYS_LS, JSON.stringify(keys));
        window.AP_USER_KEYS = keys;
        console.log('✅ API keys hydrated:', Object.keys(keys).join(', '));
        window.dispatchEvent(new CustomEvent('ap:keys:ready', {
          detail: { source: 'supabase', count: Object.keys(keys).length }
        }));
        return keys;
      }

      // Authenticated but no keys saved yet
      window.AP_USER_KEYS = {};
      window.dispatchEvent(new CustomEvent('ap:keys:ready', {
        detail: { source: 'supabase-empty', count: 0 }
      }));
      return {};
    } catch (err) {
      console.error('[hydrateUserKeys] Unexpected error:', err);
      window.AP_USER_KEYS = {};
      window.dispatchEvent(new CustomEvent('ap:keys:ready', {
        detail: { source: 'error', count: 0, error: err.message }
      }));
      return {};
    } finally {
      // Clear the in-flight handle so a *future* call (post-sign-in, manual
      // resync) can start a new hydration. We do NOT clear in the success
      // body — only after everything (including any catch-throwing) finishes.
      _apHydratePromise = null;
    }
  })();

  return _apHydratePromise;
}

// Expose so tools can manually re-hydrate (e.g. after sign-in)
window.hydrateUserKeys = hydrateUserKeys;

// ============================================================
// SHARED SUPABASE AUTH CLIENT
//
// Problem: login.html creates a real Supabase client with
// persistSession:true, but only as a local variable — it's never
// attached to `window`, so it dies the moment you navigate away.
// Downstream pages then each independently guessed a different global
// name for "the live, auto-refreshing client" and none of them ever
// existed:
//   - portfolio-command.html  looks for  window.supabaseClient
//   - journal-sync.js         looks for  window.sbClient (or builds
//                              its own if missing)
//   - auth-header.js          calls      window.GSClient.getAsync()
// With no live client anywhere, those pages fall back to the raw
// access_token cached once inside gs_auth_user_v1 at login time —
// which expires (~1hr, Supabase default) and is never refreshed,
// producing "Session expired" even though the user is still signed in.
//
// Fix: ONE real client, created synchronously by js/sb.js right after
// supabase_min.js (URL + anon key are public, so there is no reason to
// wait for config.json). This section adopts it, exposes it under all
// three names, and fires ap:client:ready for scripts that wait on it.
//
// NOTE: this is a different object from `window.SUPABASE` (all-caps)
// created below by createSupabaseClient() — that one is a lightweight
// manual REST wrapper (get/post/patch/delete helpers) using a possibly
// stale token. `window.supabaseClient` (this section) is the real
// @supabase/supabase-js client with auth.getSession()/refreshSession().
// ============================================================

let _apSharedClient = null;
// Latest access token the shared client has reported. Only for the
// synchronous getSupabaseHeaders(); async code should use apGetAccessToken().
let _apLiveAccessToken = null;

function _apExposeSharedClient(c) {
  _apSharedClient = c;
  try {
    c.auth.onAuthStateChange((_event, session) => {
      _apLiveAccessToken = (session && session.access_token) || null;
    });
  } catch (e) { /* older SDK without the event — headers fall back to anon */ }
  // Expose under every name other files in this app already look for.
  window.supabaseClient = c;      // portfolio-command.html
  window.sbClient       = c;      // journal-sync.js
  window.GSClient = window.GSClient || {};
  window.GSClient.getAsync = async () => c; // auth-header.js sign-out
  console.log('✅ Shared Supabase client ready (supabaseClient / sbClient / GSClient)');
  window.dispatchEvent(new CustomEvent('ap:client:ready', { detail: c }));
  return c;
}

async function initSharedSupabaseClient() {
  if (_apSharedClient) return _apSharedClient;

  // js/sb.js creates the one client synchronously, right after
  // supabase_min.js, so it normally exists before this runs. This file no
  // longer calls createClient() itself: it only adopts that client and
  // announces it (ap:client:ready) for scripts that wait on the event.
  // Poll briefly for pages whose script order puts sb.js later.
  //
  // ATD-108 S1 (V2.0): not every page loads sb.js yet. On a page without it
  // (no window.__apSb) this keeps the old behaviour and builds the client
  // here once the SDK is present, so those pages are no worse off than
  // before. Pages with sb.js never reach that branch.
  const deadline = Date.now() + 10_000;
  const fallbackAt = Date.now() + 1_000;
  for (;;) {
    const c = window.supabaseClient || window.sbClient;
    if (c && c.auth && typeof c.from === 'function') return _apExposeSharedClient(c);
    if (!window.__apSb && Date.now() > fallbackAt && SUPABASE_CONFIG && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey &&
        window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        return _apExposeSharedClient(window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        }));
      } catch (e) {
        console.warn('[shared-client] Failed to create fallback Supabase client:', e);
        return null;
      }
    }
    if (Date.now() > deadline) {
      console.warn('[shared-client] No Supabase client — load ./js/supabase_min.js then ./js/sb.js on this page.');
      return null;
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

// Expose for manual use / re-init if ever needed
window.initSharedSupabaseClient = initSharedSupabaseClient;

// Resolves to the shared client once it exists (or null after timeoutMs).
// With js/sb.js on the page this resolves immediately.
function apGetSupabaseClient(timeoutMs) {
  if (_apSharedClient) return Promise.resolve(_apSharedClient);
  // sb.js already built it (normal case): no need to wait for app-config.
  const ready = window.supabaseClient;
  if (ready && ready.auth && typeof ready.from === 'function') return Promise.resolve(ready);
  const ms = typeof timeoutMs === 'number' ? timeoutMs : 10000;
  return new Promise((resolve) => {
    let done = false;
    const finish = (c) => {
      if (done) return;
      done = true;
      window.removeEventListener('ap:client:ready', onReady);
      resolve(c || null);
    };
    const onReady = () => finish(_apSharedClient);
    window.addEventListener('ap:client:ready', onReady);
    setTimeout(() => finish(_apSharedClient), ms);
  });
}
window.apGetSupabaseClient = apGetSupabaseClient;

// ============================================================
// SHARED ACCESS-TOKEN HELPER
//
// The one place pages get a user JWT for Edge Functions
// (arowana-research, arowana-ai-coach, ...). Never read tokens from
// localStorage — the cached copy in gs_auth_user_v1 is written once at
// login and goes stale within the hour.
//
//   const token = await window.apGetAccessToken();
//   if (!token) -> the user really is signed out (session AND refresh
//                  both came back empty), safe to say "Sign in".
//
// Pass { forceRefresh: true } after an Edge Function answers 401 to
// swap in a fresh token and retry once.
//
// Refreshes are single-flight: parallel callers share one
// refreshSession() call. Refresh tokens rotate, so two concurrent
// refreshes with the same token make the second one fail and
// supabase-js then signs the user out.
// ============================================================

let _apRefreshPromise = null;

function _apHasCachedUser() {
  return !!_apGetAuthedUser();
}

function _apRefreshOnce(client) {
  if (_apRefreshPromise) return _apRefreshPromise;
  _apRefreshPromise = (async () => {
    try {
      const { data, error } = await client.auth.refreshSession();
      if (error) console.warn('[auth-token] refreshSession failed:', error.message || error);
      return (data && data.session && data.session.access_token) || null;
    } catch (e) {
      console.warn('[auth-token] refreshSession threw:', e);
      return null;
    } finally {
      _apRefreshPromise = null;
    }
  })();
  return _apRefreshPromise;
}

async function apGetAccessToken(opts) {
  const forceRefresh = !!(opts && opts.forceRefresh);
  const client = await apGetSupabaseClient();
  if (!client || !client.auth) return null;

  if (!forceRefresh) {
    try {
      const { data } = await client.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (token) return token;
    } catch (e) {
      console.warn('[auth-token] getSession threw:', e);
    }
    // No session and no sign of a login on this device: signed out.
    if (!_apHasCachedUser()) return null;
  }

  return _apRefreshOnce(client);
}
window.apGetAccessToken = apGetAccessToken;

// Initialize configuration
async function initializeApp() {
  console.log('🚀 Initializing Arowana Profits with config.json integration...');
  
  try {
    // Load config.json first
    await loadAppConfig();
    
    // Create combined configuration
    const mergedWebhooks = { ...PRODUCTION_WEBHOOKS, ...(APP_CONFIG?.webhooks || {}) };
    
    // Reserved top-level keys on AP_WEBHOOKS that webhook names must not
    // shadow. If config.json defines a webhook called "supabase" or "cache",
    // we'd accidentally overwrite the actual config object. Filter those out.
    const AP_RESERVED_KEYS = new Set([
      'version', 'supabase', 'webhooks', 'apis',
      'rateLimits', 'cache', 'app'
    ]);
    const safeWebhooks = {};
    for (const k of Object.keys(mergedWebhooks)) {
      if (AP_RESERVED_KEYS.has(k)) {
        console.warn(`[config] Webhook name "${k}" is reserved — only available via AP_WEBHOOKS.webhooks.${k}`);
        continue;
      }
      safeWebhooks[k] = mergedWebhooks[k];
    }

    const AP_WEBHOOKS = {
      version: APP_CONFIG?.version || '1.2',
      supabase: SUPABASE_CONFIG,
      // Spread the merged webhooks at the TOP LEVEL so consumers can read
      // them as AP_WEBHOOKS.lt_main, AP_WEBHOOKS.morning_brief, etc.
      // This matches the convention used throughout portfolio-command.html
      // and trading-command.html. The `webhooks` sub-object is also kept
      // for backward compatibility with any code reading the nested form.
      ...safeWebhooks,
      webhooks: mergedWebhooks,
      apis: {
        finnhub: {
          baseUrl: 'https://finnhub.io/api/v1',
          rateLimit: {
            requestsPerMinute: 60,
            requestsPerDay: 30000
          }
        },
        alphavantage: {
          baseUrl: 'https://www.alphavantage.co/query',
          rateLimit: {
            requestsPerMinute: 5,
            requestsPerDay: 500
          }
        }
      },
      rateLimits: isDevelopment ? RATE_LIMITS.development : RATE_LIMITS.production,
      cache: CACHE_CONFIG,
      app: APP_CONFIG?.app || {}
    };
    
    // Make available globally
    window.AP_WEBHOOKS = AP_WEBHOOKS;
    window.AP_CONFIG = AP_WEBHOOKS; // Backward compatibility
    window.SUPABASE = createSupabaseClient();

    // Build the shared auth client BEFORE announcing config. Listeners of
    // ap:config:ready (risk.js, arowana-trader, trading-command...) used to
    // find AP_WEBHOOKS.supabase set but no client yet, and each built its
    // own — several GoTrueClients racing to refresh the same token. When
    // the SDK is already loaded this creates the client synchronously
    // (no await is hit before createClient); otherwise it polls in the
    // background and pages wait on ap:client:ready / apGetSupabaseClient().
    initSharedSupabaseClient().catch(err => {
      console.warn('[init] Shared Supabase client init encountered an issue:', err);
    });
    
    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('ap:config:ready', { 
      detail: AP_WEBHOOKS 
    }));
    
    console.log('✅ Arowana Profits initialized:', {
      environment: isDevelopment ? 'development' : 'production',
      supabase: !!SUPABASE_CONFIG?.url,
      webhooks: Object.keys(mergedWebhooks).length,
      version: AP_WEBHOOKS.version,
      supabaseKey: SUPABASE_CONFIG?.anonKey ? 'loaded' : 'missing'
    });

    // After config is ready, hydrate user API keys from Supabase if needed.
    // Runs in background — does NOT block ap:config:ready. Tools that need
    // keys can either:
    //   (a) listen for the `ap:keys:ready` event, or
    //   (b) fall back to reading localStorage directly (works after hydration completes)
    hydrateUserKeys().catch(err => {
      console.warn('[init] Key hydration encountered an issue:', err);
    });

    
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export for manual initialization if needed
window.initializeApp = initializeApp;
