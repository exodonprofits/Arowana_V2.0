/**
 * arowana-nav.js — signed-in navigation renderer (ATD-008, slice 1)
 * ============================================================
 * Renders window.ArowanaNavRegistry (js/arowana-nav-registry.js) as:
 *   - the desktop rail inside #railMount, reusing the page's existing
 *     .rail-* styles so it looks like the rail it replaces;
 *   - a mobile bottom bar: Command, Watchlists, Portfolio, Journal, More;
 *   - a "More" sheet holding Research, Strategy Desks and utilities.
 *
 * Rules this file keeps (see docs/ATD-008_NAVIGATION_IMPLEMENTATION_SPEC.md):
 *   - DOM is built with document.createElement / textContent only. No
 *     innerHTML with data, no inline event handlers.
 *   - Links come only from the registry and must be plain same-origin
 *     *.html file names. Nothing is read from the current query string
 *     except to decide which entry is current.
 *   - Active state matches exact file names. No hyphen/underscore
 *     folding: tradingcommand.html is not trading-command.html.
 *   - The nav never touches history (no pushState/replaceState).
 *   - Navigation is presentation only. Hiding or showing an entry is not
 *     access control; cached plan/user values only change display text.
 *
 * Loaded only on pages that opted in. During slice 1 that is tools.html,
 * and only when localStorage "ap_nav_v2" is "1"; otherwise the page keeps
 * loading js/nav-rail.js.
 */
(function () {
  'use strict';

  var REG = window.ArowanaNavRegistry;
  if (!REG || !REG.entries) {
    console.error('[arowana-nav] registry missing; load js/arowana-nav-registry.js first.');
    return;
  }

  var COLLAPSE_KEY = 'ap_rail_collapsed_v1';   // shared with nav-rail.js
  var MOBILE_MAX = 768;                         // matches existing breakpoint
  var SAFE_PATH = /^[a-z0-9][a-z0-9_\-]*\.html$/;
  var SAFE_VALUE = /^[a-z0-9_\-]+$/i;

  var PLAN_LABELS = { free: 'Free plan', pro: 'Pro plan', elite: 'Elite plan', founders: 'Founding Member' };

  /* ── Small DOM helpers ─────────────────────────────────────────── */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'className') node.className = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_) { /* private mode */ }
  }

  /* ── Registry access and validation ────────────────────────────── */

  var byId = {};
  var childrenOf = {};
  var primaries = [];

  function validRoute(route) {
    if (!route || typeof route.path !== 'string' || !SAFE_PATH.test(route.path)) return false;
    var q = route.query || {};
    return Object.keys(q).every(function (k) {
      return SAFE_VALUE.test(k) && typeof q[k] === 'string' && SAFE_VALUE.test(q[k]);
    });
  }

  REG.entries.forEach(function (e) {
    if (e.route && !validRoute(e.route)) {
      console.error('[arowana-nav] entry "' + e.id + '" has an unsafe route and was skipped.');
      return;
    }
    byId[e.id] = e;
    if (e.parent) (childrenOf[e.parent] = childrenOf[e.parent] || []).push(e);
    else primaries.push(e);
  });

  function hrefFor(route) {
    var q = route.query || {};
    var keys = Object.keys(q);
    if (!keys.length) return route.path;
    return route.path + '?' + keys.map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]);
    }).join('&');
  }

  function depth(e) {
    var d = 0;
    while (e && e.parent) { d++; e = byId[e.parent]; }
    return d;
  }

  function ancestors(e) {
    var list = [];
    while (e && e.parent) { e = byId[e.parent]; if (e) list.push(e); }
    return list;
  }

  /* ── Active-state resolution ───────────────────────────────────── */

  function currentLocation() {
    var path = (window.location.pathname || '').split('/').pop().toLowerCase() || 'index.html';
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { params = null; }
    var hash = (window.location.hash || '').replace(/^#/, '');
    return { path: path, params: params, hash: hash || null };
  }

  function paramValue(loc, key) {
    return loc.params ? loc.params.get(key) : null;
  }

  // Score how specifically a rule matches; -1 when it does not match.
  function ruleScore(rule, loc) {
    if (!rule || rule.path !== loc.path) return -1;
    var score = 1;
    var q = rule.query || {};
    var keys = Object.keys(q);
    for (var i = 0; i < keys.length; i++) {
      var allowed = Array.isArray(q[keys[i]]) ? q[keys[i]] : [q[keys[i]]];
      if (allowed.indexOf(paramValue(loc, keys[i])) === -1) return -1;
      score++;
    }
    if (rule.hash) {
      if (rule.hash.indexOf(loc.hash) === -1) return -1;
      score++;
    }
    return score;
  }

  function entryScore(e, loc) {
    if (e.status === 'planned') return -1;
    var best = e.route ? ruleScore(e.route, loc) : -1;
    (e.activeWhen || []).forEach(function (r) { best = Math.max(best, ruleScore(r, loc)); });
    return best;
  }

  function resolveCurrent() {
    var loc = currentLocation();
    var winner = null;
    var winnerScore = -1;
    REG.entries.forEach(function (e) {
      if (!byId[e.id]) return;
      var s = entryScore(e, loc);
      if (s < 0) return;
      // Most specific rule wins; ties go to the deeper entry, then registry order.
      if (s > winnerScore || (s === winnerScore && winner && depth(e) > depth(winner))) {
        winner = e;
        winnerScore = s;
      }
    });
    return winner;
  }

  var forcedId = null;   // set by a page through ArowanaNav.setActive()

  function currentEntry() {
    if (forcedId && byId[forcedId]) return byId[forcedId];
    return resolveCurrent();
  }

  function primaryOf(e) {
    var list = ancestors(e);
    return list.length ? list[list.length - 1] : e;
  }

  /* ── Item builders ─────────────────────────────────────────────── */

  // All links/labels carry data-nav-id so active state can be repainted.
  function badge(text) {
    return el('span', { className: 'anv-badge', text: text });
  }

  function subItem(e, extraClass) {
    var cls = 'rail-subitem anv-subitem' + (extraClass ? ' ' + extraClass : '');
    var labelBox = el('div', null, [
      el('div', { className: 'rail-subitem-label', text: e.label }, [
        e.status === 'planned' ? badge('Planned') : null,
        e.status === 'legacy' ? badge('Legacy') : null
      ]),
      (e.desc || e.note) ? el('div', { className: 'rail-subitem-desc', text: e.status === 'available' ? e.desc : (e.note || e.desc) }) : null
    ]);
    var icon = el('span', { className: 'rail-subitem-icon', 'aria-hidden': 'true', text: e.icon || '' });
    if (e.status === 'planned' || !e.route) {
      // Not interactive: no href, not focusable. The badge text is part of
      // the accessible name ("What Changed Planned").
      return el('div', { className: cls + ' anv-planned', 'data-nav-id': e.id }, [icon, labelBox]);
    }
    return el('a', { className: cls, href: hrefFor(e.route), 'data-nav-id': e.id }, [icon, labelBox]);
  }

  /* ── Desktop rail ──────────────────────────────────────────────── */

  var groupToggles = [];   // { toggle, group, primary }

  function setGroupOpen(rec, open) {
    rec.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    rec.group.classList.toggle('expanded', open);
  }

  function railGroup(p) {
    var kids = childrenOf[p.id] || [];
    var subId = 'anv-sub-' + p.id;
    var group = el('div', { className: 'rail-group', 'data-nav-group': p.id });
    var row = el('div', { className: 'rail-item-row' });
    var icon = el('span', { className: 'rail-item-icon', 'aria-hidden': 'true', text: p.icon || '' });
    var label = el('span', { className: 'rail-item-label', text: p.label });
    var toggle;

    if (p.route) {
      row.appendChild(el('a', { className: 'rail-item', href: hrefFor(p.route), title: p.label, 'data-nav-id': p.id }, [icon, label]));
      if (kids.length) {
        toggle = el('button', {
          className: 'rail-group-toggle', type: 'button', 'aria-expanded': 'false',
          'aria-controls': subId, 'aria-label': 'Show ' + p.label + ' pages'
        }, [el('span', { className: 'rail-group-arrow', 'aria-hidden': 'true', text: '▾' })]);
        row.appendChild(toggle);
      }
    } else {
      // A group with no landing page (Strategy Desks): the whole row is the
      // disclosure button.
      toggle = el('button', {
        className: 'rail-item anv-group-button', type: 'button', 'aria-expanded': 'false',
        'aria-controls': subId, title: p.label, 'data-nav-id': p.id
      }, [icon, label, el('span', { className: 'rail-group-arrow anv-inline-arrow', 'aria-hidden': 'true', text: '▾' })]);
      row.appendChild(toggle);
    }
    group.appendChild(row);

    if (kids.length) {
      var sub = el('div', { className: 'rail-submenu', id: subId });
      kids.forEach(function (k) {
        sub.appendChild(subItem(k));
        var grand = childrenOf[k.id] || [];
        if (grand.length) {
          // Desk children are shown only for the desk containing the current
          // page (see paintActive), keeping the rail short.
          var nest = el('div', { className: 'anv-nested', 'data-nav-nest': k.id, hidden: true });
          grand.forEach(function (g) { nest.appendChild(subItem(g, 'anv-subitem-nested')); });
          sub.appendChild(nest);
        }
      });
      group.appendChild(sub);
    }

    if (toggle) {
      var rec = { toggle: toggle, group: group, primary: p };
      groupToggles.push(rec);
      toggle.addEventListener('click', function (ev) {
        ev.stopPropagation();
        setGroupOpen(rec, toggle.getAttribute('aria-expanded') !== 'true');
      });
    }
    return group;
  }

  function cachedUser() {
    try { return JSON.parse(storageGet('gs_auth_user_v1') || 'null'); } catch (_) { return null; }
  }

  function brandHref() {
    var signedIn = !!(cachedUser() && (cachedUser().id || cachedUser().email));
    var target = signedIn ? REG.brand.signedIn : REG.brand.signedOut;
    return SAFE_PATH.test(target) ? target : 'index.html';
  }

  function planSlug() {
    var slug = String(storageGet('ap_plan_v1') || '').toLowerCase();
    return PLAN_LABELS[slug] ? slug : null;
  }

  function callIfDefined(name) {
    if (typeof window[name] === 'function') { window[name](); return true; }
    return false;
  }

  // Utility links/buttons shared by the rail account menu and the More sheet.
  function utilityItems(itemClass) {
    var items = [];
    (REG.utilities || []).forEach(function (u) {
      if (!validRoute(u.route)) return;
      items.push(el('a', { className: itemClass, href: hrefFor(u.route), 'data-nav-id': u.id }, [
        el('span', { className: 'menu-item-icon', 'aria-hidden': 'true', text: u.icon || '' }),
        el('span', { text: u.label })
      ]));
    });
    var slug = planSlug();
    if (slug !== 'pro' && slug !== 'elite' && slug !== 'founders' && REG.pricing && SAFE_PATH.test(REG.pricing.path)) {
      items.push(el('a', { className: itemClass, href: REG.pricing.path }, [
        el('span', { className: 'menu-item-icon', 'aria-hidden': 'true', text: '⚡' }),
        el('span', { text: slug === 'free' ? 'Upgrade to Pro' : 'View plans' })
      ]));
    }
    var help = el('button', { className: itemClass, type: 'button' }, [
      el('span', { className: 'menu-item-icon', 'aria-hidden': 'true', text: '💬' }),
      el('span', { text: 'Help & Support' })
    ]);
    help.addEventListener('click', function () {
      // Same behaviour as the current rail: use the page's support panel when
      // it has one, otherwise go to the support page.
      if (!callIfDefined('openSupport') && REG.support && SAFE_PATH.test(REG.support.path)) {
        window.location.href = REG.support.path;
      }
    });
    items.push(help);
    var out = el('button', { className: itemClass + ' danger', type: 'button' }, [
      el('span', { className: 'menu-item-icon', 'aria-hidden': 'true', text: '🚪' }),
      el('span', { text: 'Sign Out' })
    ]);
    // Parity with js/nav-rail.js: sign-out is page-owned (auth is ATD-007
    // scope). Where the page defines no signOut(), this button does nothing,
    // exactly as the old rail's did.
    out.addEventListener('click', function () { callIfDefined('signOut'); });
    items.push(out);
    return items;
  }

  function accountSection() {
    var toggle = el('button', {
      className: 'user-toggle rail-item', id: 'userToggle', type: 'button',
      'aria-expanded': 'false', 'aria-controls': 'userMenu', title: 'Account'
    }, [
      el('span', { className: 'rail-item-icon', 'aria-hidden': 'true', text: '👤' }),
      el('span', { className: 'rail-item-label user-name', id: 'userName', text: 'Account' })
    ]);
    var slug = planSlug();
    var menu = el('div', { className: 'user-menu', id: 'userMenu' }, [
      el('div', { className: 'menu-header' }, [
        el('div', { className: 'menu-user-email', id: 'menuUserEmail' }),
        slug ? el('div', { className: 'menu-user-plan', text: PLAN_LABELS[slug] }) : null
      ]),
      el('div', { className: 'menu-section' }, utilityItems('menu-item'))
    ]);

    function setOpen(open, returnFocus) {
      menu.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && returnFocus) toggle.focus();
    }
    // Disclosure pattern (not an ARIA menu): button + list of links/buttons.
    toggle.addEventListener('click', function (ev) {
      ev.stopPropagation();
      setOpen(!menu.classList.contains('open'), false);
    });
    document.addEventListener('click', function (ev) {
      if (!toggle.contains(ev.target) && !menu.contains(ev.target)) setOpen(false, false);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && menu.classList.contains('open')) setOpen(false, true);
    });

    return el('div', { className: 'rail-bottom' }, [el('div', { className: 'rail-account' }, [toggle, menu])]);
  }

  function paintUser(user) {
    var meta = (user && user.user_metadata) || {};
    var name = meta.full_name || meta.name || (user && (user.name || user.username)) ||
               (user && user.email ? user.email.split('@')[0] : '') || 'Account';
    var label = document.getElementById('userName');
    var email = document.getElementById('menuUserEmail');
    if (label) { label.textContent = name; label.title = (user && user.email) || name; }
    if (email) email.textContent = (user && user.email) || '';
  }

  // Display-only identity refresh, unchanged from js/nav-rail.js (spec §11).
  function syncUser() {
    paintUser(cachedUser());
    function confirm() {
      var client = window.supabaseClient || window.sbClient || window.GSClient;
      if (!client || !client.auth || !client.auth.getUser) return;
      client.auth.getUser().then(function (res) {
        var u = res && res.data && res.data.user;
        if (u) paintUser(u);
      }).catch(function () { /* offline or signed out: keep cached name */ });
    }
    confirm();
    setTimeout(confirm, 900);
  }

  function renderRail(mount) {
    var collapseBtn = el('button', {
      className: 'rail-collapse-btn', id: 'railCollapseBtn', type: 'button',
      'aria-label': 'Collapse navigation', 'aria-expanded': 'true', title: 'Collapse navigation'
    }, [el('span', { id: 'railCollapseIcon', 'aria-hidden': 'true', text: '‹' })]);

    var logo = el('img', { src: 'images/arowanalogo.png?v=20260501', alt: '', className: 'rail-brand-logo' });
    logo.addEventListener('error', function () { logo.style.display = 'none'; });

    var top = el('div', { className: 'rail-top' }, [
      el('a', { href: brandHref(), className: 'rail-brand' }, [
        logo, el('span', { className: 'rail-brand-text', text: 'Arowana Profits' })
      ]),
      collapseBtn
    ]);

    var nav = el('nav', { className: 'rail-nav', 'aria-label': 'Primary' });
    primaries.forEach(function (p) { nav.appendChild(railGroup(p)); });

    while (mount.firstChild) mount.removeChild(mount.firstChild);
    mount.appendChild(top);
    mount.appendChild(nav);
    // Parity: pages whose header already owns the account menu keep it.
    if (!document.getElementById('user-menu-toggle')) mount.appendChild(accountSection());

    var sidebar = mount.closest('.sidebar') || document.getElementById('sidebarDrawer');
    if (sidebar) wireCollapse(sidebar, collapseBtn);
  }

  function wireCollapse(sidebar, btn) {
    function apply(collapsed) {
      sidebar.classList.toggle('rail-collapsed', collapsed);
      document.body.classList.toggle('rail-collapsed', collapsed);
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var label = collapsed ? 'Expand navigation' : 'Collapse navigation';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      var icon = document.getElementById('railCollapseIcon');
      if (icon) icon.textContent = collapsed ? '›' : '‹';
    }
    apply(storageGet(COLLAPSE_KEY) === '1');
    btn.addEventListener('click', function () {
      var collapsed = !sidebar.classList.contains('rail-collapsed');
      apply(collapsed);
      storageSet(COLLAPSE_KEY, collapsed ? '1' : '0');
    });
  }

  /* ── Mobile bar and More sheet ─────────────────────────────────── */

  var moreButton = null;
  var sheet = null;
  var sheetBackdrop = null;
  var inertedNodes = [];
  var lastFocus = null;

  function renderMobileBar() {
    var bar = el('nav', { className: 'anv-mobile-bar', 'aria-label': 'Mobile primary' });
    var order = REG.mobileOrder || [];
    order.forEach(function (slot) {
      if (slot === 'more') {
        moreButton = el('button', {
          className: 'anv-mbn-item', type: 'button', 'aria-haspopup': 'dialog',
          'aria-expanded': 'false', 'aria-controls': 'anvMoreSheet', 'data-nav-slot': 'more'
        }, [
          el('span', { className: 'anv-mbn-icon', 'aria-hidden': 'true', text: '☰' }),
          el('span', { className: 'anv-mbn-label', text: 'More' })
        ]);
        moreButton.addEventListener('click', function () { openSheet(); });
        bar.appendChild(moreButton);
        return;
      }
      var p = primaries.filter(function (e) { return e.mobile === slot; })[0];
      if (!p || !p.route) {
        // Every approved shortcut must exist; never silently drop one.
        console.error('[arowana-nav] mobile slot "' + slot + '" has no destination in the registry.');
        return;
      }
      bar.appendChild(el('a', {
        className: 'anv-mbn-item', href: hrefFor(p.route), 'data-nav-id': p.id,
        'data-nav-slot': slot, 'aria-label': p.label
      }, [
        el('span', { className: 'anv-mbn-icon', 'aria-hidden': 'true', text: p.icon || '' }),
        el('span', { className: 'anv-mbn-label', 'aria-hidden': 'true', text: p.shortLabel || p.label })
      ]));
    });
    document.body.appendChild(bar);
    document.body.classList.add('anv-has-mobile-bar');
  }

  function sheetSection(p) {
    var kids = childrenOf[p.id] || [];
    var heading = el('h3', { className: 'anv-sheet-heading', text: p.label });
    var list = el('div', { className: 'anv-sheet-list' });
    if (p.route) {
      list.appendChild(el('a', { className: 'rail-subitem anv-subitem', href: hrefFor(p.route), 'data-nav-id': p.id }, [
        el('span', { className: 'rail-subitem-icon', 'aria-hidden': 'true', text: p.icon || '' }),
        el('div', null, [el('div', { className: 'rail-subitem-label', text: p.label + ' home' })])
      ]));
    }
    kids.forEach(function (k) {
      list.appendChild(subItem(k));
      var grand = childrenOf[k.id] || [];
      if (grand.length) {
        // Same rule as the rail: desk children only under the current desk.
        var nest = el('div', { className: 'anv-nested', 'data-nav-nest': k.id, hidden: true });
        grand.forEach(function (g) { nest.appendChild(subItem(g, 'anv-subitem-nested')); });
        list.appendChild(nest);
      }
    });
    return el('section', { className: 'anv-sheet-section', 'data-nav-group': p.id }, [heading, list]);
  }

  function renderSheet() {
    var title = el('h2', { className: 'anv-sheet-title', id: 'anvMoreTitle', tabindex: '-1', text: 'More' });
    var close = el('button', { className: 'anv-sheet-close', type: 'button', 'aria-label': 'Close' }, [
      el('span', { 'aria-hidden': 'true', text: '✕' })
    ]);
    close.addEventListener('click', function () { closeSheet(true); });

    var body = el('div', { className: 'anv-sheet-body' });
    primaries.filter(function (p) { return p.mobile === 'more'; }).forEach(function (p) {
      body.appendChild(sheetSection(p));
    });
    body.appendChild(el('section', { className: 'anv-sheet-section' }, [
      el('h3', { className: 'anv-sheet-heading', text: 'Account & help' }),
      el('div', { className: 'anv-sheet-list anv-sheet-utils' }, utilityItems('menu-item anv-util'))
    ]));

    sheet = el('div', {
      className: 'anv-sheet', id: 'anvMoreSheet', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'anvMoreTitle', hidden: true
    }, [el('div', { className: 'anv-sheet-head' }, [title, close]), body]);
    sheetBackdrop = el('div', { className: 'anv-sheet-backdrop', hidden: true });
    sheetBackdrop.addEventListener('click', function () { closeSheet(true); });

    sheet.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); closeSheet(true); return; }
      if (ev.key === 'Tab') trapTab(ev);
    });
    // Choosing a link navigates away; close so a back-forward-cache restore
    // never shows the sheet stuck open.
    sheet.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('a[href]')) closeSheet(false);
    });

    document.body.appendChild(sheetBackdrop);
    document.body.appendChild(sheet);
  }

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }

  function trapTab(ev) {
    var list = focusables(sheet);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    var active = document.activeElement;
    if (ev.shiftKey && (active === first || !sheet.contains(active) || active.id === 'anvMoreTitle')) {
      ev.preventDefault(); last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault(); first.focus();
    }
  }

  function setBackgroundInert(on) {
    if (on) {
      inertedNodes = Array.prototype.filter.call(document.body.children, function (n) {
        return n !== sheet && n !== sheetBackdrop && n.tagName !== 'SCRIPT' && !n.inert;
      });
      inertedNodes.forEach(function (n) {
        n.inert = true;                       // modern browsers
        n.setAttribute('aria-hidden', 'true'); // fallback for older AT
      });
    } else {
      inertedNodes.forEach(function (n) { n.inert = false; n.removeAttribute('aria-hidden'); });
      inertedNodes = [];
    }
  }

  function openSheet() {
    if (!sheet || !sheet.hidden) return;
    lastFocus = document.activeElement;
    paintActive();
    sheet.hidden = false;
    sheetBackdrop.hidden = false;
    document.body.classList.add('anv-sheet-open');
    setBackgroundInert(true);
    if (moreButton) moreButton.setAttribute('aria-expanded', 'true');
    var title = document.getElementById('anvMoreTitle');
    if (title) title.focus();
  }

  function closeSheet(returnFocus) {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    sheetBackdrop.hidden = true;
    document.body.classList.remove('anv-sheet-open');
    setBackgroundInert(false);
    if (moreButton) moreButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) (moreButton || lastFocus || document.body).focus();
  }

  /* ── Active-state painting ─────────────────────────────────────── */

  function paintActive() {
    var cur = currentEntry();
    var chain = cur ? [cur].concat(ancestors(cur)) : [];
    var chainIds = chain.map(function (e) { return e.id; });
    var primary = cur ? primaryOf(cur) : null;

    Array.prototype.forEach.call(document.querySelectorAll('[data-nav-id]'), function (node) {
      var id = node.getAttribute('data-nav-id');
      var isCurrent = cur && id === cur.id;
      if (isCurrent && node.tagName === 'A') node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
      // Visual "contains the current page" marker for ancestors; only the
      // exact current item carries aria-current.
      node.classList.toggle('active', !!cur && chainIds.indexOf(id) !== -1);
      node.classList.toggle('anv-contains-current', !isCurrent && chainIds.indexOf(id) !== -1);
    });

    // Show nested desk children only under the desk on the current path.
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav-nest]'), function (nest) {
      nest.hidden = chainIds.indexOf(nest.getAttribute('data-nav-nest')) === -1;
    });

    // Expand the rail group containing the current page.
    groupToggles.forEach(function (rec) {
      if (primary && rec.primary.id === primary.id) setGroupOpen(rec, true);
    });

    if (moreButton) {
      var inMore = !!(primary && primary.mobile === 'more');
      moreButton.classList.toggle('active', inMore);
      moreButton.setAttribute('aria-label', inMore ? 'More, contains current page' : 'More');
    }
  }

  /* ── Styles for the parts the page CSS does not cover ──────────── */

  function injectStyles() {
    if (document.getElementById('anv-styles')) return;
    var css =
      '.anv-badge{display:inline-block;margin-left:6px;padding:0 5px;border-radius:4px;border:1px solid currentColor;' +
        'font-size:0.62rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;vertical-align:middle;opacity:.8}' +
      '.anv-planned{cursor:default;opacity:.7}' +
      '.anv-planned:hover{background:none}' +
      '.anv-subitem-nested{padding-left:22px}' +
      '.anv-group-button{width:100%;text-align:left;font:inherit;font-weight:600}' +
      '.anv-inline-arrow{margin-left:auto}' +
      '.anv-group-button[aria-expanded="true"] .anv-inline-arrow{transform:rotate(180deg)}' +
      '.rail-subitem[aria-current="page"]{font-weight:700;box-shadow:inset 3px 0 0 var(--brand,#0b4f8a)}' +
      '.rail-subitem[aria-current="page"] .rail-subitem-label{text-decoration:underline;text-underline-offset:3px}' +
      '#railMount a:focus-visible,#railMount button:focus-visible,.anv-mobile-bar :focus-visible,.anv-sheet :focus-visible' +
        '{outline:3px solid var(--brand,#0b4f8a);outline-offset:2px}' +
      '.sidebar.rail-collapsed .anv-badge{display:none}' +
      '.anv-mobile-bar{display:none}' +
      '.anv-sheet[hidden],.anv-sheet-backdrop[hidden]{display:none!important}' +
      '@media (max-width:' + MOBILE_MAX + 'px){' +
        '.anv-mobile-bar{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:1050;' +
          'background:var(--card,#fff);border-top:1px solid var(--border,#e2e8f0);' +
          'padding:4px 4px calc(4px + env(safe-area-inset-bottom));box-shadow:0 -2px 12px rgba(0,0,0,.06)}' +
        'body.anv-has-mobile-bar{padding-bottom:calc(60px + env(safe-area-inset-bottom))}' +
        'body.anv-v2 #sidebarTrigger{display:none}' +
      '}' +
      '.anv-mbn-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:48px;' +
        'padding:4px 2px;border:0;border-radius:8px;background:none;color:var(--text-muted,#64748b);text-decoration:none;' +
        'font:inherit;font-size:0.68rem;font-weight:600;text-align:center;cursor:pointer}' +
      '.anv-mbn-icon{font-size:1.2rem;line-height:1}' +
      '.anv-mbn-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}' +
      '.anv-mbn-item.active,.anv-mbn-item[aria-current="page"]{color:var(--brand,#0b4f8a)}' +
      '.anv-mbn-item.active .anv-mbn-label,.anv-mbn-item[aria-current="page"] .anv-mbn-label{text-decoration:underline;text-underline-offset:3px}' +
      '.anv-sheet-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:1100}' +
      '.anv-sheet{position:fixed;left:0;right:0;bottom:0;max-height:85vh;overflow-y:auto;z-index:1101;' +
        'background:var(--card,#fff);color:var(--text,#0f172a);border-radius:14px 14px 0 0;' +
        'padding:12px 14px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.18)}' +
      '.anv-sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.anv-sheet-title{font-size:1.05rem;margin:0}' +
      '.anv-sheet-title:focus{outline:none}' +
      '.anv-sheet-close{min-width:44px;min-height:44px;border:0;background:none;font-size:1.1rem;cursor:pointer;color:inherit}' +
      '.anv-sheet-heading{font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted,#64748b);margin:12px 0 4px}' +
      '.anv-sheet-list{display:flex;flex-direction:column}' +
      '.anv-sheet .rail-subitem,.anv-sheet .menu-item{min-height:44px;display:flex;align-items:center;gap:10px;' +
        'padding:6px 8px;border:0;background:none;color:inherit;text-decoration:none;font:inherit;text-align:left;cursor:pointer}' +
      '.anv-sheet .rail-subitem-desc{font-size:0.72rem;color:var(--text-muted,#64748b)}' +
      '.anv-sheet .rail-subitem.anv-subitem-nested{padding-left:36px;font-size:0.92em}' +
      '.anv-nested{display:flex;flex-direction:column}' +
      '.anv-nested[hidden]{display:none}' +
      'body.anv-sheet-open{overflow:hidden}';
    document.head.appendChild(el('style', { id: 'anv-styles', text: css }));
  }

  /* ── Init ──────────────────────────────────────────────────────── */

  function init() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }
    if (document.body.classList.contains('anv-v2')) return;   // idempotent
    document.body.classList.add('anv-v2');
    injectStyles();

    var mount = document.getElementById('railMount');
    if (mount) renderRail(mount);
    else console.warn('[arowana-nav] #railMount not found; desktop rail skipped (mobile bar still rendered).');

    renderMobileBar();
    renderSheet();
    paintActive();
    if (mount && !document.getElementById('user-menu-toggle')) syncUser();

    window.addEventListener('hashchange', paintActive);
    window.addEventListener('popstate', paintActive);
    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted) closeSheet(false);
      paintActive();
    });
    // Leaving mobile width with the sheet open would strand the inert page.
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: ' + (MOBILE_MAX + 1) + 'px)');
      var onChange = function (e) { if (e.matches) closeSheet(false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  window.ArowanaNav = Object.freeze({
    version: REG.version,
    // Pages whose visible tab is not in the URL (options-hub restores a
    // remembered tab) call this from their own switchTab().
    setActive: function (id) {
      if (id && !byId[id]) { console.warn('[arowana-nav] setActive: unknown id "' + id + '"'); return; }
      forcedId = id || null;
      paintActive();
    }
  });

  init();
})();
