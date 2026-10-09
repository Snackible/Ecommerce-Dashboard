import { sheetsGet } from '../server/googleAuth.js';
import { loadCredentials } from '../server/credentials.js';
const creds = loadCredentials();
const [id, tab, range] = process.argv.slice(2);
const d = await sheetsGet(`${id}/values/${encodeURIComponent(`'${tab}'!${range}`)}?valueRenderOption=FORMATTED_VALUE`, creds);
(d.values || []).forEach((r, i) => console.log(i + 1, JSON.stringify(r.map((c) => String(c).slice(0, 26)).slice(0, 16))));
