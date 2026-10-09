// Compares the Sheets-based SKU reader with the Apps Script export (sheet-export/sku.json).
import fs from 'node:fs';
import { fetchSkuData } from '../server/skuService.js';

const out = await fetchSkuData({ force: true });
console.log('failed platforms:', out.failed);
console.log('sku rows:', out.sku.length, '| daily rows:', out.skuDaily.length);

const ref = JSON.parse(fs.readFileSync(new URL('../sheet-export/sku.json', import.meta.url), 'utf8'));
const tot = (rows, f) => {
  const m = {};
  rows.forEach((r) => { const k = `${r.Platform}|${r.Month}`; m[k] = (m[k] || 0) + (Number(r[f]) || 0); });
  return m;
};
const a = tot(out.sku, 'MTDRevenue'), b = tot(ref.map((r) => ({ ...r, MTDRevenue: Number(r.MTDRevenue) || Array.from({ length: 31 }, (_, i) => Number(r['Day' + (i + 1)]) || 0).reduce((x, y) => x + y, 0) })), 'MTDRevenue');
const ua = tot(out.sku, 'MTDUnits'), ub = tot(ref, 'MTDUnits');
console.log('\nplatform|month        sheets rev     script rev    sheets units  script units');
for (const k of Object.keys({ ...a, ...b }).sort()) {
  console.log(k.padEnd(18), String(Math.round(a[k] || 0)).padStart(12), String(Math.round(b[k] || 0)).padStart(14), String(Math.round(ua[k] || 0)).padStart(14), String(Math.round(ub[k] || 0)).padStart(12));
}
const names = new Set(ref.map((r) => r.SKU));
const unmatched = [...new Set(out.sku.map((r) => r.SKU))].filter((n) => !names.has(n));
console.log('\nSKU names not in the Apps Script data:', unmatched);
