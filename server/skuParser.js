// Parses the per-platform "Daily Sales" workbooks (one tab per month) into the same
// row shapes the Apps Script used to serve:
//   sku       { Month, Year, Platform, Category, SKU, EstRevenue, MTDUnits, MTDRevenue, Day1..Day31 }
//   skuDaily  { Date, Platform, SKU, Category, GMV, Units, Month, Year }
import { createRequire } from 'node:module';

const catalog = createRequire(import.meta.url)('./skuCatalog.json');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SECTION_LABELS = new Set(['total', 'ragi chips', 'dipsters', 'puffs', 'jowar chips', 'jowar', 'others', 'chips', 'dips', 'bhujia', 'multigrain chips', 'chickpea chips', 'chickpea puffs']);
const STOP = new Set(['snackible', 'with', 'and', 'the', 'a', 'dip', 'g', 'gm', 'gram', 'no', 'palm', 'oil', 'made', 'millets', 'millet', 'snack', 'high', 'fibre', 'healthy', 'free', 'of', 'in']);

const toNum = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/[,₹\s%]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const norm = (s) => String(s ?? '').trim();
const low = (s) => norm(s).toLowerCase();

/** "Oct'26", "July'26", "April '26", "Sep 26" → { month: 10, year: 2026 } */
export function parseTabName(title) {
  const m = title.trim().match(/^([a-z]+)\W*(\d{2})$/i);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  return idx === -1 ? null : { month: idx + 1, year: 2000 + Number(m[2]) };
}

// ── Name cleaning: map the sheet's product names onto the dashboard's SKU catalogue ──
const tokens = (s) => new Set(
  low(s).replace(/\d+(\.\d+)?\s*(g|gm|gram)\b/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t)),
);
const catalogEntries = Object.keys(catalog).map((name) => ({
  name,
  tok: tokens(name),
  // prefer tidy names over duplicates like "Snackible ... 55 g" / lowercase / garbled characters
  tidy: /^[\x20-\x7e]+$/.test(name) && !/^snackible/i.test(name) && name === name.replace(/\s+/g, ' ').trim() && name[0] === name[0].toUpperCase() ? 1 : 0,
}));
const nameCache = new Map();

export function cleanSkuName(raw) {
  const key = norm(raw);
  if (nameCache.has(key)) return nameCache.get(key);
  const t = tokens(key);
  let best = null, bestScore = 0;
  for (const c of catalogEntries) {
    let inter = 0;
    t.forEach((x) => { if (c.tok.has(x)) inter++; });
    const union = t.size + c.tok.size - inter;
    const score = union ? inter / union + c.tidy * 0.01 : 0;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  const fallback = key.replace(/^snackible\s+/i, '').replace(/\s+\d+(\.\d+)?\s*(g|gm|gram)\b.*$/i, '').trim() || key;
  const out = best && bestScore >= 0.5 ? best.name : fallback;
  nameCache.set(key, out);
  return out;
}

export function categoryFor(cleanName) {
  if (catalog[cleanName]) return catalog[cleanName];
  const n = low(cleanName);
  if (/dipster|biscuit|\bdip\b/.test(n)) return 'Dipsters';
  if (/puff/.test(n)) return 'Puffs';
  if (/ragi/.test(n)) return 'Ragi Chips';
  return 'Others';
}

// ── Grid parsing ──
function findHeader(grid) {
  const i = grid.findIndex((r) => (r || []).some((c) => /^product\s*name/.test(low(c))));
  return i;
}

function columnMap(headerRow) {
  const cols = {};
  headerRow.forEach((c, i) => {
    const h = low(c);
    if (/^product\s*name/.test(h)) cols.name = i;
    else if (h.includes('est') && h.includes('revenue') && cols.est === undefined) cols.est = i;
    else if (h.includes('mtd') && h.includes('unit') && cols.units === undefined) cols.units = i;
    else if (h.includes('mtd') && h.includes('revenue') && cols.rev === undefined) cols.rev = i;
  });
  return cols;
}

/** Day blocks: columns in the row above the header that hold 1, 2, 3 … (start of each 3-column block). */
function dayBlocks(grid, headerIdx) {
  for (let r = headerIdx - 1; r >= Math.max(0, headerIdx - 3); r--) {
    const row = grid[r] || [];
    const blocks = [];
    row.forEach((c, i) => {
      const n = Number(norm(c));
      if (Number.isInteger(n) && n >= 1 && n <= 31 && norm(c) !== '' && i > 5) blocks.push({ day: n, col: i });
    });
    if (blocks.length >= 2) return blocks;
  }
  return [];
}

export function parseSkuTab(grid, { platform, month, year }) {
  const hi = findHeader(grid);
  if (hi === -1) return { sku: [], daily: [] };
  const cols = columnMap(grid[hi]);
  const blocks = dayBlocks(grid, hi);
  if (cols.name === undefined) return { sku: [], daily: [] };

  const agg = new Map();
  for (let r = hi + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const rawName = norm(row[cols.name]);
    if (!rawName || SECTION_LABELS.has(low(rawName))) continue;
    // a SKU row has numbers; stray notes/labels below the table don't
    const units = toNum(row[cols.units]);
    const rev = toNum(row[cols.rev]);
    if (!units && !rev && !blocks.some((b) => toNum(row[b.col + 1]))) continue;

    const sku = cleanSkuName(rawName);
    const key = sku;
    const a = agg.get(key) || {
      Month: month, Year: year, Platform: platform, Category: categoryFor(sku), SKU: sku,
      EstRevenue: 0, MTDUnits: 0, MTDRevenue: 0, days: {}, dayUnits: {},
    };
    a.EstRevenue += toNum(row[cols.est]);
    a.MTDUnits += units;
    a.MTDRevenue += rev;
    blocks.forEach((b) => {
      a.days[b.day] = (a.days[b.day] || 0) + toNum(row[b.col + 1]);
      a.dayUnits[b.day] = (a.dayUnits[b.day] || 0) + toNum(row[b.col]);
    });
    agg.set(key, a);
  }

  const sku = [], daily = [];
  for (const a of agg.values()) {
    const rec = {
      Month: a.Month, Year: a.Year, Platform: a.Platform, Category: a.Category, SKU: a.SKU,
      EstRevenue: a.EstRevenue, MTDUnits: a.MTDUnits, MTDRevenue: a.MTDRevenue,
    };
    for (let d = 1; d <= 31; d++) rec['Day' + d] = a.days[d] || 0;
    sku.push(rec);
    for (const d of Object.keys(a.days)) {
      if (!a.days[d] && !a.dayUnits[d]) continue;
      daily.push({
        Date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        Platform: a.Platform, SKU: a.SKU, Category: a.Category, GMV: a.days[d], Units: a.dayUnits[d], Month: month, Year: year,
      });
    }
  }
  return { sku, daily };
}
