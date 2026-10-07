// Fake arowana-research for browser checks: answers the Finnhub paths the
// edge function allows with small synthetic payloads, and refuses
// /stock/candle with 403 the way the free Finnhub plan does in production.
//   installFakeSupabase(ctx, db, { functions: { 'arowana-research': fakeResearch(calls) } })
export function fakeResearch(calls = []) {
  const px = s => 50 + (String(s).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 150);
  return async ({ body }) => {
    const path = body && body.path, q = (body && body.query) || {};
    calls.push(path);
    const sym = String(q.symbol || 'AAPL').toUpperCase();
    const p = px(sym);
    const ok = json => ({ status: 200, json });
    switch (path) {
      case '/quote': return ok({ c: p, pc: p - 1, d: 1, dp: 0.8, h: p + 1, l: p - 2, o: p - 0.5, t: 1791300000 });
      case '/stock/metric': return ok({ symbol: sym, metric: { '52WeekHigh': p * 1.2, '52WeekLow': p * 0.8, beta: 1.1, peTTM: 22, epsTTM: p / 22,
        dividendYieldIndicatedAnnual: 1.6, currentDividendYieldTTM: 1.5, dividendPerShareAnnual: p * 0.016, marketCapitalization: 250000,
        revenueGrowthTTMYoy: 6, epsGrowthTTMYoy: 8, roeTTM: 18, 'totalDebt/totalEquityQuarterly': 0.6, freeCashFlowTTM: 9000, bookValuePerShareQuarterly: p / 5 }, series: {} });
      case '/stock/profile2': return ok({ ticker: sym, name: sym + ' Inc', finnhubIndustry: 'Technology', marketCapitalization: 250000, shareOutstanding: 1000, exchange: 'NASDAQ' });
      case '/calendar/earnings': return ok({ earningsCalendar: [] });
      case '/stock/earnings': return ok([]);
      case '/stock/recommendation': return ok([{ period: '2026-10-01', strongBuy: 5, buy: 10, hold: 6, sell: 1, strongSell: 0 }]);
      case '/stock/price-target': return ok({ targetHigh: p * 1.3, targetLow: p * 0.9, targetMean: p * 1.1, targetMedian: p * 1.1 });
      case '/stock/peers': return ok([sym, 'MSFT', 'GOOGL']);
      case '/news-sentiment': return ok({ buzz: {}, sentiment: {}, companyNewsScore: 0.5 });
      case '/company-news': return ok([]);
      case '/stock/social-sentiment': return ok({ data: [] });
      case '/stock/financials-reported': return ok({ data: [] });
      case '/stock/candle': return { status: 403, json: { error: "You don't have access to this resource." } };
      default: return { status: 400, json: { error: 'That data is not available here' } };
    }
  };
}
