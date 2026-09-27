/**
 * nav-rail.js — shared site navigation rail
 * ============================================================
 * Renders the collapsible left nav (site-wide tool list + account menu)
 * into a <div id="railMount"> that must already exist in the DOM when this
 * script runs. Loaded as a plain <script> near the bottom of <body>, after
 * the page markup and before app-config.js/auth-header.js, so the elements
 * it creates (#userName, #menuUserEmail, #userToggle, #userMenu) exist
 * before the page's own DOMContentLoaded handler tries to populate them.
 *
 * Single source of truth for the 6 core tools + their sub-tools. Editing
 * nav across the platform means editing this one file, not hand-copying
 * markup into trading-command.html / portfolio-command.html /
 * analysis-central.html / options-hub.html / market-intelligence.html.
 *
 * Collapse state persists per-browser via localStorage so it's remembered
 * across pages and reloads (desktop only — the mobile drawer always shows
 * the full expanded rail regardless of this setting).
 */
(function () {
  'use strict';

  var COLLAPSE_KEY = 'ap_rail_collapsed_v1';

  var TOOLS = [
    {
      id: 'trading',
      href: 'trading-command.html',
      icon: '⚡',
      label: 'Trading Command',
      shortLabel: 'Trading',
      // "Live Scanner" was renamed to match the tab it actually jumps to —
      // having a rail item and a tab describing the same view under two
      // different names made it look like two destinations.
      //
      // Momentum Hunter (momentum-hunter-complete.html) retired: its scan
      // now lives in the scanners.js registry, and the standalone page used
      // the select-then-discover-it's-unavailable pattern scanner.html was
      // built to replace. "View All Tools" went with it — scanner.html IS
      // the full scanner library that link pointed at.
      sub: [
        { href: 'trading-command.html', icon: '📊', label: 'Live Scan & Positions', desc: 'Open positions and today\'s scan', tabSwitch: 'positions' },
        { href: 'scanner.html', icon: '🔍', label: 'Scanners', desc: 'Every scan in one place' },
        { href: 'trade-journal-pro.html?from=trading-command', icon: '📝', label: 'Trade Journal', desc: 'Track your trades' }
      ]
    },
    {
      id: 'portfolio',
      href: 'portfolio-command.html',
      icon: '🏦',
      // Was 'Portfolio'. trading-command.html carried a MutationObserver
      // whose only job was renaming this to 'Portfolio Command' after mount;
      // fixing the label at source means that patch can be deleted.
      label: 'Portfolio Command',
      shortLabel: 'Portfolio',
      sub: [
        { href: 'portfolio-command.html', icon: '🏦', label: 'Portfolio Overview', desc: 'Complete portfolio management' },
        { href: 'portfolio-advisor.html', icon: '🧭', label: 'Portfolio Advisor', desc: 'Foundation checks, breadth & goals' },
        { href: 'watchlist.html', icon: '👁️', label: 'Watchlist', desc: 'Ideas, entries and long-term targets' },
        { href: 'features-tools-directory.html#long-term-planning', icon: '🧰', label: 'View All Tools', desc: 'Full long-term planning library' }
      ]
    },
    {
      id: 'analysis',
      href: 'analysis-central.html',
      icon: '📊',
      label: 'Analysis Central',
      shortLabel: 'Analysis',
      sub: [
        { href: 'technical-analysis.html', icon: '📈', label: 'Technical Analysis', desc: 'Live indicators & charts' },
        { href: 'intrinsic-value.html', icon: '💰', label: 'Intrinsic Value Calculator', desc: 'DCF & fair value estimates' },
        /* Discipline Scorecard removed from the rail.
           Its label promised to "score a stock", but nothing is fetched —
           every rating is the user's own slider position, so a stock they
           know nothing about scores exactly as confidently as one they have
           researched. Meanwhile portfolio-command.html already scores stocks
           automatically from Finnhub /stock/metric (qsScoreROIC,
           qsScoreGrowth, qsScoreLeverage, qsScoreValuation, qsScoreMoat), so
           the platform showed two different numbers for the same ticker with
           no explanation of which to trust.

           The page still exists at discipline-scorecard.html. It is worth
           reviving once it prefills the measurable rules from those same
           metrics and asks only the four a data source cannot answer
           ("I understand this business", "not FOMO-buying", and so on) —
           at which point it stops competing with the Quality Scanner. */
        { href: 'strategy-backtesting.html', icon: '🔬', label: 'Strategy Backtesting', desc: 'Test your strategies' },
        { href: 'trading-journal-analysis.html', icon: '📊', label: 'Performance Analytics', desc: 'Track trading results' },
        { href: 'features-tools-directory.html#screeners', icon: '🧰', label: 'View All Tools', desc: 'Full screener library' }
      ]
    },
    {
      id: 'marketintel',
      href: 'market-intelligence.html',
      icon: '📡',
      label: 'Market Intelligence',
      shortLabel: 'Market',
      sub: [
        { href: 'market-intelligence.html', icon: '📡', label: 'Market Overview', desc: 'Cycle, sectors, macro & calendar' },
        { href: 'market-intelligence.html#cycle', icon: '🔄', label: 'Cycle Phase', desc: 'Where we are in the cycle' },
        { href: 'market-intelligence.html#brief', icon: '🤖', label: 'AI Daily Brief', desc: "Claude's market summary" },
        { href: 'money-flow-alert.html', icon: '💸', label: 'Money Flow Alert', desc: 'Institutional buy/sell pressure' }
      ]
    },
    {
      id: 'options',
      href: 'options-hub.html',
      icon: '📈',
      label: 'Options Hub',
      shortLabel: 'Options',
      sub: [
        { href: 'options-hub.html', icon: '📈', label: 'Options Overview', desc: 'Portfolio & market insights' },
        { href: 'credit-spread-planner.html', icon: '📐', label: 'Credit Spread Planner', desc: 'Plan defined-risk spreads' },
        { href: 'data-hygiene-audit.html', icon: '🩺', label: 'Data Hygiene Audit', desc: 'Check journal data quality' }
      ]
    }
  ];

  function currentFilename() {
    var path = (window.location.pathname || '').split('/').pop();
    return path || 'index.html';
  }

  // Filenames for the same page have shown up as both "trading-command.html"
  // and "tradingcommand.html" over the course of this project — comparing
  // exact strings for active-page detection silently fails whenever they
  // don't match. Stripping hyphens/underscores/case before comparing makes
  // this robust to either naming convention rather than betting on one.
  function normalizeFilename(name) {
    return String(name || '').toLowerCase().replace(/[-_]/g, '');
  }

  function isActiveHref(href, activeFile) {
    return normalizeFilename(href.split('#')[0].split('?')[0]) === normalizeFilename(activeFile);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function subItemHtml(sub) {
    var onclick = '';
    if (sub.tabSwitch) {
      onclick = ' onclick="if(document.getElementById(\'positionsTab\')){event.preventDefault();switchTab(\'' + sub.tabSwitch + '\');}"';
    }
    return (
      '<a href="' + escapeHtml(sub.href) + '" class="rail-subitem"' + onclick + '>' +
        '<span class="rail-subitem-icon">' + sub.icon + '</span>' +
        '<div>' +
          '<div class="rail-subitem-label">' + escapeHtml(sub.label) + '</div>' +
          '<div class="rail-subitem-desc">' + escapeHtml(sub.desc) + '</div>' +
        '</div>' +
      '</a>'
    );
  }

  function toolGroupHtml(tool, activeFile) {
    var isActive = isActiveHref(tool.href, activeFile);
    var subId = 'railsub-' + tool.id;
    return (
      '<div class="rail-group">' +
        '<div class="rail-item-row">' +
          '<a href="' + escapeHtml(tool.href) + '" class="rail-item' + (isActive ? ' active' : '') + '" title="' + escapeHtml(tool.label) + '">' +
            '<span class="rail-item-icon">' + tool.icon + '</span>' +
            '<span class="rail-item-label">' + escapeHtml(tool.label) + '</span>' +
          '</a>' +
          '<button class="rail-group-toggle" type="button" aria-expanded="false" aria-controls="' + subId + '" aria-label="Show ' + escapeHtml(tool.label) + ' tools">' +
            '<span class="rail-group-arrow">▾</span>' +
          '</button>' +
        '</div>' +
        '<div class="rail-submenu" id="' + subId + '">' +
          tool.sub.map(subItemHtml).join('') +
        '</div>' +
      '</div>'
    );
  }

  // The account menu used to print "Free Plan" and "Upgrade to Pro" for
  // everyone, including paying users. Read the cached plan slug that
  // account.html writes (ap_plan_v1, reconciled against profiles.plan) and
  // render accordingly. When the cache is absent we say nothing rather than
  // asserting a plan we cannot verify.
  var PLAN_LABELS = {
    free: 'Free plan',
    pro: 'Pro plan',
    elite: 'Elite plan',
    founders: 'Founding Member'
  };

  function currentPlanSlug() {
    try {
      var slug = String(localStorage.getItem('ap_plan_v1') || '').toLowerCase();
      return PLAN_LABELS[slug] ? slug : null;
    } catch (e) {
      return null;
    }
  }

  function planLineHtml(slug) {
    if (!slug) return '';
    return '<div class="menu-user-plan">' + escapeHtml(PLAN_LABELS[slug]) + '</div>';
  }

  function upgradeItemHtml(slug) {
    // Elite and Founding Member have nothing left to upgrade to.
    if (slug === 'elite' || slug === 'founders') return '';

    var label = slug === 'pro' ? 'Upgrade to Elite'
              : slug === 'free' ? 'Upgrade to Pro'
              : 'View plans';
    return '<a href="pricing.html" class="menu-item"><span class="menu-item-icon">⚡</span><span>' +
           escapeHtml(label) + '</span></a>';
  }

  function railHtml(activeFile, includeAccount) {
    var navHtml = TOOLS.map(function (tool) { return toolGroupHtml(tool, activeFile); }).join('');
    var planSlug = currentPlanSlug();
    var accountHtml = includeAccount ? (
      '<div class="rail-bottom">' +
        '<div class="rail-account">' +
          '<button class="user-toggle rail-item" id="userToggle" title="Account">' +
            '<span class="rail-item-icon">👤</span>' +
            '<span class="rail-item-label user-name" id="userName">Account</span>' +
          '</button>' +
          '<div class="user-menu" id="userMenu">' +
            '<div class="menu-header">' +
              '<div class="menu-user-email" id="menuUserEmail"></div>' +
              planLineHtml(planSlug) +
            '</div>' +
            '<div class="menu-section">' +
              '<a href="account.html" class="menu-item"><span class="menu-item-icon">⚙️</span><span>Account Settings</span></a>' +
              '<a href="billing.html" class="menu-item"><span class="menu-item-icon">💳</span><span>Billing</span></a>' +
              upgradeItemHtml(planSlug) +
            '</div>' +
            '<div class="menu-divider"></div>' +
            '<div class="menu-section">' +
              '<button class="menu-item" onclick="if(typeof openSupport===\'function\')openSupport();">' +
                '<span class="menu-item-icon">💬</span><span>Help &amp; Support</span>' +
              '</button>' +
              '<button class="menu-item danger" onclick="if(typeof signOut===\'function\')signOut();">' +
                '<span class="menu-item-icon">🚪</span><span>Sign Out</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    ) : '';
    return (
      '<div class="rail-top">' +
        '<a href="index.html" class="rail-brand">' +
          '<img src="images/arowanalogo.png?v=20260501" alt="" class="rail-brand-logo" onerror="this.style.display=\'none\'">' +
          '<span class="rail-brand-text">Arowana Profits</span>' +
        '</a>' +
        '<button class="rail-collapse-btn" id="railCollapseBtn" aria-label="Collapse navigation" aria-expanded="true" title="Collapse navigation">' +
          '<span id="railCollapseIcon">‹</span>' +
        '</button>' +
      '</div>' +
      '<nav class="rail-nav" aria-label="Site navigation">' + navHtml + '</nav>' +
      accountHtml
    );
  }

  function applyCollapsedState(sidebar) {
    var collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
    sidebar.classList.toggle('rail-collapsed', collapsed);
    document.body.classList.toggle('rail-collapsed', collapsed);
    var btn = document.getElementById('railCollapseBtn');
    var icon = document.getElementById('railCollapseIcon');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (icon) icon.textContent = collapsed ? '›' : '‹';
  }

  function wireCollapseToggle(sidebar) {
    var btn = document.getElementById('railCollapseBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var collapsed = sidebar.classList.toggle('rail-collapsed');
      document.body.classList.toggle('rail-collapsed', collapsed);
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var icon = document.getElementById('railCollapseIcon');
      if (icon) icon.textContent = collapsed ? '›' : '‹';
    });
  }

  function wireGroupToggles() {
    document.querySelectorAll('.rail-group-toggle').forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var group = toggle.closest('.rail-group');
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (group) group.classList.toggle('expanded', !isOpen);
      });
    });
  }

  function bottomNavHtml(activeFile) {
    return TOOLS.map(function (tool) {
      var isActive = isActiveHref(tool.href, activeFile);
      return (
        '<a href="' + escapeHtml(tool.href) + '" class="mbn-item' + (isActive ? ' active' : '') + '">' +
          '<span class="mbn-icon">' + tool.icon + '</span>' +
          '<span class="mbn-label">' + escapeHtml(tool.shortLabel || tool.label) + '</span>' +
        '</a>'
      );
    }).join('');
  }

  // Self-contained CSS, injected once — built only from the design tokens
  // every core page already declares (--brand, --border, --card, --text,
  // --text-muted), so this works as a true drop-in on any page loading
  // nav-rail.js, not just trading-command.html. Same pattern as
  // setup-scorecard.js's injectStyles(), unlike the rail itself (which
  // still relies on each page's own .rail-* CSS).
  function injectBottomNavStyles() {
    if (document.getElementById('mbn-styles')) return;
    var style = document.createElement('style');
    style.id = 'mbn-styles';
    style.textContent =
      '.mobile-bottom-nav{display:none}' +
      '@media (max-width:768px){' +
        '.mobile-bottom-nav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:1050;' +
          'background:var(--card,#fff);border-top:1px solid var(--border,#e2e8f0);' +
          'padding:6px 4px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -2px 12px rgba(0,0,0,.06)}' +
        'body.has-bottom-nav{padding-bottom:calc(58px + env(safe-area-inset-bottom))}' +
      '}' +
      '.mbn-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:8px;' +
        'color:var(--text-muted,#64748b);text-decoration:none;font-size:0.65rem;font-weight:600;text-align:center}' +
      '.mbn-icon{font-size:1.2rem;line-height:1}' +
      '.mbn-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}' +
      '.mbn-item.active{color:var(--brand,#0b4f8a)}' +
      '.mbn-item.active .mbn-icon{transform:scale(1.1)}';
    document.head.appendChild(style);
  }

  function renderBottomNav() {
    injectBottomNavStyles();
    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile site navigation');
    nav.innerHTML = bottomNavHtml(currentFilename());
    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');
  }

  function init() {
    var mount = document.getElementById('railMount');
    if (!mount) {
      console.warn('[nav-rail] #railMount not found on this page — skipping rail render.');
      return;
    }

    // Pages using the trade-journal-pro.html/watchlist.html convention
    // (#user-menu-toggle, wired by auth-header.js) already have a working
    // account menu — rendering a second one with different ids would be
    // redundant and risks confusing which one is "real". Pages without
    // that marker get the rail's own account section as before.
    var hasOwnAccountMenu = !!document.getElementById('user-menu-toggle');
    mount.innerHTML = railHtml(currentFilename(), !hasOwnAccountMenu);

    var sidebar = mount.closest('.sidebar') || document.getElementById('sidebarDrawer');
    if (sidebar) {
      applyCollapsedState(sidebar);
      wireCollapseToggle(sidebar);
    }

    wireGroupToggles();
    wireAccountMenu();
    renderBottomNav();
  }

  init();

  /* ── Account menu toggle ────────────────────────────────────────────
     The rail renders #userToggle and #userMenu but never wired them, so
     each page had to do it. Five pages did (trading-command,
     market-intelligence, analysis-central, portfolio-command, options-hub);
     any page that adopted the rail without copying that block got an
     account button that did nothing — which is what happened on
     ai-morning-brief, technical-analysis and discipline-scorecard.

     Wiring it here means the rail owns the markup AND its behaviour. The
     guard below keeps it from double-toggling on the five pages that
     already have their own handler: if one of them opens the menu, this
     handler sees the class already applied and stands down.
     ─────────────────────────────────────────────────────────────────── */
  function wireAccountMenu() {
    var toggle = document.getElementById('userToggle');
    var menu   = document.getElementById('userMenu');
    if (!toggle || !menu) return;                 // page suppressed the section
    if (toggle.dataset.railWired === '1') return; // already done
    toggle.dataset.railWired = '1';

    function close() {
      menu.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'menu');

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      /* If a page-level handler already ran on this same click it will have
         flipped the class; re-reading it here would toggle straight back and
         the menu would flash open and shut. Defer a tick and only act if
         nothing else did. */
      var before = menu.classList.contains('open');
      setTimeout(function () {
        if (menu.classList.contains('open') !== before) return;  // someone else handled it
        var open = !before;
        menu.classList.toggle('open', open);
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }, 0);
    });

    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

})();
