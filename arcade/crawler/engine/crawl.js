/* The Crawler engine. Contract: crawler/SPEC.md.
   One classic script. Browser: globalThis.Crawl. Node: module.exports.
   Pure: step() clones the state and never touches the input. */
(function (root) {
"use strict";

const VERSION = "0.1";
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const BUILTIN = { "#": "wall", ".": "floor", "+": "door", "=": "stuck", L: "locked", S: "secret", "<": "stairs", ">": "stairs", "~": "water" };
const DOORS = ["door", "stuck", "locked"];
const AUTOMAP = { wall: "#", open: ".", door: "+", stuck: "=", locked: "L", stairs: "<", water: "~" };
const LABELS = { leave: "Leave", light: "Light", turn: "Turn", search: "Search", rest: "Rest", map: "Map", gold: "gold" };

class Refuse extends Error {}
const no = text => { throw new Refuse(text); };
const clone = o => JSON.parse(JSON.stringify(o));
const sgn = n => (n < 0 ? "" + n : "+" + n);

// ---- dice (SPEC section 2) ----
function rand(s) {
  let t = s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const d = (s, n) => 1 + Math.floor(rand(s) * n);
const fudge = s => d(s, 3) - 2;

function dice(s, expr) {
  if (typeof expr === "number") return { dice: [], mod: expr, total: expr };
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ""));
  if (!m) { const n = Number(expr) || 0; return { dice: [], mod: n, total: n }; }
  const out = [];
  for (let i = 0; i < (+m[1] || 1); i++) out.push(d(s, +m[2]));
  const mod = +(m[3] || 0);
  return { dice: out, mod, total: out.reduce((a, b) => a + b, 0) + mod };
}
const oseMod = n => (n <= 3 ? -3 : n <= 5 ? -2 : n <= 8 ? -1 : n <= 12 ? 0 : n <= 15 ? 1 : n <= 17 ? 2 : 3);
const tier = shifts => (shifts >= 3 ? "style" : shifts >= 1 ? "success" : shifts === 0 ? "tie" : "fail");

// ---- context: one per step. s is the working copy of the state. ----
const mkCtx = (pack, s) => ({ pack, R: pack.rules, s, ev: [], pend: { wander: null, dark: false } });
const emit = (c, e) => { c.ev.push(e); return e; };
function log(c, text) {
  const l = c.s.log;
  c.ev.push({ k: "log", text });
  l.push(text);
  if (l.length > 50) l.splice(0, l.length - 50);
}
function say(c, lines) {
  for (const t of lines || []) { log(c, t); if (c.s.scene && !c.s.scene.said.includes(t)) c.s.scene.said.push(t); }
}
const ose = c => c.R.resolver === "ose";
const res = c => RESOLVERS[c.R.resolver];
const label = (c, k) => c.pack.theme?.labels?.[k] || LABELS[k];
const char = (c, id) => c.pack.party.roster[id];
const mem = (c, id) => c.s.party.find(m => m.id === id);
const nameOf = (c, id) => char(c, id).name;
const statMod = (c, n) => (c.R.statMods === "ose" ? oseMod(n) : n);
const maxOf = (c, m, t) => (ose(c) ? char(c, m.id).hp : char(c, m.id).tracks?.[t] ?? 3);
const isFull = (c, m) => c.R.tracks.some(t => (m.marked[t.id] || 0) >= maxOf(c, m, t.id));
const ups = c => c.s.order.map(id => mem(c, id)).filter(m => m && !m.down && !isFull(c, m));
const front = c => ups(c).slice(0, c.R.combat.front);
const have = (c, id) => (id === "gold" ? c.s.gold : c.s.items[id] || 0);
function give(c, id, n) {
  if (id === "gold") { c.s.gold = Math.max(0, c.s.gold + n); return; }
  const v = Math.max(0, (c.s.items[id] || 0) + n);
  if (v) c.s.items[id] = v; else delete c.s.items[id];
}
const isTired = (c, m) => c.s.sinceRest >= (c.R.clock.tired?.every ?? Infinity) || !!(m && m.cond.includes("tired"));
const tiredMod = (c, m) => (isTired(c, m) ? c.R.clock.tired?.mod ?? -1 : 0);
function bonusOf(m, take) {
  const b = m.bonus;
  if (!b) return 0;
  const n = (b.next || 0) + (b.fight || 0);
  if (take) b.next = 0;
  return n;
}

// ---- maps ----
const mapOf = c => c.pack.maps[c.s.pos.map];
const key = (x, y) => x + "," + y;
function info(m, x, y) {
  const ch = m.grid[y]?.[x];
  return ch === undefined ? null : { ch, ...(m.legend?.[ch] || {}), ...(m.cells?.[key(x, y)] || {}) };
}
function kindAt(c, mapId, x, y) {
  const m = c.pack.maps[mapId], i = info(m, x, y);
  if (!i) return "wall";
  const k = i.wall ? "wall" : i.water ? "water" : BUILTIN[i.ch] || "floor";
  const st = c.s.doors[mapId]?.[key(x, y)];
  if (k === "stuck" || k === "locked") return st === "open" ? "door" : k;
  if (k === "secret") return st ? "door" : "wall";
  return k === "floor" ? "open" : k;
}
const passable = k => k === "open" || k === "door" || k === "stairs" || k === "water";
const areaAt = (m, x, y) => info(m, x, y)?.area ?? null;
const inDungeon = c => !!c.s.pos && (["map", "fight", "deathDoor"].includes(c.s.mode) || (c.s.mode === "scene" && c.s.scene.from === "map"));
function here(c) {
  if (!inDungeon(c)) return null;
  const m = mapOf(c), k = areaAt(m, c.s.pos.x, c.s.pos.y);
  return k ? { key: k, def: m.areas[k] } : null;
}
function markSeen(c) {
  const p = c.s.pos, m = mapOf(c), seen = (c.s.seen[p.map] = c.s.seen[p.map] || {});
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (info(m, p.x + dx, p.y + dy)) seen[key(p.x + dx, p.y + dy)] = 1;
}
function setDoor(c, mapId, x, y, st) { (c.s.doors[mapId] = c.s.doors[mapId] || {})[key(x, y)] = st; }

// ---- clock and light (SPEC section 5) ----
function tick(c, n) {
  const s = c.s, w = c.R.clock.wander;
  for (let i = 0; i < n; i++) {
    s.turn++; s.sinceRest++;
    emit(c, { k: "tick", turn: s.turn });
    if (s.light.source && --s.light.left <= 0) {
      log(c, `${s.light.source === "spell" ? "The light" : c.pack.items[s.light.source].name} burns out.`);
      s.light.source = null; s.light.left = 0;
    }
    lightCheck(c);
    if (w && s.turn % w.every === 0 && !c.pend.wander && !s.fight && inDungeon(c)) wanderCheck(c);
  }
}
function wanderCheck(c) {
  const w = c.R.clock.wander, roll = d(c.s, 6), hit = roll <= w.inSix;
  emit(c, { k: "wander", roll, hit });
  const table = mapOf(c).wander || [];
  if (!hit || !table.length) return;
  let r = d(c.s, table.reduce((a, e) => a + (e.weight || 1), 0));
  for (const e of table) if ((r -= e.weight || 1) <= 0) { c.pend.wander = e.encounter; return; }
}
function lightItem(c) {
  const L = c.s.light;
  for (const id of c.R.clock.light.order) {
    const it = c.pack.items[id];
    if (!it?.light) continue;
    if (L.stash[id] > 0 || (have(c, id) > 0 && (!it.light.requires || have(c, it.light.requires) > 0))) return id;
  }
  return L.stash.spell > 0 ? "spell" : null;
}
function lightUp(c, id, turns) {
  const L = c.s.light;
  if (L.source && L.source !== id && L.left > 0) L.stash[L.source] = L.left;
  if (turns == null) {
    if (L.stash[id] > 0) turns = L.stash[id];
    else { turns = c.pack.items[id].light.turns; give(c, id, -1); }
  }
  delete L.stash[id];
  L.source = id; L.left = turns;
  delete c.s.done["@dark"];
  const text = id === "spell" ? "A light kindles." : `You light the ${c.pack.items[id].name}.`;
  emit(c, { k: "light", text }); log(c, text);
}
function snuff(c) {
  const L = c.s.light;
  if (L.source) { L.stash[L.source] = L.left; log(c, "You snuff the light."); }
  L.source = null; L.left = 0;
  delete c.s.done["@dark"];
}
function lightCheck(c) {
  const a = here(c), s = c.s;
  if (!a || a.def.light !== "dark" || s.light.source) return;
  const id = lightItem(c);
  if (id) return lightUp(c, id);
  if (!s.done["@dark"]) { s.done["@dark"] = true; c.pend.dark = true; }
}
const dark = c => { const a = here(c); return !!a && a.def.light === "dark" && !c.s.light.source; };

// ---- effects: the ten verbs (SPEC section 6) ----
function refs(c, who, ctx, n) {
  const s = c.s, u = ups(c), foes = foesOf(c), live = () => foes.map((f, i) => (alive(f) ? { f: i } : null)).filter(Boolean);
  const mr = m => (m ? [{ m }] : []);
  switch (who) {
    case "self": return mr(mem(c, ctx.self));
    case "target": return ctx.target != null ? mr(mem(c, ctx.target)) : ctx.foe != null && foes[ctx.foe] ? [{ f: ctx.foe }] : [];
    case "leader": return u.slice(0, 1).map(m => ({ m }));
    case "front": return front(c).map(m => ({ m }));
    case "party": return u.map(m => ({ m }));
    case "random": return u.length ? mr(u[d(s, u.length) - 1]) : [];
    case "foes": return live();
    case "foe": return ctx.foe != null && foes[ctx.foe] && alive(foes[ctx.foe]) ? [{ f: ctx.foe }] : [];
    case "nearest": return live().slice(0, n || 1);
    default: return [];
  }
}
function apply(c, e, ctx = {}) {
  const s = c.s;
  if (!e) return;
  if (e.flag) {
    for (const f of e.flag.set || []) s.flags[f] = true;
    for (const f of e.flag.unset || []) delete s.flags[f];
  }
  if (e.item) {
    for (const [id, n] of Object.entries(e.item.add || {})) give(c, id, n);
    for (const [id, n] of Object.entries(e.item.remove || {})) give(c, id, -n);
  }
  const w = x => x.who || (ctx.foe != null ? "foe" : ctx.target != null ? "target" : "leader");
  if (e.damage) for (const r of refs(c, w(e.damage), ctx, e.damage.n)) res(c).harm(c, r, e.damage.track, dice(s, e.damage.amount).total);
  if (e.heal) for (const r of refs(c, w(e.heal), ctx, e.heal.n)) heal(c, r, e.heal.track, dice(s, e.heal.amount).total);
  if (e.condition) condition(c, e.condition, ctx);
  if (e.bonus) {
    for (const r of refs(c, e.bonus.who || "self", ctx).filter(r => r.m)) {
      const b = (r.m.bonus = r.m.bonus || { next: 0, fight: 0 });
      b[e.bonus.scope || "next"] += e.bonus.amount;
    }
  }
  if (e.reveal) {
    for (const k of e.reveal.cells || []) {
      const [x, y] = k.split(",").map(Number), mp = c.pack.maps[e.reveal.map];
      if (info(mp, x, y)?.ch === "S" && !s.doors[e.reveal.map]?.[k]) setDoor(c, e.reveal.map, x, y, "found");
      (s.seen[e.reveal.map] = s.seen[e.reveal.map] || {})[k] = 1;
    }
  }
  if (e.fate) for (const r of refs(c, e.fate.who || "self", ctx).filter(r => r.m)) r.m.fate = Math.max(0, r.m.fate + e.fate.amount);
  if (e.light) { if (e.light.item) lightUp(c, e.light.item); else lightUp(c, "spell", e.light.turns); }
  if (e.say) say(c, e.say);
  if (e.goto) go(c, e.goto);
}
function heal(c, r, track, n) {
  if (r.f != null) { const f = foesOf(c)[r.f]; f.marked = Math.max(0, f.marked - n); return; }
  const m = r.m;
  if (m.dead) return;
  let left = n;
  const ids = track ? [track] : c.R.tracks.map(t => t.id).sort((a, b) => (m.marked[b] || 0) - (m.marked[a] || 0));
  for (const t of ids) {
    const take = Math.min(left, m.marked[t] || 0);
    if (!take) continue;
    m.marked[t] -= take; left -= take;
    emit(c, { k: "heal", who: m.id, track: t, amount: take });
  }
  if (m.down && !isFull(c, m)) { m.down = false; if (!c.s.order.includes(m.id)) c.s.order.push(m.id); }
}
function setCond(c, r, e) {
  if (r.f != null) { const f = foesOf(c)[r.f]; f.state = e.add || "awake"; return; }
  const cond = r.m.cond;
  if (e.add && !cond.includes(e.add)) cond.push(e.add);
  if (e.remove) r.m.cond = cond.filter(x => x !== e.remove);
}
function condition(c, e, ctx) {
  if (e.who === "foes" && e.budget != null) {
    const b = dice(c.s, e.budget);
    emit(c, { k: "roll", who: ctx.self || "party", what: "budget", dice: b.dice, mod: b.mod, total: b.total, target: null, tier: null });
    let left = b.total;
    for (const r of refs(c, "foes", ctx)) {
      const hd = c.pack.bestiary[foesOf(c)[r.f].id].hd ?? 1;
      if (hd > left) break;
      left -= hd; setCond(c, r, e);
      log(c, `The ${foeName(c, r.f)} ${e.add === "asleep" ? "falls asleep" : "is " + e.add}.`);
    }
    return;
  }
  for (const r of refs(c, e.who || "self", ctx)) setCond(c, r, e);
}

// ---- goto and scenes ----
function go(c, g) {
  const s = c.s;
  if (g.close) closeScene(c);
  else if (g.scene) openScene(c, g.scene, s.mode === "hub" ? "hub" : "map");
  else if (g.map) arrive(c, g);
  else if (g.hub) toHub(c);
  else if (g.encounter) { s.scene = null; startFight(c, g.encounter, {}); }
  else if (g.ending) finish(c, g.ending);
}
function closeScene(c) {
  const sc = c.s.scene;
  if (!sc) return;
  c.s.scene = null;
  c.s.mode = sc.from === "hub" ? "hub" : "map";
}
function openScene(c, id, from) {
  const s = c.s, def = c.pack.events[id];
  if (!def) return;
  from = s.scene ? s.scene.from : from;
  s.scene = { id, said: [], taken: [], from, gate: false };
  s.mode = "scene";
  const modes = def.choices.map(x => x.mode);
  if (modes.includes("plan") && modes.includes("act") && !s.done["@gate"]) { s.done["@gate"] = true; s.scene.gate = true; }
  emit(c, { k: "scene", id });
}
function toHub(c) {
  const s = c.s;
  s.scene = null; s.fight = null; s.mode = "hub";
  snuff(c);
  log(c, "You are home.");
}
function finish(c, id) {
  const s = c.s;
  s.mode = "ending"; s.ending = id; s.scene = null; s.fight = null;
  emit(c, { k: "ending", id });
}
function arrive(c, g) {
  const s = c.s, fromDungeon = inDungeon(c);
  s.scene = null; s.mode = "map";
  const pos = { map: g.map, x: g.x, y: g.y, facing: g.facing || 0 };
  s.prev = fromDungeon ? { ...s.pos } : { ...pos };
  s.pos = pos;
  land(c, null);
}
// The party is on a new cell: light, area entry, scene or fight, cell event.
function land(c, oldArea, retreat) {
  const s = c.s, p = s.pos, m = mapOf(c), k = areaAt(m, p.x, p.y), a = k && m.areas[k];
  markSeen(c);
  if (a && a.light === "daylight") snuff(c);
  lightCheck(c);
  if (retreat) return;
  if (a && k !== oldArea) {
    const first = !s.visited[p.map]?.[k];
    if (first) {
      (s.visited[p.map] = s.visited[p.map] || {})[k] = true;
      tick(c, c.R.clock.newArea);
    }
    if (first && a.enter) openScene(c, a.enter, "map");
    else if (a.encounter && !s.done[a.encounter] && !c.pend.wander) startFight(c, a.encounter, {});
  }
  const ev = m.cells?.[key(p.x, p.y)]?.event, ek = "@cell:" + p.map + ":" + key(p.x, p.y);
  if (ev && !s.done[ek] && s.mode === "map") { s.done[ek] = true; openScene(c, ev, "map"); }
}

// ---- conditions on choices ----
function unmet(c, w) {
  const s = c.s;
  if (!w) return null;
  for (const f of w.flags || []) if (!s.flags[f]) return "Not yet.";
  for (const f of w.notFlags || []) if (s.flags[f]) return "Too late.";
  for (const [id, n] of Object.entries(w.items || {})) if (have(c, id) < n) return `Need ${n} ${c.pack.items[id]?.name || id}.`;
  if (w.member && !ups(c).some(m => m.id === w.member)) return `${char(c, w.member)?.name || w.member} must be here.`;
  if (w.ability && !fateUser(c, w.ability, true)) return `No ${c.pack.abilities[w.ability]?.name || w.ability} left.`;
  if (w.fate != null && !s.party.some(m => !m.down && m.fate >= w.fate)) return `Need ${w.fate} Fate.`;
  if (w.gold != null && s.gold < w.gold) return `Need ${w.gold} ${label(c, "gold")}.`;
  if (w.visited && !Object.values(s.visited).some(v => v[w.visited])) return "Not seen yet.";
  return null;
}
function fateUser(c, aid, anyKind) {
  const a = c.pack.abilities[aid];
  if (!a || (!anyKind && a.kind !== "fate")) return null;
  return ups(c).find(m => char(c, m.id).abilities?.includes(aid) && (m.used[aid] || 0) < (a.uses || 1)) || null;
}
function sceneChoices(c) {
  const sc = c.s.scene, def = c.pack.events[sc.id], out = [];
  for (const ch of def.choices) {
    let why = ch.once && sc.taken.includes(ch.id) ? "Done." : unmet(c, ch.if);   // a taken once-choice stays in place, greyed, so the numbers hold
    if (!why && ch.mode === "fate" && !fateUser(c, ch.ability)) why = `No ${c.pack.abilities[ch.ability]?.name || ch.ability} left.`;
    out.push({ def: ch, id: ch.id, text: ch.text, mode: ch.mode, enabled: !why, reason: why || "" });
  }
  if (sc.from === "map" && !def.noLeave && !def.choices.some(x => x.id === "leave")) {
    out.push({ id: "leave", text: label(c, "leave"), mode: "plan", enabled: true, reason: "", leave: true });
  }
  return out;
}
const pickOn = (on, t) => (on ? on[t] || (t === "style" || t === "tie" ? on.success : null) : null);
// A check plus on{} tiers, or plain effects. Used by choices, abilities and items.
function resolve(c, x, ctx) {
  if (x.check) {
    const t = res(c).check(c, x.check, ctx);
    apply(c, pickOn(x.on, t), ctx);
  } else apply(c, x.effects, ctx);
}
function choose(c, cmd) {
  const sc = c.s.scene, ch = sceneChoices(c).find(x => x.id === cmd.id);
  if (!ch) no("No such choice.");
  if (!ch.enabled) no(ch.reason || "Not now.");
  if (ch.leave) return closeScene(c);
  const def = ch.def, ctx = { self: ups(c)[0]?.id };
  if (!sc.taken.includes(def.id)) sc.taken.push(def.id);
  say(c, def.say);
  if (def.mode === "plan") apply(c, def.effects, ctx);
  else if (def.mode === "fate") {
    const m = fateUser(c, def.ability);
    m.used[def.ability] = (m.used[def.ability] || 0) + 1;
    ctx.self = m.id;
    log(c, `${nameOf(c, m.id)}: ${c.pack.abilities[def.ability].name}.`);
    resolve(c, def, ctx);
  } else { tick(c, def.turns || 0); resolve(c, def, ctx); }
}

// ---- map commands ----
function facingCell(c) {
  const p = c.s.pos, [dx, dy] = DIRS[p.facing];
  return { x: p.x + dx, y: p.y + dy, dx, dy };
}
function move(c, dir) {
  const s = c.s, p = s.pos, step = { forward: 0, right: 1, back: 2, left: 3 }[dir];
  if (step == null) no("Move where?");
  const [dx, dy] = DIRS[(p.facing + step) % 4], tx = p.x + dx, ty = p.y + dy, m = mapOf(c);
  const k = kindAt(c, p.map, tx, ty), bump = text => { emit(c, { k: "bump", text }); log(c, text); };
  if (k === "wall") return bump("A wall.");
  if (k === "stuck") return bump("The door is stuck.");
  if (k === "locked") return bump("The door is locked.");
  const link = m.cells?.[key(tx, ty)]?.link;
  if (link) return useLink(c, link);
  if (k === "door" && s.doors[p.map]?.[key(tx, ty)] !== "open") { setDoor(c, p.map, tx, ty, "open"); log(c, "You open the door."); }
  const oldArea = areaAt(m, p.x, p.y);
  s.prev = { map: p.map, x: p.x, y: p.y, facing: p.facing };
  p.x = tx; p.y = ty;
  emit(c, { k: "move" });
  land(c, oldArea);
}
function useLink(c, L) {
  emit(c, { k: "move" });
  if (L.hub) toHub(c);
  else if (L.scene) openScene(c, L.scene, "map");
  else arrive(c, L);
}
function act(c) {
  const s = c.s, p = s.pos, m = mapOf(c), f = facingCell(c), k = kindAt(c, p.map, f.x, f.y), cell = m.cells?.[key(f.x, f.y)] || {};
  if (k === "wall") no("Nothing to do here.");
  if (cell.link) return useLink(c, cell.link);
  const st = s.doors[p.map]?.[key(f.x, f.y)];
  if (k === "stuck") {
    const t = res(c).check(c, { skill: "forceDoor" });
    if (t !== "fail") { setDoor(c, p.map, f.x, f.y, "open"); log(c, "The door gives way."); } else log(c, "The door holds.");
    if (c.R.clock.wander?.onNoise) wanderCheck(c);
  } else if (k === "locked") {
    if (have(c, cell.key) > 0) { setDoor(c, p.map, f.x, f.y, "open"); log(c, "The key turns."); } else no("The door is locked.");
  } else if (k === "door" && st !== "open") { setDoor(c, p.map, f.x, f.y, "open"); log(c, "You open the door."); }
  else no("Nothing to do here.");
}
function search(c) {
  const s = c.s, p = s.pos, m = mapOf(c), k = areaAt(m, p.x, p.y);
  tick(c, c.R.clock.search);
  let found = false;
  if (k) {
    for (let y = 0; y < m.grid.length; y++) for (let x = 0; x < m.grid[y].length; x++) {
      if (info(m, x, y).ch !== "S" || s.doors[p.map]?.[key(x, y)]) continue;
      if (!DIRS.some(([dx, dy]) => areaAt(m, x + dx, y + dy) === k)) continue;
      if (res(c).check(c, { skill: "search" }) !== "fail") {
        setDoor(c, p.map, x, y, "found"); found = true;
        (s.seen[p.map] = s.seen[p.map] || {})[key(x, y)] = 1;
        log(c, "You find a hidden door.");
      }
    }
  }
  if (!found) log(c, "You find nothing.");
  const sk = "@search:" + p.map + ":" + k;
  if (k && m.areas[k].search && !s.done[sk]) { s.done[sk] = true; openScene(c, m.areas[k].search, "map"); }
}
function listen(c) {
  const p = c.s.pos, m = mapOf(c), f = facingCell(c);
  if (!DOORS.includes(kindAt(c, p.map, f.x, f.y))) no("No door ahead.");
  tick(c, c.R.clock.listen || 0);
  if (res(c).check(c, { skill: "listen" }) !== "fail") {
    const a = areaAt(m, f.x + f.dx, f.y + f.dy), L = a && m.areas[a].listen;
    if (L) { if (L.flag) c.s.flags[L.flag] = true; return say(c, L.say); }
  }
  log(c, "You hear nothing.");
}
function rest(c) {
  tick(c, c.R.clock.rest);
  c.s.sinceRest = 0;
  log(c, "You rest.");
}

// ---- abilities and items ----
const useMode = c => (c.s.mode === "fight" ? "fight" : "map");
function abilityBase(c, m, aid) {
  const a = c.pack.abilities[aid];
  if (!a || !char(c, m.id).abilities?.includes(aid)) return "Not known.";
  if (a.kind === "fate") return "Only through a choice.";
  if (a.when !== "any" && a.when !== useMode(c)) return "Not now.";
  if ((m.used[aid] || 0) >= (a.uses || 1)) return "Used up.";
  return null;
}
const abilityWhy = (c, m, aid, target) => abilityBase(c, m, aid) || targetWhy(c, c.pack.abilities[aid].target, target);
function targetWhy(c, kind, target) {
  const foes = foesOf(c);
  if (kind === "ally" && !(mem(c, target) && !mem(c, target).dead)) return "Pick an ally.";
  if (kind === "foe" && !(foes[target] && alive(foes[target]))) return "Pick a foe.";
  if (kind === "foes" && !foes.some(alive)) return "No foes.";
  return null;
}
function itemBase(c, id) {
  const it = c.pack.items[id];
  if (!it?.use || have(c, id) < 1) return "Cannot use that.";
  if (it.use.when !== "any" && it.use.when !== useMode(c)) return "Not now.";
  return null;
}
const itemWhy = (c, m, id, target) => itemBase(c, id) || targetWhy(c, c.pack.items[id].use.target, target);
function useAbility(c, m, aid, target) {
  const a = c.pack.abilities[aid];
  m.used[aid] = (m.used[aid] || 0) + 1;
  log(c, `${nameOf(c, m.id)}: ${a.name}.`);
  resolve(c, a, { self: m.id, target: a.target === "ally" ? target : null, foe: a.target === "foe" ? target : null });
}
function useItem(c, m, id, target) {
  const it = c.pack.items[id];
  log(c, `${nameOf(c, m.id)} uses ${it.name}.`);
  resolve(c, it.use, { self: m.id, target: it.use.target === "ally" ? target : null, foe: it.use.target === "foe" ? target : null });
}
function useCmd(c, cmd) {
  const m = ups(c).find(x => x.id === cmd.member);
  if (!m) no("That member cannot act.");
  const why = cmd.ability ? abilityWhy(c, m, cmd.ability, cmd.target) : cmd.item ? itemWhy(c, m, cmd.item, cmd.target) : "Use what?";
  if (why) no(why);
  if (cmd.ability) useAbility(c, m, cmd.ability, cmd.target); else useItem(c, m, cmd.item, cmd.target);
}

// ---- harm, down, death's door ----
function mark(c, r, track, n, max) {
  const s = c.s;
  if (r.f != null) {
    const f = foesOf(c)[r.f], was = alive(f);
    f.marked += n;
    emit(c, { k: "harm", who: "enemy:" + r.f, track: track || c.R.tracks[0].id, amount: n });
    if (was && !alive(f)) log(c, `The ${foeName(c, r.f)} falls.`);
    return;
  }
  const m = r.m, before = m.marked[track] || 0, cap = s.fight?.nonLethal ? max - 1 : max;
  const after = Math.max(before, Math.min(cap, before + n));
  m.marked[track] = after;
  if (after > before) emit(c, { k: "harm", who: m.id, track, amount: after - before });
}
function harm(c, r, track, n) {
  const t = track || c.R.tracks[0].id;
  mark(c, r, t, n, r.m ? maxOf(c, r.m, t) : 0);
}
function drop(c, m) {
  m.down = true;
  if (c.R.down === "dead") m.dead = true;
  c.s.order = c.s.order.filter(id => id !== m.id);
  emit(c, { k: "down", who: m.id });
  log(c, `${nameOf(c, m.id)} ${m.dead ? "is dead" : "is down"}.`);
}
const atDoor = c => c.s.party.filter(m => !m.down && isFull(c, m));
function cheat(c) {
  const m = atDoor(c)[0];
  m.fate -= c.R.fate.cheatDeath;
  for (const t of c.R.tracks) if ((m.marked[t.id] || 0) >= maxOf(c, m, t.id)) m.marked[t.id] = maxOf(c, m, t.id) - 1;
  log(c, `${nameOf(c, m.id)} stays up.`);
}
// After every command: who is down, who is at death's door, wipe, and what was queued.
function settle(c) {
  const s = c.s;
  if (s.mode === "roster" || s.mode === "ending") return;
  for (const m of s.party) if (!m.down && isFull(c, m) && m.fate < c.R.fate.cheatDeath) drop(c, m);
  if (atDoor(c).length) { if (c.pend.wander) s.queued = c.pend.wander; s.mode = "deathDoor"; return; }
  if (s.party.every(m => m.down)) return finish(c, c.R.endings.wipe);
  if (s.mode === "deathDoor") s.mode = s.fight ? "fight" : s.scene ? "scene" : "map";
  const queued = c.pend.wander || s.queued || null;
  s.queued = null;
  if (queued) {
    if (s.mode === "map") startFight(c, queued, { wander: true });
    else if (inDungeon(c)) s.queued = queued;
  }
  if (c.pend.dark) {
    if (s.mode === "map") openScene(c, c.R.clock.light.outScene, "map"); else delete s.done["@dark"];
  }
}

// ---- fights ----
const alive = f => f.marked < f.hp && f.state !== "fled";
const foesOf = c => (c.s.fight ? c.s.foes[c.s.fight.enc] : []);
const foeName = (c, i) => c.pack.bestiary[foesOf(c)[i].id].name;
function buildFoes(c, enc) {
  const out = [], seen = {};
  for (const e of enc.foes) {
    const mon = c.pack.bestiary[e.id];
    for (let i = 0; i < (e.count || 1); i++) {
      const n = (seen[e.id] = (seen[e.id] || 0) + 1) - 1;
      let hp = e.hp?.[i];
      if (hp == null) hp = !ose(c) ? mon.stress : Array.isArray(mon.hp) ? mon.hp[n % mon.hp.length] : dice(c.s, mon.hp).total;
      out.push({ id: e.id, hp, marked: 0, state: "awake" });
    }
  }
  return out;
}
function startFight(c, id, o) {
  const s = c.s, enc = c.pack.encounters[id];
  if (!s.foes[id]) s.foes[id] = buildFoes(c, enc);
  let first = enc.first || "party";
  if (typeof first === "object") first = s.flags[first.ifFlag] ? first.then : first.else;
  s.scene = null; s.mode = "fight";
  s.fight = { enc: id, round: 0, first, lastMiss: null, after: enc.after || null, wander: !!o.wander, nonLethal: !!enc.nonLethal, morale: 0 };
  for (const t of enc.text || []) log(c, t);
  emit(c, { k: "fight", phase: "start" });
}
function endFight(c, result) {
  const s = c.s, f = s.fight, enc = c.pack.encounters[f.enc];
  tick(c, c.R.clock.fight);   // the fight's turn is charged when it ends, so a fight on turn 6 is not played tired
  emit(c, { k: "fight", phase: "end", result });
  for (const m of s.party) if (m.bonus) m.bonus.fight = 0;
  s.fight = null; s.mode = "map";
  if (result === "win" || f.wander) delete s.foes[f.enc];
  if (result === "win") {
    if (!f.wander) s.done[f.enc] = true;
    apply(c, enc.onWin);
    if (f.after && s.mode === "map") openScene(c, f.after, "map");
  } else {
    s.pos = { ...s.prev };
    emit(c, { k: "move" });
    land(c, null, true);
    apply(c, enc.onFlee);
  }
}
function checkFoes(c) {
  const f = c.s.fight, foes = foesOf(c);
  if (!foes.some(alive)) return endFight(c, "win");
  const dead = foes.filter(x => x.marked >= x.hp).length, mon = c.pack.bestiary[foes[0].id], b = mon.breakAt;
  let broken = false;
  if (b && b.dead != null) broken = dead >= b.dead;
  else if (b && b.marked != null) broken = foes.reduce((a, x) => a + x.marked, 0) >= b.marked;
  else if (ose(c) && mon.ml != null && dead) {
    const first = !(f.morale & 1), half = dead * 2 >= foes.length && !(f.morale & 2);
    if (first || half) {
      f.morale |= first ? 1 : 2;
      if (dead * 2 >= foes.length) f.morale |= 2;
      const r = dice(c.s, "2d6");
      broken = r.total > mon.ml;
      emit(c, { k: "roll", who: "enemy:0", what: "morale", dice: r.dice, mod: 0, total: r.total, target: mon.ml, tier: broken ? "fail" : "success" });
    }
  }
  if (!broken) return;
  foes.forEach(x => { if (alive(x)) x.state = "fled"; });
  log(c, "The rest flee.");
  endFight(c, "win");
}
const canMelee = (c, m) => front(c).includes(m) || !!char(c, m.id).attack.ranged;
function checkOrder(c, m, o) {
  const foes = foesOf(c);
  if (o.act === "fight") {
    if (!canMelee(c, m)) no(`${nameOf(c, m.id)} is in the back rank.`);
    if (o.target != null && !(foes[o.target] && alive(foes[o.target]))) no("No such foe.");
  } else if (o.act === "ability") {
    const why = abilityWhy(c, m, o.ability, o.target);
    if (why) no(why);
  } else if (o.act === "item") {
    const why = itemWhy(c, m, o.item, o.target);
    if (why) no(why);
  } else if (o.act !== "guard" && o.act !== "run") no("Unknown order.");
}
const firstFoe = c => foesOf(c).findIndex(alive);
function strike(c, m, o) {
  const foes = foesOf(c);
  const fi = o.target != null && alive(foes[o.target]) ? o.target : firstFoe(c);
  if (res(c).attack(c, m, fi) === "fail") c.s.fight.lastMiss = { member: m.id, order: { ...o, target: fi } };
}
function playRound(c, cmd) {
  const s = c.s, f = s.fight, by = {};
  if (!Array.isArray(cmd.orders)) no("Give orders.");
  const acting = ups(c).filter(m => !m.cond.includes("asleep"));
  for (const o of cmd.orders) {
    const m = o && acting.find(x => x.id === o.member);
    if (!m) no("That member cannot act.");
    if (by[m.id]) no("One order for each member.");
    checkOrder(c, m, o);
    by[m.id] = o;
  }
  for (const m of acting) by[m.id] = by[m.id] || { member: m.id, act: canMelee(c, m) ? "fight" : "guard" };
  f.round++; f.lastMiss = null;
  const guards = new Set(Object.values(by).filter(o => o.act === "guard").map(o => o.member));
  for (const foe of foesOf(c)) {
    const au = c.pack.bestiary[foe.id].aura;
    if (!au || !alive(foe) || foe.state === "asleep") continue;
    for (const m of ups(c)) {
      if (by[m.id]?.act === au.avoid) continue;
      if (res(c).check(c, au.check, { who: m.id }) === "fail" && !m.cond.includes(au.condition)) m.cond.push(au.condition);
    }
  }
  const foesFirst = f.round === 1 && f.first === "foes";
  if (foesFirst) foePhase(c, guards);
  if (partyPhase(c, by) === "flee") return endFight(c, "flee");
  checkFoes(c);
  if (s.fight && !foesFirst) { foePhase(c, guards); if (s.fight) checkFoes(c); }
}
function partyPhase(c, by) {
  let fled = null;
  for (const id of c.s.order.slice()) {
    const m = mem(c, id), o = by[id];
    if (!o || m.down || isFull(c, m)) continue;
    if (!foesOf(c).some(alive)) break;
    if (o.act === "fight") strike(c, m, o);
    else if (o.act === "ability") useAbility(c, m, o.ability, retarget(c, c.pack.abilities[o.ability].target, o.target));
    else if (o.act === "item") useItem(c, m, o.item, retarget(c, c.pack.items[o.item].use.target, o.target));
    else if (o.act === "guard") log(c, `${nameOf(c, id)} guards.`);
    else if (o.act === "run") {
      if (fled == null) fled = res(c).check(c, c.R.combat.flee) !== "fail";
      log(c, fled ? `${nameOf(c, id)} runs.` : `${nameOf(c, id)} cannot get away.`);
      if (fled) return "flee";
    }
  }
  return null;
}
const retarget = (c, kind, t) => (kind === "foe" && !alive(foesOf(c)[t]) ? firstFoe(c) : t);
function foePhase(c, guards) {
  const s = c.s, enc = c.pack.encounters[s.fight.enc], reach = enc.reach ?? c.R.combat.reach ?? c.R.combat.front;
  foesOf(c).forEach((foe, i) => {
    if (!alive(foe) || foe.state === "asleep") return;
    const pool = ups(c).slice(0, reach);
    if (pool.length) { const m = pool[d(s, pool.length) - 1]; res(c).defend(c, i, m, guards.has(m.id)); }
  });
}
function reroll(c) {
  const f = c.s.fight, lm = f.lastMiss, m = lm && ups(c).find(x => x.id === lm.member);
  if (!m) no("Nothing to reroll.");
  if (m.fate < c.R.fate.reroll) no("Not enough Fate.");
  const foes = foesOf(c), fi = alive(foes[lm.order.target]) ? lm.order.target : firstFoe(c);
  m.fate -= c.R.fate.reroll; f.lastMiss = null;
  log(c, `${nameOf(c, m.id)} spends Fate and tries again.`);
  res(c).attack(c, m, fi);
  checkFoes(c);
}

// ---- the two resolvers: check, attack, defend, harm ----
const rollEvt = (c, who, what, dice, mod, total, target, t) => emit(c, { k: "roll", who, what, dice, mod, total, target, tier: t });
const symbols = ds => ds.map(x => (x > 0 ? "+" : x < 0 ? "-" : "0")).join("");

const OSE = {
  check(c, spec, ctx = {}) {
    const s = c.s;
    if (spec.save) {
      const m = mem(c, ctx.who) || mem(c, spec.who) || mem(c, ctx.self) || ups(c)[0];
      const need = char(c, m.id).saves[spec.save], r = d(s, 20), t = r >= need ? "success" : "fail";
      rollEvt(c, m.id, "save " + spec.save, [r], 0, r, need, t);
      return t;
    }
    let chance = spec.inSix, who = "party";
    if (spec.skill) {
      const pool = ctx.who ? [mem(c, ctx.who)] : ups(c);
      const explicit = pool.map(m => char(c, m.id).skills?.[spec.skill]);
      const best = Math.max(...explicit.map(n => (n == null ? -1 : n)));
      chance = best >= 0 ? best : c.R.skills[spec.skill].inSix;
      who = (pool[Math.max(0, explicit.indexOf(best))] || pool[0]).id;
    }
    const r = d(s, 6), t = r <= chance ? "success" : "fail";
    rollEvt(c, who, spec.skill || "check", [r], 0, r, chance, t);
    return t;
  },
  attack(c, m, fi) {
    const s = c.s, ch = char(c, m.id), at = ch.attack, foe = foesOf(c)[fi], mon = c.pack.bestiary[foe.id];
    const sm = statMod(c, ch.stats[at.stat || "str"] ?? 10), tm = tiredMod(c, m);
    const mod = (at.bonus || 0) + sm + tm + bonusOf(m, true);
    const r = d(s, 20), total = r + mod, hit = r === 20 || (r !== 1 && total >= mon.ac);
    rollEvt(c, m.id, "attack", [r], mod, total, mon.ac, hit ? "success" : "fail");
    let line = `${ch.name} d20 ${r} ${sgn(mod)} = ${total} vs AC ${mon.ac} · ${hit ? "hit" : "miss"}`;
    if (hit) {
      const dm = dice(s, at.damage), dmg = Math.max(1, dm.total + sm + tm);
      rollEvt(c, m.id, "damage", dm.dice, dm.mod + sm + tm, dmg, null, null);
      line += ` · ${at.damage}${sgn(sm + tm)} = ${dmg}`;
      log(c, line);
      harm(c, { f: fi }, null, dmg);
    } else log(c, line);
    return hit ? "success" : "fail";
  },
  defend(c, fi, m, guard) {
    const s = c.s, foe = foesOf(c)[fi], at = c.pack.bestiary[foe.id].attack, ac = char(c, m.id).ac + (guard ? 2 : 0);
    const r = d(s, 20), total = r + (at.bonus || 0), hit = total >= ac;
    rollEvt(c, "enemy:" + fi, "attack", [r], at.bonus || 0, total, ac, hit ? "success" : "fail");
    let line = `The ${foeName(c, fi)} d20 ${r} ${sgn(at.bonus || 0)} = ${total} vs AC ${ac} · ${hit ? "hit" : "miss"}`;
    if (!hit) return log(c, line);
    const dm = dice(s, at.damage);
    rollEvt(c, "enemy:" + fi, "damage", dm.dice, dm.mod, dm.total, null, null);
    log(c, line + ` · ${at.damage} = ${dm.total}`);
    harm(c, { m }, at.track, dm.total);
  },
  harm,
};

function fateRoll(c, m, what, stat, target, extra = 0) {
  const dd = [fudge(c.s), fudge(c.s), fudge(c.s), fudge(c.s)];
  const mod = (char(c, m.id).stats[stat] || 0) + tiredMod(c, m) + bonusOf(m, true) + extra;
  const total = dd.reduce((a, b) => a + b, 0) + mod, shifts = total - target, t = tier(shifts);
  rollEvt(c, m.id, what, dd, mod, total, target, t);
  return { tier: t, shifts, text: `4dF ${symbols(dd)} ${sgn(mod)} = ${total} vs ${target} · ${t}` };
}
const FATE = {
  check(c, spec, ctx = {}) {
    const sk = spec.skill ? c.R.skills[spec.skill] : spec;
    const pool = ctx.who ? [mem(c, ctx.who)] : ups(c);
    const score = m => (char(c, m.id).stats[sk.stat] || 0) + tiredMod(c, m) + bonusOf(m);
    const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a));
    return fateRoll(c, best, spec.skill || sk.stat, sk.stat, sk.difficulty).tier;
  },
  attack(c, m, fi) {
    const ch = char(c, m.id), at = ch.attack, foe = foesOf(c)[fi], mon = c.pack.bestiary[foe.id];
    const r = fateRoll(c, m, "attack", at.stat, mon.rating);
    log(c, `${ch.name} ${r.text}`);
    if (r.tier === "style" || r.tier === "success") harm(c, { f: fi }, null, Math.max(1, r.shifts));
    else if (r.tier === "tie") { harm(c, { f: fi }, null, 1); harm(c, { m }, at.costTrack || c.R.tracks[0].id, 1); }
    return r.tier === "fail" ? "fail" : "success";
  },
  defend(c, fi, m, guard) {
    const at = c.pack.bestiary[foesOf(c)[fi].id].attack, track = at.track || c.R.tracks[0].id;
    const r = fateRoll(c, m, "defend", c.R.combat.defense, at.rating, guard ? 2 : 0);
    log(c, `${nameOf(c, m.id)} ${r.text}`);
    if (r.tier === "style") harm(c, { f: fi }, null, 1);
    else if (r.tier === "tie") harm(c, { m }, track, 1);
    else if (r.tier === "fail") harm(c, { m }, track, -r.shifts);
  },
  harm,
};
const RESOLVERS = { ose: OSE, fate4df: FATE };

// ---- party, hub ----
function fresh(c, id) {
  const marked = {};
  c.R.tracks.forEach(t => { marked[t.id] = 0; });
  return { id, marked, fate: char(c, id).fate ?? c.R.fate.start, used: {}, cond: [], down: false, dead: false };
}
function join(c, id) {
  if (c.s.done["@joined:" + id]) return;
  c.s.done["@joined:" + id] = true;
  for (const [it, n] of Object.entries(char(c, id).items || {})) give(c, it, n);
}
function rebench(c) {
  const inParty = c.s.party.map(m => m.id);
  c.s.bench = Object.keys(c.pack.party.roster).filter(id => !inParty.includes(id) && !c.s.done["@dead:" + id]);
}
function pick(c, cmd) {
  const s = c.s, size = c.R.party?.size || 4, ids = cmd.ids, roster = c.pack.party.roster;
  if (!Array.isArray(ids) || ids.length !== size) no(`Pick exactly ${size}.`);
  if (new Set(ids).size !== ids.length) no("Pick each member once.");
  for (const id of ids) {
    if (!roster[id]) no("Unknown member.");
    if (s.done["@dead:" + id] || mem(c, id)?.dead) no(`${roster[id].name} is dead.`);
  }
  const old = s.party;
  for (const m of old) if (m.dead && !ids.includes(m.id)) s.done["@dead:" + m.id] = true;
  s.party = ids.map(id => old.find(m => m.id === id) || fresh(c, id));
  s.order = ids.filter(id => !mem(c, id).down);
  ids.forEach(id => join(c, id));
  rebench(c);
}
function replaceDead(c) {
  const s = c.s;
  for (const m of s.party.slice()) {
    if (!m.dead) continue;
    const id = s.bench.find(b => !s.done["@dead:" + b]);
    if (!id) continue;
    s.done["@dead:" + m.id] = true;
    s.party[s.party.indexOf(m)] = fresh(c, id);
    s.order.push(id);
    join(c, id);
    rebench(c);
    log(c, `${nameOf(c, id)} takes the place of ${nameOf(c, m.id)}.`);
  }
}
function hubRest(c) {
  const s = c.s;
  for (const m of s.party) {
    if (m.dead) continue;
    for (const [t, n] of Object.entries(m.marked)) if (n) emit(c, { k: "heal", who: m.id, track: t, amount: n });
    c.R.tracks.forEach(t => { m.marked[t.id] = 0; });
    m.cond = []; m.used = {}; m.fate = char(c, m.id).fate ?? c.R.fate.start; delete m.bonus;
    if (m.down) m.down = false;
  }
  s.order = s.order.concat(s.party.filter(m => !m.dead && !s.order.includes(m.id)).map(m => m.id));
  s.sinceRest = 0;
  log(c, "The party rests.");
}
function hubCmd(c, cmd) {
  const s = c.s;
  let a = null;
  for (const p of c.pack.hub.places) for (const x of p.actions) if (!a && x.id === cmd.action) a = x;
  if (!a) no("No such action.");
  const why = unmet(c, a.if);
  if (why) no(why);
  if (a.kind === "scene") return openScene(c, a.scene, "hub");
  if (a.kind === "roster") return cmd.ids ? pick(c, cmd) : replaceDead(c);
  if (a.kind === "rest") {
    if (s.gold < (a.price || 0)) no(`Not enough ${label(c, "gold")}.`);
    give(c, "gold", -(a.price || 0));
    return hubRest(c);
  }
  if (a.kind !== "shop") no("Nothing to do.");
  const n = Math.max(1, Math.floor(cmd.n || 1));
  if (cmd.buy) {
    const row = (a.stock || []).find(x => x.item === cmd.buy);
    if (!row) no("Not for sale.");
    if (s.gold < row.price * n) no(`Not enough ${label(c, "gold")}.`);
    give(c, "gold", -row.price * n); give(c, row.item, n);
    log(c, `You buy ${n} ${c.pack.items[row.item].name}.`);
  } else if (cmd.sell) {
    const it = c.pack.items[cmd.sell];
    if (!it || it.kind !== "treasure") no("Only treasure sells here.");
    if (have(c, cmd.sell) < n) no("You do not have that.");
    give(c, cmd.sell, -n); give(c, "gold", (it.value || 0) * n);
    log(c, `You sell ${n} ${it.name} for ${(it.value || 0) * n}.`);
  } else no("Buy or sell what?");
}

// ---- create and step ----
function create(pack, opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  return {
    v: 1, seed, rng: seed, mode: "roster", turn: 0, sinceRest: 0,
    light: { source: null, left: 0, stash: {} },
    pos: null, prev: null, party: [], order: [], bench: [],
    flags: {}, items: {}, gold: 0, visited: {}, seen: {}, doors: {}, done: {}, foes: {},
    scene: null, fight: null, ending: null, queued: null, log: [],
  };
}
const ALLOWED = {
  pick: ["roster", "hub"], hub: ["hub"], turn: ["map"], move: ["map"], act: ["map"], search: ["map"], listen: ["map"], rest: ["map"],
  use: ["map", "fight"], order: ["map", "hub"], choose: ["scene"], orders: ["fight"], reroll: ["fight"], cheat: ["deathDoor"], letgo: ["deathDoor"],
};
function run(c, cmd) {
  const s = c.s;
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, cmd.t)) no("Unknown command.");
  if (!ALLOWED[cmd.t].includes(s.mode)) no("Not now.");
  switch (cmd.t) {
    case "pick": {
      const first = s.mode === "roster";
      pick(c, cmd);
      if (first) {
        toHub(c);
        if (c.pack.start?.scene && !s.done["@start"]) { s.done["@start"] = true; openScene(c, c.pack.start.scene, "hub"); }
      }
      break;
    }
    case "hub": hubCmd(c, cmd); break;
    case "turn": {
      const t = { left: 3, right: 1, about: 2 }[cmd.dir];
      if (t == null) no("Turn which way?");
      s.pos.facing = (s.pos.facing + t) % 4;
      emit(c, { k: "turn" });
      break;
    }
    case "move": move(c, cmd.dir); break;
    case "act": act(c); break;
    case "search": search(c); break;
    case "listen": listen(c); break;
    case "rest": rest(c); break;
    case "use": useCmd(c, cmd); if (s.fight) checkFoes(c); break;
    case "order": {
      const ids = cmd.ids;
      if (!Array.isArray(ids) || ids.length !== s.order.length || !s.order.every(id => ids.includes(id))) no("Name each member once.");
      s.order = ids.slice();
      break;
    }
    case "choose": choose(c, cmd); break;
    case "orders": playRound(c, cmd); break;
    case "reroll": reroll(c); break;
    case "cheat": cheat(c); break;
    case "letgo": drop(c, atDoor(c)[0]); break;
  }
}
function step(pack, state, cmd) {
  try {
    if (!cmd || typeof cmd !== "object" || typeof cmd.t !== "string") no("Unknown command.");
    if (cmd.t === "restart") return { state: create(pack, { seed: state.seed }), events: [] };
    const c = mkCtx(pack, clone(state));
    run(c, cmd);
    settle(c);
    return { state: c.s, events: c.ev };
  } catch (e) {
    return { state, events: [{ k: "refuse", text: e instanceof Refuse ? e.message : "That did not work." }] };
  }
}

// ---- the view model (SPEC section 9) ----
function rosterCard(c, id) {
  const ch = char(c, id);
  const line = ch.oseLine || (ose(c) ? `${ch.class} · AC ${ch.ac} · HP ${ch.hp}` : `${ch.class} · ${c.R.tracks.map(t => `${t.label} ${ch.tracks?.[t.id] ?? 3}`).join(" · ")}`);
  return {
    id, name: ch.name, title: ch.title || "", text: ch.text || "", npc: !!ch.npc,
    stats: c.R.stats.map(st => ({ id: st.id, label: st.label, value: ch.stats[st.id] })),
    card: [line, ch.note5e].filter(Boolean),
  };
}
function sceneView(c) {
  const sc = c.s.scene, def = c.pack.events[sc.id];
  return {
    id: sc.id, title: def.title, text: def.text, notes: def.notes || [], said: sc.said.slice(), gate: !!sc.gate,
    choices: sceneChoices(c).map(x => ({ id: x.id, text: x.text, mode: x.mode, enabled: x.enabled, reason: x.reason })),
  };
}
function mapView(c) {
  const s = c.s, p = s.pos, m = mapOf(c), [fx, fy] = DIRS[p.facing], [rx, ry] = DIRS[(p.facing + 1) % 4];
  const ahead = [], dk = dark(c);
  for (let dep = 0; dep < 4; dep++) {
    ahead.push([-1, 0, 1].map(l => (dk && !(dep === 0 && l === 0) ? "dark" : kindAt(c, p.map, p.x + fx * dep + rx * l, p.y + fy * dep + ry * l))));
  }
  const can = { forward: false, back: false, left: false, right: false, act: false, search: false, listen: false, rest: false };
  if (s.mode === "map") {
    const free = f => { const [dx, dy] = DIRS[(p.facing + f) % 4]; return passable(kindAt(c, p.map, p.x + dx, p.y + dy)); };
    Object.assign(can, { forward: free(0), right: free(1), back: free(2), left: free(3), search: true, rest: true });
    const f = facingCell(c), k = kindAt(c, p.map, f.x, f.y);
    can.listen = DOORS.includes(k);
    can.act = (k !== "wall" && !!m.cells?.[key(f.x, f.y)]?.link) || k === "stuck" || (k === "locked" && have(c, m.cells?.[key(f.x, f.y)]?.key) > 0)
      || (k === "door" && s.doors[p.map]?.[key(f.x, f.y)] !== "open");
  }
  const seen = s.seen[p.map] || {}, W = m.grid[0].length, rows = [];
  for (let y = 0; y < m.grid.length; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      if (!seen[key(x, y)]) { row += " "; continue; }
      const k = kindAt(c, p.map, x, y);
      row += k === "stairs" ? info(m, x, y).ch : AUTOMAP[k];
    }
    rows.push(row);
  }
  return { id: p.map, title: m.title, x: p.x, y: p.y, facing: p.facing, ahead, can, automap: { w: W, h: m.grid.length, rows } };
}
function foeLabel(c, f) {
  return ose(c) ? `${Math.max(0, f.hp - f.marked)} hp` : `stress ${Math.min(f.marked, f.hp)} of ${f.hp}`;
}
function fightView(c) {
  const s = c.s, f = s.fight, foes = foesOf(c), L = s.fight.lastMiss;
  const members = ups(c).filter(m => !m.cond.includes("asleep")).map(m => {
    const ch = char(c, m.id), acts = [];
    const abilities = (ch.abilities || []).filter(a => !abilityBase(c, m, a));
    const items = Object.keys(s.items).filter(i => !itemBase(c, i));
    if (canMelee(c, m)) acts.push("fight");
    if (abilities.length) acts.push("ability");
    if (items.length) acts.push("item");
    acts.push("guard", "run");
    return { id: m.id, acts, abilities, items };
  });
  const lm = L && ups(c).find(m => m.id === L.member);
  return {
    round: f.round,
    foes: foes.map((x, i) => {
      const mon = c.pack.bestiary[x.id];
      return { i, name: mon.name, state: x.marked >= x.hp ? "dead" : x.state, hp: foeLabel(c, x), marked: Math.min(x.marked, x.hp), max: x.hp, card: [mon.oseLine, mon.note5e].filter(Boolean) };
    }),
    members,
    canReroll: !!(lm && lm.fate >= c.R.fate.reroll && foes.some(alive)),
    canRun: true,
  };
}
function hubView(c) {
  const H = c.pack.hub, s = c.s;
  const places = H.places.map(p => ({
    id: p.id, label: p.label, text: p.text,
    actions: p.actions.map(a => {
      const why = unmet(c, a.if) || (a.kind === "rest" && s.gold < (a.price || 0) ? `Not enough ${label(c, "gold")}.` : null);
      const out = { id: a.id, label: a.label, kind: a.kind, enabled: !why, reason: why || "" };
      if (a.price != null) out.price = a.price;
      if (a.kind === "shop") {
        out.stock = (a.stock || []).map(r => ({ item: r.item, name: c.pack.items[r.item].name, price: r.price, count: have(c, r.item), enabled: s.gold >= r.price, reason: s.gold >= r.price ? "" : `Not enough ${label(c, "gold")}.` }));
        out.sell = Object.keys(s.items).filter(i => c.pack.items[i]?.kind === "treasure")
          .map(i => ({ item: i, name: c.pack.items[i].name, value: c.pack.items[i].value || 0, count: s.items[i] }));
      }
      return out;
    }),
  }));
  const lines = H.report?.lines || {};
  return {
    title: H.title, text: H.text, places,
    report: Object.keys(lines).filter(f => s.flags[f]).map(f => lines[f]),
    reportTitle: H.report?.title || "",
    bench: s.bench.map(id => rosterCard(c, id)),
  };
}
function view(pack, state) {
  const c = mkCtx(pack, state), s = state, R = pack.rules, a = here(c);
  const door = s.mode === "deathDoor" ? atDoor(c)[0] : null;
  const party = s.party.slice().sort((x, y) => {
    const i = s.order.indexOf(x.id), j = s.order.indexOf(y.id);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
  }).map(m => {
    const ch = char(c, m.id), rank = s.order.indexOf(m.id);
    return {
      id: m.id, name: ch.name, title: ch.title || "", rank: rank >= 0 && rank < R.combat.front ? "front" : "back",
      down: m.down, dead: m.dead, fate: m.fate,
      tracks: R.tracks.map(t => ({ id: t.id, label: t.label, max: maxOf(c, m, t.id), marked: m.marked[t.id] || 0 })),
      cond: m.cond.slice(),
      abilities: (ch.abilities || []).map(id => {
        const ab = pack.abilities[id], left = Math.max(0, (ab.uses || 1) - (m.used[id] || 0));
        const usable = !m.down && left > 0 && (ab.kind === "fate" ? s.mode === "scene" : s.mode !== "roster" && (ab.when === "any" ? s.mode === "map" || s.mode === "fight" : ab.when === s.mode));
        return { id, name: ab.name, text: ab.text || "", left, usable };
      }),
    };
  });
  return {
    mode: s.mode,
    hud: {
      turn: s.turn, minutes: s.turn * R.clock.turnMinutes,
      light: s.light.source ? { label: s.light.source === "spell" ? label(c, "light") : pack.items[s.light.source].name, left: s.light.left } : null,
      dark: dark(c), tired: isTired(c), gold: s.gold, area: a ? { key: a.key, name: a.def.name } : null,
    },
    party,
    map: inDungeon(c) ? mapView(c) : null,
    scene: s.scene ? sceneView(c) : null,
    fight: s.fight ? fightView(c) : null,
    hub: s.mode === "hub" ? hubView(c) : null,
    roster: s.mode === "roster" ? { need: R.party?.size || 4, members: Object.keys(pack.party.roster).map(id => rosterCard(c, id)) } : null,
    ending: s.ending ? { id: s.ending, ...pack.endings[s.ending] } : null,
    door: door ? { who: door.id, cost: R.fate.cheatDeath } : null,
    log: s.log.slice(-50),
  };
}

const Crawl = { version: VERSION, create, step, view, tier };
if (typeof module !== "undefined" && module.exports) module.exports = Crawl;
else root.Crawl = Crawl;
})(typeof globalThis !== "undefined" ? globalThis : this);
