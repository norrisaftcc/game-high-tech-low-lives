// Engine tests. Run: node --test crawler/engine/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPack } from "../tools/load.mjs";

const Crawl = createRequire(import.meta.url)("./crawl.js");
const packs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packs");
const OSE = loadPack(path.join(packs, "test"));
const FATE = loadPack(path.join(packs, "test-fate"));

// ---- helpers ----
const clone = o => JSON.parse(JSON.stringify(o));
const edit = (pack, fn) => { const p = structuredClone(pack); fn(p); return p; };
const calm = pack => edit(pack, p => { p.rules.clock.wander.inSix = 0; });
const refuses = r => r.events.filter(e => e.k === "refuse");
const kinds = r => r.events.map(e => e.k);
const logs = r => r.events.filter(e => e.k === "log").map(e => e.text);

// Step and demand the command was accepted.
function ok(pack, state, cmd) {
  const r = Crawl.step(pack, state, cmd);
  assert.deepEqual(refuses(r), [], `refused ${JSON.stringify(cmd)}: ${refuses(r)[0]?.text}`);
  return r;
}
// Run commands in a row. Returns the final state and every event.
function play(pack, state, ...cmds) {
  const events = [];
  for (const cmd of cmds) { const r = ok(pack, state, cmd); state = r.state; events.push(...r.events); }
  return { state, events };
}

// Rig the next dice. Each want is [sides, value | [values] | fn | null], or dF(sum) for four Fate dice. The rolls must come in the
// order the engine makes them. Finds an rng state whose next rolls fit, so tests need no engine hooks.
function rigRoll(t, n) {
  const x = (t.rng = (t.rng + 0x6D2B79F5) >>> 0);
  let v = Math.imul(x ^ (x >>> 15), x | 1);
  v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
  return 1 + Math.floor((((v ^ (v >>> 14)) >>> 0) / 4294967296) * n);
}
const fits = (v, want) => want == null || (typeof want === "function" ? want(v) : Array.isArray(want) ? want.includes(v) : v === want);
function rig(state, ...wants) {
  const roll = (g, t) => {
    if (!g.group) return fits(rigRoll(t, g[0]), g[1]);
    const vals = [];
    for (let i = 0; i < 4; i++) vals.push(rigRoll(t, 3) - 2);
    return vals.reduce((a, b) => a + b, 0) === g.sum;
  };
  for (let i = 1; i < 8e6; i++) {
    const start = Math.imul(i, 2654435761) >>> 0, t = { rng: start };
    if (wants.every(g => roll(g, t))) return { ...clone(state), rng: start };
  }
  throw new Error("could not rig " + JSON.stringify(wants));
}
const d20 = v => [20, v], d6 = v => [6, v], d8 = v => [8, v], d3 = v => [3, v];
// Four Fate dice (each -1, 0 or +1) that sum to `sum`. Spread it into rig().
const dF = sum => [{ group: true, sum }];

// A deterministic player: looks only at the view, so a replay needs nothing but the seed.
function autoplay(pack, seed, steps) {
  let s = Crawl.create(pack, { seed });
  const cmds = [], moves = ["forward", "forward", "left", "forward", "right", "back", "forward", "forward"];
  for (let i = 0; i < steps; i++) {
    const v = Crawl.view(pack, s);
    let cmd;
    if (v.mode === "roster") cmd = { t: "pick", ids: pack.party.default };
    else if (v.mode === "hub") cmd = { t: "hub", action: i % 7 === 0 ? "rest" : "go" };
    else if (v.mode === "scene") { const c = v.scene.choices.filter(x => x.enabled); cmd = { t: "choose", id: c[i % c.length].id }; }
    else if (v.mode === "fight") cmd = orders(v.fight.members.map(m => [m.id, m.acts.includes("fight") && i % 3 ? "fight" : "guard"]));
    else if (v.mode === "deathDoor") cmd = { t: i % 2 ? "cheat" : "letgo" };
    else if (v.mode === "ending") cmd = { t: "restart" };
    else cmd = i % 5 === 0 ? { t: "search" } : i % 11 === 0 ? { t: "act" } : i % 4 === 0 ? { t: "turn", dir: "right" } : { t: "move", dir: moves[i % moves.length] };
    cmds.push(cmd);
    s = Crawl.step(pack, s, cmd).state;
  }
  return { state: s, cmds };
}

// The usual start: pick the default party, take the job, walk out of the gate. Ends at 1,1 facing east.
function delve(pack, seed = 3, ids = pack.party.default) {
  return play(pack, Crawl.create(pack, { seed }),
    { t: "pick", ids }, { t: "choose", id: "ok" }, { t: "hub", action: "go" },
    { t: "choose", id: "go" }, { t: "choose", id: "leave" }).state;
}
function place(state, x, y, facing = 0, patch = {}) {
  const s = clone(state);
  s.mode = "map"; s.scene = null; s.fight = null; s.turn = 0; s.sinceRest = 0;
  s.pos = { map: "yard", x, y, facing };
  s.prev = { map: "yard", x, y, facing };
  Object.assign(s, patch);
  return s;
}
// Mark the cells around the party as seen, as walking there would.
const see = state => {
  const s = clone(state), seen = (s.seen[s.pos.map] = s.seen[s.pos.map] || {});
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) seen[(s.pos.x + dx) + "," + (s.pos.y + dy)] = 1;
  return s;
};
const lit = (state, source = "torch", left = 5) => ({ ...clone(state), light: { source, left, stash: {} } });
const mem = (state, id) => state.party.find(m => m.id === id);
const withMem = (state, id, patch) => { const s = clone(state); Object.assign(mem(s, id), patch); return s; };
const area = (pack, state) => Crawl.view(pack, state).hud.area?.key ?? null;

// Start the store fight with the party first (heard-rats set), at the door. `pack` may be edited.
function fightAt(pack, ids, seed = 5) {
  let s = delve(pack, seed, ids);
  s = place(s, 4, 1, 1, { flags: { ...s.flags, "heard-rats": true }, visited: { yard: { A: true } } });
  s = lit(s, pack.id === "test" ? "torch" : "flare");
  s = play(pack, s, { t: "move", dir: "forward" }, { t: "choose", id: "fight" }).state;
  assert.equal(s.mode, "fight");
  return s;
}
const orders = (pairs) => ({ t: "orders", orders: pairs.map(([member, act, extra]) => ({ member, act, ...(extra || {}) })) });
const GUARD_ALL = ids => orders(ids.map(id => [id, "guard"]));
const OSE_IDS = ["fighter", "elf", "paladin", "minister"];
const FATE_IDS = ["reyes", "shodann", "undertow", "marcus"];

// ---------------------------------------------------------------------------------------------
test("determinism: same seed and commands give identical JSON state", () => {
  for (const pack of [OSE, FATE]) {
    for (const seed of [1, 99, 12345]) {
      const a = autoplay(pack, seed, 400);
      const b = autoplay(pack, seed, 400);
      assert.equal(JSON.stringify(a.state), JSON.stringify(b.state));
      assert.deepEqual(a.cmds, b.cmds);
      // A replay is {seed, commands}.
      assert.equal(JSON.stringify(play(pack, Crawl.create(pack, { seed }), ...a.cmds.filter(() => true).slice(0, 0)).state), JSON.stringify(Crawl.create(pack, { seed })));
      let s = Crawl.create(pack, { seed });
      for (const cmd of a.cmds) s = Crawl.step(pack, s, cmd).state;
      assert.equal(JSON.stringify(s), JSON.stringify(a.state));
    }
    assert.notEqual(JSON.stringify(autoplay(pack, 1, 300).state), JSON.stringify(autoplay(pack, 2, 300).state));
    assert.equal(Crawl.create(pack, { seed: 99 }).rng, 99, "the rng starts at the seed");
    assert.notEqual(autoplay(pack, 99, 60).state.rng, 99, "and advances");
  }
});

test("purity: step never changes its input; state survives a JSON round trip", () => {
  for (const pack of [OSE, FATE]) {
    const { cmds } = autoplay(pack, 4, 300);
    let s = Crawl.create(pack, { seed: 4 });
    const modes = new Set([s.mode]);
    for (const cmd of cmds) {
      const before = JSON.stringify(s), frozen = clone(s);
      const r = Crawl.step(pack, s, cmd);
      assert.equal(JSON.stringify(s), before, "input state untouched by " + cmd.t);
      assert.deepEqual(s, frozen);
      Crawl.view(pack, s);
      assert.equal(JSON.stringify(s), before, "view does not touch the state");
      assert.deepEqual(JSON.parse(JSON.stringify(r.state)), r.state, "round trip keeps every field");
      assert.deepEqual(clone(Crawl.view(pack, r.state)), Crawl.view(pack, r.state), "the view is plain data");
      modes.add(r.state.mode);
      s = r.state;
    }
    assert.ok(["roster", "hub", "scene", "map", "fight"].every(m => modes.has(m)), "the walk visits every mode: " + [...modes]);
  }
});

test("purity: the pack is never written to", () => {
  const deepFreeze = o => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
  for (const pack of [OSE, FATE]) {
    const frozen = deepFreeze(structuredClone(pack));
    const a = autoplay(pack, 21, 300), b = autoplay(frozen, 21, 300);
    assert.equal(JSON.stringify(a.state), JSON.stringify(b.state), "a frozen pack plays the same game");
    assert.equal(JSON.stringify(frozen), JSON.stringify(pack));
  }
});

test("illegal commands return the same state and one refuse event", () => {
  const s0 = Crawl.create(OSE, { seed: 1 });
  const hub = play(OSE, s0, { t: "pick", ids: OSE_IDS }, { t: "choose", id: "ok" }).state;
  const map = delve(OSE);
  const fight = fightAt(OSE, OSE_IDS);
  const bad = [
    [s0, { t: "move", dir: "forward" }], [s0, { t: "pick", ids: ["fighter"] }], [s0, { t: "pick", ids: ["fighter", "fighter", "elf", "paladin"] }],
    [s0, { t: "pick", ids: ["fighter", "elf", "paladin", "nobody"] }], [s0, { t: "bogus" }], [s0, null], [s0, "move"], [s0, {}],
    [hub, { t: "hub", action: "nowhere" }], [hub, { t: "move", dir: "forward" }], [hub, { t: "order", ids: ["fighter"] }],
    [map, { t: "move", dir: "sideways" }], [map, { t: "turn", dir: "up" }], [map, { t: "choose", id: "x" }], [map, { t: "orders", orders: [] }],
    [map, { t: "use", member: "fighter", ability: "sleep" }], [map, { t: "use", member: "ghost", ability: "light" }],
    [map, { t: "act" }], [map, { t: "listen" }], [map, { t: "cheat" }], [map, { t: "reroll" }], [map, { t: "pick", ids: OSE_IDS }],
    [fight, { t: "move", dir: "forward" }], [fight, { t: "orders", orders: [{ member: "paladin", act: "fight" }] }],
    [fight, { t: "orders", orders: [{ member: "fighter", act: "dance" }] }], [fight, { t: "orders", orders: [{ member: "fighter", act: "fight", target: 9 }] }],
    [fight, { t: "orders", orders: [{ member: "fighter", act: "guard" }, { member: "fighter", act: "guard" }] }], [fight, { t: "reroll" }],
    [fight, { t: "orders", orders: [{ member: "elf", act: "ability", ability: "sleep" }] }],
  ];
  for (const [state, cmd] of bad) {
    const r = Crawl.step(OSE, state, cmd);
    assert.equal(r.state, state, JSON.stringify(cmd));
    assert.equal(r.events.length, 1, JSON.stringify(cmd));
    assert.equal(r.events[0].k, "refuse");
    assert.equal(typeof r.events[0].text, "string");
  }
  const s = place(map, 1, 1, 0);
  const wall = Crawl.step(OSE, s, { t: "move", dir: "forward" });
  assert.deepEqual(kinds(wall).filter(k => k !== "log"), ["bump"], "walking into a wall is a bump, not a refusal");
  assert.deepEqual({ ...wall.state, log: 0 }, { ...s, log: 0 });
});

test("fuzz: random commands never throw, and the state keeps its invariants", () => {
  for (const pack of [OSE, FATE]) {
    const ids = Object.keys(pack.party.roster);
    const abilities = Object.keys(pack.abilities), items = Object.keys(pack.items);
    for (let seed = 1; seed <= 12; seed++) {
      const g = { rng: seed * 7919 };
      const pickOne = a => a[Math.floor(rigRoll(g, 1000) / 1000 * a.length) % a.length];
      let s = Crawl.create(pack, { seed });
      for (let i = 0; i < 700; i++) {
        const v = Crawl.view(pack, s);
        const smart = rigRoll(g, 10) <= 6;
        let cmd;
        if (smart && v.mode === "roster") cmd = { t: "pick", ids: pack.party.default };
        else if (smart && v.mode === "scene") cmd = { t: "choose", id: pickOne(v.scene.choices).id };
        else if (smart && v.mode === "fight") {
          const live = v.fight.foes.filter(f => f.state !== "dead" && f.state !== "fled");
          cmd = orders(v.fight.members.map(m => {
            const act = pickOne(m.acts.filter(x => x !== "run" || rigRoll(g, 4) === 1)), o = { target: pickOne(live).i };
            if (act === "ability") { o.ability = pickOne(m.abilities); if (pack.abilities[o.ability].target === "ally") o.target = pickOne(ids.slice(0, 4)); }
            if (act === "item") o.item = pickOne(m.items);
            return [m.id, act, o];
          }));
        }
        else if (smart && v.mode === "hub") cmd = { t: "hub", action: pickOne(["go", "rest", "buy", "roster"]), buy: pickOne(items), sell: pickOne(items) };
        else cmd = pickOne([
          { t: "move", dir: pickOne(["forward", "back", "left", "right"]) }, { t: "turn", dir: pickOne(["left", "right", "about"]) }, { t: "act" }, { t: "search" },
          { t: "listen" }, { t: "rest" }, { t: "cheat" }, { t: "letgo" }, { t: "reroll" }, { t: "orders", orders: [] }, { t: "order", ids: ids.slice(0, 4) },
          { t: "use", member: pickOne(ids), ability: pickOne(abilities), target: pickOne(ids) }, { t: "use", member: pickOne(ids), item: pickOne(items), target: 0 },
          { t: "choose", id: "go" }, { t: "pick", ids: ids.slice(1, 5) }, { t: "hub", action: "nope" }, { t: 5 }, [], { t: "orders", orders: "x" },
        ]);
        let r;
        assert.doesNotThrow(() => { r = Crawl.step(pack, s, cmd); }, JSON.stringify(cmd));
        assert.ok(Array.isArray(r.events) && r.events.length >= 0);
        if (r.events.some(e => e.k === "refuse")) assert.equal(r.state, s);
        s = r.state;
        assert.ok(["roster", "hub", "map", "scene", "fight", "deathDoor", "ending"].includes(s.mode));
        for (const m of s.party) {
          assert.ok(m.fate >= 0);
          for (const tr of pack.rules.tracks) {
            const max = pack.rules.resolver === "ose" ? pack.party.roster[m.id].hp : pack.party.roster[m.id].tracks[tr.id];
            assert.ok(m.marked[tr.id] >= 0 && m.marked[tr.id] <= max, `${m.id} ${tr.id} ${m.marked[tr.id]}/${max}`);
          }
          if (m.down) assert.equal(s.order.includes(m.id), false);
        }
        assert.ok(s.order.every(id => s.party.some(m => m.id === id)));
        assert.ok(s.gold >= 0 && Object.values(s.items).every(n => n > 0));
        assert.ok(s.log.length <= 50);
        if (s.mode === "fight") assert.ok(s.fight && s.foes[s.fight.enc]);
        if (s.mode === "scene") assert.ok(s.scene);
        if (s.mode === "ending") assert.equal(Crawl.view(pack, s).ending.id, s.ending);
        assert.doesNotThrow(() => Crawl.view(pack, s));
      }
    }
  }
});

test("browser build: loaded as a classic script it sets globalThis.Crawl", async () => {
  const { readFileSync } = await import("node:fs");
  const vm = await import("node:vm");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "crawl.js"), "utf8"), sandbox);
  assert.equal(typeof sandbox.Crawl.step, "function");
  assert.equal(sandbox.Crawl.version, "0.1");
  const s = sandbox.Crawl.create(OSE, { seed: 3 });
  assert.equal(JSON.stringify(s), JSON.stringify(Crawl.create(OSE, { seed: 3 })));
  assert.equal(Crawl.version, "0.1");
});

test("restart: new game, same seed, from any mode", () => {
  const s = fightAt(OSE, OSE_IDS, 77);
  const r = ok(OSE, s, { t: "restart" });
  assert.deepEqual(r.state, Crawl.create(OSE, { seed: 77 }));
});

// ---------------------------------------------------------------------------------------------
test("roster pick goes to the hub; the start scene opens; the gate scene leads to the map", () => {
  for (const pack of [OSE, FATE]) {
    let s = Crawl.create(pack, { seed: 2 });
    assert.equal(s.mode, "roster");
    const v0 = Crawl.view(pack, s);
    assert.equal(v0.roster.need, 4);
    assert.equal(v0.roster.members.length, Object.keys(pack.party.roster).length);
    s = ok(pack, s, { t: "pick", ids: pack.party.default }).state;
    assert.equal(s.mode, "scene");
    assert.equal(s.scene.id, "job");
    assert.equal(s.scene.from, "hub");
    assert.deepEqual(s.order, pack.party.default);
    assert.deepEqual(s.bench, Object.keys(pack.party.roster).filter(id => !pack.party.default.includes(id)));
    s = ok(pack, s, { t: "choose", id: "ok" }).state;
    assert.equal(s.mode, "hub");
    assert.equal(s.done["@start"], true);
    s = ok(pack, s, { t: "hub", action: "go" }).state;
    assert.equal(s.scene.id, "gate");
    s = ok(pack, s, { t: "choose", id: "go" }).state;
    assert.equal(s.mode, "scene", "the yard's enter scene opens");
    assert.equal(s.scene.id, "yard");
    assert.deepEqual(s.pos, { map: "yard", x: 1, y: 1, facing: 1 });
    s = ok(pack, s, { t: "choose", id: "leave" }).state;
    assert.equal(s.mode, "map");
    assert.equal(s.turn, 1, "a new area costs clock.newArea turns");
  }
  // The start scene opens only once.
  const home = play(OSE, Crawl.create(OSE), { t: "pick", ids: OSE_IDS }, { t: "choose", id: "ok" }).state;
  assert.equal(ok(OSE, home, { t: "pick", ids: ["wizard", ...OSE_IDS.slice(1)] }).state.mode, "hub");
  // Members bring their gear once.
  assert.equal(home.items.torch, 5);
  assert.equal(home.items.lantern, 1);
});

test("a new area costs clock.newArea turns; a known area is free", () => {
  const pack = edit(OSE, p => { p.rules.clock.wander.inSix = 0; p.rules.clock.newArea = 2; });
  let s = delve(pack, 8);
  assert.equal(s.turn, 2);
  s = play(pack, s, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }).state;
  assert.equal(s.turn, 2, "same area and the door cell are free");
  s = ok(pack, s, { t: "move", dir: "forward" }).state;
  assert.equal(s.turn, 4, "the store is new");
  assert.equal(s.scene.id, "store");
  s = play(pack, s, { t: "choose", id: "back" }).state;
  assert.deepEqual([s.pos.x, s.pos.y], [3, 1]);
  assert.equal(s.turn, 4, "stepping back to the known yard is free");
  s = play(pack, s, { t: "turn", dir: "about" }, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }).state;
  assert.equal(s.turn, 4, "the known store costs nothing; the fight is charged when it ends");
  assert.equal(s.mode, "fight", "a store with a live encounter starts the fight again");
  assert.equal(s.visited.yard.B, true);
});

test("a fight is charged clock.fight when it ends, so a fight on the sixth turn is not played tired", () => {
  const f = fightAt(OSE, OSE_IDS);
  const start = f.turn;
  const t5 = { ...clone(f), sinceRest: 5 };
  const view = Crawl.view(OSE, t5);
  assert.equal(view.hud.tired, false, "turn 5 since rest: not tired yet");
  const played = ok(OSE, rig(t5, d20(2), d20(2)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(played.state.turn, start, "a round costs no time");
  assert.equal(played.state.sinceRest, 5, "and the party is still fresh");
  const run = ok(OSE, rig(t5, d6(1)), orders([["fighter", "run"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(run.state.mode, "map", "the party got away");
  assert.equal(run.state.turn, start + OSE.rules.clock.fight, "a fight that ends charges clock.fight");
  assert.equal(run.state.sinceRest, 6);
  assert.equal(Crawl.view(OSE, run.state).hud.tired, true, "tired after the fight, not during it");
});

test("a wandering check runs every clock.wander.every turns", () => {
  const pack = calm(OSE);
  let s = place(delve(pack), 2, 1, 1);
  const seen = [];
  for (let i = 0; i < 6; i++) { const r = ok(pack, s, { t: "rest" }); seen.push([r.state.turn, r.events.filter(e => e.k === "wander").length]); s = r.state; }
  assert.deepEqual(seen, [[1, 0], [2, 1], [3, 0], [4, 1], [5, 0], [6, 1]]);
  const every3 = edit(pack, p => { p.rules.clock.wander.every = 3; });
  s = place(delve(every3), 2, 1, 1);
  const seen3 = [];
  for (let i = 0; i < 6; i++) { const r = ok(every3, s, { t: "rest" }); seen3.push(r.events.filter(e => e.k === "wander").length); s = r.state; }
  assert.deepEqual(seen3, [0, 0, 1, 0, 0, 1]);
  // A hit picks from the map's wander table.
  const hit = ok(OSE, rig(place(delve(OSE), 2, 1, 1, { turn: 1 }), d6(1), [1, 1]), { t: "rest" });
  assert.deepEqual(hit.events.filter(e => e.k === "wander").map(e => [e.roll, e.hit]), [[1, true]]);
  assert.equal(hit.state.fight.enc, "lone-rat");
  assert.equal(hit.state.mode, "fight");
  // A miss does not.
  assert.equal(ok(OSE, rig(place(delve(OSE), 2, 1, 1, { turn: 1 }), d6(2)), { t: "rest" }).state.mode, "map");
});

// ---------------------------------------------------------------------------------------------
test("stuck door: act rolls forceDoor; each try makes a wander check", () => {
  // The stuck door is at 2,4. Stand south of it, in the passage.
  const base = place(delve(OSE), 2, 5, 0, { visited: { yard: { A: true, C: true } } });
  const s0 = lit(base);
  // Not yet forced: it blocks.
  const bump = ok(OSE, s0, { t: "move", dir: "forward" });
  assert.equal(bump.events.some(e => e.k === "bump"), true);
  assert.equal(Crawl.view(OSE, s0).map.ahead[1][1], "stuck");
  assert.equal(Crawl.view(OSE, s0).map.can.act, true);
  // First try fails (best forceDoor is 3 in 6): d6 = 6. The wander roll is 6: no hit.
  const r1 = ok(OSE, rig(s0, d6(6), d6(6)), { t: "act" });
  const roll = r1.events.find(e => e.k === "roll");
  assert.equal(roll.what, "forceDoor");
  assert.equal(roll.target, 3, "the best member's skill sets the chance");
  assert.equal(roll.tier, "fail");
  assert.deepEqual(r1.events.filter(e => e.k === "wander").map(e => e.hit), [false]);
  assert.equal(Crawl.view(OSE, r1.state).map.ahead[1][1], "stuck");
  // Second try works (d6 = 1). The wander roll is 1: a hit, so the lone rat comes.
  const r2 = ok(OSE, rig(r1.state, d6(1), d6(1), [1, 1]), { t: "act" });
  assert.equal(r2.events.find(e => e.k === "roll").tier, "success");
  assert.deepEqual(r2.events.filter(e => e.k === "wander").map(e => e.hit), [true]);
  assert.equal(r2.state.doors.yard["2,4"], "open");
  assert.equal(r2.state.mode, "fight");
  assert.equal(r2.state.fight.enc, "lone-rat");
  assert.equal(r2.state.fight.wander, true);
  // With onNoise off, forcing makes no wander check.
  const quiet = edit(OSE, p => { p.rules.clock.wander.onNoise = false; });
  const r3 = ok(quiet, rig(s0, d6(1)), { t: "act" });
  assert.equal(r3.events.some(e => e.k === "wander"), false);
  assert.equal(Crawl.view(quiet, r3.state).map.ahead[1][1], "door");
});

test("stuck door under fate4df rolls forceDoor on the ladder", () => {
  const s0 = lit(place(delve(FATE), 2, 5, 0), "battery");
  // Reyes has Body +2; difficulty 2. Dice sum +1: total 3, shifts 1, success.
  const r = ok(FATE, rig(s0, ...dF(1), d6(6)), { t: "act" });
  const roll = r.events.find(e => e.k === "roll");
  assert.equal(roll.what, "forceDoor");
  assert.equal(roll.mod, 2);
  assert.equal(roll.total, 3);
  assert.equal(roll.target, 2);
  assert.equal(roll.tier, "success");
  assert.equal(r.state.doors.yard["2,4"], "open");
  const f = ok(FATE, rig(s0, ...dF(-2), d6(6)), { t: "act" });
  assert.equal(f.events.find(e => e.k === "roll").tier, "fail");
  assert.equal(f.state.doors.yard?.["2,4"], undefined);
});

test("a locked door opens with its key and blocks without it", () => {
  const pack = edit(OSE, p => {
    const m = p.maps.yard;
    m.grid[4] = "##L###S##";
    m.cells["2,4"] = { key: "lantern" };
  });
  const s0 = lit(place(delve(pack), 2, 5, 0));
  assert.equal(Crawl.view(pack, s0).map.ahead[1][1], "locked");
  const keyless = { ...clone(s0), items: {} };
  assert.equal(Crawl.step(pack, keyless, { t: "act" }).events[0].k, "refuse");
  const r = ok(pack, s0, { t: "act" });
  assert.equal(r.state.doors.yard["2,4"], "open");
  assert.equal(r.state.items.lantern, 1, "a key is not used up");
});

test("secret door: found by search; stays a wall until then", () => {
  // The secret door is at 6,4, south of the store's last row. Search from inside the store.
  const base = lit(place(delve(OSE), 6, 3, 2, { visited: { yard: { A: true, B: true } }, done: { "store-rats": true } }));
  assert.equal(Crawl.view(OSE, base).map.ahead[1][1], "wall");
  assert.equal(Crawl.step(OSE, base, { t: "move", dir: "forward" }).state.pos.y, 3, "cannot walk through it");
  // The elf searches at 2 in 6. d6 = 6 misses.
  const miss = ok(OSE, rig(base, d6(6)), { t: "search" });
  assert.equal(miss.state.doors.yard?.["6,4"], undefined);
  assert.equal(miss.state.turn, base.turn + 1, "search costs clock.search turns");
  assert.equal(Crawl.view(OSE, miss.state).map.ahead[1][1], "wall");
  // d6 = 2 hits.
  const hit = ok(OSE, rig(base, d6(2)), { t: "search" });
  assert.equal(hit.state.doors.yard["6,4"], "found");
  assert.equal(Crawl.view(OSE, hit.state).map.ahead[1][1], "door");
  assert.equal(Crawl.view(OSE, hit.state).map.automap.rows[4][6], "+");
  const through = play(OSE, hit.state, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }).state;
  assert.deepEqual([through.pos.x, through.pos.y], [6, 5]);
  assert.equal(through.mode, "scene", "the draft scene opens on the cell");
  assert.equal(through.scene.id, "draft");
  // Searching a room with no secret door finds nothing and costs the same.
  const none = ok(OSE, place(base, 1, 5, 0, { visited: { yard: { A: true, C: true } } }), { t: "search" });
  assert.match(logs(none).join(" "), /nothing/);
});

test("secret door: found by a reveal effect (a Fate choice)", () => {
  const s0 = delve(OSE);
  const yard = place(s0, 1, 1, 1, { scene: { id: "yard", said: [], taken: [], from: "map", gate: false }, mode: "scene" });
  const v = Crawl.view(OSE, yard);
  assert.deepEqual(v.scene.choices.map(c => [c.id, c.mode, c.enabled]), [["look", "plan", true], ["remember", "fate", true], ["leave", "plan", true]]);
  const r = ok(OSE, yard, { t: "choose", id: "remember" });
  assert.equal(r.state.doors.yard["6,4"], "found");
  assert.equal(r.state.seen.yard["6,4"], 1);
  assert.equal(mem(r.state, "elf").used["remember-when"], 1);
  assert.deepEqual(r.state.scene.said, ["There was a door in the store's south wall once."]);
  // The ability is spent: the choice is shown greyed.
  const c = Crawl.view(OSE, r.state).scene.choices.find(x => x.id === "remember");
  assert.equal(c.enabled, false);
  assert.match(c.reason, /remember/i);
  assert.equal(Crawl.step(OSE, r.state, { t: "choose", id: "remember" }).events[0].k, "refuse");
});

test("listen at a door sets the area's listen flag on success", () => {
  const s0 = lit(place(delve(OSE), 3, 1, 1));
  assert.equal(Crawl.view(OSE, s0).map.can.listen, true);
  // The elf and paladin listen at 2 in 6.
  const hit = ok(OSE, rig(s0, d6(2)), { t: "listen" });
  assert.equal(hit.state.flags["heard-rats"], true);
  assert.deepEqual(logs(hit), ["Scratching. Squeaks. Two, maybe three."]);
  assert.equal(hit.state.turn, s0.turn, "listen costs clock.listen = 0 turns");
  const miss = ok(OSE, rig(s0, d6(3)), { t: "listen" });
  assert.equal(miss.state.flags["heard-rats"], undefined);
  assert.deepEqual(logs(miss), ["You hear nothing."]);
  // Not facing a door: refused.
  assert.equal(Crawl.step(OSE, place(s0, 3, 1, 0), { t: "listen" }).events[0].k, "refuse");
  // A door with no listen text beyond it: nothing to hear even on a success.
  const stuck = lit(place(delve(OSE), 2, 5, 0));
  assert.deepEqual(logs(ok(OSE, rig(stuck, d6(1)), { t: "listen" })), ["You hear nothing."]);
});

// ---------------------------------------------------------------------------------------------
test("light: a dark area lights the first carried item in clock.light.order", () => {
  const near = s => place(s, 4, 1, 1, { visited: { yard: { A: true } } });
  // Torches only: the torch.
  let s = near(delve(OSE));
  let r = ok(OSE, s, { t: "move", dir: "forward" });
  assert.equal(r.state.light.source, "torch");
  assert.equal(r.state.items.torch, 4, "a lit torch leaves the pack");
  assert.equal(r.state.light.left, 5, "and burns one turn for the new area");
  assert.match(r.events.find(e => e.k === "light").text, /torch/i);
  assert.equal(Crawl.view(OSE, r.state).hud.light.label, "Torch");
  // An oil flask comes first, but only with the lantern.
  s = near({ ...delve(OSE), items: { torch: 3, "oil-flask": 2, lantern: 1 } });
  r = ok(OSE, s, { t: "move", dir: "forward" });
  assert.equal(r.state.light.source, "oil-flask");
  assert.equal(r.state.light.left, 23);
  s = near({ ...delve(OSE), items: { torch: 3, "oil-flask": 2 } });
  r = ok(OSE, s, { t: "move", dir: "forward" });
  assert.equal(r.state.light.source, "torch", "no lantern: the oil flask cannot be used");
  assert.equal(r.state.items["oil-flask"], 2);
});

test("light: a source burns one turn per tick; daylight snuffs it into the stash", () => {
  let s = lit(place(delve(OSE), 5, 1, 1, { visited: { yard: { A: true, B: true } }, done: { "store-rats": true } }), "torch", 4);
  s = ok(OSE, s, { t: "rest" }).state;
  assert.equal(s.light.left, 3);
  s = ok(OSE, s, { t: "search" }).state;
  assert.equal(s.light.left, 2);
  // Back into the yard (daylight).
  s = play(OSE, s, { t: "turn", dir: "about" }, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }).state;
  assert.equal(area(OSE, s), "A");
  assert.equal(s.light.source, null);
  assert.deepEqual(s.light.stash, { torch: 2 });
  assert.equal(Crawl.view(OSE, s).hud.light, null);
  // Back into the dark: the stashed torch is relit, not a new one.
  const torches = s.items.torch ?? 0;
  s = play(OSE, s, { t: "turn", dir: "about" }, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }).state;
  assert.equal(s.light.source, "torch");
  assert.equal(s.light.left, 2);
  assert.equal(s.items.torch ?? 0, torches);
  assert.deepEqual(s.light.stash, {});
  // A source at zero is spent and the next is lit.
  s = lit(place(s, 5, 1, 1), "torch", 1);
  const r = ok(OSE, s, { t: "rest" });
  assert.equal(r.state.light.source, "torch");
  assert.equal(r.state.light.left, 6);
  assert.equal(r.state.items.torch, s.items.torch - 1);
  assert.match(logs(r).join(" "), /burns out/);
});

test("light: when nothing is left in a dark area the out scene opens once", () => {
  const pack = edit(OSE, p => { delete p.events.dark.noLeave; });
  let s = lit(place(delve(pack), 5, 1, 1, { visited: { yard: { A: true, B: true } }, done: { "store-rats": true }, items: {} }), "torch", 1);
  const r = ok(pack, s, { t: "rest" });
  assert.equal(r.state.light.source, null);
  assert.equal(r.state.mode, "scene");
  assert.equal(r.state.scene.id, "dark");
  const v = Crawl.view(pack, r.state);
  assert.equal(v.hud.dark, true);
  assert.deepEqual(v.map.ahead.flat().filter(k => k !== "dark"), ["open"], "only your own cell shows");
  assert.equal(v.map.ahead[0][1], "open");
  // Close it. It does not open again while you stand in the dark.
  s = ok(pack, r.state, { t: "choose", id: "leave" }).state;
  assert.equal(s.mode, "map");
  const again = ok(pack, s, { t: "rest" });
  assert.equal(again.state.mode, "map");
  assert.equal(again.events.some(e => e.k === "scene"), false);
  // A fresh light re-arms it.
  const relit = { ...clone(again.state), items: { torch: 1 } };
  const t2 = play(pack, relit, { t: "rest" });
  assert.equal(t2.state.light.source, "torch", "the next tick lights it");
  assert.equal(t2.state.done["@dark"], undefined);
  // The real fixture: the scene has no way out but home.
  const stuck = ok(OSE, lit(place(delve(OSE), 5, 1, 1, { visited: { yard: { A: true, B: true } }, done: { "store-rats": true }, items: {} }), "torch", 1), { t: "rest" });
  assert.deepEqual(Crawl.view(OSE, stuck.state).scene.choices.map(c => c.id), ["feel"]);
  assert.equal(ok(OSE, stuck.state, { t: "choose", id: "feel" }).state.mode, "hub");
});

test("light: a spell lights the 'spell' source", () => {
  const s0 = place(delve(OSE), 5, 1, 1, { visited: { yard: { A: true, B: true } } });
  const r = ok(OSE, s0, { t: "use", member: "elf", ability: "light" });
  assert.equal(r.state.light.source, "spell");
  assert.equal(r.state.light.left, 12);
  assert.equal(mem(r.state, "elf").used.light, 1);
  assert.equal(Crawl.step(OSE, r.state, { t: "use", member: "elf", ability: "light" }).events[0].k, "refuse");
  assert.equal(Crawl.view(OSE, r.state).hud.light.label, OSE.theme.labels.light);
});

test("TIRED after clock.tired.every turns without rest; rest clears it", () => {
  const pack = calm(OSE);
  let s = lit(place(delve(pack), 2, 1, 1, { sinceRest: 4 }), "torch", 20);
  assert.equal(Crawl.view(OSE, s).hud.tired, false);
  s = ok(pack, s, { t: "search" }).state;
  assert.equal(Crawl.view(pack, s).hud.tired, false, "5 turns");
  s = ok(pack, s, { t: "search" }).state;
  assert.equal(s.sinceRest, 6);
  assert.equal(Crawl.view(pack, s).hud.tired, true);
  s = ok(pack, s, { t: "rest" }).state;
  assert.equal(s.sinceRest, 0);
  assert.equal(Crawl.view(OSE, s).hud.tired, false);
  // Tired is -1 to attack and damage (ose) ...
  const f = fightAt(OSE, OSE_IDS);
  const rested = ok(OSE, rig(f, d20(12), d8(4)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  const tired = ok(OSE, rig({ ...f, sinceRest: 6 }, d20(12), d8(4)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  const atk = r => r.events.find(e => e.k === "roll" && e.what === "attack" && e.who === "fighter");
  const dmg = r => r.events.find(e => e.k === "roll" && e.what === "damage" && e.who === "fighter");
  assert.equal(atk(rested).mod, 1);
  assert.equal(atk(tired).mod, 0);
  assert.equal(dmg(rested).total, 5);
  assert.equal(dmg(tired).total, 4);
  // ... and to every roll (fate4df).
  const ff = fightAt(FATE, FATE_IDS);
  const o = orders([["reyes", "fight"], ["shodann", "guard"], ["undertow", "guard"], ["marcus", "guard"]]);
  const a = ok(FATE, rig(ff, ...dF(0)), o).events.find(e => e.k === "roll");
  const b = ok(FATE, rig({ ...ff, sinceRest: 6 }, ...dF(0)), o).events.find(e => e.k === "roll");
  assert.equal(a.mod, 3);
  assert.equal(b.mod, 2);
});

// ---------------------------------------------------------------------------------------------
test("ose fight: d20 + attack bonus + stat mod vs ascending AC; natural 20 hits; natural 1 misses", () => {
  const f = fightAt(OSE, OSE_IDS);
  const go = (s, roll, ...more) => ok(OSE, rig(s, d20(roll), ...more), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  const atk = r => r.events.find(e => e.k === "roll" && e.what === "attack");
  // STR 14 is +1. AC 12. d20 11 makes 12: a hit. d20 10 makes 11: a miss.
  let r = go(f, 11, d8(3));
  assert.deepEqual([atk(r).mod, atk(r).total, atk(r).target, atk(r).tier], [1, 12, 12, "success"]);
  assert.equal(r.events.find(e => e.k === "harm").amount, 4, "d8 3 + STR 1");
  assert.equal(r.state.foes["store-rats"][0].marked, 4);
  r = go(f, 10);
  assert.equal(atk(r).tier, "fail");
  assert.equal(r.events.some(e => e.k === "harm" && e.who === "enemy:0"), false);
  // AC 30: only a natural 20 hits. AC 1: a natural 1 still misses.
  const hard = edit(OSE, p => { p.bestiary["giant-rat"].ac = 30; });
  const fh = fightAt(hard, OSE_IDS);
  const order = orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]);
  assert.equal(atk(ok(hard, rig(fh, d20(19)), order)).tier, "fail");
  assert.equal(atk(ok(hard, rig(fh, d20(20), d8(1)), order)).tier, "success");
  const soft = edit(OSE, p => { p.bestiary["giant-rat"].ac = 1; });
  const fs = fightAt(soft, OSE_IDS);
  assert.equal(atk(ok(soft, rig(fs, d20(1)), order)).tier, "fail");
  assert.equal(atk(ok(soft, rig(fs, d20(2), d8(1)), order)).tier, "success");
});

test("ose fight: damage is never less than 1", () => {
  const f = fightAt(OSE, ["wizard", "fighter", "paladin", "minister"]);
  // The wizard: STR 8 is -1, dagger 1d4. A roll of 1 would be 0.
  const r = ok(OSE, rig(f, d20(15), [4, 1]), orders([["wizard", "fight"], ["fighter", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  const dmg = r.events.find(e => e.k === "roll" && e.what === "damage");
  assert.equal(dmg.total, 1);
  assert.equal(r.events.find(e => e.k === "harm").amount, 1);
});

test("ose fight: guarding adds 2 to AC; foes roll d20 + attack.bonus", () => {
  const f = fightAt(OSE, OSE_IDS);
  const rat0 = r => r.events.find(e => e.k === "roll" && e.who === "enemy:0" && e.what === "attack");
  // Rat 0 picks the fighter (AC 15) and rolls 15. Rat 1 picks the elf and rolls 1.
  const braced = ok(OSE, rig(f, [2, 1], d20(15), [2, 2], d20(1)), GUARD_ALL(OSE_IDS));
  assert.deepEqual([rat0(braced).target, rat0(braced).tier], [17, "fail"], "guarding: AC 17");
  assert.equal(braced.events.some(e => e.k === "harm"), false);
  // The fighter misses (d20 2), so the order differs only by the guard. 15 now hits AC 15; the damage is 1d3.
  const bare = ok(OSE, rig(f, d20(2), [2, 1], d20(15), d3(2), [2, 2], d20(1)),
    orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.deepEqual([rat0(bare).target, rat0(bare).tier], [15, "success"]);
  assert.deepEqual(bare.events.find(e => e.k === "harm"), { k: "harm", who: "fighter", track: "hp", amount: 2 });
  assert.equal(mem(bare.state, "fighter").marked.hp, 2);
});

test("ose fight: foes attack only front-rank members (reach)", () => {
  const tough = edit(OSE, p => {
    for (const m of Object.values(p.party.roster)) m.hp = 200;
    p.bestiary["giant-rat"].attack = { bonus: 40, damage: "1d3" };
  });
  const harmed = (pack, rounds) => {
    let s = fightAt(pack, OSE_IDS);
    const who = new Set();
    for (let i = 0; i < rounds; i++) {
      const r = ok(pack, s, GUARD_ALL(OSE_IDS));
      s = r.state;
      r.events.filter(e => e.k === "harm").forEach(e => who.add(e.who));
    }
    return who;
  };
  assert.deepEqual([...harmed(tough, 30)].sort(), ["elf", "fighter"]);
  const deep = edit(tough, p => { p.encounters["store-rats"].reach = 4; });
  const all = harmed(deep, 40);
  assert.equal(all.has("paladin") || all.has("minister"), true, "reach 4 lets them hit the back");
  // Back rank members cannot melee, and the engine says so.
  const f = fightAt(OSE, OSE_IDS);
  assert.equal(Crawl.step(OSE, f, orders([["paladin", "fight"]])).events[0].k, "refuse");
  assert.deepEqual(Crawl.view(OSE, f).fight.members.find(m => m.id === "paladin").acts.includes("fight"), false);
  assert.deepEqual(Crawl.view(OSE, f).fight.members.find(m => m.id === "fighter").acts.includes("fight"), true);
});

test("ose fight: the foes' first strike honours the encounter's 'first'", () => {
  const f = fightAt(OSE, OSE_IDS);
  const quiet = { ...clone(f), flags: {} };
  const s = { ...quiet, fight: { ...quiet.fight, first: "foes" } };
  const r = ok(OSE, s, orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  const rolls = r.events.filter(e => e.k === "roll" && e.what === "attack").map(e => e.who);
  assert.deepEqual(rolls.slice(0, 2), ["enemy:0", "enemy:1"], "foes roll before the party");
  assert.ok(rolls.includes("fighter"));
  // Round two: the party first, whatever 'first' said.
  const r2 = ok(OSE, r.state, orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(r2.events.find(e => e.k === "roll" && e.what === "attack").who, "fighter");
  // The encounter's own rule: without the flag, the rats go first.
  const real = lit(place(delve(OSE), 4, 1, 1, { visited: { yard: { A: true } } }));
  const started = play(OSE, real, { t: "move", dir: "forward" }, { t: "choose", id: "fight" }).state;
  assert.equal(started.fight.first, "foes");
  assert.equal(f.fight.first, "party");
});

test("ose fight: morale. The rats break at 2 dead (breakAt)", () => {
  const pack = edit(OSE, p => { p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 3, hp: [1, 1, 6] }]; });
  const f = fightAt(pack, OSE_IDS);
  const r = ok(pack, rig(f, d20(15), d8(4), d20(15), d8(4)), orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  const dead = r.state;
  assert.equal(dead.mode, "map", "two dead: the third runs and the fight is won");
  assert.equal(dead.done["store-rats"], true);
  assert.equal(dead.flags["rats-gone"], true);
  assert.equal(dead.gold, 10, "onWin pays out");
  assert.deepEqual(r.events.filter(e => e.k === "fight").map(e => [e.phase, e.result]), [["end", "win"]]);
  assert.equal(r.events.some(e => e.k === "roll" && e.what === "morale"), false, "breakAt replaces the roll");
  assert.match(logs(r).join(" "), /flee/);
  // One dead is not enough.
  const one = ok(pack, rig(f, d20(15), d8(4), d20(2)), orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(one.state.mode, "fight");
  // With no breakAt, 2d6 against ml. 2d6 of 12 is over ML 8: they flee after the first loss.
  const roll = edit(pack, p => { delete p.bestiary["giant-rat"].breakAt; });
  const fr = fightAt(roll, OSE_IDS);
  const broke = ok(roll, rig(fr, d20(15), d8(4), d20(2), [6, 6], [6, 6]), orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  const m = broke.events.find(e => e.k === "roll" && e.what === "morale");
  assert.deepEqual([m.total, m.target, m.tier], [12, 8, "fail"]);
  assert.equal(broke.state.mode, "map");
  const held = ok(roll, rig(fr, d20(15), d8(4), d20(2), [6, 1], [6, 1]), orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(held.events.find(e => e.k === "roll" && e.what === "morale").tier, "success");
  assert.equal(held.state.mode, "fight");
  // The first-loss check happens once; the check at half comes later.
  assert.equal(held.state.fight.morale & 1, 1);
});

test("ose fight: run retreats to prev; the foes keep their hp and sleep when you return", () => {
  const pack = edit(OSE, p => { p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 2, hp: [9, 9] }]; p.bestiary["giant-rat"].hd = 0.5; });
  const f = fightAt(pack, ["fighter", "elf", "wizard", "paladin"]);
  assert.deepEqual(f.prev, { map: "yard", x: 4, y: 1, facing: 1 });
  // Fighter hits rat 0 (d20 15, d8 3). Elf misses. The wizard casts Sleep (2d8 = 9). The paladin runs (d6 3 <= 4).
  const r = ok(pack, rig(f, d20(15), d8(3), d20(2), d8(5), d8(4), d6(3)), orders([
    ["fighter", "fight"], ["elf", "fight"], ["wizard", "ability", { ability: "sleep" }], ["paladin", "run"]]));
  assert.equal(r.state.mode, "map");
  assert.deepEqual([r.state.pos.x, r.state.pos.y], [4, 1]);
  assert.deepEqual(r.events.filter(e => e.k === "fight").map(e => [e.phase, e.result]), [["end", "flee"]]);
  const foes = r.state.foes["store-rats"];
  assert.deepEqual(foes.map(x => [x.hp, x.marked, x.state]), [[9, 4, "asleep"], [9, 0, "asleep"]]);
  assert.equal(r.state.done["store-rats"], undefined);
  assert.equal(mem(r.state, "wizard").used.sleep, 1);
  // Back in: the same foes, the same hp, still asleep.
  const back = ok(pack, r.state, { t: "move", dir: "forward" });
  assert.equal(back.state.mode, "fight");
  assert.deepEqual(back.state.foes["store-rats"], foes);
  const v = Crawl.view(pack, back.state).fight;
  assert.deepEqual(v.foes.map(x => [x.state, x.hp]), [["asleep", "5 hp"], ["asleep", "9 hp"]]);
  // Sleeping foes do not strike.
  const still = ok(pack, back.state, GUARD_ALL(["fighter", "elf", "wizard", "paladin"]));
  assert.equal(still.events.some(e => e.k === "roll" && String(e.who).startsWith("enemy")), false);
  // A failed run keeps you in the fight.
  const stay = ok(pack, rig(f, d20(2), d20(2), d6(6)), orders([["fighter", "fight"], ["elf", "fight"], ["wizard", "guard"], ["paladin", "run"]]));
  assert.equal(stay.state.mode, "fight");
  assert.match(logs(stay).join(" "), /cannot get away/);
});

test("ose fight: Sleep affects foes in order while their hd fits the 2d8 budget", () => {
  const pack = edit(OSE, p => { p.bestiary["giant-rat"].hd = 3; p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 3, hp: [9, 9, 9] }]; });
  const f = fightAt(pack, ["fighter", "elf", "wizard", "paladin"]);
  const o = orders([["fighter", "guard"], ["elf", "guard"], ["wizard", "ability", { ability: "sleep" }], ["paladin", "guard"]]);
  const states = (r) => r.state.foes["store-rats"].map(x => x.state);
  let r = ok(pack, rig(f, d8(2), d8(3)), o);
  assert.equal(r.events.find(e => e.k === "roll" && e.what === "budget").total, 5);
  assert.deepEqual(states(r), ["asleep", "awake", "awake"], "5 covers one hd 3 foe and not the next");
  r = ok(pack, rig(f, d8(4), d8(5)), o);
  assert.deepEqual(states(r), ["asleep", "asleep", "asleep"], "9 covers three");
  r = ok(pack, rig(f, d8(1), d8(1)), o);
  assert.deepEqual(states(r), ["awake", "awake", "awake"], "2 covers none");
  // Sleep only works in a fight, and once per rest.
  assert.equal(Crawl.step(pack, place(f, 4, 1, 1), { t: "use", member: "wizard", ability: "sleep" }).events[0].k, "refuse");
});

test("ose fight: rerolling a missed attack spends Fate", () => {
  const f = fightAt(OSE, OSE_IDS);
  // The fighter hits, the elf misses. The elf's is the last miss.
  const r = ok(OSE, rig(f, d20(15), d8(1), d20(2)), orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.deepEqual(r.state.fight.lastMiss.member, "elf");
  const v = Crawl.view(OSE, r.state).fight;
  assert.equal(v.canReroll, true);
  assert.equal(mem(r.state, "elf").fate, 3);
  const rr = ok(OSE, rig(r.state, d20(15), d8(2)), { t: "reroll" });
  assert.equal(mem(rr.state, "elf").fate, 2, "costs fate.reroll");
  assert.equal(rr.events.find(e => e.k === "roll" && e.what === "attack").who, "elf");
  assert.equal(rr.events.find(e => e.k === "roll" && e.what === "attack").tier, "success");
  assert.equal(rr.state.fight.lastMiss, null);
  assert.equal(Crawl.view(OSE, rr.state).fight.canReroll, false);
  assert.equal(Crawl.step(OSE, rr.state, { t: "reroll" }).events[0].k, "refuse");
  // No Fate, no reroll.
  const poor = withMem(r.state, "elf", { fate: 0 });
  assert.equal(Crawl.view(OSE, poor).fight.canReroll, false);
  assert.equal(Crawl.step(OSE, poor, { t: "reroll" }).events[0].k, "refuse");
  // A reroll that kills ends the fight.
  const small = edit(OSE, p => { p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 1, hp: [1] }]; });
  const fs = fightAt(small, OSE_IDS);
  const miss = ok(small, rig(fs, d20(2)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  const kill = ok(small, rig(miss.state, d20(15), d8(4)), { t: "reroll" });
  assert.equal(kill.state.mode, "map");
  assert.equal(kill.state.flags["rats-gone"], true);
});

test("ose fight: cheatDeath and deathDoor", () => {
  const strong = edit(OSE, p => { p.bestiary["giant-rat"].attack = { bonus: 40, damage: "3" }; });
  const base = withMem(fightAt(strong, OSE_IDS), "fighter", { marked: { hp: 7 } });
  // After the party's guard round the rats strike: the first picks the fighter (pool index 1).
  const hit = ok(strong, rig(base, [2, 1], d20(20)), GUARD_ALL(OSE_IDS));
  assert.equal(hit.state.mode, "deathDoor");
  assert.equal(mem(hit.state, "fighter").down, false, "not down until the player chooses");
  assert.equal(mem(hit.state, "fighter").marked.hp, 8);
  assert.deepEqual(Crawl.view(strong, hit.state).door, { who: "fighter", cost: 2 });
  assert.equal(Crawl.step(strong, hit.state, orders([["elf", "guard"]])).events[0].k, "refuse", "only cheat or letgo now");
  // Cheat: spend Fate, stay one box short of full.
  const cheat = ok(strong, hit.state, { t: "cheat" });
  assert.equal(cheat.state.mode, "fight");
  assert.equal(mem(cheat.state, "fighter").fate, 1);
  assert.equal(mem(cheat.state, "fighter").marked.hp, 7);
  assert.equal(mem(cheat.state, "fighter").down, false);
  // Let go: the fighter is down for good under down: "dead".
  const go = ok(strong, hit.state, { t: "letgo" });
  const f = mem(go.state, "fighter");
  assert.deepEqual([f.down, f.dead], [true, true]);
  assert.equal(go.state.mode, "fight");
  assert.equal(go.state.order.includes("fighter"), false, "drops out of the marching order");
  assert.deepEqual(go.state.order, ["elf", "paladin", "minister"]);
  assert.equal(go.events.some(e => e.k === "down" && e.who === "fighter"), true);
  assert.equal(Crawl.view(strong, go.state).party.find(m => m.id === "fighter").dead, true);
  // With too little Fate there is no choice: straight down.
  const poor = withMem(base, "fighter", { fate: 1 });
  const out = ok(strong, rig(poor, [2, 1], d20(20)), GUARD_ALL(OSE_IDS));
  assert.equal(out.state.mode, "fight");
  assert.equal(mem(out.state, "fighter").down, true);
  // Outside a fight too: a trap in a scene can put you at the door.
  const trap = edit(OSE, p => {
    p.events.trap = { title: "Trap", text: ["Click."], choices: [{ id: "step", mode: "act", text: "Step.", effects: { damage: { who: "leader", amount: 9 } } }] };
  });
  const sc = { ...place(delve(trap), 1, 1, 1), mode: "scene", scene: { id: "trap", said: [], taken: [], from: "map", gate: false } };
  const t = ok(trap, sc, { t: "choose", id: "step" });
  assert.equal(t.state.mode, "deathDoor");
  assert.equal(ok(trap, t.state, { t: "cheat" }).state.mode, "scene", "back to the scene");
});

test("ose fight: a full wipe goes to rules.endings.wipe", () => {
  const killers = edit(OSE, p => {
    p.bestiary["giant-rat"].attack = { bonus: 40, damage: "100" };
    p.encounters["store-rats"].reach = 4;
  });
  let s = fightAt(killers, OSE_IDS);
  s = { ...clone(s), party: s.party.map(m => ({ ...m, fate: 0 })) };
  let events = [];
  for (let i = 0; i < 8 && s.mode === "fight"; i++) { const r = ok(killers, s, GUARD_ALL(Crawl.view(killers, s).fight.members.map(m => m.id))); s = r.state; events.push(...r.events); }
  assert.equal(s.mode, "ending");
  assert.equal(s.ending, "end-dead");
  assert.equal(s.fight, null);
  assert.equal(events.some(e => e.k === "ending" && e.id === "end-dead"), true);
  assert.equal(s.party.every(m => m.down && m.dead), true);
  const v = Crawl.view(killers, s);
  assert.deepEqual([v.mode, v.ending.id, v.ending.kind, v.ending.title], ["ending", "end-dead", "dead", "The Cellar Keeps You"]);
  assert.equal(Crawl.step(killers, s, { t: "rest" }).events[0].k, "refuse");
  assert.equal(ok(killers, s, { t: "restart" }).state.mode, "roster");
});

test("ose fight: items, nonLethal wanderers, bonus and fight-scope bonus", () => {
  // The oil flask hits the two nearest foes (check 3 in 6).
  const f = { ...fightAt(OSE, OSE_IDS), items: { "oil-flask": 2, torch: 3, lantern: 1 } };
  const v = Crawl.view(OSE, f).fight.members.find(m => m.id === "fighter");
  assert.deepEqual(v.items, ["oil-flask"]);
  assert.equal(v.acts.includes("item"), true);
  const burn = ok(OSE, rig(f, d6(2), d8(3), d8(4)), orders([["fighter", "item", { item: "oil-flask" }], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(burn.state.items["oil-flask"], 1);
  assert.deepEqual(burn.events.filter(e => e.k === "harm").map(e => [e.who, e.amount]), [["enemy:0", 3], ["enemy:1", 4]]);
  assert.equal(burn.state.mode, "map", "both rats are dead");
  const fizzle = ok(OSE, rig(f, d6(5)), orders([["fighter", "item", { item: "oil-flask" }], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(fizzle.state.items["oil-flask"], 1);
  assert.match(logs(fizzle).join(" "), /breaks short/);
  // A wandering lone rat never takes anyone below one box from full.
  const lone = edit(OSE, p => { p.bestiary["giant-rat"].attack = { bonus: 40, damage: "100" }; p.encounters["lone-rat"].first = "party"; });
  let s = lit(place(delve(lone), 2, 5, 0, { visited: { yard: { A: true, C: true } } }));
  s = ok(lone, rig(s, d6(1), d6(1), [1, 1]), { t: "act" }).state;
  assert.equal(s.fight.enc, "lone-rat");
  for (let i = 0; i < 4 && s.mode === "fight"; i++) s = ok(lone, s, GUARD_ALL(OSE_IDS)).state;
  assert.equal(s.mode, "fight");
  assert.ok(s.party.every(m => m.marked.hp <= Object.keys(m.marked).length * 0 + lone.party.roster[m.id].hp - 1));
  assert.ok(s.party.some(m => m.marked.hp === lone.party.roster[m.id].hp - 1));
  // A bonus effect adds to the next roll and is spent by it.
  const bonus = edit(OSE, p => { p.abilities.blessing = { name: "Blessing", kind: "spell", per: "rest", uses: 1, when: "fight", target: "none", effects: { bonus: { who: "party", amount: 2, scope: "next" } } }; p.party.roster.minister.abilities.push("blessing"); });
  const fb = fightAt(bonus, OSE_IDS);
  const b1 = ok(bonus, fb, { t: "use", member: "minister", ability: "blessing" });
  assert.equal(mem(b1.state, "fighter").bonus.next, 2);
  const b2 = ok(bonus, rig(b1.state, d20(10), d8(1)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  const atk = b2.events.find(e => e.k === "roll" && e.what === "attack");
  assert.deepEqual([atk.mod, atk.tier], [3, "success"]);
  assert.equal(mem(b2.state, "fighter").bonus.next, 0);
});

// ---------------------------------------------------------------------------------------------
test("fate4df: the ladder", () => {
  const t = Crawl.tier;
  assert.deepEqual([-5, -1, 0, 1, 2, 3, 4, 9].map(t), ["fail", "fail", "tie", "success", "success", "style", "style", "style"]);
  // A roll shows its dice as -1, 0, +1 and the ladder tier.
  const f = fightAt(FATE, FATE_IDS);
  const o = orders([["reyes", "fight"], ["shodann", "guard"], ["undertow", "guard"], ["marcus", "guard"]]);
  const roll = r => r.events.find(e => e.k === "roll" && e.what === "attack");
  const r = ok(FATE, rig(f, ...dF(1)), o);
  assert.equal(roll(r).dice.length, 4);
  assert.ok(roll(r).dice.every(x => [-1, 0, 1].includes(x)));
  assert.equal(roll(r).dice.reduce((a, b) => a + b, 0), 1);
  assert.equal(roll(r).mod, 3, "Reflexes +3");
  assert.equal(roll(r).total, 4);
  assert.equal(roll(r).target, 1, "the rat's rating");
  assert.equal(roll(r).tier, "style", "shifts 3");
});

test("fate4df: attack marks. Style or success marks max(1, shifts); tie marks both; fail marks nothing", () => {
  const f = fightAt(FATE, FATE_IDS);
  const o = orders([["reyes", "fight"], ["shodann", "guard"], ["undertow", "guard"], ["marcus", "guard"]]);
  // The rats then attack Reyes (+3 Reflexes) and get nowhere: a success for her, so no marks land.
  const calm = [[2, 1], ...dF(-1), [2, 1], ...dF(-1)];
  const run = sum => ok(FATE, rig(f, ...dF(sum), ...calm), o);
  const foe0 = r => r.state.foes["store-rats"][0].marked;
  // Reyes: Reflexes +3 vs rating 1. total = 3 + sum; shifts = 2 + sum.
  assert.equal(foe0(run(-1)), 1, "shifts 1: marks 1");
  assert.equal(foe0(run(0)), 2, "shifts 2: marks 2 (the rat has 2 stress and falls)");
  assert.equal(foe0(run(2)), 4, "style: marks the shifts, 4");
  let r = run(-2);
  assert.equal(r.events.find(e => e.k === "roll" && e.what === "attack").tier, "tie");
  assert.equal(foe0(r), 1);
  assert.equal(mem(r.state, "reyes").marked.meat, 1, "the tie costs the attacker a box on costTrack");
  r = run(-3);
  assert.equal(foe0(r), 0);
  assert.equal(mem(r.state, "reyes").marked.meat, 0);
  // Shodann's cost track is nerves.
  const o2 = orders([["reyes", "guard"], ["shodann", "fight"], ["undertow", "guard"], ["marcus", "guard"]]);
  // Reflexes +2 vs 1: a tie needs total 1, so sum -1.
  const tie = ok(FATE, rig(f, ...dF(-1), [2, 2], ...dF(0), [2, 2], ...dF(0)), o2);
  assert.equal(mem(tie.state, "shodann").marked.nerves, 1);
  // A foe is down at its stress, with no pool to subtract from: marked >= hp.
  const dead = run(0).state.foes["store-rats"][0];
  assert.ok(dead.marked >= dead.hp);
  assert.equal(Crawl.view(FATE, run(0).state).fight.foes[0].state, "dead");
});

test("fate4df: defend marks. Style marks the foe; success no harm; tie 1; fail the shortfall", () => {
  const f = fightAt(FATE, FATE_IDS);
  const guardAll = GUARD_ALL(FATE_IDS);
  const roll = r => r.events.find(e => e.k === "roll" && e.what === "defend");
  // The first rat picks a target at random from the front two (pool index 1 = reyes, Reflexes +3).
  const hit = (sum, o = guardAll) => ok(FATE, rig(f, [2, 1], ...dF(sum), [2, 2]), o);
  // Guarding adds 2 to the defender's roll. The rating stays 1. Reyes is Reflexes +3, so a guarded roll is dice + 5.
  let r = hit(-4);
  assert.equal(roll(r).target, 1, "guarding does not raise the rating");
  assert.equal(roll(r).mod, 5, "Reflexes +3 and guard +2");
  assert.equal(roll(r).total, 1);
  assert.equal(roll(r).tier, "tie");
  assert.equal(mem(r.state, "reyes").marked.meat, 1, "a tie marks 1");
  r = hit(-3);
  assert.equal(roll(r).tier, "success");
  assert.equal(mem(r.state, "reyes").marked.meat, 0);
  assert.equal(r.state.foes["store-rats"][0].marked, 0);
  r = hit(0);
  assert.equal(roll(r).tier, "style");
  assert.equal(r.state.foes["store-rats"][0].marked, 1, "style marks the attacker");
  // Not guarding: dice + 3 against the same rating. The same dice are 2 worse, and a fail marks the shortfall.
  const open = orders([["reyes", "fight"], ["shodann", "guard"], ["undertow", "guard"], ["marcus", "guard"]]);
  const bare = sum => ok(FATE, rig(f, ...dF(-3), [2, 1], ...dF(sum)), open);
  const dBare = r => r.events.find(e => e.k === "roll" && e.what === "defend");
  r = bare(-4);
  assert.equal(dBare(r).target, 1, "no guard: rating 1");
  assert.equal(dBare(r).mod, 3, "no guard bonus");
  assert.equal(dBare(r).tier, "fail");
  assert.equal(mem(r.state, "reyes").marked.meat, 2, "fail by 2 marks 2");
  assert.equal(dBare(bare(-3)).tier, "fail", "-3 + 3 = 0 vs 1");
  assert.equal(mem(bare(-3).state, "reyes").marked.meat, 1, "fail by 1 marks 1");
  assert.equal(dBare(bare(-2)).tier, "tie");
  // The same dice: guarding is never worse than not guarding.
  const tiers = ["fail", "tie", "success", "style"];
  for (const sum of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
    const g = roll(ok(FATE, rig(f, [2, 1], ...dF(sum), [2, 2]), guardAll)), n = dBare(bare(sum));
    assert.equal(g.total - n.total, 2, "guard adds 2 to the roll at sum " + sum);
    assert.ok(tiers.indexOf(g.tier) >= tiers.indexOf(n.tier), "guarding is never worse at sum " + sum);
  }
  // Marks go on attack.track: the drone's is systems.
  const drone = edit(FATE, p => { p.encounters["store-rats"].foes = [{ id: "eye-drone", count: 1 }]; p.bestiary["eye-drone"].aura = null; });
  const fd = fightAt(drone, FATE_IDS);
  const dr = ok(drone, rig(fd, [2, 1], ...dF(-4)), GUARD_ALL(FATE_IDS));
  assert.equal(mem(dr.state, "reyes").marked.systems, 1, "fail by 1 (rating 2 vs 1)");
  assert.equal(mem(dr.state, "reyes").marked.meat, 0);
});

test("fate4df: an aura check at round start; the avoid stance skips it", () => {
  const pack = edit(FATE, p => { p.maps.yard.areas.B.encounter = "lone-rat"; delete p.maps.yard.areas.B.enter; });
  let s = lit(place(delve(pack), 4, 1, 1, { visited: { yard: { A: true } } }), "battery");
  s = ok(pack, s, { t: "move", dir: "forward" }).state;
  assert.equal(s.fight.enc, "lone-rat");
  const o = orders([["reyes", "guard"], ["shodann", "fight"], ["undertow", "guard"], ["marcus", "fight"]]);
  // Cool vs 1. Reyes and Undertow guard and skip the roll. Shodann (Cool +1) rolls -3 and fails. Marcus rolls 0.
  const r = ok(pack, rig(s, ...dF(-3), ...dF(0)), o);
  const aura = r.events.filter(e => e.k === "roll" && e.what === "cool");
  assert.deepEqual(aura.map(e => e.who), ["shodann", "marcus"]);
  assert.deepEqual(aura.map(e => e.tier), ["fail", "success"]);
  assert.deepEqual(mem(r.state, "shodann").cond, ["flagged"]);
  assert.deepEqual(mem(r.state, "reyes").cond, []);
  assert.deepEqual(mem(r.state, "undertow").cond, []);
  assert.deepEqual(mem(r.state, "marcus").cond, []);
  const rollsBefore = r.events.findIndex(e => e.k === "roll" && e.what !== "cool");
  assert.ok(r.events.findIndex(e => e.k === "roll" && e.what === "cool") < rollsBefore, "the aura comes first");
  assert.equal(Crawl.view(pack, r.state).party.find(m => m.id === "shodann").cond[0], "flagged");
  // The drone is a wanderer's kind: nonLethal, so systems stops one box short.
  let n = withMem(s, "reyes", { marked: { meat: 0, nerves: 0, systems: 2 } });
  n = ok(pack, rig(n, [2, 1], ...dF(-4)), GUARD_ALL(FATE_IDS));
  assert.equal(n.state.mode, "fight");
  assert.ok(mem(n.state, "reyes").marked.systems <= 2);
});

test("fate4df: breakAt dead and breakAt marked", () => {
  const three = edit(FATE, p => { p.encounters["store-rats"].foes = [{ id: "wreck-rat", count: 3 }]; });
  const f = fightAt(three, FATE_IDS);
  // Two attackers, each kills a rat (Reflexes 3 vs 1, sum 0: marks 2).
  const o = orders([["reyes", "fight"], ["shodann", "fight"], ["undertow", "guard"], ["marcus", "guard"]]);
  const r = ok(three, rig(f, ...dF(0), ...dF(1)), o);
  assert.equal(r.state.mode, "map");
  assert.equal(r.state.flags["rats-gone"], true);
  assert.equal(r.state.gold, 40);
  // {marked: 3} across the group.
  const marked = edit(three, p => { p.bestiary["wreck-rat"].breakAt = { marked: 3 }; });
  const fm = fightAt(marked, FATE_IDS);
  const half = ok(marked, rig(fm, ...dF(-1), ...dF(-1), [2, 1], ...dF(-1), [2, 1], ...dF(-1)), o);
  assert.equal(half.state.mode, "fight", "2 marked in all: not yet");
  const broke = ok(marked, rig(fm, ...dF(0), ...dF(-1)), o);
  assert.equal(broke.state.mode, "map", "3 marked in all: they run");
  assert.deepEqual(broke.state.done["store-rats"], true);
});

test("fate4df: down under 'recover' comes back after a hub rest, which costs gold", () => {
  const strong = edit(FATE, p => { p.bestiary["wreck-rat"].attack = { rating: 40, track: "meat" }; });
  let s = withMem(fightAt(strong, FATE_IDS), "reyes", { marked: { meat: 2, nerves: 0, systems: 0 }, fate: 0 });
  s = ok(strong, rig(s, [2, 1], ...dF(-4)), GUARD_ALL(FATE_IDS)).state;
  const reyes = mem(s, "reyes");
  assert.deepEqual([reyes.down, reyes.dead], [true, false], "down but not dead under 'recover'");
  assert.equal(s.order.includes("reyes"), false);
  // Home. The clinic wants 20 gold.
  let home = { ...clone(s), mode: "hub", fight: null, foes: {}, pos: s.pos };
  assert.equal(Crawl.step(strong, home, { t: "hub", action: "rest" }).events[0].k, "refuse");
  home = { ...home, gold: 25 };
  const r = ok(strong, home, { t: "hub", action: "rest" });
  assert.equal(r.state.gold, 5);
  assert.deepEqual(mem(r.state, "reyes").marked, { meat: 0, nerves: 0, systems: 0 });
  assert.equal(mem(r.state, "reyes").down, false);
  assert.equal(r.state.order.includes("reyes"), true);
  assert.equal(mem(r.state, "reyes").fate, 3);
});

// ---------------------------------------------------------------------------------------------
test("ose checks: a save is d20 >= the save; inSix is d6 <= n; the best skill rolls", () => {
  const pack = edit(OSE, p => {
    p.events.yard.choices.push(
      { id: "save", mode: "act", text: "Save.", check: { save: "D", who: "fighter" }, on: { success: { say: ["held"] }, fail: { say: ["failed"] } } },
      { id: "six", mode: "act", text: "Six.", check: { inSix: 2 }, on: { success: { say: ["yes"] }, fail: { say: ["no"] } } });
  });
  const yard = { ...place(delve(pack), 1, 1, 1), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  const said = (cmd, ...w) => ok(pack, rig(yard, ...w), cmd).state.scene.said;
  assert.deepEqual(said({ t: "choose", id: "save" }, d20(12)), ["held"], "the fighter saves vs Death at 12");
  assert.deepEqual(said({ t: "choose", id: "save" }, d20(11)), ["failed"]);
  assert.deepEqual(said({ t: "choose", id: "six" }, d6(2)), ["yes"]);
  assert.deepEqual(said({ t: "choose", id: "six" }, d6(3)), ["no"]);
  const r = ok(pack, rig(yard, d20(12)), { t: "choose", id: "save" });
  const roll = r.events.find(e => e.k === "roll");
  assert.deepEqual([roll.who, roll.what, roll.target, roll.tier], ["fighter", "save D", 12, "success"]);
  // A skill nobody has falls back on the rules' number; the best member's own number wins otherwise.
  const alone = ok(OSE, Crawl.create(OSE), { t: "pick", ids: ["minister", "wizard", "fighter", "elf"] }).state;
  assert.equal(OSE.rules.skills.search.inSix, 1);
  const searchRoll = st => ok(OSE, rig(place(st, 6, 3, 2, { visited: { yard: { A: true, B: true } }, done: { "store-rats": true } }), d6(6)), { t: "search" }).events.find(e => e.k === "roll");
  assert.equal(searchRoll(alone).target, 2, "the elf's 2 in 6");
  const noElf = ok(OSE, Crawl.create(OSE), { t: "pick", ids: ["minister", "wizard", "fighter", "paladin"] }).state;
  assert.equal(searchRoll(noElf).target, 1, "nobody has it: the rules' 1 in 6");
});

test("ose monsters: hp from a dice string; bonus 'fight' scope ends with the fight", () => {
  const pack = edit(OSE, p => { p.bestiary["giant-rat"].hp = "2d4"; p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 2 }]; });
  const f = fightAt(pack, OSE_IDS);
  const hps = f.foes["store-rats"].map(x => x.hp);
  assert.ok(hps.every(h => h >= 2 && h <= 8), "2d4 each: " + hps);
  const blessed = withMem(fightAt(OSE, OSE_IDS), "fighter", { bonus: { next: 0, fight: 3 } });
  const r = ok(OSE, rig(blessed, d20(8), d8(1)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(r.events.find(e => e.k === "roll" && e.what === "attack").mod, 4, "+1 STR, +3 for the fight");
  assert.equal(mem(r.state, "fighter").bonus.fight, 3, "it lasts the whole fight");
  const small = edit(OSE, p => { p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 1, hp: [1] }]; });
  const done = ok(small, rig(withMem(fightAt(small, OSE_IDS), "fighter", { bonus: { next: 0, fight: 3 } }), d20(15), d8(4)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]]));
  assert.equal(done.state.mode, "map");
  assert.equal(mem(done.state, "fighter").bonus.fight, 0, "gone when the fight ends");
});

test("scenes: plan choices cost nothing and cannot roll", () => {
  const pack = edit(OSE, p => {
    p.events.yard.choices.push({ id: "sly", mode: "plan", text: "Ponder.", turns: 3, check: { skill: "listen" }, on: { success: { say: ["rolled"] }, fail: { say: ["rolled"] } }, effects: { say: ["pondered"] } });
  });
  const yard = { ...place(delve(pack), 1, 1, 1), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  const r = ok(pack, yard, { t: "choose", id: "sly" });
  assert.equal(r.state.turn, yard.turn);
  assert.equal(r.events.some(e => e.k === "roll" || e.k === "tick"), false);
  assert.deepEqual(r.state.scene.said, ["pondered"]);
  assert.equal(r.state.mode, "scene");
  const again = ok(pack, r.state, { t: "choose", id: "sly" });
  assert.deepEqual(again.state.scene.said, ["pondered"], "asking again shows the answer once");
});

test("scenes: act choices tick their turns, then check, then apply effects", () => {
  const pack = edit(OSE, p => {
    p.rules.clock.wander.every = 1000;
    p.events.yard.choices.push({ id: "dig", mode: "act", text: "Dig.", turns: 2, check: { skill: "search" },
      on: { success: { flag: { set: ["dug"] }, say: ["Found."] }, fail: { say: ["Dirt."] } } });
  });
  const yard = { ...place(lit(delve(pack)), 1, 1, 1, { sinceRest: 0 }), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  const yes = ok(pack, rig(yard, d6(1)), { t: "choose", id: "dig" });
  const order = yes.events.map(e => e.k).filter(k => k !== "light");
  assert.deepEqual(order.slice(0, 4), ["tick", "tick", "roll", "log"], "ticks, then the roll, then the effects");
  assert.equal(yes.state.turn, yard.turn + 2);
  assert.equal(yes.state.flags.dug, true);
  assert.deepEqual(yes.state.scene.said, ["Found."]);
  const no = ok(pack, rig(yard, d6(6)), { t: "choose", id: "dig" });
  assert.equal(no.state.flags.dug, undefined);
  assert.deepEqual(no.state.scene.said, ["Dirt."]);
  // Missing tiers: style and tie fall back on success (fate4df).
  const fpack = edit(FATE, p => {
    p.events.yard.choices.push({ id: "dig", mode: "act", text: "Dig.", check: { stat: "tech", difficulty: 2 },
      on: { success: { say: ["ok"] }, fail: { say: ["bad"] } } });
  });
  const fy = { ...place(lit(delve(fpack), "battery"), 1, 1, 1), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  // Best Tech among the party is Undertow's +3. Total 2 is a tie vs 2... sum -1 gives 2.
  const tie = ok(fpack, rig(fy, ...dF(-1)), { t: "choose", id: "dig" });
  assert.equal(tie.events.find(e => e.k === "roll").tier, "tie");
  assert.deepEqual(tie.state.scene.said, ["ok"]);
  assert.deepEqual(ok(fpack, rig(fy, ...dF(4)), { t: "choose", id: "dig" }).state.scene.said, ["ok"], "style uses success");
  assert.deepEqual(ok(fpack, rig(fy, ...dF(-4)), { t: "choose", id: "dig" }).state.scene.said, ["bad"]);
  // A tie and a style may have their own text.
  const tiers = edit(fpack, p => {
    const c = p.events.yard.choices.find(x => x.id === "dig");
    c.on.tie = { say: ["cost"] }; c.on.style = { say: ["flair"] };
  });
  assert.deepEqual(ok(tiers, rig(fy, ...dF(-1)), { t: "choose", id: "dig" }).state.scene.said, ["cost"]);
  assert.deepEqual(ok(tiers, rig(fy, ...dF(4)), { t: "choose", id: "dig" }).state.scene.said, ["flair"]);
});

test("scenes: a taken once-choice stays, greyed as Done; if-conditions grey it with a reason; the auto Leave", () => {
  const pack = edit(OSE, p => {
    p.events.yard.choices.push(
      { id: "needs-flag", mode: "plan", text: "A", if: { flags: ["opened"] }, effects: {} },
      { id: "needs-gold", mode: "plan", text: "B", if: { gold: 5 }, effects: {} },
      { id: "needs-item", mode: "plan", text: "C", if: { items: { torch: 99 } }, effects: {} },
      { id: "needs-member", mode: "plan", text: "D", if: { member: "wizard" }, effects: {} },
      { id: "needs-visit", mode: "plan", text: "E", if: { visited: "B" }, effects: {} },
      { id: "needs-fate", mode: "plan", text: "F", if: { fate: 4 }, effects: {} },
      { id: "needs-ability", mode: "plan", text: "G", if: { ability: "light" }, effects: {} },
      { id: "closed", mode: "plan", text: "H", if: { notFlags: ["opened"] }, effects: {} });
  });
  let s = { ...place(delve(pack), 1, 1, 1), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  const row = st => Crawl.view(pack, st).scene.choices.map(c => [c.id, c.enabled]);
  assert.deepEqual(row(s), [["look", true], ["remember", true], ["needs-flag", false], ["needs-gold", false], ["needs-item", false], ["needs-member", false],
    ["needs-visit", false], ["needs-fate", false], ["needs-ability", true], ["closed", true], ["leave", true]]);
  for (const c of Crawl.view(pack, s).scene.choices) assert.equal(c.reason === "", c.enabled, c.id);
  assert.equal(Crawl.step(pack, s, { t: "choose", id: "needs-gold" }).events[0].k, "refuse");
  assert.equal(Crawl.step(pack, s, { t: "choose", id: "needs-gold" }).events[0].text, "Need 5 gold.");
  s = { ...s, flags: { opened: true }, gold: 5 };
  assert.deepEqual(row(s).filter(([id]) => ["needs-flag", "needs-gold", "closed"].includes(id)), [["needs-flag", true], ["needs-gold", true], ["closed", false]]);
  // once: taken, and kept in place greyed, so the number keys do not shift.
  const look = ok(pack, s, { t: "choose", id: "look" });
  assert.deepEqual(look.state.scene.said, ["Swollen oak. It will take a shoulder."]);
  const lookRow = Crawl.view(pack, look.state).scene.choices.find(c => c.id === "look");
  assert.deepEqual([lookRow.enabled, lookRow.reason], [false, "Done."]);
  assert.deepEqual(Crawl.view(pack, look.state).scene.choices.map(c => c.id), Crawl.view(pack, s).scene.choices.map(c => c.id), "the list does not shift");
  assert.equal(Crawl.step(pack, look.state, { t: "choose", id: "look" }).events[0].k, "refuse");
  // Leave closes the scene and returns to the map. Hub scenes and noLeave scenes have none.
  assert.equal(ok(pack, look.state, { t: "choose", id: "leave" }).state.mode, "map");
  const hubScene = ok(OSE, Crawl.create(OSE), { t: "pick", ids: OSE_IDS }).state;
  assert.equal(Crawl.view(OSE, hubScene).scene.choices.some(c => c.id === "leave"), false);
  const store = { ...place(delve(OSE), 5, 1, 1), mode: "scene", scene: { id: "store", said: [], taken: [], from: "map", gate: false } };
  assert.deepEqual(Crawl.view(OSE, store).scene.choices.map(c => c.id), ["fight", "back"]);
  assert.equal(Crawl.view(OSE, { ...store, scene: { ...store.scene, id: "yard" } }).scene.choices.at(-1).text, "Leave");
  const relabel = edit(OSE, p => { p.theme.labels.leave = "Withdraw"; });
  assert.equal(Crawl.view(relabel, { ...store, scene: { ...store.scene, id: "yard" } }).scene.choices.at(-1).text, "Withdraw");
});

test("scenes: a Fate choice spends the ability of a living member", () => {
  const yard = { ...place(delve(OSE), 1, 1, 1), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  // The elf holds remember-when. Take the elf out and the choice is greyed.
  const noElf = ok(OSE, Crawl.create(OSE), { t: "pick", ids: ["fighter", "paladin", "minister", "wizard"] }).state;
  const s = { ...yard, party: noElf.party, order: noElf.order };
  const c = Crawl.view(OSE, s).scene.choices.find(x => x.id === "remember");
  assert.equal(c.enabled, false);
  assert.equal(Crawl.step(OSE, s, { t: "choose", id: "remember" }).events[0].k, "refuse");
  // A fate choice is free: no turns pass.
  const r = ok(OSE, yard, { t: "choose", id: "remember" });
  assert.equal(r.state.turn, yard.turn);
  assert.equal(r.events.some(e => e.k === "tick"), false);
  // A downed holder cannot use it.
  const down = withMem(yard, "elf", { down: true });
  assert.equal(Crawl.view(OSE, { ...down, order: down.order.filter(x => x !== "elf") }).scene.choices.find(x => x.id === "remember").enabled, false);
  // The view names the gate the first time a scene offers both kinds.
  const first = ok(OSE, ok(OSE, Crawl.create(OSE), { t: "pick", ids: OSE_IDS }).state, { t: "choose", id: "ok" }).state;
  const gate = ok(OSE, first, { t: "hub", action: "go" }).state;
  assert.equal(Crawl.view(OSE, gate).scene.gate, true);
  const again = ok(OSE, ok(OSE, gate, { t: "choose", id: "stay" }).state, { t: "hub", action: "go" }).state;
  assert.equal(Crawl.view(OSE, again).scene.gate, false, "only the first time");
});

test("scenes: the ten effect verbs", () => {
  const pack = edit(OSE, p => {
    p.events.lab = { title: "Lab", text: ["x"], choices: [
      { id: "all", mode: "plan", text: "All", effects: {
        flag: { set: ["a", "b"], unset: ["b"] }, item: { add: { torch: 2, gold: 7 }, remove: { lantern: 1 } },
        damage: { who: "front", amount: 2 }, heal: { who: "leader", amount: 1 }, condition: { who: "party", add: "dazed" },
        bonus: { who: "leader", amount: 1, scope: "fight" }, fate: { who: "self", amount: -1 }, light: { turns: 9 }, say: ["done"], goto: { close: true } } },
      { id: "end", mode: "plan", text: "End", effects: { goto: { ending: "end-dead" } } },
      { id: "enc", mode: "plan", text: "Enc", effects: { goto: { encounter: "lone-rat" } } },
      { id: "map", mode: "plan", text: "Map", effects: { goto: { map: "yard", x: 6, y: 5, facing: 3 } } },
      { id: "scene", mode: "plan", text: "Scene", effects: { goto: { scene: "draft" } } } ] };
  });
  const open = { ...place(delve(pack), 1, 1, 1), mode: "scene", scene: { id: "lab", said: [], taken: [], from: "map", gate: false } };
  const r = ok(pack, open, { t: "choose", id: "all" });
  const s = r.state;
  assert.equal(s.flags.a, true); assert.equal(s.flags.b, undefined);
  assert.equal(s.items.torch, open.items.torch + 2); assert.equal(s.items.lantern, undefined); assert.equal(s.gold, 7);
  assert.deepEqual([mem(s, "fighter").marked.hp, mem(s, "elf").marked.hp], [1, 2], "front rank takes 2; the fighter heals 1");
  assert.ok(s.party.every(m => m.cond.includes("dazed")));
  assert.equal(mem(s, "fighter").bonus.fight, 1);
  assert.equal(mem(s, "fighter").fate, 2);
  assert.equal(s.light.source, "spell");
  assert.equal(s.mode, "map");
  assert.equal(r.events.some(e => e.k === "heal"), true);
  assert.equal(ok(pack, open, { t: "choose", id: "end" }).state.ending, "end-dead");
  assert.equal(ok(pack, open, { t: "choose", id: "enc" }).state.mode, "fight");
  const m = ok(pack, open, { t: "choose", id: "map" }).state;
  assert.deepEqual([m.pos.x, m.pos.y, m.pos.facing], [6, 5, 3]);
  assert.equal(m.scene.id, "draft", "arriving on the cell opens its event");
  assert.equal(ok(pack, open, { t: "choose", id: "scene" }).state.scene.id, "draft");
  assert.equal(ok(pack, open, { t: "choose", id: "scene" }).state.scene.from, "map");
});

test("stairs: moving into the cell or act uses the link; links reach maps and scenes", () => {
  const pack = edit(OSE, p => {
    p.maps.upper = { id: "upper", title: "Upper", tier: "T", grid: ["#####", "#a>a#", "#####"], legend: { a: { area: "U" } }, cells: { "2,1": { link: { map: "yard", x: 2, y: 2, facing: 2 } } },
      areas: { U: { name: "Upstairs", light: "dim" } } };
    p.maps.yard.cells["2,3"].link = { map: "upper", x: 1, y: 1, facing: 1 };
    p.maps.yard.cells["1,3"] = { link: { scene: "draft" } };
  });
  const s = place(delve(pack), 2, 2, 2);
  assert.equal(Crawl.view(pack, s).map.can.act, true);
  const byAct = ok(pack, s, { t: "act" });
  assert.deepEqual(byAct.state.pos, { map: "upper", x: 1, y: 1, facing: 1 });
  assert.deepEqual(byAct.state.prev, { map: "yard", x: 2, y: 2, facing: 2 }, "run would take you back down");
  const byMove = ok(pack, s, { t: "move", dir: "forward" });
  assert.deepEqual(byMove.state.pos, byAct.state.pos);
  assert.equal(byMove.state.visited.upper.U, true);
  assert.equal(Crawl.view(pack, byMove.state).hud.area.name, "Upstairs");
  assert.equal(byMove.events.some(e => e.k === "move"), true);
  // Back down the other stair.
  const down = ok(pack, byMove.state, { t: "move", dir: "forward" }).state;
  assert.deepEqual(down.pos, { map: "yard", x: 2, y: 2, facing: 2 });
  // A link to a scene opens it; stepping back leaves you where you were.
  const sc = ok(pack, place(s, 1, 2, 2), { t: "move", dir: "forward" });
  assert.equal(sc.state.scene.id, "draft");
  assert.deepEqual(ok(pack, sc.state, { t: "choose", id: "leave" }).state.pos, { map: "yard", x: 1, y: 2, facing: 2 });
});

test("effects: the who words", () => {
  const pack = edit(OSE, p => {
    p.events.lab = { title: "Lab", text: ["x"], choices: ["party", "front", "leader", "random", "self"].map(who => ({ id: who, mode: "plan", text: who, effects: { damage: { who, amount: 1 } } })) };
  });
  const open = { ...place(delve(pack), 1, 1, 1), mode: "scene", scene: { id: "lab", said: [], taken: [], from: "map", gate: false } };
  const marked = id => Object.fromEntries(OSE_IDS.map(m => [m, mem(ok(pack, open, { t: "choose", id }).state, m).marked.hp]));
  assert.deepEqual(marked("party"), { fighter: 1, elf: 1, paladin: 1, minister: 1 });
  assert.deepEqual(marked("front"), { fighter: 1, elf: 1, paladin: 0, minister: 0 });
  assert.deepEqual(marked("leader"), { fighter: 1, elf: 0, paladin: 0, minister: 0 });
  assert.deepEqual(marked("self"), { fighter: 1, elf: 0, paladin: 0, minister: 0 }, "in a scene, self is the leader");
  assert.equal(Object.values(marked("random")).reduce((a, b) => a + b, 0), 1);
  // In a fight: foes, foe, nearest.
  const f = fightAt(OSE, OSE_IDS);
  const foes = edit(OSE, p => {
    p.abilities.volley = { name: "Volley", kind: "spell", per: "rest", uses: 3, when: "fight", target: "foe", effects: { damage: { who: "foe", amount: 1 }, condition: { who: "nearest", n: 1, add: "asleep" } } };
    p.abilities.blast = { name: "Blast", kind: "spell", per: "rest", uses: 3, when: "fight", target: "foes", effects: { damage: { who: "foes", amount: 1 } } };
    p.party.roster.elf.abilities.push("volley", "blast");
  });
  const v = ok(foes, f, { t: "use", member: "elf", ability: "volley", target: 1 });
  assert.deepEqual(v.state.foes["store-rats"].map(x => [x.marked, x.state]), [[0, "asleep"], [1, "awake"]]);
  const b = ok(foes, f, { t: "use", member: "elf", ability: "blast" });
  assert.deepEqual(b.state.foes["store-rats"].map(x => x.marked), [1, 1]);
  assert.equal(Crawl.step(foes, f, { t: "use", member: "elf", ability: "volley", target: 7 }).events[0].k, "refuse");
});

test("scenes: the search scene opens once; cell events open once", () => {
  const base = lit(place(delve(OSE), 7, 5, 0, { visited: { yard: { A: true, B: true, C: true, D: true } } }));
  const r = ok(OSE, rig(base, d6(6)), { t: "search" });
  assert.equal(r.state.mode, "scene");
  assert.equal(r.state.scene.id, "nook-search");
  const take = ok(OSE, r.state, { t: "choose", id: "take" });
  assert.deepEqual([take.state.items["oil-flask"], take.state.items["stone-apple"]], [2, 1]);
  assert.equal(take.state.turn, r.state.turn + 1, "the act choice costs its turn");
  assert.equal(Crawl.view(OSE, take.state).scene.choices.find(c => c.id === "take").enabled, false, "once");
  const closed = ok(OSE, take.state, { t: "choose", id: "leave" }).state;
  assert.equal(ok(OSE, rig(closed, d6(6)), { t: "search" }).state.mode, "map", "the search scene opens only once");
  // The draft scene on the floor cell at 6,5.
  const west = lit(place(delve(OSE), 5, 5, 1, { visited: { yard: { A: true, C: true } } }));
  const e = ok(OSE, west, { t: "move", dir: "forward" });
  assert.equal(e.state.scene.id, "draft");
  assert.equal(e.state.turn, west.turn, "a floor cell with no area costs nothing");
  const out = play(OSE, e.state, { t: "choose", id: "feel" }, { t: "choose", id: "leave" }, { t: "move", dir: "back" }, { t: "move", dir: "forward" }).state;
  assert.equal(out.mode, "map", "it does not open again");
});

// ---------------------------------------------------------------------------------------------
test("hub: rest clears marks, conditions and restores Fate and uses", () => {
  let s = play(OSE, Crawl.create(OSE, { seed: 2 }), { t: "pick", ids: OSE_IDS }, { t: "choose", id: "ok" }).state;
  s = withMem(s, "fighter", { marked: { hp: 5 }, fate: 0, used: { "know-how-made": 1 }, cond: ["dazed"] });
  s = withMem(s, "minister", { used: { "cure-light-wounds": 1 } });
  s = { ...s, sinceRest: 9 };
  const r = ok(OSE, s, { t: "hub", action: "rest" });
  const f = mem(r.state, "fighter");
  assert.deepEqual([f.marked.hp, f.fate, f.used, f.cond], [0, 3, {}, []]);
  assert.deepEqual(mem(r.state, "minister").used, {});
  assert.equal(r.state.sinceRest, 0);
  assert.deepEqual(r.events.find(e => e.k === "heal"), { k: "heal", who: "fighter", track: "hp", amount: 5 });
  // Dead stay dead under down: "dead".
  const dead = { ...withMem(s, "elf", { down: true, dead: true, marked: { hp: 6 } }) };
  dead.order = dead.order.filter(x => x !== "elf");
  const rd = ok(OSE, dead, { t: "hub", action: "rest" }).state;
  assert.equal(mem(rd, "elf").dead, true);
  assert.equal(rd.order.includes("elf"), false);
});

test("hub: the shop buys, and sells treasure at its value", () => {
  let s = play(OSE, Crawl.create(OSE, { seed: 2 }), { t: "pick", ids: OSE_IDS }, { t: "choose", id: "ok" }).state;
  assert.equal(Crawl.step(OSE, s, { t: "hub", action: "buy", buy: "torch" }).events[0].k, "refuse", "no gold");
  s = { ...s, gold: 10, items: { ...s.items, "stone-apple": 2 } };
  let r = ok(OSE, s, { t: "hub", action: "buy", buy: "oil-flask", n: 3 });
  assert.deepEqual([r.state.gold, r.state.items["oil-flask"]], [4, 3]);
  assert.equal(Crawl.step(OSE, r.state, { t: "hub", action: "buy", buy: "oil-flask", n: 3 }).events[0].k, "refuse");
  assert.equal(Crawl.step(OSE, r.state, { t: "hub", action: "buy", buy: "stone-apple" }).events[0].k, "refuse", "not in stock");
  r = ok(OSE, r.state, { t: "hub", action: "buy", sell: "stone-apple" });
  assert.deepEqual([r.state.gold, r.state.items["stone-apple"]], [29, 1], "sells at value 25");
  assert.equal(Crawl.step(OSE, r.state, { t: "hub", action: "buy", sell: "torch" }).events[0].k, "refuse", "only treasure");
  assert.equal(Crawl.step(OSE, r.state, { t: "hub", action: "buy", sell: "stone-apple", n: 5 }).events[0].k, "refuse");
  const shop = Crawl.view(OSE, r.state).hub.places.find(p => p.id === "shop").actions[0];
  assert.deepEqual(shop.stock.map(x => [x.item, x.price]), [["torch", 1], ["oil-flask", 2]]);
  assert.deepEqual(shop.sell.map(x => [x.item, x.value, x.count]), [["stone-apple", 25, 1]]);
});

test("hub: roster swaps members; a dead one is replaced from the bench at the roster action", () => {
  let s = play(OSE, Crawl.create(OSE, { seed: 2 }), { t: "pick", ids: OSE_IDS }, { t: "choose", id: "ok" }).state;
  assert.deepEqual(s.bench, ["wizard"]);
  // A swap by ids.
  const sw = ok(OSE, s, { t: "hub", action: "roster", ids: ["wizard", "fighter", "elf", "paladin"] });
  assert.deepEqual(sw.state.order, ["wizard", "fighter", "elf", "paladin"]);
  assert.deepEqual(sw.state.bench, ["minister"]);
  assert.equal(mem(sw.state, "fighter").marked.hp, 0);
  assert.equal(sw.state.items.torch, 8, "the wizard brings 3 torches once");
  const swBack = ok(OSE, sw.state, { t: "hub", action: "roster", ids: OSE_IDS });
  assert.equal(swBack.state.items.torch, 8, "swapping back and forth does not duplicate gear");
  assert.equal(Crawl.step(OSE, s, { t: "hub", action: "roster", ids: ["wizard", "fighter"] }).events[0].k, "refuse");
  // The dead are replaced from the bench with no ids.
  const dead = withMem(s, "paladin", { down: true, dead: true, marked: { hp: 8 } });
  dead.order = dead.order.filter(x => x !== "paladin");
  const r = ok(OSE, dead, { t: "hub", action: "roster" });
  assert.deepEqual(r.state.party.map(m => m.id), ["fighter", "elf", "wizard", "minister"]);
  assert.deepEqual(r.state.order, ["fighter", "elf", "minister", "wizard"]);
  assert.deepEqual(r.state.bench, []);
  assert.equal(mem(r.state, "wizard").dead, false);
  // The dead cannot be picked again.
  assert.equal(Crawl.step(OSE, r.state, { t: "hub", action: "roster", ids: ["paladin", "fighter", "elf", "wizard"] }).events[0].k, "refuse");
  // With no one on the bench the dead stay.
  const none = ok(OSE, dead, { t: "hub", action: "roster", ids: ["wizard", "fighter", "elf", "minister"] });
  assert.equal(none.state.bench.includes("paladin"), false);
  // The pick command does the same job from the hub.
  assert.deepEqual(ok(OSE, s, { t: "pick", ids: ["wizard", "fighter", "elf", "paladin"] }).state.order, ["wizard", "fighter", "elf", "paladin"]);
  // Marching order.
  const ord = ok(OSE, s, { t: "order", ids: ["minister", "paladin", "elf", "fighter"] });
  assert.deepEqual(ord.state.order, ["minister", "paladin", "elf", "fighter"]);
  assert.deepEqual(Crawl.view(OSE, ord.state).party.map(m => [m.id, m.rank]), [["minister", "front"], ["paladin", "front"], ["elf", "back"], ["fighter", "back"]]);
  assert.equal(Crawl.step(OSE, s, { t: "order", ids: ["minister", "paladin", "elf"] }).events[0].k, "refuse");
});

test("hub: the report lists lines for set flags", () => {
  let s = play(OSE, Crawl.create(OSE, { seed: 2 }), { t: "pick", ids: OSE_IDS }, { t: "choose", id: "ok" }).state;
  const hub = st => Crawl.view(OSE, st).hub;
  assert.deepEqual(hub(s).report, []);
  s = { ...s, flags: { "rats-gone": true } };
  assert.deepEqual(hub(s).report, ["The rats are gone from the store."]);
  s = { ...s, flags: { "rats-gone": true, "heard-rats": true, other: true } };
  assert.deepEqual(hub(s).report, ["The rats are gone from the store.", "You heard them before you saw them."]);
  assert.equal(hub(s).reportTitle, "What you tell Maren");
  // Winning the fight sets the flag; going home shows the line.
  const f = fightAt(OSE, OSE_IDS);
  const won = play(OSE, f, orders([["fighter", "fight"], ["elf", "fight"], ["paladin", "guard"], ["minister", "guard"]]));
  const small = edit(OSE, p => { p.encounters["store-rats"].foes = [{ id: "giant-rat", count: 1, hp: [1] }]; });
  const fs = fightAt(small, OSE_IDS);
  let w = ok(small, rig(fs, d20(15), d8(4)), orders([["fighter", "fight"], ["elf", "guard"], ["paladin", "guard"], ["minister", "guard"]])).state;
  assert.equal(w.mode, "map");
  assert.ok(won.state);
  w = play(small, place(w, 2, 2, 2), { t: "move", dir: "forward" }).state;
  assert.equal(w.mode, "hub", "the stairs lead home");
  assert.deepEqual(Crawl.view(small, w).hub.report.includes("The rats are gone from the store."), true);
  assert.equal(w.light.source, null, "the light is snuffed at home");
});

// ---------------------------------------------------------------------------------------------
test("view: every field of section 9, in each mode", () => {
  const top = ["mode", "hud", "party", "map", "scene", "fight", "hub", "roster", "ending", "log"];
  const hudKeys = ["turn", "minutes", "light", "dark", "tired", "gold", "area"];
  const checkTop = v => { for (const k of top) assert.ok(k in v, "view." + k); assert.deepEqual(Object.keys(v.hud).sort(), hudKeys.slice().sort()); };
  for (const pack of [OSE, FATE]) {
    const ids = pack.party.default;
    // roster
    let s = Crawl.create(pack, { seed: 5 });
    let v = Crawl.view(pack, s);
    checkTop(v);
    assert.equal(v.mode, "roster");
    assert.equal(v.map, null); assert.equal(v.scene, null); assert.equal(v.fight, null); assert.equal(v.hub, null); assert.equal(v.ending, null);
    const rm = v.roster.members[0];
    for (const k of ["id", "name", "title", "text", "npc", "stats", "card"]) assert.ok(k in rm, "roster member " + k);
    assert.deepEqual(rm.stats.map(x => x.label), pack.rules.stats.map(x => x.label));
    assert.ok(rm.card.length >= 1);
    // scene from the hub
    s = ok(pack, s, { t: "pick", ids }).state;
    v = Crawl.view(pack, s);
    checkTop(v);
    assert.equal(v.mode, "scene");
    assert.equal(v.map, null);
    for (const k of ["id", "title", "text", "said", "choices", "gate"]) assert.ok(k in v.scene, "scene." + k);
    for (const k of ["id", "text", "mode", "enabled", "reason"]) assert.ok(k in v.scene.choices[0], "choice." + k);
    assert.equal(v.hud.area, null);
    assert.equal(v.hud.minutes, 0);
    assert.equal(v.party.length, 4);
    for (const k of ["id", "name", "title", "rank", "down", "dead", "fate", "tracks", "cond", "abilities"]) assert.ok(k in v.party[0], "party." + k);
    assert.deepEqual(v.party.map(m => m.rank), ["front", "front", "back", "back"]);
    assert.deepEqual(v.party[0].tracks.map(t => Object.keys(t).sort()), pack.rules.tracks.map(() => ["id", "label", "marked", "max"]));
    for (const k of ["id", "name", "left", "usable"]) assert.ok(k in v.party[0].abilities[0], "ability." + k);
    // hub
    s = ok(pack, s, { t: "choose", id: "ok" }).state;
    v = Crawl.view(pack, s);
    checkTop(v);
    assert.equal(v.mode, "hub");
    for (const k of ["title", "text", "places", "report"]) assert.ok(k in v.hub, "hub." + k);
    assert.equal(v.hub.places.length, 4);
    // map
    s = lit(delve(pack), pack.id === "test" ? "torch" : "battery", 9);
    s = place(s, 5, 1, 1, { visited: { yard: { A: true, B: true } }, done: { "store-rats": true } });
    v = Crawl.view(pack, s);
    checkTop(v);
    assert.equal(v.mode, "map");
    for (const k of ["id", "title", "x", "y", "facing", "ahead", "can", "automap"]) assert.ok(k in v.map, "map." + k);
    assert.deepEqual(Object.keys(v.map.can).sort(), ["act", "back", "forward", "left", "listen", "rest", "right", "search"]);
    assert.deepEqual(Object.keys(v.map.automap).sort(), ["h", "rows", "w"]);
    assert.deepEqual(v.hud.area, { key: "B", name: pack.maps.yard.areas.B.name });
    assert.deepEqual(v.hud.light, { label: pack.id === "test" ? "Torch" : "Battery cell", left: 9 });
    assert.equal(v.hud.minutes, s.turn * 10);
    // scene from the map
    const sc = ok(pack, place(s, 4, 1, 1, { visited: { yard: { A: true } }, done: {} }), { t: "move", dir: "forward" });
    v = Crawl.view(pack, sc.state);
    checkTop(v);
    assert.equal(v.mode, "scene");
    assert.ok(v.map && v.map.id === "yard", "a scene opened on the map keeps the map");
    assert.equal(v.map.can.forward, false);
    // death's door
    const door = withMem(fightAt(pack, ids), ids[0], { marked: Object.fromEntries(pack.rules.tracks.map(t => [t.id, 99])) });
    v = Crawl.view(pack, { ...door, mode: "deathDoor" });
    checkTop(v);
    assert.deepEqual(v.door, { who: ids[0], cost: 2 });
    assert.ok(v.fight && v.map);
    // fight
    const f = fightAt(pack, ids);
    v = Crawl.view(pack, f);
    checkTop(v);
    assert.equal(v.mode, "fight");
    for (const k of ["round", "foes", "members", "canReroll", "canRun"]) assert.ok(k in v.fight, "fight." + k);
    for (const k of ["i", "name", "state", "hp"]) assert.ok(k in v.fight.foes[0], "foe." + k);
    for (const k of ["id", "acts", "abilities", "items"]) assert.ok(k in v.fight.members[0], "member." + k);
    assert.equal(v.fight.foes.length, 2);
    assert.ok(sc.state);
    // ending
    const e = ok(pack, play(pack, f, orders(ids.map(id => [id, "guard"]))).state, { t: "restart" });
    assert.equal(Crawl.view(pack, e.state).mode, "roster");
    const end = { ...clone(f), mode: "ending", ending: pack.rules.endings.wipe, fight: null };
    v = Crawl.view(pack, end);
    checkTop(v);
    for (const k of ["id", "title", "kind", "text"]) assert.ok(k in v.ending, "ending." + k);
    assert.equal(v.map, null);
  }
});

test("view: map.ahead is 4 rows of [L, C, R]; a secret door not found is a wall; darkness is dark", () => {
  const base = lit(place(delve(OSE), 1, 1, 1, {}), "torch", 9);
  // At 1,1 facing east: row 0 is the party's row; L is north (wall), R is south (open).
  const v = Crawl.view(OSE, base).map.ahead;
  assert.equal(v.length, 4);
  assert.ok(v.every(row => row.length === 3));
  assert.deepEqual(v[0], ["wall", "open", "open"]);
  assert.deepEqual(v[1], ["wall", "open", "open"]);
  assert.deepEqual(v[2], ["wall", "open", "open"]);
  assert.deepEqual(v[3], ["wall", "door", "wall"], "x=4 is the door; the cells north and south of it are walls");
  // Facing north from 1,1: wall ahead; out of bounds is a wall too.
  const north = Crawl.view(OSE, { ...base, pos: { ...base.pos, x: 1, y: 1, facing: 0 } }).map.ahead;
  assert.deepEqual(north[1], ["wall", "wall", "wall"]);
  assert.deepEqual(north[3], ["wall", "wall", "wall"]);
  // South of the store, facing the secret door: a wall until found, then a door.
  const store = lit(place(delve(OSE), 6, 3, 2, { visited: { yard: { A: true, B: true } } }), "torch", 9);
  assert.equal(Crawl.view(OSE, store).map.ahead[1][1], "wall");
  assert.equal(Crawl.view(OSE, see(store)).map.automap.rows[4][6], "#", "the automap hides it too");
  const found = { ...clone(store), doors: { yard: { "6,4": "found" } } };
  assert.equal(Crawl.view(OSE, found).map.ahead[1][1], "door");
  assert.equal(Crawl.view(OSE, found).map.ahead[2][1], "open", "the floor cell beyond");
  // Stuck, stairs and water kinds.
  const passage = lit(place(delve(OSE), 2, 5, 0), "torch", 9);
  assert.equal(Crawl.view(OSE, passage).map.ahead[1][1], "stuck");
  const opened = { ...clone(passage), doors: { yard: { "2,4": "open" } } };
  const up = Crawl.view(OSE, opened).map.ahead;
  assert.deepEqual([up[1][1], up[2][1]], ["door", "stairs"]);
  const wet = edit(OSE, p => { p.maps.yard.grid[1] = "#aaa+b~b#"; });
  assert.equal(Crawl.view(wet, lit(place(delve(wet), 4, 1, 1), "torch", 9)).map.ahead[2][1], "water");
  // Dark: everything but your own cell.
  const dark = { ...clone(store), light: { source: null, left: 0, stash: {} }, doors: { yard: { "6,4": "found" } } };
  const dv = Crawl.view(OSE, dark);
  assert.equal(dv.hud.dark, true);
  assert.deepEqual(dv.map.ahead.flat().filter(k => k !== "dark"), ["open"]);
  assert.equal(dv.map.ahead[0][1], "open");
  assert.equal(dv.map.ahead[1][1], "dark");
  // Daylight is never dark.
  assert.equal(Crawl.view(OSE, place(delve(OSE), 2, 2, 1)).hud.dark, false);
});

test("view: can{} says what the commands will do; the automap shows what was seen", () => {
  const s = lit(place(delve(OSE), 3, 1, 1), "torch", 9);
  const walked = play(OSE, lit(delve(OSE), "torch", 9), { t: "move", dir: "forward" }, { t: "move", dir: "forward" }, { t: "move", dir: "right" }).state;
  const can = Crawl.view(OSE, s).map.can;
  assert.deepEqual(can, { forward: true, back: true, left: false, right: true, act: true, search: true, listen: true, rest: true });
  const wall = Crawl.view(OSE, place(s, 1, 1, 0)).map.can;
  assert.deepEqual([wall.forward, wall.act, wall.listen], [false, false, false]);
  // Not in map mode: nothing is possible.
  const f = fightAt(OSE, OSE_IDS);
  assert.deepEqual(Object.values(Crawl.view(OSE, f).map.can), Array(8).fill(false));
  // Automap: unseen cells are spaces.
  const a = Crawl.view(OSE, walked).map.automap;
  assert.deepEqual([a.w, a.h], [9, 7]);
  assert.equal(a.rows.length, 7);
  assert.ok(a.rows.every(r => r.length === 9));
  assert.equal(a.rows[6].trim(), "", "far rows are unseen");
  assert.equal(a.rows[1][3], ".");
  assert.equal(a.rows[1][4], "+");
  assert.equal(a.rows[0][3], "#");
  assert.equal(a.rows[1][8], " ", "cells you have not been near are blank");
  assert.equal(a.rows[3][2], "<", "stairs show as stairs once seen");
});

test("view: abilities say what is usable now", () => {
  const s = lit(place(delve(OSE), 3, 1, 1), "torch", 9);
  const ab = (st, id, a) => Crawl.view(OSE, st).party.find(m => m.id === id).abilities.find(x => x.id === a);
  assert.deepEqual([ab(s, "elf", "light").usable, ab(s, "elf", "light").left], [true, 1]);
  assert.equal(ab(s, "elf", "remember-when").usable, false, "fate abilities work only in scenes");
  const used = ok(OSE, s, { t: "use", member: "minister", ability: "cure-light-wounds", target: "fighter" }).state;
  assert.deepEqual([ab(used, "minister", "cure-light-wounds").usable, ab(used, "minister", "cure-light-wounds").left], [false, 0]);
  const w = ok(OSE, Crawl.create(OSE), { t: "pick", ids: ["wizard", "fighter", "elf", "paladin"] }).state;
  assert.equal(ab({ ...w, mode: "map", scene: null, pos: s.pos }, "wizard", "sleep").usable, false, "Sleep is for fights");
});

test("use: heal an ally on the map; targets are checked", () => {
  let s = withMem(lit(place(delve(OSE), 3, 1, 1), "torch", 9), "fighter", { marked: { hp: 6 } });
  const heal = ok(OSE, rig(s, [6, 3]), { t: "use", member: "minister", ability: "cure-light-wounds", target: "fighter" });
  assert.equal(mem(heal.state, "fighter").marked.hp, 2, "1d6+1 = 4");
  assert.deepEqual(heal.events.find(e => e.k === "heal"), { k: "heal", who: "fighter", track: "hp", amount: 4 });
  assert.equal(Crawl.step(OSE, s, { t: "use", member: "minister", ability: "cure-light-wounds" }).events[0].k, "refuse", "needs a target");
  assert.equal(Crawl.step(OSE, s, { t: "use", member: "minister", ability: "cure-light-wounds", target: "nobody" }).events[0].k, "refuse");
  // Healing never goes below nothing marked.
  const light = withMem(s, "fighter", { marked: { hp: 1 } });
  assert.equal(mem(ok(OSE, light, { t: "use", member: "paladin", ability: "lay-on-hands", target: "fighter" }).state, "fighter").marked.hp, 0);
  // Only the owner may use an ability.
  assert.equal(Crawl.step(OSE, s, { t: "use", member: "fighter", ability: "cure-light-wounds", target: "fighter" }).events[0].k, "refuse");
  // fate4df: heal on a named track.
  const fs = withMem(lit(place(delve(FATE), 3, 1, 1), "battery", 9), "reyes", { marked: { meat: 2, nerves: 1, systems: 0 } });
  const fh = ok(FATE, fs, { t: "use", member: "marcus", ability: "patch", target: "reyes" });
  assert.deepEqual(mem(fh.state, "reyes").marked, { meat: 0, nerves: 1, systems: 0 });
});

test("fate4df pack: the whole walk-through works", () => {
  let s = delve(FATE, 12);
  assert.equal(s.mode, "map");
  assert.equal(Crawl.view(FATE, s).hud.area.key, "A");
  s = play(FATE, s, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }, { t: "move", dir: "forward" }).state;
  assert.equal(s.light.source, "flare", "the battery needs a dive lamp, so the flare comes next");
  assert.equal(s.mode, "scene");
});

// ---------------------------------------------------------------------------------------------
// Integration fixes (the crawler acceptance walk found these).
test("a wandering encounter rolled while a scene opens waits, and comes when the scene closes", () => {
  // Searching the nook ticks one turn (turn 2: a wander check), then opens its search scene. The hit used to be lost.
  const s0 = lit(place(delve(OSE), 7, 5, 0, { turn: 1, visited: { yard: { A: true, D: true } } }));
  const r = ok(OSE, rig(s0, d6(1), [1, 1]), { t: "search" });
  assert.equal(r.state.mode, "scene");
  assert.equal(r.state.queued, "lone-rat", "kept in the state, not dropped");
  assert.equal(r.events.filter(e => e.k === "wander").every(e => e.hit), true);
  // It survives a JSON round trip, and the scene plays on.
  const back = JSON.parse(JSON.stringify(r.state));
  const taken = ok(OSE, back, { t: "choose", id: "take" });
  assert.equal(taken.state.mode, "scene");
  assert.equal(taken.state.queued, "lone-rat");
  // Stepping back out of the scene starts the fight.
  const out = ok(OSE, taken.state, { t: "choose", id: "leave" });
  assert.equal(out.state.mode, "fight");
  assert.equal(out.state.fight.enc, "lone-rat");
  assert.equal(out.state.fight.wander, true);
  assert.equal(out.state.queued, null);
  // Going home from the scene drops it: the hub has no wandering monsters.
  const homePack = edit(OSE, p => p.events["nook-search"].choices.push({ id: "home", mode: "act", text: "Home.", effects: { goto: { hub: true } } }));
  const home = ok(homePack, r.state, { t: "choose", id: "home" });
  assert.equal(home.state.mode, "hub");
  assert.equal(home.state.queued, null);
  // A check that misses queues nothing.
  const miss = ok(OSE, rig(s0, d6(6)), { t: "search" });
  assert.equal(miss.state.queued, null);
});

test("act on an unfound secret door does nothing, even if the cell carries a link", () => {
  const pack = edit(OSE, p => { p.maps.yard.cells["6,4"] = { link: { hub: true } }; });
  const s = lit(place(delve(pack), 6, 5, 0, { visited: { yard: { A: true, C: true } } }));
  assert.equal(Crawl.view(pack, s).map.ahead[1][1], "wall");
  assert.equal(Crawl.view(pack, s).map.can.act, false);
  const r = Crawl.step(pack, s, { t: "act" });
  assert.equal(r.events[0].k, "refuse");
  assert.equal(r.state, s);
  assert.equal(Crawl.step(pack, s, { t: "move", dir: "forward" }).events.some(e => e.k === "bump"), true);
  // Once found, the door is a door and the link works.
  const found = { ...clone(s), doors: { yard: { "6,4": "found" } } };
  assert.equal(Crawl.view(pack, found).map.can.act, true);
  assert.equal(ok(pack, found, { t: "act" }).state.mode, "hub");
});

test("the fight view carries each foe's stat card, when the pack has one", () => {
  for (const [pack, ids] of [[OSE, OSE_IDS], [FATE, FATE_IDS]]) {
    const v = Crawl.view(pack, fightAt(pack, ids));
    const mon = pack.bestiary[pack.encounters["store-rats"].foes[0].id];
    assert.deepEqual(v.fight.foes[0].card, [mon.oseLine, mon.note5e].filter(Boolean));
    assert.ok(v.fight.foes.every(f => Array.isArray(f.card)));
  }
  assert.ok(Crawl.view(OSE, fightAt(OSE, OSE_IDS)).fight.foes[0].card.length >= 1, "the ose fixture has a stat line");
});

// ---- review fixes: view model additions ----
test("view: a scene carries its notes; a fight carries foe boxes; a stall row says whether it can be paid; an ability carries its text", () => {
  const pack = edit(OSE, p => {
    p.events.yard.notes = ["Size: 30' × 20'."];
    p.abilities.light.text = "A cold light.";
  });
  const sc = { ...place(delve(pack), 1, 1, 1), mode: "scene", scene: { id: "yard", said: [], taken: [], from: "map", gate: false } };
  assert.deepEqual(Crawl.view(pack, sc).scene.notes, ["Size: 30' × 20'."]);
  assert.deepEqual(Crawl.view(OSE, sc).scene.notes, [], "no notes is an empty list");
  assert.equal(Crawl.view(pack, sc).party.flatMap(m => m.abilities).find(a => a.id === "light").text, "A cold light.");
  assert.equal(Crawl.view(OSE, sc).party.flatMap(m => m.abilities).find(a => a.id === "light").text, "");
  // Foe boxes on 4dF: marked and max, and a label that says it in words.
  const f = fightAt(FATE, FATE_IDS), foe = Crawl.view(FATE, f).fight.foes[0];
  assert.equal(foe.marked, 0);
  assert.equal(foe.max, FATE.bestiary[FATE.encounters["store-rats"].foes[0].id].stress);
  assert.equal(foe.hp, `stress 0 of ${foe.max}`);
  // A stall row.
  const hub = { ...ok(OSE, Crawl.create(OSE), { t: "pick", ids: OSE_IDS }).state, mode: "hub", scene: null };
  const rows = st => Crawl.view(OSE, st).hub.places.flatMap(p => p.actions).find(a => a.kind === "shop").stock;
  assert.deepEqual(rows(hub).map(r => [r.price, r.enabled]), [[1, false], [2, false]], "no money: nothing can be bought");
  assert.equal(rows(hub)[0].reason, "Not enough gold.");
  const rich = { ...clone(hub), gold: 1 };
  assert.deepEqual(rows(rich).map(r => r.enabled), [true, false], "one gold buys the torch only");
  // The money word follows the pack.
  const credits = edit(OSE, p => { p.theme.labels.gold = "credits"; });
  const r = Crawl.step(credits, hub, { t: "hub", action: "buy", buy: "torch" });
  assert.equal(r.events[0].text, "Not enough credits.");
});
