// Does the vendored crawler match the Fort's?
//   node arcade/crawler/check-vendor.mjs
// The Fort checkout is found by the environment variable FORT_CRAWLER (the Fort's crawler/ directory), or by default
// at ../../../games-osr-fort-on-lake/crawler, next to this repository.
//
// Prints "vendor matches <fort commit>" and exits 0, or lists the files that differ and exits 1.
// Prints "skip: no Fort checkout" and exits 0 if the source is not there.
//
// What is vendored: engine/, ui/, tools/, packs/test, packs/test-fate, test.mjs and SPEC.md. Nothing else in this directory
// is checked: the packs of this repository (packs/drowned-floors), dist/, the README and this script are ours.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const fort = resolve(process.env.FORT_CRAWLER || join(here, "../../../games-osr-fort-on-lake/crawler"));

const VENDORED = ["engine", "ui", "tools", "packs/test", "packs/test-fate", "test.mjs", "SPEC.md"];

if (!existsSync(fort) || !statSync(fort).isDirectory()) {
  console.log("skip: no Fort checkout");
  process.exit(0);
}

// Every file under a path, as paths relative to the crawler directory. Skips nothing: a stray file is a difference.
function files(root, rel) {
  const full = join(root, rel);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [rel];
  return readdirSync(full).sort().flatMap(name => files(root, join(rel, name)));
}

const names = new Set();
for (const v of VENDORED) {
  for (const f of files(fort, v)) names.add(f);
  for (const f of files(here, v)) names.add(f);
}

const bad = [];
for (const f of [...names].sort()) {
  const a = join(fort, f), b = join(here, f);
  if (!existsSync(a)) bad.push(`${f}: only here (the Fort has no such file)`);
  else if (!existsSync(b)) bad.push(`${f}: missing here`);
  else if (!readFileSync(a).equals(readFileSync(b))) bad.push(`${f}: differs`);
}

if (bad.length) {
  console.log(`vendor differs from ${relative(process.cwd(), fort) || fort}:`);
  for (const line of bad) console.log("  " + line);
  console.log("copy the Fort files over (see arcade/crawler/README.md), or commit the change to the Fort first");
  process.exit(1);
}

let commit = "";
try {
  commit = execFileSync("git", ["-C", fort, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const dirty = execFileSync("git", ["-C", fort, "status", "--porcelain", "--", "."], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (commit && dirty) commit += " (with uncommitted changes)";
} catch (e) { /* no git, or not a checkout: say nothing */ }
console.log("vendor matches" + (commit ? " " + commit : ""));
