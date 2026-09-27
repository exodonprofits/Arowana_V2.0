/**
 * Arowana Pro Desk — Journal Fields Enhancement Module
 * ============================================================================
 * Sprint:    1.2
 * File:      /js/journal-fields.js
 * Targets:   trade-journal-pro.html (both stock and option modals)
 *
 * Purpose
 * -------
 * Add three layers of new captured data to existing journal forms WITHOUT
 * breaking any current functionality:
 *
 *   1. MISTAKE TAGS         multi-select chip group on both stock & option
 *   2. EMOTION PRE / POST   1–5 stepper (1 = calm, 5 = FOMO) on both
 *   3. GREEKS AT ENTRY      IV%, Δ, Θ (option form only, all optional)
 *
 * Design constraints
 * ------------------
 *  - Existing fields stay (sEmotion dropdown still works for backwards compat)
 *  - All new fields optional; old trades render fine with empty new fields
 *  - Reads/writes via the global `stocks` / `options` arrays already defined
 *    in the page. Hooks into saveStock() / saveOpt() / editStock() / editOpt()
 *    via DOM-injected fields whose values are picked up automatically.
 *  - Uses the same `.input`, `.field`, `.row` CSS classes the page already has
 *  - Module is idempotent: safe to re-run init()
 *
 * Mistake tag taxonomy (same across stocks + options, plus 3 options-only)
 * -----------------------------------------------------------------------
 *  Shared:    chased, moved_stop, no_plan, oversized, revenge,
 *             exited_early, held_too_long, ignored_earnings
 *  Options:   iv_crush, gamma_risk, wrong_dte
 *
 * Field IDs introduced
 * --------------------
 *  Stock form:
 *    #sMistakesChips        container, value read via .selected attr
 *    #sEmotionPre           number 1-5
 *    #sEmotionPost          number 1-5
 *
 *  Option form:
 *    #oMistakesChips        container with extra options-only chips
 *    #oEmotionPre           number 1-5
 *    #oEmotionPost          number 1-5
 *    #oIvAtEntry            number, IV %
 *    #oDeltaAtEntry         number, e.g. 0.30 or -0.30
 *    #oThetaAtEntry         number, $/day
 *
 * Wiring
 * ------
 *  After loading this script, call:
 *     window.journalFields.init()
 *
 *  Then in the host page, AFTER the existing saveStock() / saveOpt() build
 *  their `trade` objects but BEFORE they push to localStorage, call:
 *     window.journalFields.augmentStock(trade)
 *     window.journalFields.augmentOption(trade)
 *
 *  And in editStock(id) / editOpt(id), AFTER existing fields are populated:
 *     window.journalFields.hydrateStock(trade)
 *     window.journalFields.hydrateOption(trade)
 *
 *  And in clearStockForm() / clearOptForm():
 *     window.journalFields.clearStock()
 *     window.journalFields.clearOption()
 * ============================================================================
 */

(function () {
  'use strict';

  const STOCK_MISTAKES = [
    { id: 'chased',           label: 'Chased entry'       },
    { id: 'moved_stop',       label: 'Moved stop'         },
    { id: 'no_plan',          label: 'No plan'            },
    { id: 'oversized',        label: 'Oversized'          },
    { id: 'revenge',          label: 'Revenge trade'      },
    { id: 'exited_early',     label: 'Exited too early'   },
    { id: 'held_too_long',    label: 'Held too long'      },
    { id: 'ignored_earnings', label: 'Ignored earnings'   }
  ];

  // Option form gets stock tags PLUS three options-specific tags
  const OPTION_MISTAKES = [
    ...STOCK_MISTAKES,
    { id: 'iv_crush',  label: 'IV crush' },
    { id: 'gamma_risk',label: 'Gamma risk' },
    { id: 'wrong_dte', label: 'Wrong DTE' }
  ];

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    injectStockFields();
    injectOptionFields();
    console.info('[journal-fields] Sprint 1.2 fields injected.');
  }

  // ============================================================================
  // STYLES — minimal, uses existing CSS vars
  // ============================================================================

  function injectStyles() {
    if (document.getElementById('journal-fields-styles')) return;
    const style = document.createElement('style');
    style.id = 'journal-fields-styles';
    style.textContent = `
      .jf-chips {
        display: flex; flex-wrap: wrap; gap: 6px;
        padding: 6px; min-height: 38px;
        background: #fff;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px;
      }
      .jf-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; border-radius: 16px;
        font-size: 12px; font-weight: 600; line-height: 1;
        background: #f1f5f9; color: #475569;
        border: 1px solid transparent;
        cursor: pointer; user-select: none;
        transition: all .12s ease;
      }
      .jf-chip:hover { background: #e2e8f0; }
      .jf-chip.active {
        background: #fee2e2; color: #991b1b;
        border-color: #fca5a5;
      }
      .jf-stepper {
        display: inline-flex; align-items: center; gap: 4px;
        font-family: 'JetBrains Mono', monospace;
      }
      .jf-stepper button {
        width: 28px; height: 28px; line-height: 1;
        border: 1px solid var(--border, #e2e8f0);
        background: #fff; border-radius: 6px;
        cursor: pointer; font-size: 14px; font-weight: 700;
        color: #475569;
      }
      .jf-stepper button:hover { background: #f1f5f9; }
      .jf-stepper input {
        width: 44px; text-align: center;
        padding: 4px; border: 1px solid var(--border, #e2e8f0);
        border-radius: 6px; font-family: inherit; font-size: 13px;
      }
      .jf-stepper-scale {
        font-size: 11px; color: #94a3b8;
        margin-left: 6px;
      }
      .jf-help {
        font-size: 11px; color: #94a3b8;
        margin-top: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // STOCK FORM INJECTION
  // ============================================================================

  function injectStockFields() {
    const modal = document.getElementById('stockModal');
    if (!modal) return;
    const body = modal.querySelector('.modal-body') || modal;
    // Insert just before the Emotion Tag dropdown (existing), so new fields
    // appear at the bottom of the form near the related emotion select
    const emotionField = modal.querySelector('#sEmotion')?.closest('.field');
    const anchor = emotionField || body.lastElementChild;

    if (document.getElementById('sMistakesChips')) return; // already injected

    const html = `
      <div class="field" id="sMistakesField">
        <label class="field-label">Mistake Tags (optional, multi-select)</label>
        <div class="jf-chips" id="sMistakesChips">
          ${STOCK_MISTAKES.map(m =>
            `<span class="jf-chip" data-id="${m.id}">${m.label}</span>`
          ).join('')}
        </div>
        <div class="jf-help">Tag any execution mistakes — feeds the AI Coach later.</div>
      </div>
      <div class="row two">
        <div class="field">
          <label class="field-label">Emotion at Entry</label>
          <div class="jf-stepper">
            <button type="button" data-step="-1" data-target="sEmotionPre">−</button>
            <input class="input" id="sEmotionPre" type="number" min="1" max="5" placeholder="–">
            <button type="button" data-step="1" data-target="sEmotionPre">+</button>
            <span class="jf-stepper-scale">1 = calm · 5 = FOMO</span>
          </div>
        </div>
        <div class="field">
          <label class="field-label">Emotion at Exit</label>
          <div class="jf-stepper">
            <button type="button" data-step="-1" data-target="sEmotionPost">−</button>
            <input class="input" id="sEmotionPost" type="number" min="1" max="5" placeholder="–">
            <button type="button" data-step="1" data-target="sEmotionPost">+</button>
            <span class="jf-stepper-scale">1 = calm · 5 = panic</span>
          </div>
        </div>
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    Array.from(wrap.children).forEach(node => anchor.parentNode.insertBefore(node, anchor.nextSibling));

    wireChipsContainer('sMistakesChips');
    wireSteppers();
  }

  // ============================================================================
  // OPTION FORM INJECTION
  // ============================================================================

  function injectOptionFields() {
    const modal = document.getElementById('optModal');
    if (!modal) return;
    const body = modal.querySelector('.modal-body') || modal;
    // Insert before the Notes field if present; otherwise at the end
    const notesField = modal.querySelector('#oNotes')?.closest('.field');
    const anchor = notesField || body.lastElementChild;

    if (document.getElementById('oMistakesChips')) return;

    const html = `
      <div class="row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div class="field">
          <label class="field-label">IV at Entry (%)</label>
          <input class="input" id="oIvAtEntry" type="number" min="0" max="500" step="0.1" placeholder="optional">
        </div>
        <div class="field">
          <label class="field-label">Δ at Entry</label>
          <input class="input" id="oDeltaAtEntry" type="number" min="-1" max="1" step="0.01" placeholder="optional, e.g. 0.30">
        </div>
        <div class="field">
          <label class="field-label">Θ at Entry ($/day)</label>
          <input class="input" id="oThetaAtEntry" type="number" step="0.01" placeholder="optional, e.g. -0.05">
        </div>
      </div>
      <div class="field" id="oMistakesField">
        <label class="field-label">Mistake Tags (optional, multi-select)</label>
        <div class="jf-chips" id="oMistakesChips">
          ${OPTION_MISTAKES.map(m =>
            `<span class="jf-chip" data-id="${m.id}">${m.label}</span>`
          ).join('')}
        </div>
        <div class="jf-help">Includes options-specific tags: IV crush, gamma risk, wrong DTE.</div>
      </div>
      <div class="row two">
        <div class="field">
          <label class="field-label">Emotion at Entry</label>
          <div class="jf-stepper">
            <button type="button" data-step="-1" data-target="oEmotionPre">−</button>
            <input class="input" id="oEmotionPre" type="number" min="1" max="5" placeholder="–">
            <button type="button" data-step="1" data-target="oEmotionPre">+</button>
            <span class="jf-stepper-scale">1 = calm · 5 = FOMO</span>
          </div>
        </div>
        <div class="field">
          <label class="field-label">Emotion at Exit</label>
          <div class="jf-stepper">
            <button type="button" data-step="-1" data-target="oEmotionPost">−</button>
            <input class="input" id="oEmotionPost" type="number" min="1" max="5" placeholder="–">
            <button type="button" data-step="1" data-target="oEmotionPost">+</button>
            <span class="jf-stepper-scale">1 = calm · 5 = panic</span>
          </div>
        </div>
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    Array.from(wrap.children).forEach(node => anchor.parentNode.insertBefore(node, anchor.nextSibling));

    wireChipsContainer('oMistakesChips');
    wireSteppers();
  }

  // ============================================================================
  // INTERACTION WIRING
  // ============================================================================

  function wireChipsContainer(id) {
    const root = document.getElementById(id);
    if (!root || root.dataset.wired) return;
    root.dataset.wired = '1';
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('.jf-chip');
      if (!chip) return;
      chip.classList.toggle('active');
    });
  }

  function wireSteppers() {
    document.querySelectorAll('.jf-stepper button').forEach(btn => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const step = parseInt(btn.getAttribute('data-step'), 10) || 0;
        const input = document.getElementById(targetId);
        if (!input) return;
        const cur = parseInt(input.value, 10);
        const next = clamp((Number.isFinite(cur) ? cur : 0) + step, 1, 5);
        input.value = next || '';
      });
    });
  }

  // ============================================================================
  // DATA HELPERS — augment / hydrate / clear
  // ============================================================================

  function readChips(containerId) {
    const root = document.getElementById(containerId);
    if (!root) return [];
    return Array.from(root.querySelectorAll('.jf-chip.active'))
                .map(el => el.getAttribute('data-id'));
  }

  function writeChips(containerId, ids) {
    const root = document.getElementById(containerId);
    if (!root) return;
    const set = new Set(Array.isArray(ids) ? ids : []);
    root.querySelectorAll('.jf-chip').forEach(el => {
      el.classList.toggle('active', set.has(el.getAttribute('data-id')));
    });
  }

  function readNum(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : null;
  }

  function readInt(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? v : null;
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /**
   * Add the new fields onto a trade object built by saveStock().
   * Idempotent: missing values become null/[], no overwrite of unrelated keys.
   */
  function augmentStock(trade) {
    if (!trade) return trade;
    trade.mistakes    = readChips('sMistakesChips');
    trade.emotionPre  = readInt('sEmotionPre');
    trade.emotionPost = readInt('sEmotionPost');
    return trade;
  }

  function augmentOption(trade) {
    if (!trade) return trade;
    trade.mistakes     = readChips('oMistakesChips');
    trade.emotionPre   = readInt('oEmotionPre');
    trade.emotionPost  = readInt('oEmotionPost');
    trade.ivAtEntry    = readNum('oIvAtEntry');
    trade.deltaAtEntry = readNum('oDeltaAtEntry');
    trade.thetaAtEntry = readNum('oThetaAtEntry');
    return trade;
  }

  /**
   * Populate the new fields when editing an existing trade.
   */
  function hydrateStock(trade) {
    if (!trade) return;
    writeChips('sMistakesChips', trade.mistakes);
    setVal('sEmotionPre',  trade.emotionPre);
    setVal('sEmotionPost', trade.emotionPost);
  }

  function hydrateOption(trade) {
    if (!trade) return;
    writeChips('oMistakesChips', trade.mistakes);
    setVal('oEmotionPre',   trade.emotionPre);
    setVal('oEmotionPost',  trade.emotionPost);
    setVal('oIvAtEntry',    trade.ivAtEntry);
    setVal('oDeltaAtEntry', trade.deltaAtEntry);
    setVal('oThetaAtEntry', trade.thetaAtEntry);
  }

  function clearStock() {
    writeChips('sMistakesChips', []);
    setVal('sEmotionPre', '');
    setVal('sEmotionPost', '');
  }

  function clearOption() {
    writeChips('oMistakesChips', []);
    setVal('oEmotionPre', '');
    setVal('oEmotionPost', '');
    setVal('oIvAtEntry', '');
    setVal('oDeltaAtEntry', '');
    setVal('oThetaAtEntry', '');
  }

  // ============================================================================
  // EXPOSE + AUTO-INIT
  // ============================================================================

  window.journalFields = {
    init,
    augmentStock, augmentOption,
    hydrateStock, hydrateOption,
    clearStock,   clearOption,
    // Constants for any UI that wants to display labels
    STOCK_MISTAKES, OPTION_MISTAKES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
