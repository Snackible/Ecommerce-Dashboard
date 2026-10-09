// Reads SKU sales from the four platform workbooks via the Sheets API (service account).
// Returns { sku, skuDaily, failed: { platform: message } }. A platform that can't be read
// is reported in `failed` so the client can fall back to Apps Script for just that platform.
import { sheetsGet } from './googleAuth.js';
import { loadCredentials } from './credentials.js';
import { parseSkuTab, parseTabName } from './skuParser.js';

export const SKU_SHEETS = {
  Zepto: process.env.SHEET_ZEPTO || '1A7ESTA-vqbdxrElAsrejaB4wavewFIu2yZ9PDwddkbc',
  Blinkit: process.env.SHEET_BLINKIT || '1kJqMoIFMd5ZqOybd4cIThlNXW7EZkUOrvLmLaLR2LhY',
  Instamart: process.env.SHEET_INSTAMART || '1dqfnaSoDmCVhOVD5E2RhY-e1zgigkMIZeqtKSR7Ms_M',
  'Big Basket': process.env.SHEET_BIGBASKET || '1JhKEC2fbSoAHbDVoxk4tcWOALbwrM3iiokophWw4Ca4',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isPermission = (e) => /permission|not found|forbidden|403|404/i.test(e?.message || '');

async function readPlatformOnce(platform, id, creds) {
  const meta = await sheetsGet(`${id}?fields=sheets.properties.title`, creds);
  const tabs = meta.sheets
    .map((s) => s.properties.title)
    .map((title) => ({ title, ...parseTabName(title) }))
    .filter((t) => t.month);
  if (!tabs.length) throw new Error('no month tabs found');
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`'${t.title}'!A1:CZ120`)}`).join('&');
  const data = await sheetsGet(`${id}/values:batchGet?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&${ranges}`, creds);
  const sku = [], daily = [];
  data.valueRanges.forEach((vr, i) => {
    const parsed = parseSkuTab(vr.values || [], { platform, month: tabs[i].month, year: tabs[i].year });
    sku.push(...parsed.sku);
    daily.push(...parsed.daily);
  });
  return { sku, daily };
}

// Retry transient errors (rate limits, network blips); permission errors won't fix themselves.
async function readPlatform(platform, id, creds) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await readPlatformOnce(platform, id, creds); }
    catch (e) { lastErr = e; if (isPermission(e)) break; await sleep(500 * (attempt + 1)); }
  }
  throw lastErr;
}

let cache = { at: 0, value: null };
const TTL_OK_MS = 5 * 60 * 1000;
const TTL_PARTIAL_MS = 20 * 1000; // if anything failed, look again soon

export async function fetchSkuData({ force = false } = {}) {
  const ttl = cache.value && Object.keys(cache.value.failed).length ? TTL_PARTIAL_MS : TTL_OK_MS;
  if (!force && cache.value && Date.now() - cache.at < ttl) return cache.value;
  const creds = loadCredentials();
  const results = await Promise.allSettled(Object.entries(SKU_SHEETS).map(([p, id]) => readPlatform(p, id, creds)));
  const out = { sku: [], skuDaily: [], failed: {} };
  results.forEach((r, i) => {
    const platform = Object.keys(SKU_SHEETS)[i];
    if (r.status === 'fulfilled') { out.sku.push(...r.value.sku); out.skuDaily.push(...r.value.daily); }
    else out.failed[platform] = isPermission(r.reason) ? 'not shared with the service account' : (r.reason?.message || 'unavailable');
  });
  cache = { at: Date.now(), value: out };
  return out;
}
