// Fake Supabase for browser checks (ATD-108). The page runs unmodified: a
// synthetic session goes into localStorage, and requests to the project's
// supabase.co host are answered by a small in-memory PostgREST. Every other
// non-localhost request is aborted, so no real service is contacted.
//
//   const fake = await installFakeSupabase(ctx, { tj_stocks: [...], ... });
//   fake.db.tj_stocks   // live rows, mutated by the page's writes
//   fake.writes         // [{ method, table }] for every non-GET request

export const REF = 'pbojacnagutipfhcxltj';
export const UID = '00000000-0000-4000-8000-000000000001';

const PRO_PROFILE = { id: UID, arowana_plan: 'pro', arowana_plan_status: 'active', arowana_plan_renews_at: null, arowana_stripe_subscription_id: 'sub_synthetic' };
const PARAMS = ['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'];

function parseVal(v) { return v.replace(/^"(.*)"$/, '$1'); }
function filtersOf(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (PARAMS.includes(k)) continue;
    let m;
    if ((m = /^eq\.(.*)$/.exec(v))) out.push(r => String(r[k] ?? '') === parseVal(m[1]));
    else if ((m = /^in\.\((.*)\)$/.exec(v))) { const set = m[1].split(',').map(parseVal); out.push(r => set.includes(String(r[k]))); }
    else if ((m = /^not\.in\.\((.*)\)$/.exec(v))) { const set = m[1].split(',').map(parseVal); out.push(r => !set.includes(String(r[k]))); }
  }
  return out;
}

export async function installFakeSupabase(ctx, db, opts = {}) {
  db.profiles = db.profiles || [PRO_PROFILE];
  const writes = [];
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {} };
  const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: UID, exp, role: 'authenticated', aud: 'authenticated', email: user.email }) + '.c3ludGhldGlj';
  const session = { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

  async function rest(route) {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.replace('/rest/v1/', '');
    const method = req.method();
    const json = (status, body, headers) => route.fulfill({ status, contentType: 'application/json', headers: headers || {}, body: body == null ? '' : JSON.stringify(body) });
    if (method !== 'GET' && method !== 'HEAD') writes.push({ method, table });
    const rows = db[table];
    const one = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
    if (!rows) return method === 'GET' ? (one ? json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' }) : json(200, [])) : json(201, null);
    const match = r => filtersOf(url).every(f => f(r));
    if (method === 'GET' || method === 'HEAD') {
      let out = rows.filter(match);
      const off = Number(url.searchParams.get('offset') || 0), lim = url.searchParams.get('limit');
      out = out.slice(off, lim == null ? undefined : off + Number(lim));
      if (one) return out.length === 1 ? json(200, out[0]) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.length} rows` });
      return json(200, out, { 'content-range': `${off}-${off + out.length - 1}/*` });
    }
    if (method === 'POST') {
      const key = url.searchParams.get('on_conflict') || 'id';
      const body = JSON.parse(req.postData() || '[]');
      const list = Array.isArray(body) ? body : [body];
      list.forEach(r => { const i = rows.findIndex(x => x[key] === r[key]); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push({ ...r }); });
      return /return=representation/.test(req.headers()['prefer'] || '') ? json(201, list) : json(201, null);
    }
    if (method === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      rows.forEach((r, i) => { if (match(r)) rows[i] = { ...r, ...body }; });
      return json(204, null);
    }
    if (method === 'DELETE') {
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1);
      return json(204, null);
    }
    return json(405, null);
  }

  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname === `${REF}.supabase.co`) {
      if (u.pathname.startsWith('/rest/v1/')) return rest(r);
      if (u.pathname === '/auth/v1/user') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
      if (u.pathname === '/auth/v1/token') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
      return r.fulfill({ status: 503, body: '' });
    }
    if (u.hostname !== '127.0.0.1') return r.abort();
    if (/\/login\.html$/.test(u.pathname) && r.request().isNavigationRequest()) return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
  await ctx.addInitScript(([s, ref, u, extra]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
    localStorage.setItem('gs_auth_user_v1', JSON.stringify({ id: u.id, email: u.email }));
    Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v));
  }, [session, REF, user, opts.localStorage || null]);
  return { db, writes, user };
}
