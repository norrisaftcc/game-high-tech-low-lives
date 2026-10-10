/* stub-engine.js: a development aid for the view. NOT the engine.
   A fake Crawl with the same API (create, step, view, version). It reads the pack for
   names and text, runs a small hand-made map, and returns view models for every mode.
   Extra commands that only the stub knows (used by tests, never by view.js):
     {t:"stubmode", mode, ...}   jump to a mode: roster hub map scene fight deathDoor ending
     {t:"stubat", x, y, facing, dark, kind}   put the party on the stub map
*/
(function (root) {
  "use strict";
  const GRID = [
    "###########",
    "#....#~~~~#",
    "#.##.#~~~~#",
    "#.#>.+....#",
    "#.##.###.##",
    "#....=...L#",
    "###########",
  ];
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const clone = o => JSON.parse(JSON.stringify(o));
  const KIND = { "#": "wall", ".": "open", "+": "door", "=": "stuck", "L": "locked", ">": "stairs", "<": "stairs", "~": "water" };
  const cellAt = (x, y) => (GRID[y] && GRID[y][x]) || "#";
  const kindAt = (x, y) => KIND[cellAt(x, y)] || "open";

  function create(pack, opts) {
    const seed = (opts && opts.seed) | 0;
    return {
      v: 1, seed, rng: seed, mode: "roster", turn: 0, sinceRest: 0,
      pos: { map: "stub", x: 1, y: 1, facing: 2 },
      dark: false, light: { label: "Torch", left: 5 },
      marks: {}, down: {}, cond: {}, fate: {}, order: pack.party.default.slice(), gold: 12,
      scene: null, fight: null, ending: null, round: 0, log: ["You wake. The air is cold."],
      seen: { "1,1": 1 }, deadId: null, gate: true,
    };
  }

  function members(pack, s) {
    return s.order.map((id, i) => {
      const m = pack.party.roster[id];
      const fate = pack.rules.resolver === "fate4df";
      const tracks = pack.rules.tracks.map(t => ({
        id: t.id, label: t.label,
        max: fate ? ((m.tracks && m.tracks[t.id]) || 3) : (m.hp || 4),
        marked: (s.marks[id] && s.marks[id][t.id]) || 0,
      }));
      const abilities = (m.abilities || []).map(a => ({
        id: a, name: (pack.abilities[a] || {}).name || a, left: 1, usable: (pack.abilities[a] || {}).kind !== "fate",
      }));
      return {
        id, name: m.name, title: m.title, rank: i < 2 ? "front" : "back",
        down: !!s.down[id], dead: false, fate: s.fate[id] == null ? (m.fate || 3) : s.fate[id],
        tracks, cond: s.cond[id] || [], abilities,
      };
    });
  }

  function ahead(s) {
    const { x, y, facing } = s.pos;
    const f = facing, r = (facing + 1) % 4, l = (facing + 3) % 4;
    const rows = [];
    let blocked = false;
    for (let d = 0; d < 4; d++) {
      const cx = x + DX[f] * d, cy = y + DY[f] * d;
      const L = kindAt(cx + DX[l], cy + DY[l]);
      const C = d === 0 ? "open" : kindAt(cx, cy);
      const R = kindAt(cx + DX[r], cy + DY[r]);
      rows.push(blocked ? ["wall", "wall", "wall"] : [L, C, R]);
      if (d > 0 && C !== "open" && C !== "water") blocked = true;
      if (d === 0 && s.forceFront) { rows[0][1] = "open"; }
    }
    if (s.dark) return rows.map((row, d) => row.map((k, i) => (d === 0 && i === 1 ? k : "dark")));
    return rows;
  }

  function automap(s) {
    const rows = GRID.map((row, y) => row.split("").map((ch, x) => (s.seen[x + "," + y] || (Math.abs(x - s.pos.x) <= 1 && Math.abs(y - s.pos.y) <= 1) ? ch : " ")).join(""));
    return { w: GRID[0].length, h: GRID.length, rows };
  }

  function hud(pack, s) {
    return {
      turn: s.turn, minutes: s.turn * 10,
      light: s.dark ? null : s.light, dark: !!s.dark, tired: s.sinceRest >= 6, gold: s.gold,
      area: s.mode === "map" || s.mode === "fight" ? { key: "A", name: "The Yard" } : null,
    };
  }

  function view(pack, s) {
    const v = {
      mode: s.mode, hud: hud(pack, s), party: s.mode === "roster" ? [] : members(pack, s),
      map: null, scene: null, fight: null, hub: null, roster: null, ending: null, log: s.log.slice(-50),
    };
    if (s.mode === "map" || s.mode === "fight" || s.mode === "deathDoor") {
      const a = ahead(s), c = kindAt(s.pos.x + DX[s.pos.facing], s.pos.y + DY[s.pos.facing]);
      v.map = {
        id: "stub", title: "The Old Cellar", x: s.pos.x, y: s.pos.y, facing: s.pos.facing, ahead: a,
        can: { forward: c === "open" || c === "water" || c === "door" || c === ">", back: true, left: true, right: true,
          act: ["door", "stuck", "locked", "stairs"].includes(c), search: true, listen: ["door", "stuck", "locked"].includes(c), rest: true },
        automap: automap(s),
      };
    }
    if (s.mode === "scene") {
      const ev = pack.events[s.scene.id] || { title: s.scene.id, text: [], choices: [] };
      const ch = ev.choices.filter(c => !(c.once && s.scene.taken.includes(c.id))).map(c => ({
        id: c.id, text: c.text, mode: c.mode,
        enabled: !(s.scene.disable && c.mode === "fate"), reason: s.scene.disable && c.mode === "fate" ? "No one has this left." : "",
      }));
      if (!ev.noLeave && s.scene.from === "map") ch.push({ id: "leave", text: (pack.theme.labels || {}).leave || "Step back", mode: "plan", enabled: true, reason: "" });
      const hasPlan = ch.some(c => c.mode === "plan"), hasAct = ch.some(c => c.mode === "act");
      v.scene = { id: s.scene.id, title: ev.title, text: ev.text, said: s.scene.said, choices: ch, gate: hasPlan && hasAct };
    }
    if (s.mode === "fight") {
      const f = s.fight;
      v.fight = {
        round: f.round,
        foes: f.foes.map((x, i) => ({ i, name: x.name, state: x.state, hp: x.hp })),
        members: v.party.filter(m => !m.down).map(m => ({
          id: m.id, acts: f.noRun ? ["fight", "ability", "item", "guard"] : ["fight", "ability", "item", "guard", "run"],
          abilities: m.abilities.filter(a => a.usable).map(a => ({ id: a.id, name: a.name, left: a.left })),
          items: [{ id: "torch", name: "Torch", count: 2 }, { id: "oil-flask", name: "Oil flask", count: 1 }],
        })),
        canReroll: !!f.canReroll, canRun: !f.noRun,
      };
    }
    if (s.mode === "hub") {
      const h = pack.hub;
      v.hub = { title: h.title, text: h.text, places: clone(h.places), report: Object.values((h.report || {}).lines || {}).slice(0, 2) };
    }
    if (s.mode === "roster") {
      const stats = pack.rules.stats;
      v.roster = {
        need: pack.rules.party.size,
        members: Object.entries(pack.party.roster).map(([id, m]) => ({
          id, name: m.name, title: m.title, text: m.text, npc: !!m.npc,
          stats: stats.map(st => ({ id: st.id, label: st.label, value: (m.stats || {})[st.id] })),
          card: m.oseLine || (m.class + (m.ac ? " · AC " + m.ac + " · HP " + m.hp : "")),
        })),
      };
    }
    if (s.mode === "deathDoor") v.door = { who: s.order[0], cost: pack.rules.fate.cheatDeath };
    if (s.mode === "ending" || s.mode === "deathDoor") {
      if (s.mode === "ending") {
        const e = pack.endings[s.ending] || { title: "The End", kind: "back", text: ["It is done."] };
        v.ending = { id: s.ending, title: e.title, kind: e.kind, text: e.text };
      }
    }
    return v;
  }

  function step(pack, state, cmd) {
    const s = clone(state), ev = [];
    const say = t => { s.log.push(t); ev.push({ k: "log", text: t }); };
    const refuse = t => ({ state, events: [{ k: "refuse", text: t }] });
    const rnd = () => { s.rng = (s.rng + 0x6D2B79F5) >>> 0; return (s.rng % 1000) / 1000; };
    switch (cmd && cmd.t) {
      case "pick":
        if (s.mode !== "roster" || !Array.isArray(cmd.ids) || cmd.ids.length !== pack.rules.party.size) return refuse("Pick " + pack.rules.party.size + ".");
        s.order = cmd.ids.slice(); s.mode = "hub"; say("The party is chosen."); break;
      case "hub":
        if (s.mode !== "hub") return refuse("Not in town.");
        if (cmd.action === "go") { s.mode = "scene"; s.scene = { id: "gate", said: [], taken: [], from: "hub" }; }
        else if (cmd.action === "roster") { s.mode = "roster"; }
        else say("Done: " + cmd.action + (cmd.item ? " " + cmd.item : ""));
        break;
      case "turn": {
        if (s.mode !== "map") return refuse("Not now.");
        const d = cmd.dir === "left" ? 3 : cmd.dir === "right" ? 1 : 2;
        s.pos.facing = (s.pos.facing + d) % 4; ev.push({ k: "turn" }); break;
      }
      case "move": {
        if (s.mode !== "map") return refuse("Not now.");
        const off = { forward: 0, right: 1, back: 2, left: 3 }[cmd.dir];
        const f = (s.pos.facing + off) % 4;
        const nx = s.pos.x + DX[f], ny = s.pos.y + DY[f], k = kindAt(nx, ny);
        if (k === "wall" || k === "stuck" || k === "locked" || k === "stairs") { ev.push({ k: "bump", text: "Stone. Cold, and wet." }); s.log.push("Stone. Cold, and wet."); break; }
        s.pos.x = nx; s.pos.y = ny; s.seen[nx + "," + ny] = 1; ev.push({ k: "move" });
        s.turn++; s.sinceRest++; ev.push({ k: "tick", turn: s.turn });
        break;
      }
      case "act": if (s.mode !== "map") return refuse("Not now."); say("You push. Nothing gives."); break;
      case "search": say("You search. Dust."); s.turn++; ev.push({ k: "tick", turn: s.turn }); break;
      case "listen": say("You hear nothing."); ev.push({ k: "roll", who: "fighter", what: "listen", dice: [4], mod: 0, total: 4, target: 1, tier: "fail" }); break;
      case "rest": say("You rest."); s.turn++; s.sinceRest = 0; break;
      case "use": say((cmd.member || "?") + " uses " + (cmd.ability || cmd.item) + "."); break;
      case "order": s.order = cmd.ids.slice(); break;
      case "choose": {
        if (s.mode !== "scene") return refuse("No scene.");
        if (cmd.id === "leave" || cmd.id === "stay" || cmd.id === "ok" || cmd.id === "back") { s.mode = s.scene.from === "hub" ? "hub" : "map"; s.scene = null; break; }
        if (cmd.id === "go") { s.mode = "map"; s.scene = null; s.pos = { map: "stub", x: 1, y: 1, facing: 2 }; break; }
        s.scene.taken.push(cmd.id); s.scene.said.push("Swollen oak. It will take a shoulder."); break;
      }
      case "orders": {
        if (s.mode !== "fight") return refuse("No fight.");
        const f = s.fight; f.round++;
        for (const o of cmd.orders) {
          if (o.act === "run") { say("The party runs."); s.mode = "map"; s.fight = null; break; }
          if (o.act === "fight") {
            const who = o.member, hit = rnd() > 0.4;
            ev.push({ k: "roll", who, what: "attack", dice: [14], mod: 1, total: 15, target: 12, tier: hit ? "success" : "fail" });
            say(who + (hit ? " hits. 6 harm." : " misses."));
            const foe = f.foes[o.target || 0]; if (foe && hit) foe.state = "fled";
            f.canReroll = !hit;
          } else say(o.member + " " + o.act + ".");
        }
        if (s.fight && f.foes.every(x => x.state === "fled")) { say("The rats are gone."); s.mode = "map"; s.fight = null; }
        break;
      }
      case "reroll": s.fight.canReroll = false; say("Fate spent. You roll again."); break;
      case "cheat": s.mode = "map"; say("Fate holds."); break;
      case "letgo": s.mode = "map"; say("They go down."); break;
      case "restart": return { state: create(pack, { seed: s.seed }), events: [] };
      case "stubmode": {
        s.mode = cmd.mode;
        if (cmd.mode === "scene") s.scene = { id: cmd.id || "yard", said: cmd.said || [], taken: [], from: cmd.from || "map", disable: !!cmd.disable };
        if (cmd.mode === "fight") {
          const names = cmd.foes || [["Giant rat", ""], ["Giant rat", "asleep"], ["Giant rat", "fled"]];
          s.fight = { round: 1, canReroll: !!cmd.canReroll, noRun: !!cmd.noRun, foes: names.map(n => ({ name: n[0], state: n[1], hp: n[2] || "" })) };
        }
        if (cmd.mode === "ending") s.ending = cmd.id || "end-dead";
        if (cmd.marks) s.marks = cmd.marks;
        if (cmd.down) s.down = cmd.down;
        if (cmd.cond) s.cond = cmd.cond;
        if (cmd.log) { for (const l of cmd.log) s.log.push(l); }
        break;
      }
      case "stubat":
        s.pos = { map: "stub", x: cmd.x, y: cmd.y, facing: cmd.facing };
        s.dark = !!cmd.dark; s.seen[cmd.x + "," + cmd.y] = 1;
        for (let yy = 0; yy < GRID.length; yy++) for (let xx = 0; xx < GRID[0].length; xx++) if (cmd.seeAll) s.seen[xx + "," + yy] = 1;
        break;
      default: return refuse("Unknown command.");
    }
    if (s.log.length > 50) s.log = s.log.slice(-50);
    return { state: s, events: ev };
  }

  root.Crawl = { create, step, view, version: "0.1-stub" };
})(typeof globalThis !== "undefined" ? globalThis : this);
