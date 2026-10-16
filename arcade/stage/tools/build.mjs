// Build one pack into one HTML file that opens from disk. See stage/SPEC.md, sections 1 and 4.
//   node stage/tools/build.mjs <packdir> [--out <file>] [--root <stagedir>]
// Fills these markers in ui/index.html:
//   <!-- @style -->   ui/style.css, @font-face rules from theme.fonts, a :root block of theme tokens
//   <!-- @pack -->    window.PACK and window.ASSETS, and window.SIM: the result of Stage.simulate(pack), computed here so that
//                     the Verify sheet does not walk the story in the browser (the page stays deterministic: same pack, same bytes).
//                     To keep the page small, each route's steps are one string, "s": steps joined by "|", a step being
//                     "group.option", "group.option=tier" or "(typed)". view.js reads it back into steps.
//   <!-- @engine -->  engine/stage.js
//   <!-- @kit -->     ui/kits/<pack.kit>.js
//   <!-- @view -->    ui/view.js
//   {{title}}         the pack title
// --root builds from another copy of engine/ and ui/ (the default is the stage folder this file is in).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadAll, FONT_TYPES } from "./load.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const packDir = args.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--root"].includes(args[i - 1])));
if (!packDir) {
  console.error("usage: node stage/tools/build.mjs <packdir> [--out <file>] [--root <stagedir>]");
  process.exit(2);
}
const root = resolve(flag("--root") || here);

const { pack, assets, fonts } = loadAll(packDir);
const need = ["engine/stage.js", "ui/index.html", "ui/style.css", "ui/view.js", `ui/kits/${pack.kit}.js`];
const missing = need.filter(f => !existsSync(join(root, f)));
if (missing.length) {
  console.error(`cannot build ${pack.id}: missing ${missing.map(f => "stage/" + f).join(", ")}`);
  console.error("(ui/ is written by the Shell and kit work; the engine and the pack alone are not enough)");
  process.exit(1);
}
const read = p => readFileSync(join(root, p), "utf8");
// Verify's data. The engine is the one in --root, the same bytes the page carries. The pack goes through JSON first, as the page's copy does.
const Stage = createRequire(import.meta.url)(join(root, "engine/stage.js"));
let sim;
try { sim = Stage.simulate(JSON.parse(JSON.stringify(pack))); } catch (e) { console.error(`cannot build ${pack.id}: Stage.simulate failed: ${e.message}`); process.exit(1); }
function packSim(r) {
  const word = x => {
    if (x.input != null && x.opt == null) return "(typed)";
    if (typeof x.opt !== "string" || /[|=]/.test(x.opt) || (x.result != null && /[|=]/.test(String(x.result)))) throw new Error(`a route step cannot be packed: ${JSON.stringify(x)}`);
    return x.opt + (x.result ? "=" + x.result : "");
  };
  return { ...r, routes: r.routes.map(rt => ({ ending: rt.ending, count: rt.count, s: rt.steps.map(word).join("|") })) };
}
// "</script" or "<!--" inside inlined code or data would end the block early or change the parse state.
const safe = s => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cssStr = s => String(s).replace(/["\\\n]/g, c => (c === "\n" ? "\\a " : "\\" + c));

const tokens = map => Object.entries(map || {}).map(([k, v]) => `--${k}:${v};`).join("");
const theme = pack.theme || {};
const faces = (theme.fonts || []).map(f => {
  const b64 = fonts[f.file];
  if (b64 == null) { console.error(`cannot build ${pack.id}: font file "${f.file}" is missing`); process.exit(1); }
  const fmt = { ".woff2": "woff2", ".woff": "woff", ".ttf": "truetype", ".otf": "opentype" }[extname(f.file).toLowerCase()];
  return `@font-face{font-family:"${cssStr(f.family)}";font-weight:${f.weight || 400};font-style:${f.style || "normal"};font-display:block;src:url(data:${FONT_TYPES[extname(f.file).toLowerCase()]};base64,${b64}) format("${fmt}");}`;
}).join("\n");
const tokenCss = [
  `:root{color-scheme:light dark;${tokens(theme.light)}}`,
  `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${tokens(theme.dark)}}}`,
  `:root[data-theme="light"]{color-scheme:light;${tokens(theme.light)}}`,
  `:root[data-theme="dark"]{color-scheme:dark;${tokens(theme.dark)}}`,
].join("\n");

let html = read("ui/index.html").split("{{title}}").join(esc(pack.title));
const parts = {
  "<!-- @style -->": `<style>\n${read("ui/style.css").replace(/<\/style/gi, "<\\/style")}\n${faces}\n${tokenCss}\n</style>`,
  "<!-- @pack -->": `<script>\nwindow.PACK = ${safe(JSON.stringify(pack))};\nwindow.ASSETS = ${safe(JSON.stringify(assets))};\nwindow.SIM = ${safe(JSON.stringify(packSim(sim)))};\n</script>`,
  "<!-- @engine -->": `<script>\n${safe(read("engine/stage.js"))}\n</script>`,
  "<!-- @kit -->": `<script>\n${safe(read(`ui/kits/${pack.kit}.js`))}\n</script>`,
  "<!-- @view -->": `<script>\n${safe(read("ui/view.js"))}\n</script>`,
};
const lacking = Object.keys(parts).filter(m => !html.includes(m));
if (lacking.length) {
  console.error(`ui/index.html has no ${lacking.join(", ")} marker`);
  process.exit(1);
}
for (const [marker, block] of Object.entries(parts)) html = html.split(marker).join(block);

const out = flag("--out") || join(here, "dist", pack.id + ".html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`built ${out} (${Math.round(html.length / 1024)} KB)`);
