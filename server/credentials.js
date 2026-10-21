// Finds the service-account key. In production set GOOGLE_SERVICE_ACCOUNT_JSON
// (the file's contents) as an environment variable; locally we look for the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const creds = JSON.parse(text);
      if (!creds.client_email || !creds.private_key) throw new Error('missing client_email/private_key');
      return creds;
    } catch (e) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is set but invalid (${e.message}). Paste the whole key file contents.`);
    }
  }
  const candidates = [
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
    path.join(root, 'service-account.json'),
    ...[path.resolve(root, '..')].flatMap((dir) => {
      try { return fs.readdirSync(dir).filter((f) => /^turing-guard-.*\.json$/.test(f)).map((f) => path.join(dir, f)); } catch { return []; }
    }),
  ].filter(Boolean);
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error('Service account key not found. On Vercel set GOOGLE_SERVICE_ACCOUNT_JSON; locally put service-account.json in the repo root.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
