/* ============================================================================
   Arowana — Account Switcher  (js/account-switcher.js)
   ----------------------------------------------------------------------------
   One account switcher for the whole platform.

   portfolio-command.html built this widget by hand; portfolio-advisor.html then
   built it again. Rather than hand-copy it a third time into trading-command
   and analysis-central, it lives here.

   WHAT IT DOES
   Enhances an existing native <select> in place. The select stays in the DOM as
   the source of truth — hidden, but still holding the value and still emitting
   'change' — so every listener a page already has keeps working untouched. The
   visible widget just drives it. That is deliberate: converting the select
   outright would mean rewriting each page's filter logic, which is where bugs
   come from.

   A native <option> list cannot be styled (the browser draws it), which is why
   an enhancement rather than CSS was needed to make these match.

   USAGE
     <script src="./js/account-switcher.js"></script>

     AP_ACCT_SWITCHER.enhance('tcAccountFilter', {
       countFor: (value) => positions.filter(p => p.account === value).length,
       colorFor: (value) => AccountRegistry?.getByName(value)?.color
     });

   Call enhance() again after repopulating the select — it re-reads the options
   and re-renders. Safe to call repeatedly.

   REQUIRES the .acct-switcher / .acct-switcher-current / .acct-switcher-dropdown
   / .acct-row styles the portfolio pages already define. injectStyles() below
   supplies them for pages that don't.
   ========================================================================== */
(function (window, document) {
  'use strict';
  if (window.AP_ACCT_SWITCHER) return;

  var STYLE_ID = 'ap-acct-switcher-styles';

  /* Literal colour values — pages across the platform name their tokens
     differently, and an undefined custom property invalidates its whole
     declaration. */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.ap-acct-switcher{position:relative;flex:0 0 auto;display:inline-block}',
      '.ap-acct-switcher .acct-switcher-current{display:inline-flex;align-items:center;gap:8px;max-width:280px;height:36px;padding:0 11px;border:1px solid #d2dde3;border-radius:9px;background:#fff;color:#405967;font:800 12px inherit;cursor:pointer}',
      '.ap-acct-switcher .acct-switcher-current:hover,.ap-acct-switcher .acct-switcher-current.is-open{border-color:#175f8f}',
      '.ap-acct-switcher .acct-switcher-name{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}',
      '.ap-acct-switcher .acct-switcher-count{flex:0 0 auto;color:#5c7482;font-weight:700;font-size:11px}',
      '.ap-acct-switcher .acct-switcher-caret{flex:0 0 auto;font-size:.6rem;color:#7b8f9b}',
      '.ap-acct-switcher .acct-color-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:transparent}',
      /* position:FIXED, not absolute. Host containers clip: trading-command's
         tab strip is overflow-x:auto so it can scroll on narrow screens, and an
         absolutely-positioned menu inside a scrolling ancestor is simply cut
         off. Fixed escapes any ancestor overflow; coordinates are set from the
         trigger's bounding rect when it opens. */
      /* Top-level class, not a descendant selector: the menu is a child of
         <body>, so `.ap-acct-switcher .acct-switcher-dropdown` would never
         match it and it would fall back to static positioning. */
      '.ap-acct-menu{position:fixed;z-index:2000;min-width:280px;border:1px solid #cedbe3;border-radius:9px;background:#fff;box-shadow:0 14px 34px rgba(30,57,73,.16);overflow:hidden}',
      '.ap-acct-menu .acct-color-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:transparent}',
      '.ap-acct-menu .acct-row{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #eef2f5;font-size:.8rem;font-weight:500;color:#18384b;cursor:pointer}',
      '.ap-acct-menu .acct-row:last-child{border-bottom:none}',
      '.ap-acct-menu .acct-row:hover{background:#eef5f8}',
      '.ap-acct-menu .acct-row.is-active{background:rgba(11,79,138,.08);font-weight:700}',
      '.ap-acct-menu .acct-row-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ap-acct-menu .acct-row-count{flex:0 0 auto;padding:2px 8px;border-radius:999px;background:#eef3f6;color:#526b7c;font-weight:600;font-size:.72rem}',
      '@media(max-width:768px){.ap-acct-switcher{width:100%}.ap-acct-switcher .acct-switcher-current{width:100%;max-width:none}.ap-acct-menu{width:auto}}'
    ].join('');
    document.head.appendChild(st);
  }

  function esc(v) {
    return String(v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Option labels are often written "Jenny-631SCHW (19)". Split the trailing
     count out so it can be rendered as a pill, matching the portfolio pages,
     rather than left inline. */
  function splitLabel(text) {
    var m = String(text || '').match(/^(.*?)\s*\((\d+)\)\s*$/);
    return m ? { name: m[1].trim(), count: m[2] } : { name: String(text || '').trim(), count: null };
  }

  function enhance(target, opts) {
    injectStyles();
    opts = opts || {};

    var select = typeof target === 'string' ? document.getElementById(target) : target;
    if (!select || select.tagName !== 'SELECT') return null;

    var host = select._apSwitcher;
    if (!host) {
      host = document.createElement('div');
      host.className = 'ap-acct-switcher';
      /* Carry the select's own layout hooks over, so a page that right-aligns
         it in a tab strip keeps working without extra CSS. */
      if (select.className) host.dataset.fromClass = select.className;
      select.parentNode.insertBefore(host, select);
      host.appendChild(select);
      select._apSwitcher = host;

      /* Keep the widget in step if the page changes the value in code. */
      select.addEventListener('change', function () { render(); });
    }

    function render() {
      /* Hide the select on EVERY render, not just when the host is first
         created. Callers set select.style.display = '' before re-populating
         options and calling enhance() again; hiding only on creation meant the
         raw select reappeared next to the widget from the second render on. */
      select.style.display = 'none';

      var options = Array.prototype.map.call(select.options, function (o) {
        var parts = splitLabel(o.textContent);
        var count = opts.countFor ? opts.countFor(o.value, o) : parts.count;
        return {
          value: o.value,
          name: parts.name,
          count: (count === null || count === undefined || count === '') ? null : count,
          color: opts.colorFor ? opts.colorFor(o.value, o) : null,
          selected: o.value === select.value
        };
      });

      var active = options.filter(function (o) { return o.selected; })[0] || options[0];
      if (!active) { host.style.display = 'none'; return; }
      host.style.display = select.dataset.apHidden === '1' ? 'none' : '';

      var dot = function (color) {
        return '<span class="acct-color-dot" style="' +
          (color ? 'background:' + esc(color) : 'background:transparent;border:1px dashed #cbd5e1') +
          '"></span>';
      };

      host.innerHTML =
        '<button type="button" class="acct-switcher-current" aria-haspopup="listbox" aria-expanded="false">' +
          dot(active.color) +
          '<span class="acct-switcher-name">' + esc(active.name) + '</span>' +
          (active.count !== null ? '<span class="acct-switcher-count">' + esc(active.count) + '</span>' : '') +
          '<span class="acct-switcher-caret">&#9660;</span>' +
        '</button>';

      host.appendChild(select); // keep the select inside its host

      var toggle = host.querySelector('.acct-switcher-current');

      /* The menu is appended to <body>, not to the host.
         trading-command's tab strip is overflow-x:auto so it can scroll on
         narrow screens, and a menu rendered inside it was clipped — and worse,
         gave that container a scrollbar the moment it opened. position:fixed
         alone is not enough either: a transformed or filtered ancestor makes
         fixed elements resolve against it instead of the viewport, and this
         strip uses backdrop-filter. Living on <body> removes the whole class
         of problem — no ancestor can clip it, scroll it, or stack over it. */
      var menu = host._apMenu;
      if (!menu) {
        menu = document.createElement('div');
        menu.className = 'ap-acct-menu';
        menu.setAttribute('role', 'listbox');
        menu.style.display = 'none';
        document.body.appendChild(menu);
        host._apMenu = menu;
      }
      menu.innerHTML = options.map(function (o) {
        return '<div class="acct-row' + (o.selected ? ' is-active' : '') + '" role="option" ' +
          'aria-selected="' + (o.selected ? 'true' : 'false') + '" data-value="' + esc(o.value) + '">' +
          dot(o.color) +
          '<span class="acct-row-name">' + esc(o.name) + '</span>' +
          (o.count !== null ? '<span class="acct-row-count">' + esc(o.count) + '</span>' : '') +
        '</div>';
      }).join('');

      var close = function () {
        menu.style.display = 'none';
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      };
      /* Anchor the fixed menu under the trigger, right-edges aligned, and keep
         it on screen if the trigger sits near the viewport edge. */
      var place = host._apPlace = function () {
        var r = toggle.getBoundingClientRect();
        menu.style.top = (r.bottom + 4) + 'px';
        menu.style.left = 'auto';
        menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
        menu.style.minWidth = Math.max(280, r.width) + 'px';
      };
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (toggle.classList.contains('is-open')) return close();
        menu.style.display = '';
        place();
        toggle.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      });

      menu.addEventListener('click', function (e) {
        var row = e.target.closest('.acct-row');
        if (!row) return;
        e.stopPropagation();
        close();
        if (row.dataset.value === select.value) return;
        select.value = row.dataset.value;
        /* Dispatch on the select so the page's own listeners fire exactly as
           they did before this widget existed. */
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      /* Bound once per host. The menu is outside the host now, so the
         outside-click test has to check both. Re-render replaces the trigger,
         so these look it up fresh each time rather than closing over it. */
      if (!host._apGlobalBound) {
        host._apGlobalBound = true;
        /* Closes unconditionally rather than only when an open trigger can be
           found — a re-render swaps the trigger element, and keying off
           '.is-open' meant a stale one could leave the menu stuck open. */
        var closeCurrent = function () {
          if (host._apMenu) host._apMenu.style.display = 'none';
          Array.prototype.forEach.call(host.querySelectorAll('.acct-switcher-current'), function (t) {
            t.classList.remove('is-open');
            t.setAttribute('aria-expanded', 'false');
          });
        };
        document.addEventListener('click', function (e) {
          if (!host.contains(e.target) && !(host._apMenu && host._apMenu.contains(e.target))) closeCurrent();
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') closeCurrent();
        });
        /* Reposition while open — a body-level menu does not travel with its
           trigger. Bound once, not per render, so listeners cannot accumulate. */
        var follow = function () {
          var t = host.querySelector('.acct-switcher-current.is-open');
          if (t && host._apPlace) host._apPlace();
        };
        window.addEventListener('scroll', follow, true);
        window.addEventListener('resize', follow);
      }
    }

    /* Pages toggle their filter's visibility with select.style.display; mirror
       that onto the host so hiding still works. */
    host.setVisible = function (visible) {
      select.dataset.apHidden = visible ? '0' : '1';
      host.style.display = visible ? '' : 'none';
      /* Callers toggle the select's own display to show/hide "the filter".
         Once enhanced it is only the value holder and must never be visible,
         or it renders as a second control beside the widget. */
      select.style.display = 'none';
    };

    render();
    host.refresh = render;
    return host;
  }

  window.AP_ACCT_SWITCHER = { enhance: enhance };
})(window, document);
