// Finds the service-account key. In production set GOOGLE_SERVICE_ACCOUNT_JSON
// (the file's contents) as an environment variable; locally we look for the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const candidates = [
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
    path.join(root, 'service-account.json'),
    ...[path.resolve(root, '..')].flatMap((dir) => {
      try { return fs.readdirSync(dir).filter((f) => /^turing-guard-.*\.json$/.test(f)).map((f) => path.join(dir, f)); } catch { return []; }
    }),
  ].filter(Boolean);
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error('Service account key not found. Put it at repo/service-account.json or set GOOGLE_SERVICE_ACCOUNT_FILE.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
