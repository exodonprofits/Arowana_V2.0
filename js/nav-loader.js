/**
 * nav-loader.js — chooses which navigation a page loads (ATD-008)
 * ============================================================
 * Pages migrated to the registry-driven navigation load this file instead
 * of js/nav-rail.js. It inserts, in order:
 *   - js/arowana-nav-registry.js + js/arowana-nav.js (the new navigation,
 *     the default from wave 2, decision D10), or
 *   - js/nav-rail.js when this browser has opted out with
 *     localStorage "ap_nav_v2" = "0".
 *
 * Rollback for every migrated page at once: set USE_NEW_NAV_BY_DEFAULT to
 * false here. Individual pages roll back by restoring their single
 * <script src="./js/nav-rail.js"></script> tag.
 *
 * Load it as a plain script at the end of <body>, where nav-rail.js was.
 * Pages without a sidebar mark <body data-nav-shell> (or data-nav-shell="member"
 * to show it to signed-in members only); js/arowana-nav.js then
 * builds the rail itself, and opting out loads nothing on them (ATD-009).
 */
(function () {
  'use strict';

  var USE_NEW_NAV_BY_DEFAULT = true;
  var VERSION = '20261007b';

  var pref = null;
  try { pref = window.localStorage.getItem('ap_nav_v2'); } catch (_) { /* storage blocked */ }
  var useNew = pref === '1' || (pref !== '0' && USE_NEW_NAV_BY_DEFAULT);

  var files = useNew
    ? ['./js/arowana-nav-registry.js?v=' + VERSION, './js/arowana-nav.js?v=' + VERSION]
    : ['./js/nav-rail.js'];

  function insert() {
    // Pages that had no rail before ATD-009 (<body data-nav-shell>) keep their
    // own top navigation when opted out, exactly as they were.
    if (!useNew && document.body.hasAttribute('data-nav-shell')) return;
    files.forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;   // dynamic scripts run in insertion order
      document.body.appendChild(s);
    });
  }

  if (document.body) insert();
  else document.addEventListener('DOMContentLoaded', insert, { once: true });
})();
