// Compares the Sheets API reader against the Apps Script export in sheet-export/oms.json.
// Run: node scripts/check-sheets.mjs [fy25]   (reads VITE_SHEET_ID and VITE_SHEETS_API_KEY from .env)
import fs from 'node:fs';
import { fetchOmsFromSheets } from '../src/data/sheets.js';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
if (!env.VITE_SHEET_ID || !env.VITE_SHEETS_API_KEY) throw new Error('Set VITE_SHEET_ID and VITE_SHEETS_API_KEY in .env first.');

const which = process.argv[2] === 'fy25' ? { id: env.VITE_SHEET_ID_FY25, file: 'fy25.json' } : { id: env.VITE_SHEET_ID, file: 'oms.json' };
const rows = await fetchOmsFromSheets(which.id, env.VITE_SHEETS_API_KEY);
const ref = JSON.parse(fs.readFileSync(new URL('../sheet-export/' + which.file, import.meta.url), 'utf8'));
console.log('sheets rows:', rows.length, '| apps script rows:', ref.length);

const key = (r) => `${String(r.Date).slice(0, 10)}|${r.Platform}`;
const byKey = new Map(ref.map((r) => [key(r), r]));
let match = 0, diff = 0, onlySheets = 0;
const examples = [];
for (const r of rows) {
  const o = byKey.get(key(r));
  if (!o) { onlySheets++; continue; }
  const same = Math.round(o.Sales) === Math.round(r.Sales) && Math.round(o.Spends) === Math.round(r.Spends) && o.Units === r.Units;
  if (same) match++;
  else { diff++; if (examples.length < 5) examples.push({ k: key(r), sheet: [r.Sales, r.Spends, r.Units], script: [o.Sales, o.Spends, o.Units] }); }
}
console.log({ match, diff, onlyInSheets: onlySheets });
if (examples.length) console.log(examples);
const dates = rows.map((r) => r.Date).sort();
console.log('platforms:', [...new Set(rows.map((r) => r.Platform))].join(', '), '| range:', dates[0], '→', dates.at(-1));
