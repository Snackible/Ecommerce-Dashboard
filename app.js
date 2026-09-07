 // ─── CONFIG ────────────────────────────────────────────────────────────────
const TOKEN = "sk_snk_a7Xq2mP9vL4nR8tK";
const FY25_MONTHS = new Set(['2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']);
const FY26_MONTHS = new Set(['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03']);
    const API_URL = "https://script.google.com/macros/s/AKfycbxM2JHOpEzxrUOKpc0fFfrbX0go3L7lVBWxAY8tERN1FYbOIBzfNjs4h7UsVpi9y-0i/exec?token=" + TOKEN;
const SKU_URL = API_URL + "&type=sku";
const SKU_DAILY_URL = API_URL + "&type=skudaily";
const SHOPIFY_URL = API_URL + "&type=shopify";
const FY25_URL = API_URL + "&type=fy25";
const FY25_SKU_URL = API_URL + "&type=fy25sku";

    // ─── CACHE LAYER (cache-first, manual refresh only) ─────────────────────────
    const CACHE_PREFIX = 'snk_dash_';
    let FORCE_REFRESH = false;
    async function cachedFetchText(url) {
      const key = CACHE_PREFIX + url;
      if (!FORCE_REFRESH) {
        try { const hit = localStorage.getItem(key); if (hit !== null) return hit; } catch (e) {}
      }
      const res = await fetch(FORCE_REFRESH ? url + '&refresh=1' : url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try { localStorage.setItem(key, text); } catch (e) {}
      return text;
    }
    function clearDashCache() {
      try { Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    }
    async function hardRefresh() {
      FORCE_REFRESH = true;              // stays true this session → all data pulls fresh
      clearDashCache();
      rawData = []; fy25Data = []; fy25DataLoaded = false;
      skuData = []; fy25SKUData = []; skuDailyData = [];
      const btn = document.getElementById('refresh-btn');
      if (btn) btn.classList.add('spinning');
      try { await init(); }
      finally { if (btn) btn.classList.remove('spinning'); }
    }
    // Cooler "gradient-to" shade for each base color — fades darker bar bottom → lighter top
    const GRAD_PAIRS = {
      '#F97316': '#FDBA74', // orange → peach
      '#A855F7': '#E879F9', // purple → magenta
      '#22C55E': '#4ADE80', // green → mint
      '#3B82F6': '#60A5FA', // blue → sky
      '#EAB308': '#FCD34D', // yellow → amber-light
      '#EF4444': '#FCA5A5', // red → coral
      '#665FEC': '#A78BFA', // zepto purple → lavender
      '#0050ff': '#60A5FA', // instamart blue → sky
      '#A0CD4A': '#BEF264', // big basket green → lime
      '#96bf48': '#BEF264'  // shopify green → lime
    };
    function gradTo(c) { return GRAD_PAIRS[c] || c; }

    const PLATFORM_CONFIG = {
      'Zepto':      { color: '#665FEC', budget: { '04': 1500000, '05': 2070000 } },
      'Blinkit':    { color: '#EAB308', budget: { '04': 0,       '05': 0 } },
      'Instamart':  { color: '#0050ff', budget: { '04': 1000000, '05': 1275000 } },
      'Big Basket': { color: '#A0CD4A', budget: { '04': 0,       '05': 0 } },
      'Amazon':     { color: '#F97316', budget: { '04': 0,       '05': 0 } },
      'First Club': { color: '#A855F7', budget: { '04': 0,       '05': 0 } },
      'Shopify':    { color: '#ec4899', budget: {} }
    };

    // ─── STATE ─────────────────────────────────────────────────────────────────
   let rawData = [];
    let fy25Data = [];
    let fy25DataLoaded = false;
    let chartRoasPlatform = null;
    let chartRoasTrend = null;
    let chartRoasPlatformTrend = null;
    let skuDailyData = [];
    let activeMonth = '09';
    let activePeriod = 'mtd';
    // t1, t2, 7d, mtd, custom
    let chartMix = null;
    let chartTrendTotal = null;
    let chartTrendPlatform = null;

    // ─── INIT ──────────────────────────────────────────────────────────────────
    async function preloadFY25SKUData() {
      if (fy25SKUData.length > 0) return;
      try {
        const text = await cachedFetchText(FY25_SKU_URL);
        if (!text || text.trim() === '') return;
        fy25SKUData = JSON.parse(text).map(r => ({...r, MTDUnits: Number(r.Quantity)||0, MTDRevenue: Number(r.GMV)||0}));
        console.log('FY25 SKU preloaded:', fy25SKUData.length);
      } catch(e) { console.error('FY25 SKU preload failed:', e); }
    }

    async function init() {
      try {
        const text = await cachedFetchText(API_URL);
        rawData = JSON.parse(text);
        if (!Array.isArray(rawData) || rawData.length === 0) throw new Error('Empty dataset');

        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('freshness-badge').style.display = 'inline-flex';
        document.getElementById('freshness-text').textContent = `${rawData.length} rows`;
        // Free GPU after loading screen fades out
        

        // Sync activeMonth state with dropdown default value
        activeMonth = document.getElementById('month-select').value;
      activeMonth = document.getElementById('month-select').value;
      loadFY25Data();
      preloadFY25SKUData();
        render();
      } catch (err) {
        document.getElementById('loading-state').classList.add('hidden');
        setTimeout(() => ShaderManager.unmount('loading-shader-container'), 500);
        const es = document.getElementById('error-state');
        es.classList.add('visible');
        document.getElementById('error-msg').textContent = err.message || 'Could not load data.';
        console.error(err);
      }
    }
async function loadFY25Data() {
      if (fy25DataLoaded) return;
      try {
        const text = await cachedFetchText(FY25_URL);
        if (!text || text.trim() === '') { fy25Data = []; return; }
        fy25Data = JSON.parse(text);
        fy25DataLoaded = true;
        console.log('FY25 rows loaded:', fy25Data.length);
      } catch(e) {
        console.error('FY25 fetch failed:', e);
        fy25Data = [];
      }
    }
    function parseLocalDate(str) {
      // Let the browser natively handle the UTC to IST timezone shift
      const d = new Date(str); 
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    // ─── FILTERS ───────────────────────────────────────────────────────────────
     function setMonth(m) {
      activeMonth = m;
      skuData = [];
      fy25SKUData = [];
      skuDailyData = [];// reset FY25 SKU too so it re-fetches for new month
      const isFY25Month = m !== 'All' && FY25_MONTHS.has(m);
      const _now = new Date();
      const _currentKey = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
      const isCurrentMonth = m === _currentKey;
      if (!isCurrentMonth && (activePeriod === 't1' || activePeriod === 't2' || activePeriod === 'mtd')) {
        activePeriod = 'mtd';
      }
      if (isFY25Month && !fy25DataLoaded) {
        loadFY25Data().then(() => {
          render();
          if (activeTab === 'deepdive') updateDDView();
        });
        return;
      }
      render();
      if (activeTab === 'deepdive') updateDDView();
    }

 const ZEPTO_SPEND_CORRECTION = {
  '2026-07': 0.5  // Zepto co-funds 100% in July — actual spend is 50% of OMS figure
};

function getFilteredData() {
      const platform = document.getElementById('platformFilter').value;
      const today = new Date(); today.setHours(0,0,0,0);

      // Route to correct dataset
      const isFY25 = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const dataset = isFY25 ? fy25Data : rawData;
      // Find latest date in dataset
      const allDates = dataset.map(r => parseLocalDate(r.Date)).filter(d => !isNaN(d));
    const latestDate = allDates.length ? new Date(Math.max(...allDates)) : today;
      latestDate.setHours(0,0,0,0);

      const t1 = new Date(latestDate);
      const t2 = new Date(latestDate); t2.setDate(t2.getDate() - 1);

      // Parse month/year from activeMonth value (e.g. "2026-07" or "All")
      const [selYear, selMonth] = activeMonth !== 'All' ? activeMonth.split('-').map(Number) : [null, null];

      return dataset.filter(row => {
        const rowDate = parseLocalDate(row.Date); rowDate.setHours(0,0,0,0);
        const rowYear = rowDate.getFullYear();
        const monthMatch = activeMonth === 'All'
          ? true
          : (Number(row.Month) === selMonth && rowYear === selYear);
        const platMatch  = platform === 'All' || String(row.Platform) === platform;

        let dateMatch = true;
        if (activePeriod === 't1') {
          dateMatch = rowDate.getTime() === t1.getTime();
        } else if (activePeriod === 't2') {
          dateMatch = rowDate.getTime() === t2.getTime();
        } else if (activePeriod === '7d') {
          const cutoff = new Date(latestDate); cutoff.setDate(cutoff.getDate() - 7);
          dateMatch = rowDate > cutoff && rowDate <= latestDate;
        } else if (activePeriod === 'mtd') {
          dateMatch = true; 
        } else if (activePeriod === 'custom') {
          const s = document.getElementById('customStart').value;
          const e = document.getElementById('customEnd').value;
          
          const sd = s ? parseLocalDate(s) : new Date(0);
          const ed = e ? parseLocalDate(e) : new Date('2999-01-01');
          
          sd.setHours(0,0,0,0); 
          ed.setHours(23,59,59,999); // Force to very end of the day
          
          const isMatch = rowDate >= sd && rowDate <= ed;
          
          // Return immediately to override the Month dropdown
          return platMatch && isMatch;
        }
       return monthMatch && platMatch && dateMatch;
      }).map(row => {
        const correction = ZEPTO_SPEND_CORRECTION[activeMonth];
        if (correction && String(row.Platform) === 'Zepto') {
          const correctedSpends = (Number(row.Spends) || 0) * correction;
          const correctedROAS = correctedSpends > 0 ? (Number(row.Sales) || 0) / correctedSpends : 0;
          return { ...row, Spends: correctedSpends, ROAS: correctedROAS };
        }
        return row;
      });
    }
        

    function setPeriod(p) {
      activePeriod = p;
      const customPicker = document.getElementById('custom-date-range');
      customPicker.style.display = p === 'custom' ? 'flex' : 'none';
      ['t1','t2','7d','mtd','custom'].forEach(k => {
        const el = document.getElementById('period-' + k);
        if (el) el.classList.toggle('active', k === p);
      });
      render();
    }

    // ─── HELPERS ───────────────────────────────────────────────────────────────
    function fmt(n, isCurrency = true) {
      if (!n || isNaN(n)) return isCurrency ? '₹0' : '0';
      let s = n >= 10000000 ? (n/10000000).toFixed(2)+'Cr'
            : n >= 100000  ? (n/100000).toFixed(2)+'L'
            : n >= 1000    ? (n/1000).toFixed(1)+'K'
            : Number(n).toFixed(0);
      return isCurrency ? '₹'+s : s;
    }

    function fmtRoas(r) {
      if (!r || isNaN(r) || r === 0) return '--';
      return Number(r).toFixed(2) + 'x';
    }

    function roasBadgeClass(r) {
      if (!r || r === 0) return '';
      return r >= 2 ? 'good' : 'ok';
    }

    function monthLabel(m) {
      if (m === 'All') return 'All Time';
      const LABELS = {
        '2025-04':'April 2025','2025-05':'May 2025','2025-06':'June 2025','2025-07':'July 2025',
        '2025-08':'Aug 2025','2025-09':'Sep 2025','2025-10':'Oct 2025','2025-11':'Nov 2025',
        '2025-12':'Dec 2025','2026-01':'Jan 2026','2026-02':'Feb 2026','2026-03':'Mar 2026',
        '2026-04':'April 2026','2026-05':'May 2026','2026-06':'June 2026','2026-07':'July 2026','2026-08':'August 2026'
      };
      return LABELS[m] || m;
    }

    // ─── DEEP DIVE ─────────────────────────────────────────────────────────────
    let ddMetric = 'sales';
    let ddView = 'current';
    let ddCharts = {};

    function openDeepDive(metric) {
      switchTab('deepdive');
      setDDMetric(metric);
    }

    function setDDMetric(metric) {
      ddMetric = metric;
      ['sales','roas','qty'].forEach(m => {
        document.getElementById('dd-tab-' + m).classList.toggle('active', m === metric);
      });
      updateDDView();
    }

    function setDDView(view) {
      ddView = view;
      ['current','trends','yoy'].forEach(v => {
        document.getElementById('dd-pill-' + v).classList.toggle('active', v === view);
      });
      updateDDView();
    }

    async function updateDDView() {
      document.querySelectorAll('.dd-view').forEach(el => el.style.display = 'none');
      const el = document.getElementById('dd-' + ddMetric + '-' + ddView);
      if (!el) return;
      el.style.display = 'block';
      await Promise.all([
        preloadFY25SKUData(),
        skuData.length === 0 ? loadSKUData() : Promise.resolve()
      ]);
      renderDDView(ddMetric, ddView);
    }

    function renderDDView(metric, view) {
      if (metric === 'sales') {
        if (view === 'current') renderDDSalesCurrent();
        else if (view === 'trends') { renderDDSalesTrend(); renderDDSalesByPlat(); }
        else if (view === 'yoy') { renderDDSalesYoYKPIs(); renderDDSalesYoYChart(); }
      } else if (metric === 'roas') {
        if (view === 'current') renderDDROASCurrent();
        else if (view === 'trends') { renderDDROASTrend(); renderDDROASPlatTrend(); }
        else if (view === 'yoy') { renderDDROASYoYKPIs(); renderDDROASYoYChart(); }
      } else if (metric === 'qty') {
        if (view === 'current') { renderDDQtyCurrent(); renderDDQtyCatDonut(); renderDDQtyTopSKUs(); }
        else if (view === 'trends') { renderDDQtyTrend(); renderDDASPTrend(); renderDDQtyCatTrend(); renderDDQtyPlatShare(); }
        else if (view === 'yoy') { renderDDQtyYoYKPIs(); renderDDQtyYoYChart(); renderDDQtyCatYoY(); renderDDQtyMixYoY(); } 
      }
    }

    function fmtDD(v) { if(v>=1e7) return '₹'+(v/1e7).toFixed(2)+'Cr'; if(v>=1e5) return '₹'+(v/1e5).toFixed(1)+'L'; if(v>=1e3) return '₹'+(v/1e3).toFixed(1)+'K'; return '₹'+v.toFixed(0); }
    function fmtDDU(v) { if(v>=1e5) return (v/1e5).toFixed(1)+'L'; if(v>=1e3) return (v/1e3).toFixed(1)+'K'; return v.toFixed(0); }

    function getDDMonthData(year, month, platform) {
      const src = (year === 2025 || (year === 2026 && month <= 3)) ? fy25Data : rawData;
      return src.filter(r => {
        const d = parseLocalDate(r.Date);
        const platOk = !platform || r.Platform === platform;
        return d.getFullYear() === year && d.getMonth()+1 === month && platOk;
      });
    }

    function getDDPeriodPoints(period) {
      const MONTHS = [
        {y:2025,m:4,l:'Apr 25'},{y:2025,m:5,l:'May 25'},{y:2025,m:6,l:'Jun 25'},
        {y:2025,m:7,l:'Jul 25'},{y:2025,m:8,l:'Aug 25'},{y:2025,m:9,l:'Sep 25'},
        {y:2025,m:10,l:'Oct 25'},{y:2025,m:11,l:'Nov 25'},{y:2025,m:12,l:'Dec 25'},
        {y:2026,m:1,l:'Jan 26'},{y:2026,m:2,l:'Feb 26'},{y:2026,m:3,l:'Mar 26'},
        {y:2026,m:4,l:'Apr 26'},{y:2026,m:5,l:'May 26'},{y:2026,m:6,l:'Jun 26'},{y:2026,m:7,l:'Jul 26'},
        {y:2026,m:8,l:'Aug 26'},{y:2026,m:9,l:'Sep 26'},{y:2026,m:10,l:'Oct 26'},
        {y:2026,m:11,l:'Nov 26'},{y:2026,m:12,l:'Dec 26'},
        {y:2027,m:1,l:'Jan 27'},{y:2027,m:2,l:'Feb 27'},{y:2027,m:3,l:'Mar 27'}
      ];
      const QUARTERS = [
        {l:'Q1 FY26',months:[{y:2025,m:4},{y:2025,m:5},{y:2025,m:6}]},
        {l:'Q2 FY26',months:[{y:2025,m:7},{y:2025,m:8},{y:2025,m:9}]},
        {l:'Q3 FY26',months:[{y:2025,m:10},{y:2025,m:11},{y:2025,m:12}]},
        {l:'Q4 FY26',months:[{y:2026,m:1},{y:2026,m:2},{y:2026,m:3}]},
        {l:'Q1 FY27',months:[{y:2026,m:4},{y:2026,m:5},{y:2026,m:6}]},
        {l:'Q2 FY27',months:[{y:2026,m:7},{y:2026,m:8},{y:2026,m:9}]},
        {l:'Q3 FY27',months:[{y:2026,m:10},{y:2026,m:11},{y:2026,m:12}]},
        {l:'Q4 FY27',months:[{y:2027,m:1},{y:2027,m:2},{y:2027,m:3}]}
      ];
      const FYS = [
        {l:'FY25-26',months:[{y:2025,m:4},{y:2025,m:5},{y:2025,m:6},{y:2025,m:7},{y:2025,m:8},{y:2025,m:9},{y:2025,m:10},{y:2025,m:11},{y:2025,m:12},{y:2026,m:1},{y:2026,m:2},{y:2026,m:3}]},
        {l:'FY26-27',months:[{y:2026,m:4},{y:2026,m:5},{y:2026,m:6},{y:2026,m:7},{y:2026,m:8},{y:2026,m:9},{y:2026,m:10},{y:2026,m:11},{y:2026,m:12},{y:2027,m:1},{y:2027,m:2},{y:2027,m:3}]}
      ];
      const QCOM_PLATS = new Set(['Zepto','Instamart','Blinkit']);
      const qcomOnly = rows => rows.filter(r => QCOM_PLATS.has(String(r.Platform)));
      if (period === 'monthly') return MONTHS.map(({y,m,l}) => { const rows=getDDMonthData(y,m,null); const qrows=qcomOnly(rows); const sales=rows.reduce((s,r)=>s+(Number(r.Sales)||0),0); const spends=qrows.reduce((s,r)=>s+(Number(r.Spends)||0),0); const units=rows.reduce((s,r)=>s+(Number(r.Units)||0),0); return {l,sales,spends,units,roas:spends>0?+(qrows.reduce((s,r)=>s+(Number(r.Sales)||0),0)/spends).toFixed(2):0}; }).filter(p=>p.sales>0);
      if (period === 'quarterly') return QUARTERS.map(q => { const rows=q.months.flatMap(({y,m})=>getDDMonthData(y,m,null)); const qrows=qcomOnly(rows); const sales=rows.reduce((s,r)=>s+(Number(r.Sales)||0),0); const spends=qrows.reduce((s,r)=>s+(Number(r.Spends)||0),0); const units=rows.reduce((s,r)=>s+(Number(r.Units)||0),0); return {l:q.l,sales,spends,units,roas:spends>0?+(qrows.reduce((s,r)=>s+(Number(r.Sales)||0),0)/spends).toFixed(2):0}; }).filter(p=>p.sales>0);
      if (period === 'fy') return FYS.map(f => { const rows=f.months.flatMap(({y,m})=>getDDMonthData(y,m,null)); const qrows=qcomOnly(rows); const sales=rows.reduce((s,r)=>s+(Number(r.Sales)||0),0); const spends=qrows.reduce((s,r)=>s+(Number(r.Spends)||0),0); const units=rows.reduce((s,r)=>s+(Number(r.Units)||0),0); return {l:f.l,sales,spends,units,roas:spends>0?+(qrows.reduce((s,r)=>s+(Number(r.Sales)||0),0)/spends).toFixed(2):0}; }).filter(p=>p.sales>0);
        return [];
    }

    function ddKpiHtml(label, val, delta, sub, colorClass) {
      const isUp = delta > 0; const isDn = delta < 0;
      const pillCls = isUp ? 'color:#22C55E;background:rgba(34,197,94,0.1)' : isDn ? 'color:#EF4444;background:rgba(239,68,68,0.1)' : 'color:#6b7280;background:rgba(148,163,184,0.08)';
      const arrow = isUp ? '↑' : isDn ? '↓' : '→';
      return `<div class="kpi-card" style="padding:14px 16px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${colorClass}"></div>
        <div class="section-caption" style="margin-bottom:4px;">${label}</div>
        <div style="font-size:22px;font-weight:700;color:var(--text-primary);line-height:1.1;">${val}</div>
        <div style="display:inline-flex;align-items:center;gap:2px;padding:2px 7px;border-radius:8px;font-size:10px;font-weight:600;font-family:'Geist Mono',monospace;margin-top:5px;${pillCls}">${arrow} ${Math.abs(delta).toFixed(1)}%</div>
        <div class="section-caption" style="margin-top:3px;">${sub}</div>
      </div>`;
    }

    function ddScoreHtml(platform, val, deltaVal, color) {
      const isUp = deltaVal >= 0;
      const pillStyle = isUp ? 'color:#22C55E;background:rgba(34,197,94,0.1)' : 'color:#EF4444;background:rgba(239,68,68,0.1)';
      return `<div class="dd-scorecard" style="background:${color}11;border-color:${color}25;">
        <span style="font-size:12px;font-weight:600;color:${color}">${platform}</span>
        <span style="font-family:'Geist Mono',monospace;font-size:11px;color:var(--text-primary)">${val}</span>
        <span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:8px;font-size:10px;font-weight:600;font-family:'Geist Mono',monospace;${pillStyle}">${isUp?'↑':'↓'}${Math.abs(deltaVal).toFixed(1)}%</span>
      </div>`;
    }

    const PLAT_COLORS = { Blinkit:'#EAB308', Zepto:'#8B5CF6', Instamart:'#3B82F6', Amazon:'#F97316', 'Big Basket':'#22C55E', Shopify:'#EC4899', 'First Club':'#06B6D4' };

    function renderDDSalesCurrent() {
      const data = getFilteredData();
      const agg = {}; let totalSales=0; let totalUnits=0;
      data.forEach(r => { const p=r.Platform; if(!agg[p]) agg[p]={sales:0,units:0}; agg[p].sales+=Number(r.Sales)||0; agg[p].units+=Number(r.Units)||0; totalSales+=Number(r.Sales)||0; totalUnits+=Number(r.Units)||0; });
      const prevMonth = getPrevMonthAgg();
      const prevSales = prevMonth ? Object.values(prevMonth).reduce((s,v)=>s+(v.sales||0),0) : 0;
      const momPct = prevSales > 0 ? (totalSales - prevSales)/prevSales*100 : 0;
      const bestPlat = Object.entries(agg).sort((a,b)=>b[1].sales-a[1].sales)[0];
      document.getElementById('dd-sales-kpis').innerHTML =
        ddKpiHtml('Total Sales', fmtDD(totalSales), momPct, `vs prev month`, 'linear-gradient(90deg,#EAB308,#F97316)') +
        ddKpiHtml('Best Platform', bestPlat?bestPlat[0]:'—', bestPlat?(agg[bestPlat[0]].sales/totalSales*100):0, bestPlat?fmtDD(agg[bestPlat[0]].sales)+' MTD':'', 'linear-gradient(90deg,#a78bfa,#8B5CF6)') +
        ddKpiHtml('Total Units', fmtDDU(totalUnits), momPct*0.8, `blended`, 'linear-gradient(90deg,#22C55E,#16a34a)') +
        ddKpiHtml('Proj. Month', fmtDD(totalSales * projMultiplier()), 0, 'at current run rate', 'linear-gradient(90deg,#3B82F6,#0ea5e9)');
      const platData = Object.entries(agg).filter(([,v])=>v.sales>0).sort((a,b)=>b[1].sales-a[1].sales);
      if (ddCharts['dd-chart-sales-mix']) { ddCharts['dd-chart-sales-mix'].destroy(); }
      ddCharts['dd-chart-sales-mix'] = new ApexCharts(document.getElementById('dd-chart-sales-mix'), {
        series: platData.map(([,v])=>v.sales), labels: platData.map(([k])=>k),
        chart:{type:'donut',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors: platData.map(([k])=>PLAT_COLORS[k]||'#888'),
        theme:{mode:'dark'}, legend:{position:'right',fontSize:'11px',fontFamily:'Geist Mono, monospace'},
        dataLabels:{enabled:false}, plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{show:true,fontSize:'11px',color:'#6b7280',fontFamily:'Geist Mono, monospace'},value:{show:true,fontSize:'18px',fontWeight:600,color:'#f0f0f0',fontFamily:'Geist Mono, monospace',formatter:v=>fmtDD(Number(v))},total:{show:true,label:'Total',formatter:()=>fmtDD(totalSales),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
        tooltip:{y:{formatter:v=>{if(v>=1e7)return '₹'+(v/1e7).toFixed(2)+'Cr';if(v>=1e5)return '₹'+(v/1e5).toFixed(2)+'L';if(v>=1e3)return '₹'+(v/1e3).toFixed(2)+'K';return '₹'+v.toFixed(0);}},theme:'dark'}
      });
      ddCharts['dd-chart-sales-mix'].render();
      // Daily line chart
      const dailyMap = {};
      data.forEach(r => { const d=r.Date.slice(0,10); dailyMap[d]=(dailyMap[d]||0)+(Number(r.Sales)||0); });
      const dailyDates = Object.keys(dailyMap).sort();
      const dailyVals = dailyDates.map(d=>dailyMap[d]);
      const dailyLabels = dailyDates.map(d=>{ const p=d.split('-'); return p[2]+'/'+p[1]; });
      if(ddCharts['dd-chart-sales-daily']) ddCharts['dd-chart-sales-daily'].destroy();
      ddCharts['dd-chart-sales-daily'] = new ApexCharts(document.getElementById('dd-chart-sales-daily'),{
        series:[{name:'Sales',data:dailyVals}],
        chart:{type:'area',height:180,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#F97316'],stroke:{width:2.5,curve:'smooth'},
        fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',opacityFrom:0.3,opacityTo:0.02}},
        markers:{size:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:dailyLabels,tickAmount:6,labels:{style:{colors:'#555',fontSize:'9px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>fmtDD(v),style:{colors:'#9ca3b3',fontSize:'9px'}}},
        tooltip:{theme:'dark',y:{formatter:v=>fmtDD(v)}}
      });
      ddCharts['dd-chart-sales-daily'].render();

      // Day of week breakdown
      const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const dowSales = Array(7).fill(0);
      data.forEach(r => {
        const d = parseLocalDate(r.Date);
        dowSales[d.getDay()] += Number(r.Sales)||0;
      });
      const dowTotal = dowSales.reduce((a,b)=>a+b,0);
      const dowOrdered = [1,2,3,4,5,6,0]; // Mon→Sun
      const dowLabels = dowOrdered.map(i=>DOW_LABELS[i]);
      const dowValues = dowOrdered.map(i=>dowSales[i]);
      if(ddCharts['dd-chart-sales-dow']) ddCharts['dd-chart-sales-dow'].destroy();
      ddCharts['dd-chart-sales-dow'] = new ApexCharts(document.getElementById('dd-chart-sales-dow'), {
        series: dowValues,
        labels: dowLabels,
        chart:{type:'donut',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors:['#EAB308','#F97316','#22C55E','#3B82F6','#A855F7','#06B6D4','#EC4899'],
        theme:{mode:'dark'},
        legend:{position:'right',fontSize:'10px',fontFamily:'Geist Mono, monospace'},
        dataLabels:{enabled:false},
        plotOptions:{pie:{donut:{size:'62%',labels:{show:true,name:{show:true,fontSize:'10px',color:'#6b7280',fontFamily:'Geist Mono, monospace'},value:{show:true,fontSize:'16px',fontWeight:600,color:'#f0f0f0',fontFamily:'Geist Mono, monospace',formatter:v=>fmtDD(Number(v))},total:{show:true,label:'Total',formatter:()=>fmtDD(dowTotal),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
        tooltip:{theme:'dark',custom:function({seriesIndex,w}){
          const pct = dowTotal>0?(dowValues[seriesIndex]/dowTotal*100).toFixed(1):'0.0';
          return `<div style="padding:8px 12px;background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:6px">
            <div style="color:#f1f5f9;font-weight:600;font-size:12px">${dowLabels[seriesIndex]}</div>
            <div style="color:#EAB308;font-family:'Geist Mono',monospace;font-size:13px;margin-top:4px">${fmtDD(dowValues[seriesIndex])}</div>
            <div style="color:#9ca3b3;font-family:'Geist Mono',monospace;font-size:11px;margin-top:2px">${pct}% of week</div>
          </div>`;
        }}
      });
      ddCharts['dd-chart-sales-dow'].render();

      // Week of month breakdown
      const weekBuckets = [{l:'W1 (1–7)',s:0},{l:'W2 (8–14)',s:0},{l:'W3 (15–21)',s:0},{l:'W4 (22–28)',s:0},{l:'W5 (29+)',s:0}];
      data.forEach(r => {
        const day = parseLocalDate(r.Date).getDate();
        const wi = day<=7?0:day<=14?1:day<=21?2:day<=28?3:4;
        weekBuckets[wi].s += Number(r.Sales)||0;
      });
      const filledWeeks = weekBuckets.filter(w=>w.s>0);
      if(ddCharts['dd-chart-sales-wow']) ddCharts['dd-chart-sales-wow'].destroy();
      ddCharts['dd-chart-sales-wow'] = new ApexCharts(document.getElementById('dd-chart-sales-wow'), {
        series:[{name:'Sales',data:filledWeeks.map(w=>w.s)}],
        chart:{type:'area',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#EAB308'],stroke:{width:2.5,curve:'smooth'},
        fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',opacityFrom:0.25,opacityTo:0.02}},
        markers:{size:5,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:filledWeeks.map(w=>w.l),labels:{style:{colors:'#9ca3b3',fontSize:'9px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>fmtDD(v),style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{theme:'dark',y:{formatter:v=>fmtDD(v)}}
      });
      ddCharts['dd-chart-sales-wow'].render();
    }

    function projMultiplier() {
      const now = new Date(); const dim = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      return dim / now.getDate();
    }

    function getPrevMonthAgg() {
      const now = new Date(); let py=now.getFullYear(), pm=now.getMonth();
      if(pm===0){pm=12;py--;}
      const src = (py===2025||(py===2026&&pm<=3)) ? fy25Data : rawData;
      const rows = src.filter(r=>{const d=parseLocalDate(r.Date);return d.getFullYear()===py&&d.getMonth()+1===pm;});
      const agg = {};
      rows.forEach(r=>{const p=r.Platform;if(!agg[p])agg[p]={sales:0,units:0,spends:0};agg[p].sales+=Number(r.Sales)||0;agg[p].units+=Number(r.Units)||0;agg[p].spends+=Number(r.Spends)||0;});
      return agg;
    }

    function renderDDSalesTrend() {
      const period = document.getElementById('dd-sales-trend-period')?.value || 'monthly';
      const pts = getDDPeriodPoints(period);
      const growths = pts.map((p,i)=>i===0?null:(pts[i-1].sales>0?((p.sales-pts[i-1].sales)/pts[i-1].sales*100):0));
      if (ddCharts['dd-chart-sales-trend']) ddCharts['dd-chart-sales-trend'].destroy();
      ddCharts['dd-chart-sales-trend'] = new ApexCharts(document.getElementById('dd-chart-sales-trend'), {
        series:[{name:'Sales',data:pts.map(p=>+(p.sales/1e7).toFixed(3))}],
        chart:{type:'area',height:320,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#EAB308'],stroke:{width:2.5,curve:'smooth'},
        fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',opacityFrom:0.35,opacityTo:0.02}},
        markers:{size:5,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4,padding:{left:10,right:20}},
        xaxis:{categories:pts.map(p=>p.l),labels:{style:{colors:'#9ca3b3',fontSize:'11px'},rotate:-30,rotateAlways:false,hideOverlappingLabels:false,offsetY:4},axisBorder:{show:false},axisTicks:{show:false},tickPlacement:'on'},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'Cr',style:{colors:'#9ca3b3',fontSize:'11px'}}},
        tooltip:{theme:'dark',custom:function({series,seriesIndex,dataPointIndex,w}){
          const sales=series[seriesIndex][dataPointIndex];
          const g=growths[dataPointIndex];
          const label=pts[dataPointIndex]?.l || '';
          const gStr=g===null?'':g>=0?`<div style="color:#22c55e;font-family:'Geist Mono',monospace;font-size:11px;margin-top:2px">↑ ${g.toFixed(1)}% MoM</div>`:`<div style="color:#ef4444;font-family:'Geist Mono',monospace;font-size:11px;margin-top:2px">↓ ${Math.abs(g).toFixed(1)}% MoM</div>`;
          return `<div style="padding:8px 12px;background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:6px"><div style="color:#f1f5f9;font-weight:600;font-size:12px">${label}</div><div style="color:#EAB308;font-family:'Geist Mono',monospace;font-size:13px;margin-top:4px">Sales: ${fmtDD(sales*1e7)}</div>${gStr}</div>`;
        }}
      });
      ddCharts['dd-chart-sales-trend'].render();
    }

    function renderDDSalesMoM() {
      const pts = getDDPeriodPoints('monthly');
      const growths = pts.slice(1).map((p,i)=>{ const prev=pts[i].sales; return{l:p.l,g:prev>0?(p.sales-prev)/prev*100:0}; });
      if (ddCharts['dd-chart-sales-mom']) ddCharts['dd-chart-sales-mom'].destroy();
      ddCharts['dd-chart-sales-mom'] = new ApexCharts(document.getElementById('dd-chart-sales-mom'), {
        series:[{name:'MoM %',data:growths.map(g=>+g.g.toFixed(1))}],
        chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#22C55E'],
        plotOptions:{bar:{borderRadius:4,columnWidth:'55%',colors:{ranges:[{from:-100,to:0,color:'#EF4444'}]}}},
        dataLabels:{enabled:false},grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:growths.map(g=>g.l),labels:{style:{colors:'#555',fontSize:'10px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(0)+'%',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>v.toFixed(1)+'%'},theme:'dark'}
      });
      ddCharts['dd-chart-sales-mom'].render();
    }

    function renderDDSalesByPlat() {
      const sel = document.getElementById('dd-sales-byplat-sel')?.value || 'all';
      const ALL_PLATS = ['Blinkit','Zepto','Instamart','Big Basket','Amazon'];
      const PLATS = sel === 'all' ? ALL_PLATS : [sel];
      const MONTHS_DEF = [{y:2025,m:4,l:'Apr 25'},{y:2025,m:5,l:'May 25'},{y:2025,m:6,l:'Jun 25'},{y:2025,m:7,l:'Jul 25'},{y:2025,m:8,l:'Aug 25'},{y:2025,m:9,l:'Sep 25'},{y:2025,m:10,l:'Oct 25'},{y:2025,m:11,l:'Nov 25'},{y:2025,m:12,l:'Dec 25'},{y:2026,m:1,l:'Jan 26'},{y:2026,m:2,l:'Feb 26'},{y:2026,m:3,l:'Mar 26'},{y:2026,m:4,l:'Apr 26'},{y:2026,m:5,l:'May 26'},{y:2026,m:6,l:'Jun 26'},{y:2026,m:7,l:'Jul 26'},{y:2026,m:8,l:'Aug 26'}];
      const series = PLATS.map(p => ({ name:p, data: MONTHS_DEF.map(({y,m})=>{ const rows=getDDMonthData(y,m,p); return +(rows.reduce((s,r)=>s+(Number(r.Sales)||0),0)/1e7).toFixed(3); }) }));
      if (ddCharts['dd-chart-sales-byplat']) ddCharts['dd-chart-sales-byplat'].destroy();
      ddCharts['dd-chart-sales-byplat'] = new ApexCharts(document.getElementById('dd-chart-sales-byplat'), {
        series, chart:{type:'line',height:320,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:PLATS.map(p=>PLAT_COLORS[p]),stroke:{width:PLATS.length===1?3:2,curve:'smooth'},
        markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4,padding:{left:10,right:20}},
        xaxis:{categories:MONTHS_DEF.map(m=>m.l),labels:{style:{colors:'#9ca3b3',fontSize:'11px'},rotate:-30,offsetY:4},axisBorder:{show:false},axisTicks:{show:false},tickPlacement:'on'},
        yaxis:{labels:{formatter:v=>v.toFixed(2)+'Cr',style:{colors:'#9ca3b3',fontSize:'11px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px',fontFamily:'Geist Mono, monospace',show:PLATS.length>1},
        tooltip:{theme:'dark',y:{formatter:v=>fmtDD(v*1e7)}}
      });
      ddCharts['dd-chart-sales-byplat'].render();
    }
    function renderDDSalesYoYKPIs() {
      const PLATS = ['Blinkit','Zepto','Instamart','Amazon'];
      const COLORS = ['linear-gradient(90deg,#EAB308,#F97316)','linear-gradient(90deg,#a78bfa,#8B5CF6)','linear-gradient(90deg,#22C55E,#16a34a)','linear-gradient(90deg,#3B82F6,#0ea5e9)'];
      const now = new Date(); const cm=now.getMonth()+1; const cy=now.getFullYear();
      const pm = cm<=3?cm+9:cm-3; const py25 = cm<=3?2025:2025;
      let html = '';
      PLATS.forEach((p,i)=>{
        const fy26rows = getDDMonthData(cy,cm,p); const fy25rows = getDDMonthData(2025,cm,p);
        const fy26s=fy26rows.reduce((s,r)=>s+(Number(r.Sales)||0),0);
        const fy25s=fy25rows.reduce((s,r)=>s+(Number(r.Sales)||0),0);
        const pct=fy25s>0?(fy26s-fy25s)/fy25s*100:0;
        html+=ddKpiHtml(p+' YoY',pct.toFixed(1)+'%',pct,'FY26 '+fmtDD(fy26s)+' · FY25 '+fmtDD(fy25s),COLORS[i]);
      });
      document.getElementById('dd-sales-yoy-kpis').innerHTML=html;
    }

    function renderDDSalesYoYChart() {
      const PLATS = ['Blinkit','Zepto','Instamart','Amazon'];
      const now = new Date(); const months = [];
      for(let m=4;m<=now.getMonth()+1+(now.getFullYear()===2026?0:0);m++) months.push(m);
      const fy26 = PLATS.map(p=>({name:'FY26 '+p,data:months.map(m=>{const rows=getDDMonthData(2026,m,p);return +(rows.reduce((s,r)=>s+(Number(r.Sales)||0),0)/1e7).toFixed(3);})}));
      const fy25 = PLATS.map(p=>({name:'FY25 '+p,data:months.map(m=>{const rows=getDDMonthData(2025,m,p);return +(rows.reduce((s,r)=>s+(Number(r.Sales)||0),0)/1e7).toFixed(3);})}));
      const labels = months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      if(ddCharts['dd-chart-sales-yoy'])ddCharts['dd-chart-sales-yoy'].destroy();
      ddCharts['dd-chart-sales-yoy']=new ApexCharts(document.getElementById('dd-chart-sales-yoy'),{
        series:[...fy26,...fy25],chart:{type:'bar',height:260,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...PLATS.map(p=>PLAT_COLORS[p]),...PLATS.map(p=>PLAT_COLORS[p]+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'70%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'Cr',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px',fontFamily:'Geist Mono, monospace'},
        tooltip:{y:{formatter:v=>fmtDD(v*1e7)},theme:'dark'}
      });
      ddCharts['dd-chart-sales-yoy'].render();
    }

    function renderDDROASCurrent() {
      const data = getFilteredData();
      const agg = {};
      data.forEach(r=>{const p=r.Platform;if(!agg[p])agg[p]={sales:0,spends:0};agg[p].sales+=Number(r.Sales)||0;agg[p].spends+=Number(r.Spends)||0;});
      const PAID_CHANNELS = ['Blinkit','Zepto','Instamart'];
      const platData=Object.entries(agg).filter(([k,v])=>PAID_CHANNELS.includes(k) && v.spends>0).sort((a,b)=>(b[1].sales/b[1].spends)-(a[1].sales/a[1].spends));
      const paidSales=PAID_CHANNELS.reduce((s,p)=>s+(agg[p]?.sales||0),0);
      const totalSp=PAID_CHANNELS.reduce((s,p)=>s+(agg[p]?.spends||0),0);
      const blended=totalSp>0?paidSales/totalSp:0;
      const best=platData[0]; const worst=platData[platData.length-1];
      document.getElementById('dd-roas-kpis').innerHTML=
        ddKpiHtml('Blended ROAS',blended.toFixed(2)+'x',0,'all platforms','linear-gradient(90deg,#EAB308,#F97316)')+
        ddKpiHtml('Best ROAS',best?best[0]:'—',0,best?(best[1].sales/best[1].spends).toFixed(2)+'x':'','linear-gradient(90deg,#a78bfa,#8B5CF6)')+
        ddKpiHtml('Total Ad Spend',fmtDD(totalSp),0,'tracked budget','linear-gradient(90deg,#22C55E,#16a34a)')+
        ddKpiHtml('Watch',worst&&(worst[1].sales/worst[1].spends)<5?worst[0]:'—',worst?-(5-(worst[1].sales/worst[1].spends)):0,'below 5x target','linear-gradient(90deg,#3B82F6,#0ea5e9)');
      if(ddCharts['dd-chart-roas-bar'])ddCharts['dd-chart-roas-bar'].destroy();
      ddCharts['dd-chart-roas-bar']=new ApexCharts(document.getElementById('dd-chart-roas-bar'),{
        series:[{name:'ROAS',data:platData.map(([,v])=>+(v.sales/v.spends).toFixed(2))}],
        chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:platData.map(([k])=>PLAT_COLORS[k]||'#888'),
        plotOptions:{bar:{borderRadius:4,columnWidth:'50%',distributed:true}},dataLabels:{enabled:false},legend:{show:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:platData.map(([k])=>k),labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'x',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>v.toFixed(2)+'x'},theme:'dark'}
      });
      ddCharts['dd-chart-roas-bar'].render();
      renderDDROASSpend();
     }

      function renderDDROASSpend() {
      const isFY25m = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const _now2 = new Date();
      const _currentKey2 = `${_now2.getFullYear()}-${String(_now2.getMonth()+1).padStart(2,'0')}`;
      const isCurrentMonth = activeMonth === _currentKey2; 
      const src = isFY25m ? fy25Data : rawData;
      const daily = {};
      let chartTitle = 'ROAS vs Spend · last 30 days';

      if (isCurrentMonth) {
        const now = new Date();
        const last30 = new Date(now - 30*24*60*60*1000);
        src.filter(r => { const d=parseLocalDate(r.Date); return d>=last30&&d<=now; }).forEach(r => {
          const ds=r.Date.slice(0,10);
          if(!daily[ds])daily[ds]={sales:0,spends:0};
          daily[ds].sales+=Number(r.Sales)||0;
          daily[ds].spends+=Number(r.Spends)||0;
        });
      } else if (activeMonth !== 'All') {
        const [selY, selM] = activeMonth.split('-').map(Number);
        chartTitle = `ROAS vs Spend · ${monthLabel(activeMonth)}`;
        src.filter(r => {
          const d=parseLocalDate(r.Date);
          return d.getFullYear()===selY && d.getMonth()+1===selM;
        }).forEach(r => {
          const ds=r.Date.slice(0,10);
          if(!daily[ds])daily[ds]={sales:0,spends:0};
          daily[ds].sales+=Number(r.Sales)||0;
          daily[ds].spends+=Number(r.Spends)||0;
        });
      } else {
        const now = new Date();
        const last30 = new Date(now - 30*24*60*60*1000);
        [...rawData,...fy25Data].filter(r=>{const d=parseLocalDate(r.Date);return d>=last30&&d<=now;}).forEach(r=>{
          const ds=r.Date.slice(0,10);
          if(!daily[ds])daily[ds]={sales:0,spends:0};
          daily[ds].sales+=Number(r.Sales)||0;
          daily[ds].spends+=Number(r.Spends)||0;
        });
      }

      const titleEl = document.getElementById('dd-roas-spend-title');
      if (titleEl) titleEl.textContent = chartTitle;
      const dates=Object.keys(daily).sort();
      const roasData=dates.map(d=>daily[d].spends>0?+(daily[d].sales/daily[d].spends).toFixed(2):0);
      const spendData=dates.map(d=>+(daily[d].spends/1e5).toFixed(2));
      if(ddCharts['dd-chart-roas-spend'])ddCharts['dd-chart-roas-spend'].destroy();
      ddCharts['dd-chart-roas-spend']=new ApexCharts(document.getElementById('dd-chart-roas-spend'),{
        series:[{name:'ROAS',type:'line',data:roasData},{name:'Spend (L)',type:'bar',data:spendData}],
        chart:{height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#22C55E','#8B5CF6'],
        stroke:{width:[2.5,0],curve:'smooth'},
        plotOptions:{bar:{columnWidth:'70%',borderRadius:2}},
        fill:{opacity:[1,0.35]},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:dates.map(d=>d.slice(5)),labels:{style:{colors:'#555',fontSize:'9px'},rotate:-45},axisBorder:{show:false},axisTicks:{show:false},tickAmount:8},
        yaxis:[{labels:{formatter:v=>v.toFixed(1)+'x',style:{colors:'#22C55E',fontSize:'10px'}}},{opposite:true,labels:{formatter:v=>v.toFixed(2)+'L',style:{colors:'#8B5CF6',fontSize:'10px'}}}],
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px',fontFamily:'Geist Mono, monospace'},
        tooltip:{theme:'dark'}
      });
      ddCharts['dd-chart-roas-spend'].render();
    }

    function renderDDROASTrend() {
      const period=document.getElementById('dd-roas-trend-period')?.value||'monthly';
      const pts=getDDPeriodPoints(period);
      if(ddCharts['dd-chart-roas-trend'])ddCharts['dd-chart-roas-trend'].destroy();
      ddCharts['dd-chart-roas-trend']=new ApexCharts(document.getElementById('dd-chart-roas-trend'),{
        series:[{name:'Blended ROAS',data:pts.map(p=>+p.roas.toFixed(2))}],
        chart:{type:'area',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#22C55E'],stroke:{width:2.5,curve:'smooth'},
        fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',opacityFrom:0.35,opacityTo:0.02}},
        markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:pts.map(p=>p.l),labels:{style:{colors:'#555',fontSize:'10px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'x',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>v.toFixed(2)+'x'},theme:'dark'}
      });
      ddCharts['dd-chart-roas-trend'].render();
    }
      function renderDDROASPlatTrend() {
      const plat=document.getElementById('dd-roas-plat-sel')?.value||'Blinkit';
      const MONTHS_DEF=[{y:2025,m:4,l:'Apr 25'},{y:2025,m:5,l:'May 25'},{y:2025,m:6,l:'Jun 25'},{y:2025,m:7,l:'Jul 25'},{y:2025,m:8,l:'Aug 25'},{y:2025,m:9,l:'Sep 25'},{y:2025,m:10,l:'Oct 25'},{y:2025,m:11,l:'Nov 25'},{y:2025,m:12,l:'Dec 25'},{y:2026,m:1,l:'Jan 26'},{y:2026,m:2,l:'Feb 26'},{y:2026,m:3,l:'Mar 26'},{y:2026,m:4,l:'Apr 26'},{y:2026,m:5,l:'May 26'},{y:2026,m:6,l:'Jun 26'},{y:2026,m:7,l:'Jul 26'},{y:2026,m:8,l:'Aug 26'}];
      const data=MONTHS_DEF.map(({y,m,l})=>{
        let rows=getDDMonthData(y,m,plat);
        // For May 25 Instamart: only use days where spends > 0 (partial fill issue)
        if(plat==='Instamart' && y===2025 && m===5) {
          rows=rows.filter(r=>(Number(r.Spends)||0)>0);
        }
        const s=rows.reduce((a,r)=>a+(Number(r.Sales)||0),0);
        const sp=rows.reduce((a,r)=>a+(Number(r.Spends)||0),0);
        return{l,roas:sp>0?+(s/sp).toFixed(2):0};
      }).filter(p=>p.roas>0);
    
      const color=PLAT_COLORS[plat]||'#EAB308';
      if(ddCharts['dd-chart-roas-plat-trend'])ddCharts['dd-chart-roas-plat-trend'].destroy();
      ddCharts['dd-chart-roas-plat-trend']=new ApexCharts(document.getElementById('dd-chart-roas-plat-trend'),{
        series:[{name:plat+' ROAS',data:data.map(p=>p.roas)}],
        chart:{type:'area',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[color],stroke:{width:2.5,curve:'smooth'},
        fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',opacityFrom:0.3,opacityTo:0.02}},
        markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:data.map(p=>p.l),labels:{style:{colors:'#555',fontSize:'10px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'x',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>v.toFixed(2)+'x'},theme:'dark'}
      });
      ddCharts['dd-chart-roas-plat-trend'].render();
    }

    function renderDDROASYoYKPIs() {
      const PLATS=['Blinkit','Zepto','Instamart'];
      const COLORS=['linear-gradient(90deg,#EAB308,#F97316)','linear-gradient(90deg,#a78bfa,#8B5CF6)','linear-gradient(90deg,#22C55E,#16a34a)','linear-gradient(90deg,#3B82F6,#0ea5e9)'];
      const now=new Date();const cm=now.getMonth()+1;
      let html='';
      PLATS.forEach((p,i)=>{
        const r26=getDDMonthData(2026,cm,p);const r25=getDDMonthData(2025,cm,p);
        const s26=r26.reduce((a,r)=>a+(Number(r.Sales)||0),0);const sp26=r26.reduce((a,r)=>a+(Number(r.Spends)||0),0);
        const s25=r25.reduce((a,r)=>a+(Number(r.Sales)||0),0);const sp25=r25.reduce((a,r)=>a+(Number(r.Spends)||0),0);
        const roas26=sp26>0?s26/sp26:0;const roas25=sp25>0?s25/sp25:0;
        const delta=roas25>0?(roas26-roas25)/roas25*100:0;
        html+=ddKpiHtml(p+' ROAS YoY',roas26.toFixed(2)+'x',delta,'FY25: '+roas25.toFixed(2)+'x',COLORS[i]);
      });
      document.getElementById('dd-roas-yoy-kpis').innerHTML=html;
    }

    function renderDDROASYoYChart() {
      const PLATS=['Blinkit','Zepto','Instamart'];
      const now=new Date();const months=[];
      for(let m=4;m<=now.getMonth()+1;m++)months.push(m);
      const labels=months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      const fy26=PLATS.map(p=>({name:'FY26 '+p,data:months.map(m=>{const rows=getDDMonthData(2026,m,p);const s=rows.reduce((a,r)=>a+(Number(r.Sales)||0),0);const sp=rows.reduce((a,r)=>a+(Number(r.Spends)||0),0);return sp>0?+(s/sp).toFixed(2):0;})}));
      const fy25=PLATS.map(p=>({name:'FY25 '+p,data:months.map(m=>{const rows=getDDMonthData(2025,m,p);const s=rows.reduce((a,r)=>a+(Number(r.Sales)||0),0);const sp=rows.reduce((a,r)=>a+(Number(r.Spends)||0),0);return sp>0?+(s/sp).toFixed(2):0;})}));
      if(ddCharts['dd-chart-roas-yoy'])ddCharts['dd-chart-roas-yoy'].destroy();
      ddCharts['dd-chart-roas-yoy']=new ApexCharts(document.getElementById('dd-chart-roas-yoy'),{
        series:[...fy26,...fy25],chart:{type:'bar',height:260,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...PLATS.map(p=>PLAT_COLORS[p]),...PLATS.map(p=>PLAT_COLORS[p]+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'70%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'x',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px',fontFamily:'Geist Mono, monospace'},
        tooltip:{y:{formatter:v=>v.toFixed(2)+'x'},theme:'dark'}
      });
      ddCharts['dd-chart-roas-yoy'].render();
    }

    function renderDDQtyCurrent() {
      const data=getFilteredData();
      const agg={};let totalUnits=0;let totalSales=0;
      data.forEach(r=>{const p=r.Platform;if(!agg[p])agg[p]={units:0,sales:0};agg[p].units+=Number(r.Units)||0;agg[p].sales+=Number(r.Sales)||0;totalUnits+=Number(r.Units)||0;totalSales+=Number(r.Sales)||0;});
      const blendedASP=totalUnits>0?totalSales/totalUnits:0;
      const best=Object.entries(agg).sort((a,b)=>b[1].units-a[1].units)[0];
      const lowestASP=Object.entries(agg).filter(([,v])=>v.units>0).sort((a,b)=>(a[1].sales/a[1].units)-(b[1].sales/b[1].units))[0];
      document.getElementById('dd-qty-kpis').innerHTML=
        ddKpiHtml('Total Units',fmtDDU(totalUnits),0,'MTD','linear-gradient(90deg,#EAB308,#F97316)')+
        ddKpiHtml('Blended ASP','₹'+blendedASP.toFixed(0),0,'all platforms','linear-gradient(90deg,#a78bfa,#8B5CF6)')+
        ddKpiHtml('Top Channel',best?best[0]:'—',0,best?fmtDDU(best[1].units)+' units':'','linear-gradient(90deg,#22C55E,#16a34a)')+
        ddKpiHtml('Lowest ASP',lowestASP?'₹'+(lowestASP[1].sales/lowestASP[1].units).toFixed(0)+' '+lowestASP[0]:'—',0,'watch mix shift','linear-gradient(90deg,#3B82F6,#0ea5e9)');
      const platData=Object.entries(agg).filter(([,v])=>v.units>0).sort((a,b)=>b[1].units-a[1].units);
      if(ddCharts['dd-chart-qty-mix'])ddCharts['dd-chart-qty-mix'].destroy();
      ddCharts['dd-chart-qty-mix']=new ApexCharts(document.getElementById('dd-chart-qty-mix'),{
        series:platData.map(([,v])=>v.units),labels:platData.map(([k])=>k),
        chart:{type:'donut',height:380,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors:platData.map(([k])=>PLAT_COLORS[k]||'#888'),theme:{mode:'dark'},
        legend:{position:'bottom',fontSize:'11px',fontFamily:'Geist Mono, monospace',itemMargin:{horizontal:8,vertical:4}},
        dataLabels:{enabled:false},plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{show:true,fontSize:'11px',color:'#6b7280',fontFamily:'Geist Mono, monospace'},value:{show:true,fontSize:'18px',fontWeight:600,color:'#f0f0f0',fontFamily:'Geist Mono, monospace',formatter:v=>fmtDDU(Number(v))},total:{show:true,label:'Total',formatter:()=>fmtDDU(totalUnits),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-mix'].render();
      if(ddCharts['dd-chart-asp-bar'])ddCharts['dd-chart-asp-bar'].destroy();
      ddCharts['dd-chart-asp-bar']=new ApexCharts(document.getElementById('dd-chart-asp-bar'),{
        series:[{name:'ASP',data:platData.map(([,v])=>v.units>0?+(v.sales/v.units).toFixed(0):0)}],
        chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:platData.map(([k])=>PLAT_COLORS[k]||'#888'),
        plotOptions:{bar:{borderRadius:4,columnWidth:'50%',distributed:true}},dataLabels:{enabled:false},legend:{show:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:platData.map(([k])=>k),labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>'₹'+v,style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>'₹'+v},theme:'dark'}
      });
      ddCharts['dd-chart-asp-bar'].render();
    }

    function renderDDQtyTrend() {
      const period=document.getElementById('dd-qty-trend-period')?.value||'monthly';
      const pts=getDDPeriodPoints(period);
      if(ddCharts['dd-chart-qty-trend'])ddCharts['dd-chart-qty-trend'].destroy();
      ddCharts['dd-chart-qty-trend']=new ApexCharts(document.getElementById('dd-chart-qty-trend'),{
        series:[{name:'Units',data:pts.map(p=>+(p.units/1e5).toFixed(2))}],
        chart:{type:'area',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:['#3B82F6'],stroke:{width:2.5,curve:'smooth'},
        fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',opacityFrom:0.35,opacityTo:0.02}},
        markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:pts.map(p=>p.l),labels:{style:{colors:'#555',fontSize:'10px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'L',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>fmtDDU(v*1e5)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-trend'].render();
    }

    function renderDDASPTrend() {
      const plat=document.getElementById('dd-asp-plat-sel')?.value||'Blinkit';
      const MONTHS_DEF=[{y:2025,m:4,l:'Apr 25'},{y:2025,m:5,l:'May 25'},{y:2025,m:6,l:'Jun 25'},{y:2025,m:7,l:'Jul 25'},{y:2025,m:8,l:'Aug 25'},{y:2025,m:9,l:'Sep 25'},{y:2025,m:10,l:'Oct 25'},{y:2025,m:11,l:'Nov 25'},{y:2025,m:12,l:'Dec 25'},{y:2026,m:1,l:'Jan 26'},{y:2026,m:2,l:'Feb 26'},{y:2026,m:3,l:'Mar 26'},{y:2026,m:4,l:'Apr 26'},{y:2026,m:5,l:'May 26'},{y:2026,m:6,l:'Jun 26'},{y:2026,m:7,l:'Jul 26'},{y:2026,m:8,l:'Aug 26'}];
      const data=MONTHS_DEF.map(({y,m,l})=>{const rows=getDDMonthData(y,m,plat);const s=rows.reduce((a,r)=>a+(Number(r.Sales)||0),0);const u=rows.reduce((a,r)=>a+(Number(r.Units)||0),0);return{l,asp:u>0?+(s/u).toFixed(0):0};}).filter(p=>p.asp>0);
      const color=PLAT_COLORS[plat]||'#EAB308';
      if(ddCharts['dd-chart-asp-trend'])ddCharts['dd-chart-asp-trend'].destroy();
      ddCharts['dd-chart-asp-trend']=new ApexCharts(document.getElementById('dd-chart-asp-trend'),{
        series:[{name:plat+' ASP',data:data.map(p=>p.asp)}],
        chart:{type:'line',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[color],stroke:{width:2.5,curve:'smooth'},
        markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:data.map(p=>p.l),labels:{style:{colors:'#555',fontSize:'10px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>'₹'+v,style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>'₹'+v},theme:'dark'}
      });
      ddCharts['dd-chart-asp-trend'].render();
    }
     function renderDDQtyCatMix() {
      const CATS = ['Ragi Chips','Dipsters','Puffs','Others'];
      const CAT_COLORS = ['#EAB308','#8B5CF6','#3B82F6','#6B7280'];
      const isFY25m = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const src = isFY25m ? fy25SKUData : skuData;
      const [selY, selM] = activeMonth !== 'All' ? activeMonth.split('-').map(Number) : [null, null];
      if (src.length === 0) { document.getElementById('dd-chart-qty-cat-mix').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);font-size:12px">Loading...</div>'; return; }
      const rows = src.filter(r => selM ? Number(r.Month) === selM : true);
      const totals = CATS.map(cat => rows.filter(r => String(r.Category) === cat).reduce((a,r) => a + (Number(r.MTDUnits)||Number(r.Quantity)||0), 0));
      const total = totals.reduce((a,b) => a+b, 0);
      if(ddCharts['dd-chart-qty-cat-mix']) ddCharts['dd-chart-qty-cat-mix'].destroy();
      const _catMixEl = document.getElementById('dd-chart-qty-cat-mix');
      if (!_catMixEl) return;
      ddCharts['dd-chart-qty-cat-mix'] = new ApexCharts(_catMixEl, {
        series: totals, labels: CATS,
        chart:{type:'donut',height:250,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors: CAT_COLORS, theme:{mode:'dark'},
        legend:{position:'bottom',fontSize:'10px',fontFamily:'Geist Mono, monospace'},
        dataLabels:{enabled:false},
        plotOptions:{pie:{donut:{size:'62%',labels:{show:true,name:{show:true,fontSize:'10px',color:'#6b7280',fontFamily:'Geist Mono, monospace'},value:{show:true,fontSize:'16px',fontWeight:600,color:'#f0f0f0',fontFamily:'Geist Mono, monospace',formatter:v=>fmtDDU(Number(v))},total:{show:true,label:'Total',formatter:()=>fmtDDU(total),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-cat-mix'].render();
    }
     function renderDDQtyTopSKUs() {
      const platFilter = document.getElementById('dd-qty-sku-plat')?.value || 'All';
      const isFY25m = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const src = isFY25m ? fy25SKUData : skuData;
      const [selY, selM] = activeMonth !== 'All' ? activeMonth.split('-').map(Number) : [null, null];
      if (src.length === 0) { document.getElementById('dd-qty-top-skus').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:12px">Loading SKU data...</div>'; return; }
      let rows = src.filter(r => selM ? Number(r.Month) === selM : true);
      if (platFilter !== 'All') rows = rows.filter(r => String(r.Platform) === platFilter);
      const skuMap = {};
      rows.forEach(r => {
        const k = String(r.SKU);
        if (!skuMap[k]) skuMap[k] = {sku:k, cat:r.Category, units:0, gmv:0};
        skuMap[k].units += Number(r.MTDUnits)||Number(r.Quantity)||0;
        skuMap[k].gmv   += Number(r.MTDRevenue)||Number(r.GMV)||0;
      });
      const top = Object.values(skuMap).sort((a,b) => b.units - a.units).slice(0, 8);
      const totalU = top.reduce((a,r) => a+r.units, 0);
      let html = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <th style="text-align:left;padding:6px 8px;color:#555;font-weight:500;font-size:11px;">#</th>
          <th style="text-align:left;padding:6px 8px;color:#555;font-weight:500;font-size:11px;">SKU</th>
          <th style="text-align:left;padding:6px 8px;color:#555;font-weight:500;font-size:11px;">Category</th>
          <th style="text-align:right;padding:6px 8px;color:#555;font-weight:500;font-size:11px;">Units</th>
          <th style="text-align:right;padding:6px 8px;color:#555;font-weight:500;font-size:11px;">% of total</th>
          <th style="text-align:right;padding:6px 8px;color:#555;font-weight:500;font-size:11px;">ASP</th>
        </tr></thead><tbody>`;
      top.forEach((r,i) => {
        const pct = totalU > 0 ? (r.units/totalU*100).toFixed(1) : '0.0';
        const asp = r.units > 0 ? Math.round(r.gmv/r.units) : 0;
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
          <td style="padding:7px 8px;color:#555;font-size:11px;">${i+1}</td>
          <td style="padding:7px 8px;color:#e2e8f0;font-size:12px;">${r.sku}</td>
          <td style="padding:7px 8px;color:#9ca3af;font-size:11px;">${r.cat||'—'}</td>
          <td style="padding:7px 8px;text-align:right;color:#e2e8f0;">${fmtDDU(r.units)}</td>
          <td style="padding:7px 8px;text-align:right;color:#9ca3af;">${pct}%</td>
          <td style="padding:7px 8px;text-align:right;color:#9ca3af;">₹${asp}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      document.getElementById('dd-qty-top-skus').innerHTML = html;
    }

    function renderDDQtyCatTrend() {
      const CATS = ['Ragi Chips','Dipsters','Puffs','Others'];
      const CAT_COLORS = ['#EAB308','#8B5CF6','#3B82F6','#6B7280'];
      const MONTHS = [{y:2025,m:4},{y:2025,m:5},{y:2025,m:6},{y:2025,m:7},{y:2025,m:8},{y:2025,m:9},{y:2025,m:10},{y:2025,m:11},{y:2025,m:12},{y:2026,m:1},{y:2026,m:2},{y:2026,m:3},{y:2026,m:4},{y:2026,m:5},{y:2026,m:6},{y:2026,m:7}];
      const MLBLs = MONTHS.map(({y,m})=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]+(m===4?' '+String(y).slice(2):''));
      const series = CATS.map((cat,ci) => ({
        name: cat,
        data: MONTHS.map(({y,m}) => {
          const src = FY25_MONTHS.has(`${y}-${String(m).padStart(2,'0')}`) ? fy25SKUData : skuData;
          return src.filter(r => Number(r.Month)===m && String(r.Category)===cat).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
        })
      }));
      if(ddCharts['dd-chart-qty-cat-trend']) ddCharts['dd-chart-qty-cat-trend'].destroy();
      ddCharts['dd-chart-qty-cat-trend'] = new ApexCharts(document.getElementById('dd-chart-qty-cat-trend'), {
        series, chart:{type:'line',height:200,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'}, colors:CAT_COLORS, stroke:{width:2,curve:'smooth'}, markers:{size:3},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4}, dataLabels:{enabled:false},
        xaxis:{categories:MLBLs,labels:{style:{colors:'#555',fontSize:'9px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{min:0,max:600000,tickAmount:6,forceNiceScale:false,labels:{formatter:v=>v===0?'0':(v/100000).toFixed(0)+'L',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-cat-trend'].render();
    }

    function renderDDQtyPlatShare() {
      const PLATS = ['Blinkit','Instamart','Zepto','First Club'];
      const PLAT_C = ['#EAB308','#3B82F6','#8B5CF6','#06B6D4'];
      const MONTHS = [{y:2025,m:4},{y:2025,m:7},{y:2025,m:10},{y:2026,m:1},{y:2026,m:4},{y:2026,m:7}];
      const MLBLs = MONTHS.map(({y,m})=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]+' '+String(y).slice(2));
      const series = PLATS.map((plat,pi) => ({
        name: plat,
        data: MONTHS.map(({y,m}) => {
          const src = FY25_MONTHS.has(`${y}-${String(m).padStart(2,'0')}`) ? fy25SKUData : skuData;
          const total = src.filter(r => Number(r.Month)===m).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          const platU = src.filter(r => Number(r.Month)===m && String(r.Platform)===plat).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          return total > 0 ? Math.round(platU/total*100) : 0;
        })
      }));
      if(ddCharts['dd-chart-qty-plat-share']) ddCharts['dd-chart-qty-plat-share'].destroy();
      ddCharts['dd-chart-qty-plat-share'] = new ApexCharts(document.getElementById('dd-chart-qty-plat-share'), {
        series, chart:{type:'bar',height:220,stacked:true,stackType:'100%',toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'}, colors:PLAT_C, dataLabels:{enabled:true,formatter:(v)=>v>8?Math.round(v)+'%':'',style:{fontSize:'9px',colors:['#000']}},
        plotOptions:{bar:{borderRadius:0,columnWidth:'60%'}},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:MLBLs,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v+'%',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>Math.round(v)+'%'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-plat-share'].render();
    }
    function renderDDQtyCatDonut() {
      const selCat = document.getElementById('dd-qty-sku-cat-sel')?.value || 'All';
      const isFY25m = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const src = isFY25m ? fy25SKUData : skuData;
      const [selY, selM] = activeMonth !== 'All' ? activeMonth.split('-').map(Number) : [null, null];
      if (src.length === 0) { document.getElementById('dd-chart-qty-cat-donut').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);font-size:12px">Loading SKU data...</div>'; return; }
      const allRows = src.filter(r => selM ? Number(r.Month) === selM : true);
      if (allRows.length === 0) { document.getElementById('dd-chart-qty-cat-donut').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);font-size:12px">No data for selected month</div>'; return; }

      let labels, values, salesArr, centerLabel, DONUT_COLORS;

      if (selCat === 'All') {
        const CATS = ['Ragi Chips','Dipsters','Puffs','Others'];
        const catMap = {}; CATS.forEach(c => { catMap[c] = {units:0,sales:0}; });
        allRows.forEach(r => {
          const rawCat = String(r.Category||'').trim();
          const c = CATS.includes(rawCat) ? rawCat : 'Others';
          catMap[c].units += Number(r.MTDUnits)||Number(r.Quantity)||0;
          catMap[c].sales += Number(r.MTDRevenue)||Number(r.GMV)||0;
        });
        const activeCats = CATS.filter(c => catMap[c].units > 0);
        if (activeCats.length === 0) { document.getElementById('dd-chart-qty-cat-donut').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);font-size:12px">No unit data found</div>'; return; }
        labels = activeCats;
        values = activeCats.map(c => catMap[c].units);
        salesArr = activeCats.map(c => catMap[c].sales);
        DONUT_COLORS = activeCats.map(c => ({'Ragi Chips':'#EAB308','Dipsters':'#8B5CF6','Puffs':'#3B82F6','Others':'#6B7280'}[c]));
        centerLabel = 'All Categories';
      } else {
        const rows = allRows.filter(r => String(r.Category||'').trim() === selCat);
        const skuMap = {};
        rows.forEach(r => {
          const k = String(r.SKU);
          if (!skuMap[k]) skuMap[k] = {units:0,sales:0};
          skuMap[k].units += Number(r.MTDUnits)||Number(r.Quantity)||0;
          skuMap[k].sales += Number(r.MTDRevenue)||Number(r.GMV)||0;
        });
        const sorted = Object.entries(skuMap).filter(([,v])=>v.units>0).sort((a,b)=>b[1].units-a[1].units);
        const top = sorted.slice(0,8);
        const othersUnits = sorted.slice(8).reduce((a,[,v])=>a+v.units,0);
        const othersSales = sorted.slice(8).reduce((a,[,v])=>a+v.sales,0);
        if (othersUnits > 0) top.push(['Others',{units:othersUnits,sales:othersSales}]);
        if (top.length === 0) { document.getElementById('dd-chart-qty-cat-donut').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);font-size:12px">No SKUs found for '+selCat+'</div>'; return; }
        labels = top.map(([k])=>k);
        values = top.map(([,v])=>v.units);
        salesArr = top.map(([,v])=>v.sales);
        DONUT_COLORS = ['#EAB308','#F97316','#22C55E','#3B82F6','#A855F7','#06B6D4','#EC4899','#6B7280','#ef4444'];
        centerLabel = selCat;
      }

      const total = values.reduce((a,b)=>a+b,0);
      if(ddCharts['dd-chart-qty-cat-donut']) ddCharts['dd-chart-qty-cat-donut'].destroy();
      const _catEl = document.getElementById('dd-chart-qty-cat-donut');
      if (!_catEl) return;
      ddCharts['dd-chart-qty-cat-donut'] = new ApexCharts(_catEl, {
        series: values, labels: labels,
        chart:{type:'donut',height:420,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors: DONUT_COLORS.slice(0,labels.length), theme:{mode:'dark'},
        legend:{position:'right',fontSize:'10px',fontFamily:'Geist Mono, monospace',formatter:(val)=>val.length>22?val.substring(0,22)+'…':val,width:180},
        dataLabels:{enabled:false},
        plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{show:true,fontSize:'16px',color:'#6b7280',fontFamily:'Geist Mono, monospace'},value:{show:true,fontSize:'28px',fontWeight:600,color:'#f0f0f0',fontFamily:'Geist Mono, monospace',formatter:v=>fmtDDU(Number(v))},total:{show:true,label:centerLabel,fontSize:'16px',formatter:()=>fmtDDU(total),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
      tooltip:{theme:'dark',custom:function({seriesIndex}){
          const pct = total>0?(values[seriesIndex]/total*100).toFixed(1):'0.0';
          return `<div style="padding:8px 12px;background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:6px">
            <div style="color:#f1f5f9;font-weight:600;font-size:11px;max-width:200px">${labels[seriesIndex]}</div>
            <div style="color:#EAB308;font-family:'Geist Mono',monospace;font-size:12px;margin-top:4px">${fmtDDU(values[seriesIndex])} units</div>
            <div style="color:#9ca3b3;font-family:'Geist Mono',monospace;font-size:11px;margin-top:2px">Sales: ${fmtDD(salesArr[seriesIndex])}</div>
            <div style="color:#6b7280;font-family:'Geist Mono',monospace;font-size:10px;margin-top:2px">${pct}% of ${centerLabel}</div>
          </div>`;
        }}
      });
      ddCharts['dd-chart-qty-cat-donut'].render();
    }
    function renderDDQtyCatTrend() {
      const CATS = ['Ragi Chips','Dipsters','Puffs','Others'];
      const CAT_COLORS = ['#EAB308','#8B5CF6','#3B82F6','#6B7280'];
      const MONTHS = [{y:2025,m:4},{y:2025,m:5},{y:2025,m:6},{y:2025,m:7},{y:2025,m:8},{y:2025,m:9},{y:2025,m:10},{y:2025,m:11},{y:2025,m:12},{y:2026,m:1},{y:2026,m:2},{y:2026,m:3},{y:2026,m:4},{y:2026,m:5},{y:2026,m:6},{y:2026,m:7}];
      const MLBLs = MONTHS.map(({y,m})=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]+(m===4?' '+String(y).slice(2):''));
      const series = CATS.map((cat)=>({
        name: cat,
        data: MONTHS.map(({y,m}) => {
          const src = FY25_MONTHS.has(`${y}-${String(m).padStart(2,'0')}`) ? fy25SKUData : skuData;
          return src.filter(r => Number(r.Month)===m && String(r.Category)===cat).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
        })
      }));
      if(ddCharts['dd-chart-qty-cat-trend']) ddCharts['dd-chart-qty-cat-trend'].destroy();
      ddCharts['dd-chart-qty-cat-trend'] = new ApexCharts(document.getElementById('dd-chart-qty-cat-trend'), {
        series, chart:{type:'line',height:200,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'}, colors:CAT_COLORS, stroke:{width:2,curve:'smooth'}, markers:{size:3},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4}, dataLabels:{enabled:false},
        xaxis:{categories:MLBLs,labels:{style:{colors:'#555',fontSize:'9px'},rotate:-30},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{min:0,max:600000,tickAmount:6,forceNiceScale:false,labels:{formatter:v=>v===0?'0':(v/100000).toFixed(0)+'L',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-cat-trend'].render();
    }

    function renderDDQtyPlatShare() {
      const PLATS = ['Blinkit','Instamart','Zepto','First Club'];
      const PLAT_C = ['#EAB308','#3B82F6','#8B5CF6','#06B6D4'];
      const MONTHS = [{y:2025,m:4},{y:2025,m:7},{y:2025,m:10},{y:2026,m:1},{y:2026,m:4},{y:2026,m:7}];
      const MLBLs = MONTHS.map(({y,m})=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]+' '+String(y).slice(2));
      const series = PLATS.map((plat)=>({
        name: plat,
        data: MONTHS.map(({y,m}) => {
          const src = FY25_MONTHS.has(`${y}-${String(m).padStart(2,'0')}`) ? fy25SKUData : skuData;
          const total = src.filter(r => Number(r.Month)===m).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          const platU = src.filter(r => Number(r.Month)===m && String(r.Platform)===plat).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          return total > 0 ? Math.round(platU/total*100) : 0;
        })
      }));
      if(ddCharts['dd-chart-qty-plat-share']) ddCharts['dd-chart-qty-plat-share'].destroy();
      ddCharts['dd-chart-qty-plat-share'] = new ApexCharts(document.getElementById('dd-chart-qty-plat-share'), {
        series, chart:{type:'bar',height:220,stacked:true,stackType:'100%',toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'}, colors:PLAT_C, dataLabels:{enabled:true,formatter:(v)=>v>8?Math.round(v)+'%':'',style:{fontSize:'9px',colors:['#000']}},
        plotOptions:{bar:{borderRadius:0,columnWidth:'60%'}},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:MLBLs,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v+'%',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>Math.round(v)+'%'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-plat-share'].render();
    }

    function renderDDQtyConcentration() {
      const MONTHS = [{y:2025,m:4},{y:2025,m:7},{y:2025,m:10},{y:2026,m:1},{y:2026,m:4},{y:2026,m:7}];
      const MLBLs = MONTHS.map(({y,m})=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]+' '+String(y).slice(2));
      const data = MONTHS.map(({y,m}) => {
        const src = FY25_MONTHS.has(`${y}-${String(m).padStart(2,'0')}`) ? fy25SKUData : skuData;
        const rows = src.filter(r => Number(r.Month)===m);
        const skuMap = {};
        rows.forEach(r => { const k=String(r.SKU); skuMap[k]=(skuMap[k]||0)+(Number(r.MTDUnits)||Number(r.Quantity)||0); });
        const sorted = Object.values(skuMap).sort((a,b)=>b-a);
        const top3 = sorted.slice(0,3).reduce((a,b)=>a+b,0);
        const total = sorted.reduce((a,b)=>a+b,0);
        return total > 0 ? Math.round(top3/total*100) : 0;
      });
      if(ddCharts['dd-chart-qty-concentration']) ddCharts['dd-chart-qty-concentration'].destroy();
      ddCharts['dd-chart-qty-concentration'] = new ApexCharts(document.getElementById('dd-chart-qty-concentration'), {
        series:[{name:'Top 3 SKU share',data}],
        chart:{type:'bar',height:180,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},
        colors: data.map(v => v > 55 ? '#ef4444' : v > 50 ? '#f97316' : '#EAB308'),
        plotOptions:{bar:{borderRadius:4,columnWidth:'55%',distributed:true}},dataLabels:{enabled:true,formatter:v=>v+'%',style:{fontSize:'11px',colors:['#e2e8f0']}},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},legend:{show:false},
        xaxis:{categories:MLBLs,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v+'%',style:{colors:'#9ca3b3',fontSize:'10px'}},max:80},
        annotations:{yaxis:[{y:55,borderColor:'#ef4444',strokeDashArray:4,label:{text:'Risk threshold',style:{color:'#ef4444',fontSize:'10px',background:'transparent'}}},{y:50,borderColor:'#f97316',strokeDashArray:4}]},
        tooltip:{y:{formatter:v=>v+'% of units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-concentration'].render();
    }

    function renderDDQtyCatYoY() {
      const CATS = ['Ragi Chips','Dipsters','Puffs','Others'];
      const CAT_COLORS = ['#EAB308','#8B5CF6','#3B82F6','#6B7280'];
      const now = new Date(); const months = [];
      for(let m=4;m<=now.getMonth()+1;m++) months.push(m);
      const labels = months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      const fy26 = CATS.map((cat)=>({
        name:'FY26 '+cat,
        data: months.map(m => skuData.filter(r=>Number(r.Month)===m && String(r.Category)===cat).reduce((a,r)=>a+(Number(r.MTDUnits)||0),0))
      }));
      const fy25 = CATS.map((cat)=>({
        name:'FY25 '+cat,
        data: months.map(m => fy25SKUData.filter(r=>Number(r.Month)===m && String(r.Category)===cat).reduce((a,r)=>a+(Number(r.Quantity)||0),0))
      }));
      if(ddCharts['dd-chart-qty-cat-yoy'])ddCharts['dd-chart-qty-cat-yoy'].destroy();
      ddCharts['dd-chart-qty-cat-yoy'] = new ApexCharts(document.getElementById('dd-chart-qty-cat-yoy'),{
        series:[...fy26,...fy25],chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...CAT_COLORS,...CAT_COLORS.map(c=>c+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'75%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{min:0,max:600000,tickAmount:6,labels:{formatter:v=>(v/100000).toFixed(0)+'L',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-cat-yoy'].render();
    }

    function renderDDQtyMixYoY() {
      const PLATS = ['Blinkit','Instamart','Zepto','First Club'];
      const PLAT_C = ['#EAB308','#3B82F6','#8B5CF6','#06B6D4'];
      const now = new Date(); const months = [];
      for(let m=4;m<=now.getMonth()+1;m++) months.push(m);
      const labels = months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      const mkSeries = (srcData, fy) => PLATS.map(plat=>({
        name: fy+' '+plat,
        data: months.map(m => {
          const rows = srcData.filter(r=>Number(r.Month)===m);
          const total = rows.reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          const platU = rows.filter(r=>String(r.Platform)===plat).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          return total>0 ? Math.round(platU/total*100) : 0;
        })
      }));
      if(ddCharts['dd-chart-qty-mix-yoy'])ddCharts['dd-chart-qty-mix-yoy'].destroy();
      ddCharts['dd-chart-qty-mix-yoy'] = new ApexCharts(document.getElementById('dd-chart-qty-mix-yoy'),{
        series:[...mkSeries(skuData,'FY26'),...mkSeries(fy25SKUData,'FY25')],
        chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...PLAT_C,...PLAT_C.map(c=>c+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'75%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v+'%',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>v+'% of units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-mix-yoy'].render();
    }
    function renderDDQtyYoYKPIs() {
      const PLATS=['Blinkit','Zepto','Instamart'];
      const COLORS=['linear-gradient(90deg,#EAB308,#F97316)','linear-gradient(90deg,#a78bfa,#8B5CF6)','linear-gradient(90deg,#22C55E,#16a34a)','linear-gradient(90deg,#3B82F6,#0ea5e9)'];
      const now=new Date(); const cm=now.getMonth()+1;
      let html='';
      PLATS.forEach((p,i)=>{
        const r26=getDDMonthData(2026,cm,p); const r25=getDDMonthData(2025,cm,p);
        const u26=r26.reduce((a,r)=>a+(Number(r.Units)||0),0);
        const u25=r25.reduce((a,r)=>a+(Number(r.Units)||0),0);
        const pct=u25>0?(u26-u25)/u25*100:0;
        html+=ddKpiHtml(p+' Units YoY',pct.toFixed(1)+'%',pct,'FY26: '+fmtDDU(u26)+' · FY25: '+fmtDDU(u25),COLORS[i]);
      });
      document.getElementById('dd-qty-yoy-kpis').innerHTML=html;
    }

    function renderDDQtyYoYChart() {
      const PLATS=['Blinkit','Zepto','Instamart','Amazon'];
      const now=new Date(); const months=[];
      for(let m=4;m<=now.getMonth()+1;m++) months.push(m);
      const labels=months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      const fy26=PLATS.map(p=>({name:'FY26 '+p,data:months.map(m=>{const rows=getDDMonthData(2026,m,p);return rows.reduce((a,r)=>a+(Number(r.Units)||0),0);})}));
      const fy25=PLATS.map(p=>({name:'FY25 '+p,data:months.map(m=>{const rows=getDDMonthData(2025,m,p);return rows.reduce((a,r)=>a+(Number(r.Units)||0),0);})}));
      if(ddCharts['dd-chart-qty-yoy'])ddCharts['dd-chart-qty-yoy'].destroy();
      ddCharts['dd-chart-qty-yoy']=new ApexCharts(document.getElementById('dd-chart-qty-yoy'),{
        series:[...fy26,...fy25],chart:{type:'bar',height:260,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...PLATS.map(p=>PLAT_COLORS[p]),...PLATS.map(p=>PLAT_COLORS[p]+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'70%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{min:0,max:600000,tickAmount:6,labels:{formatter:v=>(v/100000).toFixed(0)+'L',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px',fontFamily:'Geist Mono, monospace'},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-yoy'].render();
    }

    function renderDDQtyCatYoY() {
      const CATS = ['Ragi Chips','Dipsters','Puffs','Others'];
      const CAT_COLORS = ['#EAB308','#8B5CF6','#3B82F6','#6B7280'];
      const now = new Date(); const months = [];
      for(let m=4;m<=now.getMonth()+1;m++) months.push(m);
      const labels = months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      const fy26 = CATS.map((cat,ci)=>({
        name:'FY26 '+cat,
        data: months.map(m => {
          const src = skuData.filter(r=>Number(r.Month)===m && String(r.Category)===cat);
          return src.reduce((a,r)=>a+(Number(r.MTDUnits)||0),0);
        })
      }));
      const fy25 = CATS.map((cat,ci)=>({
        name:'FY25 '+cat,
        data: months.map(m => {
          const src = fy25SKUData.filter(r=>Number(r.Month)===m && String(r.Category)===cat);
          return src.reduce((a,r)=>a+(Number(r.Quantity)||0),0);
        })
      }));
      if(ddCharts['dd-chart-qty-cat-yoy'])ddCharts['dd-chart-qty-cat-yoy'].destroy();
      ddCharts['dd-chart-qty-cat-yoy'] = new ApexCharts(document.getElementById('dd-chart-qty-cat-yoy'),{
        series:[...fy26,...fy25],chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...CAT_COLORS,...CAT_COLORS.map(c=>c+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'75%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{min:0,max:600000,tickAmount:6,labels:{formatter:v=>(v/100000).toFixed(0)+'L',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-cat-yoy'].render();
    }

    function renderDDQtyMixYoY() {
      const PLATS = ['Blinkit','Instamart','Zepto','First Club'];
      const PLAT_C = ['#EAB308','#3B82F6','#8B5CF6','#06B6D4'];
      const now = new Date(); const months = [];
      for(let m=4;m<=now.getMonth()+1;m++) months.push(m);
      const labels = months.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]);
      const mkSeries = (srcData, fy) => PLATS.map(plat=>({
        name: fy+' '+plat,
        data: months.map(m => {
          const rows = srcData.filter(r=>Number(r.Month)===m);
          const total = rows.reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          const platU = rows.filter(r=>String(r.Platform)===plat).reduce((a,r)=>a+(Number(r.MTDUnits)||Number(r.Quantity)||0),0);
          return total>0 ? Math.round(platU/total*100) : 0;
        })
      }));
      if(ddCharts['dd-chart-qty-mix-yoy'])ddCharts['dd-chart-qty-mix-yoy'].destroy();
      ddCharts['dd-chart-qty-mix-yoy'] = new ApexCharts(document.getElementById('dd-chart-qty-mix-yoy'),{
        series:[...mkSeries(skuData,'FY26'),...mkSeries(fy25SKUData,'FY25')],
        chart:{type:'bar',height:220,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:[...PLAT_C,...PLAT_C.map(c=>c+'66')],
        plotOptions:{bar:{borderRadius:3,columnWidth:'75%',grouped:true}},dataLabels:{enabled:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:labels,labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v+'%',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        legend:{labels:{colors:['#9ca3b3']},fontSize:'11px'},
        tooltip:{y:{formatter:v=>v+'% of units'},theme:'dark'}
      });
      ddCharts['dd-chart-qty-mix-yoy'].render();
    }
    

    // ─── OVERVIEW SUMMARY CHARTS ────────────────────────────────────────────────
    let chartOvSalesMix=null, chartOvROASBar=null, chartOvQtyMix=null;
    function renderOverviewSummaryCharts(agg) {
      const platData=Object.entries(agg).filter(([,v])=>v.sales>0).sort((a,b)=>b[1].sales-a[1].sales);
      const platDataQ=Object.entries(agg).filter(([,v])=>v.units>0).sort((a,b)=>b[1].units-a[1].units);
      const PAID_CHANNELS_ROAS = ['Blinkit','Zepto','Instamart'];
      const platDataR=Object.entries(agg).filter(([k,v])=>PAID_CHANNELS_ROAS.includes(k)&&v.spends>0&&v.sales>0).sort((a,b)=>(b[1].sales/b[1].spends)-(a[1].sales/a[1].spends));
      const totalS=platData.reduce((s,[,v])=>s+v.sales,0);
      const totalU=platDataQ.reduce((s,[,v])=>s+v.units,0);
      if(chartOvSalesMix)chartOvSalesMix.destroy();
      chartOvSalesMix=new ApexCharts(document.getElementById('chart-ov-sales-mix'),{
        series:platData.map(([,v])=>v.sales),labels:platData.map(([k])=>k),
        chart:{type:'donut',height:240,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors:platData.map(([k])=>PLAT_COLORS[k]||'#888'),theme:{mode:'dark'},
        legend:{position:'bottom',fontSize:'10px',fontFamily:'Geist Mono, monospace'},
        dataLabels:{enabled:false},plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{show:true,fontSize:'10px',color:'#6b7280',fontFamily:'Geist Mono, monospace'},value:{show:true,fontSize:'16px',fontWeight:600,color:'#f0f0f0',fontFamily:'Geist Mono, monospace',formatter:v=>fmtDD(Number(v))},total:{show:true,label:'Total',formatter:()=>fmtDD(totalS),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
        tooltip:{y:{formatter:v=>fmtDD(v)},theme:'dark'}
      });
      chartOvSalesMix.render();
      if(chartOvROASBar)chartOvROASBar.destroy();
      chartOvROASBar=new ApexCharts(document.getElementById('chart-ov-roas-bar'),{
        series:[{name:'ROAS',data:platDataR.map(([,v])=>+(v.sales/v.spends).toFixed(2))}],
        chart:{type:'bar',height:240,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        theme:{mode:'dark'},colors:platDataR.map(([k])=>PLAT_COLORS[k]||'#888'),
        plotOptions:{bar:{borderRadius:4,columnWidth:'50%',distributed:true}},dataLabels:{enabled:false},legend:{show:false},
        grid:{borderColor:'rgba(255,255,255,0.05)',strokeDashArray:4},
        xaxis:{categories:platDataR.map(([k])=>k),labels:{style:{colors:'#555',fontSize:'10px'}},axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{labels:{formatter:v=>v.toFixed(1)+'x',style:{colors:'#9ca3b3',fontSize:'10px'}}},
        tooltip:{y:{formatter:v=>v.toFixed(2)+'x'},theme:'dark'}
      });
      chartOvROASBar.render();
      if(chartOvQtyMix)chartOvQtyMix.destroy();
      chartOvQtyMix=new ApexCharts(document.getElementById('chart-ov-qty-mix'),{
        series:platDataQ.map(([,v])=>v.units),labels:platDataQ.map(([k])=>k),
        chart:{type:'donut',height:240,toolbar:{show:false},background:'transparent',fontFamily:'Space Grotesk, sans-serif'},
        colors:platDataQ.map(([k])=>PLAT_COLORS[k]||'#888'),theme:{mode:'dark'},
        legend:{position:'bottom',fontSize:'10px',fontFamily:'Geist Mono, monospace'},
        dataLabels:{enabled:false},plotOptions:{pie:{donut:{size:'65%',labels:{show:true,total:{show:true,label:'Total',formatter:()=>fmtDDU(totalU),color:'#f0f0f0',fontFamily:'Geist Mono, monospace'}}}}},
        tooltip:{y:{formatter:v=>fmtDDU(v)+' units'},theme:'dark'}
      });
      chartOvQtyMix.render();
    }

    // ─── CUSTOM DROPDOWN HELPERS ───────────────────────────────────────────────
    const _ddVals = {};
    function toggleDD(id) {
      const el = document.getElementById(id);
      const isOpen = el.classList.contains('open');
      document.querySelectorAll('.cust-sel.open').forEach(e => e.classList.remove('open'));
      if (!isOpen) el.classList.add('open');
    }
    function pickDD(id, val, label) {
      _ddVals[id] = val;
      const el = document.getElementById(id);
      el.querySelector('.cust-sel-val').innerHTML = label + ' <span>▾</span>';
      el.classList.remove('open');
      if (id === 'roas-trend-dd') renderROASTrend();
      if (id === 'roas-plat-dd') renderROASPlatformTrend();
    }
    document.addEventListener('click', e => {
      if (!e.target.closest('.cust-sel')) {
        document.querySelectorAll('.cust-sel.open').forEach(el => el.classList.remove('open'));
      }
    });

    // ─── ROAS BREAKDOWN CHARTS ────────────────────────────────────────────────
    function getAllData() {
      return [...rawData, ...fy25Data];
    }

    function computeMonthlyROAS(platform) {
      const all = getAllData();
      const months = [
        {key:'2025-04',m:4,y:2025},{key:'2025-05',m:5,y:2025},{key:'2025-06',m:6,y:2025},
        {key:'2025-07',m:7,y:2025},{key:'2025-08',m:8,y:2025},{key:'2025-09',m:9,y:2025},
        {key:'2025-10',m:10,y:2025},{key:'2025-11',m:11,y:2025},{key:'2025-12',m:12,y:2025},
        {key:'2026-01',m:1,y:2026},{key:'2026-02',m:2,y:2026},{key:'2026-03',m:3,y:2026},
        {key:'2026-04',m:4,y:2026},{key:'2026-05',m:5,y:2026},{key:'2026-06',m:6,y:2026},
        {key:'2026-07',m:7,y:2026},{key:'2026-08',m:8,y:2026}
      ];
      const MONTH_LABELS = {
        '2025-04':'Apr 25','2025-05':'May 25','2025-06':'Jun 25','2025-07':'Jul 25',
        '2025-08':'Aug 25','2025-09':'Sep 25','2025-10':'Oct 25','2025-11':'Nov 25',
        '2025-12':'Dec 25','2026-01':'Jan 26','2026-02':'Feb 26','2026-03':'Mar 26',
        '2026-04':'Apr 26','2026-05':'May 26','2026-06':'Jun 26','2026-07':'Jul 26'
      };
      const result = [];
      months.forEach(({key, m, y}) => {
        const rows = all.filter(r => {
          const d = parseLocalDate(r.Date);
          const platMatch = !platform || String(r.Platform) === platform;
          return d.getFullYear() === y && d.getMonth()+1 === m && platMatch && Number(r.Spends) > 0;
        });
        if (rows.length === 0) return;
        const sales  = rows.reduce((s,r) => s + (Number(r.Sales)||0), 0);
        const spends = rows.reduce((s,r) => s + (Number(r.Spends)||0), 0);
        result.push({ label: MONTH_LABELS[key], roas: spends > 0 ? sales/spends : 0 });
      });
      return result;
    }

    function computeQuarterROAS(platform) {
      const all = getAllData();
      const quarters = [
        { label:'Q1 FY26', months:[{m:4,y:2025},{m:5,y:2025},{m:6,y:2025}] },
        { label:'Q2 FY26', months:[{m:7,y:2025},{m:8,y:2025},{m:9,y:2025}] },
        { label:'Q3 FY26', months:[{m:10,y:2025},{m:11,y:2025},{m:12,y:2025}] },
        { label:'Q4 FY26', months:[{m:1,y:2026},{m:2,y:2026},{m:3,y:2026}] },
        { label:'Q1 FY27', months:[{m:4,y:2026},{m:5,y:2026},{m:6,y:2026}] },
        { label:'Q2 FY27', months:[{m:7,y:2026},{m:8,y:2026},{m:9,y:2026}] },
        { label:'Q3 FY27', months:[{m:10,y:2026},{m:11,y:2026},{m:12,y:2026}] },
        { label:'Q4 FY27', months:[{m:1,y:2027},{m:2,y:2027},{m:3,y:2027}] },
      ];
      return quarters.map(q => {
        const rows = all.filter(r => {
          const d = parseLocalDate(r.Date);
          const platMatch = !platform || String(r.Platform) === platform;
          return platMatch && Number(r.Spends) > 0 &&
            q.months.some(({m,y}) => d.getFullYear()===y && d.getMonth()+1===m);
        });
        const sales  = rows.reduce((s,r) => s+(Number(r.Sales)||0), 0);
        const spends = rows.reduce((s,r) => s+(Number(r.Spends)||0), 0);
        return { label: q.label, roas: spends > 0 ? sales/spends : 0 };
      }).filter(q => q.roas > 0);
    }

    function computeFYROAS(platform) {
      const all = getAllData();
      const fys = [
        { label:'FY25-26', months:[{m:4,y:2025},{m:5,y:2025},{m:6,y:2025},{m:7,y:2025},{m:8,y:2025},{m:9,y:2025},{m:10,y:2025},{m:11,y:2025},{m:12,y:2025},{m:1,y:2026},{m:2,y:2026},{m:3,y:2026}] },
        { label:'FY26-27', months:[{m:4,y:2026},{m:5,y:2026},{m:6,y:2026},{m:7,y:2026},{m:8,y:2026},{m:9,y:2026},{m:10,y:2026},{m:11,y:2026},{m:12,y:2026},{m:1,y:2027},{m:2,y:2027},{m:3,y:2027}] },
      ];
      return fys.map(fy => {
        const rows = all.filter(r => {
          const d = parseLocalDate(r.Date);
          const platMatch = !platform || String(r.Platform) === platform;
          return platMatch && Number(r.Spends) > 0 &&
            fy.months.some(({m,y}) => d.getFullYear()===y && d.getMonth()+1===m);
        });
        const sales  = rows.reduce((s,r) => s+(Number(r.Sales)||0), 0);
        const spends = rows.reduce((s,r) => s+(Number(r.Spends)||0), 0);
        return { label: fy.label, roas: spends > 0 ? sales/spends : 0 };
      }).filter(f => f.roas > 0);
    }

    function renderROASPlatformBar(agg) {
      const platforms = Object.keys(agg).filter(p => agg[p].roas > 0 && agg[p].spends > 0)
        .sort((a,b) => agg[b].roas - agg[a].roas);
      if (!platforms.length) return;
      const colors = platforms.map(p => PLATFORM_CONFIG[p]?.color || '#888');
      if (chartRoasPlatform) chartRoasPlatform.destroy();
      chartRoasPlatform = new ApexCharts(document.querySelector('#chart-roas-platform'), {
        series: [{ name:'ROAS', data: platforms.map(p => parseFloat(agg[p].roas.toFixed(2))) }],
        chart: { type:'bar', height:260, toolbar:{show:false}, background:'transparent', fontFamily:'Space Grotesk, sans-serif' },
        theme: { mode:'dark' },
        colors, fill: { type:'gradient', gradient:{ shade:'light', type:'vertical', shadeIntensity:0.15, gradientToColors:colors.map(c=>gradTo(c)), inverseColors:false, opacityFrom:1, opacityTo:0.95, stops:[0,100] } },
        plotOptions: { bar:{ borderRadius:6, columnWidth:'45%', distributed:true } },
        dataLabels: { enabled:false },
        legend: { show:false },
        grid: { borderColor:'rgba(255,255,255,0.05)', strokeDashArray:4 },
        xaxis: { categories:platforms, labels:{style:{colors:'#555',fontSize:'11px'}}, axisBorder:{show:false}, axisTicks:{show:false} },
        yaxis: { labels:{ formatter: v => v.toFixed(1)+'x', style:{colors:'#9ca3b3',fontSize:'11px'} } },
        tooltip: { y:{ formatter: v => v.toFixed(2)+'x' }, theme:'dark' },
      });
      chartRoasPlatform.render();
    }

    function renderROASTrend() {
      const val = _ddVals['roas-trend-dd'] || 'month-all';
      const labelEl = document.getElementById('roas-trend-label');
      let points = [];

      if (val.startsWith('month-')) {
        const key = val.replace('month-','');
        if (key === 'all') {
          points = computeMonthlyROAS(null);
          if (labelEl) labelEl.textContent = 'Monthly';
        } else {
          // single month selected — show all months but highlight selected
          points = computeMonthlyROAS(null);
          if (labelEl) labelEl.textContent = 'Monthly';
        }
      } else if (val.startsWith('quarter-')) {
        points = computeQuarterROAS(null);
        if (labelEl) labelEl.textContent = 'Quarterly';
      } else if (val.startsWith('fy-')) {
        points = computeFYROAS(null);
        if (labelEl) labelEl.textContent = 'Financial Year';
      }

      if (!points.length) return;
      if (chartRoasTrend) chartRoasTrend.destroy();
      chartRoasTrend = new ApexCharts(document.querySelector('#chart-roas-trend'), {
        series: [{ name:'ROAS', data: points.map(p => parseFloat(p.roas.toFixed(2))) }],
        chart: { type:'area', height:260, toolbar:{show:false}, background:'transparent', fontFamily:'Space Grotesk, sans-serif' },
        theme: { mode:'dark' },
        colors: ['#22C55E'],
        stroke: { width:2.5, curve:'smooth' },
        fill: { type:'gradient', gradient:{ shade:'dark', type:'vertical', shadeIntensity:0.4, gradientToColors:['#16a34a'], opacityFrom:0.4, opacityTo:0.02, stops:[0,100] } },
        markers: { size:5, strokeWidth:0, colors:['#22C55E'] },
        dataLabels: { enabled:false },
        grid: { borderColor:'rgba(255,255,255,0.05)', strokeDashArray:4 },
        xaxis: { categories:points.map(p=>p.label), labels:{style:{colors:'#555',fontSize:'11px'}, rotate:-30}, axisBorder:{show:false}, axisTicks:{show:false} },
        yaxis: { labels:{ formatter: v => v.toFixed(1)+'x', style:{colors:'#9ca3b3',fontSize:'11px'} } },
        tooltip: { y:{ formatter: v => v.toFixed(2)+'x' }, theme:'dark' },
      });
      chartRoasTrend.render();
    }

    function renderROASPlatformTrend() {
      const platform = document.getElementById('roas-platform-select')?.value || 'Blinkit';
      const points = computeMonthlyROAS(platform);
      const color = PLATFORM_CONFIG[platform]?.color || '#EAB308';
      if (!points.length) return;
      if (chartRoasPlatformTrend) chartRoasPlatformTrend.destroy();
      chartRoasPlatformTrend = new ApexCharts(document.querySelector('#chart-roas-platform-trend'), {
        series: [{ name: platform+' ROAS', data: points.map(p => parseFloat(p.roas.toFixed(2))) }],
        chart: { type:'area', height:260, toolbar:{show:false}, background:'transparent', fontFamily:'Space Grotesk, sans-serif' },
        theme: { mode:'dark' },
        colors: [color],
        stroke: { width:2.5, curve:'smooth' },
        fill: { type:'gradient', gradient:{ shade:'dark', type:'vertical', shadeIntensity:0.4, gradientToColors:[gradTo(color)], opacityFrom:0.4, opacityTo:0.02, stops:[0,100] } },
        markers: { size:5, strokeWidth:0, colors:[color] },
        dataLabels: { enabled:false },
        grid: { borderColor:'rgba(255,255,255,0.05)', strokeDashArray:4 },
        xaxis: { categories:points.map(p=>p.label), labels:{style:{colors:'#555',fontSize:'11px'}, rotate:-30}, axisBorder:{show:false}, axisTicks:{show:false} },
        yaxis: { labels:{ formatter: v => v.toFixed(1)+'x', style:{colors:'#9ca3b3',fontSize:'11px'} } },
        tooltip: { y:{ formatter: v => v.toFixed(2)+'x' }, theme:'dark' },
      });
      chartRoasPlatformTrend.render();
    }

    // ─── AGGREGATE ─────────────────────────────────────────────────────────────
    function aggregateByPlatform(data) {
      const agg = {};
      data.forEach(row => {
        const p = String(row.Platform || '').trim();
        if (!p) return;
        if (!agg[p]) agg[p] = { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 };
        agg[p].sales  += Number(row.Sales)  || 0;
        agg[p].spends += Number(row.Spends) || 0;
        agg[p].units  += Number(row.Units)  || 0;
        const roas = Number(row.ROAS);
        if (roas > 0) { agg[p].roasSum += roas; agg[p].roasCount++; }
      });
      Object.keys(agg).forEach(p => {
        const d = agg[p];
        if (d.spends > 0) {
          d.roas = d.sales / d.spends;
        } else if (d.roasCount > 0) {
          d.roas = d.roasSum / d.roasCount;
        } else {
          d.roas = 0;
        }
      });
      return agg;
    }

    // ─── RENDER ────────────────────────────────────────────────────────────────
    function render() {
      const _ptm = {'blinkit':'Blinkit','zepto':'Zepto','instamart':'Instamart','bigbasket':'Big Basket'};
      if (_ptm[activeTab]) {
        openChannelView(_ptm[activeTab]);
        return;
      }
      if (activeTab === 'skus') { loadSKUData().then(() => renderSKUView()); return; }

      const data = getFilteredData();
      const agg  = aggregateByPlatform(data);

      const platFilter = document.getElementById('platformFilter').value;
      const periodLabels = { t1:'T-1 (yesterday)', t2:'T-2', '7d':'Last 7 days', mtd:'Month to date', custom:'Custom range' };
      document.getElementById('data-subtitle').textContent =
        `${monthLabel(activeMonth)} · ${periodLabels[activePeriod] || ''} ${platFilter !== 'All' ? '· '+platFilter : ''} · ${data.length} records`;

      renderKPIs(data, agg);
      renderPlatformCards(agg);
      renderOverviewSummaryCharts(agg);
    }

    // ─── KPI CARDS ─────────────────────────────────────────────────────────────
    function renderKPIs(data, agg) {
      const totalSales  = Object.values(agg).reduce((s, d) => s + d.sales, 0);
      const totalSpends = Object.values(agg).reduce((s, d) => s + d.spends, 0);
      const totalUnits  = Object.values(agg).reduce((s, d) => s + d.units, 0);

      const PAID_CHANNELS = ['Blinkit','Zepto','Instamart'];
      const adSales  = PAID_CHANNELS.reduce((s,p) => s + (agg[p]?.sales || 0), 0);
      const adSpends = PAID_CHANNELS.reduce((s,p) => s + (agg[p]?.spends || 0), 0);
      const blendedRoas = adSpends > 0 ? adSales / adSpends : 0;
      let bestPlatform = '--', bestRoas = 0;
      Object.keys(agg).forEach(p => {
        if (agg[p].roas > bestRoas && agg[p].spends > 0) { bestRoas = agg[p].roas; bestPlatform = p; }
      });

      const platformCount = Object.keys(agg).length;

      // Build daily series for sparklines
      const dailySales = {}, dailySpends = {}, dailyUnits = {}, dailyRoas = {};
      data.forEach(r => {
        const d = String(r.Date).split('T')[0].substring(0,10);
        dailySales[d]  = (dailySales[d]  || 0) + (Number(r.Sales)  || 0);
        dailySpends[d] = (dailySpends[d] || 0) + (Number(r.Spends) || 0);
        dailyUnits[d]  = (dailyUnits[d]  || 0) + (Number(r.Units)  || 0);
      });
      const sortedDays = Object.keys(dailySales).sort();
      const salesSpark  = sortedDays.map(d => Math.round(dailySales[d]));
      const spendsSpark = sortedDays.map(d => Math.round(dailySpends[d]));
      const unitsSpark  = sortedDays.map(d => Math.round(dailyUnits[d]));
      const roasSpark   = sortedDays.map(d => {
        const s = dailySales[d] || 0;
        const sp = dailySpends[d] || 0;
        return sp > 0 ? parseFloat((s/sp).toFixed(2)) : 0;
      });

      const cards = [
        {
          label: 'Total Sales',
          value: fmt(totalSales),
          sub: `${platformCount} platform${platformCount !== 1 ? 's' : ''}`,
          accent: 'var(--orange)',
          subClass: 'neutral',
          spark: true, sparkData: salesSpark
        },
        {
          label: 'Total Ad Spends',
          value: fmt(totalSpends),
          sub: totalSpends > 0 ? 'Tracked budget' : 'No tracked spends',
          accent: 'var(--purple)',
          subClass: 'neutral',
          spark: true, sparkData: spendsSpark
        },
        {
          label: 'Blended ROAS',
          value: blendedRoas > 0 ? fmtRoas(blendedRoas) : '--',
          sub: blendedRoas >= 2 ? '▲ Healthy' : blendedRoas > 0 ? '△ Monitor' : 'Spends not tracked',
          accent: blendedRoas >= 2 ? 'var(--green)' : blendedRoas > 0 ? 'var(--yellow)' : 'var(--text-muted)',
          subClass: blendedRoas >= 2 ? 'positive' : blendedRoas > 0 ? 'neutral' : 'neutral',
          spark: true, sparkData: roasSpark
        },
        {
          label: 'Total Units',
          value: fmt(totalUnits, false),
          sub: totalSales > 0 && totalUnits > 0 ? `ASP ₹${(totalSales/totalUnits).toFixed(0)}` : '',
          accent: 'var(--blue)',
          subClass: 'neutral',
          spark: true, sparkData: unitsSpark
        },
        {
          label: 'Best ROAS Platform',
          value: bestPlatform,
          sub: bestRoas > 0 ? fmtRoas(bestRoas) : '--',
          accent: bestPlatform !== '--' ? (PLATFORM_CONFIG[bestPlatform]?.color || 'var(--green)') : 'var(--text-muted)',
          subClass: 'positive',
          spark: false
        },
        {
          label: 'Active Platforms',
          value: platformCount,
          sub: `of ${Object.keys(PLATFORM_CONFIG).length} tracked`,
          accent: 'var(--yellow)',
          subClass: 'neutral',
          spark: false
        },
      ];

      document.getElementById('kpi-grid').innerHTML = cards.map((c, i) => {
        const pillClass = c.subClass === 'positive' ? 'positive' : c.subClass === 'negative' ? 'negative' : 'neutral';
        const sparkId = `kpi-spark-${i}`;
        return `
        <div class="kpi-card" style="--accent:${c.accent}">
          <div class="kpi-card-top">
            <div class="kpi-label">${c.label}</div>
            <div class="kpi-value">${c.value}</div>
            ${c.sub ? `<div class="kpi-pill ${pillClass}">${c.sub}</div>` : ''}
          </div>
          ${c.spark ? `<div class="kpi-spark" id="${sparkId}"></div>` : ''}
        </div>`;
      }).join('');

      // Mount sparklines
      cards.forEach((c, i) => {
        if (!c.spark || !c.sparkData || c.sparkData.length < 2) return;
        const el = document.querySelector(`#kpi-spark-${i}`);
        if (!el) return;
        new ApexCharts(el, {
          series: [{ data: c.sparkData }],
          chart: { type: 'area', height: 44, sparkline: { enabled: true }, animations: { enabled: false } },
          stroke: { curve: 'smooth', width: 2 },
          fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0, stops: [0, 100] }
          },
          colors: [c.accent.replace('var(--orange)','#F97316').replace('var(--purple)','#A855F7').replace('var(--green)','#22C55E').replace('var(--blue)','#3B82F6').replace('var(--yellow)','#EAB308').replace('var(--text-muted)','#6b7280')],
          tooltip: { enabled: false }
        }).render();
      });
    }

    // ─── PLATFORM CARDS ────────────────────────────────────────────────────────
    function renderPlatformCards(agg) {
      const platformFilter = document.getElementById('platformFilter').value;
      const platforms = Object.keys(agg).sort((a,b) => agg[b].sales - agg[a].sales);

      if (platforms.length === 0) {
        document.getElementById('platform-grid').innerHTML = '<div class="no-data">No data for selected filters.</div>';
        return;
      }

      let html = '';
      platforms.forEach(p => {
        const d = agg[p];
        const cfg = PLATFORM_CONFIG[p] || { color: '#888', budget: {} };
        const color = cfg.color;
        const budget = cfg.budget[activeMonth] || cfg.budget['05'] || 0;

        const roasVal = d.roas;
        const badgeCls = roasBadgeClass(roasVal);
        const asp = d.units > 0 ? (d.sales / d.units).toFixed(0) : 0;

        let pacingHtml = '';
        if (budget > 0) {
          const pct = Math.min(100, ((d.spends || 0) / budget) * 100).toFixed(1);
          pacingHtml = `
            <div class="p-stat-row">
              <span class="p-stat-label">Budget Pacing</span>
              <span class="p-stat-value mono">${pct}%</span>
            </div>`;
        }

        html += `
          <div class="platform-card" style="--p-color:${color}">
            <div class="platform-name">
              ${p}
              <span class="platform-roas-badge ${badgeCls}">ROAS ${fmtRoas(roasVal)}</span>
            </div>
            <div class="p-stat-row">
              <span class="p-stat-label">Sales</span>
              <span class="p-stat-value">${fmt(d.sales)}</span>
            </div>
            <div class="p-stat-row">
              <span class="p-stat-label">Units</span>
              <span class="p-stat-value">${fmt(d.units, false)}</span>
            </div>
            <div class="p-stat-row">
              <span class="p-stat-label">Spends</span>
              <span class="p-stat-value mono">${d.spends > 0 ? fmt(d.spends) : '--'}</span>
            </div>
            <div class="p-stat-row">
              <span class="p-stat-label">ASP</span>
              <span class="p-stat-value mono">${asp > 0 ? '₹'+asp : '--'}</span>
            </div>
            ${pacingHtml}
          </div>`;
      });

      document.getElementById('platform-grid').innerHTML = html;
    }

    // ─── CHARTS ────────────────────────────────────────────────────────────────
    // Helper to extract monthly trend data
    function getTrendData(targetPlatform = null) {
      const allData = [...fy25Data, ...rawData];
      const monthly = {};

      allData.forEach(r => {
        if (targetPlatform) {
           if (String(r.Platform) !== targetPlatform) return;
        } else {
           // Respect the global platform dropdown if no specific target
           const globalPlat = document.getElementById('platformFilter').value;
           if (globalPlat !== 'All' && String(r.Platform) !== globalPlat) return;
        }
        
        const d = parseLocalDate(r.Date);
        if (isNaN(d)) return;
        const mKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthly[mKey] = (monthly[mKey] || 0) + (Number(r.Sales) || 0);
      });

      const sortedMonths = Object.keys(monthly).sort();
      const mNames = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };
      
      const labels = sortedMonths.map(m => mNames[m.split('-')[1]]);
      const values = sortedMonths.map(m => monthly[m]);

      return { labels, values };
    }

    function renderCharts(agg) {
      // 1. SALES MIX (DONUT)
      const platforms = Object.keys(agg).sort((a,b) => agg[b].sales - agg[a].sales);
      const mixVals = platforms.map(p => agg[p].sales);
      const mixColors = platforms.map(p => PLATFORM_CONFIG[p]?.color || '#888');

      if (chartMix) chartMix.destroy();
      chartMix = new ApexCharts(document.querySelector('#chart-mix'), {
        series: mixVals,
        labels: platforms,
        chart: { type: 'donut', height: 260, background: 'transparent', fontFamily: 'Space Grotesk, sans-serif' },
        theme: { mode: 'dark' },
        colors: mixColors,
        stroke: { show: true, colors: ['#11131c'], width: 2 },
        dataLabels: { enabled: false },
        legend: { position: 'right', labels: { colors: '#9ca3b3' }, fontSize: '11px', fontFamily: 'Geist Mono, monospace', markers: { width: 10, height: 10, radius: 2 }, itemMargin: { vertical: 6 } },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
        plotOptions: { pie: { donut: { size: '65%', labels: { show: true, name: { show: true, fontSize: '11px', color: '#6b7280', fontFamily: 'Geist Mono, monospace' }, value: { show: true, fontSize: '18px', fontWeight: 600, color: '#f0f0f0', fontFamily: 'Geist Mono, monospace', formatter: v => { const n=Number(v); if(n>=1e7) return '₹'+(n/1e7).toFixed(2)+'Cr'; if(n>=1e5) return '₹'+(n/1e5).toFixed(2)+'L'; if(n>=1e3) return '₹'+(n/1e3).toFixed(1)+'K'; return '₹'+n.toFixed(0); } }, total: { show: true, label: 'Total', formatter: () => fmt(mixVals.reduce((a,b)=>a+b,0)), color: '#f0f0f0', fontFamily: 'Geist Mono, monospace' } } } } }
      });
      chartMix.render();

      // 2. TOTAL SALES TREND
      const totalTrend = getTrendData();
      const globalPlat = document.getElementById('platformFilter').value;
      const totalColor = globalPlat !== 'All' ? (PLATFORM_CONFIG[globalPlat]?.color || '#F97316') : '#F97316';

      if (chartTrendTotal) chartTrendTotal.destroy();
      chartTrendTotal = new ApexCharts(document.querySelector('#chart-trend-total'), {
        series: [{ name: 'Sales', data: totalTrend.values }],
        chart: { type: 'area', height: 240, toolbar: { show: false }, background: 'transparent', fontFamily: 'Space Grotesk, sans-serif' },
        theme: { mode: 'dark' },
        colors: [totalColor],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.0, stops: [0, 100] } },
        stroke: { curve: 'straight', width: 3 },
        markers: { size: 5, colors: [totalColor], strokeColors: '#11131c', strokeWidth: 2, hover: { size: 7 } },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        xaxis: { categories: totalTrend.labels, labels: { style: { colors: '#9ca3b3', fontSize: '11px', fontFamily: 'Geist Mono, monospace' } }, axisBorder: { show: false }, axisTicks: { show: false }, crosshairs: { show: false } },
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#9ca3b3', fontSize: '11px', fontFamily: 'Geist Mono, monospace' } } },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' }
      });
      chartTrendTotal.render();

      // 3. PLATFORM SALES TREND
      renderPlatformTrendChart();
    }

    function renderPlatformTrendChart() {
      const selPlatform = document.getElementById('trend-platform-select').value;
      const platTrend = getTrendData(selPlatform);
      const platColor = PLATFORM_CONFIG[selPlatform]?.color || '#EAB308'; // Default fallback

      if (chartTrendPlatform) chartTrendPlatform.destroy();
      chartTrendPlatform = new ApexCharts(document.querySelector('#chart-trend-platform'), {
        series: [{ name: selPlatform + ' Sales', data: platTrend.values }],
        chart: { type: 'area', height: 240, toolbar: { show: false }, background: 'transparent', fontFamily: 'Space Grotesk, sans-serif' },
        theme: { mode: 'dark' },
        colors: [platColor],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.0, stops: [0, 100] } },
        stroke: { curve: 'straight', width: 3 },
        markers: { size: 5, colors: [platColor], strokeColors: '#11131c', strokeWidth: 2, hover: { size: 7 } },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        xaxis: { categories: platTrend.labels, labels: { style: { colors: '#9ca3b3', fontSize: '11px', fontFamily: 'Geist Mono, monospace' } }, axisBorder: { show: false }, axisTicks: { show: false }, crosshairs: { show: false } },
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#9ca3b3', fontSize: '11px', fontFamily: 'Geist Mono, monospace' } } },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' }
      });
      chartTrendPlatform.render();
    }


    // ─── TAB SWITCHING ─────────────────────────────────────────────────────────
    let activeTab = 'overview';
    const ALL_TABS = ['overview','compare','blinkit','zepto','instamart','bigbasket','skus','skucompare','shopify','deepdive'];
    const PLATFORM_TAB_MAP = { 'blinkit':'Blinkit', 'zepto':'Zepto', 'instamart':'Instamart', 'bigbasket':'Big Basket' };

    function switchTab(tab) {
      activeTab = tab;
      ALL_TABS.forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if (btn) btn.classList.toggle('active', t === tab);
      });
      document.getElementById('view-overview').style.display = tab === 'overview' ? 'block' : 'none';
      document.getElementById('view-compare').style.display  = tab === 'compare'  ? 'block' : 'none';
      document.getElementById('view-channel').style.display  = PLATFORM_TAB_MAP[tab] ? 'block' : 'none';
      document.getElementById('view-skus').style.display       = tab === 'skus'       ? 'block' : 'none';
      document.getElementById('view-skucompare').style.display = tab === 'skucompare' ? 'block' : 'none';
      if (tab === 'skucompare') {
        populateSKUCmpMonths();
        Promise.all([loadSKUData(), preloadFY25SKUData()]).then(() => initSKUCompare());
      }
      document.getElementById('view-shopify').style.display = tab === 'shopify' ? 'block' : 'none';
      const ddEl = document.getElementById('view-deepdive');
      if (ddEl) ddEl.style.display = tab === 'deepdive' ? 'block' : 'none';
       if (tab === 'deepdive') { updateDDView(); }
     if (tab === 'shopify') {activeShopifyMonth = '04'; ['01','02','03','04','05','06','07','08','09','10','11','12'].forEach(k => { const b = document.getElementById('shopify-btn-'+k); if(b) b.classList.toggle('active', k==='04'); }); setTimeout(() => loadShopifyData(), 80); }
      const kg = document.getElementById('kpi-grid');
      const dc = document.getElementById('dashboard-content');
      if (kg) kg.style.display = tab === 'overview' ? 'grid' : 'none';
      if (dc) dc.style.display = tab === 'overview' ? 'flex'  : 'none';
      if (tab === 'skus') { loadSKUData().then(() => renderSKUView()); }
      if (tab === 'skucompare') { 
  Promise.all([loadSKUData(), loadSKUDailyData()]).then(() => initSKUCompare()); 
}
      if (tab === 'compare') {
        const hasSummary = document.getElementById('cmp-summary').style.display !== 'none';
        if (!hasSummary) document.getElementById('cmp-no-data').style.display = 'block';
      }
      if (PLATFORM_TAB_MAP[tab]) {
        openChannelView(PLATFORM_TAB_MAP[tab]);
      }
    }

    // ─── COMPARE ENGINE ────────────────────────────────────────────────────────
    let cmpMode = 'day';
    let cmpChartSales = null, cmpChartRoas = null, cmpChartTrend = null;
    let cmpSelectedChannels = new Set(); // empty = ALL

    function toggleCmpChannel(platform) {
      const isAll = platform === '__ALL__';
      if (isAll) {
        cmpSelectedChannels.clear();
      } else {
        if (cmpSelectedChannels.has(platform)) {
          cmpSelectedChannels.delete(platform);
        } else {
          cmpSelectedChannels.add(platform);
        }
      }
      // Update pill UI
      document.querySelectorAll('.cmp-chip').forEach(btn => {
        const p = btn.getAttribute('data-platform');
        if (p === '__ALL__') {
          btn.classList.toggle('active', cmpSelectedChannels.size === 0);
        } else {
          btn.classList.toggle('active', cmpSelectedChannels.has(p));
        }
      });
      // Update hint
      const hint = document.getElementById('cmp-channel-hint');
      if (cmpSelectedChannels.size === 0) {
        hint.textContent = 'Showing all platforms';
      } else {
        const list = [...cmpSelectedChannels];
        hint.textContent = list.length <= 3 ? list.join(' + ') : `${list.length} channels selected`;
      }
    }

    function applyCmpChannelFilter(rows) {
      if (cmpSelectedChannels.size === 0) return rows;
      return rows.filter(r => cmpSelectedChannels.has(String(r.Platform)));
    }

 function setCmpMode(m) {
      cmpMode = m;
      ['day','week','month','mom','wow','custom'].forEach(k => {
        const btn = document.getElementById('cmode-' + k);
        if (btn) btn.classList.toggle('active', k === m);
      });
      document.getElementById('day-pickers').style.display        = m === 'day'    ? 'grid' : 'none';
      document.getElementById('week-pickers').style.display       = m === 'week'   ? 'grid' : 'none';
      document.getElementById('month-pickers').style.display      = m === 'month'  ? 'grid' : 'none';
      document.getElementById('mom-pickers').style.display        = m === 'mom'    ? 'grid' : 'none';
      document.getElementById('wow-pickers').style.display        = m === 'wow'    ? 'grid' : 'none';
      document.getElementById('custom-range-pickers').style.display = m === 'custom' ? 'block' : 'none';
      ['cmp-summary','cmp-bar-wrap','cmp-line-wrap','cmp-no-data','cmp-multi-summary','cmp-multi-chart-wrap','cmp-daily-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      if (m === 'month') populateMonthDropdowns();
      if (m === 'mom') populateMomDropdowns();
    }
    let customSubMode = 'daterange';
    function setCustomMode(cm) {
      customSubMode = cm;
      ['daterange','daycount','singledaily'].forEach(k => {
        const btn = document.getElementById('ccmode-' + k);
        if (btn) btn.classList.toggle('active', k === cm);
      });
      document.getElementById('custom-daterange-pickers').style.display   = cm === 'daterange'   ? 'grid' : 'none';
      document.getElementById('custom-daycount-pickers').style.display    = cm === 'daycount'    ? 'grid' : 'none';
      document.getElementById('custom-singledaily-pickers').style.display = cm === 'singledaily' ? 'grid' : 'none';
    }

    function populateMonthDropdowns() {
      const monthSet = new Set();
      [...rawData, ...fy25Data].forEach(r => {
        const d = new Date(r.Date);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          monthSet.add(key);
        }
      });
      const months = [...monthSet].sort();
      const labels = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };
      const opts = months.map(m => {
        const [yr, mo] = m.split('-');
        return `<option value="${m}">${labels[mo]} ${yr}</option>`;
      }).join('');
      ['cmp-month-a','cmp-month-b'].forEach(id => {
        const el = document.getElementById(id);
        el.innerHTML = '<option value="">Select month</option>' + opts;
      });
    }

    function populateMomDropdowns() {
      const monthSet = new Set();
      rawData.forEach(r => {
        const d = new Date(r.Date);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          monthSet.add(key);
        }
      });
      const months = [...monthSet].sort();
      const labels = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };
      const opts = months.map(m => {
        const [yr, mo] = m.split('-');
        return `<option value="${m}">${labels[mo]} ${yr}</option>`;
      }).join('');
      ['cmp-mom-start','cmp-mom-end'].forEach(id => {
        const el = document.getElementById(id);
        el.innerHTML = '<option value="">Select month</option>' + opts;
      });
    }

    function getDateRange(startStr, days) {
      const start = new Date(startStr); start.setHours(0,0,0,0);
      const end   = new Date(start);   end.setDate(end.getDate() + days - 1); end.setHours(0,0,0,0);
      return { start, end };
    }

    function filterByDateRange(start, end) {
      return rawData.filter(r => {
        const d = parseLocalDate(r.Date); d.setHours(0,0,0,0); // FIXED TIMEZONE
        return d >= start && d <= end;
      });
    }

    function aggregatePeriod(rows) {
      const total = { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 };
      const byPlatform = {};
      const byDate = {};

      rows.forEach(r => {
        const sales  = Number(r.Sales)  || 0;
        const spends = Number(r.Spends) || 0;
        const roas   = Number(r.ROAS)   || 0;
        const units  = Number(r.Units)  || 0;
        const plat   = String(r.Platform);
        const date   = String(r.Date);

        total.sales  += sales;
        total.spends += spends;
        total.units  += units;
        if (roas > 0) { total.roasSum += roas; total.roasCount++; }

        if (!byPlatform[plat]) byPlatform[plat] = { sales:0, spends:0, roas:0, roasCount:0, units:0 };
        byPlatform[plat].sales  += sales;
        byPlatform[plat].spends += spends;
        byPlatform[plat].units  += units;
        if (roas > 0) { byPlatform[plat].roas += roas; byPlatform[plat].roasCount++; }

        if (!byDate[date]) byDate[date] = 0;
        byDate[date] += sales;
      });

      Object.keys(byPlatform).forEach(p => {
        const d = byPlatform[p];
        d.roas = d.spends > 0 ? (d.sales / d.spends) : (d.roasCount > 0 ? d.roas / d.roasCount : 0);
      });
      total.roas = total.spends > 0 ? (total.sales / total.spends)
                 : total.roasCount > 0 ? (total.roasSum / total.roasCount) : 0;

      return { total, byPlatform, byDate };
    }

    function delta(a, b) {
      if (!b) return null;
      return ((a - b) / b * 100).toFixed(1);
    }

    function runCompare() {
      document.getElementById('cmp-no-data').style.display = 'none';
      // Hide multi/daily panels by default (they get re-shown by their respective renderers)
      ['cmp-summary','cmp-bar-wrap','cmp-line-wrap','cmp-multi-summary','cmp-multi-chart-wrap','cmp-daily-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      // ─── MoM: multi-month with growth % ────────────────────────────────────
      if (cmpMode === 'mom') {
        const startKey = document.getElementById('cmp-mom-start').value;
        const endKey   = document.getElementById('cmp-mom-end').value;
        if (!startKey || !endKey) { alert('Select both start and end months.'); return; }
        if (startKey > endKey) { alert('Start month must be before end month.'); return; }

        const months = [];
        let [sy, sm] = startKey.split('-').map(Number);
        const [ey, em] = endKey.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
          months.push({ year: sy, month: sm });
          sm++; if (sm > 12) { sm = 1; sy++; }
        }

        const mNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const periods = months.map(({year, month}) => {
          const start = new Date(year, month-1, 1); start.setHours(0,0,0,0);
          const end   = new Date(year, month, 0);   end.setHours(23,59,59,999);
          const rows  = applyCmpChannelFilter(filterByDateRange(start, end));
          return { label: `${mNames[month]} ${year}`, agg: aggregatePeriod(rows) };
        });
        renderMultiPeriod(periods, 'MoM');
        return;
      }

      // ─── WoW: multi-week with growth % ─────────────────────────────────────
      if (cmpMode === 'wow') {
        const startStr = document.getElementById('cmp-wow-start').value;
        const endStr   = document.getElementById('cmp-wow-end').value;
        if (!startStr || !endStr) { alert('Select both start and end dates.'); return; }

        const startD = parseLocalDate(startStr); startD.setHours(0,0,0,0);
        const endD   = parseLocalDate(endStr);   endD.setHours(23,59,59,999);
        if (startD > endD) { alert('Start date must be before end date.'); return; }

        const periods = [];
        let cursor = new Date(startD);
        let idx = 1;
        while (cursor <= endD) {
          const weekStart = new Date(cursor); weekStart.setHours(0,0,0,0);
          const weekEnd   = new Date(cursor); weekEnd.setDate(weekEnd.getDate()+6); weekEnd.setHours(23,59,59,999);
          const actualEnd = weekEnd > endD ? endD : weekEnd;
          const rows = applyCmpChannelFilter(filterByDateRange(weekStart, actualEnd));
          const fmtD = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
          periods.push({ label: `W${idx} (${fmtD(weekStart)}→${fmtD(actualEnd)})`, agg: aggregatePeriod(rows) });
          cursor.setDate(cursor.getDate() + 7);
          idx++;
        }
        renderMultiPeriod(periods, 'WoW');
        return;
      }

      // ─── Custom: Single Range + Daily breakdown ────────────────────────────
      if (cmpMode === 'custom' && customSubMode === 'singledaily') {
        const sd = document.getElementById('cmp-custom-sd-start').value;
        const ed = document.getElementById('cmp-custom-sd-end').value;
        if (!sd || !ed) { alert('Fill in both dates.'); return; }
        const start = parseLocalDate(sd); start.setHours(0,0,0,0);
        const end   = parseLocalDate(ed); end.setHours(23,59,59,999);
        if (start > end) { alert('Start date must be before end date.'); return; }
        const rows = applyCmpChannelFilter(filterByDateRange(start, end));
        renderDailyBreakdown(rows, start, end);
        return;
      }

      let rowsA, rowsB, labelA, labelB, datesA, datesB;

      if (cmpMode === 'month') {
        const mA = document.getElementById('cmp-month-a').value;
        const mB = document.getElementById('cmp-month-b').value;
        if (!mA || !mB) { alert('Select both months.'); return; }
        const [yrA, moA] = mA.split('-').map(Number);
        const [yrB, moB] = mB.split('-').map(Number);
        const startA = new Date(yrA, moA-1, 1); startA.setHours(0,0,0,0);
        const endA   = new Date(yrA, moA, 0);   endA.setHours(0,0,0,0);
        const startB = new Date(yrB, moB-1, 1); startB.setHours(0,0,0,0);
        const endB   = new Date(yrB, moB, 0);   endB.setHours(0,0,0,0);
        rowsA = applyCmpChannelFilter(filterByDateRange(startA, endA));
        rowsB = applyCmpChannelFilter(filterByDateRange(startB, endB));
        const mNames = { 1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec' };
        labelA = `${mNames[moA]} ${yrA}`; labelB = `${mNames[moB]} ${yrB}`;
        datesA = null; datesB = null;
      } else if (cmpMode === 'custom') {
        if (customSubMode === 'daterange') {
          const asStart = document.getElementById('cmp-custom-a-start').value;
          const asEnd   = document.getElementById('cmp-custom-a-end').value;
          const bsStart = document.getElementById('cmp-custom-b-start').value;
          const bsEnd   = document.getElementById('cmp-custom-b-end').value;
          if (!asStart || !asEnd || !bsStart || !bsEnd) { alert('Fill all four dates.'); return; }
          const rA = { start: new Date(asStart), end: new Date(asEnd) };
          const rB = { start: new Date(bsStart), end: new Date(bsEnd) };
          rA.start.setHours(0,0,0,0); rA.end.setHours(0,0,0,0);
          rB.start.setHours(0,0,0,0); rB.end.setHours(0,0,0,0);
          rowsA = applyCmpChannelFilter(filterByDateRange(rA.start, rA.end));
          rowsB = applyCmpChannelFilter(filterByDateRange(rB.start, rB.end));
          labelA = `${asStart} → ${asEnd}`; labelB = `${bsStart} → ${bsEnd}`;
        } else {
          const adcS = document.getElementById('cmp-custom-a-dcstart').value;
          const adcD = parseInt(document.getElementById('cmp-custom-a-days').value);
          const bdcS = document.getElementById('cmp-custom-b-dcstart').value;
          const bdcD = parseInt(document.getElementById('cmp-custom-b-days').value);
          if (!adcS || !adcD || !bdcS || !bdcD) { alert('Fill all fields.'); return; }
          const rA = getDateRange(adcS, adcD);
          const rB = getDateRange(bdcS, bdcD);
          rowsA = applyCmpChannelFilter(filterByDateRange(rA.start, rA.end));
          rowsB = applyCmpChannelFilter(filterByDateRange(rB.start, rB.end));
          labelA = `${adcS} (${adcD}d)`; labelB = `${bdcS} (${bdcD}d)`;
        }
        datesA = null; datesB = null;
      } else if (cmpMode === 'day') {
        const dayA = document.getElementById('cmp-day-a').value;
        const dayB = document.getElementById('cmp-day-b').value;
        if (!dayA || !dayB) { alert('Pick both dates.'); return; }
        const rA = getDateRange(dayA, 1), rB = getDateRange(dayB, 1);
        rowsA = applyCmpChannelFilter(filterByDateRange(rA.start, rA.end));
        rowsB = applyCmpChannelFilter(filterByDateRange(rB.start, rB.end));
        labelA = dayA; labelB = dayB;
        datesA = null; datesB = null;
      } else {
        const wA = document.getElementById('cmp-week-a-start').value;
        const wB = document.getElementById('cmp-week-b-start').value;
        if (!wA || !wB) { alert('Pick both week start dates.'); return; }
        const rA = getDateRange(wA, 7), rB = getDateRange(wB, 7);
        rowsA = applyCmpChannelFilter(filterByDateRange(rA.start, rA.end));
        rowsB = applyCmpChannelFilter(filterByDateRange(rB.start, rB.end));
        labelA = wA + ' (7d)'; labelB = wB + ' (7d)';
        datesA = rA; datesB = rB;
      }

      const aggA = aggregatePeriod(rowsA);
      const aggB = aggregatePeriod(rowsB);

      renderCompareSummary(aggA, aggB, labelA, labelB);
      renderCompareCharts(aggA, aggB, labelA, labelB, datesA, datesB);
    }

    function renderCompareSummary(aggA, aggB, labelA, labelB) {
      const metrics = [
        { key: 'sales',  label: 'Total Sales',  fmt: v => fmt(v),            valA: aggA.total.sales,  valB: aggB.total.sales },
        { key: 'spends', label: 'Ad Spends',     fmt: v => fmt(v),            valA: aggA.total.spends, valB: aggB.total.spends },
        { key: 'roas',   label: 'ROAS',          fmt: v => v > 0 ? v.toFixed(2)+'x' : '--', valA: aggA.total.roas, valB: aggB.total.roas },
        { key: 'units',  label: 'Total Units',   fmt: v => fmt(v, false),    valA: aggA.total.units,  valB: aggB.total.units },
      ];

      const html = metrics.map(m => {
        const d = delta(m.valA, m.valB);
        const dClass = d === null ? 'neu' : Number(d) >= 0 ? 'pos' : 'neg';
        const dText  = d === null ? '--' : (Number(d) >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '%';
        return `
          <div class="compare-stat-card">
            <div class="compare-stat-label">${m.label}</div>
            <div class="compare-stat-row">
              <div>
                <div style="font-size:10px;color:#F97316;margin-bottom:3px;font-family:'Geist Mono',monospace">${labelA}</div>
                <div class="compare-stat-val a">${m.fmt(m.valA)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:10px;color:#3B82F6;margin-bottom:3px;font-family:'Geist Mono',monospace">${labelB}</div>
                <div class="compare-stat-val b">${m.fmt(m.valB)}</div>
              </div>
            </div>
            <div class="compare-delta ${dClass}">${dText} A vs B</div>
          </div>`;
      }).join('');

      document.getElementById('cmp-summary').innerHTML = html;
      document.getElementById('cmp-summary').style.display = 'grid';
    }

    function renderCompareCharts(aggA, aggB, labelA, labelB, datesA, datesB) {
      const allPlats = [...new Set([
        ...Object.keys(aggA.byPlatform),
        ...Object.keys(aggB.byPlatform)
      ])].sort();

      const salesA = allPlats.map(p => aggA.byPlatform[p]?.sales || 0);
      const salesB = allPlats.map(p => aggB.byPlatform[p]?.sales || 0);
      const roasA  = allPlats.map(p => parseFloat((aggA.byPlatform[p]?.roas || 0).toFixed(2)));
      const roasB  = allPlats.map(p => parseFloat((aggB.byPlatform[p]?.roas || 0).toFixed(2)));

      const baseBar = {
        chart: { type: 'bar', toolbar: { show: false }, background: 'transparent', fontFamily: 'DM Sans, sans-serif', height: 260 },
        theme: { mode: 'dark' },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '65%', grouped: true } },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        xaxis: { categories: allPlats, labels: { style: { colors: '#555', fontSize: '12px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
        legend: { labels: { colors: '#888' }, position: 'top' },
        tooltip: { theme: 'dark' },
        colors: ['#F97316', '#3B82F6'],
      };

      if (cmpChartSales) cmpChartSales.destroy();
      cmpChartSales = new ApexCharts(document.querySelector('#cmp-chart-sales'), {
        ...baseBar,
        series: [{ name: labelA, data: salesA }, { name: labelB, data: salesB }],
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#555' } } },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
      });
      cmpChartSales.render();

      if (cmpChartRoas) cmpChartRoas.destroy();
      cmpChartRoas = new ApexCharts(document.querySelector('#cmp-chart-roas'), {
        ...baseBar,
        series: [{ name: labelA, data: roasA }, { name: labelB, data: roasB }],
        yaxis: { labels: { formatter: v => v > 0 ? v.toFixed(1)+'x' : '--', style: { colors: '#555' } } },
        tooltip: { y: { formatter: v => v > 0 ? v.toFixed(2)+'x' : '--' }, theme: 'dark' },
      });
      cmpChartRoas.render();

      document.getElementById('cmp-bar-wrap').style.display = 'block';

      if (cmpMode === 'week' && datesA && datesB) {
        const dayLabels = ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'];
        function buildDaySeries(agg, startDate) {
          return Array.from({length: 7}, (_, i) => {
            const d = new Date(startDate.start);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split('T')[0];
            return agg.byDate[key] || 0;
          });
        }

        const seriesA = buildDaySeries(aggA, datesA);
        const seriesB = buildDaySeries(aggB, datesB);

        if (cmpChartTrend) cmpChartTrend.destroy();
        cmpChartTrend = new ApexCharts(document.querySelector('#cmp-chart-trend'), {
          series: [{ name: labelA, data: seriesA }, { name: labelB, data: seriesB }],
          chart: { type: 'line', height: 280, toolbar: { show: false }, background: 'transparent', fontFamily: 'DM Sans, sans-serif' },
          theme: { mode: 'dark' },
          colors: ['#F97316', '#3B82F6'],
          stroke: { width: 2.5, curve: 'smooth' },
          markers: { size: 4, strokeWidth: 0 },
          dataLabels: { enabled: false },
          grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
          xaxis: { categories: dayLabels, labels: { style: { colors: '#555' } }, axisBorder: { show: false } },
          yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#555' } } },
          legend: { labels: { colors: '#888' }, position: 'top' },
          tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
        });
        cmpChartTrend.render();
        document.getElementById('cmp-line-wrap').style.display = 'block';
      } else {
        document.getElementById('cmp-line-wrap').style.display = 'none';
      }
    }


    // ─── MULTI-PERIOD (MoM / WoW) RENDERER ─────────────────────────────────────
    let cmpMultiChart = null, cmpDailyChart = null;

    function renderMultiPeriod(periods, modeLabel) {
      if (periods.length === 0) { alert('No periods to compare.'); return; }

      // Summary cards row
      const cols = Math.min(periods.length, 4);
      const html = periods.map((p, i) => {
        const sales = p.agg.total.sales;
        const spends = p.agg.total.spends;
        const roas = p.agg.total.roas;
        const units = p.agg.total.units;

        let growthHtml = '';
        if (i === 0) {
          growthHtml = `<div class="compare-delta neu" style="margin-top:8px">Baseline</div>`;
        } else {
          const prev = periods[i-1].agg.total.sales;
          const d = delta(sales, prev);
          const cls = d === null ? 'neu' : Number(d) >= 0 ? 'pos' : 'neg';
          const txt = d === null ? '--' : (Number(d) >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '%';
          growthHtml = `<div class="compare-delta ${cls}" style="margin-top:8px">${txt} ${modeLabel}</div>`;
        }

        const borderColor = i === 0 ? '#666' : '#F97316';
        return `<div class="compare-stat-card" style="border-top:2px solid ${borderColor}">
          <div class="compare-stat-label">${p.label}</div>
          <div style="margin-top:10px">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">Sales</div>
            <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:var(--text-primary)">${fmt(sales)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--text-muted);font-family:'Geist Mono',monospace">
            <span>ROAS ${roas > 0 ? roas.toFixed(2)+'x' : '--'}</span>
            <span>${fmt(units, false)} units</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);font-family:'Geist Mono',monospace;margin-top:4px">
            Spends ${spends > 0 ? fmt(spends) : '--'}
          </div>
          ${growthHtml}
        </div>`;
      }).join('');

      const wrap = document.getElementById('cmp-multi-summary');
      wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${cols}, 1fr);gap:10px;">${html}</div>`;
      wrap.style.display = 'block';

      // Combo chart: bar (sales) + line (growth %)
      const labels = periods.map(p => p.label);
      const salesData = periods.map(p => Math.round(p.agg.total.sales));
      const growthData = periods.map((p, i) => {
        if (i === 0) return 0;
        const prev = periods[i-1].agg.total.sales;
        return prev > 0 ? parseFloat(((p.agg.total.sales - prev) / prev * 100).toFixed(1)) : 0;
      });

      if (cmpMultiChart) cmpMultiChart.destroy();
      cmpMultiChart = new ApexCharts(document.querySelector('#cmp-multi-chart'), {
        series: [
          { name: 'Sales', type: 'column', data: salesData },
          { name: modeLabel + ' Growth %', type: 'line', data: growthData }
        ],
        chart: { height: 320, toolbar: { show: false }, background: 'transparent', fontFamily: 'DM Sans, sans-serif' },
        theme: { mode: 'dark' },
        colors: ['#F97316', '#3B82F6'],
        stroke: { width: [0, 3], curve: 'smooth' },
        markers: { size: [0, 5] },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        xaxis: { categories: labels, labels: { style: { colors: '#555', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: [
          { labels: { formatter: v => fmt(v), style: { colors: '#555' } }, title: { text: 'Sales (₹)', style: { color: '#555', fontSize: '11px' } } },
          { opposite: true, labels: { formatter: v => v.toFixed(0)+'%', style: { colors: '#3B82F6' } }, title: { text: 'Growth %', style: { color: '#3B82F6', fontSize: '11px' } } }
        ],
        legend: { labels: { colors: '#888' }, position: 'top' },
        tooltip: { theme: 'dark', shared: true, y: [{ formatter: v => fmt(v) }, { formatter: v => v.toFixed(1)+'%' }] },
      });
      cmpMultiChart.render();

      document.getElementById('cmp-multi-chart-title').textContent = `${labels[0]} → ${labels[labels.length-1]} · ${modeLabel} trajectory`;
      document.getElementById('cmp-multi-chart-wrap').style.display = 'block';
    }

    // ─── DAILY BREAKDOWN RENDERER ──────────────────────────────────────────────
    function renderDailyBreakdown(rows, start, end) {
      // Group by date
      const byDate = {};
      rows.forEach(r => {
        const d = String(r.Date).split('T')[0].substring(0,10);
        if (!byDate[d]) byDate[d] = { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 };
        byDate[d].sales  += Number(r.Sales)  || 0;
        byDate[d].spends += Number(r.Spends) || 0;
        byDate[d].units  += Number(r.Units)  || 0;
        const ro = Number(r.ROAS) || 0;
        if (ro > 0) { byDate[d].roasSum += ro; byDate[d].roasCount++; }
      });

      // Build full day array (includes 0-sales days)
      const days = [];
      const cursor = new Date(start);
      cursor.setHours(12,0,0,0);
      while (cursor <= end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth()+1).padStart(2,'0');
        const d = String(cursor.getDate()).padStart(2,'0');
        const key = `${y}-${m}-${d}`;
        const data = byDate[key] || { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 };
        const roas = data.spends > 0 ? (data.sales / data.spends) : (data.roasCount > 0 ? data.roasSum / data.roasCount : 0);
        days.push({ date: key, sales: data.sales, spends: data.spends, units: data.units, roas });
        cursor.setDate(cursor.getDate() + 1);
      }

      // Chart
      const labels = days.map(d => { const p = d.date.split('-'); return p[2]+'/'+p[1]; });
      const sales = days.map(d => d.sales);

      if (cmpDailyChart) cmpDailyChart.destroy();
      cmpDailyChart = new ApexCharts(document.querySelector('#cmp-daily-chart'), {
        series: [{ name: 'Daily Sales', data: sales }],
        chart: { type: 'line', height: 280, toolbar: { show: false }, background: 'transparent', fontFamily: 'DM Sans, sans-serif' },
        theme: { mode: 'dark' },
        colors: ['#F97316'],
        stroke: { width: 2.5, curve: 'smooth' },
        markers: { size: 4, strokeWidth: 0 },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        xaxis: { categories: labels, tickAmount: Math.min(15, labels.length), labels: { style: { colors: '#555', fontSize: '11px' }, rotate: -45, rotateAlways: true }, axisBorder: { show: false } },
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#555' } } },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
      });
      cmpDailyChart.render();

      // Table with DoD %
      const tbody = days.map((d, i) => {
        const prev = i > 0 ? days[i-1].sales : 0;
        const dod = i > 0 && prev > 0 ? ((d.sales - prev) / prev * 100) : null;
        const dodColor = dod === null ? 'var(--text-muted)' : dod >= 0 ? 'var(--green)' : 'var(--red)';
        const dodTxt = dod === null ? '--' : (dod >= 0 ? '▲ ' : '▼ ') + Math.abs(dod).toFixed(1) + '%';
        let dateLabel = d.date;
        try {
          const dt = new Date(d.date + 'T12:00:00');
          dateLabel = dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', weekday:'short' });
        } catch(e) {}
        return `<tr>
          <td style="color:var(--text-primary);font-weight:500;">${dateLabel}</td>
          <td class="right" style="color:var(--text-primary);font-weight:600;">${fmt(d.sales)}</td>
          <td class="right">${d.spends > 0 ? fmt(d.spends) : '--'}</td>
          <td class="right">${d.roas > 0 ? d.roas.toFixed(2)+'x' : '--'}</td>
          <td class="right">${fmt(d.units, false)}</td>
          <td class="right" style="color:${dodColor};font-family:'Geist Mono',monospace;font-size:12px;">${dodTxt}</td>
        </tr>`;
      }).join('');

      document.getElementById('cmp-daily-tbody').innerHTML = tbody || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No data in this range</td></tr>';
      document.getElementById('cmp-daily-count').textContent = days.length + ' days';
      document.getElementById('cmp-daily-title').textContent = `Daily Sales · ${days[0].date} → ${days[days.length-1].date}`;
      document.getElementById('cmp-daily-wrap').style.display = 'block';
    }

    // ─── CHANNEL DETAIL ENGINE ─────────────────────────────────────────────────
    let skuData = [];
    let fy25SKUData = [];
    let detailChartDaily = null, detailChartCat = null;

    // DEFINED GLOBALLY TO AVOID REFERENCE ERRORS
    function getDateBoundaries() {
      const allDates = rawData.map(r => parseLocalDate(r.Date)).filter(d => !isNaN(d));
      const latestDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
      latestDate.setHours(0,0,0,0);
      const t1 = new Date(latestDate);
      const t2 = new Date(latestDate); t2.setDate(t2.getDate() - 1);
      const cutoff7d = new Date(latestDate); cutoff7d.setDate(cutoff7d.getDate() - 7);
      let customSd = new Date(0), customEd = new Date('2999-01-01');
      if (activePeriod === 'custom') {
         const s = document.getElementById('customStart').value;
         const e = document.getElementById('customEnd').value;
         if (s) { customSd = parseLocalDate(s); customSd.setHours(0,0,0,0); }
         if (e) { customEd = parseLocalDate(e); customEd.setHours(0,0,0,0); }
      }
      return { latestDate, t1, t2, cutoff7d, customSd, customEd };
    }

    async function loadSKUData() {
      if (skuData.length > 0) return;
      try {
        const isFY25Month = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
        const url = isFY25Month ? FY25_SKU_URL : SKU_URL;
        const text = await cachedFetchText(url);
        
        if (!text || text.trim() === '') {
          console.warn('⚠️ Empty response for SKU Data.');
          skuData = [];
          return;
        }
        
        let fetchedData = JSON.parse(text);
        
        if (isFY25Month) {
          fetchedData = fetchedData.map(r => ({
            ...r,
            MTDRevenue: Number(r.GMV) || 0,
            MTDUnits:   Number(r.Quantity) || 0,
            EstRevenue: Number(r.GMV) || 0,
          }));
          fy25SKUData = fetchedData;
          console.log('FY25 SKU rows loaded:', fy25SKUData.length);
          return;
        }
        
        const allDates = rawData.map(r => parseLocalDate(r.Date)).filter(d => !isNaN(d));
        const latestDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
        const daysElapsed = latestDate.getDate() || 1;
        
        fetchedData.forEach(r => {
          let trueMtdRev = 0;
          for (let d = 1; d <= 31; d++) { 
            trueMtdRev += Number(r['Day' + d]) || 0; 
          }
          r.MTDRevenue = trueMtdRev;
          
          const m = Number(r.Month);
          const daysInMonth = new Date(2026, m, 0).getDate();
          const currentMonth = latestDate.getMonth() + 1;
          
          if (m === currentMonth) {
            r.EstRevenue = daysElapsed > 0 ? (trueMtdRev / daysElapsed) * daysInMonth : trueMtdRev;
          } else if (m < currentMonth) {
            r.EstRevenue = trueMtdRev;
          } else {
            r.EstRevenue = 0;
          }
        });
        
        skuData = fetchedData;
        console.log('SKU rows loaded:', skuData.length, 'Calendar days elapsed:', daysElapsed);
        
      } catch(e) {
        console.error('SKU fetch failed:', e);
        skuData = [];
      }
    }

    async function loadSKUDailyData() {
      if (skuDailyData.length > 0) return;
      try {
        const text = await cachedFetchText(SKU_DAILY_URL);
        if (!text || text.trim() === '') { console.warn('Empty SKU daily data'); return; }
        skuDailyData = JSON.parse(text);
        console.log('SKU daily rows loaded:', skuDailyData.length);
      } catch(e) {
        console.error('SKU daily fetch failed:', e);
        skuDailyData = [];
      }
    }

    async function openChannelView(platform) {
      _lastSkuRows = [];
      const catFilter = document.getElementById('detail-cat-filter');
      if (catFilter) catFilter.value = 'All';
      document.getElementById('detail-platform-name').textContent = platform;
      const cfg = PLATFORM_CONFIG[platform] || { color: '#888' };
      document.getElementById('detail-platform-name').style.color = cfg.color;

      await loadSKUData();

      const month = activeMonth;
      const isFY25m = month !== 'All' && FY25_MONTHS.has(month);
      const skuSrc = isFY25m ? fy25SKUData : skuData;
      const [selYear, selMonth] = month !== 'All' ? month.split('-').map(Number) : [null, null];
      const filtered = skuSrc.filter(r => {
        const mMatch = month === 'All' || Number(r.Month) === selMonth;
        return mMatch && String(r.Platform) === platform;
      });

      const omsFiltered = getFilteredData().filter(r => String(r.Platform) === platform);

      renderChannelKPIs(filtered, omsFiltered, platform);
      renderChannelDailyChart(omsFiltered);
      renderChannelCatDonut(filtered, cfg.color);
      renderChannelSKUTable(filtered);
    }

    function renderChannelKPIs(skuRows, omsRows, platform) {
      const totalSales  = omsRows.reduce((s, r) => s + (Number(r.Sales)  || 0), 0);
      const totalUnits  = omsRows.reduce((s, r) => s + (Number(r.Units)  || 0), 0);
      const totalSpends = omsRows.reduce((s, r) => s + (Number(r.Spends) || 0), 0);
      const roas = totalSpends > 0 ? (totalSales / totalSpends) : 0;
      const isFY25m = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const isCurrentMonth = activeMonth === currentMonthKey;
      const totalEstRev = isCurrentMonth
        ? skuRows.reduce((s, r) => s + (Number(r.EstRevenue) || Number(r.GMV) || 0), 0)
        : totalSales;
      const cfg = PLATFORM_CONFIG[platform] || { color: '#888' };
      const pLabels = { t1:'T-1 Revenue', t2:'T-2 Revenue', '7d':'7-Day Revenue', mtd:'MTD Revenue', custom:'Revenue', all:'Revenue' };
      const revLabel = pLabels[activePeriod] || 'Revenue';
      const asp = totalSales > 0 && totalUnits > 0 ? (totalSales / totalUnits).toFixed(0) : '--';

      const badge = document.getElementById('detail-roas-badge');
      badge.textContent = roas > 0 ? 'ROAS ' + roas.toFixed(2) + 'x' : 'ROAS --';
      badge.className = 'platform-roas-badge ' + (roas >= 2 ? 'good' : roas > 0 ? 'ok' : '');

      document.getElementById('detail-kpi-grid').innerHTML = `
        <div class="kpi-card" style="--accent:${cfg.color}">
          <div class="kpi-label">${revLabel}</div>
          <div class="kpi-value">${fmt(totalSales)}</div>
          <div class="kpi-sub neutral">ASP ₹${asp}</div>
        </div>
        <div class="kpi-card" style="--accent:var(--green)">
          <div class="kpi-label">ROAS</div>
          <div class="kpi-value">${roas > 0 ? roas.toFixed(2)+'x' : '--'}</div>
          <div class="kpi-sub ${roas >= 2 ? 'positive' : 'neutral'}">${roas >= 2 ? '▲ Healthy' : roas > 0 ? '△ Monitor' : 'No spends tracked'}</div>
        </div>
        <div class="kpi-card" style="--accent:var(--blue)">
          <div class="kpi-label">Units Sold</div>
          <div class="kpi-value">${fmt(totalUnits, false)}</div>
          <div class="kpi-sub neutral">${omsRows.length} days of data</div>
        </div>
        <div class="kpi-card" style="--accent:var(--purple)">
          <div class="kpi-label">Est. Revenue</div>
          <div class="kpi-value">${fmt(totalEstRev)}</div>
          <div class="kpi-sub neutral">${isCurrentMonth ? 'Full month projection' : 'Full month actuals'}</div>
        </div>
      `;
    }

    function renderChannelDailyChart(omsRows) {
      const dateMap = {};
      omsRows.forEach(r => {
        const d = String(r.Date).split('T')[0].substring(0, 10);
        dateMap[d] = (dateMap[d] || 0) + (Number(r.Sales) || 0);
      });
      const sortedDates = Object.keys(dateMap).sort();
      const labels = sortedDates.map(d => {
        const parts = d.split('-');
        return parts.length === 3 ? parts[2] + '/' + parts[1] : d;
      });
      const values = sortedDates.map(d => dateMap[d]);
      
      // Calculate Day-over-Day (DoD) growth percentage
      const growths = values.map((v, i) => i === 0 ? null : (values[i-1] > 0 ? ((v - values[i-1]) / values[i-1] * 100) : 0));

      if (detailChartDaily) detailChartDaily.destroy();
      detailChartDaily = new ApexCharts(document.querySelector('#detail-chart-daily'), {
        series: [{ name: 'Sales', data: values }],
        chart: { type: 'area', height: 260, toolbar: { show: false }, background: 'transparent', fontFamily: 'Space Grotesk, sans-serif' },
        theme: { mode: 'dark' },
        colors: ['#F97316'],
        stroke: { width: 2.5, curve: 'smooth' },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            type: 'vertical',
            opacityFrom: 0.4,
            opacityTo: 0.02,
            stops: [0, 100]
          }
        },
        markers: { size: 4, strokeWidth: 0, colors: ['#F97316'] },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        xaxis: { categories: labels, tickAmount: 10, labels: { style: { colors: '#555', fontSize: '11px' }, rotate: -45, rotateAlways: true }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#555', fontSize: '11px' } } },
        tooltip: {
          theme: 'dark',
          custom: function({series, seriesIndex, dataPointIndex, w}) {
            const sales = series[seriesIndex][dataPointIndex];
            const g = growths[dataPointIndex];
            const label = w.globals.labels[dataPointIndex];
            const gStr = g === null ? '' : g >= 0
              ? `<div style="color:#22c55e;font-family:'Geist Mono',monospace;font-size:11px;margin-top:2px">↑ ${g.toFixed(1)}% DoD</div>`
              : `<div style="color:#ef4444;font-family:'Geist Mono',monospace;font-size:11px;margin-top:2px">↓ ${Math.abs(g).toFixed(1)}% DoD</div>`;
            return `<div style="padding:8px 12px;background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:6px">
                      <div style="color:#f1f5f9;font-weight:600;font-size:12px">${label}</div>
                      <div style="color:#F97316;font-family:'Geist Mono',monospace;font-size:13px;margin-top:4px">Sales: ${fmt(sales)}</div>
                      ${gStr}
                    </div>`;
          }
        }
      });
      detailChartDaily.render();
    }

    function renderChannelCatDonut(skuRows, color) {
      const catMap = {};
      skuRows.forEach(r => {
        const cat = String(r.Category || 'Others');
        catMap[cat] = (catMap[cat] || 0) + (Number(r.MTDRevenue) || 0);
      });
      const labels = Object.keys(catMap);
      const values = labels.map(k => catMap[k]);
      const CAT_COLORS = { 'Ragi Chips': '#F97316', 'Dipsters': '#A855F7', 'Puffs': '#22C55E', 'Others': '#3B82F6' };
      const colors = labels.map(l => CAT_COLORS[l] || '#888');

      if (detailChartCat) detailChartCat.destroy();
      detailChartCat = new ApexCharts(document.querySelector('#detail-chart-cat'), {
        series: values,
        labels: labels,
        chart: { type: 'donut', height: 260, background: 'transparent', fontFamily: 'Space Grotesk, sans-serif' },
        theme: { mode: 'dark' },
        colors: colors,
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            type: 'diagonal2',
            shadeIntensity: 0.6,
            gradientToColors: colors.map(c => gradTo(c)),
            inverseColors: false,
            opacityFrom: 1,
            opacityTo: 0.85,
            stops: [0, 100]
          }
        },
        stroke: { show: true, colors: ['#0a0e1a'], width: 3 },
        dataLabels: {
          enabled: true,
          style: { fontSize: '12px', fontWeight: 600, fontFamily: 'Space Grotesk' },
          dropShadow: { enabled: false },
          formatter: (val) => val.toFixed(1) + '%'
        },
        legend: {
          position: 'bottom',
          labels: { colors: '#9ca3b3' },
          fontSize: '12px',
          fontFamily: 'Space Grotesk',
          markers: { width: 8, height: 8, radius: 8 },
          itemMargin: { horizontal: 10, vertical: 4 }
        },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
        plotOptions: {
          pie: {
            donut: {
              size: '68%',
              labels: {
                show: true,
                name: { show: true, fontSize: '11px', color: '#6b7280', offsetY: -4, fontFamily: 'Geist Mono' },
                value: { show: true, fontSize: '20px', color: '#fff', fontWeight: 500, offsetY: 6, fontFamily: 'Space Grotesk', formatter: v => fmt(parseFloat(v)) },
                total: { show: true, label: 'Total', color: '#6b7280', fontSize: '11px', fontFamily: 'Geist Mono', formatter: (w) => fmt(w.globals.seriesTotals.reduce((a,b)=>a+b,0)) }
              }
            }
          }
        }
      });
      detailChartCat.render();
    }

    let _lastSkuRows = [];

    function applyDetailCatFilter() {
      const val = document.getElementById('detail-cat-filter').value;
      if (val === '__summary__') {
        document.getElementById('detail-table-title').textContent = 'Category Totals';
        document.getElementById('detail-sku-thead').innerHTML = `<tr>
          <th>Category</th>
          <th class="right">Est. Revenue</th><th class="right">MTD Revenue</th>
          <th class="right">MTD Units</th><th class="right">% of Total</th>
        </tr>`;
        renderChannelCategoryTable(_lastSkuRows);
      } else {
        document.getElementById('detail-table-title').textContent = val === 'All' ? 'Top SKUs by MTD Revenue' : `${val} — SKUs`;
        document.getElementById('detail-sku-thead').innerHTML = `<tr>
          <th>SKU</th><th>Category</th>
          <th class="right">Est. Revenue</th><th class="right">MTD Revenue</th>
          <th class="right">MTD Units</th><th class="right">% of Total</th>
        </tr>`;
        const filtered = val === 'All' ? _lastSkuRows : _lastSkuRows.filter(r => String(r.Category) === val);
        renderChannelSKUTable(filtered, true);
      }
    }
    function renderChannelCategoryTable(skuRows) {
      const CAT_COLORS = {
        'Ragi Chips': 'background:rgba(249,115,22,0.15);color:#F97316',
        'Dipsters':   'background:rgba(168,85,247,0.15);color:#A855F7',
        'Puffs':      'background:rgba(34,197,94,0.15);color:#22C55E',
        'Others':     'background:rgba(59,130,246,0.15);color:#3B82F6'
      };
      const catMap = {};
      skuRows.forEach(r => {
        const cat = String(r.Category || 'Others');
        if (!catMap[cat]) catMap[cat] = { rev: 0, units: 0, est: 0 };
        catMap[cat].rev   += Number(r.MTDRevenue)  || 0;
        catMap[cat].units += Number(r.MTDUnits)    || 0;
        catMap[cat].est   += Number(r.EstRevenue)  || 0;
      });
      const totalRev = Object.values(catMap).reduce((s, c) => s + c.rev, 0);
      const sorted = Object.entries(catMap).sort((a, b) => b[1].rev - a[1].rev);

      const rows = sorted.map(([cat, d]) => {
        const pct = totalRev > 0 ? (d.rev / totalRev * 100) : 0;
        const catStyle = CAT_COLORS[cat] || 'background:rgba(255,255,255,0.05);color:#888';
        return `<tr>
          <td><span class="cat-badge" style="${catStyle}">${cat}</span></td>
          <td class="right" style="color:var(--text-muted)">${fmt(d.est)}</td>
          <td class="right" style="color:var(--text-primary);font-weight:600">${fmt(d.rev)}</td>
          <td class="right">${fmt(d.units, false)}</td>
          <td class="right">
            <div class="pct-bar-wrap">
              <div class="pct-bar-bg"><div class="pct-bar-fill" style="width:${Math.min(100,pct).toFixed(1)}%"></div></div>
              <span style="font-family:'Geist Mono',monospace;font-size:11px;color:var(--text-muted);min-width:36px">${pct.toFixed(1)}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');

      // Grand total row
      const grandEst   = Object.values(catMap).reduce((s, c) => s + c.est,   0);
      const grandUnits = Object.values(catMap).reduce((s, c) => s + c.units, 0);
      const totalRow = `<tr style="border-top:1px solid var(--border-hover)">
        <td style="color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Total</td>
        <td class="right" style="color:var(--text-muted);font-weight:600">${fmt(grandEst)}</td>
        <td class="right" style="color:var(--text-primary);font-weight:700">${fmt(totalRev)}</td>
        <td class="right" style="font-weight:600">${fmt(grandUnits, false)}</td>
        <td class="right" style="color:var(--text-muted);font-family:'Geist Mono',monospace;font-size:11px">100%</td>
      </tr>`;

      document.getElementById('detail-sku-tbody').innerHTML = rows + totalRow ||
        '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">No data</td></tr>';
    }

function renderChannelSKUTable(skuRows, skipCache = false) {
      if (!skipCache) _lastSkuRows = skuRows;
      const sorted = [...skuRows].sort((a, b) => (Number(b.MTDRevenue)||0) - (Number(a.MTDRevenue)||0));
      const totalRev = sorted.reduce((s, r) => s + (Number(r.MTDRevenue)||0), 0);
      const CAT_COLORS = {
        'Ragi Chips': 'background:rgba(249,115,22,0.15);color:#F97316',
        'Dipsters':   'background:rgba(168,85,247,0.15);color:#A855F7',
        'Puffs':      'background:rgba(34,197,94,0.15);color:#22C55E',
        'Others':     'background:rgba(59,130,246,0.15);color:#3B82F6'
      };

      const rows = sorted.map((r, i) => {
        const rev    = Number(r.MTDRevenue) || 0;
        const units  = Number(r.MTDUnits)   || 0;
        const est    = Number(r.EstRevenue) || 0;
        const pct    = totalRev > 0 ? (rev / totalRev * 100) : 0;
        const catStyle = CAT_COLORS[r.Category] || 'background:rgba(255,255,255,0.05);color:#888';

        return `<tr>
          <td><span class="sku-rank">${i+1}</span><span class="sku-name-cell">${r.SKU}</span></td>
          <td><span class="cat-badge" style="${catStyle}">${r.Category}</span></td>
          <td class="right">${fmt(est)}</td>
          <td class="right" style="color:var(--text-primary);font-weight:600">${fmt(rev)}</td>
          <td class="right">${fmt(units, false)}</td>
          <td class="right">
            <div class="pct-bar-wrap">
              <div class="pct-bar-bg"><div class="pct-bar-fill" style="width:${Math.min(100,pct).toFixed(1)}%"></div></div>
              <span style="font-family:'Geist Mono',monospace;font-size:11px;color:var(--text-muted);min-width:36px">${pct.toFixed(1)}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');

      document.getElementById('detail-sku-tbody').innerHTML = rows ||
        '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No SKU data for this platform/month</td></tr>';
    }


    // ─── SKU VIEW ENGINE ───────────────────────────────────────────────────────
    let activeSKUCat = 'All';
    let skuDetailChart1 = null, skuDetailChart2 = null;
    const CAT_COLORS = {
      'Ragi Chips': { bg:'rgba(249,115,22,0.15)', text:'#F97316' },
      'Dipsters':   { bg:'rgba(168,85,247,0.15)', text:'#A855F7' },
      'Puffs':      { bg:'rgba(34,197,94,0.15)',  text:'#22C55E' },
      'Others':     { bg:'rgba(59,130,246,0.15)', text:'#3B82F6' },
    };
    
    function setSKUCat(cat) {
      activeSKUCat = cat;
      ['All','Ragi Chips','Dipsters','Puffs','Others'].forEach(c => {
        const btn = document.getElementById('skucat-' + c);
        if (btn) btn.classList.toggle('active', c === cat);
      });
      renderSKUView();
    }

  function getSKUViewData() {
      const month = activeMonth;
      const [selYear, selMonth] = month !== 'All' ? month.split('-').map(Number) : [null, null];
      const platFilter = document.getElementById('skuPlatFilter')?.value || 'All';
      const search = (document.getElementById('skuSearch')?.value || '').toLowerCase();
      const bounds = getDateBoundaries();
      const isFY25m = month !== 'All' && FY25_MONTHS.has(month);
      const srcData = isFY25m ? fy25SKUData : skuData;
      let rows = srcData.filter(r => {    
      const mMatch = month === 'All' || (Number(r.Month) === selMonth && (Number(r.Year) === selYear || !r.Year));
     const pMatch = platFilter === 'All' || String(r.Platform) === platFilter;
    const cMatch = activeSKUCat === 'All' || String(r.Category) === activeSKUCat;
    const sMatch = !search || String(r.SKU).toLowerCase().includes(search);
   return mMatch && pMatch && cMatch && sMatch;
  });
    const aggMap = {};
      rows.forEach(r => {
        const key = String(r.SKU);
        if (!aggMap[key]) {
          aggMap[key] = { sku: key, category: String(r.Category), mtdRev: 0, mtdUnits: 0, estRev: 0, platforms: {}, days: Array(31).fill(0) };
        }

        let calculatedRev = 0;
        const p = String(r.Platform);

        if (isFY25m) {
          // FY25 SKU data has GMV/Quantity directly — no Day columns
          calculatedRev = Number(r.MTDRevenue) || Number(r.GMV) || 0;
          aggMap[key].mtdUnits += Number(r.MTDUnits) || Number(r.Quantity) || 0;
          aggMap[key].estRev   += calculatedRev;
        } else {
          const rowMonth = parseInt(r.Month, 10);
          for (let d = 1; d <= 31; d++) {
            const val = Number(r['Day' + d]) || 0;
            if (val > 0) {
              const cellDate = new Date(2026, rowMonth - 1, d);
              cellDate.setHours(0,0,0,0);
              let dateMatch = false;
              if (activePeriod === 'mtd') dateMatch = true;
              else if (activePeriod === 't1') dateMatch = cellDate.getTime() === bounds.t1.getTime();
              else if (activePeriod === 't2') dateMatch = cellDate.getTime() === bounds.t2.getTime();
              else if (activePeriod === '7d') dateMatch = cellDate > bounds.cutoff7d && cellDate <= bounds.latestDate;
              else if (activePeriod === 'custom') dateMatch = cellDate >= bounds.customSd && cellDate <= bounds.customEd;
              if (dateMatch) calculatedRev += val;
            }
          }
          aggMap[key].mtdUnits += Number(r.MTDUnits) || 0;
          aggMap[key].estRev   += Number(r.EstRevenue) || 0;
          for (let d = 0; d < 31; d++) {
            aggMap[key].days[d] += Number(r['Day' + (d+1)]) || 0;
          }
        }

        aggMap[key].mtdRev += calculatedRev;
        aggMap[key].platforms[p] = (aggMap[key].platforms[p] || 0) + calculatedRev;
      });
      
      return Object.values(aggMap).sort((a, b) => b.mtdRev - a.mtdRev);
    }

      function renderSKUView() {
      const isFY25m = activeMonth !== 'All' && FY25_MONTHS.has(activeMonth);
      const activeSKUSrc = isFY25m ? fy25SKUData : skuData;
      if (activeSKUSrc.length === 0) return;
      const data = getSKUViewData();
      const totalRev = data.reduce((s, r) => s + r.mtdRev, 0);
      const isCurrentMonth = activeMonth === '2026-07';
      const totalEstRev = isCurrentMonth
        ? data.reduce((s, r) => s + (r.estRev || 0), 0)
        : totalRev;
      const totalUnits = data.reduce((s, r) => s + r.mtdUnits, 0);

      const pLabels = { t1:'T-1', t2:'T-2', '7d':'7-Day', mtd:'MTD', custom:'Selected' };
      const revLabel = pLabels[activePeriod] ? pLabels[activePeriod] + ' Revenue' : 'Revenue';

      // KPI cards
      const topSKU = data[0] || {};
      document.getElementById('sku-kpi-grid').innerHTML = `
        <div class="kpi-card" style="--accent:var(--orange)">
          <div class="kpi-label">${revLabel}</div>
          <div class="kpi-value">${fmt(totalRev)}</div>
          <div class="kpi-sub neutral">${data.length} SKUs</div>
        </div>
        <div class="kpi-card" style="--accent:var(--blue)">
          <div class="kpi-label">Total Units (MTD)</div>
          <div class="kpi-value">${fmt(totalUnits, false)}</div>
          <div class="kpi-sub neutral">ASP ₹${totalUnits > 0 ? (totalRev/totalUnits).toFixed(0) : '--'}</div>
        </div>
        <div class="kpi-card" style="--accent:var(--purple)">
          <div class="kpi-label">Top Category</div>
          <div class="kpi-value" style="font-size:18px">${getTopCategory(data)}</div>
          <div class="kpi-sub neutral">by revenue</div>
        </div>
      `;
      // Update count label
      document.getElementById('sku-count-label').textContent = data.length + ' SKUs';

      // Leaderboard table
      if (data.length === 0) {
        document.getElementById('sku-leaderboard-body').innerHTML =
          '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">No SKUs match the current filters</td></tr>';
        return;
      }

      const rows = data.map((r, i) => {
        const pct = totalRev > 0 ? (r.mtdRev / totalRev * 100) : 0;
        const catStyle = CAT_COLORS[r.category] || { bg:'rgba(255,255,255,0.05)', text:'#888' };
        const platBadges = Object.keys(r.platforms).map(p =>
          `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-family:'Geist Mono',monospace;background:rgba(255,255,255,0.05);color:${PLAT_COLORS[p]||'#888'};margin-right:3px">${p}</span>`
        ).join('');
        return `<tr style="cursor:pointer" onclick="openSKUDetail('${r.sku.replace(/'/g,"\\'")}')">
          <td style="color:var(--text-muted);font-family:'Geist Mono',monospace;font-size:11px">${i+1}</td>
          <td class="sku-name-cell">${r.sku}</td>
          <td><span class="cat-badge" style="background:${catStyle.bg};color:${catStyle.text}">${r.category}</span></td>
          <td class="right" style="color:var(--text-primary);font-weight:600">${fmt(r.mtdRev)}</td>
          <td class="right">${fmt(r.mtdUnits, false)}</td>
          <td class="right" style="color:var(--text-muted)">${fmt(r.estRev)}</td>
          <td class="right">
            <div class="pct-bar-wrap">
              <div class="pct-bar-bg"><div class="pct-bar-fill" style="width:${Math.min(100,pct).toFixed(1)}%;background:${catStyle.text}"></div></div>
              <span style="font-family:'Geist Mono',monospace;font-size:11px;color:var(--text-muted);min-width:36px">${pct.toFixed(1)}%</span>
            </div>
          </td>
          <td>${platBadges}</td>
        </tr>`;
      }).join('');

      document.getElementById('sku-leaderboard-body').innerHTML = rows;
    }

    function getTopCategory(data) {
      const catMap = {};
      data.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.mtdRev; });
      return Object.keys(catMap).sort((a,b) => catMap[b] - catMap[a])[0] || '--';
    }

    function openSKUDetail(skuName) {
      const month = activeMonth;
      const allRows = skuData.filter(r => {
        const mMatch = month === 'All' || Number(r.Month) === parseInt(month, 10);
        return mMatch && String(r.SKU) === skuName;
      });

      if (allRows.length === 0) return;
      const category = allRows[0].Category;
      const catStyle = CAT_COLORS[category] || { bg:'rgba(255,255,255,0.05)', text:'#888' };

      document.getElementById('sku-leaderboard-wrap').style.display = 'none';
      document.getElementById('sku-detail-panel').style.display = 'block';
      document.getElementById('sku-detail-name').textContent = skuName;
      const catBadge = document.getElementById('sku-detail-cat');
      catBadge.textContent = category;
      catBadge.style.background = catStyle.bg;
      catBadge.style.color = catStyle.text;

      const bounds = getDateBoundaries();

      const platData = {};
      allRows.forEach(r => {
        const p = String(r.Platform);
        if (!platData[p]) platData[p] = { mtdRev: 0, mtdUnits: 0, days: Array(31).fill(0) };

        let calculatedRev = 0;
        const rowMonth = parseInt(r.Month, 10);
        for (let d = 1; d <= 31; d++) {
            const val = Number(r['Day' + d]) || 0;
            if (val > 0) {
                platData[p].days[d-1] += val; 
                
                const cellDate = new Date(2026, rowMonth - 1, d);
                cellDate.setHours(0,0,0,0);
                let dateMatch = false;
                if (activePeriod === 'mtd') dateMatch = true;
                else if (activePeriod === 't1') dateMatch = cellDate.getTime() === bounds.t1.getTime();
                else if (activePeriod === 't2') dateMatch = cellDate.getTime() === bounds.t2.getTime();
                else if (activePeriod === '7d') dateMatch = cellDate > bounds.cutoff7d && cellDate <= bounds.latestDate;
                else if (activePeriod === 'custom') dateMatch = cellDate >= bounds.customSd && cellDate <= bounds.customEd;

                if (dateMatch) calculatedRev += val;
            }
        }

        platData[p].mtdRev   += calculatedRev;
        platData[p].mtdUnits += Number(r.MTDUnits)   || 0;
      });

      const platCards = Object.keys(platData).map(p => {
        const d = platData[p];
        const asp = d.mtdUnits > 0 ? (d.mtdRev / d.mtdUnits).toFixed(0) : '--';
        return `<div class="kpi-card" style="--accent:${PLAT_COLORS[p]||'#888'}">
          <div class="kpi-label">${p}</div>
          <div class="kpi-value" style="font-size:22px">${fmt(d.mtdRev)}</div>
          <div class="kpi-sub neutral">${fmt(d.mtdUnits,false)} units · ASP ₹${asp}</div>
        </div>`;
      }).join('');
      document.getElementById('sku-platform-cards').innerHTML = platCards;

      const platNames = Object.keys(platData);
      const platRevs  = platNames.map(p => platData[p].mtdRev);
      const platCols  = platNames.map(p => PLAT_COLORS[p] || '#888');

      if (skuDetailChart1) skuDetailChart1.destroy();
      skuDetailChart1 = new ApexCharts(document.querySelector('#sku-chart-platform'), {
        series: [{ name: 'Revenue', data: platRevs }],
        chart: { type: 'bar', height: 240, toolbar: { show: false }, background: 'transparent', fontFamily: 'DM Sans, sans-serif' },
        theme: { mode: 'dark' },
        colors: platCols,
        plotOptions: { bar: { borderRadius: 5, columnWidth: '50%', distributed: true } },
        dataLabels: { enabled: false },
        legend: { show: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        xaxis: { categories: platNames, labels: { style: { colors: '#555' } }, axisBorder: { show: false } },
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#555' } } },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
      });
      skuDetailChart1.render();

      const dayLabels = Array.from({length:31}, (_,i) => 'D'+(i+1));
      const series = Object.keys(platData).map(p => ({
        name: p,
        data: platData[p].days
      }));
      const lineColors = Object.keys(platData).map(p => PLAT_COLORS[p] || '#888');

      if (skuDetailChart2) skuDetailChart2.destroy();
      skuDetailChart2 = new ApexCharts(document.querySelector('#sku-chart-trend'), {
        series: series,
        chart: { type: 'line', height: 240, toolbar: { show: false }, background: 'transparent', fontFamily: 'DM Sans, sans-serif' },
        theme: { mode: 'dark' },
        colors: lineColors,
        stroke: { width: 2, curve: 'smooth' },
        markers: { size: 0 },
        dataLabels: { enabled: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        xaxis: { categories: dayLabels, tickAmount: 10, labels: { style: { colors: '#555', fontSize:'10px' } }, axisBorder: { show: false } },
        yaxis: { labels: { formatter: v => fmt(v), style: { colors: '#555' } } },
        legend: { labels: { colors: '#888' }, position: 'top' },
        tooltip: { y: { formatter: v => fmt(v) }, theme: 'dark' },
      });
      skuDetailChart2.render();
    }

    function closeSKUDetail() {
      document.getElementById('sku-leaderboard-wrap').style.display = 'block';
      document.getElementById('sku-detail-panel').style.display = 'none';
      if (skuDetailChart1) { skuDetailChart1.destroy(); skuDetailChart1 = null; }
      if (skuDetailChart2) { skuDetailChart2.destroy(); skuDetailChart2 = null; }
    }

    // ─── SKU COMPARE ENGINE ────────────────────────────────────────────────────
    let skucmpChartPlatform = null, skucmpChartUnits = null, skucmpChartTrend = null;

    function initSKUCompare() {
      ['a','b'].forEach(side => {
        const list = document.getElementById('skucmp-' + side + '-list');
        const skuNames = [...new Set([...skuData, ...fy25SKUData].map(r => String(r.SKU)))].filter(Boolean).sort();
        list.innerHTML = skuNames.length > 0 ? skuNames.map(s =>
          `<div onclick="selectSKU('${side}','${s.replace(/'/g,"\\'")}')"
            style="padding:8px 12px;font-size:12px;color:var(--text-secondary);cursor:pointer;border-bottom:1px solid var(--border);"
            onmouseover="this.style.background='rgba(255,255,255,0.04)'"
            onmouseout="this.style.background='transparent'">${s}</div>`
        ).join('') : '<div style="padding:12px;font-size:12px;color:var(--text-muted)">Loading SKUs — select a month first</div>';
      });
    }

    function selectSKU(side, name) {
      document.getElementById('skucmp-' + side + '-search').value = name;
      document.getElementById('skucmp-' + side + '-value').value  = name;
      hideSKUDropdown(side);
    }

    function showSKUDropdown(side) {
      document.getElementById('skucmp-' + side + '-dropdown').style.display = 'block';
    }
    function hideSKUDropdown(side) {
      document.getElementById('skucmp-' + side + '-dropdown').style.display = 'none';
    }
    function filterSKUDropdown(side) {
      const q = document.getElementById('skucmp-' + side + '-search').value.toLowerCase();
      document.getElementById('skucmp-' + side + '-value').value = '';
      showSKUDropdown(side);
      const items = document.getElementById('skucmp-' + side + '-list').querySelectorAll('div');
      items.forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? 'block' : 'none';
      });
    }

   const skucmpPeriod = { a: 'mtd', b: 'mtd' };

    function populateSKUCmpMonths() {
      ['a','b'].forEach(side => {
        const sel = document.getElementById('skucmp-' + side + '-month');
        if (!sel) return;
        const fy26months = ['2026-08','2026-07','2026-06','2026-05','2026-04'];
        const fy25months = ['2025-03','2025-02','2025-01','2024-12','2024-11','2024-10','2024-09','2024-08','2024-07','2024-06','2024-05','2024-04'];
        const monthLabel = m => {
          const [y,mo] = m.split('-');
          const mn = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return mn[parseInt(mo)] + ' ' + y;
        };
        sel.innerHTML = [...fy26months,...fy25months].map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
        onSKUCmpMonthChange(side);
      });
    }

    
    function onSKUCmpMonthChange(side) {
      const m = document.getElementById('skucmp-' + side + '-month').value;
      const isFY25 = FY25_MONTHS.has(m);
      document.getElementById('skucmp-' + side + '-period-wrap').style.opacity = isFY25 ? '0.35' : '1';
      document.getElementById('skucmp-' + side + '-period-wrap').style.pointerEvents = isFY25 ? 'none' : 'auto';
      document.getElementById('skucmp-' + side + '-fy25-notice').style.display = isFY25 ? 'block' : 'none';
      if (isFY25) {
        preloadFY25SKUData().then(() => initSKUCompare());
      } else {
        loadSKUData().then(() => initSKUCompare());
      }
    }
    function setSKUCmpPeriod(side, p) {
      skucmpPeriod[side] = p;
      ['mtd','7d','t1','custom'].forEach(k => {
        const btn = document.getElementById('skucmp-' + side + '-period-' + k);
        if (btn) btn.classList.toggle('active', k === p);
      });
      const cw = document.getElementById('skucmp-' + side + '-custom-wrap');
      if (cw) cw.style.display = p === 'custom' ? 'grid' : 'none';
    }

    function getSKUSlotData(side) {
      const skuName  = document.getElementById('skucmp-' + side + '-value').value;
      const platform = document.getElementById('skucmp-' + side + '-platform').value;
      const month    = document.getElementById('skucmp-' + side + '-month').value;
      const period   = skucmpPeriod[side];
      if (!skuName || !month) return null;

      const isFY25 = FY25_MONTHS.has(month);
      const [selYear, selMonth] = month.split('-').map(Number);

      const byPlatform = {};
      let totalRev = 0, totalUnits = 0;
      const daysMap = {};

      if (isFY25) {
        // FY25 — read from fy25SKUData monthly aggregates
        const rows = fy25SKUData.filter(r =>
          String(r.SKU) === skuName &&
          Number(r.Month) === selMonth &&
          (platform === 'All' || String(r.Platform) === platform)
        );
        rows.forEach(r => {
          const p = String(r.Platform);
          const rev = Number(r.GMV) || Number(r.MTDRevenue) || 0;
          const units = Number(r.Quantity) || Number(r.MTDUnits) || 0;
          if (!byPlatform[p]) byPlatform[p] = {rev:0,units:0};
          byPlatform[p].rev += rev;
          byPlatform[p].units += units;
          totalRev += rev;
          totalUnits += units;
        });
        return { skuName, platform, month, period:'full', isFY25:true, totalRev, totalUnits, totalEst:totalRev, byPlatform, days:[] };
      }

      // FY26 — use skuDailyData with period filter
      const allDates = skuDailyData.filter(r => String(r.SKU) === skuName).map(r => parseLocalDate(r.Date)).filter(d => !isNaN(d));
      const latestDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
      latestDate.setHours(0,0,0,0);
      const t1 = new Date(latestDate);
      const t2 = new Date(latestDate); t2.setDate(t2.getDate()-1);

      let start, end;
      if (period === 'mtd') {
        start = new Date(selYear, selMonth-1, 1);
        end = latestDate;
      } else if (period === 't1') {
        start = end = t1;
      } else if (period === '7d') {
        end = latestDate;
        start = new Date(latestDate); start.setDate(start.getDate()-6);
      } else if (period === 'custom') {
        const s = document.getElementById('skucmp-'+side+'-start').value;
        const e = document.getElementById('skucmp-'+side+'-end').value;
        if (!s || !e) return null;
        start = parseLocalDate(s); end = parseLocalDate(e);
      } else {
        start = new Date(selYear, selMonth-1, 1); end = latestDate;
      }
      start.setHours(0,0,0,0); end.setHours(23,59,59,999);

      skuDailyData.forEach(r => {
        const rowDate = parseLocalDate(r.Date);
        if (rowDate < start || rowDate > end) return;
        if (platform !== 'All' && String(r.Platform) !== platform) return;
        if (String(r.SKU) !== skuName) return;
        const p = String(r.Platform);
        const rev = Number(r.GMV) || 0;
        const units = Number(r.Units) || 0;
        if (!byPlatform[p]) byPlatform[p] = {rev:0,units:0};
        byPlatform[p].rev += rev; byPlatform[p].units += units;
        totalRev += rev; totalUnits += units;
        const y = rowDate.getFullYear(), mo = String(rowDate.getMonth()+1).padStart(2,'0'), d = String(rowDate.getDate()).padStart(2,'0');
        const dk = `${y}-${mo}-${d}`;
        daysMap[dk] = (daysMap[dk]||0) + rev;
      });

      const daysArray = [];
      const cur = new Date(start); cur.setHours(12,0,0,0);
      while (cur <= end) {
        const y=cur.getFullYear(), mo=String(cur.getMonth()+1).padStart(2,'0'), d=String(cur.getDate()).padStart(2,'0');
        daysArray.push(daysMap[`${y}-${mo}-${d}`]||0);
        cur.setDate(cur.getDate()+1);
      }
      const daysInRange = daysArray.length;
      const totalEst = daysInRange > 0 ? (totalRev/daysInRange)*30 : 0;
      return { skuName, platform, month, period, isFY25:false, totalRev, totalUnits, totalEst, byPlatform, days:daysArray };
    }

  
    function runSKUCompare() {
      const a = getSKUSlotData('a');
      const b = getSKUSlotData('b');
      if (!a || !b) { alert('Fill in both SKUs and months for both sides.'); return; }

      document.getElementById('skucmp-no-data').style.display  = 'none';
      document.getElementById('skucmp-results').style.display  = 'block';

      // KPI cards
      const metrics = [
        { label:'MTD Revenue',  valA: fmt(a.totalRev),          valB: fmt(b.totalRev),          raw: [a.totalRev, b.totalRev] },
        { label:'Units',        valA: fmt(a.totalUnits,false),   valB: fmt(b.totalUnits,false),   raw: [a.totalUnits, b.totalUnits] },
        { label:'ASP',          valA: a.totalUnits>0?'₹'+(a.totalRev/a.totalUnits).toFixed(0):'--', valB: b.totalUnits>0?'₹'+(b.totalRev/b.totalUnits).toFixed(0):'--', raw:null },
        { label:'Platform Forecast', valA: fmt(a.totalEst),     valB: fmt(b.totalEst),           raw: [a.totalEst, b.totalEst] },
      ];

      document.getElementById('skucmp-kpi-grid').innerHTML = metrics.map(m => {
        let deltaHtml = '';
        if (m.raw && m.raw[1] > 0) {
          const d = ((m.raw[0] - m.raw[1]) / m.raw[1] * 100).toFixed(1);
          const cls = Number(d) >= 0 ? 'positive' : 'negative';
          deltaHtml = `<div class="kpi-sub ${cls}">${Number(d)>=0?'▲':'▼'} ${Math.abs(d)}% A vs B</div>`;
        }
        return `<div class="kpi-card" style="--accent:var(--orange)">
          <div class="kpi-label">${m.label}</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;">
            <div>
              <div style="font-size:9px;color:#F97316;font-family:'Geist Mono',monospace;margin-bottom:2px;">A · ${a.skuName.split(' ').slice(0,2).join(' ')}</div>
              <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#F97316">${m.valA}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:9px;color:#3B82F6;font-family:'Geist Mono',monospace;margin-bottom:2px;">B · ${b.skuName.split(' ').slice(0,2).join(' ')}</div>
              <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#3B82F6">${m.valB}</div>
            </div>
          </div>
          ${deltaHtml}
        </div>`;
      }).join('');

      // Platform breakdown charts
      const allPlats = [...new Set([...Object.keys(a.byPlatform), ...Object.keys(b.byPlatform)])].sort();
      const baseBar = {
        chart: { type:'bar', toolbar:{show:false}, background:'transparent', fontFamily:'DM Sans, sans-serif', height:240 },
        theme: { mode:'dark' },
        plotOptions: { bar: { borderRadius:4, columnWidth:'65%', grouped:true } },
        dataLabels: { enabled:false },
        grid: { borderColor:'rgba(255,255,255,0.05)', strokeDashArray:4 },
        xaxis: { categories: allPlats, labels:{style:{colors:'#555',fontSize:'12px'}}, axisBorder:{show:false}, axisTicks:{show:false} },
        legend: { labels:{colors:'#888'}, position:'top' },
        tooltip: { theme:'dark' },
        colors: ['#F97316','#3B82F6'],
      };

      if (skucmpChartPlatform) skucmpChartPlatform.destroy();
      skucmpChartPlatform = new ApexCharts(document.querySelector('#skucmp-chart-platform'), {
        ...baseBar,
        series: [
          { name: a.skuName.split(' ').slice(0,2).join(' ') + ' (A)', data: allPlats.map(p => a.byPlatform[p]?.rev || 0) },
          { name: b.skuName.split(' ').slice(0,2).join(' ') + ' (B)', data: allPlats.map(p => b.byPlatform[p]?.rev || 0) }
        ],
        yaxis: { labels:{ formatter: v => fmt(v), style:{colors:'#555'} } },
        tooltip: { y:{ formatter: v => fmt(v) }, theme:'dark' },
      });
      skucmpChartPlatform.render();

      if (skucmpChartUnits) skucmpChartUnits.destroy();
      skucmpChartUnits = new ApexCharts(document.querySelector('#skucmp-chart-units'), {
        ...baseBar,
        series: [
          { name: a.skuName.split(' ').slice(0,2).join(' ') + ' (A)', data: allPlats.map(p => a.byPlatform[p]?.units || 0) },
          { name: b.skuName.split(' ').slice(0,2).join(' ') + ' (B)', data: allPlats.map(p => b.byPlatform[p]?.units || 0) }
        ],
        yaxis: { labels:{ formatter: v => fmt(v,false), style:{colors:'#555'} } },
        tooltip: { y:{ formatter: v => fmt(v,false) }, theme:'dark' },
      });
      skucmpChartUnits.render();

        // Daily trend — skip FY25 sides
      const trendSection = document.querySelector('.section-label + .chart-section');
      const hasDailyA = !a.isFY25 && a.days.length > 0;
      const hasDailyB = !b.isFY25 && b.days.length > 0;
      const trendSeries = [];
      if (hasDailyA) trendSeries.push({ name: `A · ${a.skuName.split(' ').slice(0,2).join(' ')}`, data: a.days });
      if (hasDailyB) trendSeries.push({ name: `B · ${b.skuName.split(' ').slice(0,2).join(' ')}`, data: b.days });
      const maxLen = Math.max(...trendSeries.map(s=>s.data.length), 1);
      const dayLabels = Array.from({length:maxLen}, (_,i) => 'Day '+(i+1));
      const padDays = (arr, len) => [...arr, ...Array(len - arr.length).fill(null)];
      trendSeries.forEach(s => { s.data = padDays(s.data, maxLen); });
      const dailyTitle = document.querySelector('#skucmp-results .section-label:last-of-type');
      if (dailyTitle) dailyTitle.textContent = 'Daily trend' + ((!hasDailyA||!hasDailyB) ? ' — FY25 side unavailable' : '');
      if (skucmpChartTrend) skucmpChartTrend.destroy();
      if (trendSeries.length === 0) { document.querySelector('#skucmp-chart-trend').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:12px">Daily data unavailable — both sides are FY25 months</div>'; return; }
      skucmpChartTrend = new ApexCharts(document.querySelector('#skucmp-chart-trend'), {
        series: trendSeries,
        chart: { type:'line', height:280, toolbar:{show:false}, background:'transparent', fontFamily:'DM Sans, sans-serif' },
        theme: { mode:'dark' },
        colors: ['#F97316','#3B82F6'],
        stroke: { width:2.5, curve:'smooth' },
        markers: { size:4, strokeWidth:0 },
        dataLabels: { enabled:false },
        grid: { borderColor:'rgba(255,255,255,0.05)', strokeDashArray:4 },
        xaxis: { categories:dayLabels, labels:{style:{colors:'#555'}}, axisBorder:{show:false} },
        yaxis: { labels:{ formatter: v => v !== null ? fmt(v) : '', style:{colors:'#555'} } },
        legend: { labels:{colors:'#888'}, position:'top' },
        tooltip: { y:{ formatter: v => v !== null ? fmt(v) : 'No data' }, theme:'dark' },
      });
      skucmpChartTrend.render();
    }
    // ─── SHOPIFY ENGINE ────────────────────────────────────────────────────────
    let shopifyRawData = [];
    let activeShopifyMonth = '04';
    let shopifyChartGMV = null, shopifyChartROI = null;

    function loadShopifyData() {
      const monthCode = parseInt(activeShopifyMonth, 10);
      shopifyRawData = rawData.filter(r =>
        String(r.Platform) === 'Shopify' &&
        Number(r.Month) === monthCode
      ).map(r => ({
        date: r.Date,
        sales: Number(r.Sales) || 0,
        spends: Number(r.Spends) || 0,
        roi: Number(r.ROAS) || 0,
        orders: Number(r.Units) || 0,
        aov: Number(r.Units) > 0 ? (Number(r.Sales) / Number(r.Units)) : 0
      })).sort((a, b) => new Date(a.date) - new Date(b.date));

      renderShopifyTab();
    }

    function setShopifyMonth(m) {
      activeShopifyMonth = m;
      ['04','05','06','07'].forEach(k => {
        const btn = document.getElementById('shopify-btn-' + k);
        if (btn) btn.classList.toggle('active', k === m);
      });
      loadShopifyData();
    }

   function renderShopifyTab() {
      const rows = shopifyRawData;
      const monthNames = { '01':'January', '02':'February', '03':'March', '04':'April', '05':'May', '06':'June', '07':'July', '08':'August', '09':'September', '10':'October', '11':'November', '12':'December' };
      const monthName = monthNames[activeShopifyMonth] || '';

      if (!document.getElementById('shopify-subtitle')) return;
      if (rows.length === 0) {
        document.getElementById('shopify-subtitle').textContent = `${monthName} 2026 · No data`;
        document.getElementById('shopify-kpi-grid').innerHTML = '<div style="color:var(--text-muted);padding:20px;font-size:13px;">No Shopify data for this month.</div>';
        document.getElementById('shopify-daily-body').innerHTML = '';
        return;
      }

      document.getElementById('shopify-subtitle').textContent = 
`${monthName} 2026 · ${rows.length} days of data`;
      document.getElementById('shopify-table-title').textContent =
        `Day-by-day — ${monthName} 2026`;
      document.getElementById('shopify-row-count').textContent =
        rows.length + ' days';

      const totalSales  = rows.reduce((s, r) => s + r.sales, 0);
      const totalSpends = rows.reduce((s, r) => s + r.spends, 0);
      const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
      const avgROI = (() => {
        const valid = rows.filter(r => r.roi > 0);
        return valid.length ? valid.reduce((s, r) => s + r.roi, 0) / valid.length : 0;
      })();
      const avgAOV = totalOrders > 0 ? totalSales / totalOrders : 0;

      // KPI cards
      document.getElementById('shopify-kpi-grid').innerHTML = [
        { label: 'Shopify GMV',   value: fmt(totalSales),  sub: `${rows.length} days`,          accent: '#96bf48' },
        { label: 'GT Spends',     value: totalSpends > 0 ? fmt(totalSpends) : '--', sub: 'Total ad spend', accent: 'var(--blue)' },
        { label: 'Avg ROI',       value: avgROI > 0 ? avgROI.toFixed(2)+'x' : '--',
          sub: avgROI >= 3 ? '▲ Healthy' : avgROI > 0 ? '△ Monitor' : 'No spends tracked',
          accent: avgROI >= 3 ? 'var(--green)' : 'var(--yellow)' },
        { label: 'Total Orders',  value: totalOrders > 0 ? totalOrders.toLocaleString('en-IN') : '--', sub: 'MTD', accent: 'var(--orange)' },
        { label: 'AOV',           value: avgAOV > 0 ? '₹'+avgAOV.toFixed(0) : '--', sub: 'Avg order value', accent: 'var(--purple)' },
        { label: 'Total Spends',  value: totalSpends > 0 ? fmt(totalSpends) : '--', sub: 'Tracked budget', accent: 'var(--yellow)' },
      ].map(c => `
        <div class="kpi-card" style="--accent:${c.accent}">
          <div class="kpi-label">${c.label}</div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-sub neutral">${c.sub}</div>
        </div>`).join('');

      // Charts
      const dates  = rows.map(r => { const p = r.date.split('-'); return p[2]+'/'+p[1]; });
      const gmvs   = rows.map(r => r.sales);
      const rois   = rows.map(r => parseFloat(r.roi.toFixed(2)));

      const baseOpts = {
        chart: { toolbar:{show:false}, background:'transparent', fontFamily:'DM Sans, sans-serif' },
        theme: { mode:'dark' },
        grid: { borderColor:'rgba(255,255,255,0.05)', strokeDashArray:4 },
        xaxis: { categories: dates, tickAmount: 8, labels:{ style:{colors:'#555',fontSize:'11px'}, rotate:-45, rotateAlways:true }, axisBorder:{show:false}, axisTicks:{show:false} },
        dataLabels: { enabled:false },
        tooltip: { theme:'dark' },
      };

      if (shopifyChartGMV) shopifyChartGMV.destroy();
      shopifyChartGMV = new ApexCharts(document.querySelector('#shopify-chart-gmv'), {
        ...baseOpts,
        series: [{ name:'GMV', data: gmvs }],
        chart: { ...baseOpts.chart, type:'bar', height:220 },
        colors: ['#96bf48'],
        plotOptions: { bar:{ borderRadius:3, columnWidth:'60%' } },
        yaxis: { labels:{ formatter: v => fmt(v), style:{colors:'#555',fontSize:'11px'} } },
        tooltip: { y:{ formatter: v => fmt(v) }, theme:'dark' },
      });
      shopifyChartGMV.render();

      if (shopifyChartROI) shopifyChartROI.destroy();
      shopifyChartROI = new ApexCharts(document.querySelector('#shopify-chart-roi'), {
        ...baseOpts,
        series: [{ name:'ROI', data: rois }],
        chart: { ...baseOpts.chart, type:'line', height:220 },
        colors: ['#22C55E'],
        stroke: { width:2.5, curve:'smooth' },
        markers: { size:3, strokeWidth:0 },
        yaxis: { labels:{ formatter: v => v > 0 ? v.toFixed(1)+'x' : '--', style:{colors:'#555',fontSize:'11px'} } },
        annotations: { yaxis: [{ y:3, borderColor:'rgba(255,255,255,0.15)', strokeDashArray:4,
          label:{ text:'3x', style:{color:'#555',background:'transparent',fontSize:'10px'} } }] },
        tooltip: { y:{ formatter: v => v > 0 ? v.toFixed(2)+'x' : '--' }, theme:'dark' },
      });
      shopifyChartROI.render();

      // Daily table
      document.getElementById('shopify-daily-body').innerHTML = rows.map(r => {
        let dateLabel = r.date;
        try {
          const d = new Date(r.date);
          dateLabel = d.toLocaleDateString('en-IN', { day:'numeric', month:'short', weekday:'short' });
        } catch(e) {}
        const roiColor = r.roi >= 3 ? 'var(--green)' : r.roi > 0 ? 'var(--yellow)' : 'var(--text-muted)';
        return `<tr>
          <td style="color:var(--text-primary);font-weight:500;">${dateLabel}</td>
          <td class="right" style="color:var(--text-primary);font-weight:600;">${fmt(r.sales)}</td>
          <td class="right">${r.spends > 0 ? fmt(r.spends) : '--'}</td>
          <td class="right">${r.orders > 0 ? r.orders : '--'}</td>
          <td class="right">${r.aov > 0 ? '₹'+r.aov.toFixed(0) : '--'}</td>
          <td class="right" style="color:${roiColor}">${r.roi > 0 ? r.roi.toFixed(2)+'x' : '--'}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No data for this month.</td></tr>';
    }
    // ─── END SHOPIFY ENGINE ────────────────────────────────────────────────────
    
   // ─── KICK OFF ──────────────────────────────────────────────────────────────
    init();
