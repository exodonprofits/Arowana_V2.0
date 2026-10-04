// arowana-founders-count — public, read-only seat count for the Founders offer.
//
// GET → { taken, limit, remaining, waitlist }
// No auth: it exposes only aggregate numbers, never who bought.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const LIMIT = Number(Deno.env.get('AROWANA_FOUNDERS_LIMIT') ?? '100');
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { count: taken, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('arowana_plan', 'founders')
      .in('arowana_plan_status', ['active', 'trialing', 'past_due']);
    if (error) throw error;

    const { count: waitlist } = await supabase
      .from('ap_founders_waitlist')
      .select('id', { count: 'exact', head: true });

    const used = taken ?? 0;
    return new Response(JSON.stringify({
      taken: used,
      limit: LIMIT,
      remaining: Math.max(0, LIMIT - used),
      waitlist: waitlist ?? 0,
    }), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[arowana-founders-count]', err);
    return new Response(JSON.stringify({ error: 'count unavailable' }), {
      status: 500, headers: { ...cors, 'content-type': 'application/json' },
    });
  }
});
