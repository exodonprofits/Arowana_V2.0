/* ====================================================================
   ACCOUNT REGISTRY — Sprint 1.6
   Shared canonical account list used by trade-journal-pro.html and
   portfolio-command.html (and future options-hub.html / ai-coach.html).

   Storage:
   - localStorage-primary: 'ap_accounts_v1'  [{id,name,broker,entityType,color}]
   - Supabase-secondary:   arowana.entities + arowana.financial_accounts
     (best-effort — page keeps working local-only if not signed in, if the
     arowana schema isn't exposed yet in Project Settings > API, or if the
     network call fails for any reason)

   One-time migration: on first load, if 'ap_accounts_v1' doesn't exist yet,
   merges 'tj_accounts_v1' and 'pc_accounts_v1' (legacy per-page registries)
   by case-insensitive name match. Legacy keys are left untouched (read-only
   fallback) — nothing here deletes them.

   NOTE on color: color is local-display-only metadata and is NOT synced to
   Supabase (arowana.financial_accounts has no color column by design —
   it's cosmetic, not canonical). Each device may show slightly different
   colors for the same account until a color is explicitly set; this is
   considered acceptable for a UI-only preference.
   ==================================================================== */
(function () {
  const AP_ACCOUNTS_KEY = 'ap_accounts_v1';
  /* Which user the local list belongs to.
     ------------------------------------------------------------------------
     ap_accounts_v1 is browser-scoped with no notion of an owner, so signing in
     as a different user left the previous person's account names on screen —
     and these are personal names ("Jimmy-134SCHW", "Jenny-631SCHW"), shown to
     someone else's account.

     It was hidden by the "local stays authoritative" rule below: a brand-new
     user has no rows in arowana.financial_accounts, the pull returns zero, and
     the early return preserved whatever was already in this browser. That rule
     is right for its intended case (local accounts not yet pushed) and wrong
     across a user change — a distinction the registry could not draw without
     knowing whose list it held. */
  const AP_ACCOUNTS_OWNER_KEY = 'ap_accounts_owner_v1';
  const LEGACY_KEYS = ['tj_accounts_v1', 'pc_accounts_v1'];
  const AP_ACCOUNT_COLORS = [
    '#0b4f8a', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#14b8a6', '#ec4899', '#6366f1',
  ];

  let _cache = null;

  function genId() {
    return 'acct_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function _nextColor(list) {
    const used = new Set((list || []).map(a => a.color));
    return AP_ACCOUNT_COLORS.find(c => !used.has(c))
      || AP_ACCOUNT_COLORS[(list || []).length % AP_ACCOUNT_COLORS.length];
  }

  function _migrateFromLegacy() {
    const merged = new Map(); // key: lowercase name
    LEGACY_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        arr.forEach(a => {
          if (!a || !a.name) return;
          const k = String(a.name).trim().toLowerCase();
          if (!k || merged.has(k)) return;
          merged.set(k, {
            id: a.id || genId(),
            name: String(a.name).trim(),
            broker: a.broker || '',
            entityType: null,
            color: a.color || _nextColor(Array.from(merged.values())),
          });
        });
      } catch (e) { /* skip malformed legacy data */ }
    });
    if (merged.size === 0) {
      merged.set('default', {
        id: genId(), name: 'Default', broker: '', entityType: null,
        color: AP_ACCOUNT_COLORS[0],
      });
    }
    return Array.from(merged.values());
  }

  /* A fresh, empty-but-valid registry for a user with no accounts. Does NOT
     read the legacy tj_accounts_v1 / pc_accounts_v1 keys — those belong to
     whoever used this browser before. */
  function _migrateFromLegacyEmpty() {
    return [{
      id: genId(), name: 'Default', broker: '', entityType: null,
      color: AP_ACCOUNT_COLORS[0],
    }];
  }

  function _load() {
    if (_cache) return _cache;
    try {
      const raw = localStorage.getItem(AP_ACCOUNTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          _cache = arr;
          return _cache;
        }
      }
    } catch (e) { /* fall through to migration */ }
    _cache = _migrateFromLegacy();
    _persist(_cache, { silent: true });
    return _cache;
  }

  function _persist(arr, opts) {
    opts = opts || {};
    _cache = arr;
    try { localStorage.setItem(AP_ACCOUNTS_KEY, JSON.stringify(arr)); } catch (e) {}
    if (!opts.silent) {
      window.dispatchEvent(new CustomEvent('accounts:changed', { detail: { accounts: arr.slice() } }));
    }
  }

  // ── Supabase secondary sync (best-effort) ──────────────────────────
  async function _getClient() {
    for (let i = 0; i < 20; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  async function _pullFromSupabase() {
    const client = await _getClient();
    if (!client) return;
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const { data: entities, error: eErr } = await client
        .schema('arowana').from('entities')
        .select('id, entity_type').eq('user_id', user.id).eq('status', 'active');
      if (eErr) throw eErr;

      const { data: accts, error: aErr } = await client
        .schema('arowana').from('financial_accounts')
        .select('id, entity_id, nickname, broker')
        .eq('user_id', user.id).eq('status', 'active');
      if (aErr) throw aErr;

      /* Whose list is in this browser? */
      let owner = null;
      try { owner = localStorage.getItem(AP_ACCOUNTS_OWNER_KEY); } catch (_) {}

      if (owner && owner !== user.id) {
        /* A different user is signed in. Their account list is whatever the
           server says — including nothing at all. Keeping the previous user's
           names because the new user has none is exactly the leak. */
        console.warn('[AccountRegistry] Local accounts belong to a different user — resetting for this account.');
        _persist(accts && accts.length ? [] : _migrateFromLegacyEmpty());
      }
      try { localStorage.setItem(AP_ACCOUNTS_OWNER_KEY, user.id); } catch (_) {}

      if (!accts || accts.length === 0) {
        /* Nothing remote. For the SAME user that means "not pushed yet", so
           local stays authoritative. For a user we just reset, it means they
           genuinely have no accounts. */
        if (owner && owner !== user.id) _persist(_migrateFromLegacyEmpty());
        return;
      }

      const entityById = new Map((entities || []).map(e => [e.id, e]));
      const local = _load();
      const localByName = new Map(local.map(a => [a.name.toLowerCase(), a]));

      const merged = accts.map(a => {
        const existing = localByName.get(String(a.nickname).toLowerCase());
        return {
          id: a.id,
          name: a.nickname,
          broker: a.broker || '',
          entityType: entityById.get(a.entity_id)?.entity_type || null,
          color: existing?.color || _nextColor(local),
        };
      });
      _persist(merged);
    } catch (err) {
      console.warn('[AccountRegistry] Supabase pull failed, staying local-only:', err);
    }
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function _isUuid(v) { return typeof v === 'string' && UUID_RE.test(v); }

  async function _pushOne(account) {
    const client = await _getClient();
    if (!client) return;
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const entityType = account.entityType || 'personal';
      const entityName = entityType === 'llc' ? 'LLC' : 'Personal';

      let { data: existingEntity } = await client
        .schema('arowana').from('entities')
        .select('id').eq('user_id', user.id).eq('legal_name', entityName)
        .maybeSingle();

      let entityId = existingEntity && existingEntity.id;
      if (!entityId) {
        const { data: newEntity, error: insErr } = await client
          .schema('arowana').from('entities')
          .insert({ user_id: user.id, legal_name: entityName, entity_type: entityType })
          .select('id').single();
        if (insErr) throw insErr;
        entityId = newEntity.id;
      }

      // Match the existing remote row by id whenever we already have a real
      // uuid locally (i.e. this account was pushed successfully before —
      // covers renames, where account.name has ALREADY changed to the new
      // name by the time we get here, so matching on nickname would miss
      // the old row and insert a duplicate). Only fall back to matching by
      // nickname for accounts that have never been pushed yet, where our
      // local id is still a non-uuid genId() string and cannot be used as
      // the Postgres uuid primary key.
      let existingAcct = null;
      if (_isUuid(account.id)) {
        const byId = await client
          .schema('arowana').from('financial_accounts')
          .select('id').eq('user_id', user.id).eq('id', account.id)
          .maybeSingle();
        existingAcct = byId.data;
      }
      if (!existingAcct) {
        const byName = await client
          .schema('arowana').from('financial_accounts')
          .select('id').eq('user_id', user.id).eq('nickname', account.name)
          .maybeSingle();
        existingAcct = byName.data;
      }

      if (existingAcct && existingAcct.id) {
        await client.schema('arowana').from('financial_accounts')
          .update({ entity_id: entityId, nickname: account.name, broker: account.broker || null, status: 'active' })
          .eq('id', existingAcct.id);
        if (account.id !== existingAcct.id) {
          account.id = existingAcct.id; // adopt the real uuid locally
          _persist(_load(), { silent: true });
        }
      } else {
        const { data: inserted, error: insAcctErr } = await client
          .schema('arowana').from('financial_accounts')
          .insert({
            entity_id: entityId, user_id: user.id, nickname: account.name,
            broker: account.broker || null, status: 'active',
          })
          .select('id').single();
        if (insAcctErr) throw insAcctErr;
        account.id = inserted.id; // adopt the server-generated uuid locally
        _persist(_load(), { silent: true });
      }
    } catch (err) {
      console.warn('[AccountRegistry] Supabase push failed for', account.name, err);
    }
  }

  async function _archiveOne(account) {
    const client = await _getClient();
    if (!client) return;
    // Never sent to Supabase (still a local-only genId()) — nothing to archive remotely.
    if (!_isUuid(account.id)) return;
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      await client.schema('arowana').from('financial_accounts')
        .update({ status: 'archived' })
        .eq('id', account.id).eq('user_id', user.id);
    } catch (err) {
      console.warn('[AccountRegistry] Supabase archive failed for', account.name, err);
    }
  }

  // ── Public API ───────────────────────────────────────────────────
  const AccountRegistry = {
    async init() {
      _load();
      await _pullFromSupabase();
      // Backfill: push any account still sitting on a local (non-uuid) id.
      // This covers two cases create()/rename() never reach: accounts
      // migrated from legacy tj_accounts_v1/pc_accounts_v1 (which _load()
      // persists locally but never pushes), and any account whose earlier
      // push attempt failed (e.g. offline, or before the arowana schema
      // was exposed). Without this, those accounts stay invisible to every
      // other page/device — they're real locally, but Supabase (the only
      // thing other pages/sessions read) never learns about them.
      const unsynced = _load().filter(a => !_isUuid(a.id));
      if (unsynced.length > 0) {
        await Promise.all(unsynced.map(a => _pushOne(a)));
      }
      return _cache.slice();
    },

    list() {
      return _load().slice();
    },

    get(id) {
      return _load().find(a => a.id === id) || null;
    },

    getByName(name) {
      return _load().find(a => a.name === name) || null;
    },

    create(name, opts) {
      opts = opts || {};
      const clean = String(name || '').trim();
      if (!clean) return null;
      const list = _load();
      if (list.some(a => a.name.toLowerCase() === clean.toLowerCase())) return null;
      const acct = {
        id: genId(), name: clean, broker: opts.broker || '',
        entityType: opts.entityType || null, color: opts.color || _nextColor(list),
      };
      _persist([...list, acct]);
      _pushOne(acct);
      return acct;
    },

    rename(idOrName, newName) {
      const clean = String(newName || '').trim();
      if (!clean) return false;
      const list = _load();
      const target = list.find(a => a.id === idOrName || a.name === idOrName);
      if (!target) return false;
      if (list.some(a => a !== target && a.name.toLowerCase() === clean.toLowerCase())) return false;
      target.name = clean;
      _persist([...list]);
      _pushOne(target);
      return true;
    },

    setColor(idOrName, color) {
      const list = _load();
      const target = list.find(a => a.id === idOrName || a.name === idOrName);
      if (!target) return false;
      target.color = color;
      _persist([...list]);
      return true; // color is local-only, not pushed to Supabase
    },

    archive(idOrName) {
      const list = _load();
      if (list.length <= 1) return false; // never delete the last account
      const target = list.find(a => a.id === idOrName || a.name === idOrName);
      const filtered = list.filter(a => a !== target);
      if (filtered.length === list.length) return false;
      _persist(filtered);
      if (target) _archiveOne(target);
      return true;
    },

    // Used by CSV-import / holdings-reconciliation flows that discover an
    // account name not yet in the registry (e.g. Schwab positions CSV).
    ensureFromName(name, opts) {
      if (!name || name === 'Unspecified') return null;
      const existing = this.getByName(name);
      if (existing) return existing;
      return this.create(name, opts);
    },
  };

  window.AccountRegistry = AccountRegistry;
})();
