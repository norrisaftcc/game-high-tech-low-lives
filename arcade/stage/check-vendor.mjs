// Does the vendored Stage match the Fort's?
//   node arcade/stage/check-vendor.mjs
// The Fort checkout is found by the environment variable FORT_STAGE (the Fort's stage/ directory), or by default
// at ../../../games-osr-fort-on-lake/stage, next to this repository.
//
// Prints "vendor matches <fort commit>" and exits 0, or lists the files that differ and exits 1.
// Prints "skip: no Fort checkout" and exits 0 if the source is not there.
//
// What is vendored: engine/, ui/, tools/, packs/test, packs/test-feed, test.mjs, SPEC.md, MOTION.md and GUIDE.md. Nothing else in this directory
// is checked: the packs of this repository (packs/dead-drop), dist/ and this script are ours.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const fort = resolve(process.env.FORT_STAGE || join(here, "../../../games-osr-fort-on-lake/stage"));

const VENDORED = ["engine", "ui", "tools", "packs/test", "packs/test-feed", "test.mjs", "SPEC.md", "MOTION.md", "GUIDE.md"];

if (!existsSync(fort) || !statSync(fort).isDirectory()) {
  console.log("skip: no Fort checkout");
  process.exit(0);
}

// Every file under a path, as paths relative to the stage directory. Skips nothing: a stray file is a difference.
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
  console.log("copy the Fort files over (AGENTS.md, Workflow), or commit the change to the Fort first");
  process.exit(1);
}

let commit = "";
try {
  commit = execFileSync("git", ["-C", fort, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const dirty = execFileSync("git", ["-C", fort, "status", "--porcelain", "--", "."], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (commit && dirty) commit += " (with uncommitted changes)";
} catch (e) { /* no git, or not a checkout: say nothing */ }
console.log("vendor matches" + (commit ? " " + commit : ""));
