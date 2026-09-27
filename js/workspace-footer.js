/* ============================================================================
   Arowana — Workspace Footer  (js/workspace-footer.js)
   ----------------------------------------------------------------------------
   Collapses the full site footer down to one compliance line on the eleven
   authenticated workspace pages.

   WHY
   The full footer carries a copyright line, four nav links, a "Secure platform"
   badge and a risk note — roughly 120px of vertical space on every workspace.
   A signed-in user on a scanner does not need the copyright, and the nav links
   duplicate the rail two feet to the left. That height was making every page
   fight the same battle for the fold.

   WHAT IS KEPT, AND WHY IT IS NOT ALL OF IT
   The risk note stays: "Trading and investing involve risk… not financial
   advice." These are the screens where someone actually decides to trade, so
   removing the disclaimer from the workspace and leaving it only on marketing
   pages would put it exactly where it matters least. Disclosures and Support
   stay with it, since a disclaimer nobody can follow up on is decoration.

   Dropped: copyright, Terms, Privacy, the security badge. All still one click
   away in the full footer on index/pricing/login.

   USAGE
     <script src="./js/workspace-footer.js"></script>

   Runs itself. Marketing pages are left alone — it only slims a footer on a
   page that also has a signed-in session, so index.html keeps the full one even
   though it loads the same script bundle.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var STYLE_ID = 'ap-workspace-footer-styles';

  function isSignedIn() {
    try {
      var raw = localStorage.getItem('gs_auth_user_v1') ||
                sessionStorage.getItem('gs_auth_user_v1');
      if (!raw) return false;
      var u = JSON.parse(raw);
      /* An id is the real test — an object without one is the stale
         cross-product cache, not a session. */
      return !!(u && u.id);
    } catch (_) { return false; }
  }

  /* Marketing pages keep the full footer even when signed in: someone reading
     the pricing page is being sold to, not working. */
  var MARKETING = ['index.html', 'pricing.html', 'login.html', 'signup.html',
                   'about.html', 'contact.html', ''];

  function isMarketingPage() {
    var file = (location.pathname || '').split('/').pop().toLowerCase();
    return MARKETING.indexOf(file) !== -1;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.ap-ws-footer{flex:0 0 auto;margin-top:auto;padding:9px 20px;' +
        'border-top:1px solid var(--border,#d7e0e6);background:var(--card,#fff);' +
        'display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}' +
      '.ap-ws-footer p{margin:0;color:var(--text-muted,#64748b);font-size:.68rem;line-height:1.5}' +
      '.ap-ws-footer nav{display:flex;gap:14px;flex:0 0 auto}' +
      '.ap-ws-footer a{color:var(--brand,#0b4f8a);font-size:.68rem;font-weight:700;text-decoration:none}' +
      '.ap-ws-footer a:hover{text-decoration:underline}' +
      '@media(max-width:640px){.ap-ws-footer{justify-content:flex-start}}';
    document.head.appendChild(st);
  }

  function slim() {
    if (!isSignedIn() || isMarketingPage()) return;

    var full = document.querySelector('footer.site-footer, footer.compact-footer');
    if (!full || full.dataset.apSlimmed === '1') return;

    injectStyles();

    var slimFooter = document.createElement('footer');
    slimFooter.className = 'ap-ws-footer';
    slimFooter.dataset.apSlimmed = '1';
    slimFooter.innerHTML =
      '<p>Trading and investing involve risk. Arowana Profits provides educational ' +
      'tools and information &mdash; not financial advice.</p>' +
      '<nav aria-label="Legal">' +
        '<a href="disclosures.html">Disclosures</a>' +
        '<a href="support.html">Support</a>' +
      '</nav>';

    full.parentNode.replaceChild(slimFooter, full);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', slim);
  } else {
    slim();
  }

  /* The session can resolve after this runs — session-user.js repairs a cache
     that lost its id, and auth-header.js can rebuild one from the live session.
     Re-check rather than deciding once on a race. */
  window.addEventListener('ap:config:ready', slim);
  setTimeout(slim, 1500);

  window.AP_WORKSPACE_FOOTER = { slim: slim, isSignedIn: isSignedIn };
})(window, document);
