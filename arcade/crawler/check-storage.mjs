// Does every crawler page this repository ships save under htll.? (arcade/TESTS.md, row A-13)
//   node arcade/crawler/check-storage.mjs
// Reads the pack embedded in each dist/*.html and checks that its storage prefix starts with "htll.". The expected prefix
// is fixed here, not read from the pack, so a pack that drops or changes its storage field fails. test.mjs checks the
// other half: that a page writes keys only under its pack's prefix.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED = "htll.";
const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const pages = readdirSync(dist).filter(f => f.endsWith(".html")).sort();
let bad = 0;

for (const page of pages) {
  const html = readFileSync(join(dist, page), "utf8");
  const m = html.match(/window\.PACK = (\{.*\});\n<\/script>/);
  if (!m) { console.log(`FAIL ${page}: no embedded pack`); bad++; continue; }
  const storage = JSON.parse(m[1]).storage;
  if (typeof storage === "string" && storage.startsWith(REQUIRED)) console.log(`ok ${page}: saves under ${storage}.`);
  else { console.log(`FAIL ${page}: storage is ${JSON.stringify(storage)}, must start with "${REQUIRED}"`); bad++; }
}
if (!pages.length) { console.log("FAIL: no pages in dist/"); bad++; }
process.exit(bad ? 1 : 0);
