// Check a pack against crawler/SPEC.md. node crawler/tools/validate.mjs <packdir> [<packdir> ...]
// Prints "OK <id>" (plus warnings and notes) or the errors, and exits non-zero on any error.
import { loadPack } from "./load.mjs";

const VERBS = ["flag", "item", "damage", "heal", "condition", "bonus", "reveal", "fate", "light", "goto", "say"];
const WHO = ["self", "target", "leader", "front", "party", "random", "foes", "foe", "nearest"];
const MODES = ["plan", "act", "fate"];
const TIERS = ["style", "success", "tie", "fail"];
const BUILTIN = { "#": "wall", ".": "floor", "+": "door", "=": "stuck", "L": "locked", "S": "secret", "<": "stairs", ">": "stairs", "~": "water" };
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function validate(pack) {
  const errors = [], warnings = [], notes = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  const obj = v => v && typeof v === "object" && !Array.isArray(v);
  const has = (table, id) => obj(pack[table]) && Object.prototype.hasOwnProperty.call(pack[table], id);
  const R = pack.rules || {};
  const ose = R.resolver === "ose";
  const trackIds = (R.tracks || []).map(t => t.id);
  const statIds = (R.stats || []).map(s => s.id);
  const flagsSet = new Set(), flagsUsed = [];
  const mapEntries = {}; // map id -> [[x, y, where]]
  const entry = (map, x, y, where) => (mapEntries[map] = mapEntries[map] || []).push([x, y, where]);

  // ---- pack.json
  for (const k of ["id", "title", "version"]) if (!pack[k]) err("pack.json", `missing ${k}`);
  if (pack.id && !/^[a-z0-9-]+$/.test(pack.id)) err("pack.json", `id "${pack.id}" is not lower-kebab-case`);
  if (pack.storage != null && !(typeof pack.storage === "string" && /^[a-z0-9.-]+$/.test(pack.storage))) err("pack.json", `storage "${pack.storage}" must be lower-case letters, digits, dots and dashes`);
  if (pack.start?.scene && !has("events", pack.start.scene)) err("pack.json", `start.scene "${pack.start.scene}" is not an event`);

  // ---- rules.json
  if (!["ose", "fate4df"].includes(R.resolver)) err("rules.json", `resolver must be "ose" or "fate4df", not ${JSON.stringify(R.resolver)}`);
  if (!statIds.length) err("rules.json", "stats is empty");
  if (!trackIds.length) err("rules.json", "tracks is empty");
  if (!["dead", "recover"].includes(R.down)) err("rules.json", `down must be "dead" or "recover"`);
  if (!R.endings?.wipe || !has("endings", R.endings.wipe)) err("rules.json", `endings.wipe must name an ending`);
  const light = R.clock?.light || {};
  for (const id of light.order || []) if (!has("items", id)) err("rules.json", `clock.light.order: unknown item "${id}"`);
  if (light.outScene && !has("events", light.outScene)) err("rules.json", `clock.light.outScene "${light.outScene}" is not an event`);
  for (const k of ["newArea", "search", "fight", "rest"]) if (typeof R.clock?.[k] !== "number") err("rules.json", `clock.${k} must be a number`);
  if (!R.clock?.wander?.every) err("rules.json", "clock.wander.every is missing");
  for (const [id, s] of Object.entries(R.skills || {})) {
    if (ose && typeof s.inSix !== "number") err("rules.json", `skills.${id}: ose skills need inSix`);
    if (!ose && (!statIds.includes(s.stat) || typeof s.difficulty !== "number")) err("rules.json", `skills.${id}: fate4df skills need a known stat and a difficulty`);
  }
  if (!ose && !statIds.includes(R.combat?.defense)) err("rules.json", `combat.defense must be a stat`);

  // ---- effects and conditions, wherever they appear
  function checkCheck(where, c) {
    if (!obj(c)) return err(where, "check must be an object");
    if (c.skill) { if (!R.skills?.[c.skill]) err(where, `check.skill "${c.skill}" is not in rules.skills`); }
    else if (c.save) { if (!ose) err(where, "check.save is ose only"); if (!"DWPBS".includes(c.save)) err(where, `bad save "${c.save}"`); }
    else if (c.inSix) { if (!ose) err(where, "check.inSix is ose only"); }
    else if (c.stat) { if (ose) err(where, "check.stat is fate4df only"); if (!statIds.includes(c.stat)) err(where, `unknown stat "${c.stat}"`); if (typeof c.difficulty !== "number") err(where, "check needs a difficulty"); }
    else err(where, "check needs skill, save, inSix or stat");
  }
  function checkEffects(where, e) {
    if (e == null) return;
    if (!obj(e)) return err(where, "effects must be an object");
    for (const k of Object.keys(e)) if (!VERBS.includes(k)) err(where, `unknown effect verb "${k}"`);
    if (e.flag) { for (const f of e.flag.set || []) flagsSet.add(f); }
    if (e.item) for (const part of ["add", "remove"]) for (const id of Object.keys(e.item[part] || {})) if (id !== "gold" && !has("items", id)) err(where, `item.${part}: unknown item "${id}"`);
    for (const v of ["damage", "heal", "condition", "bonus", "fate"]) if (e[v] && e[v].who && !WHO.includes(e[v].who)) err(where, `${v}.who "${e[v].who}" is not one of ${WHO.join(", ")}`);
    if (e.light && e.light.item && !has("items", e.light.item)) err(where, `light.item "${e.light.item}" unknown`);
    if (e.reveal) { if (!has("maps", e.reveal.map)) err(where, `reveal.map "${e.reveal.map}" unknown`); }
    if (e.say && !Array.isArray(e.say)) err(where, "say must be an array of lines");
    const g = e.goto;
    if (g) {
      const keys = Object.keys(g).filter(k => !["x", "y", "facing"].includes(k));
      if (keys.length !== 1) err(where, `goto must have exactly one target, has ${JSON.stringify(keys)}`);
      if (g.scene && !has("events", g.scene)) err(where, `goto.scene "${g.scene}" unknown`);
      if (g.encounter && !has("encounters", g.encounter)) err(where, `goto.encounter "${g.encounter}" unknown`);
      if (g.ending && !has("endings", g.ending)) err(where, `goto.ending "${g.ending}" unknown`);
      if (g.map) { if (!has("maps", g.map)) err(where, `goto.map "${g.map}" unknown`); else entry(g.map, g.x, g.y, where); }
    }
  }
  function checkIf(where, c) {
    if (!c) return;
    for (const f of [...(c.flags || []), ...(c.notFlags || [])]) flagsUsed.push([where, f]);
    for (const id of Object.keys(c.items || {})) if (id !== "gold" && !has("items", id)) err(where, `if.items: unknown item "${id}"`);
    if (c.member && !has("party", "roster") ) err(where, "no roster");
    if (c.member && !pack.party.roster?.[c.member]) err(where, `if.member "${c.member}" is not in the roster`);
    if (c.ability && !has("abilities", c.ability)) err(where, `if.ability "${c.ability}" unknown`);
  }
  function checkOutcome(where, x) {
    if (x.check) {
      checkCheck(where, x.check);
      if (!obj(x.on) || !x.on.success || !x.on.fail) err(where, "a check needs on.success and on.fail");
      for (const t of Object.keys(x.on || {})) { if (!TIERS.includes(t)) err(where, `on.${t} is not a tier`); checkEffects(`${where} on.${t}`, x.on[t]); }
      if (x.effects) err(where, "use on.<tier>, not effects, with a check");
    } else checkEffects(where, x.effects);
  }

  // ---- party.json
  const P = pack.party || {};
  const size = R.party?.size || 4;
  if (!Array.isArray(P.default) || P.default.length !== size) err("party.json", `default must list ${size} ids`);
  for (const id of P.default || []) if (!P.roster?.[id]) err("party.json", `default "${id}" is not in the roster`);
  for (const [id, m] of Object.entries(P.roster || {})) {
    const w = `party.json roster.${id}`;
    if (!m.name) err(w, "missing name");
    if (!obj(m.stats)) err(w, "missing stats");
    else for (const s of statIds) if (typeof m.stats[s] !== "number") err(w, `stats.${s} missing`);
    if (!obj(m.attack)) err(w, "missing attack");
    if (ose) {
      if (typeof m.ac !== "number" || typeof m.hp !== "number") err(w, "ose members need ac and hp (numbers)");
      if (!m.attack?.damage) err(w, "attack.damage missing");
      if (!obj(m.saves)) err(w, "ose members need saves");
    } else {
      if (!statIds.includes(m.attack?.stat)) err(w, "attack.stat must be a stat");
      for (const t of Object.keys(m.tracks || {})) if (!trackIds.includes(t)) err(w, `tracks.${t} is not a track`);
    }
    for (const a of m.abilities || []) if (!has("abilities", a)) err(w, `ability "${a}" unknown`);
    for (const i of Object.keys(m.items || {})) if (!has("items", i)) err(w, `item "${i}" unknown`);
  }

  // ---- bestiary.json
  for (const [id, b] of Object.entries(pack.bestiary || {})) {
    const w = `bestiary.json ${id}`;
    if (!b.name) err(w, "missing name");
    if (ose) {
      for (const k of ["ac", "hd"]) if (b[k] == null) err(w, `missing ${k}`);
      if (!b.hp) err(w, "missing hp");
      if (!b.attack?.damage) err(w, "attack.damage missing");
      if (b.ml == null && !b.breakAt) err(w, "needs ml or breakAt");
      if (!b.oseLine) warn(w, "no oseLine");
      if (!b.note5e) warn(w, "no note5e");
    } else {
      if (typeof b.rating !== "number" || typeof b.stress !== "number") err(w, "fate4df monsters need rating and stress");
      if (typeof b.attack?.rating !== "number" || !trackIds.includes(b.attack?.track)) err(w, "attack needs rating and a known track");
    }
    if (b.aura) { checkCheck(`${w} aura`, b.aura.check); if (!b.aura.condition) err(w, "aura needs a condition"); }
  }

  // ---- encounters.json
  for (const [id, e] of Object.entries(pack.encounters || {})) {
    const w = `encounters.json ${id}`;
    if (!Array.isArray(e.foes) || !e.foes.length) err(w, "foes is empty");
    for (const f of e.foes || []) {
      if (!has("bestiary", f.id)) err(w, `foe "${f.id}" is not in the bestiary`);
      if (f.hp && f.count && f.hp.length !== f.count) err(w, `foe "${f.id}": hp has ${f.hp.length} values, count is ${f.count}`);
    }
    if (e.after && !has("events", e.after)) err(w, `after "${e.after}" unknown`);
    checkEffects(`${w} onWin`, e.onWin);
    checkEffects(`${w} onFlee`, e.onFlee);
    if (obj(e.first)) flagsUsed.push([w, e.first.ifFlag]);
  }

  // ---- items.json, abilities.json
  for (const [id, it] of Object.entries(pack.items || {})) {
    const w = `items.json ${id}`;
    if (!it.name || !it.kind) err(w, "needs name and kind");
    if (it.light?.requires && !has("items", it.light.requires)) err(w, `light.requires "${it.light.requires}" unknown`);
    if (it.use) checkOutcome(`${w} use`, it.use);
  }
  for (const [id, a] of Object.entries(pack.abilities || {})) {
    const w = `abilities.json ${id}`;
    if (!a.name || !a.kind) err(w, "needs name and kind");
    if (a.text != null && typeof a.text !== "string") err(w, "text must be a string");
    if (!["rest", "delve"].includes(a.per)) err(w, `per must be "rest" or "delve"`);
    checkOutcome(w, a);
  }

  // ---- events.json
  for (const [id, s] of Object.entries(pack.events || {})) {
    const w = `events.json ${id}`;
    if (!s.title) err(w, "missing title");
    if (!Array.isArray(s.text)) err(w, "text must be an array of paragraphs");
    for (const t of s.text || []) if (t.length > 400) warn(w, `a paragraph is ${t.length} characters`);
    if (s.notes != null && (!Array.isArray(s.notes) || s.notes.some(t => typeof t !== "string"))) err(w, "notes must be an array of strings");
    for (const t of Array.isArray(s.notes) ? s.notes : []) if (t.length > 400) warn(w, `a note is ${t.length} characters`);
    if (!Array.isArray(s.choices)) { err(w, "choices must be an array"); continue; }
    const seen = new Set();
    for (const c of s.choices) {
      const cw = `${w} choice ${c.id}`;
      if (!c.id || seen.has(c.id)) err(w, `choice id "${c.id}" missing or repeated`);
      seen.add(c.id);
      if (!c.text) err(cw, "missing text");
      if (!MODES.includes(c.mode)) err(cw, `mode must be plan, act or fate`);
      if (c.mode === "plan" && (c.turns || c.check)) err(cw, "a plan choice cannot cost turns or roll");
      if (c.mode === "fate" && !has("abilities", c.ability)) err(cw, `fate choice needs a known ability, not "${c.ability}"`);
      checkIf(cw, c.if);
      checkOutcome(cw, c);
    }
  }

  // ---- hub.json, endings.json
  const H = pack.hub || {};
  if (!H.title || !Array.isArray(H.places) || !H.places.length) err("hub.json", "needs title and places");
  let leaves = false;
  for (const p of H.places || []) for (const a of p.actions || []) {
    const w = `hub.json ${p.id}.${a.id}`;
    if (!["rest", "shop", "scene", "roster"].includes(a.kind)) err(w, `kind "${a.kind}" unknown`);
    if (a.kind === "scene") { if (!has("events", a.scene)) err(w, `scene "${a.scene}" unknown`); else leaves = true; }
    if (a.kind === "shop") for (const s of a.stock || []) if (!has("items", s.item)) err(w, `stock item "${s.item}" unknown`);
    checkIf(w, a.if);
  }
  if (!leaves) err("hub.json", "no scene action, so the party can never leave town");
  for (const f of Object.keys(H.report?.lines || {})) flagsUsed.push(["hub.json report", f]);
  for (const [id, e] of Object.entries(pack.endings || {})) {
    if (!e.title || !["good", "back", "dead"].includes(e.kind) || !Array.isArray(e.text)) err(`endings.json ${id}`, "needs title, kind (good, back, dead) and text[]");
  }

  // ---- maps
  for (const [mid, m] of Object.entries(pack.maps || {})) {
    const w = `maps/${mid}`;
    const g = m.grid || [];
    if (!g.length) { err(w, "grid is empty"); continue; }
    const W = g[0].length, Hh = g.length;
    g.forEach((row, y) => { if (row.length !== W) err(w, `row ${y} is ${row.length} wide, row 0 is ${W}`); });
    const legend = m.legend || {}, cells = m.cells || {}, areas = m.areas || {};
    const at = (x, y) => (y >= 0 && y < Hh && x >= 0 && x < W ? g[y][x] : "#");
    const cellInfo = (x, y) => ({ ...(legend[at(x, y)] || {}), ...(cells[`${x},${y}`] || {}) });
    const kind = (x, y) => { const ch = at(x, y); return legend[ch]?.wall ? "wall" : BUILTIN[ch] || "floor"; };
    const usedAreas = new Set();
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      if (!BUILTIN[ch] && !legend[ch]) err(w, `glyph "${ch}" at ${x},${y} is not built in or in the legend`);
      const info = cellInfo(x, y);
      if (info.area) { usedAreas.add(info.area); if (!areas[info.area]) err(w, `cell ${x},${y} names area "${info.area}", which is not in areas`); }
      if ((ch === "<" || ch === ">") && !cells[`${x},${y}`]?.link) err(w, `stairs at ${x},${y} have no cells["${x},${y}"].link`);
      if (ch === "L" && !has("items", cells[`${x},${y}`]?.key)) err(w, `locked door at ${x},${y} needs cells["${x},${y}"].key, an item`);
    }
    for (const [k, c] of Object.entries(cells)) {
      const [x, y] = k.split(",").map(Number);
      if (!(x >= 0 && x < W && y >= 0 && y < Hh)) err(w, `cells key "${k}" is out of bounds`);
      if (c.event && !has("events", c.event)) err(w, `cells.${k}.event "${c.event}" unknown`);
      if (c.link) {
        const L = c.link;
        if (L.scene && !has("events", L.scene)) err(w, `cells.${k}.link.scene "${L.scene}" unknown`);
        if (L.map) { if (!has("maps", L.map)) err(w, `cells.${k}.link.map "${L.map}" unknown`); else entry(L.map, L.x, L.y, `${w} cells.${k}`); }
        if (!L.map && !L.scene && !L.hub) err(w, `cells.${k}.link needs map, scene or hub`);
      }
    }
    for (const [ak, a] of Object.entries(areas)) {
      if (!a.name) err(w, `area ${ak} has no name`);
      if (!["daylight", "dim", "dark"].includes(a.light)) err(w, `area ${ak}: light must be daylight, dim or dark`);
      if (a.enter && !has("events", a.enter)) err(w, `area ${ak}: enter "${a.enter}" unknown`);
      if (a.search && !has("events", a.search)) err(w, `area ${ak}: search "${a.search}" unknown`);
      if (a.encounter && !has("encounters", a.encounter)) err(w, `area ${ak}: encounter "${a.encounter}" unknown`);
      if (!usedAreas.has(ak)) err(w, `area ${ak} has no cells`);
      if (a.listen?.flag) flagsSet.add(a.listen.flag);
    }
    for (const r of m.wander || []) if (!has("encounters", r.encounter)) err(w, `wander encounter "${r.encounter}" unknown`);
    m.__geo = { W, Hh, at, kind, cellInfo };
  }

  // ---- links and gotos land on passable cells; every area is reachable
  for (const [mid, list] of Object.entries(mapEntries)) {
    const m = pack.maps[mid];
    if (!m?.__geo) continue;
    for (const [x, y, where] of list) {
      if (typeof x !== "number" || typeof y !== "number") { err(where, `goto/link to ${mid} needs x and y`); continue; }
      if (m.__geo.kind(x, y) === "wall") err(where, `lands on a wall at ${mid} ${x},${y}`);
    }
  }
  for (const [mid, m] of Object.entries(pack.maps || {})) {
    if (!m.__geo) continue;
    const { W, Hh, kind, cellInfo } = m.__geo;
    const starts = (mapEntries[mid] || []).filter(([x, y]) => typeof x === "number" && typeof y === "number");
    if (!starts.length) { err(`maps/${mid}`, "nothing links or goes to this map"); continue; }
    const reach = withSecret => {
      const seen = new Set(), q = starts.map(([x, y]) => [x, y]);
      const areasHit = new Set();
      while (q.length) {
        const [x, y] = q.pop(), k = `${x},${y}`;
        if (seen.has(k)) continue;
        const kd = kind(x, y);
        if (kd === "wall" || (kd === "secret" && !withSecret)) continue;
        seen.add(k);
        const a = cellInfo(x, y).area;
        if (a) areasHit.add(a);
        for (const [dx, dy] of DIRS) if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < Hh) q.push([x + dx, y + dy]);
      }
      return areasHit;
    };
    const all = reach(true), open = reach(false);
    for (const ak of Object.keys(m.areas || {})) {
      if (!all.has(ak)) err(`maps/${mid}`, `area ${ak} cannot be reached`);
      else if (!open.has(ak)) notes.push(`maps/${mid}: area ${ak} is reached only through a secret door`);
    }
    delete m.__geo;
  }

  // ---- flags read but never set
  for (const [where, f] of flagsUsed) if (f && !flagsSet.has(f)) err(where, `flag "${f}" is read but never set`);
  if (!Object.keys(pack.theme?.labels || {}).length) warn("theme.json", "no labels; the view will use English defaults");

  return { errors, warnings, notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) { console.error("usage: node crawler/tools/validate.mjs <packdir> [...]"); process.exit(2); }
  let bad = 0;
  for (const dir of dirs) {
    let pack;
    try { pack = loadPack(dir); } catch (e) { console.log(`FAIL ${dir}\n  ${e.message}`); bad++; continue; }
    const { errors, warnings, notes } = validate(pack);
    for (const n of notes) console.log(`  note: ${n}`);
    for (const x of warnings) console.log(`  warning: ${x}`);
    if (errors.length) { console.log(`FAIL ${pack.id || dir} (${errors.length} errors)`); for (const e of errors) console.log(`  ${e}`); bad++; }
    else console.log(`OK ${pack.id}`);
  }
  process.exit(bad ? 1 : 0);
}
