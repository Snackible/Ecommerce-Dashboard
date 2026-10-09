import { fetchSkuData } from './skuService.js';

/** GET /api/sku → { sku, skuDaily, failed }  (works as a Vercel function and as a Vite dev middleware) */
export async function skuHandler(req, res) {
  try {
    const force = /[?&]refresh=1/.test(req.url || '');
    const data = await fetchSkuData({ force });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message || 'failed' }));
  }
}
