// Build one pack into one HTML file that opens from disk. See crawler/SPEC.md, section 10.
// node crawler/tools/build.mjs <packdir> [--out <file>]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack } from "./load.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const packDir = args.find(a => !a.startsWith("--"));
const outIx = args.indexOf("--out");
if (!packDir) {
  console.error("usage: node crawler/tools/build.mjs <packdir> [--out <file>]");
  process.exit(2);
}

const pack = loadPack(packDir);
const out = outIx >= 0 ? args[outIx + 1] : join(root, "dist", pack.id + ".html");
const read = p => readFileSync(join(root, p), "utf8");
// "</script" inside inlined code or data would end the block early.
const safe = s => s.replace(/<\/script/gi, "<\\/script");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

let html = read("ui/index.html");
const parts = {
  "<!-- @style -->": `<style>\n${read("ui/style.css")}\n</style>`,
  "<!-- @pack -->": `<script>\nwindow.PACK = ${safe(JSON.stringify(pack))};\n</script>`,
  "<!-- @engine -->": `<script>\n${safe(read("engine/crawl.js"))}\n</script>`,
  "<!-- @view -->": `<script>\n${safe(read("ui/view.js"))}\n</script>`,
};
for (const [marker, block] of Object.entries(parts)) {
  if (!html.includes(marker)) {
    console.error(`ui/index.html has no ${marker} marker`);
    process.exit(1);
  }
  html = html.split(marker).join(block);
}
html = html.split("{{title}}").join(esc(pack.title));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`built ${out} (${Math.round(html.length / 1024)} KB)`);
