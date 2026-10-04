/* ============================================================================
   digest.js — the three Arowana emails, built from the user's own data.
   ----------------------------------------------------------------------------
   Pure: no network, no clock (today is passed in), no AI. Every number comes
   from the trade journal, the nightly closes or Roll Coach, and each email
   says where. An email with nothing worth saying is not built (null), so a
   quiet day sends nothing.

     buildDaily(data)            weekday email: past expiration but still open,
                                 near the strike, earnings before expiration,
                                 expiring soon, idle cash
     buildExpiryWeek(data)       Monday: everything expiring this week, with
                                 Roll Coach's choices for each
     buildMonthly(data, 'YYYY-MM')  options income statement for a month
     wheelStatus(data)           the Wheel Coach page's panel: the daily checks,
                                 this week's expirations, capital in use
     render(email, links)        → { subject, html, text }

   data = {
     today: 'YYYY-MM-DD' (America/Chicago),
     name, capital,                      // ap_risk_settings.wheel_capital or null
     options: [payload + status],        // tj_options
     stocks:  [payload + status],        // tj_stocks
     prices:  { SYM: close }, priceDate, // market_snapshots, latest 1d close
     earnings:{ SYM: 'YYYY-MM-DD' },     // next earnings date, if known
     roll:    [ap_roll_coach rows]       // optional
   }

   Used by index.ts (Deno), arowana-trader.html (browser, dynamic import)
   and tests/digest.test.js (node).
   ========================================================================== */

var DAY = 86400000;
var NEAR_PCT = 3;            // "near the strike": within 3% of it, or through it
var SOON_DAYS = 2;           // "expiring soon" in the daily email
var IDLE_SHARE = 0.10;       // idle cash worth mentioning: 10% of wheel capital

function num(v) { if (v == null || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
function ms(d) { return Date.parse(d + 'T00:00:00Z'); }
function addDays(d, n) { return new Date(ms(d) + n * DAY).toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((ms(b) - ms(a)) / DAY); }
function weekday(d) { return new Date(ms(d)).getUTCDay(); }          // 0 Sun … 6 Sat
function isTrue(v) { return v === true || String(v) === 'true'; }
function sym(p) { return String(p.ticker || '').trim().toUpperCase(); }
function acct(p) { return String(p.broker || '').trim() || 'Default'; }

export function usd(v, cents) {
  if (v == null) return '—';
  var a = Math.abs(v);
  var s = cents ? a.toFixed(2) : Math.round(a).toLocaleString('en-US');
  if (cents) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '−$' : '$') + s;
}
function pct(v, dp) { return v == null ? '—' : Math.abs(v).toFixed(dp == null ? 1 : dp) + '%'; }
function shortDate(d) {
  var dt = new Date(ms(d));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()] + ' ' +
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getUTCMonth()] + ' ' + dt.getUTCDate();
}
function monthName(m) {
  var p = m.split('-');
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(p[1]) - 1] + ' ' + p[0];
}
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

/* Open short options (sold for a credit), one per journal row. */
export function openShorts(options, today) {
  return (options || []).map(function (p) {
    if (String(p.status || 'open').toLowerCase() !== 'open' || !isTrue(p.isCredit)) return null;
    var t = sym(p), type = String(p.optType || '').toLowerCase(), strike = num(p.strike), expiry = day(p.expiry);
    if (!t || (type !== 'put' && type !== 'call') || strike == null || !expiry) return null;
    var qty = num(p.qty) || 1;
    return { ticker: t, account: acct(p), type: type, strike: strike, expiry: expiry, qty: qty,
             credit: (num(p.premiumIn) || 0) * qty * 100, dte: daysBetween(today, expiry) };
  }).filter(function (l) { return l && l.dte >= 0; });
}

/* Where the stock sits against the strike. distance > 0 = out of the money. */
export function position(leg, price) {
  if (price == null) return null;
  var distance = leg.type === 'put' ? (price - leg.strike) / leg.strike * 100 : (leg.strike - price) / leg.strike * 100;
  return { price: price, distance: distance, itm: distance < 0,
           label: distance < 0 ? pct(distance) + ' in the money' : pct(distance) + (leg.type === 'put' ? ' above the strike' : ' below the strike') };
}

function legName(l) {
  return l.ticker + ' ' + usd(l.strike, true) + ' ' + l.type + (l.qty > 1 ? ' ×' + l.qty : '') + ', ' + shortDate(l.expiry);
}

function sharesCost(stocks) {
  return (stocks || []).reduce(function (s, p) {
    if (String(p.status || '').toLowerCase() !== 'open' || String(p.side || 'long').toLowerCase() !== 'long') return s;
    return s + (num(p.qty) || 0) * (num(p.entryPrice) || 0);
  }, 0);
}

/* Sections shared by the daily and the expiration-week email. */
function watchSections(d, legs, opts) {
  var sections = [];
  var prices = d.prices || {}, earnings = d.earnings || {};

  var near = legs.map(function (l) { return { leg: l, pos: position(l, num(prices[l.ticker])) }; })
    .filter(function (x) { return x.pos && x.pos.distance <= NEAR_PCT; })
    .sort(function (a, b) { return a.pos.distance - b.pos.distance; });
  if (near.length) sections.push({ id: 'near', title: 'Near or through the strike',
    note: 'Stock within ' + NEAR_PCT + '% of the strike, or past it, at the last close' + (d.priceDate ? ' (' + shortDate(d.priceDate) + ')' : '') + '.',
    rows: near.map(function (x) { return [legName(x.leg), usd(x.pos.price, true) + ' · ' + x.pos.label]; }) });

  var earn = legs.filter(function (l) { var e = day(earnings[l.ticker]); return e && e >= d.today && e <= l.expiry; });
  if (earn.length) sections.push({ id: 'earnings', title: 'Earnings before expiration',
    note: 'The stock can gap through the strike on the report.',
    rows: earn.map(function (l) { return [legName(l), 'Earnings ' + shortDate(earnings[l.ticker])]; }) });

  if (opts && opts.soon) {
    var soon = legs.filter(function (l) { return l.dte <= SOON_DAYS; });
    if (soon.length) sections.push({ id: 'soon', title: 'Expiring in the next ' + SOON_DAYS + ' days',
      rows: soon.map(function (l) { var p = position(l, num(prices[l.ticker])); return [legName(l), p ? p.label : 'no close on file']; }) });
  }

  var cap = num(d.capital);
  if (cap) {
    var all = (opts && opts.allLegs) || legs;       // collateral counts every open put
    var puts = all.reduce(function (s, l) { return s + (l.type === 'put' ? l.strike * 100 * l.qty : 0); }, 0);
    var shares = sharesCost(d.stocks);
    var idle = cap - puts - shares;
    if (idle >= cap * IDLE_SHARE) sections.push({ id: 'idle', title: 'Cash not working',
      note: 'Wheel capital ' + usd(cap) + ' − put collateral ' + usd(puts) + ' − shares at cost ' + usd(shares) + '.',
      rows: [[usd(idle) + ' free', pct(idle / cap * 100, 0) + ' of your wheel capital']] });
  }
  return sections;
}

export function buildDaily(d) {
  var legs = openShorts(d.options, d.today);
  var stale = staleSection(d);
  var sections = (stale ? [stale] : []).concat(watchSections(d, legs, { soon: true }));
  if (!sections.length) return null;
  var counts = [];
  sections.forEach(function (s) {
    if (s.id === 'stale') counts.push(s.rows.length + ' past expiration still open');
    if (s.id === 'near') counts.push(plural(s.rows.length, 'position') + ' near the strike');
    if (s.id === 'earnings') counts.push(plural(s.rows.length, 'earnings report') + ' before expiration');
    if (s.id === 'soon') counts.push(s.rows.length + ' expiring soon');
  });
  return { kind: 'morning', period: d.today,
    subject: counts.length ? counts.join(', ') : 'Cash not working',
    heading: 'Your positions, ' + shortDate(d.today), sections: sections };
}

/* Monday through Friday of the week containing `today`. */
function weekEnd(today) { var w = weekday(today); return addDays(today, w === 6 ? 6 : 5 - w); }

export function buildExpiryWeek(d) {
  var friday = weekEnd(d.today);
  var legs = openShorts(d.options, d.today);
  var expiring = legs.filter(function (l) { return l.expiry <= friday; }).sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
  if (!expiring.length) return null;
  var prices = d.prices || {};
  var roll = d.roll || [];
  var itm = 0;
  var rows = expiring.map(function (l) {
    var p = position(l, num(prices[l.ticker]));
    if (p && p.itm) itm++;
    var rc = roll.find(function (r) {
      return String(r.underlying || '').toUpperCase() === l.ticker && String(r.opt_type || '').toLowerCase() === l.type &&
        num(r.strike) === l.strike && day(r.expiry) === l.expiry;
    });
    var choices = rc && Array.isArray(rc.choices) ? rc.choices.filter(function (c) { return c && c.label && !c.unavailable; }).slice(0, 3) : [];
    return {
      cells: [legName(l), (p ? usd(p.price, true) + ' · ' + p.label : 'no close on file') + ' · ' + usd(l.credit) + ' premium'],
      detail: choices.map(function (c) { return c.label + (c.detail ? ': ' + String(c.detail) : ''); }),
      captured: rc ? num(rc.captured_pct) : null
    };
  });
  var sections = [{ id: 'expiring', title: 'Expiring by ' + shortDate(friday),
    note: 'At the last close' + (d.priceDate ? ' (' + shortDate(d.priceDate) + ')' : '') + '. Choices come from Roll Coach and show the numbers; the decision is yours.',
    rows: rows.map(function (r) { return r.cells; }), details: rows.map(function (r) { return r.detail; }) }];
  var stale = roll.reduce(function (m, r) { var c = day(r.computed_at); return c && (!m || c > m) ? c : m; }, null);
  if (roll.length && stale && daysBetween(stale, d.today) > 2) sections[0].note += ' Roll Coach last updated ' + shortDate(stale) + '.';
  // The rest of the daily email, minus "expiring soon" (the list above covers it).
  var staleRows = staleSection(d);
  if (staleRows) sections.push(staleRows);
  sections = sections.concat(watchSections(d, legs.filter(function (l) { return l.expiry > friday; }), { soon: false, allLegs: legs }));
  return { kind: 'expiry', period: d.today,
    subject: 'Expiration week: ' + plural(expiring.length, 'position') + (itm ? ', ' + itm + ' in the money' : ''),
    heading: 'Expiration week, ' + shortDate(d.today), sections: sections };
}

/* Open option rows whose expiration date has passed, oldest first. */
export function pastExpiry(options, today) {
  return (options || []).map(function (p) {
    if (String(p.status || 'open').toLowerCase() !== 'open') return null;
    var expiry = day(p.expiry);
    if (!expiry || expiry >= today) return null;
    var t = sym(p);
    if (!t) return null;
    var type = String(p.optType || '').toLowerCase() || (/put/i.test(p.strategy) ? 'put' : /call/i.test(p.strategy) ? 'call' : 'option');
    var qty = num(p.qty) || 1, strike = num(p.strike);
    return { ticker: t, account: acct(p), expiry: expiry, days: daysBetween(expiry, today),
             name: t + (strike != null ? ' ' + usd(strike, true) : '') + ' ' + type + (qty > 1 ? ' ×' + qty : '') + ', ' + shortDate(expiry) };
  }).filter(Boolean).sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
}

/* "Past expiration but still open", shared by the page and the weekday emails.
   openShorts() skips these rows, so without it they drop out of every check
   and total while the journal stays wrong. Any open option counts, bought or sold. */
function staleSection(d) {
  var stale = pastExpiry(d.options, d.today);
  if (!stale.length) return null;
  return { id: 'stale', title: 'Past expiration but still open',
    note: 'Mark each one expired, assigned or closed in your journal so your positions, income and these checks are right.',
    rows: stale.map(function (s) {
      return [s.name, 'expired ' + (s.days === 1 ? 'yesterday' : plural(s.days, 'day') + ' ago')];
    }) };
}

/* The Wheel Coach page's "Your wheel today": the daily email's checks, plus
   this week's expirations and where the capital sits. Unlike the emails it
   is always built — on a page, "nothing needs you" is an answer. */
export function wheelStatus(d) {
  var legs = openShorts(d.options, d.today);
  var friday = weekEnd(d.today);
  var prices = d.prices || {};
  var sections = [];
  // Options still marked open after their expiration come first.
  var stale = staleSection(d);
  if (stale) sections.push(stale);
  var week = legs.filter(function (l) { return l.expiry <= friday; }).sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
  if (week.length) sections.push({ id: 'week', title: 'Expiring by ' + shortDate(friday),
    rows: week.map(function (l) {
      var p = position(l, num(prices[l.ticker]));
      return [legName(l), (p ? usd(p.price, true) + ' · ' + p.label : 'no price on file') + ' · ' + usd(l.credit) + ' premium'];
    }) });
  sections = sections.concat(watchSections(d, legs, { soon: false }));
  var cap = num(d.capital);
  var collateral = legs.reduce(function (s, l) { return s + (l.type === 'put' ? l.strike * 100 * l.qty : 0); }, 0);
  var shares = sharesCost(d.stocks);
  return {
    today: d.today, friday: friday, sections: sections,
    puts: legs.filter(function (l) { return l.type === 'put'; }).length,
    calls: legs.filter(function (l) { return l.type === 'call'; }).length,
    credit: legs.reduce(function (s, l) { return s + l.credit; }, 0),
    collateral: collateral, shares: shares, capital: cap,
    free: cap ? cap - collateral - shares : null
  };
}

/* Realized result of one settled option row, the same way the Income tab counts it. */
export function settled(p) {
  var status = String(p.status || '').toLowerCase();
  if (status !== 'closed' && status !== 'expired' && status !== 'assigned') return null;
  var date = day(p.exitDate) || day(p.expiry);
  if (!date) return null;
  var qty = num(p.qty) || 1, pin = num(p.premiumIn) || 0, pout = num(p.premiumOut);
  var fees = (num(p.feeIn) || 0) + (num(p.feeOut) || 0);
  var pnl = num(p.pnl);
  if (pnl == null) pnl = ((isTrue(p.isCredit) ? pin - (pout || 0) : (pout || 0) - pin) * qty * 100) - fees;
  return { ticker: sym(p), date: date, pnl: pnl, assigned: status === 'assigned', credit: isTrue(p.isCredit) ? pin * qty * 100 : 0 };
}

function prevMonth(m) { var p = m.split('-').map(Number); return p[1] === 1 ? (p[0] - 1) + '-12' : p[0] + '-' + String(p[1] - 1).padStart(2, '0'); }

export function buildMonthly(d, month) {
  var rows = (d.options || []).map(settled).filter(Boolean);
  var inMonth = rows.filter(function (r) { return r.date.slice(0, 7) === month; });
  var legs = openShorts(d.options, d.today);
  if (!inMonth.length && !legs.length) return null;
  var total = 0, wins = 0, assigned = 0, byTicker = {};
  inMonth.forEach(function (r) {
    total += r.pnl; if (r.pnl > 0) wins++; if (r.assigned) assigned++;
    var t = byTicker[r.ticker] = byTicker[r.ticker] || { ticker: r.ticker, pnl: 0, n: 0 };
    t.pnl += r.pnl; t.n++;
  });
  var prior = rows.filter(function (r) { return r.date.slice(0, 7) === prevMonth(month); }).reduce(function (s, r) { return s + r.pnl; }, 0);
  var ytd = rows.filter(function (r) { return r.date.slice(0, 4) === month.slice(0, 4) && r.date.slice(0, 7) <= month; }).reduce(function (s, r) { return s + r.pnl; }, 0);
  var sections = [{ id: 'summary', title: 'Options income, ' + monthName(month), rows: [
    ['Realized', usd(total)],
    ['Trades settled', inMonth.length + (inMonth.length ? ' (' + wins + ' profitable' + (assigned ? ', ' + assigned + ' assigned' : '') + ')' : '')],
    [monthName(prevMonth(month)), usd(prior)],
    ['Year to date', usd(ytd)]
  ] }];
  var tickers = Object.keys(byTicker).map(function (k) { return byTicker[k]; }).sort(function (a, b) { return b.pnl - a.pnl; });
  if (tickers.length) sections.push({ id: 'tickers', title: 'By ticker',
    rows: tickers.slice(0, 12).map(function (t) { return [t.ticker + ' (' + plural(t.n, 'trade') + ')', usd(t.pnl)]; }) });
  if (legs.length) {
    var credit = legs.reduce(function (s, l) { return s + l.credit; }, 0);
    var coll = legs.reduce(function (s, l) { return s + (l.type === 'put' ? l.strike * 100 * l.qty : 0); }, 0);
    sections.push({ id: 'open', title: 'Still open', note: 'Not counted above until they settle.',
      rows: [[plural(legs.length, 'contract'), usd(credit) + ' premium received'], ['Put collateral', usd(coll)]] });
  }
  return { kind: 'monthly', period: month,
    subject: monthName(month) + ' options income: ' + usd(total),
    heading: 'Your ' + monthName(month) + ' statement', sections: sections };
}

/* ── Rendering ─────────────────────────────────────────────────────────── */

function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

export function render(email, links) {
  links = links || {};
  var F = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;';
  var html = '<!doctype html><html><body style="margin:0;background:#f4f7fa;' + F + 'color:#0d1b2a">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">' +
    '<tr><td style="padding:22px 24px 6px"><div style="font-size:12px;font-weight:700;color:#0b4f8a;letter-spacing:.06em;text-transform:uppercase">Arowana Profits</div>' +
    '<h1 style="font-size:20px;margin:6px 0 0;color:#0d1b2a">' + esc(email.heading) + '</h1></td></tr>';
  var text = email.heading + '\n\n';
  email.sections.forEach(function (s) {
    html += '<tr><td style="padding:16px 24px 4px"><h2 style="font-size:15px;margin:0 0 4px;color:#0d1b2a">' + esc(s.title) + '</h2>' +
      (s.note ? '<p style="margin:0 0 8px;font-size:12px;color:#64748b">' + esc(s.note) + '</p>' : '') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">';
    text += s.title.toUpperCase() + '\n' + (s.note ? s.note + '\n' : '');
    s.rows.forEach(function (r, i) {
      var det = s.details && s.details[i] && s.details[i].length ? s.details[i] : null;
      html += '<tr><td style="padding:7px 0;border-top:1px solid #eef2f6;vertical-align:top"><b>' + esc(r[0]) + '</b></td>' +
        '<td style="padding:7px 0 7px 12px;border-top:1px solid #eef2f6;text-align:right;vertical-align:top;color:#334155;width:48%">' + esc(r[1]) + '</td></tr>' +
        (det ? '<tr><td colspan="2" style="padding:0 0 8px"><ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.45">' +
          det.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></td></tr>' : '');
      text += '- ' + r[0] + ': ' + r[1] + '\n' + (det ? det.map(function (x) { return '    · ' + x + '\n'; }).join('') : '');
    });
    html += '</table></td></tr>';
    text += '\n';
  });
  var open = links.app ? links.app + (email.kind === 'monthly' ? '/portfolio-command.html?tab=income' : email.kind === 'expiry' ? '/options-hub.html?tab=roll' : '/options-hub.html') : null;
  if (open) {
    html += '<tr><td style="padding:14px 24px 4px"><a href="' + esc(open) + '" style="display:inline-block;background:#0b4f8a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 16px;border-radius:8px">Open Arowana</a></td></tr>';
    text += 'Open Arowana: ' + open + '\n\n';
  }
  var foot = 'From your trade journal as you logged it and the last market close. Educational tool, not investment advice.';
  html += '<tr><td style="padding:16px 24px 22px;font-size:11px;color:#64748b;line-height:1.5">' + esc(foot) +
    (links.settings ? '<br><a href="' + esc(links.settings) + '" style="color:#64748b">Email settings</a>' : '') +
    (links.unsubscribe ? ' · <a href="' + esc(links.unsubscribe) + '" style="color:#64748b">Unsubscribe from all</a>' : '') +
    '</td></tr></table></td></tr></table></body></html>';
  text += foot + '\n' + (links.settings ? 'Email settings: ' + links.settings + '\n' : '') + (links.unsubscribe ? 'Unsubscribe: ' + links.unsubscribe + '\n' : '');
  return { subject: email.subject, html: html, text: text };
}

export var _internals = { weekEnd: weekEnd, settled: settled, prevMonth: prevMonth, weekday: weekday };
