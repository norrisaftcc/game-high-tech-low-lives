#!/usr/bin/env node
// Balance simulator. Runs the engine headless against a pack: the default party, fresh, with full Fate and a lit light,
// goes into each encounter many times (seeds seed0 .. seed0+n-1, foes as authored) under one plain policy.
//
//   node crawler/tools/sim.mjs <packdir> [options]
//
//   --n N            seeds per encounter (default 1000)
//   --seed0 N        first seed (default 1)
//   --enc a,b        only these encounters (default: all)
//   --party a,b,c,d  marching order (default: the pack's default party)
//   --items id=n,..  add items to the shared pack before each fight (oil flasks, potions)
//   --flags a,b      set story flags first (a clue the party has learned)
//   --tired          start with the party TIRED (sinceRest at the limit)
//   --keep N         Fate a member keeps back from rerolls (default: rules.fate.cheatDeath, so the member can still cheat death)
//   --no-reroll      never spend Fate on a reroll
//   --no-delve       never use an ability that comes back only once a delve
//   --run-at N       run (everyone guards, the first in order runs) once N members are down; default: nobody runs
//   --scene id:c1[,c2]  also run a scene path: open scene id, then take choice c1 (then c2, ...; the last repeats).
//                    It ends when --until flag is set, a fight is won, the scene closes, or the party is wiped.
//   --until flag     success flag for --scene
//   --teach id       the teaching fight (default: the first area encounter in map order)
//   --boss id        the climax guardian (default: the encounter that holds the foe with the most hp)
//   --audit          check every roll and every mark against the spec with independent code; print mismatches
//   --check          exit 1 if a target fails (teaching fight, wanderers, climax guardian band)
//   --json           machine-readable output
//
// The policy (the same every run): everyone who can hits the weakest awake foe. A spell, power or item is used when it
// obviously helps: healing when an ally has lost half, sleep and disables in round one, a fight buff in round one (not
// for trivial fights), a thrown item when two or more foes stand. A member who cannot fight and has nothing to use does
// nothing. A missed attack is rerolled while the member keeps --keep Fate. Death's door: stay up only if letting go would
// wipe the party. Nobody runs.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPack } from "./load.mjs";

const Crawl = createRequire(import.meta.url)("../engine/crawl.js");

// ---------------------------------------------------------------------------------------------
// arguments
function parseArgs(argv) {
  const o = { n: 1000, seed0: 1, enc: null, party: null, items: {}, flags: [], tired: false, keep: null, reroll: true, delve: true,
    scenes: [], runAt: null, until: null, teach: null, boss: null, audit: false, check: false, json: false, cap: 80, delveMin: 10 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === "--n") o.n = +next();
    else if (a === "--seed0") o.seed0 = +next();
    else if (a === "--enc") o.enc = next().split(",");
    else if (a === "--party") o.party = next().split(",");
    else if (a === "--items") next().split(",").forEach(p => { const [k, v] = p.split("="); o.items[k] = +(v ?? 1); });
    else if (a === "--flags") o.flags = next().split(",");
    else if (a === "--tired") o.tired = true;
    else if (a === "--keep") o.keep = +next();
    else if (a === "--no-reroll") o.reroll = false;
    else if (a === "--no-delve") o.delve = false;
    else if (a === "--run-at") o.runAt = +next();
    else if (a === "--scene") { const [id, ch] = next().split(":"); o.scenes.push({ id, choices: (ch || "").split(",").filter(Boolean) }); }
    else if (a === "--until") o.until = next();
    else if (a === "--teach") o.teach = next();
    else if (a === "--boss") o.boss = next();
    else if (a === "--audit") o.audit = true;
    else if (a === "--check") o.check = true;
    else if (a === "--json") o.json = true;
    else if (a === "--cap") o.cap = +next();
    else if (a.startsWith("--")) throw new Error("Unknown option " + a);
    else rest.push(a);
  }
  if (rest.length !== 1 || !(o.n > 0)) throw new Error("Usage: node sim.mjs <packdir> [options]  (see the top of this file)");
  o.dir = rest[0];
  return o;
}

// ---------------------------------------------------------------------------------------------
// small helpers on a pack and a state (read only; the engine owns the rules)
const roster = (pack, id) => pack.party.roster[id];
const isOse = pack => pack.rules.resolver === "ose";
const maxOf = (pack, m, t) => (isOse(pack) ? roster(pack, m.id).hp : roster(pack, m.id).tracks?.[t] ?? 3);
const isFull = (pack, m) => pack.rules.tracks.some(t => (m.marked[t.id] || 0) >= maxOf(pack, m, t.id));
const upNow = (pack, st) => st.party.filter(m => !m.down && !isFull(pack, m));
const foesNow = st => (st.fight ? st.foes[st.fight.enc] : []);
const alive = f => f.marked < f.hp && f.state !== "fled";
const left = f => f.hp - f.marked;
const effectsOf = x => [x.effects, ...Object.values(x.on || {})].filter(Boolean);
const hasVerb = (x, verb) => effectsOf(x).some(e => e[verb]);
const danger = (pack, m) => {
  const ts = pack.rules.tracks;
  if (isOse(pack)) return (m.marked.hp || 0) / maxOf(pack, m, "hp");
  return Math.max(...ts.map(t => ((m.marked[t.id] || 0) >= maxOf(pack, m, t.id) - 1 && (m.marked[t.id] || 0) > 0 ? 1 : 0)));
};
const needy = (pack, m) => !m.down && !m.dead && danger(pack, m) >= (isOse(pack) ? 0.5 : 1);

// ---------------------------------------------------------------------------------------------
// the start: a fresh default party on the map, light lit, then the engine starts the fight itself (through state.queued)
function placeFor(pack, scene) {
  // a cell inside the area that holds this encounter, else any floor cell of the first map that has a wander table
  const want = scene.enc;
  for (const [mid, map] of Object.entries(pack.maps)) {
    let area = Object.entries(map.areas || {}).find(([, a]) => a.encounter === want)?.[0];
    if (!area && (map.wander || []).some(w => w.encounter === want)) area = Object.keys(map.areas || {})[0];
    if (!area && scene.scene && Object.entries(map.areas || {}).some(([, a]) => a.enter === scene.scene || a.search === scene.scene)) area = Object.entries(map.areas).find(([, a]) => a.enter === scene.scene || a.search === scene.scene)[0];
    if (!area) continue;
    for (let y = 0; y < map.grid.length; y++) for (let x = 0; x < map.grid[y].length; x++) {
      const i = { ch: map.grid[y][x], ...(map.legend?.[map.grid[y][x]] || {}), ...(map.cells?.[x + "," + y] || {}) };
      if (i.area === area && !i.link && !i.water && !"#+=LS<>".includes(i.ch)) return { map: mid, x, y, facing: 0 };
    }
  }
  const [mid, map] = Object.entries(pack.maps)[0];
  for (let y = 0; y < map.grid.length; y++) for (let x = 0; x < map.grid[y].length; x++) if (map.grid[y][x] !== "#") return { map: mid, x, y, facing: 0 };
}
function lightParty(pack, st) {
  for (const id of pack.rules.clock.light.order) {
    const it = pack.items[id];
    if (!it?.light || !(st.items[id] > 0) || (it.light.requires && !(st.items[it.light.requires] > 0))) continue;
    st.items[id]--; if (!st.items[id]) delete st.items[id];
    st.light = { source: id, left: it.light.turns, stash: {} };
    return;
  }
}
function baseState(pack, scene, seed, o) {
  let st = Crawl.create(pack, { seed });
  const ids = o.party || pack.party.default;
  st = Crawl.step(pack, st, { t: "pick", ids }).state;
  st.scene = null; st.mode = "map"; st.log = [];
  st.pos = placeFor(pack, scene); st.prev = { ...st.pos };
  for (const [k, v] of Object.entries(o.items)) st.items[k] = (st.items[k] || 0) + v;
  lightParty(pack, st);
  for (const f of [...o.flags, ...(scene.flags || [])]) st.flags[f] = true;
  if (o.tired) st.sinceRest = pack.rules.clock.tired?.every ?? 0;
  return st;
}

// ---------------------------------------------------------------------------------------------
// the policy
function classify(x) {
  if (hasVerb(x, "heal")) return "heal";
  const cond = effectsOf(x).map(e => e.condition).find(Boolean);
  if (cond && cond.who === "foes" && cond.budget != null) return "sleep";
  if (cond && cond.who === "foe") return "disable";
  if (effectsOf(x).some(e => e.bonus && e.bonus.scope === "fight")) return "buff";
  if (hasVerb(x, "damage")) return "nuke";
  return null;
}
function decide(pack, st, v, o) {
  const foes = foesNow(st), live = foes.map((f, i) => ({ f, i })).filter(x => alive(x.f));
  const awake = live.filter(x => x.f.state !== "asleep");
  const order = [...(awake.length ? awake : live)].sort((a, b) => left(a.f) - left(b.f));
  const weakest = order[0]?.i;
  const round1 = v.fight.round === 0;
  const threat = live.reduce((a, x) => a + left(x.f), 0);
  const orders = [], used = { heal: false, sleep: false, disable: false };
  const needTargets = st.party.filter(m => needy(pack, m)).sort((a, b) => danger(pack, b) - danger(pack, a) || (b.marked.hp || 0) - (a.marked.hp || 0));
  const members = v.fight.members.slice().sort((a, b) => a.acts.includes("fight") - b.acts.includes("fight")); // idle members first
  for (const mv of members) {
    const m = st.party.find(x => x.id === mv.id);
    let o1 = null;
    const tryAb = (want, make) => {
      for (const aid of mv.abilities) {
        const a = pack.abilities[aid];
        if (classify(a) !== want) continue;
        if (a.per === "delve" && (!o.delve || threat < o.delveMin)) continue;
        o1 = make(aid, a); if (o1) return true;
      }
      return false;
    };
    const tryItem = (want, make) => {
      for (const iid of mv.items) {
        const it = pack.items[iid];
        if (classify(it.use) !== want) continue;
        o1 = make(iid, it); if (o1) return true;
      }
      return false;
    };
    if (needTargets.length && !used.heal) {
      const tgt = needTargets[0].id;
      if (tryAb("heal", aid => ({ member: m.id, act: "ability", ability: aid, target: tgt })) ||
          tryItem("heal", iid => ({ member: m.id, act: "item", item: iid, target: tgt }))) { used.heal = true; needTargets.shift(); }
    }
    if (!o1 && round1 && !used.sleep && awake.length >= 1) {
      tryAb("sleep", aid => { const sleepable = awake.filter(x => (pack.bestiary[x.f.id].hd ?? 1) <= 8); if (!sleepable.length) return null; used.sleep = true; return { member: m.id, act: "ability", ability: aid }; });
    }
    if (!o1 && round1 && !used.disable && awake.length >= 1) {
      tryAb("disable", aid => {
        const top = [...awake].sort((a, b) => (pack.bestiary[b.f.id].rating ?? left(b.f)) - (pack.bestiary[a.f.id].rating ?? left(a.f)))[0];
        if (left(top.f) < 5 || awake.length > 3) return null; // not worth an action against swarms or small foes
        used.disable = true; return { member: m.id, act: "ability", ability: aid, target: top.i };
      });
    }
    if (!o1 && round1) tryAb("buff", aid => ({ member: m.id, act: "ability", ability: aid }));
    if (!o1 && awake.length >= 2) {
      const idle = !mv.acts.includes("fight");
      if (idle || awake.length >= 3) tryItem("nuke", iid => ({ member: m.id, act: "item", item: iid }));
    }
    if (!o1 && mv.acts.includes("fight") && weakest != null) o1 = { member: m.id, act: "fight", target: weakest };
    if (o1) orders.push(o1);
  }
  return orders;
}
function doorCmd(pack, st) {
  const others = upNow(pack, st).length;
  return { t: others === 0 ? "cheat" : "letgo" };
}

// ---------------------------------------------------------------------------------------------
// the audit: every roll and mark checked against SPEC.md with code that does not call the engine's rules
const statMod = n => (n <= 3 ? -3 : n <= 5 ? -2 : n <= 8 ? -1 : n <= 12 ? 0 : n <= 15 ? 1 : n <= 17 ? 2 : 3);
const ladder = s => (s >= 3 ? "style" : s >= 1 ? "success" : s === 0 ? "tie" : "fail");
function parseDice(expr) {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ""));
  return m ? { n: +m[1] || 1, sides: +m[2], mod: +(m[3] || 0) } : { n: 0, sides: 0, mod: Number(expr) || 0 };
}
function auditStep(pack, before, cmd, events, after, A) {
  const R = pack.rules, ose = isOse(pack), enc = before.fight && pack.encounters[before.fight.enc];
  const bad = msg => { A.bad++; if (A.samples.length < 12) A.samples.push(`${msg} :: ${JSON.stringify(cmd).slice(0, 90)}`); };
  const good = () => { A.n++; };
  const chk = (cond, msg) => (cond ? good() : bad(msg));
  const tired = m => before.sinceRest >= (R.clock.tired?.every ?? Infinity) || m.cond.includes("tired");
  const tm = m => (tired(m) ? R.clock.tired?.mod ?? -1 : 0);
  const foes = before.fight ? before.foes[before.fight.enc] : [];
  // a buff ordered this round (a bonus effect) may land before the member's next roll; the state in `before` cannot know it
  const buffed = id => (cmd.orders || []).filter(x => x.member === id && x.act === "ability").flatMap(x => effectsOf(pack.abilities[x.ability]).map(e => e.bonus?.amount || 0)).reduce((a, b) => a + b, 0);
  const run = {}; // running marks per member and track, to know the room left when a clamp applies
  for (const m of before.party) run[m.id] = { ...m.marked };
  const room = (m, t) => (enc?.nonLethal ? maxOf(pack, m, t) - 1 : maxOf(pack, m, t)) - (run[m.id][t] || 0);
  const harmsAfter = (i) => { const out = []; for (let j = i + 1; j < events.length && events[j].k !== "roll"; j++) if (events[j].k === "harm") out.push(events[j]); return out; };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.k === "harm" && !String(e.who).startsWith("enemy:")) { const t = e.track; run[e.who][t] = (run[e.who][t] || 0) + e.amount; }
    if (e.k === "heal") run[e.who][e.track] = (run[e.who][e.track] || 0) - e.amount;
    if (e.k !== "roll") continue;
    const mem = before.party.find(m => m.id === e.who), foeIdx = String(e.who).startsWith("enemy:") ? +e.who.slice(6) : null;
    if (e.what === "morale") {
      const ml = pack.bestiary[foes[0].id].ml;
      chk(e.dice.length === 2 && e.dice.every(d => d >= 1 && d <= 6) && e.total === e.dice[0] + e.dice[1], "morale dice");
      chk(e.target === ml && (e.tier === "fail") === (e.total > ml), `morale ${e.total} vs ML ${ml} tier ${e.tier}`);
      continue;
    }
    if (ose) {
      if (mem && e.what === "attack") {
        const ch = roster(pack, mem.id), at = ch.attack, bonus = (mem.bonus?.next || 0) + (mem.bonus?.fight || 0);
        const want = (at.bonus || 0) + statMod(ch.stats[at.stat || "str"] ?? 10) + tm(mem) + bonus, d = e.dice[0];
        chk(e.mod === want, `${mem.id} to-hit mod ${e.mod}, spec ${want}`);
        chk(e.dice.length === 1 && d >= 1 && d <= 20 && e.total === d + e.mod, "d20 total");
        chk(foes.some(f => pack.bestiary[f.id].ac === e.target), `to-hit target ${e.target} is no foe AC`);
        chk((e.tier === "success") === (d === 20 || (d !== 1 && e.total >= e.target)), `hit ${d}+${e.mod}=${e.total} vs ${e.target} tier ${e.tier}`);
        A.rolls++;
      } else if (mem && e.what === "damage") {
        const ch = roster(pack, mem.id), dd = parseDice(ch.attack.damage), sum = e.dice.reduce((a, b) => a + b, 0);
        const wantMod = dd.mod + statMod(ch.stats[ch.attack.stat || "str"] ?? 10) + tm(mem);
        chk(e.dice.length === dd.n && e.dice.every(d => d >= 1 && d <= dd.sides), `${mem.id} damage dice ${JSON.stringify(e.dice)} vs ${ch.attack.damage}`);
        chk(e.mod === wantMod && e.total === Math.max(1, sum + e.mod), `${mem.id} damage mod ${e.mod} spec ${wantMod}, total ${e.total}`);
        const h = harmsAfter(i)[0];
        chk(h && String(h.who).startsWith("enemy:") && h.amount === e.total, "damage marked on the foe");
      } else if (foeIdx != null && e.what === "attack") {
        const at = pack.bestiary[foes[foeIdx].id].attack, d = e.dice[0];
        chk(e.mod === (at.bonus || 0) && e.total === d + e.mod && d >= 1 && d <= 20, "foe attack roll");
        chk(before.party.some(m => roster(pack, m.id).ac === e.target || roster(pack, m.id).ac + 2 === e.target), `foe target ${e.target} is no member AC (or AC+2)`);
        chk((e.tier === "success") === (e.total >= e.target), `foe hit ${e.total} vs ${e.target} tier ${e.tier}`);
        A.rolls++;
      } else if (foeIdx != null && e.what === "damage") {
        const at = pack.bestiary[foes[foeIdx].id].attack, dd = parseDice(at.damage), sum = e.dice.reduce((a, b) => a + b, 0);
        chk(e.dice.length === dd.n && e.dice.every(d => d >= 1 && d <= dd.sides) && e.total === sum + dd.mod, `foe damage ${at.damage} rolled ${JSON.stringify(e.dice)} total ${e.total}`);
        const h = harmsAfter(i)[0], victim = h && before.party.find(m => m.id === h.who);
        if (e.total > 0 && h) chk(!!victim && h.amount === Math.min(e.total, room(victim, h.track)), `foe damage ${e.total} marked ${h.amount} on ${h.who}`);
      }
    } else if (e.dice.length === 4) {
      const sum = e.dice.reduce((a, b) => a + b, 0);
      chk(e.dice.every(d => d >= -1 && d <= 1) && e.total === sum + e.mod, "4dF total");
      chk(e.tier === ladder(e.total - e.target), `ladder ${e.total} vs ${e.target} gave ${e.tier}`);
      const shifts = e.total - e.target, hs = harmsAfter(i);
      if (mem && e.what === "attack") {
        const ch = roster(pack, mem.id), bonus = (mem.bonus?.next || 0) + (mem.bonus?.fight || 0);
        chk([0, buffed(mem.id)].some(x => e.mod === (ch.stats[ch.attack.stat] || 0) + tm(mem) + bonus + x), `${mem.id} attack mod ${e.mod}`);
        chk(foes.some(f => pack.bestiary[f.id].rating === e.target), "attack target is a foe rating");
        const onFoe = hs.filter(h => String(h.who).startsWith("enemy:"));
        if (e.tier === "success" || e.tier === "style") chk(onFoe.length === 1 && onFoe[0].amount === Math.max(1, shifts), `attack ${e.tier} shifts ${shifts} marked ${onFoe.map(h => h.amount)}`);
        else if (e.tier === "tie") {
          chk(onFoe.length === 1 && onFoe[0].amount === 1, "tie marks the foe once");
          const ct = ch.attack.costTrack || R.tracks[0].id, self = hs.filter(h => h.who === mem.id);
          chk(room(mem, ct) > 0 ? self.length === 1 && self[0].track === ct && self[0].amount === 1 : self.length === 0, "tie costs the attacker one box on costTrack");
        }
        else chk(onFoe.length === 0, "fail marks nothing");
        A.rolls++;
      } else if (mem && e.what === "defend") {
        const rating = e.target, who = hs.filter(h => h.who === mem.id), foe = hs.filter(h => String(h.who).startsWith("enemy:"));
        // guarding adds 2 to the defender's roll (SPEC section 4); the rating is never raised. A member with no order may or may not guard.
        const ord = (cmd.orders || []).find(x => x.member === mem.id), gs = ord ? (ord.act === "guard" ? [2] : [0]) : [0, 2];
        chk(gs.some(g => [0, buffed(mem.id)].some(x => e.mod === (roster(pack, mem.id).stats[R.combat.defense] || 0) + tm(mem) + ((mem.bonus?.next || 0) + (mem.bonus?.fight || 0)) + x + g)), `${mem.id} defend mod ${e.mod}`);
        chk(foes.some(f => pack.bestiary[f.id].attack.rating === e.target), `defend target ${e.target} is no foe attack rating`);
        const tracks = foes.filter(f => alive(f)).map(f => pack.bestiary[f.id].attack.track || R.tracks[0].id);
        if (e.tier === "style") chk(foe.length === 1 && foe[0].amount === 1 && who.length === 0, "defend style marks the foe once");
        else if (e.tier === "success") chk(who.length === 0 && foe.length === 0, "defend success: no harm");
        else if (e.tier === "tie") chk(who.length <= 1 && (who[0]?.amount ?? 1) === 1, "defend tie marks 1");
        else chk(who.length === 1 ? who[0].amount === Math.min(-shifts, room(mem, who[0].track)) : tracks.some(t => room(mem, t) <= 0), `defend fail shifts ${shifts} marked ${who.map(h => h.amount)}`);
        A.rolls++;
      }
    }
  }
  // the marks in the state are the marks in the events, and never above the box count
  if (cmd.t !== "cheat" && cmd.t !== "letgo") {
    for (const m of after.party) {
      const b = before.party.find(x => x.id === m.id);
      if (!b) continue;
      for (const t of R.tracks) {
        const sumH = events.filter(e => e.k === "harm" && e.who === m.id && e.track === t.id).reduce((a, e) => a + e.amount, 0);
        const sumHeal = events.filter(e => e.k === "heal" && e.who === m.id && e.track === t.id).reduce((a, e) => a + e.amount, 0);
        chk((m.marked[t.id] || 0) - (b.marked[t.id] || 0) === sumH - sumHeal, `${m.id} ${t.id}: ${b.marked[t.id] || 0} -> ${m.marked[t.id] || 0}, events say +${sumH} -${sumHeal}`);
        chk((m.marked[t.id] || 0) <= maxOf(pack, m, t.id), `${m.id} ${t.id} over its boxes`);
        if (enc?.nonLethal && (b.marked[t.id] || 0) < maxOf(pack, m, t.id)) chk((m.marked[t.id] || 0) <= maxOf(pack, m, t.id) - 1, "non-lethal fight filled a track");
      }
    }
    const fa = after.fight ? after.foes[after.fight.enc] : null;
    if (fa && foes.length === fa.length) fa.forEach((f, i) => { const sumF = events.filter(e => e.k === "harm" && e.who === "enemy:" + i).reduce((a, e) => a + e.amount, 0); chk(f.marked - foes[i].marked === sumF, `foe ${i} marks ${foes[i].marked} -> ${f.marked}, events +${sumF}`); });
  }
}

// ---------------------------------------------------------------------------------------------
// one run
function newRec(o) { return { tap: o && o.tap, rounds: 0, marks: 0, down: 0, broke: false, result: null, wiped: false, refusal: null, tries: 0, fights: 0, success: false }; }
function stepRec(pack, st, cmd, rec, A) {
  const r = Crawl.step(pack, st, cmd);
  const ref = r.events.find(e => e.k === "refuse");
  if (ref) { rec.refusal = `${JSON.stringify(cmd).slice(0, 100)} -> ${ref.text}`; return st; }
  if (A) auditStep(pack, st, cmd, r.events, r.state, A);
  if (rec.tap) rec.tap(cmd, r.events, st, r.state);
  for (const e of r.events) {
    if (e.k === "harm" && !String(e.who).startsWith("enemy:")) rec.marks += e.amount;
    else if (e.k === "down") rec.down++;
    else if (e.k === "log" && e.text === "The rest flee.") rec.broke = true;
    else if (e.k === "fight" && e.phase === "start") rec.fights++;
    else if (e.k === "fight" && e.phase === "end") rec.result = e.result;
    else if (e.k === "ending") rec.wiped = true;
  }
  return r.state;
}
function fightLoop(pack, st, o, rec, A) {
  const keep = o.keep ?? pack.rules.fate.cheatDeath;
  let guard = 0;
  while ((st.mode === "fight" || st.mode === "deathDoor") && !rec.refusal && guard++ < o.cap * 4) {
    if (st.mode === "deathDoor") { st = stepRec(pack, st, doorCmd(pack, st), rec, A); continue; }
    if (rec.rounds >= o.cap) break;
    const v = Crawl.view(pack, st);
    let orders;
    if (o.runAt != null && st.party.filter(m => m.down || isFull(pack, m)).length >= o.runAt) {
      const runner = st.order.find(id => upNow(pack, st).some(m => m.id === id));
      orders = v.fight.members.map(mv => ({ member: mv.id, act: mv.id === runner ? "run" : "guard" }));
    } else orders = decide(pack, st, v, o);
    st = stepRec(pack, st, { t: "orders", orders }, rec, A);
    rec.rounds++;
    if (st.mode === "fight" && o.reroll && !rec.refusal) {
      const lm = st.fight.lastMiss, m = lm && st.party.find(x => x.id === lm.member);
      if (m && Crawl.view(pack, st).fight.canReroll && m.fate - pack.rules.fate.reroll >= keep) st = stepRec(pack, st, { t: "reroll" }, rec, A);
    }
  }
  return st;
}
function runFight(pack, sc, seed, o, A) {
  const rec = newRec(o);
  let st = baseState(pack, sc, seed, o);
  st.queued = sc.enc;
  st = stepRec(pack, st, { t: "turn", dir: "left" }, rec, A);
  if (st.mode !== "fight") { rec.refusal = rec.refusal || "fight did not start: mode " + st.mode; return rec; }
  st = fightLoop(pack, st, o, rec, A);
  rec.success = rec.result === "win";
  rec.wiped = st.mode === "ending";
  return rec;
}
function runScene(pack, sc, seed, o, A) {
  const rec = newRec(o);
  let st = baseState(pack, sc, seed, o);
  st.mode = "scene"; st.scene = { id: sc.scene, said: [], taken: [], from: "map", gate: false };
  for (let t = 0; t < 14 && !rec.refusal; t++) {
    const id = sc.choices[Math.min(t, sc.choices.length - 1)];
    st = stepRec(pack, st, { t: "choose", id }, rec, A); rec.tries++;
    if (st.mode === "fight" || st.mode === "deathDoor") { st = fightLoop(pack, st, o, rec, A); if (st.mode === "ending") break; }
    if (sc.until && st.flags[sc.until]) { rec.success = true; break; }
    if (st.mode === "ending") break;
    if (st.mode !== "scene") { rec.success = !sc.until && (rec.result === "win" || rec.result == null); break; }
  }
  rec.wiped = st.mode === "ending";
  if (rec.wiped) rec.success = false;
  return rec;
}

// ---------------------------------------------------------------------------------------------
// the encounters to run, and what each one is
function plan(pack, o) {
  const wander = new Set(Object.values(pack.maps).flatMap(m => (m.wander || []).map(w => w.encounter)));
  const areaEnc = [];
  for (const map of Object.values(pack.maps)) for (const a of Object.values(map.areas || {})) if (a.encounter) areaEnc.push(a.encounter);
  const heaviest = Object.entries(pack.encounters).filter(([id]) => !wander.has(id)).map(([id, e]) => [id, Math.max(...e.foes.map(f => (f.hp ? Math.max(...f.hp) : (pack.bestiary[f.id].hp?.[0] ?? pack.bestiary[f.id].stress ?? 0))))]).sort((a, b) => b[1] - a[1]);
  const teach = o.teach || areaEnc[0], boss = o.boss || heaviest[0]?.[0];
  const rows = [];
  for (const id of o.enc || Object.keys(pack.encounters)) {
    const e = pack.encounters[id];
    if (!e) throw new Error("No such encounter: " + id);
    const role = id === teach ? "teach" : id === boss ? "boss" : wander.has(id) ? "wander" : "keyed";
    const first = typeof e.first === "object" ? e.first : null;
    rows.push({ key: id, enc: id, role, nonLethal: !!e.nonLethal, flags: [], note: first ? `foes ${first.else === "foes" ? "first" : "second"} unless ${first.ifFlag}` : "" });
    if (first && !o.flags.includes(first.ifFlag)) rows.push({ key: `${id} +${first.ifFlag}`, enc: id, role: role === "teach" ? "teach+" : role, nonLethal: !!e.nonLethal, flags: [first.ifFlag], note: "" });
  }
  return { rows, teach, boss };
}
function summarise(recs) {
  const n = recs.length, sum = f => recs.reduce((a, r) => a + f(r), 0), pct = f => (100 * recs.filter(f).length) / n;
  const refused = recs.find(r => r.refusal);
  return {
    n, win: pct(r => r.success), brk: pct(r => r.broke), rounds: sum(r => r.rounds) / n, marks: sum(r => r.marks) / n, down: sum(r => r.down) / n,
    wipe: pct(r => r.wiped), anyDown: pct(r => r.down > 0), fled: pct(r => r.result === "flee"), stall: pct(r => !r.success && !r.wiped && !r.refusal && r.result !== "flee"), tries: sum(r => r.tries) / n, fights: sum(r => r.fights) / n,
    refusals: recs.filter(r => r.refusal).length, firstRefusal: refused?.refusal || null,
  };
}
function verdict(row, s) {
  const bad = [], warn = [];
  if (s.refusals) bad.push(`policy refused ${s.refusals}x`);
  if (row.role === "teach" || row.role === "teach+") { if (s.win < 95) bad.push("win < 95"); if (s.wipe > 1) bad.push("wipe > 1"); }
  else if (row.role === "wander") { if (row.nonLethal ? s.wipe > 0 || s.anyDown > 0 : s.wipe > 2) bad.push(row.nonLethal ? "non-lethal hurt someone down" : "wipe > 2"); }
  else if (row.role === "boss") { if (s.win < 40 || s.win > 75) bad.push("win outside 40-75"); }
  else if (s.wipe >= 25) bad.push("wipe >= 25"); else if (s.wipe >= 10) warn.push("wipe >= 10");
  return { bad, warn };
}

// ---------------------------------------------------------------------------------------------
function main() {
  const o = parseArgs(process.argv.slice(2));
  const pack = loadPack(o.dir);
  const { rows, teach, boss } = plan(pack, o);
  const A = o.audit ? { n: 0, bad: 0, rolls: 0, samples: [] } : null;
  const out = { pack: pack.id, resolver: pack.rules.resolver, n: o.n, seed0: o.seed0, options: { tired: o.tired, keep: o.keep ?? pack.rules.fate.cheatDeath, reroll: o.reroll, delve: o.delve, items: o.items, flags: o.flags, party: o.party || pack.party.default }, teach, boss, fights: [], scenes: [] };
  let failures = 0;
  for (const row of rows) {
    const recs = [];
    for (let i = 0; i < o.n; i++) recs.push(runFight(pack, row, o.seed0 + i, o, A));
    const s = summarise(recs), v = verdict(row, s);
    failures += v.bad.length;
    out.fights.push({ ...row, ...s, bad: v.bad, warn: v.warn });
  }
  for (const sc of o.scenes) {
    const recs = [];
    const row = { key: `scene ${sc.id}:${sc.choices.join(",")}${o.until ? " until " + o.until : ""}`, scene: sc.id, choices: sc.choices, until: o.until, flags: [], role: "scene" };
    for (let i = 0; i < o.n; i++) recs.push(runScene(pack, row, o.seed0 + i, o, A));
    out.scenes.push({ ...row, ...summarise(recs) });
  }
  if (A) out.audit = { checks: A.n, mismatches: A.bad, samples: A.samples };
  if (o.json) console.log(JSON.stringify(out, null, 1));
  else print(out, o);
  if (A && A.bad) process.exitCode = 2;
  else if (o.check && failures) process.exitCode = 1;
}

const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
function print(out, o) {
  const unit = out.resolver === "ose" ? "hp" : "boxes";
  console.log(`${out.pack} (${out.resolver}) · ${out.n} seeds from ${out.seed0} · party ${out.options.party.join(", ")} · keep ${out.options.keep} Fate from rerolls${out.options.tired ? " · TIRED" : ""}${Object.keys(out.options.items).length ? " · items " + JSON.stringify(out.options.items) : ""}${out.options.flags.length ? " · flags " + out.options.flags.join(",") : ""}`);
  console.log(`teaching fight: ${out.teach} · climax guardian: ${out.boss} · marks are ${unit} marked on the party, all sources\n`);
  const w = Math.max(10, ...out.fights.map(r => r.key.length));
  console.log("encounter".padEnd(w), "role".padEnd(7), " win%", "break%", "rounds", " marks", " down", "wipe%", "any-down%", ...(o.runAt != null ? ["fled%"] : []), "verdict");
  for (const r of out.fights) {
    const flag = r.bad.length ? "FAIL " + r.bad.join("; ") : r.warn.length ? "warn " + r.warn.join("; ") : "ok";
    console.log(r.key.padEnd(w), r.role.padEnd(7), f1(r.win).padStart(5), f1(r.brk).padStart(6), f2(r.rounds).padStart(6), f2(r.marks).padStart(6), f2(r.down).padStart(5), f1(r.wipe).padStart(5), f1(r.anyDown).padStart(9), ...(o.runAt != null ? [f1(r.fled).padStart(5)] : []), flag);
    if (r.stall) console.log("   ", f1(r.stall) + "% hit the round cap (stall)");
    if (r.firstRefusal) console.log("    first refusal:", r.firstRefusal);
  }
  if (out.scenes.length) {
    console.log("\nscene paths (success = the --until flag, or a won fight; tries = choices taken)");
    for (const r of out.scenes) console.log(" ", r.key, `· success ${f1(r.win)}% · wipe ${f1(r.wipe)}% · tries ${f2(r.tries)} · marks ${f2(r.marks)} · down ${f2(r.down)} · fights started ${f2(r.fights)}${r.firstRefusal ? " · REFUSED " + r.firstRefusal : ""}`);
  }
  if (out.audit) {
    console.log(`\naudit: ${out.audit.checks} checks, ${out.audit.mismatches} mismatches`);
    out.audit.samples.forEach(s => console.log("  ", s));
  }
  console.log(`\ntargets: teach win >= 95 and wipe <= 1; wanderers wipe <= 2 (non-lethal: nobody down); boss win 40-75; other fights warn at wipe >= 10 and fail at >= 25.\nStandard error at ${out.n} runs: about ${f1(100 * Math.sqrt(0.25 / out.n))} points at 50%, ${f1(100 * Math.sqrt(0.01 * 0.99 / out.n))} at 1%.`);
}

export { parseArgs, plan, baseState, runFight, runScene, summarise };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(e.message); process.exitCode = 2; }
}
