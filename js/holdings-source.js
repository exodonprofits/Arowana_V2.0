/* ============================================================================
   Arowana — Open Positions Source  (js/holdings-source.js)
   ----------------------------------------------------------------------------
   One definition of "what do I currently own", read from `tj_stocks`.

   `tj_stocks` is the canonical trade log — Trade Journal Pro, Trading
   Command's Current Positions and Portfolio Command's Holdings all read it.
   It stores ONE ROW PER FIFO LOT (e.g. fourteen separate open MU buys), not
   one row per position, so it has to be aggregated before it means anything
   as a portfolio.

   The older `portfolio` table is retired. It required its own CSV import to
   stay current and has drifted: at the time of writing it held 35 stale rows
   while the live trade log aggregated to 3 open positions. Anything reading
   `portfolio` is reading history, not holdings.

   The aggregation here mirrors portfolio-command.html's
   pcAggregateTjStockRows()/pcMapTjStockAggregate() exactly — group by
   (symbol, broker), sum quantity, quantity-weighted average cost — so the two
   pages cannot drift apart. Command still has its own inline copy; this module
   is where it should move next time that file is touched.

   USAGE
     <script src="./js/holdings-source.js"></script>

     const positions = await AP_HOLDINGS.fetchOpenPositions({
       url:      SUPABASE_URL,
       anonKey:  SUPABASE_ANON,
       userId:   uid,
       token:    accessToken   // required in practice: tj_stocks is behind RLS
     });

   Returns [] on an empty log and throws on a failed request, so callers can
   tell "no positions" from "could not load" — the distinction that made an
   auth failure look like an empty portfolio.
   ========================================================================== */
(function (window) {
  'use strict';
  if (window.AP_HOLDINGS) return;

  /* One row per lot -> one entry per (symbol, broker). Shorts are skipped:
     this is a holdings view, and a short is not something you own. */
  function aggregate(rows) {
    var groups = new Map();
    (rows || []).forEach(function (row) {
      var p = row.payload || {};
      if (p.side === 'short') return;

      var symbol = String(row.symbol || p.ticker || '').toUpperCase();
      var qty = Number(p.qty);
      var price = Number(p.entryPrice);
      if (!symbol || !isFinite(qty) || qty <= 0 || !isFinite(price)) return;

      /* Trade Journal Pro's "broker" field is what its account switcher
         writes, so it is functionally the account name. Lots entered before
         an account was chosen are tagged "Default" rather than guessed into
         a specific brokerage. */
      var broker = (p.broker || '').trim() || 'Default';
      var key = symbol + '::' + broker;

      var g = groups.get(key) || { symbol: symbol, broker: broker, totalQty: 0, totalCost: 0, earliestDate: null };
      g.totalQty += qty;
      g.totalCost += qty * price;

      var entryDate = p.entryDate || row.entry_date || null;
      if (entryDate && (!g.earliestDate || entryDate < g.earliestDate)) g.earliestDate = entryDate;

      groups.set(key, g);
    });

    return Array.from(groups.values()).map(function (g) {
      return {
        id: 'tjstocks::' + g.symbol + '::' + g.broker,
        ticker: g.symbol,
        symbol: g.symbol,
        shares: g.totalQty,
        avgPrice: g.totalQty > 0 ? g.totalCost / g.totalQty : 0,
        avgCost: g.totalQty > 0 ? g.totalCost / g.totalQty : 0,
        account: g.broker,
        added: g.earliestDate
      };
    }).filter(function (h) { return h.ticker && h.shares > 0; });
  }

  async function fetchOpenPositions(opts) {
    opts = opts || {};
    if (!opts.url || !opts.userId) return [];

    var url = opts.url + '/rest/v1/tj_stocks?user_id=eq.' + encodeURIComponent(opts.userId) +
              '&status=eq.open&select=symbol,payload';

    var res = await fetch(url, {
      headers: {
        'apikey': opts.anonKey,
        /* tj_stocks is behind RLS. Without a real token this returns HTTP 200
           and an empty array, which reads as "no positions" rather than as the
           permission failure it is. */
        'Authorization': 'Bearer ' + (opts.token || opts.anonKey),
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error('tj_stocks HTTP ' + res.status);

    var rows = await res.json();
    return { positions: aggregate(rows), rawCount: (rows || []).length };
  }

  window.AP_HOLDINGS = {
    aggregate: aggregate,
    fetchOpenPositions: fetchOpenPositions
  };
})(window);
