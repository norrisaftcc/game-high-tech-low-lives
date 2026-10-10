// Read a pack directory into one object, PACK. See crawler/SPEC.md, section 1.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

export const PACK_FILES = ["theme", "rules", "party", "bestiary", "encounters", "items", "abilities", "events", "hub", "endings"];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
}

export function loadPack(dir) {
  const pack = readJson(join(dir, "pack.json"));
  for (const name of PACK_FILES) {
    const file = join(dir, name + ".json");
    pack[name] = existsSync(file) ? readJson(file) : {};
  }
  pack.maps = {};
  const mapDir = join(dir, "maps");
  if (existsSync(mapDir)) {
    for (const f of readdirSync(mapDir).filter(f => f.endsWith(".json")).sort()) {
      const map = readJson(join(mapDir, f));
      pack.maps[map.id || basename(f, ".json")] = map;
    }
  }
  return pack;
}
