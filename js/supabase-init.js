// /js/supabase-init.js  (ES module)
// Uses local UMD build: /js/supabase.min.js (no CDN, avoids Tracking Prevention & esm.sh outages)

export const SUPABASE_URL = "https://pbojacnagutipfhcxltj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0";

/** Load the local Supabase UMD library if it's not already present. */
async function ensureSupabaseUMD(src = "./js/supabase.min.js") {
  if (window.supabase && typeof window.supabase.createClient === "function") return window.supabase;

  await new Promise((resolve, reject) => {
    // Avoid double-inject
    const existing = document.querySelector('script[data-gs-supabase-umd="1"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load " + src)), { once: true });
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.setAttribute("data-gs-supabase-umd", "1");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase UMD loaded but window.supabase.createClient is missing.");
  }
  return window.supabase;
}

const { createClient } = await ensureSupabaseUMD();

/** ───────────────────────────────────────────────────────────────────
 *  2) Client with session persistence
 *  ─────────────────────────────────────────────────────────────────── */
export const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handle magic-link / OAuth redirects
  },
});

// Back-compat exports (older pages may import `supabase`)
export const supabase = client;
export const sb = client;
export default client;

/** ───────────────────────────────────────────────────────────────────
 *  3) Auth helpers
 *  ─────────────────────────────────────────────────────────────────── */

/** Send a passwordless magic-link (OTP) to email. */
export async function signInWithOtp(email, { redirectTo } = {}) {
  const url = redirectTo ?? window.location.origin + window.location.pathname;
  return await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: url },
  });
}

/** Start OAuth (e.g., 'google', 'github'). */
export async function signInWithOAuth(provider, { redirectTo } = {}) {
  const url = redirectTo ?? window.location.origin + window.location.pathname;
  return await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: url },
  });
}

/** Sign out (clears local session). */
export async function signOut() {
  return await client.auth.signOut();
}

/** Get current session (access/refresh tokens) if any. */
export async function getSession() {
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

/** Get current user (or null). */
export async function getUser() {
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

/** Require auth (redirects if not logged in). */
export async function requireAuth(redirect = "/login.html") {
  const user = await getUser();
  if (user) return user;
  const next = encodeURIComponent(location.pathname + location.search);
  location.replace(`${redirect}?next=${next}`);
  return null;
}

/** Subscribe to auth state changes. */
export function onAuthChanged(callback) {
  const { data: sub } = client.auth.onAuthStateChange((event, session) => {
    callback({ event, session });
  });
  return () => sub.subscription.unsubscribe();
}

/** ───────────────────────────────────────────────────────────────────
 *  4) Redirect/session recovery on load
 *  ─────────────────────────────────────────────────────────────────── */
async function handleReturnUrl() {
  try {
    const hash = new URL(window.location.href).hash || "";
    const qs = new URL(window.location.href).searchParams;

    const err = qs.get("error") || (hash.includes("error=") ? new URLSearchParams(hash.slice(1)).get("error") : null);
    const errDesc = qs.get("error_description") || (hash.includes("error_description=") ? new URLSearchParams(hash.slice(1)).get("error_description") : null);

    if (err) {
      console.warn("Auth redirect error:", err, errDesc || "");
    }

    if (hash.includes("access_token") || hash.includes("refresh_token") || hash.includes("type=")) {
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  } catch (e) {
    console.debug("Auth return handling skipped:", e);
  }
}

handleReturnUrl();

/** Utility: build redirect relative to current folder */
export function buildRedirect(next = "trip-dashboard.html") {
  const { origin, pathname } = window.location;
  const base = pathname.slice(0, pathname.lastIndexOf("/") + 1);
  return origin + base + next;
}
