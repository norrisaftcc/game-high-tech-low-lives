// Read a pack directory into one object, PACK, plus its assets. See stage/SPEC.md, section 2.
//   loadPack(dir)   -> the pack: pack.json fields plus script, notes, sets, theme and cast (cast only if cast.json exists)
//   loadAssets(dir) -> { assets: { "art/x.svg": "data:image/svg+xml;base64,..." }, fonts: { "fonts/x.woff2": "<base64>" } }
//   loadAll(dir)    -> { pack, assets, fonts }
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

export const JSON_FILES = ["script", "notes", "sets", "theme", "cast"];
export const ART_TYPES = { ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".png": "image/png" };
export const FONT_TYPES = { ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf" };

export function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
}

// Every file under `dir`, as paths relative to `base`, in a stable order.
export function walk(base, dir = base) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(base, p));
    else out.push(relative(base, p).split("\\").join("/"));
  }
  return out;
}

export function loadPack(dir) {
  const pack = readJson(join(dir, "pack.json"));
  for (const name of JSON_FILES) {
    const file = join(dir, name + ".json");
    if (existsSync(file)) pack[name] = readJson(file);
  }
  return pack;
}

export function loadAssets(dir) {
  const assets = {}, fonts = {};
  for (const f of walk(dir, join(dir, "art"))) { // f is relative to the pack dir: "art/x.svg"
    const type = ART_TYPES[extname(f).toLowerCase()];
    if (type) assets[f] = `data:${type};base64,${readFileSync(join(dir, f)).toString("base64")}`;
  }
  for (const f of walk(dir, join(dir, "fonts"))) {
    if (FONT_TYPES[extname(f).toLowerCase()]) fonts[f] = readFileSync(join(dir, f)).toString("base64");
  }
  return { assets, fonts };
}

export function loadAll(dir) {
  return { pack: loadPack(dir), ...loadAssets(dir) };
}
