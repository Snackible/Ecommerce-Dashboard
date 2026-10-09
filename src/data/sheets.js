// Reads the "OMS Tracker" spreadsheet straight from the Google Sheets API (v4).
//
// Layout of each month tab (e.g. "Oct 26"):
//   "OMS Sales" row: platform names, each at the first column of its block
//   next row: metric headers (Sales, Spends, ROAS, Units Sold, ...)
//   after that: one row per day, column A = dd/mm/yy
// We flatten that into one row per (day, platform): { Date, Month, Platform, Sales, Spends, ROAS, Units }.

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const MONTH_TAB = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{2})$/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const PLATFORM_ALIASES = { 'big basket': 'Big Basket', bigbasket: 'Big Basket', 'first club': 'First Club', firstclub: 'First Club' };
// Tabs have a varying number of summary rows on top, so find the header by its
// "OMS Sales" label in column A; the metric header is the row below it.
function findHeaderRow(grid) {
  const i = grid.findIndex((row) => String(row?.[0] || '').trim().toLowerCase() === 'oms sales');
  return i === -1 ? 4 : i;
}

const toNumber = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/[,₹\s%]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function normalisePlatform(name) {
  const t = String(name).trim();
  return PLATFORM_ALIASES[t.toLowerCase()] || t;
}

/** Map metric names in a block header row to column offsets. */
function metricColumns(headerRow, start, end) {
  const cols = {};
  for (let c = start; c < end; c++) {
    const h = String(headerRow[c] || '').trim().toLowerCase();
    if (!h) continue;
    if (h === 'sales' && cols.sales === undefined) cols.sales = c;
    else if ((h === 'spends' || h === 'spend') && cols.spends === undefined) cols.spends = c;
    else if (h === 'roas' && cols.roas === undefined) cols.roas = c;
    else if (h.startsWith('units sold') && cols.units === undefined) cols.units = c;
  }
  return cols;
}

/** Parse one month tab's cell grid into flat rows. */
export function parseMonthTab(grid) {
  const platformIdx = findHeaderRow(grid);
  const DATA_START = platformIdx + 2;
  const platformRow = grid[platformIdx] || [];
  const headerRow = grid[platformIdx + 1] || [];
  const starts = [];
  for (let c = 1; c < platformRow.length; c++) {
    if (String(platformRow[c] || '').trim()) starts.push({ c, name: normalisePlatform(platformRow[c]) });
  }
  const blocks = starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].c : Math.max(platformRow.length, headerRow.length);
    return { name: s.name, cols: metricColumns(headerRow, s.c, end) };
  }).filter((b) => b.cols.sales !== undefined);

  const out = [];
  for (let r = DATA_START; r < grid.length; r++) {
    const row = grid[r] || [];
    const m = String(row[0] || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) continue;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const month = Number(m[2]);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    for (const b of blocks) {
      const sales = toNumber(row[b.cols.sales]);
      const spends = b.cols.spends !== undefined ? toNumber(row[b.cols.spends]) : 0;
      const units = b.cols.units !== undefined ? toNumber(row[b.cols.units]) : 0;
      if (!sales && !spends && !units) continue; // platform not live / day not filled in yet
      let roas = b.cols.roas !== undefined ? toNumber(row[b.cols.roas]) : 0;
      if (!roas && spends > 0) roas = sales / spends;
      out.push({ Date: date, Month: month, Platform: b.name, Sales: sales, Spends: spends, ROAS: roas, Units: units });
    }
  }
  return out;
}

async function sheetsGet(path, apiKey) {
  const res = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}key=${apiKey}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Sheets API error ${res.status}`);
  }
  return res.json();
}

/** Month-tab names from the spreadsheet, optionally limited to one financial year. */
export async function listMonthTabs(spreadsheetId, apiKey) {
  const meta = await sheetsGet(`${spreadsheetId}?fields=sheets.properties.title`, apiKey);
  return meta.sheets
    .map((s) => s.properties.title)
    .filter((t) => MONTH_TAB.test(t.trim()))
    .map((title) => {
      const [, mon, yy] = title.trim().match(MONTH_TAB);
      return { title, month: MONTHS.indexOf(mon.toLowerCase()) + 1, year: 2000 + Number(yy) };
    });
}

/** All daily platform rows from every month tab of an OMS Tracker spreadsheet. */
export async function fetchOmsFromSheets(spreadsheetId, apiKey) {
  const tabs = await listMonthTabs(spreadsheetId, apiKey);
  if (!tabs.length) throw new Error('No month tabs (like "Oct 26") found in the spreadsheet.');
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`'${t.title}'!A1:AZ400`)}`).join('&');
  const data = await sheetsGet(`${spreadsheetId}/values:batchGet?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&${ranges}`, apiKey);
  return data.valueRanges.flatMap((vr) => parseMonthTab(vr.values || []));
}
