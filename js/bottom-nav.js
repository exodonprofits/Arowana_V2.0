/**
 * Salon Genie — Shared Bottom Navigation
 *
 * Renders a mobile bottom nav bar that auto-detects the active tab
 * based on the current page URL. Supports per-user customization:
 * each role has a pool of available tabs; users can pick which 5 to show.
 *
 * Preferences are stored in auth.user_metadata.bottom_nav[product].
 * This keeps settings isolated per GenieSphere product so the same user
 * can have different nav preferences in Salon Genie vs Rental Genie etc.
 *
 * USAGE:
 *
 *   <script src="/shared/js/bottom-nav.js"></script>
 *   <script>
 *     // Simple preset (defaults to product='salon'):
 *     SGBottomNav.render('tech');
 *
 *     // Other products:
 *     SGBottomNav.render('tech', { product: 'rental' });
 *
 *     // With explicit Supabase client (needed for customization):
 *     SGBottomNav.render('tech', { sg: supabaseClient });
 *
 *     // Or custom tabs (no customization support for ad-hoc tabs):
 *     SGBottomNav.render({
 *       tabs: [
 *         { icon: '💅', label: 'Queue', href: 'technician-dashboard.html' },
 *         ...
 *       ]
 *     });
 *   </script>
 *
 * Presets (Salon Genie):
 *   - 'tech'      → Queue, Shifts, Clock, Tasks, Tips           (technicians)
 *   - 'reception' → Check-In, Bookings, POS, Reception, Tasks   (front desk)
 *   - 'manager'   → Home, Schedule, POS, Staff, Tasks           (managers)
 *   - 'owner'     → Home, Bookings, Schedule, Inventory, Tips   (owners)
 *   - 'staff'     → alias of 'tech' (legacy, still works)
 *
 * Customization API:
 *   SGBottomNav.getPool(role)            → full list of tabs for a role
 *   SGBottomNav.getDefaultOrder(role)    → default 5 tab keys
 *   SGBottomNav.loadPrefs(sg, product)   → user's saved tab keys (or null)
 *   SGBottomNav.savePrefs(sg, product, role, tabKeys) → persist to auth
 *
 * Notes:
 *   - Nav always shows exactly 5 tabs (enforced in validation)
 *   - Only shows on screens <= 900px wide (mobile + small tablet).
 *     Matches the width at which the page shells hide their top nav.
 *   - Safe to call multiple times (idempotent)
 */
(function () {
  'use strict';

  const MAX_TABS = 5;
  const DEFAULT_PRODUCT = 'salon';

  // ── Design tokens (aligned with Salon Genie design system) ──
  const TOKENS = {
    bg: '#FFFFFF',
    border: 'rgba(0,0,0,0.07)',
    muted: '#A89A8E',
    blush: '#C4856A',
    blushDim: 'rgba(196,133,106,0.12)',
  };

  // ── AVAILABLE TABS per role ──
  // Full pool each role can pick from. Users pick exactly 5.
  const AVAILABLE_TABS = {
    tech: {
      queue:    { icon: '💅', label: 'Queue',  href: 'technician-dashboard.html' },
      shifts:   { icon: '📅', label: 'Shifts', href: 'staff-shift.html', matches: ['staff-dashboard.html'] },
      clock:    { icon: '⏱',  label: 'Clock',  href: 'my-clockin.html',  matches: ['staff-clockin.html'] },
      tasks:    { icon: '📋', label: 'Tasks',  href: 'my-tasks.html' },
      tips:     { icon: '💸', label: 'Tips',   href: 'my-tips.html' },
      account:  { icon: '👤', label: 'Profile',href: 'account.html' },
    },
    reception: {
      checkin:    { icon: '✅', label: 'Check-In',  href: 'checkin-kiosk.html', matches: ['check-in.html', 'check-in-queue.html'] },
      chores:     { icon: '🎡', label: 'Chores',    href: 'daily-chores-spinner.html' },
      colors:     { icon: '🎨', label: 'Colors',    href: 'color-inventory.html' },
      recommend:  { icon: '✨', label: 'Recommend', href: 'color-recommendor.html' },
      tasks:      { icon: '📋', label: 'Tasks',     href: 'my-tasks.html' },
      bookings:   { icon: '📅', label: 'Bookings',  href: 'bookings.html', matches: ['book.html', 'appointments.html', 'appointment.html'] },
      pos:        { icon: '🧾', label: 'POS',       href: 'pos.html', matches: ['view-ticket.html'] },
      reception:  { icon: '💬', label: 'Reception', href: 'reception.html', matches: ['messages.html'] },
      clock:      { icon: '⏱',  label: 'Clock',     href: 'my-clockin.html' },
      account:    { icon: '👤', label: 'Profile',   href: 'account.html' },
    },
    manager: {
      home:       { icon: '🏠', label: 'Home',      href: 'salon-dashboard.html' },
      schedule:   { icon: '📅', label: 'Schedule',  href: 'salon-staff-agent.html', matches: ['staff-shift.html'] },
      pos:        { icon: '🧾', label: 'POS',       href: 'pos.html', matches: ['view-ticket.html'] },
      staff:      { icon: '👥', label: 'Staff',     href: 'manage-employees.html' },
      tasks:      { icon: '📋', label: 'Tasks',     href: 'my-tasks.html' },
      payroll:    { icon: '💰', label: 'Payroll',   href: 'salon-payroll-agent.html' },
      inventory:  { icon: '📦', label: 'Inventory', href: 'salon-inventory-agent.html', matches: ['inventory-catalog.html'] },
      tips:       { icon: '💸', label: 'Tips',      href: 'manage-tips.html' },
      account:    { icon: '👤', label: 'Profile',   href: 'account.html' },
    },
    owner: {
      home:       { icon: '🏠', label: 'Home',      href: 'salon-dashboard.html' },
      bookings:   { icon: '📅', label: 'Bookings',  href: 'bookings.html', matches: ['book.html', 'appointments.html', 'appointment.html'] },
      pos:        { icon: '🧾', label: 'POS',       href: 'pos.html', matches: ['view-ticket.html'] },
      inventory:  { icon: '📦', label: 'Inventory', href: 'salon-inventory-agent.html', matches: ['inventory-catalog.html'] },
      tips:       { icon: '💸', label: 'Tips',      href: 'manage-tips.html' },
      employees:  { icon: '👥', label: 'Employees', href: 'manage-employees.html' },
      payroll:    { icon: '💰', label: 'Payroll',   href: 'salon-payroll-agent.html' },
      schedule:   { icon: '📅', label: 'Schedule',  href: 'salon-staff-agent.html' },
      account:    { icon: '👤', label: 'Profile',   href: 'account.html' },
    },
  };

  // ── DEFAULT ORDER — which 5 keys show by default for each role ──
  const DEFAULT_ORDER = {
    tech:      ['queue', 'shifts', 'clock', 'tasks', 'tips'],
    reception: ['checkin', 'chores', 'colors', 'recommend', 'tasks'],
    manager:   ['home', 'schedule', 'pos', 'staff', 'tasks'],
    owner:     ['home', 'bookings', 'schedule', 'inventory', 'tips'],
  };

  // Backwards-compat alias: 'staff' means 'tech'
  AVAILABLE_TABS.staff = AVAILABLE_TABS.tech;
  DEFAULT_ORDER.staff = DEFAULT_ORDER.tech;

  // ══════════════════════════════════════════════════════════════
  // STYLE INJECTION (once per page)
  // ══════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('sg-bottom-nav-styles')) return;
    const css = `
      .sg-bnav {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
        background: ${TOKENS.bg};
        border-top: 1px solid ${TOKENS.border};
        box-shadow: 0 -2px 14px rgba(28,24,20,.08);
        display: none;
        font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      @media (max-width: 900px) {
        .sg-bnav { display: block; }
        body.sg-bnav-padded { padding-bottom: 72px; }
        /* Auto-hide page footer on mobile when the bottom nav is active.
           The bottom nav visually replaces the footer on small screens. */
        .site-footer,
        footer.site-footer,
        .page-footer,
        footer.page-footer { display: none !important; }
      }
      .sg-bnav-inner {
        display: flex;
        justify-content: space-around;
        padding: 6px 4px env(safe-area-inset-bottom, 6px);
        max-width: 520px;
        margin: 0 auto;
        gap: 2px;
      }
      .sg-bnav-item {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        padding: 6px 4px;
        min-width: 52px;
        flex: 1;
        text-decoration: none;
        color: ${TOKENS.muted};
        font-size: 10px;
        font-weight: 500;
        border-radius: 10px;
        transition: color .15s, background .15s, transform .1s;
        -webkit-tap-highlight-color: transparent;
      }
      .sg-bnav-item:hover { color: ${TOKENS.blush}; }
      .sg-bnav-item:active { transform: scale(0.95); }
      .sg-bnav-item.active { color: ${TOKENS.blush}; background: ${TOKENS.blushDim}; }
      .sg-bnav-ico { font-size: 18px; line-height: 1; }
      .sg-bnav-label { font-family: inherit; }
    `;
    const style = document.createElement('style');
    style.id = 'sg-bottom-nav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ══════════════════════════════════════════════════════════════
  // URL MATCHING
  // ══════════════════════════════════════════════════════════════
  function getCurrentFilename() {
    const path = window.location.pathname || '';
    const seg = path.split('/').filter(Boolean).pop() || 'index.html';
    return seg.toLowerCase();
  }

  function isTabActive(tab, currentFile) {
    const primary = (tab.href || '').toLowerCase();
    if (primary === currentFile) return true;
    if (Array.isArray(tab.matches)) {
      return tab.matches.some(m => String(m || '').toLowerCase() === currentFile);
    }
    return false;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ══════════════════════════════════════════════════════════════
  // PREFERENCES (via auth.user_metadata.bottom_nav[product])
  // ══════════════════════════════════════════════════════════════
  /**
   * Load saved tab keys for this user/product.
   * @returns {Promise<string[]|null>}  array of 5 keys, or null if no prefs saved
   */
  async function loadPrefs(sg, product) {
    if (!sg?.auth?.getUser) return null;
    try {
      const { data } = await sg.auth.getUser();
      const meta = data?.user?.user_metadata || {};
      const navRoot = meta.bottom_nav || {};
      const forProduct = navRoot[product || DEFAULT_PRODUCT];
      if (Array.isArray(forProduct) && forProduct.length === MAX_TABS) {
        return forProduct.slice();
      }
    } catch (_) {}
    return null;
  }

  /**
   * Save tab keys for this user/product. Validates role/pool before writing.
   * @returns {Promise<{ok: boolean, error?: string, saved?: string[]}>}
   */
  async function savePrefs(sg, product, role, tabKeys) {
    if (!sg?.auth?.updateUser) {
      return { ok: false, error: 'No auth client available' };
    }
    const validation = validateTabKeys(role, tabKeys);
    if (!validation.ok) return validation;

    try {
      // Load current metadata, merge our namespaced key, write back
      const { data: currentData } = await sg.auth.getUser();
      const currentMeta = currentData?.user?.user_metadata || {};
      const currentNav  = currentMeta.bottom_nav || {};
      const newNav      = { ...currentNav, [product || DEFAULT_PRODUCT]: validation.keys };

      const { error } = await sg.auth.updateUser({
        data: { bottom_nav: newNav }
      });
      if (error) throw error;
      return { ok: true, saved: validation.keys };
    } catch (err) {
      return { ok: false, error: err?.message || 'Save failed' };
    }
  }

  /**
   * Check a candidate tab-key list is valid for a role.
   * - Must be an array of exactly MAX_TABS keys
   * - Each key must exist in the role's pool
   * - No duplicates
   */
  function validateTabKeys(role, tabKeys) {
    const pool = AVAILABLE_TABS[role];
    if (!pool) return { ok: false, error: `Unknown role: ${role}` };
    if (!Array.isArray(tabKeys)) return { ok: false, error: 'tabKeys must be an array' };
    if (tabKeys.length !== MAX_TABS) {
      return { ok: false, error: `Must pick exactly ${MAX_TABS} tabs (got ${tabKeys.length})` };
    }
    const seen = new Set();
    for (const k of tabKeys) {
      if (!pool[k]) return { ok: false, error: `Tab "${k}" not in ${role} pool` };
      if (seen.has(k)) return { ok: false, error: `Duplicate tab: ${k}` };
      seen.add(k);
    }
    return { ok: true, keys: tabKeys.slice() };
  }

  /** Get the full pool of tabs available for a role (for settings UIs). */
  function getPool(role) {
    const pool = AVAILABLE_TABS[role] || {};
    return Object.entries(pool).map(([key, tab]) => ({ key, ...tab }));
  }

  /** Get the default 5 tab keys for a role. */
  function getDefaultOrder(role) {
    return (DEFAULT_ORDER[role] || []).slice();
  }

  // Resolve a saved key list into hydrated tab objects (for rendering)
  function resolveTabs(role, tabKeys) {
    const pool = AVAILABLE_TABS[role] || {};
    return tabKeys.map(k => pool[k]).filter(Boolean);
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  /**
   * render(preset, opts)
   *   preset: 'tech' | 'reception' | 'manager' | 'owner' | 'staff'
   *   opts:   { sg?, product? }
   *
   * render({ tabs: [...] }, opts)  — ad-hoc custom tabs (no customization)
   */
  async function render(config, opts) {
    opts = opts || {};
    const product = opts.product || DEFAULT_PRODUCT;
    const sg      = opts.sg || window.sg || null;

    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    injectStyles();

    let tabs;
    let role = null;

    if (typeof config === 'string') {
      role = config;
      const pool = AVAILABLE_TABS[role];
      if (!pool) {
        console.warn(`[SGBottomNav] Unknown preset: "${role}"`);
        return;
      }
      // 1. Try user's saved prefs for this product
      let keys = null;
      if (sg) {
        try { keys = await loadPrefs(sg, product); } catch (_) {}
        // Defensive: if saved keys reference tabs no longer in the pool, fall back
        if (keys) {
          const bad = keys.filter(k => !pool[k]);
          if (bad.length || keys.length !== MAX_TABS) keys = null;
        }
      }
      // 2. Fall back to role defaults
      if (!keys) keys = DEFAULT_ORDER[role] || [];
      tabs = resolveTabs(role, keys);
    } else if (config && Array.isArray(config.tabs)) {
      tabs = config.tabs;
    } else {
      console.warn('[SGBottomNav] render() requires a preset name or { tabs: [...] }');
      return;
    }

    // Remove any previous nav (idempotent)
    const existing = document.getElementById('sgBottomNav');
    if (existing) existing.remove();

    const currentFile = getCurrentFilename();

    const nav = document.createElement('nav');
    nav.className = 'sg-bnav';
    nav.id = 'sgBottomNav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Bottom navigation');

    const inner = document.createElement('div');
    inner.className = 'sg-bnav-inner';

    tabs.forEach(tab => {
      const a = document.createElement('a');
      a.className = 'sg-bnav-item' + (isTabActive(tab, currentFile) ? ' active' : '');
      a.href = tab.href || '#';
      a.innerHTML = `
        <div class="sg-bnav-ico">${esc(tab.icon || '•')}</div>
        <div class="sg-bnav-label">${esc(tab.label || '')}</div>
      `;
      if (tab.ariaLabel) a.setAttribute('aria-label', tab.ariaLabel);
      inner.appendChild(a);
    });

    nav.appendChild(inner);
    document.body.appendChild(nav);
    document.body.classList.add('sg-bnav-padded');
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════
  window.SGBottomNav = {
    render,
    loadPrefs,
    savePrefs,
    getPool,
    getDefaultOrder,
    validateTabKeys,
    // exposed for debugging/customization
    AVAILABLE_TABS,
    DEFAULT_ORDER,
    MAX_TABS,
  };
})();
