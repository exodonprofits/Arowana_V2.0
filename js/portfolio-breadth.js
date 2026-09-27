/* ============================================================================
   Arowana — Portfolio Breadth  (js/portfolio-breadth.js)
   ----------------------------------------------------------------------------
   Look-through diversification, shared by portfolio-advisor.html and
   portfolio-command.html.

   Both pages were grading diversification independently. The advisor used
   letter grades on fund look-through; Command uses an HHI score over line
   items. HHI is the better statistic, but on line items it has the same blind
   spot the advisor's old row-count rule had: $1,500 entirely in VTI reads as a
   single undiversified position when it is roughly 3,600 companies.

   This module is the one implementation. It classifies each holding as a
   broad-market fund, a bond fund, a narrower sector/thematic fund, or a single
   company, and measures breadth by what those holdings actually own.

   Pure functions, no DOM, no storage. `priceOf(holding)` is an optional
   callback returning a live price; without it, average cost is used.

   USAGE
     <script src="./js/portfolio-breadth.js"></script>
     const b = AP_BREADTH.profile(holdings, h => (priceCache[h.ticker]||{}).price);
     AP_BREADTH.grade(b);   // 'A' | 'B' | 'C' | 'D'
     AP_BREADTH.rule(b);    // the sentence explaining that grade
     AP_BREADTH.sector('PLTR');       // 'Software', or null if unmapped
     AP_BREADTH.sectorLabel('ZZZZ');  // 'Unclassified'
   ========================================================================== */
(function (window) {
  'use strict';
  if (window.AP_BREADTH) return;

  const SECTORS={
    /* Technology & semis */
    AAPL:'Technology',MSFT:'Technology',GOOGL:'Technology',GOOG:'Technology',META:'Technology',
    NVDA:'Semiconductors',AMD:'Semiconductors',AVGO:'Semiconductors',INTC:'Semiconductors',
    MU:'Semiconductors',ASML:'Semiconductors',AMAT:'Semiconductors',LRCX:'Semiconductors',
    KLAC:'Semiconductors',TSM:'Semiconductors',SMCI:'Semiconductors',ARM:'Semiconductors',
    QCOM:'Semiconductors',TXN:'Semiconductors',ADI:'Semiconductors',NXPI:'Semiconductors',
    SNDK:'Semiconductors',MRVL:'Semiconductors',ON:'Semiconductors',
    CRM:'Software',ORCL:'Software',ADBE:'Software',NOW:'Software',INTU:'Software',
    PLTR:'Software',SNOW:'Software',DDOG:'Software',MDB:'Software',TEAM:'Software',
    PANW:'Cybersecurity',CRWD:'Cybersecurity',FTNT:'Cybersecurity',ZS:'Cybersecurity',S:'Cybersecurity',
    NBIS:'Technology',IBM:'Technology',CSCO:'Technology',ANET:'Technology',DELL:'Technology',
    LITE:'Technology',VRT:'Technology',CIEN:'Technology',
    /* Consumer */
    AMZN:'Consumer Discretionary',TSLA:'Consumer Discretionary',HD:'Consumer Discretionary',
    MCD:'Consumer Discretionary',NKE:'Consumer Discretionary',SBUX:'Consumer Discretionary',
    LOW:'Consumer Discretionary',BKNG:'Consumer Discretionary',ABNB:'Consumer Discretionary',
    PG:'Consumer Staples',KO:'Consumer Staples',PEP:'Consumer Staples',COST:'Consumer Staples',
    WMT:'Consumer Staples',PM:'Consumer Staples',MO:'Consumer Staples',CL:'Consumer Staples',
    /* Financials */
    JPM:'Financials',BAC:'Financials',WFC:'Financials',GS:'Financials',MS:'Financials',
    SCHW:'Financials',BLK:'Financials',AXP:'Financials',V:'Financials',MA:'Financials',
    'BRK.B':'Financials','BRK-B':'Financials',C:'Financials',COIN:'Financials',HOOD:'Financials',
    /* Healthcare */
    JNJ:'Healthcare',UNH:'Healthcare',LLY:'Healthcare',PFE:'Healthcare',ABBV:'Healthcare',
    MRK:'Healthcare',TMO:'Healthcare',ABT:'Healthcare',AMGN:'Healthcare',ISRG:'Healthcare',
    /* Industrials & energy */
    GE:'Industrials',GEV:'Industrials',CAT:'Industrials',BA:'Industrials',HON:'Industrials',
    UNP:'Industrials',RTX:'Industrials',LMT:'Industrials',DE:'Industrials',ETN:'Industrials',
    XOM:'Energy',CVX:'Energy',COP:'Energy',SLB:'Energy',OXY:'Energy',
    NEE:'Utilities',DUK:'Utilities',SO:'Utilities',
    /* Telecom, real estate, materials */
    VZ:'Telecom',T:'Telecom',TMUS:'Telecom',DIS:'Communication',NFLX:'Communication',
    AMT:'Real Estate',PLD:'Real Estate',SPG:'Real Estate',
    LIN:'Materials',FCX:'Materials',NEM:'Materials',
    /* Funds keep their own buckets */
    SPY:'Broad Market',VOO:'Broad Market',VTI:'Broad Market',IVV:'Broad Market',VT:'Broad Market',
    VXUS:'International',VEA:'International',VWO:'International',
    QQQ:'Technology',SOXX:'Semiconductors',SMH:'Semiconductors',SOXL:'Semiconductors',
    BND:'Bonds',AGG:'Bonds',TLT:'Bonds',
    VYM:'Dividend',SCHD:'Dividend',VIG:'Dividend',JEPI:'Dividend',
    GLD:'Commodities',SLV:'Commodities',VNQ:'Real Estate',IBIT:'Digital Assets'
  };
  /* null, not 'Other' — an unmapped ticker is unknown, and the callers say so
     rather than presenting a fabricated sector weight. */
  function getSector(sym){return SECTORS[(sym||'').toUpperCase()]||null}
  function sectorLabel(sym){return getSector(sym)||'Unclassified'}

  /* ═══════════════════════════════════════════════════════════════════════════
     LOOK-THROUGH DIVERSIFICATION
     ---------------------------------------------------------------------------
     Diversification used to be graded on row count (>=10 holdings = A). That
     penalised the single best answer for a small account: $1,500 entirely in VTI
     is roughly 3,600 companies, and it scored a D while the advice told the user
     to hold 10-20 positions — fifteen $100 positions, which no fee-only advisor
     would recommend at that size.

     Breadth is now measured by what the holdings actually own. A fund counts as
     the exposure it provides; a single stock counts as one company. The rule is
     stated in the UI rather than hidden behind a score.
     ═══════════════════════════════════════════════════════════════════════════ */

  /* Broad-market funds: one line item, thousands of underlying companies. */
  const BROAD_FUNDS={
    VTI:3600,VOO:500,SPY:500,IVV:500,SPLG:500,ITOT:2500,SCHB:2500,VT:9500,
    VTWO:2000,IWM:2000,VXUS:8500,VEA:4000,VWO:4500,IXUS:4300,ACWI:2300,
    VTSAX:3600,VFIAX:500,FXAIX:500,FSKAX:3900,FZROX:2600,SWTSX:3300,
    AVUS:2000,DFAC:2500,VONE:1000,SCHX:750,SCHF:1500
  };
  /* Bond funds — diversifying, but not equity breadth. */
  const BOND_FUNDS={BND:11000,AGG:12000,BNDX:7000,SCHZ:5000,VCIT:2000,VGIT:100,TLT:40,SHY:80,VTEB:8000,MUB:5000};
  /* Narrower funds: real diversification, but concentrated by sector or theme. */
  const SECTOR_FUNDS={QQQ:100,XLK:70,XLF:70,XLE:23,XLV:60,XLY:50,XLP:38,XLI:78,XLU:31,XLB:28,XLRE:31,
    SOXX:30,SMH:25,ARKK:35,SCHD:100,VYM:550,VIG:340,DVY:100,NOBL:65,JEPI:120,QYLD:100,SPHD:50,HDV:75,
    VNQ:160,GLD:1,SLV:1,IBIT:1,TQQQ:100,SOXL:30};

  function fundKind(sym){
    const t=(sym||'').toUpperCase();
    if(BROAD_FUNDS[t])return 'broad';
    if(BOND_FUNDS[t])return 'bond';
    if(SECTOR_FUNDS[t])return 'sector';
    return 'single';
  }
  function underlyingCount(sym){
    const t=(sym||'').toUpperCase();
    return BROAD_FUNDS[t]||BOND_FUNDS[t]||SECTOR_FUNDS[t]||1;
  }

  /* Weight of every holding by live market value, falling back to cost basis. */
  function holdingWeights(h, priceOf){
    /* Total is derived from the list passed in, not the global holdings array —
       otherwise every weight comes back zero when this is called with a subset
       or before the globals are populated. */
    const priced=(h||[]).map(x=>{
      const price=(typeof priceOf==='function' ? priceOf(x) : null) || Number(x.avgPrice);
      return {ticker:(x.ticker||'').toUpperCase(),value:Number(x.shares)*price};
    });
    const total=priced.reduce((sum,x)=>sum+(isFinite(x.value)?x.value:0),0);
    if(!total)return [];
    return priced.map(x=>Object.assign({},x,{pct:x.value/total*100}));
  }

  /* Breadth summary. singleNameMax is the largest weight in ONE company — a
     fund contributes almost nothing to any single name, which is the whole
     point of holding it. */
  function breadthProfile(h, priceOf){
    const w=holdingWeights(h, priceOf);
    let broadPct=0,bondPct=0,sectorPct=0,singlePct=0,singleNameMax=0,names=0;
    w.forEach(x=>{
      const kind=fundKind(x.ticker);
      if(kind==='broad')broadPct+=x.pct;
      else if(kind==='bond')bondPct+=x.pct;
      else if(kind==='sector')sectorPct+=x.pct;
      else{singlePct+=x.pct;singleNameMax=Math.max(singleNameMax,x.pct)}
      names+=underlyingCount(x.ticker);
    });
    return {broadPct,bondPct,sectorPct,singlePct,singleNameMax,
            approxCompanies:names,positions:h.length,weights:w};
  }

  /* The grade, stated as a rule the user can read back:
       A  60%+ in broad-market funds, or no single company above 5%
       B  30%+ in broad-market funds, or no single company above 10%
       C  no single company above 20%
       D  a single company is more than 20% of the portfolio               */
  function breadthGrade(b){
    /* Single-name risk CAPS the grade — it is not averaged away by index
       exposure. 60% in one company alongside 40% in VTI is still a portfolio
       whose outcome is decided by one company. */
    if(b.singleNameMax>35)return 'D';
    let g;
    if(b.broadPct>=60||b.singleNameMax<=5)g='A';
    else if(b.broadPct>=30||b.singleNameMax<=10)g='B';
    else if(b.singleNameMax<=20)g='C';
    else g='D';
    const cap=b.singleNameMax>20?'C':'A';
    const rank={A:0,B:1,C:2,D:3};
    return rank[g]>=rank[cap]?g:cap;
  }
  function breadthRule(b){
    /* Lead with the concentration when it is what set the grade. */
    if(b.singleNameMax>35)return 'One company is '+b.singleNameMax.toFixed(1)+'% of the portfolio. Index exposure alongside it does not offset that — the outcome still turns on one company.';
    if(b.singleNameMax>20)return 'Your largest single company is '+b.singleNameMax.toFixed(1)+'% of the portfolio'+(b.broadPct>=30?', which caps the grade even though '+Math.round(b.broadPct)+'% sits in broad-market funds':'')+'.';
    if(b.broadPct>=60)return Math.round(b.broadPct)+'% sits in broad-market funds, so you own a very wide slice of the market in few line items.';
    if(b.singleNameMax<=5)return 'No single company is more than 5% of the portfolio.';
    if(b.broadPct>=30)return Math.round(b.broadPct)+'% sits in broad-market funds.';
    if(b.singleNameMax<=10)return 'Your largest single company is '+b.singleNameMax.toFixed(1)+'% of the portfolio.';
    if(b.singleNameMax<=20)return 'Your largest single company is '+b.singleNameMax.toFixed(1)+'% — meaningful, but not dominant.';
    return 'One company is '+b.singleNameMax.toFixed(1)+'% of the portfolio. A single bad quarter there moves your whole balance.';
  }
  window.AP_BREADTH = {
    SECTORS: SECTORS,
    BROAD_FUNDS: BROAD_FUNDS,
    BOND_FUNDS: BOND_FUNDS,
    SECTOR_FUNDS: SECTOR_FUNDS,
    sector: getSector,
    sectorLabel: sectorLabel,
    fundKind: fundKind,
    underlyingCount: underlyingCount,
    weights: holdingWeights,
    profile: breadthProfile,
    grade: breadthGrade,
    rule: breadthRule
  };
})(window);
