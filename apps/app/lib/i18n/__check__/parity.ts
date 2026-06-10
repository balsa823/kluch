import { dict } from "../dict.js";

const enKeys = new Set(Object.keys(dict.en));
const srKeys = new Set(Object.keys(dict.sr));

const missingInSr = [...enKeys].filter((k) => !srKeys.has(k));
const missingInEn = [...srKeys].filter((k) => !enKeys.has(k));

if (missingInSr.length > 0 || missingInEn.length > 0) {
  console.error("i18n parity FAILED");
  if (missingInSr.length > 0) {
    console.error(`  missing in sr (${missingInSr.length}):`, missingInSr.join(", "));
  }
  if (missingInEn.length > 0) {
    console.error(`  missing in en (${missingInEn.length}):`, missingInEn.join(", "));
  }
  process.exit(1);
}

console.log(`i18n parity OK: ${enKeys.size} keys`);
