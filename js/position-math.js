/* ============================================================================
   Arowana — Position Math  (js/position-math.js)
   ----------------------------------------------------------------------------
   The sizing formulas, lifted verbatim out of position-sizer.html's calculate()
   so Trade Plan Builder can size a plan without owning a second copy that
   drifts. Pure functions only — no DOM, no formatting, no storage. Callers
   format and render.

   Deterministic arithmetic, so nothing here goes near an LLM.

   USAGE
     <script src="./js/position-math.js"></script>

     var plan = AP_MATH.plan({
       account: 25000, riskPct: 1, entry: 150, stop: 145,
       target: 160,               // optional; drives reward/risk
       direction: 'long',         // 'long' | 'short'
       allocationCap: 100         // optional; percent of account, Full mode only
     });

     if (!plan.ok) showMessage(plan.reason);
     else render(plan.shares, plan.actualRisk, ...);

   The caller decides whether allocationCap applies — position-sizer.html only
   honours it in Full mode and passes 100 otherwise. Keeping that decision out
   here means the module has no opinion about interface modes.
   ========================================================================== */
(function (window) {
  'use strict';

  if (window.AP_MATH) return;

  var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };

  /* Guardrail bands. Educational reference, not a rule — these mirror the
     "Risk context" card in position-sizer.html. */
  var RISK_BANDS = [
    { max: 0.5, key: 'lower',    label: 'Lower',             range: 'Up to 0.5%' },
    { max: 1,   key: 'typical',  label: 'Typical guardrail', range: '0.6–1%' },
    { max: 2,   key: 'elevated', label: 'Elevated',          range: '1.1–2%' },
    { max: Infinity, key: 'high', label: 'High caution',     range: 'Above 2%' }
  ];

  function riskBand(riskPct) {
    var pct = num(riskPct);
    for (var i = 0; i < RISK_BANDS.length; i++) {
      if (pct <= RISK_BANDS[i].max) return RISK_BANDS[i];
    }
    return RISK_BANDS[RISK_BANDS.length - 1];
  }

  /* --- the calculation --------------------------------------------------
     Returns {ok:false, reason, code} for anything unsizeable, so the caller
     can show the message rather than a misleading zero. The reason strings are
     the ones position-sizer.html already shows; `code` is there so a page can
     substitute its own wording (Beginner Mode uses plainer language) without
     string-matching. */
  function plan(input) {
    input = input || {};

    var direction = input.direction === 'short' ? 'short' : 'long';
    var account = num(input.account);
    var riskPct = num(input.riskPct);
    var entry = num(input.entry);
    var stop = num(input.stop);
    var target = num(input.target);

    /* Absent or nonsensical caps mean "no cap". */
    var rawCap = num(input.allocationCap);
    var allocation = rawCap > 0 ? Math.min(100, Math.max(1, rawCap)) : 100;

    if (!(account > 0 && riskPct > 0 && entry > 0 && stop > 0)) {
      return {
        ok: false,
        code: 'incomplete',
        reason: 'Complete account size, risk, entry, and invalidation.'
      };
    }

    /* Stop distance per share. A long invalidates below entry, a short above;
       anything else means the plan contradicts itself. */
    var dist = direction === 'long' ? entry - stop : stop - entry;
    if (dist <= 0) {
      return {
        ok: false,
        code: direction === 'long' ? 'stop_above_entry' : 'stop_below_entry',
        reason: direction === 'long'
          ? 'For a long plan, invalidation must be below entry.'
          : 'For a short plan, invalidation must be above entry.'
      };
    }

    var maxRisk = account * riskPct / 100;

    /* Two independent ceilings. Whole shares only — a partial share would
       understate the real risk. */
    var riskShares = Math.floor(maxRisk / dist);
    var capShares = Math.floor(account * allocation / 100 / entry);
    var shares = Math.max(0, Math.min(riskShares, capShares));

    if (shares < 1) {
      return {
        ok: false,
        code: 'no_whole_share',
        reason: 'The selected limits do not allow one whole share at this stop distance.',
        riskShares: riskShares,
        capShares: capShares,
        dist: dist
      };
    }

    var actualRisk = shares * dist;
    var capital = shares * entry;

    /* Reward only counts in the direction of the trade; a target on the wrong
       side of entry yields no R:R rather than a negative one. */
    var reward = target > 0 ? (direction === 'long' ? target - entry : entry - target) : 0;
    var rr = reward > 0 ? reward / dist : null;

    /* Which ceiling actually bound the size — the single most useful number
       for understanding why the answer is what it is. */
    var constraint = capShares < riskShares ? 'Capital allocation' : 'Risk limit';

    return {
      ok: true,
      direction: direction,
      account: account,
      riskPct: riskPct,
      entry: entry,
      stop: stop,
      target: target,
      allocation: allocation,
      dist: dist,
      maxRisk: maxRisk,
      riskShares: riskShares,
      capShares: capShares,
      shares: shares,
      actualRisk: actualRisk,
      actualRiskPct: actualRisk / account * 100,
      capital: capital,
      capitalPct: capital / account * 100,
      reward: reward,
      rr: rr,
      constraint: constraint,
      constraintCode: capShares < riskShares ? 'allocation' : 'risk',
      band: riskBand(riskPct)
    };
  }

  /* --- advisory warnings -------------------------------------------------
     Returned as objects so a page can show plain wording in Beginner Mode and
     the terse version elsewhere. Advisory only — nothing here blocks. */
  function warnings(result) {
    var out = [];
    if (!result || !result.ok) return out;

    if (result.capitalPct > 20) {
      out.push({
        code: 'concentration',
        text: 'This position uses ' + result.capitalPct.toFixed(1) + '% of the account.'
      });
    }
    if (result.riskPct > 2) {
      out.push({ code: 'risk_above_2', text: 'The selected risk limit is above 2%.' });
    }
    if (result.rr !== null && result.rr < 1) {
      out.push({ code: 'reward_below_risk', text: 'The planned reward is smaller than the risk.' });
    }
    return out;
  }

  function summary(result) {
    if (!result || !result.ok) return null;
    var level = result.riskPct > 2 ? 'high' : result.riskPct > 1 ? 'caution' : 'ok';
    return {
      level: level,
      title: level === 'high' ? 'High caution'
           : level === 'caution' ? 'Elevated risk'
           : 'Within selected guardrail'
    };
  }

  /* --- Trade Journal handoff --------------------------------------------
     trade-journal-pro.html's handlePrefillFromURL() reads exactly:
       ticker, asset, side, entry, stop, target, strategy, notes, from
     and — critically — RETURNS IMMEDIATELY IF ticker IS ABSENT. A handoff with
     no symbol silently does nothing, which is why this builder requires one.

     `qty` is emitted for the modal's existing #sQty field. Add it to that
     page's `incoming` map to complete the round trip; until then it is simply
     ignored, so sending it is safe either way. */
  function journalUrl(result, meta, base) {
    meta = meta || {};
    var ticker = String(meta.ticker || '').trim().toUpperCase();
    if (!ticker) return null; // no symbol, no usable handoff

    var url = new URL(base || 'trade-journal-pro.html', window.location.href);
    var p = url.searchParams;

    p.set('ticker', ticker);
    p.set('asset', meta.asset || 'stock');
    p.set('side', (result && result.direction) || 'long');
    if (result && result.ok) {
      p.set('entry', String(result.entry));
      p.set('stop', String(result.stop));
      if (result.target > 0) p.set('target', String(result.target));
      p.set('qty', String(result.shares));
    }
    if (meta.strategy) p.set('strategy', meta.strategy);
    if (meta.notes) p.set('notes', meta.notes);
    p.set('from', meta.from || 'position-sizer');

    return url.href;
  }

  window.AP_MATH = {
    plan: plan,
    warnings: warnings,
    summary: summary,
    riskBand: riskBand,
    RISK_BANDS: RISK_BANDS.slice(),
    journalUrl: journalUrl
  };
})(window);
