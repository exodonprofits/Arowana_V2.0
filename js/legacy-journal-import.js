/* ============================================================================
   legacy-journal-import.js — ATD-009 phase 4
   ----------------------------------------------------------------------------
   Shared by the retired browser-only journals (trade-journal.html,
   options-journal.html). Their trades lived only in this browser's
   localStorage. The page lists them and adds the ones the user ticks to the
   Trade Journal through js/journal-sync.js (upsertStock / upsertOption), the
   same path Trade Journal Pro and Portfolio Command use. Trades that already
   match one in the journal start unticked. The old browser save is never
   changed. With nothing saved the page redirects to its target.

   Load after supabase_min.js, sb.js and journal-sync.js, then call
     AP_LEGACY_IMPORT.run({
       sourceKey, target, kind: 'stock' | 'option',
       columns: [[label, fn(row) -> text, 'num'?], ...],
       toTrade: fn(row) -> { trade } | { skip: 'reason' },
       matchKey: fn(trade) -> string,      // same key for old and journal trades
       csvName
     });
   Renders with createElement/textContent only.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function setStatus(t) { $('status').textContent = t; }
  function setMsg(t, err) { var m = $('msg'); m.textContent = t || ''; m.className = err ? 'err' : ''; }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }

  // Same id format Trade Journal Pro's genId() uses for new trades.
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Wait for journal-sync's first pull: before that it has not confirmed who
  // owns this browser's journal cache.
  function journalReady(timeoutMs) {
    var deadline = Date.now() + (timeoutMs || 15000);
    return new Promise(function (resolve, reject) {
      (function poll() {
        var js = window.journalSync, st = js && js.getStatus ? js.getStatus() : null;
        if (st === 'synced' || st === 'error') return resolve(js);
        if (st === 'signed-out') return reject(new Error('Sign in to add these trades to your Trade Journal.'));
        if (st === 'local-only') return reject(new Error('Could not reach your Trade Journal. Reload the page and try again.'));
        if (Date.now() > deadline) return reject(new Error('Your Trade Journal is still syncing — reload and try again.'));
        setTimeout(poll, 250);
      })();
    });
  }

  function csvCell(v) { var s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function download(name, rows) {
    var keys = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
    var lines = [keys.join(',')].concat(rows.map(function (r) { return keys.map(function (k) { return csvCell(r[k]); }).join(','); }));
    var url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  async function run(cfg) {
    var lsKey = cfg.kind === 'option' ? 'tj_options_v2' : 'tj_stocks_v2';
    var table = cfg.kind === 'option' ? 'tj_options' : 'tj_stocks';
    var source = [];
    try {
      var raw = JSON.parse(localStorage.getItem(cfg.sourceKey) || '[]');
      source = Array.isArray(raw) ? raw.filter(function (r) { return r && typeof r === 'object'; }) : [];
    } catch (e) { source = []; }
    if (!source.length) {
      setStatus('Taking you to the Trade Journal…');
      window.location.replace(cfg.target);
      return;
    }

    var items = source.map(function (r) {
      var out = cfg.toTrade(r) || { skip: 'Cannot be imported' };
      return { row: r, trade: out.trade || null, skip: out.skip || null, key: out.trade ? cfg.matchKey(out.trade) : null };
    });
    var inJournal = {}, journalOk = false, user = null;

    setStatus('You have ' + source.length + ' trade' + (source.length === 1 ? '' : 's') + ' saved in this browser by the old journal.');
    $('csvBtn').addEventListener('click', function () { download(cfg.csvName, source); });
    $('importBtn').addEventListener('click', doImport);

    function picked() { return items.filter(function (it) { return it.box && it.box.checked && !it.box.disabled; }); }
    function updateButton() {
      var n = picked().length;
      $('importBtn').disabled = n === 0;
      $('importBtn').textContent = n ? 'Import ' + n + ' into journal' : 'Import into journal';
    }
    function tag(td, text, cls) { td.textContent = ''; var s = document.createElement('span'); s.className = 'tag ' + (cls || ''); s.textContent = text; td.appendChild(s); }

    function render() {
      var head = $('head'); head.textContent = '';
      var hr = document.createElement('tr');
      [''].concat(cfg.columns.map(function (c) { return c[0]; })).concat(['Status']).forEach(function (label, i) {
        var th = document.createElement('th'); th.textContent = label;
        var col = cfg.columns[i - 1]; if (col && col[2]) th.className = col[2];
        hr.appendChild(th);
      });
      head.appendChild(hr);
      var body = $('rows'); body.textContent = '';
      items.forEach(function (it) {
        var tr = document.createElement('tr');
        var c = document.createElement('td');
        var box = document.createElement('input');
        box.type = 'checkbox';
        var dup = !!(it.key && inJournal[it.key]);
        box.checked = journalOk && !!it.trade && !dup && !it.done;
        box.disabled = !journalOk || !it.trade || !!it.done;
        box.addEventListener('change', updateButton);
        it.box = box;
        c.appendChild(box); tr.appendChild(c);
        cfg.columns.forEach(function (col) {
          var td = document.createElement('td');
          var v = col[1](it.row);
          td.textContent = v == null || v === '' ? '—' : String(v);
          if (col[2]) td.className = col[2];
          tr.appendChild(td);
        });
        var st = document.createElement('td');
        if (it.done) tag(st, 'Imported', 'done');
        else if (!it.trade) tag(st, it.skip, 'warn');
        else if (dup) tag(st, 'Already in your journal');
        else tag(st, 'Not in your journal', 'new');
        tr.appendChild(st);
        body.appendChild(tr);
      });
      $('trades').style.display = 'block';
      updateButton();
    }

    async function doImport() {
      var list = picked();
      if (!list.length) return;
      $('importBtn').disabled = true;
      setMsg('Importing…');
      try {
        var js = await journalReady();
        var trades = list.map(function (it) { return Object.assign({}, it.trade, { id: newId(), updatedAt: new Date().toISOString() }); });
        // Keep this browser's journal cache in step, only when journal-sync
        // has stamped it as this user's.
        if (js.cacheOwner && js.cacheOwner() === user.id) {
          try {
            var arr = JSON.parse(localStorage.getItem(lsKey) || '[]') || [];
            localStorage.setItem(lsKey, JSON.stringify(arr.concat(trades)));
          } catch (e) { console.warn('[legacy-import] journal cache not updated:', e); }
        }
        trades.forEach(function (t) { if (cfg.kind === 'option') js.upsertOption(t); else js.upsertStock(t); });
        await js.flushNow();
        list.forEach(function (it) { it.done = true; inJournal[it.key] = true; });
        render();
        setMsg(js.getStatus() === 'synced'
          ? 'Imported ' + list.length + ' trade' + (list.length === 1 ? '' : 's') + ' into your Trade Journal.'
          : 'Saved on this device; your Trade Journal will finish syncing it automatically.');
      } catch (e) {
        setMsg(e && e.message ? e.message : 'Import failed.', true);
        updateButton();
      }
    }

    var sb = window.supabaseClient;
    try {
      var s = sb ? await withTimeout(sb.auth.getSession(), 8000) : null;
      user = s && s.data && s.data.session ? s.data.session.user : null;
    } catch (e) { user = null; }
    if (!user) {
      setMsg('Sign in to add these trades to your Trade Journal. You can download them now.', true);
      render();
      return;
    }
    try {
      await journalReady();
      var q = await withTimeout(sb.from(table).select('payload').eq('user_id', user.id), 15000);
      if (q.error) throw q.error;
      (q.data || []).forEach(function (r) { if (r.payload) inJournal[cfg.matchKey(r.payload)] = true; });
      journalOk = true;
    } catch (e) {
      setMsg((e && e.message && !/timeout/.test(e.message) ? e.message : 'Could not read your Trade Journal.') + ' Import is off until it loads; reload to try again.', true);
    }
    render();
  }

  window.AP_LEGACY_IMPORT = { run: run };
})();
