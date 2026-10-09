# Snackible Executive Dashboard

React (Vite) dashboard for daily sales, ad spend, ROAS and SKU performance across Blinkit, Zepto, Instamart, Big Basket, Amazon, First Club and Shopify.

## Run locally

```bash
npm install
cp .env.example .env   # fill in the values
npm run dev
```

## Where the data comes from

| Data | Source | Fallback |
|---|---|---|
| Daily sales per platform (current FY, FY25) | Google Sheets API, read in the browser with an API key (`VITE_SHEET_ID`, `VITE_SHEET_ID_FY25`, `VITE_SHEETS_API_KEY`). Sheets must be shared "anyone with the link: Viewer". | Apps Script (`VITE_API_URL`, `VITE_API_TOKEN`) |
| SKU sales (monthly + daily) | `/api/sku` (server side, Google service account) reads the four platform "Daily Sales" workbooks | Apps Script, per platform that the service account can't read |
| FY25 SKU, Shopify daily | Apps Script | – |

### Service account (SKU data)

1. Share each platform workbook with the service account email as **Viewer**.
2. Locally: save its JSON key as `service-account.json` in the repo root (git-ignored), or set `GOOGLE_SERVICE_ACCOUNT_FILE`.
3. On Vercel: set `GOOGLE_SERVICE_ACCOUNT_JSON` to the key file's contents. `api/sku.js` is deployed as a serverless function.

Sheet IDs can be overridden with `SHEET_ZEPTO`, `SHEET_BLINKIT`, `SHEET_INSTAMART`, `SHEET_BIGBASKET`.

## Scripts

- `node scripts/check-sheets.mjs [fy25]` compares the Sheets reader with an Apps Script export.
- `node scripts/probe-sheets.mjs` lists the tabs the service account can read.
- `node scripts/check-sku.mjs` compares the SKU reader with an Apps Script export.

## Security notes

- Anything prefixed `VITE_` is bundled into the browser build. Treat those values as public.
- Never commit `.env`, `service-account.json` or `sheet-export/` (all git-ignored).
- Rotate the Apps Script token and restrict the Sheets API key (Sheets API only, your domain) in Google Cloud Console.
