/**
 * Arowana Pro Desk — Journal Sync Module
 * ============================================================================
 * Sprint:    1.1 (gating task — unlocks Sprints 2-4)
 * File:      /js/journal-sync.js
 * Targets:   trade-journal-pro.html
 *
 * Purpose
 * -------
 * Mirror localStorage trades (tj_stocks_v2 / tj_options_v2) to Supabase tables
 * (tj_stocks / tj_options) for server-side query access. Without this module,
 * Risk Desk, AI Coach, and the CC/CSP scanners cannot read the user's trades.
 *
 * Design constraints (from the master plan, do not violate)
 * ---------------------------------------------------------
 *  - localStorage is the source of truth. Supabase is a mirror.
 *  - LS keys tj_stocks_v2 / tj_options_v2 must not be renamed.
 *  - Works fully offline. Sync failures never break the journal.
 *  - Mirror pattern matches short-term-watchlist.html (status pill, etc.).
 *  - No new dependencies. Uses the same @supabase/supabase-js client the
 *    journal page already loads via auth-header.js.
 *
 * Public API (exposed on window.journalSync)
 * ------------------------------------------
 *   await journalSync.init()                       // call once on page load
 *   journalSync.upsertStock(trade)                 // call after saveLS(LS_STOCKS)
 *   journalSync.upsertOption(trade)                // call after saveLS(LS_OPTIONS)
 *   journalSync.deleteStock(id)                    // call before saveLS(LS_STOCKS) on delete
 *   journalSync.deleteOption(id)                   // call before saveLS(LS_OPTIONS) on delete
 *   journalSync.pullNow()                          // manual pull (refresh button)
 *   journalSync.getStatus()                        // returns current pill state
 *
 * Sync pill states (rendered in #journalSyncPill if present)
 * ----------------------------------------------------------
 *   loading       ⏳ Loading...
 *   signed-out    🪪 Sign in to sync
 *   synced        ✓ Synced
 *   syncing       ↻ Syncing...
 *   error         ⚠ Sync error
 *   local-only    💾 Local only
 *
 * Dependencies (already present in trade-journal-pro.html)
 * --------------------------------------------------------
 *   - @supabase/supabase-js client at one of:
 *       window.sbClient
 *       SB (from page-local sbInit())
 *   - localStorage with tj_stocks_v2 and tj_options_v2
 *   - gs_auth_user_v1 (auth gate already enforces this)
 * ============================================================================
 */

(function () {
  'use strict';

  // ---- Constants ---------------------------------------------------------
  const LS_STOCKS  = 'tj_stocks_v2';
  const LS_OPTIONS = 'tj_options_v2';
  const SB_STOCKS  = 'tj_stocks';
  const SB_OPTIONS = 'tj_options';

  const DEBOUNCE_MS    = 1000;   // batch rapid edits into single upsert
  const RETRY_DELAYS   = [2000, 5000, 15000];  // exponential-ish retries
  const PILL_ID        = 'journalSyncPill';

  // ---- State -------------------------------------------------------------
  let sb              = null;     // Supabase JS client (real one)
  let userId          = null;     // auth.uid() of current user
  let status          = 'loading';
  let pendingStocks   = new Map(); // id -> trade (debounced)
  let pendingOptions  = new Map();
  let pendingDeletes  = { stocks: new Set(), options: new Set() };
  let upsertTimer     = null;
  let retryQueue      = [];        // { kind, table, row, attempt }
  let initialized     = false;

  // ============================================================================
  // INIT
  // ============================================================================

  async function init() {
    if (initialized) return;
    initialized = true;

    setStatus('loading');
    ensurePill();

    // Wait for Supabase client to be available (page sets it up async)
    sb = await waitForClient();
    if (!sb) {
      setStatus('local-only');
      console.warn('[journal-sync] ⚠ No Supabase client found after 10s wait — running LOCAL ONLY. Writes will NOT sync to cloud.');
      return;
    }
    console.info('[journal-sync] ✓ Supabase client acquired');

    // Need a signed-in session for RLS
    let session = null;
    try {
      const r = await sb.auth.getSession();
      session = r?.data?.session;
    } catch (e) {
      console.error('[journal-sync] ✗ getSession() threw:', e);
    }
    if (!session) {
      setStatus('signed-out');
      console.warn('[journal-sync] ⚠ No auth session attached to client. Writes will NOT be saved to Supabase until you sign in.');
      console.warn('[journal-sync]   This is the most common cause of "data not syncing" issues.');
      // Listen for sign-in
      sb.auth.onAuthStateChange((event, sess) => {
        console.info('[journal-sync] auth state change:', event, sess?.user?.email);
        if (event === 'SIGNED_IN' && sess) {
          userId = sess.user.id;
          console.info('[journal-sync] ✓ Signed in as', sess.user.email, '— user_id:', userId);
          pullThenSync();
        } else if (event === 'SIGNED_OUT') {
          userId = null;
          setStatus('signed-out');
        }
      });
      return;
    }

    userId = session.user.id;
    console.info('[journal-sync] ✓ Session active for user_id:', userId, '· email:', session.user.email);
    await pullThenSync();
  }

  /**
   * Wait up to 10 seconds for a Supabase JS client to be available.
   *
   * Resolution order:
   *  1. window.sbClient        — explicit client created by host page (legacy)
   *  2. SB                     — page-local global (legacy)
   *  3. Create our own         — using window.supabase + credentials from
   *                              window.AP_WEBHOOKS.supabase (set by app-config.js)
   *
   * Path #3 is the canonical post-Sprint-1.1 path; it removes the need for
   * any sync glue code in the host page.
   */
  function waitForClient() {
    return new Promise(resolve => {
      const deadline = Date.now() + 10_000;
      const tick = () => {
        // Path 1: pre-existing client on the page (back-compat)
        if (window.sbClient && typeof window.sbClient.from === 'function') {
          return resolve(window.sbClient);
        }
        // Path 2: legacy global SB
        try {
          if (typeof SB !== 'undefined' && SB && typeof SB.from === 'function') {
            return resolve(SB);
          }
        } catch { /* SB not defined in this scope — fall through */ }

        // Path 3: build our own from the @supabase/supabase-js global +
        // credentials exposed by app-config.js (or legacy GS_SUPABASE_*).
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          const cfg = (window.AP_WEBHOOKS && window.AP_WEBHOOKS.supabase) || {};
          const url = cfg.url || window.GS_SUPABASE_URL;
          const key = cfg.anonKey || cfg.anon_key || window.GS_SUPABASE_KEY;
          if (url && key) {
            try {
              const client = window.supabase.createClient(url, key, {
                auth: { persistSession: true, autoRefreshToken: true }
              });
              // Cache so other modules in the page can reuse the same client
              window.sbClient = client;
              return resolve(client);
            } catch (e) {
              console.warn('[journal-sync] Failed to create Supabase client:', e);
            }
          }
        }

        if (Date.now() > deadline) return resolve(null);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  async function pullThenSync() {
    setStatus('syncing');
    try {
      await pullFromServer();
      await drainRetryQueue();
      // Also flush anything sitting in the pending upsert/delete maps —
      // these are writes made while there was no session at all, so
      // schedulePush() returned early and they were never even attempted,
      // meaning they were never added to retryQueue either. Without this,
      // "will drain on next sign-in" (see schedulePush()) was only true
      // for writes that had already been tried and failed — a write made
      // entirely offline would sit here until some unrelated future edit
      // happened to call schedulePush() again.
      if (pendingStocks.size || pendingOptions.size || pendingDeletes.stocks.size || pendingDeletes.options.size) {
        await flushPending();
      }

      /* Reconcile once per device per user.
         ------------------------------------------------------------------
         The two paths above only ever move rows that CHANGED: the push sends
         what was edited this session, and pullFromServer() asks only for rows
         newer than the newest local updatedAt. Neither can see a row that
         simply never arrived — so a device that falls behind stays behind,
         silently, forever. That is how this browser ended up holding 1,125
         stock trades the server had never received while missing 210 the
         server had, with no error anywhere.

         An id-diff is the only thing that catches that, and it is expensive
         enough (a full id list for both tables) not to run on every load. Once
         per device is the right frequency: a fresh browser, a cleared cache or
         a new machine each get exactly one reconciliation, and steady-state
         syncing handles everything after that. */
      await reconcileOnce();

      setStatus('synced');
    } catch (e) {
      console.warn('[journal-sync] Initial pull failed:', e);
      setStatus('error');
    }
  }

  // ============================================================================
  // PULL — fetch server rows newer than local and merge by id
  // ============================================================================

  const PULL_PAGE_SIZE = 1000; // matches Supabase/PostgREST's own default row cap

  /**
   * Pulls every row matching a query, paging through in PULL_PAGE_SIZE
   * chunks instead of a single unbounded request. Without this, an
   * account with more rows than Supabase's default cap (1000) would
   * silently lose everything past that point — and since pullFromServer
   * only ever asks for rows newer than what's already local, a
   * truncated pull never gets a second chance to catch the rest.
   * queryFactory must return a FRESH query builder each call (Supabase's
   * builder can't be reused across multiple .range() calls).
   */
  async function pullAllPages(queryFactory) {
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await queryFactory().range(from, from + PULL_PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PULL_PAGE_SIZE) break; // last page — fewer rows than a full page
      from += PULL_PAGE_SIZE;
    }
    return allRows;
  }

  async function pullFromServer() {
    if (!sb || !userId) return;

    const localStocks  = loadLS(LS_STOCKS);
    const localOptions = loadLS(LS_OPTIONS);

    const stocksMax   = localStocks.reduce((m, r)  => maxIso(m, r.updatedAt || r.updated_at), null);
    const optionsMax  = localOptions.reduce((m, r) => maxIso(m, r.updatedAt || r.updated_at), null);

    // Stocks
    const serverStocks = await pullAllPages(() => {
      let q = sb.from(SB_STOCKS).select('*').eq('user_id', userId);
      if (stocksMax) q = q.gt('updated_at', stocksMax);
      return q;
    });

    if (Array.isArray(serverStocks) && serverStocks.length) {
      const merged = mergeById(localStocks, serverStocks.map(unwrapStock));
      saveLS(LS_STOCKS, merged);
      notifyPage('stocks');
    }

    // Options
    const serverOptions = await pullAllPages(() => {
      let q2 = sb.from(SB_OPTIONS).select('*').eq('user_id', userId);
      if (optionsMax) q2 = q2.gt('updated_at', optionsMax);
      return q2;
    });

    if (Array.isArray(serverOptions) && serverOptions.length) {
      const merged = mergeById(localOptions, serverOptions.map(unwrapOption));
      saveLS(LS_OPTIONS, merged);
      notifyPage('options');
    }
  }

  /**
   * Server row -> local row shape. Server has both promoted columns and a
   * `payload` jsonb of the full local row; we trust the payload first and
   * overlay any newer promoted values.
   */
  function unwrapStock(serverRow) {
    const base = serverRow.payload || {};
    return {
      ...base,
      id: serverRow.id,
      updatedAt: serverRow.updated_at || base.updatedAt
    };
  }

  function unwrapOption(serverRow) {
    const base = serverRow.payload || {};
    return {
      ...base,
      id: serverRow.id,
      updatedAt: serverRow.updated_at || base.updatedAt
    };
  }

  function mergeById(local, server) {
    const map = new Map(local.map(t => [t.id, t]));
    for (const r of server) {
      const existing = map.get(r.id);
      if (!existing) { map.set(r.id, r); continue; }
      // newer wins
      const a = existing.updatedAt || existing.updated_at || '';
      const b = r.updatedAt || r.updated_at || '';
      map.set(r.id, b > a ? { ...existing, ...r } : existing);
    }
    return Array.from(map.values());
  }

  // ============================================================================
  // PUSH — debounced upserts
  // ============================================================================

  function upsertStock(trade) {
    if (!trade || !trade.id) return;
    pendingStocks.set(trade.id, trade);
    schedulePush();
  }

  function upsertOption(trade) {
    if (!trade || !trade.id) return;
    pendingOptions.set(trade.id, trade);
    schedulePush();
  }

  function deleteStock(id) {
    if (!id) return;
    pendingStocks.delete(id);            // cancel any pending upsert
    pendingDeletes.stocks.add(id);
    schedulePush();
  }

  function deleteOption(id) {
    if (!id) return;
    pendingOptions.delete(id);
    pendingDeletes.options.add(id);
    schedulePush();
  }

  function schedulePush() {
    if (!sb || !userId) {
      // No session yet — this write stays in pendingStocks/pendingOptions
      // (already set by the caller) and is picked up by pullThenSync()'s
      // explicit flush once a session becomes available, not by this
      // function scheduling anything.
      return;
    }
    if (upsertTimer) clearTimeout(upsertTimer);
    upsertTimer = setTimeout(flushPending, DEBOUNCE_MS);
  }

  async function flushPending() {
    upsertTimer = null;
    if (!sb || !userId) return;

    const stocksOut  = Array.from(pendingStocks.values());
    const optionsOut = Array.from(pendingOptions.values());
    const stockDels  = Array.from(pendingDeletes.stocks);
    const optionDels = Array.from(pendingDeletes.options);

    pendingStocks.clear();
    pendingOptions.clear();
    pendingDeletes.stocks.clear();
    pendingDeletes.options.clear();

    setStatus('syncing');
    let ok = true;

    if (stocksOut.length) {
      ok = (await pushStocks(stocksOut)) && ok;
    }
    if (optionsOut.length) {
      ok = (await pushOptions(optionsOut)) && ok;
    }
    if (stockDels.length) {
      ok = (await deleteRows(SB_STOCKS, stockDels)) && ok;
    }
    if (optionDels.length) {
      ok = (await deleteRows(SB_OPTIONS, optionDels)) && ok;
    }

    setStatus(ok ? 'synced' : 'error');
  }

  async function pushStocks(trades) {
    const rows = trades.map(buildStockRow);
    return await upsertWithRetry(SB_STOCKS, rows);
  }

  async function pushOptions(trades) {
    const rows = trades.map(buildOptionRow);
    return await upsertWithRetry(SB_OPTIONS, rows);
  }

  async function deleteRows(table, ids) {
    try {
      // .in('id', [...]) becomes a query-string filter, so a thousand ids is a
      // URL long enough to be rejected. Same chunking rationale as the upsert.
      for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
        const chunk = ids.slice(i, i + DELETE_CHUNK);
        const { error } = await sb.from(table)
          .delete()
          .in('id', chunk)
          .eq('user_id', userId);
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.warn(`[journal-sync] delete ${table} failed:`, e);
      // Add back to retry queue
      ids.forEach(id => retryQueue.push({ kind: 'delete', table, id, attempt: 0 }));
      scheduleRetry();
      return false;
    }
  }

  /**
   * Rows per upsert request.
   *
   * The pull side has always paged (see pullAllPages and PULL_PAGE_SIZE) but
   * the push side sent every pending row in a single .upsert() call. A CSV
   * import queues one upsert per row, so a 625-trade import became one request
   * carrying 625 full payload jsonb blobs — large enough to fail — and the
   * retry re-sent the identical oversized body, so it failed the same way
   * every time before parking in retryQueue, which regrouped it into one
   * oversized request again. It could never drain.
   *
   * 200 keeps each request comfortably small while staying well under
   * PostgREST's own limits, and a chunk that fails now only takes its own
   * rows down rather than the whole import.
   */
  const UPSERT_CHUNK = 200;
  const DELETE_CHUNK = 200;

  /**
   * Splits large upserts into sequential chunks. Each chunk goes through
   * upsertOnce() with its own retry budget, so one bad chunk cannot discard
   * the rest of the import. Returns false if ANY chunk ultimately failed.
   */
  async function upsertWithRetry(table, rows, attempt = 0) {
    if (rows && rows.length > UPSERT_CHUNK && attempt === 0) {
      let allOk = true;
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const chunk = rows.slice(i, i + UPSERT_CHUNK);
        const ok = await upsertOnce(table, chunk, 0);
        allOk = ok && allOk;
      }
      console.info(`[journal-sync] ${table}: pushed ${rows.length} rows in ` +
        `${Math.ceil(rows.length / UPSERT_CHUNK)} chunks (all ok: ${allOk})`);
      return allOk;
    }
    return await upsertOnce(table, rows, attempt);
  }

  /* RLS rejections and auth failures are permanent for these rows. Matched on
     the Postgres code and the message, since PostgREST surfaces them slightly
     differently depending on the operation. */
  function isPermissionError(e) {
    const msg = String((e && (e.message || e.error_description)) || e || '').toLowerCase();
    const code = String((e && e.code) || '');
    return code === '42501' ||
           msg.includes('row-level security') ||
           msg.includes('permission denied') ||
           msg.includes('jwt');
  }

  async function upsertOnce(table, rows, attempt = 0) {
    if (!sb || !userId) {
      console.error(`[journal-sync] ✗ Cannot upsert ${table}: ${!sb ? 'no client' : 'no userId'}. Rows lost!`);
      _lastError = 'No client or session — sign in first';
      _failedWrites += rows.length;
      _showErrorToast(`Cannot sync to Supabase: not signed in. ${rows.length} ${table} row${rows.length>1?'s':''} not saved.`);
      return false;
    }
    try {
      const { data, error } = await sb.from(table)
        .upsert(rows, { onConflict: 'id' })
        .select('id');
      if (error) throw error;

      // Verify: count how many of our rows came back
      const returnedIds = new Set((data||[]).map(r => r.id));
      const submittedIds = rows.map(r => r.id);
      const verified = submittedIds.filter(id => returnedIds.has(id)).length;
      const missing = submittedIds.length - verified;

      if (missing > 0) {
        console.warn(`[journal-sync] ⚠ ${table}: upsert returned without error but ${missing}/${submittedIds.length} rows missing from response — RLS may be silently rejecting`);
        _lastError = `RLS may be rejecting ${missing} rows`;
        _failedWrites += missing;
      } else {
        console.info(`[journal-sync] ✓ ${table}: ${verified} rows upserted and verified`);
      }
      _successfulWrites += verified;
      return true;
    } catch (e) {
      console.error(`[journal-sync] ✗ upsert ${table} attempt ${attempt} failed:`, e.message || e);
      _lastError = e.message || String(e);

      /* A permission denial is NOT transient. Retrying an RLS rejection re-sends
         the identical forbidden rows, so it fails identically every time, then
         parks in retryQueue and is retried again — a loop that can never succeed
         and hammers the server with 403s. Fail fast and say why. */
      if (isPermissionError(e)) {
        console.error(`[journal-sync] ✗ ${table}: refused by row-level security. ` +
          `These ${rows.length} row(s) do not belong to the signed-in user, so they ` +
          `will NOT be retried. Usually this means the local cache belongs to a ` +
          `different account.`);
        _failedWrites += rows.length;
        _showErrorToast('Sync refused: those records belong to a different account.');
        return false;                       // deliberately not queued
      }

      if (attempt < RETRY_DELAYS.length) {
        await wait(RETRY_DELAYS[attempt]);
        return upsertWithRetry(table, rows, attempt + 1);
      }
      // Final failure: park in queue, will drain on next sign-in or pullNow()
      console.error(`[journal-sync] ✗ ${table}: gave up after ${RETRY_DELAYS.length} retries. ${rows.length} rows in retry queue.`);
      _failedWrites += rows.length;
      _showErrorToast(`Sync failed: ${e.message || 'unknown'}. ${rows.length} rows queued for retry.`);
      rows.forEach(r => retryQueue.push({ kind: 'upsert', table, row: r, attempt: 0 }));
      scheduleRetry();
      return false;
    }
  }

  // Track sync health so diagnose() can report it
  let _lastError = null;
  let _successfulWrites = 0;
  let _failedWrites = 0;
  let _lastToastAt = 0;

  function _showErrorToast(msg){
    // Throttle: don't spam — at most one toast per 5 seconds
    const now = Date.now();
    if (now - _lastToastAt < 5000) return;
    _lastToastAt = now;
    try {
      if (typeof window.toast === 'function') {
        window.toast(msg, 'err');
      } else {
        // Fallback: append a banner
        let banner = document.getElementById('jsErrorBanner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'jsErrorBanner';
          banner.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#dc2626;color:#fff;padding:12px 18px;border-radius:8px;font-family:system-ui;font-size:.85rem;z-index:99999;max-width:380px;box-shadow:0 8px 16px rgba(0,0,0,0.2);';
          document.body.appendChild(banner);
        }
        banner.textContent = '⚠ ' + msg;
        setTimeout(() => banner?.remove(), 8000);
      }
    } catch(_) {}
  }

  function scheduleRetry() {
    // Background drain: try every 30 s while queue has work
    if (window._jsRetryInterval) return;
    window._jsRetryInterval = setInterval(async () => {
      if (!retryQueue.length || !sb || !userId) {
        clearInterval(window._jsRetryInterval);
        window._jsRetryInterval = null;
        return;
      }
      await drainRetryQueue();
    }, 30_000);
  }

  async function drainRetryQueue() {
    if (!retryQueue.length || !sb || !userId) return;

    const upserts = retryQueue.filter(r => r.kind === 'upsert');
    const deletes = retryQueue.filter(r => r.kind === 'delete');
    retryQueue = [];

    // Group upserts by table
    const byTable = new Map();
    for (const r of upserts) {
      if (!byTable.has(r.table)) byTable.set(r.table, []);
      byTable.get(r.table).push(r.row);
    }
    for (const [table, rows] of byTable) {
      await upsertWithRetry(table, rows);
    }
    // Group deletes by table
    const delByTable = new Map();
    for (const r of deletes) {
      if (!delByTable.has(r.table)) delByTable.set(r.table, []);
      delByTable.get(r.table).push(r.id);
    }
    for (const [table, ids] of delByTable) {
      await deleteRows(table, ids);
    }
  }

  // ============================================================================
  // ROW BUILDERS — map local camelCase row to server row (payload + promoted)
  // ============================================================================

  function buildStockRow(t) {
    return {
      id:           t.id,
      user_id:      userId,
      payload:      t,                                  // full local row, jsonb
      symbol:       (t.ticker || '').toUpperCase() || null,
      status:       t.status || 'open',
      entry_date:   toDate(t.entryDate),
      exit_date:    toDate(t.exitDate),
      setup_type:   t.setup || null,
      mistakes:     Array.isArray(t.mistakes) ? t.mistakes : [],
      emotion_pre:  toIntOrNull(t.emotionPre),
      emotion_post: toIntOrNull(t.emotionPost || t.emotion),
      r_multiple:   toNumOrNull(t.rMultiple),
      updated_at:   t.updatedAt || new Date().toISOString()
    };
  }

  function buildOptionRow(t) {
    return {
      id:             t.id,
      user_id:        userId,
      payload:        t,
      underlying:     (t.ticker || '').toUpperCase() || null,
      strategy:       t.strategy || null,
      status:         t.status || 'open',
      entry_date:     toDate(t.entryDate),
      exit_date:      toDate(t.exitDate),
      manage_by:      toDate(t.manageBy),
      dte_entry:      toIntOrNull(t.dte),
      iv_at_entry:    toNumOrNull(t.ivAtEntry),
      delta_at_entry: toNumOrNull(t.deltaAtEntry),
      theta_at_entry: toNumOrNull(t.thetaAtEntry),
      assignment:    !!t.assignment,
      mistakes:       Array.isArray(t.mistakes) ? t.mistakes : [],
      r_multiple:     toNumOrNull(t.rMultiple),
      updated_at:     t.updatedAt || new Date().toISOString()
    };
  }

  // ============================================================================
  // STATUS PILL
  // ============================================================================

  function setStatus(next) {
    status = next;
    paintPill();
  }

  function getStatus() { return status; }

  function ensurePill() {
    if (document.getElementById(PILL_ID)) return;
    // The host page may or may not have placed a pill container. If not,
    // we look for the header and inject one.
    const header = document.querySelector('.app-header')
                || document.querySelector('header')
                || document.body;
    if (!header) return;
    const pill = document.createElement('span');
    pill.id = PILL_ID;
    pill.style.cssText = `
      display:inline-flex;align-items:center;gap:6px;
      padding:4px 10px;border-radius:12px;
      font-size:12px;font-weight:600;line-height:1;
      background:#eef2ff;color:#3730a3;
      border:1px solid rgba(99,102,241,0.25);
      margin-left:8px;cursor:default;user-select:none;
    `;
    pill.title = 'Journal sync status — click to refresh';
    pill.addEventListener('click', () => pullNow());
    header.appendChild(pill);
    paintPill();
  }

  function paintPill() {
    const el = document.getElementById(PILL_ID);
    if (!el) return;
    // If status is 'signed-out' but auth-header.js has a locally cached user,
    // the user is logged in to the app — they just don't have an active
    // Supabase JWT (which is what RLS needs for cloud sync). The honest
    // label is "Local only" not "Sign in to sync."
    let effectiveStatus = status;
    if (effectiveStatus === 'signed-out') {
      try {
        const cached = localStorage.getItem('gs_auth_user_v1') ||
                       sessionStorage.getItem('gs_auth_user_v1');
        if (cached && cached !== 'null') effectiveStatus = 'local-only';
      } catch (_) { /* storage blocked — keep original */ }
    }
    const map = {
      'loading':     { txt: '⏳ Loading…',        bg: '#eef2ff', fg: '#3730a3' },
      'signed-out':  { txt: '🪪 Sign in to sync', bg: '#fef3c7', fg: '#92400e' },
      'syncing':     { txt: '↻ Syncing…',         bg: '#eef2ff', fg: '#3730a3' },
      'synced':      { txt: '✓ Synced',           bg: '#d1fae5', fg: '#065f46' },
      'error':       { txt: '⚠ Sync error',       bg: '#fee2e2', fg: '#991b1b' },
      'local-only':  { txt: '💾 Local only',      bg: '#f3f4f6', fg: '#374151' }
    };
    const s = map[effectiveStatus] || map.synced;
    el.textContent = s.txt;
    el.style.background = s.bg;
    el.style.color = s.fg;
  }

  // ============================================================================
  // PUBLIC HELPERS
  // ============================================================================

  async function pullNow() {
    if (!sb || !userId) return;
    setStatus('syncing');
    try {
      await pullFromServer();
      await drainRetryQueue();
      setStatus('synced');
    } catch (e) {
      console.warn('[journal-sync] pullNow failed:', e);
      setStatus('error');
    }
  }

  // ============================================================================
  // UTILS
  // ============================================================================

  function loadLS(k)        { try { return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch { return []; } }
  function saveLS(k, arr)   { localStorage.setItem(k, JSON.stringify(arr)); }
  function toDate(v)        { if (!v) return null; const s = String(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0,10) : null; }
  function toIntOrNull(v)   { const n = parseInt(v); return Number.isFinite(n) ? n : null; }
  function toNumOrNull(v)   { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
  function maxIso(a, b)     { if (!a) return b || null; if (!b) return a; return b > a ? b : a; }
  function wait(ms)         { return new Promise(r => setTimeout(r, ms)); }
  async function safe(fn)   { try { return await fn(); } catch { return null; } }

  /**
   * Notify the host page that local data changed so it can re-render.
   * The journal already listens for the 'storage' event for cross-tab
   * updates; we synthesise a CustomEvent on this tab as well.
   */
  function notifyPage(kind) {
    window.dispatchEvent(new CustomEvent('journal-sync:pulled', { detail: { kind } }));
  }

  // ============================================================================
  // EXPOSE
  // ============================================================================

  // Public diagnostic — paste `await journalSync.diagnose()` in console to inspect state
  async function diagnose() {
    let sessionInfo = null;
    let writeTest = null;
    try {
      if (sb && sb.auth?.getSession) {
        const r = await sb.auth.getSession();
        const s = r?.data?.session;
        sessionInfo = s ? {
          signed_in: true,
          user_id: s.user.id,
          email: s.user.email,
          expires_at: new Date(s.expires_at * 1000).toISOString()
        } : { signed_in: false };
      }
    } catch (e) {
      sessionInfo = { error: e.message };
    }

    // Live count from Supabase
    let cloudCount = null;
    if (sb && userId) {
      try {
        const { count: sc } = await sb.from(SB_STOCKS).select('*', { count: 'exact', head: true }).eq('user_id', userId);
        const { count: oc } = await sb.from(SB_OPTIONS).select('*', { count: 'exact', head: true }).eq('user_id', userId);
        cloudCount = { stocks: sc, options: oc };
      } catch (e) {
        cloudCount = { error: e.message };
      }
    }

    const localStocks  = (function(){try{return JSON.parse(localStorage.getItem(LS_STOCKS)||'[]').length;}catch{return 0;}})();
    const localOptions = (function(){try{return JSON.parse(localStorage.getItem(LS_OPTIONS)||'[]').length;}catch{return 0;}})();

    const report = {
      sync_loaded: true,
      sb_client_present: !!sb,
      sb_client_authed: !!userId,
      user_id: userId,
      session: sessionInfo,
      status: status,
      last_error: _lastError,
      successful_writes_this_session: _successfulWrites,
      failed_writes_this_session: _failedWrites,
      retry_queue_size: retryQueue.length,
      local: { stocks: localStocks, options: localOptions },
      cloud: cloudCount
    };

    console.table({
      'Sync Layer':          report.sync_loaded ? '✓ loaded' : '✗ NOT loaded',
      'Supabase Client':     report.sb_client_present ? '✓ present' : '✗ MISSING',
      'Session Active':      report.sb_client_authed ? '✓ ' + report.user_id : '✗ NOT SIGNED IN',
      'Status':              report.status,
      'Local Stocks':        report.local.stocks,
      'Local Options':       report.local.options,
      'Cloud Stocks':        report.cloud?.stocks ?? 'N/A',
      'Cloud Options':       report.cloud?.options ?? 'N/A',
      'Successful Writes':   report.successful_writes_this_session,
      'Failed Writes':       report.failed_writes_this_session,
      'Last Error':          report.last_error || '(none)'
    });

    return report;
  }

  // Force immediate flush (no debounce) — useful after bulk import
  async function flushNow() {
    if (upsertTimer) { clearTimeout(upsertTimer); upsertTimer = null; }
    await flushPending();
    return diagnose();
  }

  // ============================================================================
  // CACHE OWNERSHIP — whose trades are in this browser?
  // ============================================================================
  /**
   * localStorage is scoped to the BROWSER, not the user. tj_stocks_v2 has no
   * idea who it belongs to, so signing in as someone else leaves the previous
   * account's trades sitting there looking like the new user's unsynced work.
   *
   * That is not theoretical: it pushed 1,456 of one user's trades at another
   * user's id, and only RLS stopped them landing in the wrong account. The
   * console filled with 403s while the retry loop tried again and again.
   *
   * So the local store now carries an owner stamp, and anything that WRITES to
   * the server checks it first. Data whose owner does not match is quarantined,
   * never uploaded and never shown — it is not this user's to push, and it is
   * not ours to silently delete either, since it may contain trades that never
   * reached the server.
   */
  const OWNER_KEY = 'ap_journal_owner_v1';

  function cacheOwner() {
    try { return localStorage.getItem(OWNER_KEY); } catch (_) { return null; }
  }
  function claimCache(uid) {
    try { localStorage.setItem(OWNER_KEY, uid); } catch (_) {}
  }

  /**
   * Returns true when the local journal is safe to sync for this user.
   * Quarantines it and returns false when it belongs to somebody else.
   */
  function ensureCacheOwnership() {
    if (!userId) return false;
    const owner = cacheOwner();

    if (owner === userId) return true;

    const hasLocal = ((loadLS(LS_STOCKS) || []).length + (loadLS(LS_OPTIONS) || []).length) > 0;

    /* No stamp and no data: a clean browser. Claim it. */
    if (!owner && !hasLocal) { claimCache(userId); return true; }

    /* No stamp but data present: written before ownership stamping existed.
       It could be this user's (the common case — an existing install) or a
       previous user's. Unknowable from here, so DON'T guess and DON'T push.
       The user can reconcile deliberately with journalSync.backfill(), which
       claims the cache on success. */
    if (!owner && hasLocal) {
      console.warn('[journal-sync] Local journal has no owner stamp, so it will not be ' +
        'auto-synced. If these trades are yours, run journalSync.backfill({ commit: true }) ' +
        'once to claim and reconcile them.');
      return false;
    }

    /* Stamped for a different user: quarantine, do not upload, do not display. */
    console.warn(`[journal-sync] Local journal belongs to a different account (${owner}). ` +
      'Quarantining it and starting clean for this user — nothing was deleted.');
    quarantineForeignCache(owner);
    claimCache(userId);
    return true;
  }

  /* Moves the other account's data aside under its own key rather than deleting
     it. It may hold trades that never reached the server, and destroying
     someone's history to fix a display bug is the wrong trade. */
  function quarantineForeignCache(owner) {
    const stamp = 'ap_quarantine_' + (owner || 'unknown') + '_';
    [LS_STOCKS, LS_OPTIONS].forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw && raw !== '[]') localStorage.setItem(stamp + key, raw);
        localStorage.setItem(key, '[]');
      } catch (_) {}
    });
    try { localStorage.removeItem('ap_journal_reconciled_v1'); } catch (_) {}
    notifyPage('stocks');
    notifyPage('options');
  }

  // ============================================================================
  // FIRST-RUN RECONCILIATION
  // ============================================================================
  const RECONCILED_KEY = 'ap_journal_reconciled_v1';

  /**
   * Runs backfill({commit:true}) once per device per user, then records that it
   * has. Failures are NOT recorded, so a reconciliation interrupted by a dead
   * network is retried on the next load rather than silently skipped.
   *
   * Deliberately does not run on every load: it costs a full id list for both
   * tables, and after the first pass ordinary syncing keeps things level.
   */
  async function reconcileOnce() {
    if (!sb || !userId) return;

    /* Never auto-push a cache that is not provably this user's. This guard is
       the whole reason the ownership stamp exists. */
    if (!ensureCacheOwnership()) return;

    let done = {};
    try { done = JSON.parse(localStorage.getItem(RECONCILED_KEY) || '{}'); } catch (_) {}
    if (done[userId]) return;

    try {
      const r = await backfill({ commit: true });
      const moved = (r.stocks.missing || 0) + (r.stocks.missingLocally || 0) +
                    (r.options.missing || 0) + (r.options.missingLocally || 0);
      if (!r.ok) {
        console.warn('[journal-sync] first-run reconciliation incomplete — will retry next load.');
        return;                       // not recorded, so it runs again
      }
      if (moved) {
        console.info(`[journal-sync] first-run reconciliation moved ${moved} row(s) into sync.`);
      }
      done[userId] = new Date().toISOString();
      try { localStorage.setItem(RECONCILED_KEY, JSON.stringify(done)); } catch (_) {}
    } catch (e) {
      console.warn('[journal-sync] first-run reconciliation failed — will retry next load:', e.message || e);
    }
  }

  // ============================================================================
  // BACKFILL — reconcile local rows the server never received
  // ============================================================================
  /**
   * Why this exists
   * ---------------
   * pendingStocks/pendingOptions and retryQueue are in-memory. They are empty
   * on every page load, so this module only ever pushes rows CHANGED IN THE
   * CURRENT SESSION. There is no step that asks "what does the server not
   * have?" — which meant a failed import stayed failed forever: the rows were
   * queued once, the push failed, the tab closed, and nothing re-queued them.
   *
   * Chunked upserts (see UPSERT_CHUNK) stop that happening again. They cannot
   * recover what was already lost, hence this.
   *
   * Safe by default: reports what it WOULD send and changes nothing. Pass
   * { commit: true } to actually write.
   *
   *   await journalSync.backfill()                  // dry run — just look
   *   await journalSync.backfill({ commit: true })  // send them
   */
  async function backfill(opts) {
    opts = opts || {};
    const commit = opts.commit === true;

    if (!sb || !userId) {
      console.warn('[backfill] no Supabase client or user id — sign in first.');
      return { ok: false, reason: 'not-signed-in' };
    }

    /* A commit claims the cache: running backfill deliberately is how an
       unstamped install says "yes, these are mine". A dry run claims nothing. */
    if (commit) {
      const owner = cacheOwner();
      if (owner && owner !== userId) {
        console.error('[backfill] refused: the local journal belongs to a different ' +
          'account (' + owner + '). Sign in as that user, or clear this browser.');
        return { ok: false, reason: 'foreign-cache', owner: owner };
      }
      claimCache(userId);
    }

    const result = { ok: true, commit: commit, stocks: {}, options: {} };

    for (const [kind, table, lsKey] of [
      ['stocks',  SB_STOCKS,  LS_STOCKS],
      ['options', SB_OPTIONS, LS_OPTIONS],
    ]) {
      const local = loadLS(lsKey) || [];

      // Server ids only — cheap, and all the diff needs.
      let serverIds = new Set();
      try {
        const rows = await pullAllPages(() =>
          sb.from(table).select('id').eq('user_id', userId));
        serverIds = new Set((rows || []).map(r => r.id));
      } catch (e) {
        console.error(`[backfill] could not read ${table}:`, e.message || e);
        result.ok = false;
        result[kind] = { error: String(e.message || e) };
        continue;
      }

      const missing = local.filter(r => r && r.id && !serverIds.has(r.id));

      /* The mirror-image gap. pullFromServer() only asks for rows NEWER than
         the newest local updatedAt, so rows written on another device before
         that point can never come down — they stay invisible here forever
         while sitting safely on the server. That is why this browser showed
         1,246 stock trades against 1,456 on the server: KPIs, win rate and
         every pattern analysis were computed over an incomplete history. */
      const localIds = new Set(local.map(r => r && r.id).filter(Boolean));
      const missingLocallyIds = [...serverIds].filter(id => !localIds.has(id));

      /* Duplicate fingerprints are reported, never silently dropped. Two rows
         with the same ticker, dates, quantity and price may be a double import
         OR two genuinely identical fills, and this module cannot tell which.
         Deciding that is the user's call, not a side effect of a backfill. */
      const seen = new Map();
      missing.forEach(r => {
        /* The fingerprint MUST match the shape of the row. An option is
           identified by its contract — strike, expiry and type — and its cost
           lives in premiumIn, not entryPrice. A stock-shaped fingerprint
           collapsed every option on the same ticker and date into one, so a
           $140 put and an $825 call counted as duplicates of each other and
           the reported count was meaningless. */
        const fp = kind === 'options'
          ? ['opt', r.ticker, r.strike, r.expiry, r.optType, r.entryDate,
             r.qty, r.premiumIn, r.exitDate, r.premiumOut].join('|')
          : ['stk', r.ticker, r.entryDate, r.qty, r.entryPrice,
             r.exitDate, r.exitPrice].join('|');
        seen.set(fp, (seen.get(fp) || 0) + 1);
      });
      const dupeExtras = Array.from(seen.values()).reduce((a, n) => a + (n - 1), 0);

      result[kind] = {
        local: local.length,
        onServer: serverIds.size,
        missing: missing.length,              /* local rows the server lacks  */
        missingLocally: missingLocallyIds.length, /* server rows this browser lacks */
        duplicateExtras: dupeExtras,
      };

      if (!commit) continue;

      // ── Push: local rows the server never received ──────────────────────
      if (missing.length) {
        const rows = missing.map(kind === 'stocks' ? buildStockRow : buildOptionRow);
        const ok = await upsertWithRetry(table, rows);   // chunked internally
        result[kind].pushed = ok;
        if (!ok) result.ok = false;
      }

      // ── Pull: server rows this browser never saw ────────────────────────
      if (missingLocallyIds.length) {
        try {
          const fetched = [];
          /* Fetched by id in chunks — .in() becomes a query-string filter, so
             a thousand ids is a URL long enough to be rejected. */
          for (let i = 0; i < missingLocallyIds.length; i += DELETE_CHUNK) {
            const idChunk = missingLocallyIds.slice(i, i + DELETE_CHUNK);
            const { data, error } = await sb.from(table)
              .select('*').eq('user_id', userId).in('id', idChunk);
            if (error) throw error;
            if (data) fetched.push(...data);
          }
          const unwrap = kind === 'stocks' ? unwrapStock : unwrapOption;
          /* mergeById keeps whichever side has the newer updatedAt, so a local
             edit made offline is never clobbered by an older server copy. */
          const merged = mergeById(local, fetched.map(unwrap));
          saveLS(lsKey, merged);
          notifyPage(kind);
          result[kind].pulled = fetched.length;
          console.info(`[backfill] ${table}: pulled ${fetched.length} row(s) this browser was missing`);
        } catch (e) {
          console.error(`[backfill] could not pull missing ${table} rows:`, e.message || e);
          result[kind].pulled = 0;
          result.ok = false;
        }
      }
    }

    console.info('[backfill]' + (commit ? '' : ' DRY RUN —'), result);
    if (!commit) {
      console.info('[backfill] nothing was written. "missing" = rows the server ' +
                   'lacks (will be pushed); "missingLocally" = rows this browser ' +
                   'lacks (will be pulled). Re-run with ' +
                   'journalSync.backfill({ commit: true }) to reconcile both.');
    }
    return result;
  }

  window.journalSync = {
    backfill,
    cacheOwner,
    reconcileOnce,
    init,
    upsertStock,
    upsertOption,
    deleteStock,
    deleteOption,
    pullNow,
    getStatus,
    diagnose,
    flushNow
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
