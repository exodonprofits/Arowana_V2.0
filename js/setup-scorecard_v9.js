/* ══════════════════════════════════════════════════════════════════════
   setup-scorecard.js — shared trade-setup scorecard, drop-in anywhere
   ══════════════════════════════════════════════════════════════════════
   Same idea as strategy-analyzers.js: one file, one <script> include, no
   per-page markup/CSS to hand-copy. Where strategy-analyzers.js is a pure
   logic registry that each page renders for itself, this module also owns
   its own rendering — because a scorecard IS the UI (inputs, live R:R,
   graded result), not just a data feed a page wraps a grid around. A page
   only needs:

     <div id="mySwingScorecard"></div>
     <script src="./js/setup-scorecard.js"></script>
     <script>SetupScorecard.mount('#mySwingScorecard', { type: 'swing' });</script>

   New scorecard types (day-trade, options, etc.) are added with a single
   SetupScorecard.register() call at the bottom — mount() itself never
   needs to change. Styles are injected once per page (guarded), scoped
   under an `sc-` prefix, and built only from the CSS custom properties
   every core page already declares (--brand, --border, --radius, --card,
   --text, --text-muted, --bg, --font-mono) — no dependency on any single
   page's own class names.

   DATA REALITY:
   - Entry auto-fill uses a Finnhub /quote call (current price only) via
     the same ap_user_api_keys.finnhub BYOK key every other tool reads.
     This module fetches its own quote — it does not assume any other
     script on the page (trading-command.html's tcFetchQuote, etc.) exists.
   - Stop/Target are NOT fetched — a quote can't tell you those. They're
     *suggested starting points* derived from the scorecard type's own
     pass thresholds (see suggestDefaults per type), clearly labeled as
     such, always editable, never presented as a signal.
   - Criteria that need historical bars (trend, volume, entry quality,
     market regime) render as locked "Pro required" rows today, same as
     before. If strategy-analyzers.js is also loaded on the page, a
     locked criterion's `fn` could call window.StrategyAnalyzers.getDailyBars()
     to unlock it using the same Twelve Data / Alpha Vantage BYOK bars
     infra those 20 analyzers already use — that's a natural next step,
     not done in this pass so it doesn't silently change what's graded.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Styles (injected once per page, regardless of how many mount() calls) ──
  function injectStyles() {
    if (document.getElementById('sc-styles')) return;
    const style = document.createElement('style');
    style.id = 'sc-styles';
    style.textContent = `
      .sc-widget { background: var(--card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: var(--radius, 12px); padding: 18px; font-family: inherit; }
      .sc-title { font-size: 1.15rem; font-weight: 700; color: var(--text, #1e293b); margin: 0 0 6px; }
      .sc-subtitle { color: var(--text-muted, #64748b); font-size: 0.88rem; margin: 0 0 14px; }
      .sc-freetier-note { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; margin: 12px 0 16px; font-size: 0.85rem; color: #92400e; line-height: 1.5; }
      .sc-input-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px; }
      .sc-input-grid label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--text-muted, #64748b); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      .sc-input { width: 100%; padding: 11px 14px; border: 2px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 1rem; font-family: var(--font-mono, monospace); font-weight: 600; text-transform: uppercase; outline: none; transition: border-color 0.15s ease; box-sizing: border-box; }
      .sc-input:focus { border-color: var(--brand, #0b4f8a); }
      .sc-num { width: 100%; padding: 11px 12px; border: 2px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 0.95rem; font-family: var(--font-mono, monospace); outline: none; box-sizing: border-box; }
      .sc-num:focus { border-color: var(--brand, #0b4f8a); }
      .sc-autofill-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: -4px 0 10px; min-height: 22px; }
      .sc-autostatus { font-size: 0.78rem; color: var(--text-muted, #64748b); font-style: italic; }
      .sc-autofill-btn { flex-shrink: 0; background: none; border: none; color: var(--brand, #0b4f8a); font-size: 0.78rem; font-weight: 600; cursor: pointer; padding: 2px 4px; }
      .sc-autofill-btn:hover { text-decoration: underline; }
      .sc-live-rr { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.85rem; font-weight: 600; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; }
      .sc-live-rr.rr-good { background: #d1fae5; color: #047857; }
      .sc-live-rr.rr-warn { background: #fef3c7; color: #92400e; }
      .sc-live-rr.rr-bad { background: #fee2e2; color: #b91c1c; }
      .sc-live-rr .rr-detail { font-weight: 400; opacity: 0.85; font-size: 0.78rem; }
      .sc-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
      .sc-btn-primary { display: inline-flex; align-items: center; gap: 6px; background: var(--brand, #0b4f8a); color: #fff; font-weight: 700; padding: 8px 14px; border-radius: 8px; border: none; font-size: 0.88rem; cursor: pointer; transition: transform 0.1s ease; }
      .sc-btn-primary:hover { transform: translateY(-1px); }
      .sc-btn-ghost { display: inline-flex; align-items: center; gap: 6px; background: none; color: var(--text-muted, #64748b); font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border, #e2e8f0); font-size: 0.88rem; cursor: pointer; transition: background 0.15s ease; }
      .sc-btn-ghost:hover { background: var(--bg, #f8fafc); }
      .sc-btn-primary:disabled, .sc-btn-ghost:disabled, .sc-autofill-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; text-decoration: none; }
      .sc-result { background: var(--bg, #f8fafc); border: 1px dashed var(--border, #e2e8f0); border-radius: 8px; padding: 18px; min-height: 80px; }
      .sc-empty { color: var(--text-muted, #64748b); font-size: 0.88rem; text-align: center; }
      .sc-error { color: #b91c1c; font-size: 0.88rem; background: #fef2f2; border-radius: 6px; padding: 10px 12px; }
      .sc-verdict { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: 10px; margin-bottom: 14px; font-weight: 700; flex-wrap: wrap; }
      .sc-verdict-pass { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #14532d; border: 1px solid #86efac; }
      .sc-verdict-caution { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #78350f; border: 1px solid #fcd34d; }
      .sc-verdict-skip { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #7f1d1d; border: 1px solid #fca5a5; }
      .sc-verdict-headline { font-size: 1rem; }
      .sc-verdict-sub { font-size: 0.78rem; font-weight: 500; opacity: 0.85; margin-top: 2px; }
      .sc-verdict-score { font-size: 1.6rem; font-weight: 800; font-family: var(--font-mono, monospace); }
      .sc-rows { display: flex; flex-direction: column; gap: 8px; }
      .sc-row { display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; background: #fff; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; font-size: 0.88rem; }
      .sc-row.row-pass { border-left: 4px solid #16a34a; }
      .sc-row.row-warn { border-left: 4px solid #d97706; }
      .sc-row.row-fail { border-left: 4px solid #dc2626; }
      .sc-row.row-locked { opacity: 0.55; background: #f8fafc; }
      .sc-dot { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; flex-shrink: 0; }
      .sc-dot.dot-pass { background: #16a34a; }
      .sc-dot.dot-warn { background: #d97706; }
      .sc-dot.dot-fail { background: #dc2626; }
      .sc-dot.dot-locked { background: #e2e8f0; color: #64748b; }
      .sc-label { font-weight: 600; color: var(--text, #1e293b); }
      .sc-row.row-locked .sc-label { color: #64748b; }
      .sc-detail { font-size: 0.78rem; color: var(--text-muted, #64748b); font-weight: 400; margin-top: 2px; }
      .sc-row.row-locked .sc-detail { color: #94a3b8; font-style: italic; }
      .sc-value { font-family: var(--font-mono, monospace); font-size: 0.82rem; color: var(--text-muted, #64748b); text-align: right; white-space: nowrap; }
      .sc-row.row-locked .sc-value { color: #94a3b8; font-size: 0.78rem; }
      .sc-sizing { margin-top: 14px; padding: 12px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; font-size: 0.85rem; color: #0c4a6e; }
      .sc-sizing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 8px; }
      .sc-sizing-tile { background: #fff; border-radius: 6px; padding: 8px 10px; border: 1px solid #e0f2fe; }
      .sc-sizing-k { font-size: 0.7rem; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px; }
      .sc-sizing-v { font-family: var(--font-mono, monospace); font-weight: 700; color: var(--text, #1e293b); font-size: 0.95rem; margin-top: 2px; }
      .sc-disclaimer { font-size: 0.75rem; color: var(--text-muted, #64748b); text-align: center; margin-top: 12px; padding: 8px; background: #f9fafb; border-radius: 6px; }
    `;
    document.head.appendChild(style);
  }

  // ── BYOK key + quote fetch — self-sufficient, no dependency on the
  //    host page's own inline helpers ──
  function getFinnhubKey() {
    try {
      const raw = localStorage.getItem('ap_user_api_keys');
      if (!raw) return null;
      const keys = JSON.parse(raw);
      return (keys && keys.finnhub) || null;
    } catch (e) { return null; }
  }

  async function fetchQuote(symbol, key) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const q = await res.json();
      if (q && typeof q.c === 'number' && q.c > 0) return q.c;
      return null;
    } catch (e) { return null; }
  }

  // ── Shared criterion math — reusable across scorecard types ──
  function criterionRR(ctx) {
    const { entry, stop, target } = ctx;
    if (!entry || !stop || !target) return { status: 'fail', label: 'Risk / Reward', detail: 'Enter entry, stop, and target', value: '—' };
    if (stop >= entry) return { status: 'fail', label: 'Risk / Reward', detail: 'Stop must be below entry for a long', value: `Stop $${stop} ≥ Entry $${entry}` };
    if (target <= entry) return { status: 'fail', label: 'Risk / Reward', detail: 'Target must be above entry for a long', value: `Target $${target} ≤ Entry $${entry}` };
    const risk = entry - stop;
    const reward = target - entry;
    const rr = reward / risk;
    if (rr >= 3) return { status: 'pass', label: 'Risk / Reward', detail: 'Excellent R/R — meets prudent swing standard', value: `${rr.toFixed(2)}R` };
    if (rr >= 2) return { status: 'pass', label: 'Risk / Reward', detail: 'Solid R/R — minimum 2:1 met', value: `${rr.toFixed(2)}R` };
    if (rr >= 1.5) return { status: 'warn', label: 'Risk / Reward', detail: 'Below 2:1 — borderline, consider tighter stop or higher target', value: `${rr.toFixed(2)}R` };
    return { status: 'fail', label: 'Risk / Reward', detail: 'Below 1.5:1 — skip this setup', value: `${rr.toFixed(2)}R` };
  }

  function criterionStopPct(ctx) {
    const { entry, stop } = ctx;
    if (!entry || !stop) return { status: 'fail', label: 'Stop Placement', detail: 'Enter entry and stop', value: '—' };
    const stopPct = ((entry - stop) / entry) * 100;
    if (stopPct < 0) return { status: 'fail', label: 'Stop Placement', detail: 'Stop is above entry (invalid for a long)', value: `${stopPct.toFixed(2)}%` };
    if (stopPct >= 3 && stopPct <= 8) return { status: 'pass', label: 'Stop Placement', detail: 'Stop in healthy 3–8% swing range', value: `${stopPct.toFixed(2)}% below entry` };
    if (stopPct < 3) return { status: 'warn', label: 'Stop Placement', detail: 'Very tight stop — high risk of being shaken out by noise', value: `${stopPct.toFixed(2)}% below entry` };
    if (stopPct <= 12) return { status: 'warn', label: 'Stop Placement', detail: 'Stop is wide — reduces position size and R/R', value: `${stopPct.toFixed(2)}% below entry` };
    return { status: 'fail', label: 'Stop Placement', detail: 'Stop too wide for a swing trade — reconsider entry', value: `${stopPct.toFixed(2)}% below entry` };
  }

  // ── Registry — new scorecard types register here, mount() never changes ──
  const registry = {};
  function register(type, config) { registry[type] = config; }

  async function gradeType(type, ctx) {
    const cfg = registry[type];
    if (!cfg) throw new Error('Unknown scorecard type: ' + type);
    const rows = [];
    for (const c of cfg.criteria) {
      if (c.locked) {
        rows.push({ status: 'locked', label: c.label, detail: c.lockedDetail, value: 'Pro required' });
      } else {
        rows.push(await Promise.resolve(c.fn(ctx)));
      }
    }
    return rows;
  }

  function computeVerdict(rows, cfg) {
    const scored = rows.filter(r => r.status !== 'locked');
    const lockedCount = rows.length - scored.length;
    const fails = scored.filter(r => r.status === 'fail').length;
    const warns = scored.filter(r => r.status === 'warn').length;
    const passes = scored.filter(r => r.status === 'pass').length;
    const total = scored.length || 1;
    const score = Math.round((passes * 100 + warns * 50) / total);

    const criticalLabels = cfg.criticalLabels || [];
    const criticalFails = scored.filter(r => r.status === 'fail' && criticalLabels.includes(r.label));
    const partialSuffix = lockedCount > 0 ? ` (${scored.length}/${rows.length} checks · ${lockedCount} need Pro)` : '';

    let verdict, headline, klass;
    if (criticalFails.length > 0) {
      verdict = 'skip'; headline = '❌ SKIP — critical criterion failed' + partialSuffix; klass = 'sc-verdict-skip';
    } else if (fails >= 2 || score < 50) {
      verdict = 'skip'; headline = '❌ SKIP — too many red flags' + partialSuffix; klass = 'sc-verdict-skip';
    } else if (fails >= 1 || warns >= 2 || score < 70) {
      verdict = 'caution'; headline = '⚠️ CAUTION — review the warnings below' + partialSuffix; klass = 'sc-verdict-caution';
    } else {
      verdict = 'pass'; headline = '✅ PASS — basic risk checks met' + partialSuffix; klass = 'sc-verdict-pass';
    }
    return { verdict, headline, klass, score, lockedCount };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderResult(symbol, rows, ctx, cfg) {
    const { klass, headline, score } = computeVerdict(rows, cfg);

    const rowsHtml = rows.map(r => {
      if (r.status === 'locked') {
        return `
          <div class="sc-row row-locked">
            <div class="sc-dot dot-locked">🔒</div>
            <div><div class="sc-label">${esc(r.label)}</div><div class="sc-detail">${esc(r.detail)}</div></div>
            <div class="sc-value">${esc(r.value)}</div>
          </div>`;
      }
      const dotChar = r.status === 'pass' ? '✓' : r.status === 'warn' ? '!' : '✗';
      return `
        <div class="sc-row row-${r.status}">
          <div class="sc-dot dot-${r.status}">${dotChar}</div>
          <div><div class="sc-label">${esc(r.label)}</div><div class="sc-detail">${esc(r.detail)}</div></div>
          <div class="sc-value">${esc(r.value)}</div>
        </div>`;
    }).join('');

    let sizingHtml = '';
    if (ctx.entry && ctx.stop && ctx.stop < ctx.entry) {
      const riskPerShare = ctx.entry - ctx.stop;
      const tiles = [10000, 25000, 50000, 100000].map(size => {
        const shares = Math.floor((size * 0.01) / riskPerShare);
        const positionValue = shares * ctx.entry;
        return `
          <div class="sc-sizing-tile">
            <div class="sc-sizing-k">$${(size / 1000).toFixed(0)}k acct (1%)</div>
            <div class="sc-sizing-v">${shares} sh</div>
            <div class="sc-sizing-k">$${positionValue.toFixed(0)}</div>
          </div>`;
      }).join('');
      sizingHtml = `<div class="sc-sizing"><strong>📐 Position Sizing (1% account risk)</strong><div class="sc-sizing-grid">${tiles}</div></div>`;
    }

    return `
      <div class="sc-verdict ${klass}">
        <div>
          <div class="sc-verdict-headline">${esc(symbol.toUpperCase())} — ${headline}</div>
          <div class="sc-verdict-sub">Score is a heuristic; final call is yours.</div>
        </div>
        <div class="sc-verdict-score">${score}<span style="font-size:0.7rem;font-weight:500">/100</span></div>
      </div>
      <div class="sc-rows">${rowsHtml}</div>
      ${sizingHtml}
    `;
  }

  // ── mount() — the actual cross-platform entry point ──
  function mount(target, opts) {
    opts = opts || {};
    const type = opts.type || 'swing';
    const cfg = registry[type];
    if (!cfg) { console.error('[SetupScorecard] Unknown type:', type); return; }

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.error('[SetupScorecard] Mount target not found:', target); return; }

    injectStyles();

    const uid = 'sc' + Math.random().toString(36).slice(2, 9);
    const ids = {
      ticker: uid + '-ticker', entry: uid + '-entry', stop: uid + '-stop', target: uid + '-target',
      status: uid + '-status', liveRR: uid + '-liverr', result: uid + '-result',
      gradeBtn: uid + '-grade', resetBtn: uid + '-reset', autoBtn: uid + '-auto',
    };

    container.innerHTML = `
      <div class="sc-widget">
        <h3 class="sc-title">${cfg.icon || '📋'} ${esc(cfg.title)}</h3>
        <p class="sc-subtitle">${cfg.subtitle}</p>
        ${cfg.freeTierNote ? `<div class="sc-freetier-note">ℹ️ ${cfg.freeTierNote}</div>` : ''}

        <div class="sc-input-grid">
          <div><label for="${ids.ticker}">Ticker</label><input type="text" id="${ids.ticker}" class="sc-input" placeholder="e.g., MU" maxlength="10" autocomplete="off"></div>
          <div><label for="${ids.entry}">Entry $</label><input type="number" id="${ids.entry}" class="sc-num" placeholder="0.00" step="0.01" min="0"></div>
          <div><label for="${ids.stop}">Stop $</label><input type="number" id="${ids.stop}" class="sc-num" placeholder="0.00" step="0.01" min="0"></div>
          <div><label for="${ids.target}">Target $</label><input type="number" id="${ids.target}" class="sc-num" placeholder="0.00" step="0.01" min="0"></div>
        </div>

        <div class="sc-autofill-row">
          <div id="${ids.status}" class="sc-autostatus"></div>
          <button type="button" id="${ids.autoBtn}" class="sc-autofill-btn">↻ Use live price</button>
        </div>

        <div id="${ids.liveRR}" class="sc-live-rr" style="display:none"></div>

        <div class="sc-actions">
          <button class="sc-btn-primary" type="button" id="${ids.gradeBtn}">⚡ Grade This Setup</button>
          <button class="sc-btn-ghost" type="button" id="${ids.resetBtn}">↺ Reset</button>
        </div>

        <div class="sc-result" id="${ids.result}"><div class="sc-empty">${esc(cfg.emptyText || 'Enter ticker, entry, stop, and target to grade this setup.')}</div></div>

        ${cfg.disclaimer ? `<div class="sc-disclaimer">${cfg.disclaimer}</div>` : ''}
      </div>
    `;

    const $ = id => document.getElementById(id);
    const tickerEl = $(ids.ticker), entryEl = $(ids.entry), stopEl = $(ids.stop), targetEl = $(ids.target);
    const statusEl = $(ids.status), liveRREl = $(ids.liveRR), resultEl = $(ids.result);
    const gradeBtnEl = $(ids.gradeBtn);

    function updateLiveRR() {
      const entry = parseFloat(entryEl.value), stop = parseFloat(stopEl.value), tgt = parseFloat(targetEl.value);
      if (isNaN(entry) || isNaN(stop) || isNaN(tgt) || stop >= entry || tgt <= entry) {
        liveRREl.style.display = 'none'; liveRREl.className = 'sc-live-rr'; liveRREl.innerHTML = '';
        return;
      }
      const risk = entry - stop, reward = tgt - entry, rr = reward / risk;
      const klass = rr >= 2 ? 'rr-good' : rr >= 1.5 ? 'rr-warn' : 'rr-bad';
      liveRREl.style.display = 'flex';
      liveRREl.className = 'sc-live-rr ' + klass;
      liveRREl.innerHTML = `📐 Reward:Risk ${rr.toFixed(2)} : 1 <span class="rr-detail">$${risk.toFixed(2)} risk/sh · $${reward.toFixed(2)} reward/sh</span>`;
    }

    // Tracks any in-flight quote fetch so grade()/reset() can coordinate
    // with it instead of racing it. Earlier this was handled by disabling
    // the buttons during the fetch — but a disabled button silently drops
    // the click event entirely rather than queuing it, so clicking "Grade
    // This Setup" the instant after tabbing off the ticker field (a
    // completely normal, fast workflow) ate the click and needed a second
    // one. grade() now awaits any pending fetch instead, so the click
    // always registers and just resolves once fresh values are in.
    let pendingAutoFill = null;
    let generation = 0;

    async function autoFill(force) {
      const symbol = tickerEl.value.trim().toUpperCase();
      if (!symbol) return;
      if (!/^[A-Z.\-]{1,10}$/.test(symbol)) { statusEl.textContent = 'Enter a valid ticker to auto-fill.'; return; }

      const entryEmpty = !entryEl.value;
      if (!force && !entryEmpty) return;

      const key = getFinnhubKey();
      if (!key) { statusEl.textContent = 'Add your Finnhub API key in Account settings to auto-fill from a live price.'; return; }

      generation++;
      const myGeneration = generation;
      statusEl.textContent = `Fetching ${symbol} price…`;

      const fetchPromise = (async () => {
        try {
          const price = await fetchQuote(symbol, key);
          // A Reset (or a newer autoFill call, e.g. a fast double-click on
          // "Use live price") happened while this was in flight — don't
          // apply now-stale results on top of whatever the user did next.
          if (myGeneration !== generation) return;
          if (!price) { statusEl.textContent = `Couldn't fetch a live price for ${symbol} — enter manually.`; return; }

          entryEl.value = price.toFixed(2);
          if (force || !stopEl.value) {
            const { stop, target } = cfg.suggestDefaults(price);
            stopEl.value = stop.toFixed(2);
            targetEl.value = target.toFixed(2);
            statusEl.textContent = cfg.autofillNote || 'Prefilled from live quote. Adjust to fit your setup.';
          } else {
            statusEl.textContent = `Entry prefilled from live quote ($${price.toFixed(2)}).`;
          }
          updateLiveRR();
          // Clear a stale "please enter entry/stop/target" error from an
          // earlier click now that the fields are actually filled.
          if (resultEl.querySelector('.sc-error')) {
            resultEl.innerHTML = `<div class="sc-empty">${esc(cfg.emptyText || 'Enter ticker, entry, stop, and target to grade this setup.')}</div>`;
          }
        } finally {
          if (pendingAutoFill === fetchPromise) pendingAutoFill = null;
        }
      })();

      pendingAutoFill = fetchPromise;
      return fetchPromise;
    }

    async function grade() {
      if (pendingAutoFill) {
        // grade() already correctly waits for a pending price fetch before
        // proceeding — the bug was that nothing on screen showed this was
        // happening, so a single click looked identical to a click that
        // did nothing, which is what made this feel like it needed two
        // clicks. Now it's visibly working instead of silently waiting.
        const originalBtnText = gradeBtnEl.textContent;
        gradeBtnEl.disabled = true;
        gradeBtnEl.textContent = '⏳ Fetching price…';
        resultEl.innerHTML = '<div class="sc-empty">⏳ Fetching live price before grading…</div>';
        try {
          await pendingAutoFill;
        } finally {
          gradeBtnEl.disabled = false;
          gradeBtnEl.textContent = originalBtnText;
        }
      }

      const symbol = tickerEl.value.trim().toUpperCase();
      const entry = parseFloat(entryEl.value), stop = parseFloat(stopEl.value), tgt = parseFloat(targetEl.value);
      if (!symbol) { resultEl.innerHTML = '<div class="sc-error">Please enter a ticker symbol.</div>'; return; }
      if (!/^[A-Z.\-]{1,10}$/.test(symbol)) { resultEl.innerHTML = '<div class="sc-error">Symbol contains invalid characters.</div>'; return; }
      if (isNaN(entry) || isNaN(stop) || isNaN(tgt)) { resultEl.innerHTML = '<div class="sc-error">Please enter entry, stop, and target prices.</div>'; return; }

      const ctx = { entry, stop, target: tgt };
      const rows = await gradeType(type, ctx);
      resultEl.innerHTML = renderResult(symbol, rows, ctx, cfg);
    }

    function reset() {
      generation++;
      pendingAutoFill = null;
      [tickerEl, entryEl, stopEl, targetEl].forEach(el => { el.value = ''; });
      statusEl.textContent = '';
      resultEl.innerHTML = `<div class="sc-empty">${esc(cfg.emptyText || 'Enter ticker, entry, stop, and target to grade this setup.')}</div>`;
      updateLiveRR();
    }

    $(ids.gradeBtn).addEventListener('click', grade);
    $(ids.resetBtn).addEventListener('click', reset);
    $(ids.autoBtn).addEventListener('click', () => autoFill(true));
    tickerEl.addEventListener('blur', () => autoFill(false));
    [entryEl, stopEl, targetEl].forEach(el => el.addEventListener('input', updateLiveRR));

    [tickerEl, entryEl, stopEl, targetEl].forEach((el, i) => {
      el.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        if (i === 0 && !entryEl.value) autoFill(false);
        grade();
      });
    });

    return { grade, reset, autoFill };
  }

  // ── 'swing' scorecard type — ported 1:1 from the original inline version ──
  register('swing', {
    title: 'Swing Setup Scorecard',
    icon: '📋',
    subtitle: 'Should I take this trade <em>right now</em>? Grades the setup against 6 swing-trade criteria. Pull the trigger only on a clear pass.',
    freeTierNote: '<strong>Free tier:</strong> 2 of 6 criteria run today (Risk/Reward + Stop Placement). Trend, Volume, Entry Quality, and Market Regime require <strong>Finnhub Pro</strong> for historical price data. The 2 free checks cover the most important questions: is your R/R viable, and is your stop sensible?',
    emptyText: 'Enter ticker, entry, stop, and target to grade your swing setup.',
    disclaimer: '⚠️ Educational only. The scorecard checks deterministic criteria (trend, R/R, distance to MAs, sector strength). It does not predict market moves.',
    criticalLabels: ['Risk / Reward'],
    suggestDefaults(entry) {
      const stopPct = 0.05;   // mid of the "healthy" 3–8% stop range this type grades
      const rrTarget = 2.5;   // comfortably inside the "pass" (≥2) band
      const stop = entry * (1 - stopPct);
      const risk = entry - stop;
      const target = entry + risk * rrTarget;
      return { stop: Math.round(stop * 100) / 100, target: Math.round(target * 100) / 100 };
    },
    autofillNote: 'Prefilled from live quote — stop 5% below entry, target for a 2.5:1 reward/risk. Adjust to fit your setup.',
    criteria: [
      { locked: true, label: 'Trend Alignment', lockedDetail: '50DMA / 200DMA check requires Finnhub Pro' },
      { fn: criterionRR },
      { fn: criterionStopPct },
      { locked: true, label: 'Entry Quality', lockedDetail: '20DMA proximity requires Finnhub Pro' },
      { locked: true, label: 'Volume Confirmation', lockedDetail: 'Volume history requires Finnhub Pro' },
      { locked: true, label: 'Market Regime', lockedDetail: 'SPY trend requires Finnhub Pro' },
    ],
  });

  window.SetupScorecard = { register, mount, registry, criterionRR, criterionStopPct };
})();
