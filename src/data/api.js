import { API_URL, API_TOKEN, FY_CUR_START } from '../config';
import { dayKey, num, parseLocalDate } from '../lib/utils';
import { fetchOmsFromSheets } from './sheets';

const CACHE_PREFIX = 'snk_dash_';

function buildUrl(type) {
  if (!API_URL || !API_TOKEN) {
    throw new Error('Missing VITE_API_URL / VITE_API_TOKEN. Copy .env.example to .env and fill them in.');
  }
  const q = new URLSearchParams({ token: API_TOKEN });
  if (type) q.set('type', type);
  return `${API_URL}?${q}`;
}

async function fetchJson(type, { force = false } = {}) {
  const url = buildUrl(type);
  const key = CACHE_PREFIX + (type || 'oms');
  if (!force) {
    try {
      const hit = localStorage.getItem(key);
      if (hit !== null) return JSON.parse(hit);
    } catch { /* cache unavailable or corrupt: fall through to network */ }
  }
  // Apps Script intermittently answers with a 404/HTML page, so retry once before giving up.
  let text = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(force ? `${url}&refresh=1` : url, { redirect: 'follow' });
    text = await res.text();
    if (res.ok && (!text.trim() || /^\s*[\[{]/.test(text))) break;
    if (attempt === 1) throw new Error(`HTTP ${res.status} while loading ${type || 'sales'} data`);
  }
  if (!text.trim()) return [];
  const json = JSON.parse(text);
  try { localStorage.setItem(key, text); } catch { /* quota exceeded: skip caching */ }
  return json;
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ── Normalisers: coerce numbers once and pre-compute date fields ───────────
function normaliseOms(rows) {
  return rows.map((r) => {
    const d = parseLocalDate(r.Date);
    return {
      ...r,
      Platform: String(r.Platform || '').trim(),
      Month: num(r.Month),
      Sales: num(r.Sales),
      Spends: num(r.Spends),
      Units: num(r.Units),
      ROAS: num(r.ROAS),
      _date: d,
      _t: d.getTime(),
      _day: dayKey(d),
      _y: d.getFullYear(),
      _m: d.getMonth() + 1,
    };
  }).filter((r) => !isNaN(r._t));
}

function normaliseFy25Sku(rows) {
  return rows.map((r) => ({
    ...r,
    Month: num(r.Month),
    Platform: String(r.Platform),
    SKU: String(r.SKU),
    MTDRevenue: num(r.GMV),
    MTDUnits: num(r.Quantity),
    EstRevenue: num(r.GMV),
  }));
}

/** Current-FY SKU sheet: per-day revenue columns (Day1..Day31) + monthly units. */
function normaliseSku(rows, latest) {
  const latestKey = latest.getFullYear() * 12 + latest.getMonth();
  const daysElapsed = latest.getDate() || 1;
  return rows.map((r) => {
    const m = num(r.Month);
    const y = num(r.Year) || (m >= 4 ? FY_CUR_START : FY_CUR_START + 1);
    let mtd = 0;
    for (let d = 1; d <= 31; d++) mtd += num(r['Day' + d]);
    const rowKey = y * 12 + (m - 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const est = rowKey === latestKey ? (mtd / daysElapsed) * daysInMonth : rowKey < latestKey ? mtd : 0;
    return {
      ...r,
      Month: m,
      _y: y,
      Platform: String(r.Platform),
      SKU: String(r.SKU),
      MTDRevenue: mtd,
      MTDUnits: num(r.MTDUnits),
      EstRevenue: est,
    };
  });
}

function normaliseSkuDaily(rows) {
  return rows.map((r) => {
    const d = parseLocalDate(r.Date);
    return { ...r, SKU: String(r.SKU), Platform: String(r.Platform), GMV: num(r.GMV), Units: num(r.Units), _date: d, _t: d.getTime() };
  });
}

// If a spreadsheet ID + API key are configured, read daily sales straight from the
// Sheets API; otherwise fall back to the Apps Script endpoint.
const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const SHEET_ID_FY25 = import.meta.env.VITE_SHEET_ID_FY25;
const SHEETS_KEY = import.meta.env.VITE_SHEETS_API_KEY;

// SKU data: read from the sheets through our /api/sku endpoint (service account).
// Any platform the server couldn't read, or the whole call failing, falls back to Apps Script.
let skuBundle = null;
let skuNotice = null;
export const getSkuNotice = () => skuNotice;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchLiveSku(opts) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(opts.force || attempt ? '/api/sku?refresh=1' : '/api/sku');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json;
    } catch (e) { lastErr = e; await wait(700 * (attempt + 1)); }
  }
  throw lastErr;
}

async function loadSkuBundle(opts) {
  if (skuBundle && !opts.force) return skuBundle;
  skuBundle = (async () => {
    let live;
    try {
      live = await fetchLiveSku(opts);
    } catch (e) {
      console.warn('Live SKU sheets unavailable, using Apps Script:', e.message);
      live = { sku: [], skuDaily: [], failed: { all: e.message } };
    }
    const failed = Object.keys(live.failed || {});
    if (!failed.length) { skuNotice = null; return { sku: live.sku, skuDaily: live.skuDaily }; }

    const everything = failed.includes('all');
    skuNotice = everything
      ? `Live SKU sheets are unavailable (${live.failed.all}). Showing older data from Apps Script, which only goes up to Aug 26.`
      : `${failed.join(' and ')} SKU ${failed.length > 1 ? 'sheets are' : 'sheet is'} ${Object.values(live.failed)[0] === 'not shared with the service account' ? 'not shared with the service account yet' : 'unavailable'}, so ${failed.length > 1 ? 'they use' : 'it uses'} older Apps Script data (up to Aug 26).`;
    const want = (r) => everything || failed.includes(String(r.Platform));
    const [sku, skuDaily] = await Promise.all([
      fetchJson('sku', opts).catch(() => []),
      fetchJson('skudaily', opts).catch(() => []),
    ]);
    return {
      sku: [...(everything ? [] : live.sku), ...sku.filter(want)],
      skuDaily: [...(everything ? [] : live.skuDaily), ...skuDaily.filter(want)],
    };
  })();
  return skuBundle;
}

export const loaders = {
  oms: async (opts) => normaliseOms(
    SHEET_ID && SHEETS_KEY ? await fetchOmsFromSheets(SHEET_ID, SHEETS_KEY) : await fetchJson(null, opts),
  ),
  fy25: async (opts) => normaliseOms(
    SHEET_ID_FY25 && SHEETS_KEY ? await fetchOmsFromSheets(SHEET_ID_FY25, SHEETS_KEY) : await fetchJson('fy25', opts),
  ),
  fy25Sku: async (opts) => normaliseFy25Sku(await fetchJson('fy25sku', opts)),
  sku: async (opts, latest) => normaliseSku((await loadSkuBundle(opts)).sku, latest),
  skuDaily: async (opts) => normaliseSkuDaily((await loadSkuBundle(opts)).skuDaily),
};
