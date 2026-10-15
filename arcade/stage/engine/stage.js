/* The Stage engine. Contract: stage/SPEC.md, section 3.
   One classic script. Browser: globalThis.Stage. Node: module.exports.
   Rules only: no DOM, no timers, no Math.random (dice are mulberry32, seeded).

   How it works, in short. The game is a small state machine. The state S holds a queue of work
   (S.q) for the current scene; each item is a string "kind ref":
     b <beat ref>      a beat            g <scene:group>      a choice group
     i <option ref>    an input          r <option ref>       a roll
     t <id>            leave for a scene or ending            f <ending id>   the end
   settle() pops items until one needs the player (a beat, a choice, an input, a roll, the end).
   Refs: scene beat "s1:0"; option then-beat "s1:grp.opt:then:0"; roll then-beat
   "s1:grp.opt:roll.fail:0"; ending beat "ending:id:0"; option "s1:grp.opt".
   simulate() walks the same machine, so the rules live in one place.
   Cues (SPEC section 3) are pushed as they happen and put in the fixed order of RANK when a view is made. */
(function (root) {
"use strict";

const VERSION = "0.1";
const SAVE_VERSION = 1;
const MAX_HIST = 200;
const SAVE_HIST = 40;
const MAX_STATES = 1500000;

const clone = o => JSON.parse(JSON.stringify(o));
const has = (o, k) => o != null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v != null && typeof v === "object" && !Array.isArray(v);
// A collection the checker has already rejected is walked as empty, so one bad shape cannot throw.
const list = x => (Array.isArray(x) ? x : []);
const NOOP = Object.freeze({});

// ---- dice (SPEC section 3) ----
function rand(S) {
  let t = S.rng = (S.rng + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function parseDice(s) {
  const m = /^(\d+)d(\d+|F)$/i.exec(String(s));
  if (!m || +m[1] < 1) return null;
  return { n: +m[1], f: m[2].toUpperCase() === "F" ? "F" : +m[2] };
}
const rollFaces = (S, d) => {
  const faces = [];
  for (let i = 0; i < d.n; i++) faces.push(d.f === "F" ? Math.floor(rand(S) * 3) - 1 : 1 + Math.floor(rand(S) * d.f));
  return faces;
};
const sum = a => a.reduce((x, y) => x + y, 0);
// The nominal result of a roll: ose reads fail/success; fate4df reads fail/tie/success/style.
function nominal(resolver, total, vs) {
  if (resolver === "fate4df") {
    const sh = total - vs;
    return sh < 0 ? "fail" : sh === 0 ? "tie" : sh >= 3 ? "style" : "success";
  }
  return total >= vs ? "success" : "fail";
}
// The result table to read: a missing tie reads fail; a missing style reads success.
function used(spec, nom) {
  const r = spec.results || {};
  if (nom === "tie") return r.tie ? "tie" : "fail";
  if (nom === "style") return r.style ? "style" : "success";
  return nom;
}

// pack.tallies is a map of tally id to its allowed values. A list of ids is read as a map with no values
// (validate rejects it; the engine does not crash on it).
function tallyMap(pack) {
  const t = pack && pack.tallies;
  if (Array.isArray(t)) return Object.fromEntries(t.filter(x => typeof x === "string").map(x => [x, []]));
  return isObj(t) ? t : {};
}

// ---- the pack, indexed once ----
const INDEX = new WeakMap();
function index(pack) {
  let X = INDEX.get(pack);
  if (X) return X;
  const script = pack.script || {};
  X = {
    pack, resolver: pack.resolver, scenes: new Map(), endings: script.endings || {},
    beats: new Map(), groups: new Map(), options: new Map(), meters: new Map(), tallies: tallyMap(pack),
  };
  for (const m of pack.meters || []) X.meters.set(m.id, m);
  for (const sc of script.scenes || []) {
    X.scenes.set(sc.id, sc);
    (sc.beats || []).forEach((b, i) => X.beats.set(`${sc.id}:${i}`, b));
    for (const g of sc.choices || []) {
      X.groups.set(`${sc.id}:${g.key}`, { scene: sc, group: g });
      for (const o of g.options || []) {
        const r = `${sc.id}:${g.key}.${o.key}`;
        X.options.set(r, { scene: sc, group: g, option: o });
        (o.then || []).forEach((b, i) => X.beats.set(`${r}:then:${i}`, b));
        for (const [rk, res] of Object.entries((o.roll && o.roll.results) || {})) (res.then || []).forEach((b, i) => X.beats.set(`${r}:roll.${rk}:${i}`, b));
      }
    }
  }
  for (const [id, e] of Object.entries(X.endings)) (e.beats || []).forEach((b, i) => X.beats.set(`ending:${id}:${i}`, b));
  INDEX.set(pack, X);
  return X;
}
const split = d => { const i = d.indexOf(" "); return [d.slice(0, i), d.slice(i + 1)]; };

// ---- conditions and effects ----
function cond(S, c) {
  if (!isObj(c)) return false;
  if (has(c, "flag")) return !!S.flags[c.flag];
  if (has(c, "field")) return String(has(S.fields, c.field) ? S.fields[c.field] : "") === String(c.is);
  if (has(c, "meter")) {
    const v = S.meters[c.meter];
    if (typeof v !== "number") return false;
    if (has(c, "gte") && !(v >= c.gte)) return false;
    if (has(c, "lte") && !(v <= c.lte)) return false;
    return true;
  }
  if (has(c, "tally")) {
    const t = S.tallies[c.tally] || {};
    if (has(c, "value")) { // the count of one value
      const n = t[c.value] || 0;
      if (!has(c, "gte") && !has(c, "lte")) return false;
      if (has(c, "gte") && !(n >= c.gte)) return false;
      if (has(c, "lte") && !(n <= c.lte)) return false;
      return true;
    }
    const n = t[c.top] || 0; // that value leads or ties
    return n >= 1 && n === Math.max(0, ...Object.values(t));
  }
  if (has(c, "all")) return Array.isArray(c.all) && c.all.every(x => cond(S, x));
  if (has(c, "any")) return Array.isArray(c.any) && c.any.some(x => cond(S, x));
  if (has(c, "not")) return !cond(S, c.not);
  return false;
}
function applyEffects(S, X, list) {
  for (const e of list || []) {
    if (!isObj(e)) continue;
    if (has(e, "flag")) S.flags[e.flag] = true;
    else if (has(e, "set")) { for (const [k, v] of Object.entries(e.set || {})) S.fields[k] = String(v); }
    else if (has(e, "meter")) {
      const m = X.meters.get(e.meter);
      if (!m) continue;
      const old = S.meters[e.meter];
      const nv = Math.max(m.min, Math.min(m.max, old + (+e.add || 0)));
      S.meters[e.meter] = nv;
      // A meter marked bad (stress, exposure) is a cost when it rises and a gain when it falls.
      if (nv !== old) S.cues.push({ type: (nv > old) === !!m.bad ? "cost" : "gain", meter: e.meter, n: Math.abs(nv - old) });
    } else if (has(e, "tally")) {
      const t = S.tallies[e.tally] || (S.tallies[e.tally] = {});
      t[e.add] = (t[e.add] || 0) + 1;
      S.cues.push({ type: "tally", id: e.tally, value: e.add });
    }
  }
}

// ---- state ----
function newState(X, seed) {
  const S = {
    v: SAVE_VERSION, seed, rng: seed >>> 0, scene: null, ending: null, set: "", look: "", lookShown: "", q: [], node: null, cur: null,
    revealed: true, opened: false, rollRes: null, flags: {}, fields: {}, meters: {}, tallies: {}, cues: [],
  };
  for (const m of X.pack.meters || []) S.meters[m.id] = m.start == null ? m.min : m.start;
  for (const f of X.pack.fields || []) S.fields[f.id] = f.default == null ? "" : String(f.default);
  for (const t of Object.keys(X.tallies)) S.tallies[t] = {};
  return S;
}
const snap = S => { const { cues, ...r } = S; return clone(r); };
const cloneS = S => { const c = snap(S); c.cues = []; return c; };
// Cue order inside one step (SPEC section 3): seal, tear, roll, cost/gain, tally, turn or shift, ink/bloom. Close comes last.
const RANK = { seal: 0, tear: 1, roll: 2, cost: 3, gain: 3, tally: 4, turn: 5, shift: 5, ink: 6, bloom: 6, close: 7 };
const orderCues = cues => cues.map((c, i) => [c, i]).sort((a, b) => ((RANK[a[0].type] ?? 9) - (RANK[b[0].type] ?? 9)) || a[1] - b[1]).map(x => x[0]);
// The look a beat shows: its own, else the scene's (or the ending's).
const baseLook = (S, X) => {
  const o = S.scene != null ? X.scenes.get(S.scene) : S.ending != null ? X.endings[S.ending] : null;
  return (o && o.look) || "";
};
// Signal a look (ink = unwitnessed, bloom = witnessed) when it differs from the one last shown.
function showLook(S, look) {
  if (!look || S.lookShown === look) return;
  S.lookShown = look;
  S.cues.push(look === "ink" ? { type: "ink" } : { type: "bloom" });
}
// A stop with no beat shown since the scene was entered still signals the scene's look.
const settleLook = S => { if (!S.lookShown) showLook(S, S.look); };

// Visible options of a group, each with its lock state. `when` false hides; `lock` false greys.
function optionStates(S, group) {
  const out = [];
  for (const o of group.options || []) {
    if (o.when && !cond(S, o.when)) continue;
    out.push({ o, locked: !!(o.lock && !cond(S, o.lock)) });
  }
  return out;
}

function enterScene(S, X, id, env, first) {
  const sc = X.scenes.get(id);
  S.scene = id; S.ending = null; S.set = sc.set || ""; S.look = sc.look || ""; S.lookShown = ""; S.opened = false; S.rollRes = null;
  S.q = (sc.beats || []).map((_, i) => `b ${id}:${i}`).concat((sc.choices || []).map(g => `g ${id}:${g.key}`));
  if (!first) S.cues.push({ type: "turn", dir: 1 });
  if (env.scene) env.scene(id);
}
function deadEnd(S, env) {
  S.scene = null; S.ending = null; S.q = []; S.node = "ending"; S.cur = "f "; S.revealed = true;
  S.cues.push({ type: "close" });
  if (env.final) env.final(null);
}
function enterEnding(S, X, id, env) {
  const e = X.endings[id];
  if (!e) return deadEnd(S, env);
  S.scene = null; S.ending = id; S.set = e.set || ""; S.look = e.look || ""; S.lookShown = ""; S.opened = false; S.rollRes = null;
  S.q = (e.beats || []).map((_, i) => `b ending:${id}:${i}`).concat([`f ${id}`]);
  S.cues.push({ type: "turn", dir: 1 });
  if (env.ending) env.ending(id);
}
function enterTarget(S, X, id, env) {
  if (X.scenes.has(id)) enterScene(S, X, id, env, false);
  else if (has(X.endings, id)) enterEnding(S, X, id, env);
  else deadEnd(S, env);
}
// The queue ran dry: leave the scene by ending, route or next. Returns true if the machine moved on.
function leave(S, X, env) {
  const sc = S.scene ? X.scenes.get(S.scene) : null;
  if (!sc) { deadEnd(S, env); return false; }
  if (sc.ending) { enterEnding(S, X, sc.ending, env); return true; }
  if (Array.isArray(sc.route)) {
    for (const r of sc.route) if (isObj(r) && (!r.when || cond(S, r.when))) { enterTarget(S, X, r.to, env); return true; }
    deadEnd(S, env); return false;
  }
  if (sc.next) { enterTarget(S, X, sc.next, env); return true; }
  deadEnd(S, env);
  return false;
}

// Run the queue until the machine needs the player.
function settle(S, X, env) {
  for (let guard = 0; ; guard++) {
    if (guard > 10000) throw new Error("Stage: the story loops without showing a beat or a choice");
    if (!S.q.length) {
      if (S.node === "ending") return;
      if (!leave(S, X, env)) return;
      continue;
    }
    const head = S.q.shift();
    const [k, ref] = split(head);
    if (k === "b") {
      const b = X.beats.get(ref);
      if (!b || (b.when && !cond(S, b.when))) continue;
      if (b.set && b.set !== S.set) { S.set = b.set; S.opened = false; S.cues.push({ type: "shift" }); }
      S.node = "beat"; S.cur = head; S.revealed = !b.reveal;
      S.look = b.look || baseLook(S, X); // a beat's look overrides the scene's for that beat
      if (!b.reveal) showLook(S, S.look); // a hidden beat signals when it is revealed
      if (env.beat) env.beat(ref, b);
      return;
    }
    if (k === "g") {
      const { scene, group } = X.groups.get(ref);
      const st = optionStates(S, group);
      for (const x of st) if (x.locked && env.locked) env.locked(`${scene.id}:${group.key}.${x.o.key}`);
      const pay = group.gate === "fate" && group.cost;
      const afford = !pay || S.meters[group.cost.meter] >= group.cost.n;
      if (!afford || !st.some(x => !x.locked)) continue; // never block the game
      S.node = "choice"; S.cur = head; settleLook(S);
      if (env.group) env.group(ref, group);
      return;
    }
    if (k === "i") { S.node = "input"; S.cur = head; settleLook(S); return; }
    if (k === "r") { S.node = "roll"; S.cur = head; S.rollRes = null; settleLook(S); return; }
    if (k === "t") { enterTarget(S, X, ref, env); continue; }
    if (k === "f") {
      S.node = "ending"; S.cur = head; S.revealed = true;
      settleLook(S);
      S.cues.push({ type: "close" });
      if (env.final) env.final(ref);
      return;
    }
  }
}

// The player picks an option. Returns a refusal string or null.
function pick(S, X, key, env) {
  const { scene, group } = X.groups.get(split(S.cur)[1]);
  const st = optionStates(S, group).find(x => x.o.key === key);
  if (!st) return `No option "${key}" here`;
  if (st.locked) return "That option is locked";
  const pay = group.gate === "fate" && group.cost;
  if (pay && S.meters[group.cost.meter] < group.cost.n) return "Not enough to pay";
  const o = st.o, oref = `${scene.id}:${group.key}.${o.key}`;
  if (group.gate === "exec" || group.gate === "fate") S.cues.push({ type: "seal" });
  if (pay) { S.cues.push({ type: "tear" }); applyEffects(S, X, [{ meter: group.cost.meter, add: -group.cost.n }]); }
  if (env.pick) env.pick(oref, group, o);
  applyEffects(S, X, o.effects);
  const q = [];
  if (o.input) q.push(`i ${oref}`);
  (o.then || []).forEach((_, i) => q.push(`b ${oref}:then:${i}`));
  if (o.roll) q.push(`r ${oref}`);
  if (o.to) { q.push(`t ${o.to}`); S.q = q; } else S.q = q.concat(S.q);
  S.node = null;
  settle(S, X, env);
  return null;
}

const addValue = (S, X, add) => {
  if (typeof add === "number") return add;
  if (typeof add !== "string") return 0;
  if (X.meters.has(add)) return S.meters[add];
  return Number(S.fields[add]) || 0;
};

// Apply a decided roll: record it, apply the result's effects, queue its beats.
function applyRoll(S, X, oref, spec, info) {
  S.rollRes = info;
  S.cues.push({ type: "roll", dice: spec.dice, faces: info.faces, total: info.total, add: info.add, vs: spec.vs, result: info.result, used: info.used });
  const res = (spec.results && spec.results[info.used]) || {};
  applyEffects(S, X, res.effects);
  S.q = (res.then || []).map((_, i) => `b ${oref}:roll.${info.used}:${i}`).concat(S.q);
}
// The faces' lowest and highest totals for a dice spec.
const diceRange = d => (d.f === "F" ? [-d.n, d.n] : [d.n, d.n * d.f]);
// The result tiers (after the tie and style fallbacks) that dice d can reach with this modifier, in table order.
function reachableTiers(resolver, spec, add) {
  const d = parseDice(spec.dice) || { n: 2, f: 6 };
  const [lo, hi] = diceRange(d), got = new Set();
  for (let t = lo + add; t <= hi + add; t++) got.add(used(spec, nominal(resolver, t, spec.vs)));
  return ["fail", "tie", "success", "style"].filter(k => got.has(k));
}
// Roll the dice for the pending roll node. `forced` is a result key to steer toward (replay), or null.
// A forced result draws its faces within that tier: by rejection first, then by building faces for a seeded total.
function resolveRoll(S, X, forced) {
  const oref = split(S.cur)[1];
  const spec = X.options.get(oref).option.roll;
  const d = parseDice(spec.dice) || { n: 2, f: 6 };
  const add = addValue(S, X, spec.add);
  let faces = rollFaces(S, d);
  let nom = nominal(X.resolver, sum(faces) + add, spec.vs), u = used(spec, nom);
  if (forced && u !== forced) {
    for (let t = 0; t < 200 && u !== forced; t++) {
      faces = rollFaces(S, d);
      nom = nominal(X.resolver, sum(faces) + add, spec.vs); u = used(spec, nom);
    }
    if (u !== forced) {
      const [lo, hi] = diceRange(d);
      const totals = [];
      for (let t = lo; t <= hi; t++) if (used(spec, nominal(X.resolver, t + add, spec.vs)) === forced) totals.push(t);
      const dlo = d.f === "F" ? -1 : 1, dhi = d.f === "F" ? 1 : d.f;
      if (totals.length) {
        let extra = totals[Math.floor(rand(S) * totals.length)] - d.n * dlo;
        faces = Array.from({ length: d.n }, () => dlo);
        while (extra > 0) { const i = Math.floor(rand(S) * d.n); if (faces[i] < dhi) { faces[i]++; extra--; } }
        nom = nominal(X.resolver, sum(faces) + add, spec.vs); u = used(spec, nom);
      } else { // the dice cannot give it: fake the faces, keep the asked-for result
        faces = Array.from({ length: d.n }, () => (forced === "fail" || forced === "tie" ? dlo : dhi));
        nom = u = forced;
      }
    }
  }
  applyRoll(S, X, oref, spec, { dice: spec.dice, faces, add, total: sum(faces) + add, vs: spec.vs, result: nom, used: u });
}

// ---- the game ----
function create(pack, opts) {
  opts = opts || {};
  const X = index(pack);
  const forceQ = Array.isArray(opts.force) ? opts.force.slice() : [];
  let S = null, hist = [], floor = 0;
  const meta = { met: [], found: [] };
  const addTo = (list, id) => { if (id != null && !list.includes(id)) list.push(id); };
  const meet = b => { for (const n of b.notes || []) addTo(meta.met, n); if (b.comment) addTo(meta.met, b.comment); };
  const env = {
    beat: (ref, b) => { if (!b.reveal) meet(b); },
    group: (ref, g) => meet(g),
    final: id => { if (id != null) addTo(meta.found, id); },
  };
  const hidden = () => S.node === "beat" && !S.revealed;

  function sane(st) {
    try {
      if (!st || typeof st !== "object" || !Array.isArray(st.q) || !st.flags || !st.fields || !st.meters || !st.tallies) return false;
      if (!["beat", "choice", "input", "roll", "ending"].includes(st.node)) return false;
      const ok = d => {
        const [k, ref] = split(String(d));
        if (k === "b") return X.beats.has(ref);
        if (k === "g") return X.groups.has(ref);
        if (k === "i" || k === "r") return X.options.has(ref);
        if (k === "t") return X.scenes.has(ref) || has(X.endings, ref);
        return k === "f";
      };
      if (st.scene != null && !X.scenes.has(st.scene)) return false;
      if (st.ending != null && !has(X.endings, st.ending)) return false;
      return ok(st.cur) && st.q.every(ok);
    } catch (e) { return false; }
  }
  function load(text) {
    try {
      const d = JSON.parse(text);
      if (!d || d.v !== SAVE_VERSION || d.pack !== pack.id || !Array.isArray(d.hist) || !d.hist.length) return false;
      if (!d.hist.every(sane)) return false;
      hist = d.hist.map(clone);
      floor = Math.max(0, Math.min(hist.length - 1, d.floor | 0));
      S = { ...clone(hist[hist.length - 1]), cues: [] };
      meta.met = (d.met || []).filter(x => typeof x === "string");
      meta.found = (d.found || []).filter(x => typeof x === "string");
      return true;
    } catch (e) { return false; }
  }

  const seed = opts.seed == null ? 1 : Math.floor(Number(opts.seed)) >>> 0;
  if (!(opts.save && load(opts.save))) {
    S = newState(X, seed);
    enterScene(S, X, pack.start, env, true);
    settle(S, X, env);
    afterSettle();
    hist = [snap(S)];
    floor = 0;
  }

  // A roll node is resolved the moment it is reached; the dice are the engine's.
  function afterSettle() {
    if (S.node === "roll" && !S.rollRes) resolveRoll(S, X, forceQ.length ? forceQ.shift() : null);
  }
  function commit(seal) {
    hist.push(snap(S));
    if (seal) floor = hist.length - 1;
    if (hist.length > MAX_HIST) { hist.shift(); floor = Math.max(0, floor - 1); }
  }
  const idOf = st => (st.scene != null ? st.scene : st.ending);

  function view() {
    const sc = S.scene != null ? X.scenes.get(S.scene) : null;
    const en = S.ending != null ? X.endings[S.ending] : null;
    const scene = sc ? { id: sc.id, title: sc.title, place: sc.place || "", look: S.look, set: S.set, ending: false }
      : en ? { id: S.ending, title: en.title, place: "", look: S.look, set: S.set, ending: true } : null;
    const [k, ref] = S.cur ? split(S.cur) : ["", ""];
    let beat = null, group = null, options = [], input = null, roll = null, ending = null;
    if (S.node === "beat") {
      const b = X.beats.get(ref), hid = hidden();
      beat = {
        ref, text: hid ? "" : b.text, kicker: b.kicker || null, speaker: b.speaker || null, set: S.set, look: S.look,
        notes: hid ? [] : (b.notes || []).slice(), comment: hid ? null : b.comment || null,
        reveal: !!b.reveal, revealed: !hid, hidden: hid, screen: hid ? null : b.screen ? b.screen.slice() : null,
      };
    } else if (S.node === "choice") {
      const g = X.groups.get(ref).group;
      group = { key: g.key, ask: g.ask, gate: g.gate, cost: g.cost ? { ...g.cost } : null, notes: (g.notes || []).slice(), comment: g.comment || null };
      options = optionStates(S, g).map(({ o, locked }) => ({ key: o.key, label: o.label, sub: o.sub || null, locked, hint: locked ? o.hint || null : null, gate: g.gate }));
    } else if (S.node === "input") {
      const o = X.options.get(ref).option;
      input = { field: o.input.field, prompt: o.input.prompt, max: o.input.max || 140, option: o.key };
    } else if (S.node === "roll") {
      roll = S.rollRes ? { ...S.rollRes, faces: S.rollRes.faces.slice() } : null;
    } else if (S.node === "ending") {
      ending = { id: S.ending, title: en ? en.title : "The end", look: S.look, set: S.set };
    }
    return {
      node: S.node, scene, beat, group, options, input, roll, ending,
      shown: S.lookShown || null, // the look the stage shows now (the last ink or bloom), so a kit can restore it
      opened: !!S.opened,         // a secret in the current set has been revealed (its flap or redaction stays open)
      meters: { ...S.meters }, fields: { ...S.fields }, flags: { ...S.flags }, tallies: clone(S.tallies),
      cues: orderCues(S.cues), canBack: hist.length - 1 > floor, seed: S.seed, met: meta.met.slice(), found: meta.found.slice(),
    };
  }
  const refused = (msg) => { const v = view(); v.cues = []; v.refused = msg; return v; };

  const game = {
    view,
    next() {
      if (S.node === "beat" && hidden()) return game.reveal();
      if (S.node !== "beat" && S.node !== "roll") { S.cues = []; return view(); }
      S.cues = [];
      S.node = null;
      settle(S, X, env); afterSettle(); commit(false);
      return view();
    },
    choose(key) {
      S.cues = [];
      if (S.node !== "choice") return refused("There is no choice to make");
      const gate = X.groups.get(split(S.cur)[1]).group.gate;
      const before = snap(S);
      const why = pick(S, X, key, env);
      if (why) { S = { ...before, cues: [] }; return refused(why); }
      afterSettle();
      commit(gate === "exec" || gate === "fate");
      return view();
    },
    reveal() {
      S.cues = [];
      if (!hidden()) return view();
      S.revealed = true; S.opened = true; // a secret in this set is open until the set changes
      S.lookShown = "ink"; // a revealed beat always inks, and the ink holds until a beat of another look
      S.cues.push({ type: "ink" });
      meet(X.beats.get(split(S.cur)[1]));
      hist[hist.length - 1] = snap(S);
      return view();
    },
    input(text) {
      S.cues = [];
      if (S.node !== "input") return refused("There is nothing to type here");
      const o = X.options.get(split(S.cur)[1]).option;
      S.fields[o.input.field] = String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, o.input.max || 140);
      S.node = null;
      settle(S, X, env); afterSettle(); commit(false);
      return view();
    },
    back() {
      const old = S;
      if (!(hist.length - 1 > floor)) { S.cues = []; return view(); }
      hist.pop();
      S = { ...clone(hist[hist.length - 1]), cues: [] };
      if (idOf(old) !== idOf(S)) S.cues.push({ type: "turn", dir: -1 });
      else if (old.set !== S.set) S.cues.push({ type: "shift" });
      return view();
    },
    save() {
      const drop = Math.max(0, hist.length - SAVE_HIST);
      return JSON.stringify({ v: SAVE_VERSION, pack: pack.id, seed: S.seed, floor: Math.max(0, floor - drop), hist: hist.slice(drop), met: meta.met, found: meta.found });
    },
  };
  return game;
}

// Replay a route from Stage.simulate: a route object {ending, count, steps} or its steps.
// A step is { opt: "group.option" } (with result: "<tier>" when the pick rolls) or { input: "text" }.
// A step's result forces that roll tier. `upTo` stops at the choice after that many picks.
function replay(pack, route, opts) {
  opts = opts || {};
  const steps = Array.isArray(route) ? route : route && Array.isArray(route.steps) ? route.steps : null;
  if (!steps) throw new Error("replay: a route is a list of steps, or an object with steps");
  steps.forEach((x, i) => {
    if (!isObj(x) || !(typeof x.opt === "string" && x.opt.includes(".") || has(x, "input"))) throw new Error(`replay: step ${i} must be { opt: "group.option" } or { input }, not ${JSON.stringify(x)}`);
  });
  const picks = steps.filter(x => has(x, "opt"));
  const forces = picks.filter(x => x.result != null).map(x => x.result);
  const typed = steps.filter(x => has(x, "input")).map(x => String(x.input));
  const g = create(pack, { seed: opts.seed, force: forces });
  let pi = 0, ti = 0;
  for (let guard = 0; guard < 100000; guard++) {
    const v = g.view();
    if (v.node === "ending") break;
    if (v.node === "choice") {
      if (pi >= picks.length || (opts.upTo != null && pi >= opts.upTo)) break;
      const dot = picks[pi].opt.indexOf(".");
      const gk = picks[pi].opt.slice(0, dot), ok = picks[pi].opt.slice(dot + 1);
      if (v.group.key !== gk) throw new Error(`replay: expected group "${gk}" but the game asks "${v.group.key}"`);
      pi++;
      const r = g.choose(ok);
      if (r.refused) throw new Error(`replay: ${r.refused}`);
    } else if (v.node === "input") g.input(ti < typed.length ? typed[ti++] : "(typed)");
    else g.next();
  }
  return g;
}

// ---- simulate (SPEC section 3, Simulation) ----
function walkConds(pack, fn) {
  const script = pack.script || {};
  const beats = bs => { for (const b of bs || []) if (b.when) fn(b.when); };
  for (const sc of script.scenes || []) {
    beats(sc.beats);
    for (const r of sc.route || []) if (r.when) fn(r.when);
    for (const g of sc.choices || []) for (const o of g.options || []) {
      if (o.when) fn(o.when);
      if (o.lock) fn(o.lock);
      beats(o.then);
      for (const res of Object.values((o.roll && o.roll.results) || {})) beats(res.then);
    }
  }
  for (const e of Object.values(script.endings || {})) beats(e.beats);
}
function collectReads(pack) {
  const reads = { flags: new Set(), fields: new Set(), meters: new Set(), tallies: new Set() };
  const go = c => {
    if (!isObj(c)) return;
    if (has(c, "flag")) reads.flags.add(c.flag);
    else if (has(c, "field")) reads.fields.add(c.field);
    else if (has(c, "meter")) reads.meters.add(c.meter);
    else if (has(c, "tally")) reads.tallies.add(c.tally);
    else if (has(c, "all")) (c.all || []).forEach(go);
    else if (has(c, "any")) (c.any || []).forEach(go);
    else if (has(c, "not")) go(c.not);
  };
  walkConds(pack, go);
  // A group's cost and a roll's add are read too: they decide what can be afforded and which tiers the dice reach.
  const meterIds = new Set(list(pack.meters).map(m => m && m.id));
  for (const sc of (pack.script && pack.script.scenes) || []) for (const g of sc.choices || []) {
    if (g.cost && g.cost.meter) reads.meters.add(g.cost.meter);
    for (const o of g.options || []) {
      const a = o.roll && o.roll.add;
      if (typeof a === "string") (meterIds.has(a) ? reads.meters : reads.fields).add(a);
    }
  }
  return { flags: [...reads.flags].sort(), fields: [...reads.fields].sort(), meters: [...reads.meters].sort(), tallies: [...reads.tallies].sort() };
}

function simulate(pack) {
  const X = index(pack);
  if (!X.scenes.has(pack.start)) throw new Error(`Stage.simulate: start scene "${pack.start}" does not exist`);
  const reads = collectReads(pack);
  const seen = { scenes: new Set(), beats: new Set(), options: new Set(), endings: new Set(), notes: new Set(), locked: new Set() };
  const env = {
    scene: id => seen.scenes.add(id),
    beat: (ref, b) => { seen.beats.add(ref); for (const n of b.notes || []) seen.notes.add(n); if (b.comment) seen.notes.add(b.comment); },
    group: (ref, g) => { for (const n of g.notes || []) seen.notes.add(n); if (g.comment) seen.notes.add(g.comment); },
    pick: ref => seen.options.add(ref),
    locked: ref => seen.locked.add(ref),
    ending: id => seen.endings.add(id),
  };
  // The state key: where we are, plus only the values some condition reads.
  const keyOf = S => {
    let k = `${S.scene || ""}|${S.ending || ""}|${S.node}|${S.cur}|${S.q.join(",")}|`;
    for (const f of reads.flags) k += S.flags[f] ? "1" : "0";
    k += "|";
    for (const f of reads.fields) k += `${S.fields[f]}\u0001`;
    k += "|";
    for (const m of reads.meters) k += `${S.meters[m]},`;
    k += "|";
    for (const t of reads.tallies) { const tt = S.tallies[t] || {}; k += `${Object.keys(tt).sort().map(v => `${v}=${tt[v]}`).join(";")}/`; }
    return k;
  };
  const recs = new Map();
  const mk = S => {
    const key = keyOf(S);
    let r = recs.get(key);
    if (!r) {
      if (recs.size >= MAX_STATES) throw new Error("Stage.simulate: too many states; the story reads too much state to walk");
      r = { key, S, edges: null, color: 0, ways: 0, terminal: false, ending: null, parent: null };
      recs.set(key, r);
    }
    return r;
  };
  const expand = r => {
    const S = r.S;
    r.S = null;
    const edges = [];
    const go = (S2, label) => { settle(S2, X, env); edges.push({ to: mk(S2), label, dead: false }); };
    if (S.node === "ending") { r.terminal = true; r.ending = S.ending == null ? "(dead end)" : S.ending; return edges; }
    if (S.node === "beat" || S.node === "roll" && S.rollRes) { const S2 = cloneS(S); S2.node = null; go(S2, null); }
    else if (S.node === "choice") {
      const { scene, group } = X.groups.get(split(S.cur)[1]);
      for (const { o, locked } of optionStates(S, group)) {
        if (locked) continue;
        const S2 = cloneS(S);
        const why = pick(S2, X, o.key, env);
        if (why) throw new Error(`Stage.simulate: ${scene.id}:${group.key}.${o.key}: ${why}`);
        edges.push({ to: mk(S2), label: { opt: `${group.key}.${o.key}` }, dead: false });
      }
    } else if (S.node === "input") {
      const S2 = cloneS(S);
      const o = X.options.get(split(S.cur)[1]).option;
      S2.fields[o.input.field] = "(typed)";
      S2.node = null;
      go(S2, { input: "(typed)" });
    } else if (S.node === "roll") {
      const oref = split(S.cur)[1];
      const spec = X.options.get(oref).option.roll;
      const add = addValue(S, X, spec.add);
      for (const key of reachableTiers(X.resolver, spec, add)) { // only tiers the dice can reach from this modifier
        const S2 = cloneS(S);
        applyRoll(S2, X, oref, spec, { dice: spec.dice, faces: [], add, total: 0, vs: spec.vs, result: key, used: key });
        S2.node = null;
        go(S2, { result: key });
      }
    }
    return edges;
  };

  const S0 = newState(X, 1);
  enterScene(S0, X, pack.start, env, true);
  settle(S0, X, env);
  const start = mk(S0);
  const post = [];
  let cycles = 0;
  start.color = 1; start.edges = expand(start);
  const stack = [{ r: start, i: 0 }];
  while (stack.length) {
    const top = stack[stack.length - 1], r = top.r;
    if (top.i < r.edges.length) {
      const e = r.edges[top.i++], c = e.to;
      if (c.color === 1) { e.dead = true; cycles++; continue; }
      if (c.color === 0) { c.color = 1; c.edges = expand(c); stack.push({ r: c, i: 0 }); }
    } else { r.color = 2; post.push(r); stack.pop(); }
  }
  // Count paths forward in topological order (reverse post-order).
  start.ways = 1;
  for (let i = post.length - 1; i >= 0; i--) {
    const r = post[i];
    for (const e of r.edges) if (!e.dead) e.to.ways += r.ways;
  }
  const endings = {};
  for (const id of Object.keys(X.endings)) endings[id] = 0;
  let paths = 0;
  for (const r of post) if (r.terminal) { endings[r.ending] = (endings[r.ending] || 0) + r.ways; paths += r.ways; }
  // One shortest route to each terminal state (breadth first).
  const fifo = [start];
  start.parent = false;
  for (let h = 0; h < fifo.length; h++) {
    const r = fifo[h];
    for (const e of r.edges) if (!e.dead && e.to.parent === null) { e.to.parent = { r, label: e.label }; fifo.push(e.to); }
  }
  const routes = [];
  for (const r of post.slice().reverse()) {
    if (!r.terminal) continue;
    const labels = [];
    for (let c = r; c.parent; c = c.parent.r) if (c.parent.label) labels.push(c.parent.label);
    const steps = [];
    let last = null; // the pick a roll belongs to
    for (const l of labels.reverse()) {
      if (l.opt) steps.push(last = { opt: l.opt });
      else if (l.input) steps.push({ input: l.input });
      else if (l.result && last) last.result = l.result;
    }
    routes.push({ ending: r.ending, count: r.ways, steps });
  }

  // What was never reached.
  const by = { scenes: [], beats: [], options: [], endings: [], notes: [] };
  for (const id of X.scenes.keys()) if (!seen.scenes.has(id)) by.scenes.push(id);
  for (const ref of X.beats.keys()) if (!seen.beats.has(ref)) by.beats.push(ref);
  for (const ref of X.options.keys()) if (!seen.options.has(ref)) by.options.push(ref);
  for (const id of Object.keys(X.endings)) if (!seen.endings.has(id)) by.endings.push(id);
  for (const id of Object.keys(pack.notes || {})) if (!seen.notes.has(id)) by.notes.push(id);
  const unreachable = [...by.scenes, ...by.beats, ...by.options, ...by.endings.map(id => `ending:${id}`), ...by.notes.map(id => `note:${id}`)];
  return { paths, endings, routes, unreachable, unreachableBy: by, locked: [...seen.locked].sort(), states: recs.size, cycles };
}

// ---- validate (SPEC section 2) ----
const ID = /^[A-Za-z0-9_-]+$/;
const KINDS = ["rule", "dm", "lore", "handler", "algorithm", "guide"];
const KITS = { paper: ["spread", "vfold", "parallel", "tunnel", "flap", "pulltab", "volvelle", "ticket", "plate"], feed: ["frame", "track", "scan", "log", "redact", "plate"] };
const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;

// check(pack) -> { errors, warnings }. A speaker missing from cast.json is a warning while the pack has no
// cast.json (a script can be finished before its cast art) and an error once it has one.
function check(pack) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const done = () => ({ errors, warnings });
  if (!isObj(pack)) { errors.push("pack: not an object"); return done(); }
  const str = v => typeof v === "string" && v.trim() !== "";
  const num = v => typeof v === "number" && Number.isFinite(v);

  // pack.json
  if (!str(pack.id) || !/^[a-z0-9-]+$/.test(pack.id)) err("pack.json", `id must be lower-kebab-case, not ${JSON.stringify(pack.id)}`);
  if (!str(pack.title)) err("pack.json", "title is missing");
  if (!["paper", "feed"].includes(pack.kit)) err("pack.json", `kit must be "paper" or "feed", not ${JSON.stringify(pack.kit)}`);
  if (!["ose", "fate4df"].includes(pack.resolver)) err("pack.json", `resolver must be "ose" or "fate4df", not ${JSON.stringify(pack.resolver)}`);
  if (!str(pack.storageKey) || !/^(fort-stage|htll)\.[a-z0-9.-]+$/.test(pack.storageKey)) err("pack.json", `storageKey must start with "fort-stage." or "htll.", not ${JSON.stringify(pack.storageKey)}`);
  const meterIds = new Set(), badMeters = new Set(), fieldIds = new Set(), tallyVals = new Map();
  if (!Array.isArray(pack.meters)) err("pack.json", "meters must be a list (it may be empty)");
  for (const m of list(pack.meters)) {
    const w = `pack.json meter ${m && m.id}`;
    if (!isObj(m) || !str(m.id) || !ID.test(m.id)) { err("pack.json", `a meter has a bad id: ${JSON.stringify(m)}`); continue; }
    if (meterIds.has(m.id)) err(w, "duplicate id");
    meterIds.add(m.id);
    if (!str(m.label)) err(w, "label is missing");
    if (!num(m.min) || !num(m.max) || m.min > m.max) err(w, "min and max must be numbers with min <= max");
    else if (!num(m.start) || m.start < m.min || m.start > m.max) err(w, "start must be a number between min and max");
    if (m.bad != null && typeof m.bad !== "boolean") err(w, "bad must be true or false");
    if (m.bad === true) badMeters.add(m.id);
  }
  if (!Array.isArray(pack.fields)) err("pack.json", "fields must be a list (it may be empty)");
  for (const f of list(pack.fields)) {
    if (!isObj(f) || !str(f.id) || !ID.test(f.id)) { err("pack.json", `a field has a bad id: ${JSON.stringify(f)}`); continue; }
    if (fieldIds.has(f.id)) err(`pack.json field ${f.id}`, "duplicate id");
    if (meterIds.has(f.id)) err(`pack.json field ${f.id}`, "a field and a meter share an id");
    fieldIds.add(f.id);
    if (!str(f.label)) err(`pack.json field ${f.id}`, "label is missing");
    if (f.side != null && !["front", "back"].includes(f.side)) err(`pack.json field ${f.id}`, `side must be "front" or "back", not ${JSON.stringify(f.side)}`);
  }
  // tallies: a map of tally id to its allowed values. Never a list of ids.
  if (pack.tallies != null) {
    if (!isObj(pack.tallies)) err("pack.json", "tallies must be a map of tally id to its list of allowed values, not a list");
    else for (const [id, vals] of Object.entries(pack.tallies)) {
      if (!ID.test(id)) { err("pack.json", `tally id ${JSON.stringify(id)} is not a plain id`); continue; }
      if (!Array.isArray(vals) || !vals.length || !vals.every(v => str(v) && ID.test(v)) || new Set(vals).size !== vals.length) err("pack.json", `tally "${id}" must be a non-empty list of distinct value names`);
      else tallyVals.set(id, new Set(vals));
    }
  }
  const commentKinds = pack.commentary && Array.isArray(pack.commentary.kinds) ? pack.commentary.kinds : null;
  if (pack.commentary != null) {
    if (!isObj(pack.commentary) || !str(pack.commentary.label)) err("pack.json", "commentary.label is missing");
    if (!commentKinds || commentKinds.some(k => !KINDS.includes(k))) err("pack.json", `commentary.kinds must be a list drawn from ${KINDS.join(", ")}`);
  }

  // notes.json
  const notes = isObj(pack.notes) ? pack.notes : null;
  if (!notes) err("notes.json", "is missing or is not an object");
  for (const [id, n] of Object.entries(notes || {})) {
    const w = `notes.json ${id}`;
    if (!isObj(n)) { err(w, "must be an object"); continue; }
    if (!KINDS.includes(n.kind)) err(w, `kind must be one of ${KINDS.join(", ")}`);
    if (!str(n.term)) err(w, "term is missing");
    if (!str(n.text)) err(w, "text is missing");
    else if (words(n.text) > 60) err(w, `text has ${words(n.text)} words; the limit is 60`);
  }

  // cast.json: a person with no x, y and r has no portrait (the kit draws a placeholder); sheet is needed only if someone has a crop
  const people = pack.cast && isObj(pack.cast.people) ? pack.cast.people : null;
  if (pack.cast) {
    if (!isObj(pack.cast)) err("cast.json", "must be an object");
    else {
      if (!people) err("cast.json", "people is missing");
      let crops = 0;
      for (const [id, p] of Object.entries(people || {})) {
        if (!isObj(p) || !str(p.name)) { err(`cast.json ${id}`, "needs a name"); continue; }
        const given = ["x", "y", "r"].filter(k => p[k] != null);
        if (given.length === 3) { if (["x", "y", "r"].every(k => num(p[k]))) crops++; else err(`cast.json ${id}`, "x, y and r must be numbers"); }
        else if (given.length) err(`cast.json ${id}`, "x, y and r go together: give all three for a portrait, none for a placeholder");
      }
      if (crops) {
        if (!str(pack.cast.sheet)) err("cast.json", "sheet is missing (a person has a portrait crop)");
        if (!num(pack.cast.w) || !num(pack.cast.h)) err("cast.json", "w and h must be numbers (a person has a portrait crop)");
      } else {
        if (pack.cast.sheet != null && !str(pack.cast.sheet)) err("cast.json", "sheet must be a path");
        for (const k of ["w", "h"]) if (pack.cast[k] != null && !num(pack.cast[k])) err("cast.json", `${k} must be a number`);
      }
    }
  }

  // sets.json
  const sets = isObj(pack.sets) ? pack.sets : null;
  if (!sets) err("sets.json", "is missing or is not an object");
  for (const [id, s] of Object.entries(sets || {})) {
    const w = `sets.json ${id}`;
    if (!isObj(s)) { err(w, "must be an object"); continue; }
    if (s.kit !== pack.kit) err(w, `kit "${s.kit}" does not match the pack's kit "${pack.kit}"`);
    if (!Array.isArray(s.layers) || !s.layers.length) { err(w, "layers must be a non-empty list"); continue; }
    s.layers.forEach((l, i) => {
      const lw = `${w} layer ${i}`;
      if (!isObj(l)) return err(lw, "must be an object");
      const prims = KITS[pack.kit];
      if (prims && !prims.includes(l.prim)) err(lw, `prim "${l.prim}" is not a ${pack.kit} primitive (${prims.join(", ")})`);
      if (l.tally != null) {
        if (!tallyVals.has(l.tally)) err(lw, `tally "${l.tally}" is not in pack.tallies`);
        else if (!tallyVals.get(l.tally).has(l.value)) err(lw, `a layer bound to tally "${l.tally}" needs a value from ${[...tallyVals.get(l.tally)].join(", ")}, not ${JSON.stringify(l.value)}`);
      }
      for (const k of ["x", "y", "w", "h"]) if (l[k] != null && !(num(l[k]) && l[k] >= 0 && l[k] <= 1)) err(lw, `${k} must be a fraction from 0 to 1`);
    });
  }

  // script.json
  const script = isObj(pack.script) ? pack.script : null;
  if (!script || !Array.isArray(script.scenes) || !script.scenes.length) { err("script.json", "needs a non-empty scenes list"); return done(); }
  const endings = isObj(script.endings) ? script.endings : {};
  if (!isObj(script.endings) || !Object.keys(endings).length) err("script.json", "needs at least one ending");
  const sceneIds = new Set();
  for (const sc of script.scenes) {
    if (!isObj(sc) || !str(sc.id) || !ID.test(sc.id)) { err("script.json", `a scene has a bad id: ${JSON.stringify(sc && sc.id)}`); continue; }
    if (sceneIds.has(sc.id)) err(`scene ${sc.id}`, "duplicate id");
    sceneIds.add(sc.id);
  }
  if (!sceneIds.has(pack.start)) err("pack.json", `start "${pack.start}" is not a scene`);
  const target = id => sceneIds.has(id) || has(endings, id);

  // The card fields an input writes: no condition may read them, because typed text cannot be explored.
  const inputFields = new Set();
  for (const sc of script.scenes) for (const g of (isObj(sc) && Array.isArray(sc.choices) ? sc.choices : [])) for (const o of (isObj(g) && Array.isArray(g.options) ? g.options : [])) {
    if (isObj(o) && isObj(o.input) && str(o.input.field)) inputFields.add(o.input.field);
  }

  const checkCond = (w, c) => {
    if (!isObj(c)) return err(w, "a condition must be an object");
    const ks = ["flag", "field", "meter", "tally", "all", "any", "not"].filter(k => has(c, k));
    if (ks.length !== 1) return err(w, `a condition needs exactly one of flag, field, meter, tally, all, any, not: ${JSON.stringify(c)}`);
    const k = ks[0];
    if (k === "flag") { if (!str(c.flag)) err(w, "flag must be a name"); }
    else if (k === "field") {
      if (!fieldIds.has(c.field)) err(w, `field "${c.field}" is not in pack.fields`);
      else if (inputFields.has(c.field)) err(w, `a condition reads field "${c.field}", which an input writes; typed text cannot be explored`);
      if (!has(c, "is")) err(w, `field condition "${c.field}" needs "is"`);
    } else if (k === "meter") {
      if (!meterIds.has(c.meter)) err(w, `meter "${c.meter}" is not in pack.meters`);
      if (!has(c, "gte") && !has(c, "lte")) err(w, "meter condition needs gte or lte");
      for (const b of ["gte", "lte"]) if (has(c, b) && !num(c[b])) err(w, `${b} must be a number`);
    } else if (k === "tally") {
      const vals = tallyVals.get(c.tally);
      if (!vals) err(w, `tally "${c.tally}" is not in pack.tallies`);
      const top = has(c, "top"), val = has(c, "value");
      if (top === val) err(w, "a tally condition is either { tally, top } or { tally, value, gte|lte }");
      else if (top) { if (vals && !vals.has(c.top)) err(w, `tally "${c.tally}" has no value "${c.top}" (${[...vals].join(", ")})`); }
      else {
        if (vals && !vals.has(c.value)) err(w, `tally "${c.tally}" has no value "${c.value}" (${[...vals].join(", ")})`);
        if (!has(c, "gte") && !has(c, "lte")) err(w, "a tally count condition needs gte or lte");
        for (const b of ["gte", "lte"]) if (has(c, b) && !num(c[b])) err(w, `${b} must be a number`);
      }
    } else if (k === "all" || k === "any") {
      if (!Array.isArray(c[k]) || !c[k].length) err(w, `${k} must be a non-empty list`);
      else c[k].forEach(x => checkCond(w, x));
    } else checkCond(w, c.not);
  };
  const checkEffects = (w, list) => {
    if (list == null) return;
    if (!Array.isArray(list)) return err(w, "effects must be a list");
    for (const e of list) {
      if (!isObj(e)) { err(w, "an effect must be an object"); continue; }
      const ks = ["flag", "set", "meter", "tally"].filter(k => has(e, k));
      if (ks.length !== 1) { err(w, `an effect needs exactly one of flag, set, meter, tally: ${JSON.stringify(e)}`); continue; }
      if (ks[0] === "flag") { if (!str(e.flag)) err(w, "flag must be a name"); }
      else if (ks[0] === "set") {
        if (!isObj(e.set) || !Object.keys(e.set).length) err(w, "set must be an object of field values");
        else for (const f of Object.keys(e.set)) if (!fieldIds.has(f)) err(w, `set: "${f}" is not in pack.fields`);
      } else if (ks[0] === "meter") {
        if (!meterIds.has(e.meter)) err(w, `meter "${e.meter}" is not in pack.meters`);
        if (!num(e.add)) err(w, "meter effect needs a numeric add");
      } else {
        const vals = tallyVals.get(e.tally);
        if (!vals) err(w, `tally "${e.tally}" is not in pack.tallies`);
        if (!str(e.add)) err(w, "tally effect needs add: a value name");
        else if (vals && !vals.has(e.add)) err(w, `tally "${e.tally}" has no value "${e.add}" (${[...vals].join(", ")})`);
      }
    }
  };
  // notes (chips) and comment, on a beat or a choice group
  const checkNotes = (w, x) => {
    if (x.notes != null) {
      if (!Array.isArray(x.notes)) err(w, "notes must be a list of note ids");
      else for (const n of x.notes) if (!(notes && has(notes, n))) err(w, `note "${n}" is not in notes.json`);
    }
    if (x.comment != null) {
      if (!(notes && has(notes, x.comment))) err(w, `comment "${x.comment}" is not in notes.json`);
      else if (!commentKinds) err(w, "has a comment but pack.commentary is missing");
      else if (!isObj(notes[x.comment]) || !commentKinds.includes(notes[x.comment].kind)) err(w, `comment "${x.comment}" is a ${isObj(notes[x.comment]) ? notes[x.comment].kind : "bad"} note; the commentary shows ${commentKinds.join(", ")}`);
    }
  };
  const missingSpeakers = new Map();
  const checkBeats = (w, list) => {
    if (list == null) return;
    if (!Array.isArray(list)) return err(w, "beats must be a list");
    list.forEach((b, i) => {
      const bw = `${w} beat ${i}`;
      if (!isObj(b)) return err(bw, "must be an object");
      if (!str(b.text)) err(bw, "text is missing");
      else if ((b.text.match(/\*/g) || []).length % 2) err(bw, "unbalanced * in text");
      if (b.kicker != null && !str(b.kicker)) err(bw, "kicker must be text");
      if (b.speaker != null) {
        if (!str(b.speaker)) err(bw, "speaker must be a cast id");
        else if (!(people && has(people, b.speaker))) {
          if (pack.cast) err(bw, `speaker "${b.speaker}" is not in cast.json`);
          else missingSpeakers.set(b.speaker, (missingSpeakers.get(b.speaker) || 0) + 1);
        }
      }
      if (b.set != null && sets && !has(sets, b.set)) err(bw, `set "${b.set}" is not in sets.json`);
      if (b.look != null && !["ink", "paint"].includes(b.look)) err(bw, `look must be "ink" or "paint", not ${JSON.stringify(b.look)}`);
      checkNotes(bw, b);
      if (b.reveal != null && typeof b.reveal !== "boolean") err(bw, "reveal must be true or false");
      if (b.screen != null && !(Array.isArray(b.screen) && b.screen.length && b.screen.every(str))) err(bw, "screen must be an array of strings (one line each, at least one)");
      if (b.when != null) checkCond(bw, b.when);
    });
  };

  script.scenes.forEach(sc => {
    if (!isObj(sc) || !sceneIds.has(sc.id)) return;
    const w = `scene ${sc.id}`;
    if (!str(sc.title)) err(w, "title is missing");
    if (!["ink", "paint"].includes(sc.look)) err(w, `look must be "ink" or "paint", not ${JSON.stringify(sc.look)}`);
    if (!str(sc.set)) err(w, "set is missing");
    else if (sets && !has(sets, sc.set)) err(w, `set "${sc.set}" is not in sets.json`);
    checkBeats(w, sc.beats);
    const exits = ["next", "ending", "route"].filter(k => sc[k] != null);
    if (exits.length !== 1) err(w, `needs exactly one of next, ending, route (has ${exits.length ? exits.join(", ") : "none"})`);
    if (sc.next != null && !sceneIds.has(sc.next)) err(w, `next "${sc.next}" is not a scene`);
    if (sc.ending != null && !has(endings, sc.ending)) err(w, `ending "${sc.ending}" is not an ending`);
    if (sc.route != null) {
      if (!Array.isArray(sc.route) || !sc.route.length) err(w, "route must be a non-empty list");
      else sc.route.forEach((r, i) => {
        const rw = `${w} route ${i}`;
        if (!isObj(r) || !target(r.to)) return err(rw, `"to" ${JSON.stringify(r && r.to)} is not a scene or ending`);
        const last = i === sc.route.length - 1;
        if (last && r.when) err(rw, "the last route entry must have no when");
        if (!last) { if (!r.when) err(rw, "only the last route entry may omit when"); else checkCond(rw, r.when); }
      });
    }
    if (sc.choices != null && !Array.isArray(sc.choices)) return err(w, "choices must be a list");
    const gkeys = new Set();
    (sc.choices || []).forEach(g => {
      const gw = `${w} group ${g && g.key}`;
      if (!isObj(g) || !str(g.key) || !ID.test(g.key)) return err(w, `a choice group has a bad key: ${JSON.stringify(g && g.key)}`);
      if (gkeys.has(g.key)) err(gw, "duplicate key");
      gkeys.add(g.key);
      if (!str(g.ask)) err(gw, "ask is missing");
      if (!["plan", "exec", "fate"].includes(g.gate)) err(gw, `gate must be "plan", "exec" or "fate", not ${JSON.stringify(g.gate)}`);
      checkNotes(gw, g);
      if (g.cost != null) {
        if (g.gate !== "fate") err(gw, "cost is only for gate fate");
        if (!isObj(g.cost) || !meterIds.has(g.cost.meter) || !Number.isInteger(g.cost.n) || g.cost.n < 1) err(gw, "cost needs a meter and a whole number n >= 1");
        else if (badMeters.has(g.cost.meter)) err(gw, `cost meter "${g.cost.meter}" is a bad meter; a cost is paid from a meter that falls`);
      }
      if (!Array.isArray(g.options) || !g.options.length) return err(gw, "options must be a non-empty list");
      const okeys = new Set();
      g.options.forEach(o => {
        const ow = `${gw} option ${o && o.key}`;
        if (!isObj(o) || !str(o.key) || !ID.test(o.key)) return err(gw, `an option has a bad key: ${JSON.stringify(o && o.key)}`);
        if (okeys.has(o.key)) err(ow, "duplicate key");
        okeys.add(o.key);
        if (!str(o.label)) err(ow, "label is missing");
        if (o.sub != null && !str(o.sub)) err(ow, "sub must be text");
        if (o.when != null && o.lock != null) err(ow, "use when or lock, not both");
        if (o.when != null) checkCond(ow, o.when);
        if (o.lock != null) { checkCond(ow, o.lock); if (!str(o.hint)) err(ow, "a locked option needs a hint"); }
        else if (o.hint != null) err(ow, "hint is only for an option with lock");
        checkEffects(ow, o.effects);
        checkBeats(ow, o.then);
        if (o.to != null && !target(o.to)) err(ow, `to "${o.to}" is not a scene or ending`);
        if (o.input != null) {
          const i = o.input;
          if (!isObj(i) || !fieldIds.has(i.field)) err(ow, `input.field "${i && i.field}" is not in pack.fields`);
          else {
            if (!str(i.prompt)) err(ow, "input.prompt is missing");
            if (i.max != null && !(Number.isInteger(i.max) && i.max >= 1 && i.max <= 1000)) err(ow, "input.max must be a whole number from 1 to 1000");
          }
        }
        if (o.roll != null) {
          const r = o.roll, d = isObj(r) ? parseDice(r.dice) : null;
          if (!d) err(ow, `roll.dice must look like 2d6, 1d20 or 4dF, not ${JSON.stringify(r && r.dice)}`);
          else if (pack.resolver === "fate4df" && d.f !== "F") err(ow, "a fate4df pack rolls 4dF");
          else if (pack.resolver === "ose" && d.f === "F") err(ow, "an ose pack rolls dN, not dF");
          else if (pack.resolver === "fate4df" && d.n !== 4) err(ow, "a fate4df roll is four dice (4dF)");
          if (!isObj(r)) return err(ow, "roll must be an object");
          if (!num(r.vs)) err(ow, "roll.vs must be a number");
          if (r.add != null && !meterIds.has(r.add)) err(ow, `roll.add "${r.add}" is not a meter (add names a meter only)`);
          if (!isObj(r.results)) err(ow, "roll.results is missing");
          else {
            const ok = pack.resolver === "fate4df" ? ["fail", "tie", "success", "style"] : ["fail", "success"];
            for (const k of Object.keys(r.results)) {
              if (!ok.includes(k)) err(ow, `roll result "${k}" is not read by ${pack.resolver} (${ok.join(", ")})`);
              else if (!isObj(r.results[k])) err(ow, `roll result "${k}" must be an object`);
              else { checkEffects(`${ow} result ${k}`, r.results[k].effects); checkBeats(`${ow} result ${k}`, r.results[k].then); }
            }
            for (const k of ["fail", "success"]) if (!has(r.results, k)) err(ow, `roll.results needs "${k}"`);
          }
        }
      });
    });
  });
  for (const [id, e] of Object.entries(endings)) {
    const w = `ending ${id}`;
    if (!ID.test(id)) err(w, "bad id");
    if (!isObj(e)) { err(w, "must be an object"); continue; }
    if (!str(e.title)) err(w, "title is missing");
    if (!["ink", "paint"].includes(e.look)) err(w, `look must be "ink" or "paint"`);
    if (!str(e.set)) err(w, "set is missing");
    else if (sets && !has(sets, e.set)) err(w, `set "${e.set}" is not in sets.json`);
    if (!Array.isArray(e.beats)) err(w, "beats must be a list");
    checkBeats(w, e.beats);
  }

  // The first exec group in the pack must carry a rule note in its own notes that teaches the gate.
  outer: for (const sc of script.scenes) {
    for (const g of (isObj(sc) && Array.isArray(sc.choices) ? sc.choices : [])) {
      if (!isObj(g) || g.gate !== "exec") continue;
      const teaches = Array.isArray(g.notes) && g.notes.some(n => notes && isObj(notes[n]) && notes[n].kind === "rule");
      if (!teaches) err(`scene ${sc.id} group ${g.key}`, "the first exec group in the pack must carry a rule note in its own notes that teaches the gate");
      break outer;
    }
  }
  for (const [who, n] of missingSpeakers) warnings.push(`cast.json: speaker "${who}" is not in cast.json (${n} beat${n === 1 ? "" : "s"}; the pack has no cast.json yet)`);
  return done();
}
// validate(pack) -> [error strings]. Warnings go to the optional second argument (a list).
function validate(pack, sink) {
  const r = check(pack);
  if (Array.isArray(sink)) sink.push(...r.warnings);
  return r.errors;
}

const Stage = { version: VERSION, create, replay, simulate, validate, check };
if (typeof module !== "undefined" && module.exports) module.exports = Stage;
else root.Stage = Stage;
})(typeof globalThis !== "undefined" ? globalThis : this);
