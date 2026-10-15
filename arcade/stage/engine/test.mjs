// Engine tests. Run: node --test stage/engine/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPack } from "../tools/load.mjs";

const Stage = createRequire(import.meta.url)("./stage.js");
const packs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packs");
const OSE = loadPack(path.join(packs, "test"));
const FEED = loadPack(path.join(packs, "test-feed"));

// ---- helpers ----
const clone = o => JSON.parse(JSON.stringify(o));
const edit = (pack, fn) => { const p = clone(pack); fn(p); return p; };

// A tiny valid pack. Scenes default to a one-beat scene that ends at "e".
function mini(scenes, extra = {}) {
  return {
    id: "mini", title: "Mini", kit: "paper", resolver: "ose", start: scenes[0].id, storageKey: "fort-stage.mini",
    meters: [{ id: "fate", label: "Fate", min: 0, max: 3, start: 1 }, { id: "lamp", label: "Lamp", min: 0, max: 5, start: 2 }],
    fields: [{ id: "f", label: "F" }, { id: "g", label: "G" }],
    tallies: { lens: ["hymn", "machine"] },
    commentary: { label: "How", kinds: ["dm", "rule"] },
    notes: { r: { kind: "rule", term: "R", text: "A rule." }, d: { kind: "dm", term: "D", text: "A dm note." }, l: { kind: "lore", term: "L", text: "Some lore." } },
    sets: { s: { kit: "paper", layers: [{ prim: "spread", art: "art/x.svg" }] }, t: { kit: "paper", layers: [{ prim: "spread", art: "art/y.svg" }] } },
    script: { scenes, endings: { e: { title: "The end", look: "paint", set: "s", beats: [{ text: "Done." }] }, e2: { title: "Other end", look: "ink", set: "t", beats: [] } } },
    ...extra,
  };
}
const sc = (id, o = {}) => ({ id, title: id, place: "", look: "ink", set: "s", beats: [{ text: "beat " + id }], ending: "e", ...o });
const grp = (key, gate, options, o = {}) => ({ key, ask: "Ask " + key, gate, options, ...o });
const opt = (key, o = {}) => ({ key, label: "Opt " + key, ...o });
const types = v => v.cues.map(c => c.type);
// The cues of a step, without the scene-change ones a pick at the end of a scene adds.
const own = v => v.cues.filter(c => !["turn", "ink", "bloom"].includes(c.type));
// A game stepped forward to the first choice.
function atChoice(pack, opts) {
  const g = Stage.create(pack, opts);
  for (let i = 0; i < 50 && g.view().node !== "choice"; i++) g.next();
  assert.equal(g.view().node, "choice");
  return g;
}

// Play to the end by taking the first selectable option and typing "x". Returns every view.
function autoplay(g, limit = 500) {
  const views = [g.view()];
  for (let i = 0; i < limit && views[views.length - 1].node !== "ending"; i++) {
    const v = views[views.length - 1];
    if (v.node === "choice") views.push(g.choose(v.options.find(o => !o.locked).key));
    else if (v.node === "input") views.push(g.input("x"));
    else views.push(g.next());
  }
  return views;
}
// Beat texts shown while playing with a pick list ("group.option"); anything else is auto.
function texts(pack, picks = [], opts = {}) {
  const g = Stage.create(pack, opts);
  const out = [];
  let i = 0;
  for (let n = 0; n < 500; n++) {
    const v = g.view();
    if (v.node === "beat") { out.push(v.beat.text); g.next(); }
    else if (v.node === "choice") { const [gk, ok] = picks[i++].split("."); assert.equal(v.group.key, gk); g.choose(ok); }
    else if (v.node === "input") g.input("typed");
    else if (v.node === "roll") g.next();
    else break;
  }
  return out;
}

// ---- determinism and dice ----
test("same seed, same game; different seeds differ", () => {
  const run = seed => { const g = Stage.create(OSE, { seed }); const vs = autoplay(g); return JSON.stringify(vs.map(v => [v.node, v.meters, v.cues])); };
  assert.equal(run(7), run(7));
  const outcomes = new Set();
  for (let s = 1; s <= 40; s++) outcomes.add(run(s));
  assert.ok(outcomes.size > 1, "seeds should change the dice");
});

test("no Math.random and no timers in the engine source", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "stage.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /Math\.random|setTimeout|setInterval|requestAnimationFrame|document\.|window\./);
});

function rollPack(resolver, dice, vs, results, add = 0) {
  return mini([sc("a", { choices: [grp("c", "exec", [opt("go", { roll: { dice, vs, add, results } })])] })], { resolver });
}
const rollOnce = (pack, seed) => atChoice(pack, { seed }).choose("go");

test("ose: success meets or beats vs; both results occur; faces are valid dice", () => {
  const pack = rollPack("ose", "2d6", 8, { fail: { then: [{ text: "F" }] }, success: { then: [{ text: "S" }] } });
  const seen = { fail: 0, success: 0 };
  for (let s = 1; s <= 200; s++) {
    const v = rollOnce(pack, s);
    assert.equal(v.node, "roll");
    assert.equal(v.roll.faces.length, 2);
    assert.ok(v.roll.faces.every(f => f >= 1 && f <= 6));
    assert.equal(v.roll.total, v.roll.faces[0] + v.roll.faces[1]);
    assert.equal(v.roll.result, v.roll.total >= 8 ? "success" : "fail");
    seen[v.roll.result]++;
    const t = atChoice(pack, { seed: s }); t.choose("go");
    assert.equal(t.next().beat.text, v.roll.result === "success" ? "S" : "F");
  }
  assert.ok(seen.fail > 10 && seen.success > 10, JSON.stringify(seen));
});

test("ose: add reads a meter, a field, or a number", () => {
  for (const [add, expect] of [["lamp", 2], [5, 5], ["f", 4]]) {
    const pack = edit(rollPack("ose", "1d20", 10, { fail: {}, success: {} }, add), p => { p.script.scenes[0].choices[0].options[0].effects = [{ set: { f: "4" } }]; });
    const v = rollOnce(pack, 3);
    assert.equal(v.roll.add, expect, String(add));
    assert.equal(v.roll.total, v.roll.faces[0] + expect);
  }
});

test("fate4df: fail, tie, success and style by shifts over vs; faces are -1, 0, 1", () => {
  const results = { fail: {}, tie: {}, success: {}, style: {} };
  const pack = rollPack("fate4df", "4dF", 1, results, "lamp");
  const seen = {};
  for (let s = 1; s <= 600; s++) {
    const v = rollOnce(pack, s);
    assert.equal(v.roll.faces.length, 4);
    assert.ok(v.roll.faces.every(f => [-1, 0, 1].includes(f)));
    const shifts = v.roll.total - 1;
    assert.equal(v.roll.result, shifts < 0 ? "fail" : shifts === 0 ? "tie" : shifts >= 3 ? "style" : "success");
    assert.equal(v.roll.used, v.roll.result);
    seen[v.roll.result] = (seen[v.roll.result] || 0) + 1;
  }
  assert.deepEqual(Object.keys(seen).sort(), ["fail", "style", "success", "tie"]);
});

test("fate4df: a missing tie reads fail; a missing style reads success", () => {
  const pack = rollPack("fate4df", "4dF", 1, { fail: { then: [{ text: "F" }] }, success: { then: [{ text: "S" }] } }, "lamp");
  let ties = 0, styles = 0;
  for (let s = 1; s <= 600; s++) {
    const v = rollOnce(pack, s);
    if (v.roll.result === "tie") { ties++; assert.equal(v.roll.used, "fail"); }
    if (v.roll.result === "style") { styles++; assert.equal(v.roll.used, "success"); }
    assert.ok(["fail", "success"].includes(v.roll.used));
  }
  assert.ok(ties > 0 && styles > 0);
});

test("a roll applies the result's effects and queues its beats; the roll cue comes first", () => {
  const pack = rollPack("ose", "1d20", 11, { fail: { effects: [{ meter: "lamp", add: -1 }], then: [{ text: "F1" }, { text: "F2" }] }, success: { effects: [{ meter: "fate", add: 1 }], then: [{ text: "S1" }] } });
  for (let s = 1; s <= 60; s++) {
    const g = atChoice(pack, { seed: s });
    const v = g.choose("go");
    assert.equal(v.cues[0].type, "seal");
    assert.equal(v.cues[1].type, "roll");
    assert.equal(v.cues[1].dice, "1d20");
    assert.equal(v.cues[1].total, v.roll.total);
    if (v.roll.result === "fail") { assert.deepEqual(v.cues[2], { type: "cost", meter: "lamp", n: 1 }); assert.equal(v.meters.lamp, 1); assert.equal(g.next().beat.text, "F1"); assert.equal(g.next().beat.text, "F2"); }
    else { assert.deepEqual(v.cues[2], { type: "gain", meter: "fate", n: 1 }); assert.equal(g.next().beat.text, "S1"); }
  }
});

test("force steers a roll to a result (used by replay)", () => {
  const pack = rollPack("fate4df", "4dF", 1, { fail: {}, tie: {}, success: {}, style: {} }, "lamp");
  for (const want of ["fail", "tie", "success", "style"]) {
    const g = atChoice(pack, { seed: 5, force: [want] });
    assert.equal(g.choose("go").roll.used, want);
  }
  // A result that the dice cannot give is still honoured.
  const hard = rollPack("ose", "1d6", 99, { fail: {}, success: {} });
  assert.equal(atChoice(hard, { force: ["success"] }).choose("go").roll.used, "success");
});

// ---- cues, one test per row of the cue table ----
test("cue turn: +1 when the scene changes, -1 when back crosses a scene", () => {
  const pack = mini([sc("a", { next: "b", ending: undefined }), sc("b")]);
  const g = Stage.create(pack);
  assert.deepEqual(g.view().cues.filter(c => c.type === "turn"), [], "no turn on the first scene");
  assert.deepEqual(g.next().cues.filter(c => c.type === "turn"), [{ type: "turn", dir: 1 }]);
  assert.deepEqual(g.back().cues.filter(c => c.type === "turn"), [{ type: "turn", dir: -1 }]);
  assert.equal(g.view().scene.id, "a");
});

test("cue shift: a beat that changes the set inside a scene", () => {
  const pack = mini([sc("a", { beats: [{ text: "one" }, { text: "two", set: "t" }, { text: "three", set: "t" }, { text: "four", set: "s" }], ending: "e" })]);
  const g = Stage.create(pack);
  assert.ok(!types(g.view()).includes("shift"));
  const v2 = g.next();
  assert.deepEqual(types(v2).filter(t => t === "shift"), ["shift"]);
  assert.equal(v2.scene.set, "t");
  assert.ok(!types(g.next()).includes("shift"), "same set again: no shift");
  assert.ok(types(g.next()).includes("shift"));
  assert.equal(g.view().scene.set, "s");
  assert.equal(g.back().scene.set, "t");
  assert.ok(types(g.view()).includes("shift"), "back across a set change also shifts");
});

test("cue ink and bloom: on entering a scene and when a beat's effective look changes; a reveal always inks", () => {
  const pack = mini([
    sc("a", { look: "ink", beats: [{ text: "one" }, { text: "two", reveal: true }, { text: "three" }, { text: "four", look: "paint" }, { text: "five", look: "paint" }, { text: "six" }], next: "b", ending: undefined }),
    sc("b", { look: "paint", beats: [{ text: "seven" }] }),
  ]);
  const g = Stage.create(pack);
  assert.deepEqual(types(g.view()), ["ink"], "entering the scene");
  const hidden = g.next();
  assert.equal(hidden.beat.hidden, true);
  assert.deepEqual(types(hidden), [], "a hidden reveal beat is not yet in view");
  assert.deepEqual(types(g.reveal()), ["ink"], "revealing inks");
  assert.deepEqual(types(g.next()), [], "same look as the beat before: no cue (changed from the old rule, which fired on every beat)");
  let v = g.next();
  assert.deepEqual([v.beat.text, v.beat.look, v.scene.look, types(v)], ["four", "paint", "paint", ["bloom"]], "a beat look overrides the scene's for that beat");
  assert.deepEqual(types(g.next()), [], "paint again: no cue");
  v = g.next();
  assert.deepEqual([v.beat.text, v.beat.look, v.scene.look, types(v)], ["six", "ink", "ink", ["ink"]], "back to the scene's look");
  assert.deepEqual(types(g.next()), ["turn", "bloom"], "a new scene");
  assert.deepEqual(types(g.next()), ["turn", "bloom"], "an ending");
});

test("cue ink and bloom: a reveal inks even in a paint scene; a pick's then beats may change the look", () => {
  const pack = mini([sc("a", { look: "paint", beats: [{ text: "one" }, { text: "two", reveal: true }, { text: "three" }], choices: [grp("c", "plan", [opt("x", { then: [{ text: "t1", look: "ink" }, { text: "t2", look: "ink" }, { text: "t3" }] })])] })]);
  const g = Stage.create(pack);
  assert.deepEqual(types(g.view()), ["bloom"]);
  g.next();
  assert.deepEqual(types(g.reveal()), ["ink"]);
  assert.deepEqual(types(g.next()), ["bloom"], "the ink of a reveal holds; the next paint beat blooms again");
  assert.deepEqual(types(g.next()), []);
  const v = g.choose("x");
  assert.deepEqual([v.beat.text, types(v)], ["t1", ["ink"]]);
  assert.deepEqual(types(g.next()), []);
  assert.deepEqual([g.next().beat.text, types(g.view())], ["t3", ["bloom"]], "the beat with no look returns to the scene's");
});

test("cue ink and bloom: a scene with no beats still signals its look when it stops; a first reveal beat waits for its reveal", () => {
  const bare = mini([sc("a", { look: "paint", beats: [], choices: [grp("c", "plan", [opt("x")])] })]);
  assert.deepEqual(types(Stage.create(bare).view()), ["bloom"]);
  const secret = mini([sc("a", { look: "paint", beats: [{ text: "s", reveal: true }, { text: "after" }] })]);
  const g = Stage.create(secret);
  assert.deepEqual(types(g.view()), []);
  assert.deepEqual(types(g.reveal()), ["ink"]);
});

test("cue seal: exec and fate picks, not plan picks", () => {
  const pack = mini([sc("a", { choices: [grp("p", "plan", [opt("x")]), grp("x", "exec", [opt("x")]), grp("f", "fate", [opt("x")], { cost: { meter: "fate", n: 1 } })] })]);
  const g = atChoice(pack);
  assert.ok(!types(g.choose("x")).includes("seal"));
  assert.ok(types(g.choose("x")).includes("seal"));
  assert.deepEqual(types(g.choose("x")).slice(0, 3), ["seal", "tear", "cost"]);
});

test("cue cost and gain carry the meter and the real change; clamped changes report the difference", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [
    opt("down", { effects: [{ meter: "lamp", add: -5 }] }), opt("up", { effects: [{ meter: "lamp", add: 10 }] }),
    opt("none", { effects: [{ meter: "fate", add: 0 }] }), opt("max", { effects: [{ meter: "lamp", add: 1 }] }),
  ])] })]);
  let g = atChoice(pack);
  assert.deepEqual(own(g.choose("down")), [{ type: "cost", meter: "lamp", n: 2 }]);
  assert.equal(g.view().meters.lamp, 0);
  g = atChoice(pack);
  assert.deepEqual(own(g.choose("up")), [{ type: "gain", meter: "lamp", n: 3 }]);
  assert.equal(g.view().meters.lamp, 5);
  g = atChoice(pack);
  assert.deepEqual(g.choose("none").cues.filter(c => c.type === "cost" || c.type === "gain"), []);
});

test("cue tear: only when a Fate point is spent, with the cost", () => {
  const pack = mini([sc("a", { choices: [grp("f", "fate", [opt("x")], { cost: { meter: "fate", n: 1 } })] })]);
  const g = atChoice(pack);
  const v = g.choose("x");
  assert.deepEqual(own(v), [{ type: "seal" }, { type: "tear" }, { type: "cost", meter: "fate", n: 1 }]);
  assert.equal(v.meters.fate, 0);
  // A meter effect of its own does not tear.
  const other = mini([sc("a", { choices: [grp("c", "plan", [opt("x", { effects: [{ meter: "fate", add: -1 }] })])] })]);
  assert.ok(!types(atChoice(other).choose("x")).includes("tear"));
});

test("cue cost and gain are reversed for a meter marked bad", () => {
  const bad = edit(mini([sc("a", { choices: [grp("c", "plan", [
    opt("up", { effects: [{ meter: "lamp", add: 2 }] }), opt("down", { effects: [{ meter: "lamp", add: -1 }] }), opt("fate", { effects: [{ meter: "fate", add: 1 }] }),
  ])] })]), p => { p.meters[1].bad = true; });
  assert.deepEqual(own(atChoice(bad).choose("up")), [{ type: "cost", meter: "lamp", n: 2 }], "a rise is a cost");
  assert.deepEqual(own(atChoice(bad).choose("down")), [{ type: "gain", meter: "lamp", n: 1 }], "a fall is a gain");
  assert.deepEqual(own(atChoice(bad).choose("fate")), [{ type: "gain", meter: "fate", n: 1 }], "a meter not marked bad is unchanged");
  // clamped at the top: the cue reports the real change
  assert.deepEqual(own(atChoice(edit(bad, p => { p.meters[1].start = 5; p.script.scenes[0].choices[0].options[0].effects = [{ meter: "lamp", add: 3 }]; })).choose("up")), []);
  // a bad meter in a roll result
  const rolled = edit(rollPack("ose", "1d6", 1, { fail: {}, success: { effects: [{ meter: "lamp", add: 1 }] } }), p => { p.meters[1].bad = true; });
  assert.deepEqual(rollOnce(rolled, 1).cues.filter(c => c.type === "cost" || c.type === "gain"), [{ type: "cost", meter: "lamp", n: 1 }]);
});

test("cue tally: one per tally effect, with the id and the value", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("x", { effects: [{ tally: "lens", add: "hymn" }, { flag: "f" }, { tally: "lens", add: "machine" }, { tally: "lens", add: "hymn" }] })])] })]);
  const v = atChoice(pack).choose("x");
  assert.deepEqual(v.cues.filter(c => c.type === "tally"), [
    { type: "tally", id: "lens", value: "hymn" }, { type: "tally", id: "lens", value: "machine" }, { type: "tally", id: "lens", value: "hymn" },
  ]);
  assert.deepEqual(v.tallies, { lens: { hymn: 2, machine: 1 } });
  // a roll result may add to a tally too
  const rolled = rollPack("ose", "1d6", 1, { fail: {}, success: { effects: [{ tally: "lens", add: "machine" }] } });
  assert.deepEqual(rollOnce(rolled, 1).cues.filter(c => c.type === "tally"), [{ type: "tally", id: "lens", value: "machine" }]);
});

test("cues keep their type, and come in one fixed order within a step", () => {
  const rank = { seal: 0, tear: 1, roll: 2, cost: 3, gain: 3, tally: 4, turn: 5, shift: 5, ink: 6, bloom: 6, close: 7 };
  const inOrder = v => v.cues.every((c, i) => c.type in rank && (i === 0 || rank[v.cues[i - 1].type] <= rank[c.type]));
  // A fate pick with effects, a roll and a roll result: seal, tear, roll, then the meter changes, then the tally.
  const pack = mini([sc("a", { choices: [grp("c", "fate", [opt("go", {
    effects: [{ tally: "lens", add: "hymn" }, { meter: "lamp", add: 1 }],
    roll: { dice: "1d6", vs: 1, results: { fail: {}, success: { effects: [{ meter: "lamp", add: -1 }] } } },
  })], { cost: { meter: "fate", n: 1 } })] })]);
  const v = atChoice(pack).choose("go");
  assert.deepEqual(types(v), ["seal", "tear", "roll", "cost", "gain", "cost", "tally"]);
  assert.ok(inOrder(v));
  // A pick that leaves the scene: seal, tear, meter changes, tally, turn, then the new scene's look.
  const leave = mini([sc("a", { look: "ink", choices: [grp("c", "fate", [opt("go", { effects: [{ tally: "lens", add: "machine" }, { meter: "lamp", add: -1 }], to: "b" })], { cost: { meter: "fate", n: 1 } })] }), sc("b", { look: "paint" })]);
  const w = atChoice(leave).choose("go");
  assert.deepEqual(types(w), ["seal", "tear", "cost", "cost", "tally", "turn", "bloom"]);
  assert.deepEqual(w.cues.map(c => c.type === "cost" ? c.meter : null).filter(Boolean), ["fate", "lamp"]);
  // A set shift comes before the look, after the tally.
  const shift = mini([sc("a", { choices: [grp("c", "plan", [opt("go", { effects: [{ tally: "lens", add: "hymn" }], then: [{ text: "t", set: "t", look: "paint" }] })])] })]);
  assert.deepEqual(types(atChoice(shift).choose("go")), ["tally", "shift", "bloom"]);
});

test("cue close: when the ending is reached, after its beats", () => {
  const pack = mini([sc("a")]);
  const g = Stage.create(pack);
  const v = g.next(); // into the ending's beat
  assert.equal(v.node, "beat");
  assert.equal(v.scene.ending, true);
  assert.ok(!types(v).includes("close"));
  const end = g.next();
  assert.equal(end.node, "ending");
  assert.ok(types(end).includes("close"));
  assert.equal(end.ending.id, "e");
  assert.deepEqual(end.found, ["e"]);
  assert.deepEqual(types(g.next()), [], "nothing moves after the end");
  const empty = mini([sc("a", { ending: "e2" })]);
  const g2 = Stage.create(empty);
  assert.equal(g2.next().node, "ending", "an ending with no beats goes straight to the end");
});

// ---- conditions ----
test("conditions: flag, field, meter gte/lte, tally top, tally value count, all, any, not", () => {
  const conds = {
    flag: { flag: "x" }, noflag: { not: { flag: "x" } },
    field: { field: "f", is: "yes" }, fieldno: { field: "f", is: "no" },
    gte: { meter: "lamp", gte: 3 }, gte2: { meter: "lamp", gte: 2 }, lte: { meter: "lamp", lte: 2 }, lte1: { meter: "lamp", lte: 1 },
    range: { meter: "lamp", gte: 2, lte: 2 },
    top: { tally: "lens", top: "hymn" }, topno: { tally: "lens", top: "machine" },
    cnt: { tally: "lens", value: "hymn", gte: 2 }, cntno: { tally: "lens", value: "hymn", gte: 3 },
    cntlte: { tally: "lens", value: "machine", lte: 1 }, cntlte0: { tally: "lens", value: "machine", lte: 0 },
    cntrange: { tally: "lens", value: "machine", gte: 1, lte: 1 }, cntnone: { tally: "lens", value: "hymn" },
    all: { all: [{ flag: "x" }, { field: "f", is: "yes" }] }, allno: { all: [{ flag: "x" }, { flag: "nope" }] },
    any: { any: [{ flag: "nope" }, { flag: "x" }] }, anyno: { any: [{ flag: "nope" }, { flag: "nope2" }] },
    nest: { not: { any: [{ flag: "nope" }, { all: [{ flag: "x" }, { meter: "lamp", lte: 1 }] }] } },
  };
  const beats = Object.entries(conds).map(([k, when]) => ({ text: k, when }));
  const pack = mini([
    sc("a", { choices: [grp("c", "plan", [opt("go", { effects: [{ flag: "x" }, { set: { f: "yes" } }, { tally: "lens", add: "hymn" }, { tally: "lens", add: "hymn" }, { tally: "lens", add: "machine" }] })])], next: "b", ending: undefined }),
    sc("b", { beats }),
  ]);
  const shown = texts(pack, ["c.go"]).filter(t => t in conds);
  assert.deepEqual(shown.sort(), ["all", "any", "cnt", "cntlte", "cntrange", "field", "flag", "gte2", "lte", "nest", "range", "top"].sort());
});

test("tally top: leads or ties, and a zero count never leads", () => {
  const mk = adds => mini([
    sc("a", { choices: [grp("c", "plan", [opt("go", { effects: adds.map(add => ({ tally: "lens", add })) })])], next: "b", ending: undefined }),
    sc("b", { beats: [{ text: "H", when: { tally: "lens", top: "hymn" } }, { text: "M", when: { tally: "lens", top: "machine" } }, { text: "Z", when: { tally: "lens", top: "zero" } }] }),
  ]);
  const shown = adds => texts(mk(adds), ["c.go"]).filter(t => ["H", "M", "Z"].includes(t)).join("");
  assert.equal(shown([]), "", "no values yet: nothing leads");
  assert.equal(shown(["hymn"]), "H");
  assert.equal(shown(["hymn", "machine"]), "HM", "a tie leads for both");
  assert.equal(shown(["hymn", "machine", "machine"]), "M");
});

test("a beat whose when is false is skipped; a route takes the first match", () => {
  const route = [{ when: { flag: "x" }, to: "b" }, { when: { flag: "x" }, to: "c" }, { to: "d" }];
  const base = flag => mini([
    sc("a", { choices: [grp("c", "plan", [opt("go", { effects: flag ? [{ flag: "x" }] : [] })])], route, ending: undefined }),
    sc("b"), sc("c"), sc("d"),
  ]);
  assert.equal(texts(base(true), ["c.go"])[1], "beat b");
  assert.equal(texts(base(false), ["c.go"])[1], "beat d");
});

// ---- effects ----
test("effects: flag, set, meter (clamped), tally", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("go", { effects: [
    { flag: "x" }, { set: { f: "one", g: 2 } }, { meter: "lamp", add: 9 }, { meter: "fate", add: -9 }, { tally: "lens", add: "hymn" }, { tally: "lens", add: "hymn" }, { tally: "lens", add: "machine" },
  ] })])] })]);
  const g = atChoice(pack);
  const before = g.view();
  assert.deepEqual(before.flags, {});
  assert.deepEqual(before.fields, { f: "", g: "" });
  assert.deepEqual(before.meters, { fate: 1, lamp: 2 });
  const v = g.choose("go");
  assert.equal(v.flags.x, true);
  assert.deepEqual(v.fields, { f: "one", g: "2" });
  assert.deepEqual(v.meters, { fate: 0, lamp: 5 });
  assert.deepEqual(v.tallies, { lens: { hymn: 2, machine: 1 } });
});

test("a choice group carries notes and comment in view().group and in view().met once it is shown", () => {
  const pack = mini([sc("a", { beats: [{ text: "one" }], choices: [grp("c", "plan", [opt("x")], { notes: ["l", "r"], comment: "d" }), grp("e", "plan", [opt("x")])] })]);
  const g = Stage.create(pack);
  assert.deepEqual(g.view().met, []);
  const v = g.next();
  assert.equal(v.node, "choice");
  assert.deepEqual([v.group.notes, v.group.comment], [["l", "r"], "d"]);
  assert.deepEqual(v.met.sort(), ["d", "l", "r"]);
  const w = g.choose("x");
  assert.deepEqual([w.group.notes, w.group.comment], [[], null], "a group with none has empty notes and no comment");
  assert.deepEqual(w.met.sort(), ["d", "l", "r"]);
  // the notes of a group nobody can pick are not met
  const skipped = mini([sc("a", { choices: [grp("hid", "plan", [opt("x", { when: { flag: "nope" } })], { notes: ["l"], comment: "d" }), grp("last", "plan", [opt("x")])] })]);
  const h = atChoice(skipped);
  assert.equal(h.view().group.key, "last");
  assert.deepEqual(h.view().met, []);
  // a save keeps them
  assert.deepEqual(Stage.create(pack, { save: g.save() }).view().met.sort(), ["d", "l", "r"]);
});

test("options: when hides, lock greys with its hint, a locked pick is refused", () => {
  const pack = mini([sc("a", { choices: [
    grp("set", "plan", [opt("go", { effects: [{ flag: "x" }] })]),
    grp("c", "plan", [
      opt("shown"), opt("hidden", { when: { flag: "nope" } }), opt("open", { when: { flag: "x" } }),
      opt("greyed", { lock: { flag: "nope" }, hint: "Find the key." }), opt("free", { lock: { flag: "x" }, hint: "Unused." }),
    ]),
  ] })]);
  const g = atChoice(pack);
  g.choose("go");
  const v = g.view();
  assert.deepEqual(v.options.map(o => [o.key, o.locked, o.hint]), [["shown", false, null], ["open", false, null], ["greyed", true, "Find the key."], ["free", false, null]]);
  const r = g.choose("greyed");
  assert.ok(r.refused);
  assert.equal(r.node, "choice");
  assert.deepEqual(r.cues, []);
  assert.ok(g.choose("hidden").refused);
  assert.ok(g.choose("nope-at-all").refused);
  assert.ok(!g.choose("free").refused);
});

test("a group nobody can pick, or a Fate group nobody can pay for, is skipped; the game never blocks", () => {
  const pack = mini([sc("a", { choices: [
    grp("hid", "plan", [opt("x", { when: { flag: "nope" } })]),
    grp("lockd", "plan", [opt("x", { lock: { flag: "nope" }, hint: "no" })]),
    grp("pay", "fate", [opt("x")], { cost: { meter: "fate", n: 2 } }),
    grp("last", "plan", [opt("x")]),
  ] })]);
  const g = atChoice(pack);
  assert.equal(g.view().group.key, "last");
  assert.equal(Stage.simulate(pack).locked.join(), "a:lockd.x");
});

test("input stores trimmed, capped text on the card field; empty is allowed", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("go", { input: { field: "f", prompt: "Say.", max: 5 }, then: [{ text: "after" }] })])] })]);
  const g = atChoice(pack);
  const v = g.choose("go");
  assert.equal(v.node, "input");
  assert.deepEqual(v.input, { field: "f", prompt: "Say.", max: 5, option: "go" });
  assert.equal(g.next().node, "input", "next does nothing at an input");
  assert.ok(g.choose("go").refused);
  const after = g.input("  hello   world  ");
  assert.equal(after.fields.f, "hello");
  assert.equal(after.beat.text, "after");
  assert.ok(g.input("x").refused);
  const g2 = atChoice(pack); g2.choose("go");
  assert.equal(g2.input("").fields.f, "");
});

test("reveal: hidden text is withheld; reveal() or next() shows it; notes come with it", () => {
  const pack = mini([sc("a", { beats: [{ text: "secret", reveal: true, notes: ["l"], comment: "d" }, { text: "plain" }] })]);
  const g = Stage.create(pack);
  let v = g.view();
  assert.deepEqual([v.beat.hidden, v.beat.text, v.beat.notes, v.beat.comment, v.met], [true, "", [], null, []]);
  v = g.reveal();
  assert.deepEqual([v.beat.hidden, v.beat.revealed, v.beat.text, v.beat.notes, v.beat.comment], [false, true, "secret", ["l"], "d"]);
  assert.deepEqual(v.met.sort(), ["d", "l"]);
  assert.deepEqual(types(g.reveal()), [], "revealing twice does nothing");
  const g2 = Stage.create(pack);
  assert.equal(g2.next().beat.text, "secret", "next on a hidden beat reveals it");
  assert.equal(g2.next().beat.text, "plain");
});

test("option.to leaves the scene at once, after its then beats", () => {
  const pack = mini([
    sc("a", { choices: [grp("c", "plan", [opt("go", { to: "c", then: [{ text: "then" }] })]), grp("never", "plan", [opt("x")])], next: "b", ending: undefined }),
    sc("b"), sc("c"),
  ]);
  assert.deepEqual(texts(pack, ["c.go"]).slice(0, 4), ["beat a", "then", "beat c", "Done."]);
  const toEnd = edit(pack, p => { p.script.scenes[0].choices[0].options[0].to = "e2"; });
  assert.equal(autoplay(Stage.create(toEnd)).at(-1).ending.id, "e2");
});

test("then beats play after the pick, before the next group", () => {
  const pack = mini([sc("a", { beats: [{ text: "one" }], choices: [grp("c", "plan", [opt("go", { then: [{ text: "t1" }, { text: "t2" }] })]), grp("d", "plan", [opt("x")])] })]);
  const g = atChoice(pack);
  assert.equal(g.choose("go").beat.text, "t1");
  assert.equal(g.next().beat.text, "t2");
  const v = g.next();
  assert.equal(v.node, "choice");
  assert.equal(v.group.key, "d");
});

test("next does nothing at a choice, an input or the end; choose does nothing off a choice", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("x")])] })]);
  const g = Stage.create(pack);
  g.next(); // beat a -> choice? the first beat is "beat a", so this lands on the choice
  assert.equal(g.view().node, "choice");
  assert.equal(g.next().node, "choice");
  const h = Stage.create(pack);
  assert.ok(h.choose("x").refused, "still on a beat");
});

// ---- back and the gate ----
test("back undoes a plan pick (and its effects); an exec or fate pick cannot be undone", () => {
  const pack = mini([sc("a", { beats: [{ text: "one" }, { text: "two" }], choices: [
    grp("p", "plan", [opt("x", { effects: [{ flag: "p" }, { meter: "lamp", add: -1 }] })]),
    grp("e", "exec", [opt("x", { effects: [{ flag: "e" }], then: [{ text: "after e" }, { text: "after e 2" }] })]),
    grp("f", "fate", [opt("x", { effects: [{ flag: "f" }] })], { cost: { meter: "fate", n: 1 } }),
  ] })]);
  const g = Stage.create(pack);
  assert.equal(g.view().canBack, false);
  g.next(); // two
  assert.equal(g.view().canBack, true);
  g.next(); // group p
  g.choose("x"); // plan pick -> group e
  assert.equal(g.view().group.key, "e");
  assert.equal(g.view().flags.p, true);
  let v = g.back();
  assert.equal(v.group.key, "p");
  assert.deepEqual(v.flags, {});
  assert.equal(v.meters.lamp, 2);
  g.choose("x"); // pick p again
  v = g.choose("x"); // exec pick -> "after e"
  assert.equal(v.beat.text, "after e");
  assert.equal(v.canBack, false, "right after an exec pick there is nothing to go back to");
  assert.equal(g.back().beat.text, "after e", "back is refused");
  assert.equal(g.view().flags.e, true);
  g.next();
  assert.equal(g.view().canBack, true, "later beats can be reviewed");
  assert.equal(g.back().beat.text, "after e");
  assert.equal(g.view().flags.e, true, "going back to a beat keeps the pick");
  assert.equal(g.view().canBack, false);
  g.next(); g.next(); // -> group f
  assert.equal(g.view().group.key, "f");
  assert.equal(g.view().canBack, true, "the choice itself can still be left");
  g.choose("x");
  assert.equal(g.view().canBack, false);
  assert.equal(g.view().meters.fate, 0);
  assert.equal(g.back().meters.fate, 0, "the Fate point stays spent");
});

test("back returns the same dice after a plan pick (no rerolling by going back)", () => {
  const pack = mini([sc("a", { choices: [grp("p", "plan", [opt("go", { roll: { dice: "1d20", vs: 11, results: { fail: {}, success: {} } } })])] })]);
  const g = atChoice(pack, { seed: 9 });
  const first = g.choose("go").roll;
  g.back();
  assert.deepEqual(g.choose("go").roll, first);
});

test("back after a reveal keeps it revealed; back is a no-op at the start", () => {
  const pack = mini([sc("a", { beats: [{ text: "one" }, { text: "two", reveal: true }, { text: "three" }] })]);
  const g = Stage.create(pack);
  assert.equal(g.back().beat.text, "one");
  g.next(); g.reveal(); g.next();
  assert.equal(g.back().beat.hidden, false);
});

// ---- save and load ----
test("save and load round trip: same view, same future, history kept", () => {
  const step = g => { const v = g.view(); if (v.node === "choice") return g.choose(v.options.find(o => !o.locked).key); if (v.node === "input") return g.input("Ann"); return g.next(); };
  const a = Stage.create(OSE, { seed: 11 });
  for (let i = 0; i < 14 && a.view().node !== "ending"; i++) step(a);
  const text = a.save();
  assert.equal(typeof text, "string");
  const b = Stage.create(OSE, { seed: 999, save: text });
  assert.deepEqual(b.view(), { ...a.view(), cues: [] });
  assert.equal(b.view().canBack, a.view().canBack);
  const finish = g => { const out = []; while (g.view().node !== "ending") out.push(JSON.stringify(step(g))); return out; };
  assert.deepEqual(finish(b), finish(a));
  assert.equal(a.save(), b.save());
});

test("save keeps notes met and endings found", () => {
  const a = Stage.create(OSE, { seed: 2 });
  const vs = autoplay(a);
  const b = Stage.create(OSE, { save: a.save() });
  assert.deepEqual(b.view().met.sort(), vs.at(-1).met.sort());
  assert.ok(b.view().met.length > 3);
  assert.equal(b.view().found.length, 1);
});

test("a bad or foreign save is ignored and the game starts fresh", () => {
  const fresh = JSON.stringify(Stage.create(OSE, { seed: 4 }).view());
  const good = JSON.parse(Stage.create(OSE, { seed: 4 }).save());
  const tampered = clone(good); tampered.hist[0].cur = "b nowhere:9";
  const wrongPack = { ...good, pack: "other" };
  const wrongVersion = { ...good, v: 99 };
  const noHist = { ...good, hist: [] };
  const oldScene = clone(good); oldScene.hist[0].scene = "deleted";
  for (const bad of [null, "", "not json", "{}", "[]", "123", JSON.stringify(tampered), JSON.stringify(wrongPack), JSON.stringify(wrongVersion), JSON.stringify(noHist), JSON.stringify(oldScene)]) {
    const g = Stage.create(OSE, { seed: 4, save: bad });
    assert.equal(JSON.stringify(g.view()), fresh, String(bad).slice(0, 30));
  }
});

test("save keeps at most a short history, and the floor moves with it", () => {
  const pack = mini([sc("a", { beats: Array.from({ length: 80 }, (_, i) => ({ text: "b" + i })) })]);
  const g = Stage.create(pack);
  for (let i = 0; i < 70; i++) g.next();
  const data = JSON.parse(g.save());
  assert.ok(data.hist.length <= 40);
  const h = Stage.create(pack, { save: g.save() });
  assert.equal(h.view().beat.text, "b70");
  assert.equal(h.view().canBack, true);
  assert.equal(h.back().beat.text, "b69");
});

// ---- validate ----
test("the fixtures validate", () => {
  assert.deepEqual(Stage.validate(OSE), []);
  assert.deepEqual(Stage.validate(FEED), []);
  assert.deepEqual(Stage.validate(mini([sc("a")])), []);
});

test("validate names each kind of error", () => {
  const cases = [
    ["bad id", p => { p.id = "Not Kebab"; }, /id must be lower-kebab-case/],
    ["bad kit", p => { p.kit = "vr"; }, /kit must be/],
    ["bad resolver", p => { p.resolver = "d20"; }, /resolver must be/],
    ["bad storage key", p => { p.storageKey = "other.x"; }, /storageKey must start/],
    ["meter range", p => { p.meters[0].start = 9; }, /start must be/],
    ["start scene", p => { p.start = "zzz"; }, /start "zzz" is not a scene/],
    ["dup scene", p => { p.script.scenes.push(clone(p.script.scenes[0])); }, /duplicate id/],
    ["no exit", p => { delete p.script.scenes[0].ending; }, /exactly one of next, ending, route/],
    ["two exits", p => { p.script.scenes[0].next = "a"; }, /exactly one of next, ending, route/],
    ["next target", p => { delete p.script.scenes[0].ending; p.script.scenes[0].next = "zzz"; }, /next "zzz" is not a scene/],
    ["ending target", p => { p.script.scenes[0].ending = "zzz"; }, /ending "zzz" is not an ending/],
    ["route last when", p => { delete p.script.scenes[0].ending; p.script.scenes[0].route = [{ when: { flag: "x" }, to: "a" }]; }, /last route entry must have no when/],
    ["route middle no when", p => { delete p.script.scenes[0].ending; p.script.scenes[0].route = [{ to: "a" }, { to: "a" }]; }, /only the last route entry may omit when/],
    ["route target", p => { delete p.script.scenes[0].ending; p.script.scenes[0].route = [{ to: "zzz" }]; }, /not a scene or ending/],
    ["scene look", p => { p.script.scenes[0].look = "neon"; }, /look must be/],
    ["scene set", p => { p.script.scenes[0].set = "nope"; }, /set "nope" is not in sets.json/],
    ["beat set", p => { p.script.scenes[0].beats[0].set = "nope"; }, /set "nope"/],
    ["speaker, with a cast.json", p => { p.cast = { people: { wick: { name: "Wick" } } }; p.script.scenes[0].beats[0].speaker = "nobody"; }, /speaker "nobody" is not in cast.json/],
    ["note ref", p => { p.script.scenes[0].beats[0].notes = ["zzz"]; }, /note "zzz"/],
    ["comment ref", p => { p.script.scenes[0].beats[0].comment = "zzz"; }, /comment "zzz"/],
    ["comment kind", p => { p.script.scenes[0].beats[0].comment = "l"; }, /comment "l" is a lore note/],
    ["unbalanced star", p => { p.script.scenes[0].beats[0].text = "a *b"; }, /unbalanced \*/],
    ["empty text", p => { p.script.scenes[0].beats[0].text = ""; }, /text is missing/],
    ["screen empty", p => { p.script.scenes[0].beats[0].screen = []; }, /screen must be an array of strings/],
    ["screen string", p => { p.script.scenes[0].beats[0].screen = "WARD 3"; }, /screen must be an array of strings/],
    ["screen element", p => { p.script.scenes[0].beats[0].screen = ["ok", 7]; }, /screen must be an array of strings/],
    ["beat look", p => { p.script.scenes[0].beats[0].look = "glow"; }, /look must be "ink" or "paint"/],
    ["bad cond", p => { p.script.scenes[0].beats[0].when = { flag: "x", meter: "lamp" }; }, /exactly one of flag, field/],
    ["cond meter", p => { p.script.scenes[0].beats[0].when = { meter: "zzz", gte: 1 }; }, /meter "zzz"/],
    ["cond meter bound", p => { p.script.scenes[0].beats[0].when = { meter: "lamp" }; }, /gte or lte/],
    ["cond tally", p => { p.script.scenes[0].beats[0].when = { tally: "zzz", top: "a" }; }, /tally "zzz"/],
    ["cond field", p => { p.script.scenes[0].beats[0].when = { field: "zzz", is: "a" }; }, /field "zzz"/],
    ["cond field is", p => { p.script.scenes[0].beats[0].when = { field: "f" }; }, /needs "is"/],
    ["cond all empty", p => { p.script.scenes[0].beats[0].when = { all: [] }; }, /non-empty list/],
    ["bad gate", p => { p.script.scenes[0].choices[0].gate = "maybe"; }, /gate must be/],
    ["cost not fate", p => { p.script.scenes[0].choices[0].cost = { meter: "fate", n: 1 }; }, /cost is only for gate fate/],
    ["cost meter", p => { p.script.scenes[0].choices[1].cost = { meter: "zzz", n: 1 }; }, /cost needs a meter/],
    ["dup option", p => { p.script.scenes[0].choices[0].options.push({ key: "x", label: "again" }); }, /duplicate key/],
    ["dup group", p => { p.script.scenes[0].choices.push(clone(p.script.scenes[0].choices[0])); }, /duplicate key/],
    ["when and lock", p => { Object.assign(p.script.scenes[0].choices[0].options[0], { when: { flag: "a" }, lock: { flag: "b" }, hint: "h" }); }, /when or lock, not both/],
    ["lock no hint", p => { p.script.scenes[0].choices[0].options[0].lock = { flag: "b" }; }, /needs a hint/],
    ["hint no lock", p => { p.script.scenes[0].choices[0].options[0].hint = "h"; }, /hint is only for/],
    ["option to", p => { p.script.scenes[0].choices[0].options[0].to = "zzz"; }, /to "zzz"/],
    ["effect shape", p => { p.script.scenes[0].choices[0].options[0].effects = [{ flag: "a", meter: "lamp", add: 1 }]; }, /exactly one of flag, set, meter, tally/],
    ["effect meter", p => { p.script.scenes[0].choices[0].options[0].effects = [{ meter: "zzz", add: 1 }]; }, /meter "zzz"/],
    ["effect add", p => { p.script.scenes[0].choices[0].options[0].effects = [{ meter: "lamp", add: "1" }]; }, /numeric add/],
    ["effect tally", p => { p.script.scenes[0].choices[0].options[0].effects = [{ tally: "zzz", add: "a" }]; }, /tally "zzz"/],
    ["effect set field", p => { p.script.scenes[0].choices[0].options[0].effects = [{ set: { zzz: "a" } }]; }, /"zzz" is not in pack.fields/],
    ["input field", p => { p.script.scenes[0].choices[0].options[0].input = { field: "zzz", prompt: "p" }; }, /input.field "zzz"/],
    ["input prompt", p => { p.script.scenes[0].choices[0].options[0].input = { field: "f" }; }, /input.prompt/],
    ["roll dice", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "banana", vs: 1, results: { fail: {}, success: {} } }; }, /roll.dice must look like/],
    ["roll dF in ose", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "4dF", vs: 1, results: { fail: {}, success: {} } }; }, /dN, not dF/],
    ["roll missing fail", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "2d6", vs: 1, results: { success: {} } }; }, /needs "fail"/],
    ["roll tie in ose", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "2d6", vs: 1, results: { fail: {}, success: {}, tie: {} } }; }, /"tie" is not read by ose/],
    ["roll add", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "2d6", vs: 1, add: "zzz", results: { fail: {}, success: {} } }; }, /roll.add "zzz"/],
    ["roll add number", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "2d6", vs: 1, add: 3, results: { fail: {}, success: {} } }; }, /add names a meter only/],
    ["roll add field", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "2d6", vs: 1, add: "f", results: { fail: {}, success: {} } }; }, /add names a meter only/],
    ["roll vs", p => { p.script.scenes[0].choices[0].options[0].roll = { dice: "2d6", results: { fail: {}, success: {} } }; }, /roll.vs/],
    ["note too long", p => { p.notes.r.text = Array(61).fill("word").join(" "); }, /61 words/],
    ["note kind", p => { p.notes.r.kind = "poem"; }, /kind must be one of/],
    ["commentary kinds", p => { p.commentary.kinds = ["poem"]; }, /commentary.kinds/],
    ["tallies as a list", p => { p.tallies = ["lens"]; }, /tallies must be a map/],
    ["tallies value list", p => { p.tallies = { lens: "hymn" }; }, /non-empty list of distinct value names/],
    ["tallies empty list", p => { p.tallies = { lens: [] }; }, /non-empty list of distinct value names/],
    ["tallies duplicate", p => { p.tallies = { lens: ["a", "a"] }; }, /distinct value names/],
    ["effect tally value", p => { p.script.scenes[0].choices[0].options[0].effects = [{ tally: "lens", add: "zzz" }]; }, /tally "lens" has no value "zzz"/],
    ["cond tally top value", p => { p.script.scenes[0].beats[0].when = { tally: "lens", top: "zzz" }; }, /tally "lens" has no value "zzz"/],
    ["cond tally count value", p => { p.script.scenes[0].beats[0].when = { tally: "lens", value: "zzz", gte: 1 }; }, /tally "lens" has no value "zzz"/],
    ["cond tally count bound", p => { p.script.scenes[0].beats[0].when = { tally: "lens", value: "hymn" }; }, /needs gte or lte/],
    ["cond tally top and value", p => { p.script.scenes[0].beats[0].when = { tally: "lens", top: "hymn", value: "hymn", gte: 1 }; }, /either \{ tally, top \} or/],
    ["cond tally neither", p => { p.script.scenes[0].beats[0].when = { tally: "lens" }; }, /either \{ tally, top \} or/],
    ["layer tally value", p => { p.sets.s.layers[0].tally = "lens"; }, /needs a value from hymn, machine/],
    ["layer tally id", p => { p.sets.s.layers[0].tally = "zzz"; p.sets.s.layers[0].value = "hymn"; }, /tally "zzz" is not in pack.tallies/],
    ["field side", p => { p.fields[0].side = "top"; }, /side must be "front" or "back"/],
    ["bad meter flag", p => { p.meters[0].bad = "yes"; }, /bad must be true or false/],
    ["cost from a bad meter", p => { p.meters[0].bad = true; }, /is a bad meter/],
    ["group note ref", p => { p.script.scenes[0].choices[0].notes = ["zzz"]; }, /note "zzz"/],
    ["group notes shape", p => { p.script.scenes[0].choices[0].notes = "r"; }, /notes must be a list/],
    ["group comment ref", p => { p.script.scenes[0].choices[0].comment = "zzz"; }, /comment "zzz"/],
    ["group comment kind", p => { p.script.scenes[0].choices[0].comment = "l"; }, /comment "l" is a lore note/],
    ["group comment, no commentary", p => { delete p.commentary; p.script.scenes[0].choices[0].comment = "d"; }, /pack.commentary is missing/],
    ["cond reads an input field (beat)", p => { p.script.scenes[0].choices[0].options[0].input = { field: "f", prompt: "p" }; p.script.scenes[0].beats[0].when = { field: "f", is: "x" }; }, /reads field "f", which an input writes/],
    ["cond reads an input field (lock)", p => { p.script.scenes[0].choices[0].options[0].input = { field: "f", prompt: "p" }; p.script.scenes[0].choices[1].options[0].lock = { field: "f", is: "x" }; p.script.scenes[0].choices[1].options[0].hint = "h"; }, /reads field "f", which an input writes/],
    ["cond reads an input field (route)", p => { p.script.scenes[0].choices[0].options[0].input = { field: "f", prompt: "p" }; delete p.script.scenes[0].ending; p.script.scenes[0].route = [{ when: { field: "f", is: "x" }, to: "a" }, { to: "a" }]; }, /reads field "f", which an input writes/],
    ["cast person half a crop", p => { p.cast = { people: { w: { name: "W", x: 1, y: 2 } } }; }, /x, y and r go together/],
    ["cast crop without a sheet", p => { p.cast = { people: { w: { name: "W", x: 1, y: 2, r: 3 } } }; }, /sheet is missing/],
    ["cast person without a name", p => { p.cast = { people: { w: {} } }; }, /needs a name/],
    ["set kit", p => { p.sets.s.kit = "feed"; }, /does not match the pack's kit/],
    ["set prim", p => { p.sets.s.layers[0].prim = "redact"; }, /not a paper primitive/],
    ["set layers", p => { p.sets.s.layers = []; }, /non-empty list/],
    ["layer fraction", p => { p.sets.s.layers[0].x = 7; }, /fraction/],
    ["ending look", p => { p.script.endings.e.look = "glow"; }, /look must be/],
    ["no endings", p => { p.script.endings = {}; }, /at least one ending/],
  ];
  for (const [name, fn, re] of cases) {
    const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("x")]), grp("d", "fate", [opt("y")], { cost: { meter: "fate", n: 1 } })] })]);
    fn(pack);
    const errs = Stage.validate(pack);
    assert.ok(errs.some(e => re.test(e)), `${name}: expected ${re}, got ${JSON.stringify(errs)}`);
  }
});

test("validate: the first exec group needs a rule note in its own notes", () => {
  const pack = mini([sc("a", { choices: [grp("c", "exec", [opt("x")])] })]);
  assert.ok(Stage.validate(pack).some(e => /first exec group/.test(e)));
  pack.script.scenes[0].choices[0].notes = ["r"];
  assert.deepEqual(Stage.validate(pack), []);
  // A rule note on a beat of the scene no longer counts; neither does a rule comment on the group.
  const onBeat = mini([sc("a", { beats: [{ text: "t", notes: ["r"], comment: "r" }], choices: [grp("c", "exec", [opt("x")])] })]);
  onBeat.commentary.kinds = ["rule"];
  assert.ok(Stage.validate(onBeat).some(e => /first exec group/.test(e)));
  const asComment = mini([sc("a", { choices: [grp("c", "exec", [opt("x")], { comment: "r" })] })]);
  asComment.commentary.kinds = ["rule"];
  assert.ok(Stage.validate(asComment).some(e => /first exec group/.test(e)));
  const wrongKind = mini([sc("a", { choices: [grp("c", "exec", [opt("x")], { notes: ["d"] })] })]);
  assert.ok(Stage.validate(wrongKind).some(e => /first exec group/.test(e)));
  // Only the first exec group is checked, in scene order; plan and fate groups before it do not count.
  const later = mini([sc("a", { choices: [grp("p", "plan", [opt("x")]), grp("c", "exec", [opt("x")], { notes: ["r"] })], next: "b", ending: undefined }), sc("b", { choices: [grp("c", "exec", [opt("x")])] })]);
  assert.deepEqual(Stage.validate(later), []);
  const second = mini([sc("a", { choices: [grp("c", "exec", [opt("x")])], next: "b", ending: undefined }), sc("b", { choices: [grp("c", "exec", [opt("x")], { notes: ["r"] })] })]);
  assert.equal(Stage.validate(second).filter(e => /first exec group/.test(e)).length, 1, "the rule note on the second group does not help the first");
});

test("validate: a speaker missing from cast.json is a warning without a cast.json and an error with one", () => {
  const pack = mini([sc("a", { beats: [{ text: "x", speaker: "nobody" }, { text: "y", speaker: "nobody" }, { text: "z", speaker: "other" }] })]);
  const warnings = [];
  assert.deepEqual(Stage.validate(pack, warnings), []);
  assert.deepEqual(Stage.check(pack).errors, []);
  assert.equal(warnings.length, 2, "one warning per missing speaker");
  assert.match(warnings[0], /speaker "nobody" .*2 beats/);
  pack.cast = { people: { wick: { name: "Wick" } } };
  const errs = Stage.validate(pack);
  assert.equal(errs.length, 3);
  assert.ok(errs.every(e => /is not in cast.json/.test(e)));
  assert.deepEqual(Stage.check(pack).warnings, []);
  pack.script.scenes[0].beats = [{ text: "x", speaker: "wick" }];
  assert.deepEqual(Stage.validate(pack), []);
});

test("validate: a cast person with no x, y and r is valid, and the sheet may be left out when nobody has a crop", () => {
  const pack = mini([sc("a", { beats: [{ text: "x", speaker: "chen" }] })]);
  pack.cast = { people: { chen: { name: "Manager Chen", role: "Handler" } } };
  assert.deepEqual(Stage.validate(pack), []);
  pack.cast.people.wick = { name: "Wick", x: 100, y: 100, r: 70 };
  assert.ok(Stage.validate(pack).some(e => /sheet is missing/.test(e)));
  assert.ok(Stage.validate(pack).some(e => /w and h must be numbers/.test(e)));
  Object.assign(pack.cast, { sheet: "art/cast.svg", w: 400, h: 200 });
  assert.deepEqual(Stage.validate(pack), []);
});

test("validate: pack.tallies is a map of id to allowed values, and layers bind by tally and value", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("x", { effects: [{ tally: "lens", add: "hymn" }] })])] })]);
  pack.script.scenes[0].beats[0].when = { tally: "lens", value: "machine", gte: 0 };
  pack.sets.s.layers.push({ prim: "pulltab", art: "art/x.svg", tally: "lens", value: "machine" });
  assert.deepEqual(Stage.validate(pack), []);
  assert.ok(Stage.validate(edit(pack, p => { p.tallies = ["lens"]; })).some(e => /tallies must be a map/.test(e)));
  assert.ok(Stage.validate(edit(pack, p => { p.tallies = { lens: ["hymn"] }; })).some(e => /no value "machine"/.test(e)));
  assert.ok(Stage.validate(edit(pack, p => { delete p.tallies; })).some(e => /tally "lens" is not in pack.tallies/.test(e)));
});

test("validate does not throw on junk", () => {
  for (const junk of [null, undefined, 5, "x", [], {}, { script: 5 }, { script: { scenes: [null, 3, {}] } }, { id: "a", script: { scenes: [{ id: "a", beats: [null], choices: [null, { key: "k", options: [null] }] }] } }]) {
    const errs = Stage.validate(junk);
    assert.ok(Array.isArray(errs) && errs.length > 0);
  }
});

// ---- simulate ----
test("simulate: 20 independent three-way choices finish at once, with 3^20 paths", () => {
  const groups = Array.from({ length: 20 }, (_, i) => grp("g" + i, i % 3 === 0 ? "exec" : "plan", [opt("a", { effects: [{ flag: "w" + i }] }), opt("b", { effects: [{ flag: "w" + i }] }), opt("c", { effects: [{ meter: "lamp", add: -1 }, { tally: "lens", add: "hymn" }] })]));
  groups[0].notes = ["r"];
  const pack = mini([sc("a", { beats: [{ text: "go" }], choices: groups })]);
  assert.deepEqual(Stage.validate(pack), []);
  const t0 = performance.now();
  const sim = Stage.simulate(pack);
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `took ${ms} ms`);
  assert.equal(sim.paths, 3 ** 20);
  assert.equal(sim.endings.e, 3 ** 20);
  assert.equal(sim.endings.e2, 0);
  assert.equal(sim.routes.length, 1, "nothing reads state, so there is one end state");
  assert.equal(sim.routes[0].steps.length, 20);
  assert.ok(sim.routes[0].steps.every(x => Object.keys(x).join() === "opt"));
  assert.deepEqual(sim.unreachable.filter(u => !u.startsWith("note:")), ["ending:e2"]);
});

test("simulate: only state that conditions read splits paths", () => {
  // Flag x is written by 2 of 3 options and read once: the end states are x or not x.
  const groups = Array.from({ length: 6 }, (_, i) => grp("g" + i, "plan", [opt("a"), opt("b", { effects: i === 0 ? [{ flag: "x" }] : [] }), opt("c")]));
  const pack = mini([sc("a", { choices: groups, route: [{ when: { flag: "x" }, to: "b" }, { to: "c" }], ending: undefined }), sc("b", { ending: "e" }), sc("c", { ending: "e2" })]);
  const sim = Stage.simulate(pack);
  assert.equal(sim.paths, 3 ** 6);
  assert.equal(sim.endings.e, 3 ** 5);
  assert.equal(sim.endings.e2, 2 * 3 ** 5);
  assert.equal(sim.routes.length, 2);
  assert.deepEqual(sim.routes.map(r => r.ending).sort(), ["e", "e2"]);
  assert.deepEqual(sim.routes.find(r => r.ending === "e").steps[0], { opt: "g0.b" });
  assert.ok(sim.states < 80, `states: ${sim.states}`);
});

test("simulate: rolls branch on each result, inputs are filled, locked options are listed, unreachable is exact", () => {
  const pack = mini([
    sc("a", { choices: [grp("c", "exec", [
      opt("go", { roll: { dice: "2d6", vs: 7, results: { fail: { effects: [{ flag: "bad" }] }, success: { then: [{ text: "S", when: { flag: "never" } }] } } } }),
      opt("say", { input: { field: "f", prompt: "p" }, effects: [{ flag: "said" }] }),
      opt("locked", { lock: { flag: "never" }, hint: "h" }),
    ])], route: [{ when: { flag: "bad" }, to: "b" }, { when: { field: "f", is: "(typed)" }, to: "b" }, { to: "c" }], ending: undefined }),
    sc("b", { ending: "e2" }), sc("c", { ending: "e" }), sc("dead", { ending: "e" }),
  ]);
  const sim = Stage.simulate(pack);
  assert.equal(sim.paths, 3); // go+fail, go+success, say
  assert.deepEqual(sim.endings, { e: 1, e2: 2 });
  assert.deepEqual(sim.locked, ["a:c.locked"]);
  assert.deepEqual(sim.unreachable.slice().sort(), ["a:c.go:roll.success:0", "a:c.locked", "dead", "dead:0", "note:d", "note:l", "note:r"].sort());
  const key = steps => JSON.stringify(steps);
  assert.deepEqual(sim.routes.map(r => key(r.steps)).sort(), [
    key([{ opt: "c.go", result: "fail" }]), key([{ opt: "c.go", result: "success" }]), key([{ opt: "c.say" }, { input: "(typed)" }]),
  ].sort());
  assert.ok(sim.routes.every(r => Object.keys(r).sort().join() === "count,ending,steps"), "a route is { ending, count, steps }");
});

test("simulate: a loop is followed once and reported, not walked forever", () => {
  const pack = mini([sc("a", { choices: [grp("c", "plan", [opt("again", { to: "a" }), opt("leave")])] })]);
  const sim = Stage.simulate(pack);
  assert.equal(sim.paths, 1);
  assert.ok(sim.cycles >= 1);
  const g = atChoice(pack);
  g.choose("again");
  assert.equal(g.view().scene.id, "a", "the loop itself plays");
});

test("simulate: the other resolver gives tie and style branches only when the pack has them", () => {
  const mk = results => rollPack("fate4df", "4dF", 1, results, "lamp");
  assert.equal(Stage.simulate(mk({ fail: {}, success: {} })).paths, 2);
  assert.equal(Stage.simulate(mk({ fail: {}, tie: {}, success: {} })).paths, 3);
  assert.equal(Stage.simulate(mk({ fail: {}, tie: {}, success: {}, style: {} })).paths, 4);
  assert.equal(Stage.simulate(rollPack("ose", "2d6", 7, { fail: {}, success: {} })).paths, 2);
});

test("simulate: a meter read by a cost splits states; a meter nobody reads does not", () => {
  const groups = [grp("a", "plan", [opt("x", { effects: [{ meter: "fate", add: -1 }] }), opt("y")]), grp("b", "fate", [opt("z")], { cost: { meter: "fate", n: 1 } }), grp("c", "plan", [opt("w", { effects: [{ meter: "lamp", add: -1 }] }), opt("v")])];
  const sim = Stage.simulate(mini([sc("a", { choices: groups })]));
  // x spends the only Fate point, so group b is skipped. y keeps it, so b is asked. Then 2 options at c each way: 2 + 2.
  assert.equal(sim.paths, 4);
  // Fate ends at 0 on every path and Lamp is never read, so the four paths share one end state.
  assert.equal(sim.routes.length, 1);
  assert.equal(sim.routes[0].count, 4);
});

test("simulate: group notes and comments count as reached notes", () => {
  const pack = mini([sc("a", { choices: [
    grp("shown", "plan", [opt("x")], { notes: ["l"] }),
    grp("shown2", "plan", [opt("x")], { comment: "d" }),
    grp("hid", "plan", [opt("x", { when: { flag: "nope" } })], { notes: ["r"] }),
  ] })]);
  const sim = Stage.simulate(pack);
  assert.deepEqual(sim.unreachable.filter(u => u.startsWith("note:")), ["note:r"]);
});

test("simulate: only roll tiers the dice can reach from the current modifier are branches", () => {
  const all = { fail: {}, tie: {}, success: {}, style: {} };
  const withBeats = results => Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { ...v, then: [{ text: k }] }]));
  const at = (add, dice = "4dF", vs = 2, results = all, resolver = "fate4df") => edit(rollPack(resolver, dice, vs, withBeats(results), "lamp"), p => { p.meters[1].start = add; });
  const tiers = pack => Stage.simulate(pack).unreachable.filter(u => u.includes(":roll.")).map(u => u.split(":roll.")[1].split(":")[0]).sort();
  // 4dF + 0 against 2: totals -4..4, so fail, tie (2), success (3, 4); style needs 5.
  assert.equal(Stage.simulate(at(0)).paths, 3);
  assert.deepEqual(tiers(at(0)), ["style"]);
  assert.equal(Stage.simulate(at(1)).paths, 4, "4dF + 1 against 2 reaches style");
  assert.deepEqual(tiers(at(1)), []);
  assert.equal(Stage.simulate(at(-3)).paths, 1, "4dF - 3 against 2 can only fail");
  assert.deepEqual(tiers(at(-3)), ["style", "success", "tie"]);
  assert.equal(Stage.simulate(at(2, "1d6", 99, { fail: {}, success: {} }, "ose")).paths, 1, "1d6 + 2 against 99 can only fail");
  assert.equal(Stage.simulate(at(2, "1d6", 5, { fail: {}, success: {} }, "ose")).paths, 2);
  assert.equal(Stage.simulate(at(0, "1d6", 1, { fail: {}, success: {} }, "ose")).paths, 1, "1d6 against 1 can only succeed");
  assert.deepEqual(tiers(at(0, "1d6", 1, { fail: {}, success: {} }, "ose")), ["fail"]);
  // a missing tie or style table falls back, so the fallback tier is the branch
  assert.equal(Stage.simulate(at(0, "4dF", 2, { fail: {}, success: {} })).paths, 2, "tie reads fail, so fail and success");
  assert.equal(Stage.simulate(at(1, "4dF", 2, { fail: {}, success: {} })).paths, 2, "style reads success");
  // 3d6 reaches 3..18
  assert.equal(Stage.simulate(at(0, "3d6", 19, { fail: {}, success: {} }, "ose")).paths, 1);
  assert.equal(Stage.simulate(at(0, "3d6", 18, { fail: {}, success: {} }, "ose")).paths, 2);
});

test("simulate: a meter read by a roll's add splits states, so each modifier gets its own tiers", () => {
  const pack = mini([sc("a", { choices: [
    grp("m", "plan", [opt("low", { effects: [{ meter: "lamp", add: -2 }] }), opt("high")]),
    grp("r", "exec", [opt("go", { roll: { dice: "4dF", vs: 2, add: "lamp", results: { fail: {}, tie: {}, success: {}, style: {} } } })]),
  ] })], { resolver: "fate4df" });
  const sim = Stage.simulate(pack);
  // lamp 0: fail, tie, success. lamp 2: all four. Nothing else reads lamp, so only the add keeps the two states apart.
  assert.equal(sim.paths, 3 + 4);
  assert.deepEqual(sim.routes.map(r => r.count).sort(), [3, 4]);
});

test("simulate: a group's cost is read too, so affording the Fate point splits states", () => {
  const pack = mini([sc("a", { choices: [
    grp("m", "plan", [opt("spend", { effects: [{ meter: "fate", add: -1 }] }), opt("keep")]),
    grp("f", "fate", [opt("z")], { cost: { meter: "fate", n: 1 } }),
  ] })]);
  const sim = Stage.simulate(pack);
  assert.equal(sim.paths, 2);
  assert.ok(sim.unreachable.some(u => u === "a:f.z") === false, "keep reaches the Fate group");
});

test("simulate: a route step is { opt }, { opt, result } for a pick that rolls, or { input }", () => {
  const pack = mini([
    sc("a", { choices: [
      grp("first", "plan", [opt("say", { input: { field: "f", prompt: "p" }, then: [{ text: "after" }] })]),
      grp("second", "exec", [
        opt("roll", { roll: { dice: "2d6", vs: 7, results: { fail: { effects: [{ flag: "x" }] }, success: { effects: [{ flag: "y" }] } } } }),
        opt("plain", { effects: [{ flag: "z" }] }),
      ]),
    ], route: [{ when: { flag: "x" }, to: "b" }, { when: { flag: "y" }, to: "c" }, { to: "d" }], ending: undefined }),
    sc("b", { ending: "e2" }), sc("c"), sc("d"),
  ]);
  const sim = Stage.simulate(pack);
  const all = sim.routes.map(r => r.steps);
  assert.equal(all.length, 3);
  assert.deepEqual(all.find(s => s[2].result === "fail"), [{ opt: "first.say" }, { input: "(typed)" }, { opt: "second.roll", result: "fail" }]);
  assert.deepEqual(all.find(s => s[2].result === "success"), [{ opt: "first.say" }, { input: "(typed)" }, { opt: "second.roll", result: "success" }]);
  assert.deepEqual(all.find(s => !s[2].result), [{ opt: "first.say" }, { input: "(typed)" }, { opt: "second.plain" }]);
  for (const steps of all) for (const x of steps) assert.ok(typeof x === "object" && (x.opt || x.input), "no string steps");
  // every one replays to its ending, with the roll forced to its tier and the typed text on the card
  for (const r of sim.routes) {
    const v = Stage.replay(pack, r, { seed: 5 }).view();
    assert.equal(v.node, "ending");
    assert.equal(v.ending.id, r.ending);
    assert.equal(v.fields.f, "(typed)");
  }
});

test("replay: a step's result forces the roll tier; typed text comes from the input step", () => {
  const pack = mini([sc("a", { choices: [
    grp("p", "plan", [opt("say", { input: { field: "f", prompt: "p" } })]),
    grp("c", "exec", [opt("go", { roll: { dice: "2d6", vs: 7, results: { fail: { effects: [{ flag: "bad" }] }, success: { effects: [{ flag: "good" }] } } } })]),
  ] })]);
  for (const result of ["fail", "success"]) for (const seed of [1, 2, 3, 4, 5]) {
    const g = Stage.replay(pack, [{ opt: "p.say" }, { input: "Ann" }, { opt: "c.go", result }], { seed });
    const v = g.view();
    assert.equal(v.fields.f, "Ann");
    assert.equal(!!v.flags.good, result === "success");
    assert.equal(!!v.flags.bad, result === "fail");
  }
  // upTo counts picks, and does not consume the later steps
  const g = Stage.replay(pack, [{ opt: "p.say" }, { input: "Ann" }, { opt: "c.go", result: "fail" }], { upTo: 1 });
  assert.equal(g.view().group.key, "c");
  assert.equal(g.view().fields.f, "Ann");
});

test("force draws the faces inside the asked-for tier, deterministically, for every tier and seed", () => {
  const pack = rollPack("fate4df", "4dF", 2, { fail: {}, tie: {}, success: {}, style: {} }, "lamp");
  const p0 = edit(pack, p => { p.meters[1].start = 0; }); // 4dF + 0 against 2: style cannot be reached
  for (const [p, tiers] of [[pack, ["fail", "tie", "success", "style"]], [p0, ["fail", "tie", "success"]]]) {
    for (const want of tiers) for (let seed = 1; seed <= 40; seed++) {
      const v = atChoice(p, { seed, force: [want] }).choose("go");
      assert.equal(v.roll.used, want, `${want} seed ${seed}`);
      assert.equal(v.roll.faces.length, 4);
      assert.ok(v.roll.faces.every(f => [-1, 0, 1].includes(f)), JSON.stringify(v.roll.faces));
      assert.equal(v.roll.total, v.roll.faces.reduce((a, b) => a + b, 0) + v.roll.add);
      assert.equal(v.roll.result, want, "no fallback needed here");
      assert.deepEqual(atChoice(p, { seed, force: [want] }).choose("go").roll, v.roll, "seeded");
    }
  }
  // a tier the dice cannot give is still honoured with faked faces
  assert.equal(atChoice(p0, { force: ["style"] }).choose("go").roll.used, "style");
  // forces are used in order, one per roll
  const two = mini([sc("a", { choices: [grp("c", "plan", [opt("go", { roll: { dice: "1d20", vs: 11, results: { fail: {}, success: {} } } })]), grp("d", "plan", [opt("go", { roll: { dice: "1d20", vs: 11, results: { fail: {}, success: {} } } })])] })]);
  const g = atChoice(two, { force: ["fail", "success"] });
  assert.equal(g.choose("go").roll.used, "fail");
  g.next();
  assert.equal(g.choose("go").roll.used, "success");
});

// ---- replay, brute force, fixtures ----
function bruteCount(pack) {
  const counts = {};
  const resultKeys = (resolver, spec) => (resolver === "fate4df" ? ["fail", ...(spec.results.tie ? ["tie"] : []), "success", ...(spec.results.style ? ["style"] : [])] : ["fail", "success"]);
  const optSpec = (v, key) => pack.script.scenes.find(s => s.id === v.scene.id).choices.find(c => c.key === v.group.key).options.find(o => o.key === key);
  (function rec(save) {
    const g = Stage.create(pack, { save });
    for (let i = 0; i < 500; i++) {
      const v = g.view();
      if (v.node === "ending") { counts[v.ending.id] = (counts[v.ending.id] || 0) + 1; return; }
      if (v.node === "choice") {
        for (const o of v.options.filter(o => !o.locked)) {
          const spec = optSpec(v, o.key);
          for (const force of spec.roll ? resultKeys(pack.resolver, spec.roll) : [null]) {
            const h = Stage.create(pack, { save: g.save(), force: force ? [force] : [] });
            assert.ok(!h.choose(o.key).refused);
            rec(h.save());
          }
        }
        return;
      }
      if (v.node === "input") g.input("(typed)"); else g.next();
    }
    throw new Error("brute force did not finish");
  })(Stage.create(pack).save());
  return counts;
}

for (const [name, pack] of [["test", OSE], ["test-feed", FEED]]) {
  test(`${name}: simulate agrees with brute-force play of the real engine`, () => {
    const sim = Stage.simulate(pack);
    const brute = bruteCount(pack);
    assert.deepEqual(brute, Object.fromEntries(Object.entries(sim.endings).filter(([, n]) => n)));
    assert.equal(sim.paths, Object.values(brute).reduce((a, b) => a + b, 0));
  });

  test(`${name}: every ending reached, nothing unreachable, a lock seen`, () => {
    const sim = Stage.simulate(pack);
    assert.deepEqual(sim.unreachable, []);
    assert.ok(Object.values(sim.endings).every(n => n > 0));
    assert.deepEqual(sim.locked, ["s3:take.b"]);
    assert.equal(sim.cycles, 0);
  });

  test(`${name}: every simulated route replays to its ending`, () => {
    const sim = Stage.simulate(pack);
    assert.ok(sim.routes.length > 10);
    for (const r of sim.routes) {
      for (const route of [r, r.steps]) { // a route object or its steps
        const v = Stage.replay(pack, route, { seed: 3 }).view();
        assert.equal(v.node, "ending", JSON.stringify(r.steps));
        assert.equal(v.ending.id, r.ending);
      }
    }
  });

  test(`${name}: random play by keyboard actions always ends, and the end is in the sim`, () => {
    const sim = Stage.simulate(pack);
    const ok = new Set(Object.entries(sim.endings).filter(([, n]) => n).map(([k]) => k));
    const seen = new Set();
    for (let seed = 1; seed <= 150; seed++) {
      const g = Stage.create(pack, { seed });
      let r = seed;
      const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 400 && g.view().node !== "ending"; i++) {
        const v = g.view();
        if (v.node === "choice") { const sel = v.options.filter(o => !o.locked); g.choose(sel[Math.floor(rnd() * sel.length)].key); }
        else if (v.node === "input") g.input("typed");
        else if (rnd() < 0.2 && g.back().canBack !== undefined) continue;
        else g.next();
      }
      assert.equal(g.view().node, "ending", `seed ${seed}`);
      assert.ok(ok.has(g.view().ending.id));
      seen.add(g.view().ending.id);
    }
    assert.equal(seen.size, 2);
  });
}

test("every step of random play on both fixtures has typed cues in the fixed order, and a look cue only on a change", () => {
  const rank = { seal: 0, tear: 1, roll: 2, cost: 3, gain: 3, tally: 4, turn: 5, shift: 5, ink: 6, bloom: 6, close: 7 };
  let looks = 0, beats = 0;
  for (const pack of [OSE, FEED]) for (let seed = 1; seed <= 60; seed++) {
    const g = Stage.create(pack, { seed });
    let r = seed, prev = g.view().beat.look;
    const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 400 && g.view().node !== "ending"; i++) {
      const v0 = g.view();
      const v = v0.node === "choice" ? g.choose(v0.options.filter(o => !o.locked)[Math.floor(rnd() * v0.options.filter(o => !o.locked).length)].key) : v0.node === "input" ? g.input("x") : g.next();
      for (let k = 0; k < v.cues.length; k++) {
        assert.ok(v.cues[k].type in rank, JSON.stringify(v.cues[k]));
        if (k) assert.ok(rank[v.cues[k - 1].type] <= rank[v.cues[k].type], types(v).join());
      }
      if (v.node === "beat" && !v.beat.hidden) {
        beats++;
        const look = types(v).filter(t => t === "ink" || t === "bloom");
        assert.ok(look.length <= 1);
        if (look.length) looks++;
        else if (!types(v).includes("turn")) assert.equal(v.beat.look, prev, "no look cue means the look did not change");
        prev = v.beat.look;
      }
    }
  }
  assert.ok(looks > 0 && looks < beats, `${looks} look cues over ${beats} beats`);
});

test("replay with upTo stops at a choice", () => {
  const steps = [{ opt: "lens1.a" }, { opt: "intro.b" }, { opt: "cross.b" }];
  const g = Stage.replay(OSE, steps, { upTo: 2 });
  assert.equal(g.view().node, "choice");
  assert.equal(g.view().group.key, "cross");
  assert.equal(Stage.replay(OSE, steps, { upTo: 0 }).view().group.key, "lens1");
  assert.throws(() => Stage.replay(OSE, [{ opt: "intro.b" }]), /expected group/);
  assert.throws(() => Stage.replay(OSE, ["lens1.a", "intro.b"]), /must be \{ opt/, "the string form is gone");
  assert.throws(() => Stage.replay(OSE, "lens1.a"), /list of steps/);
});

test("the views carry what the shell needs", () => {
  const g = Stage.create(OSE, { seed: 5 });
  let v = g.view();
  assert.equal(v.node, "beat");
  assert.equal(v.seed, 5);
  assert.deepEqual(Object.keys(v).sort(), ["beat", "canBack", "cues", "ending", "fields", "flags", "found", "group", "input", "met", "meters", "node", "options", "roll", "scene", "seed", "tallies"].sort());
  assert.deepEqual(v.scene, { id: "s1", title: "The Ford at Dusk", place: "Test · the river road", look: "ink", set: "ford", ending: false });
  assert.equal(v.beat.kicker, "SCENE ONE");
  assert.deepEqual(v.beat.notes, ["river-lore"]);
  assert.equal(v.beat.comment, "dm-describes");
  assert.deepEqual(v.met.sort(), ["dm-describes", "river-lore"]);
  g.next();
  assert.equal(g.view().beat.speaker, "wick");
  v = g.next();
  assert.equal(v.beat.set, "lamp");
  assert.deepEqual(types(v), ["shift"], "the look has not changed, so no ink");
  assert.equal(g.next().beat.hidden, true);
  assert.equal(g.next().beat.hidden, false, "next reveals");
  assert.deepEqual(g.next().beat.screen, ["WARD 3: LIT", "FORD: OPEN", "COUNT: 41,207"]);
  const c = g.next();
  assert.equal(c.node, "choice");
  assert.deepEqual(c.group, { key: "lens1", ask: "What do you see in the lamp?", gate: "plan", cost: null, notes: ["lens"], comment: null });
  assert.deepEqual(c.options.map(o => [o.key, o.label, o.sub]), [["a", "A hymn", "Lens: hymn"], ["b", "A machine", "Lens: machine"]]);
});

test("the fixtures play from the first beat to the end with only keyboard actions, in both resolvers", () => {
  for (const pack of [OSE, FEED]) {
    const views = autoplay(Stage.create(pack, { seed: 1 }));
    assert.equal(views.at(-1).node, "ending");
    assert.ok(views.at(-1).canBack !== undefined);
    assert.ok(views.some(v => v.node === "roll"));
    assert.ok(views.some(v => v.node === "input"));
  }
});
