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
  
  const user = JSON.parse(localStorage.getItem('gs_auth_user_v1') || '{}');
  
  return {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${user.access_token || SUPABASE_CONFIG.anonKey}`,
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
    headers: getSupabaseHeaders(),
    
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

// Fetch user's API keys from Supabase REST API directly.
// We use raw fetch (not the Supabase JS SDK) because app-config.js doesn't
// load the SDK — only account.html does. The raw REST call works with
// just the anon key + the user's access_token (RLS handles authorization).
async function _apFetchKeysFromSupabase(user, cfg) {
  if (!user || !cfg || !cfg.url || !cfg.anonKey) return null;

  const url = `${cfg.url}/rest/v1/user_api_keys?user_id=eq.${encodeURIComponent(user.id)}&select=service,api_key`;
  const headers = {
    'apikey': cfg.anonKey,
    'Authorization': `Bearer ${user.access_token || cfg.anonKey}`,
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
// Fix: create ONE real client here, as soon as the Supabase SDK and
// config are both available, and expose it under all three names so
// every page that already expects one of them just starts working.
// No changes needed in the pages themselves.
//
// NOTE: this is a different object from `window.SUPABASE` (all-caps)
// created below by createSupabaseClient() — that one is a lightweight
// manual REST wrapper (get/post/patch/delete helpers) using a possibly
// stale token. `window.supabaseClient` (this section) is the real
// @supabase/supabase-js client with auth.getSession()/refreshSession().
// ============================================================

let _apSharedClient = null;

async function initSharedSupabaseClient() {
  if (_apSharedClient) return _apSharedClient;
  if (!SUPABASE_CONFIG || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return null;

  // The SDK (window.supabase, from whichever <script> tag the host page
  // uses — supabase_min.js, the unpkg CDN build, etc.) may not have
  // loaded yet relative to this script. Poll briefly rather than assume
  // an order that isn't guaranteed across pages.
  const deadline = Date.now() + 10_000;
  while (!(window.supabase && typeof window.supabase.createClient === 'function')) {
    if (Date.now() > deadline) {
      console.warn('[shared-client] Supabase SDK never loaded — pages relying on window.supabaseClient will fall back to cached tokens.');
      return null;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  try {
    _apSharedClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (e) {
    console.warn('[shared-client] Failed to create shared Supabase client:', e);
    return null;
  }

  // Expose under every name other files in this app already look for.
  window.supabaseClient = _apSharedClient;      // portfolio-command.html
  window.sbClient       = _apSharedClient;      // journal-sync.js
  window.GSClient = window.GSClient || {};
  window.GSClient.getAsync = async () => _apSharedClient; // auth-header.js sign-out

  console.log('✅ Shared Supabase client ready (supabaseClient / sbClient / GSClient)');
  window.dispatchEvent(new CustomEvent('ap:client:ready', { detail: _apSharedClient }));
  return _apSharedClient;
}

// Expose for manual use / re-init if ever needed
window.initSharedSupabaseClient = initSharedSupabaseClient;

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
        claude: {
          baseUrl: 'https://api.anthropic.com/v1',
          model: 'claude-3-sonnet-20240229'
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

    // Also runs in background — does NOT block ap:config:ready. Pages that
    // need the live client should listen for `ap:client:ready`, or just
    // read window.supabaseClient (it'll be null until this resolves).
    initSharedSupabaseClient().catch(err => {
      console.warn('[init] Shared Supabase client init encountered an issue:', err);
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
