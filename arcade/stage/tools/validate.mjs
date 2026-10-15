// Check a pack against stage/SPEC.md. node stage/tools/validate.mjs <packdir> [<packdir> ...]
// Prints "OK <id>" (plus warnings) or the errors, and exits 1 on any error.
// Stage.check checks the data; this adds the file checks: every art path and font exists, and both themes
// define the tokens the shell reads (the list in the comment header of ui/style.css).
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, basename, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack, walk, ART_TYPES, FONT_TYPES } from "./load.mjs";

const Stage = createRequire(import.meta.url)("../engine/stage.js");

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = ["test", "test-feed"];
export const REQUIRED = ["pack.json", "script.json", "notes.json", "sets.json", "theme.json", "NOTES.md"];

// "htll." for a pack under game-high-tech-low-lives, else "fort-stage.".
export const storagePrefix = dir => (resolve(dir).includes("game-high-tech-low-lives") ? "htll." : "fort-stage.");

// The colour tokens the shell reads, parsed from the comment header of ui/style.css.
// The header has a "TOKENS THE SHELL READS" block whose "Colour." rows look like
//     bg | paper          page and stage ground      (alternatives: the fixture name | the Blueline name)
//     good, bad           gain and loss labels       (a comma lists separate tokens)
// up to the "Type (optional" line. A row whose text says "optional" is skipped. Each returned row is a list of
// alternative names: a theme meets a row when it defines at least one of them.
export function shellTokens(cssFile = join(here, "..", "ui", "style.css")) {
  const css = readFileSync(cssFile, "utf8");
  const head = css.slice(0, css.indexOf("*/") + 2);
  const lines = head.split("\n");
  const start = lines.findIndex(l => /TOKENS THE SHELL READS/.test(l));
  if (start < 0) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(Type|Motion)\b.*\(optional/.test(line) || /^\s*Everything else/.test(line)) break;
    const m = /^\s{3,}([a-z][a-z0-9-]*(?:\s*[|,]\s*[a-z][a-z0-9-]*)*)\s{2,}(\S.*)$/.exec(line);
    if (!m || /optional/i.test(m[2])) continue;
    for (const part of m[1].split(",")) rows.push(part.split("|").map(x => x.trim()).filter(Boolean));
  }
  return rows;
}

export function validatePack(dir) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  if (!existsSync(dir)) return { id: basename(dir), errors: [`${dir}: no such directory`], warnings };

  let missing = false;
  for (const f of REQUIRED) if (!existsSync(join(dir, f))) { err(f, "is required and is missing"); missing = true; }
  let pack;
  try { pack = loadPack(dir); } catch (e) { return { id: basename(dir), errors: [...errors, e.message], warnings }; }
  const id = pack.id || basename(dir);
  if (missing && !pack.script) return { id, errors, warnings };

  const checked = Stage.check(pack);
  errors.push(...checked.errors);
  warnings.push(...checked.warnings);

  if (pack.id && pack.id !== basename(resolve(dir))) warn("pack.json", `id "${pack.id}" differs from the folder name "${basename(resolve(dir))}"`);
  const prefix = storagePrefix(dir);
  // The two fixtures are vendored byte for byte into HTLL, so they may keep "fort-stage." there.
  const fixture = FIXTURES.includes(pack.id);
  if (typeof pack.storageKey === "string" && !pack.storageKey.startsWith(prefix) && !(fixture && pack.storageKey.startsWith("fort-stage."))) err("pack.json", `storageKey "${pack.storageKey}" must start with "${prefix}" for a pack here`);
  // HTLL keeps each tool under its own name (htll.crawler., htll.stage.), so the usual key there is htll.stage.<id>.
  const usual = (prefix === "htll." ? "htll.stage." : prefix) + pack.id;
  if (typeof pack.storageKey === "string" && pack.id && pack.storageKey.startsWith(prefix) && pack.storageKey !== usual && !fixture) warn("pack.json", `storageKey is usually "${usual}"`);

  // art/
  const artFiles = new Set(walk(dir, join(dir, "art")));
  for (const f of artFiles) if (!ART_TYPES[extname(f).toLowerCase()]) err(f, `art must be svg, jpg, webp or png`);
  const used = new Set();
  const needArt = (where, p) => {
    if (typeof p !== "string" || !p) return;
    used.add(p);
    if (!artFiles.has(p)) err(where, `art file "${p}" does not exist`);
  };
  for (const [sid, s] of Object.entries(pack.sets || {})) {
    (s.layers || []).forEach((l, i) => {
      if (!l || typeof l !== "object") return;
      for (const [k, v] of Object.entries(l)) if (typeof v === "string" && (k === "art" || k === "under" || v.startsWith("art/"))) needArt(`sets.json ${sid} layer ${i} ${k}`, v);
    });
  }
  if (pack.cast) needArt("cast.json sheet", pack.cast.sheet);
  for (const f of artFiles) if (!used.has(f)) warn(f, "is not used by any set or by cast.json");
  const usedSets = new Set();
  for (const sc of pack.script?.scenes || []) {
    usedSets.add(sc.set);
    const eachBeat = bs => (bs || []).forEach(b => b && b.set && usedSets.add(b.set));
    eachBeat(sc.beats);
    for (const g of sc.choices || []) for (const o of g.options || []) {
      eachBeat(o.then);
      for (const r of Object.values(o.roll?.results || {})) eachBeat(r.then);
    }
  }
  for (const e of Object.values(pack.script?.endings || {})) { usedSets.add(e.set); (e.beats || []).forEach(b => b && b.set && usedSets.add(b.set)); }
  for (const sid of Object.keys(pack.sets || {})) if (!usedSets.has(sid)) warn(`sets.json ${sid}`, "is not used by any scene, beat or ending");
  const castUsed = new Set();
  const noteBeats = bs => (bs || []).forEach(b => b && b.speaker && castUsed.add(b.speaker));
  for (const sc of pack.script?.scenes || []) { noteBeats(sc.beats); for (const g of sc.choices || []) for (const o of g.options || []) noteBeats(o.then); }
  for (const pid of Object.keys(pack.cast?.people || {})) if (!castUsed.has(pid)) warn(`cast.json ${pid}`, "never speaks");

  // theme.json
  const th = pack.theme || {};
  for (const mode of ["light", "dark"]) {
    if (!th[mode] || typeof th[mode] !== "object" || !Object.keys(th[mode]).length) { err("theme.json", `${mode} must be a map of custom-property names to colours`); continue; }
    for (const [k, v] of Object.entries(th[mode])) {
      if (!/^[a-z][a-z0-9-]*$/.test(k)) err("theme.json", `${mode}.${k}: names are lower-case, without the leading --`);
      if (typeof v !== "string" || !v.trim() || /[;{}<]/.test(v)) err("theme.json", `${mode}.${k}: value must be a plain CSS value`);
    }
  }
  const cssFile = join(here, "..", "ui", "style.css");
  if (!existsSync(cssFile)) warn("theme.json", "ui/style.css is missing, so the shell's token list was not checked");
  else {
    const rows = shellTokens(cssFile);
    if (!rows.length) err("theme.json", "found no token list in the comment header of ui/style.css (the \"TOKENS THE SHELL READS\" block)");
    for (const mode of ["light", "dark"]) {
      if (!th[mode] || typeof th[mode] !== "object") continue;
      for (const row of rows) if (!row.some(k => k in th[mode])) err("theme.json", row.length === 1 ? `${mode} does not define "${row[0]}", which the shell reads (see the header of ui/style.css)` : `${mode} defines none of ${row.map(k => `"${k}"`).join(" | ")}, which the shell reads (see the header of ui/style.css)`);
    }
  }
  if (th.light && th.dark) for (const k of Object.keys(th.light)) if (!(k in th.dark)) err("theme.json", `dark is missing "${k}", which light defines`);
  const ms = th.mapStyles;
  if (!Array.isArray(ms) || !ms.length || ms.some(m => !["ink", "blueline"].includes(m))) err("theme.json", `mapStyles must be a list drawn from "ink", "blueline"`);
  const fontFiles = new Set(walk(dir, join(dir, "fonts")));
  for (const f of th.fonts || []) {
    if (!f || typeof f.family !== "string" || typeof f.file !== "string") { err("theme.json", `a font needs family and file: ${JSON.stringify(f)}`); continue; }
    if (!FONT_TYPES[extname(f.file).toLowerCase()]) err("theme.json", `font ${f.file}: must be woff2, woff, ttf or otf`);
    else if (!fontFiles.has(f.file)) err("theme.json", `font file "${f.file}" does not exist`);
  }
  const fontsOnDisk = [...fontFiles].filter(f => FONT_TYPES[extname(f).toLowerCase()]);
  if (fontsOnDisk.length && ![...fontFiles].some(f => /(licen[cs]e|ofl|copying)/i.test(f))) err("fonts/", "has fonts but no licence file (LICENSE, OFL.txt)");
  for (const f of fontsOnDisk) if (!(th.fonts || []).some(x => x && x.file === f)) warn(f, "is not named in theme.json fonts");

  return { id, errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) { console.error("usage: node stage/tools/validate.mjs <packdir> [<packdir> ...]"); process.exit(2); }
  let bad = 0;
  for (const dir of dirs) {
    const { id, errors, warnings } = validatePack(dir);
    for (const w of warnings) console.log(`  warn ${w}`);
    if (errors.length) { bad++; console.log(`FAIL ${id}`); for (const e of errors) console.log(`  ${e}`); }
    else console.log(`OK ${id}`);
  }
  process.exit(bad ? 1 : 0);
}
