// Lists the tabs of each platform sheet using the service account.
import { sheetsGet } from '../server/googleAuth.js';
import { loadCredentials } from '../server/credentials.js';

const creds = loadCredentials();
const SHEETS = {
  Zepto: '1A7ESTA-vqbdxrElAsrejaB4wavewFIu2yZ9PDwddkbc',
  Blinkit: '1kJqMoIFMd5ZqOybd4cIThlNXW7EZkUOrvLmLaLR2LhY',
  Instamart: '1dqfnaSoDmCVhOVD5E2RhY-e1zgigkMIZeqtKSR7Ms_M',
  'Big Basket': '1JhKEC2fbSoAHbDVoxk4tcWOALbwrM3iiokophWw4Ca4',
};
for (const [name, id] of Object.entries(SHEETS)) {
  try {
    const meta = await sheetsGet(`${id}?fields=properties.title,sheets.properties(title,gridProperties)`, creds);
    console.log(`\n${name}: "${meta.properties.title}"`);
    meta.sheets.forEach((s) => console.log(`  - ${s.properties.title} (${s.properties.gridProperties.rowCount}x${s.properties.gridProperties.columnCount})`));
  } catch (e) {
    console.log(`\n${name}: FAILED - ${e.message}`);
  }
}
