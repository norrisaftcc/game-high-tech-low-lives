/* view.js: the screen. Reads window.PACK and window.Crawl. Holds {seed, commands} and the state.
   Calls Crawl.step and Crawl.view. Draws only the view model. Sends only commands from SPEC section 2. */
(function () {
  "use strict";

  const PACK = window.PACK;
  const Crawl = window.Crawl;
  const doc = document;
  const $ = id => doc.getElementById(id);

  // ---------------------------------------------------------------- labels and theme

  const DEFAULT_LABELS = {
    leave: "Leave", turn: "Turn", light: "Light", search: "Search", rest: "Rest", map: "Map",
    act: "Act", listen: "Listen", plan: "Plan", fate: "Fate",
    gate: "Planning is free. Acting costs time.",
    fight: "Fight", ability: "Ability", item: "Item", guard: "Guard", run: "Run", foes: "Foes",
    reroll: "Reroll", newGame: "New game", sure: "Tap again to erase the save", close: "Close",
    start: "Start", clear: "Clear", back: "Cancel", undo: "Undo", dark: "Dark", tired: "Tired", gold: "gold",
    report: "Report", deathDoor: "Near death", cheat: "Stay alive", letgo: "Let them die",
    moves: "Route", noMoves: "No route on this map yet.", up: "Move up", down: "Move down",
    abilities: "Abilities", order: "Marching order", chooseParty: "Choose the party",
    pickN: "Pick", ending: "The end", seed: "Seed", buy: "Buy", sell: "Sell", target: "Target",
    front: "Front rank", back2: "Back rank", downWord: "Down", deadWord: "Dead", asleep: "asleep", fled: "fled",
    endGood: "Success", endBack: "Survived", endDead: "Lost", lastRound: "Last round",
  };
  const THEME = PACK.theme || {};
  const LABELS = THEME.labels || {};
  const L = key => (LABELS[key] != null ? LABELS[key] : DEFAULT_LABELS[key] != null ? DEFAULT_LABELS[key] : key);

  const safeColor = s => (typeof s === "string" && /^[#a-zA-Z0-9(),.%\s/-]+$/.test(s) ? s : null);
  const safeFont = s => (typeof s === "string" ? s.replace(/[;{}<>\\]/g, "") : null);

  function applyTheme() {
    const pal = THEME.palette || {}, dk = THEME.paletteDark || pal;
    const vars = p => ["paper", "ink", "accent", "muted"].filter(k => safeColor(p[k])).map(k => `--${k}:${safeColor(p[k])}`).join(";");
    const f = THEME.fonts || {};
    const fonts = ["title", "body", "mono"].filter(k => safeFont(f[k])).map(k => `--font-${k}:${safeFont(f[k])}`).join(";");
    const css = `:root{${vars(pal)};${fonts}}\n@media (prefers-color-scheme: dark){:root{${vars(dk)}}}`;
    const st = doc.createElement("style");
    st.id = "theme";
    st.textContent = css;
    doc.head.appendChild(st);
    doc.documentElement.classList.toggle("caps", !!THEME.titleCaps);
  }

  const cssVar = name => getComputedStyle(doc.documentElement).getPropertyValue(name).trim() || "#000";
  const reducedMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------------------------------------------------------------- tiny DOM helper

  function h(tag, attrs, ...kids) {
    const e = doc.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "style") e.style.cssText = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (const c of kids.flat(2)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : doc.createTextNode(String(c)));
    }
    return e;
  }
  const clear = e => { while (e.firstChild) e.removeChild(e.firstChild); return e; };

  // ---------------------------------------------------------------- storage (every call in try/catch)

  const PREFIX = typeof PACK.storage === "string" && /^[a-z0-9.-]+$/.test(PACK.storage) ? PACK.storage : "crawl";
  const SAVE_KEY = PREFIX + "." + PACK.id;
  const GATE_KEY = SAVE_KEY + ".gate";
  let memGate = null;
  function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function storeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* no storage: fine */ } }
  function storeDel(key) { try { localStorage.removeItem(key); } catch (e) { /* no storage: fine */ } }

  function loadSave() {
    const raw = storeGet(SAVE_KEY);
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw);
      if (rec && Number.isFinite(rec.seed) && Array.isArray(rec.commands)) return rec;
    } catch (e) { /* bad save */ }
    return null;
  }
  const writeSave = () => storeSet(SAVE_KEY, JSON.stringify({ seed, commands }));

  // ---------------------------------------------------------------- game holder

  let seed = 0;
  let commands = [];
  let state = null;
  let vm = null;
  let trails = {};            // map id -> turtle atoms
  let logLines = [];          // { text, cls }
  let names = {};             // member id -> name
  let lastFoes = [];
  let seedFromUrl = null;

  const ui = {
    mapOpen: false, sheet: null, draft: null, draftKey: "", picks: null, picksMode: "",
    keys: [], newGameArmed: 0, bump: 0, round: null, toast: null,
  };

  const randomSeed = () => (Math.floor(Math.random() * 4294967296) >>> 0);

  function begin(newSeed) {
    seed = newSeed >>> 0;
    commands = [];
    trails = {};
    state = Crawl.create(PACK, { seed });
    ui.draft = null; ui.picks = null; ui.mapOpen = false; ui.sheet = null; ui.round = null; ui.toast = null;
    logEl.classList.remove("tall");
  }

  function mapIdOf(v) { return v && v.map ? v.map.id : null; }

  // Run one command through the engine. Returns the step result.
  function applyStep(cmd, replaying) {
    const before = Crawl.view(PACK, state);
    const r = Crawl.step(PACK, state, cmd);
    const events = r.events || [];
    const refusedOnly = events.length > 0 && events.every(e => e.k === "refuse");
    state = r.state;
    if (!(refusedOnly && !replaying)) commands.push(cmd);
    const after = Crawl.view(PACK, state);
    trailUpdate(cmd, events, mapIdOf(before), mapIdOf(after));
    vm = after;
    return { events, before, after };
  }

  function send(cmd) {
    const res = applyStep(cmd, false);
    writeSave();
    cacheNames();
    const lines = eventLines(res.events);
    const first = addLog(lines);
    // A round of a fight writes about nine lines. The sheet keeps them above the next orders; after the fight ends the log grows to show them.
    if (cmd.t === "orders") ui.round = lines.length ? lines : null;
    else if (cmd.t === "reroll" && lines.length) ui.round = (ui.round || []).concat(lines);
    if (!vm || vm.mode !== "fight") ui.round = null;
    ui.toast = cmd.t === "hub" && lines.length ? { action: cmd.action, text: lines[lines.length - 1].text } : null;
    const tall = lines.length > 3 && vm.mode !== "fight";
    logEl.classList.toggle("tall", tall);
    if (tall && first && logEl.firstChild) logEl.scrollTop = Math.max(0, first.offsetTop - logEl.firstChild.offsetTop - 2);
    if (res.events.some(e => e.k === "bump") && !reducedMotion()) shake();
    render();
    return { state, events: res.events };
  }

  function replayRecord(rec) {
    begin(rec.seed);
    try {
      for (const cmd of rec.commands) applyStep(cmd, true);
    } catch (e) {
      begin(rec.seed);
    }
    vm = Crawl.view(PACK, state);
    cacheNames();
    resetLog(vm.log || []);
    render();
  }

  function newGame() {
    storeDel(SAVE_KEY);
    begin(seedFromUrl != null ? seedFromUrl : randomSeed());
    vm = Crawl.view(PACK, state);
    cacheNames();
    resetLog(vm.log || []);
    writeSave();
    render();
  }

  function cacheNames() {
    if (!vm) return;
    for (const m of vm.party || []) names[m.id] = m.name;
    if (vm.fight && vm.fight.foes) lastFoes = vm.fight.foes;
  }

  // ---------------------------------------------------------------- log

  const logEl = $("log");

  function whoName(w) {
    if (typeof w === "string" && w.indexOf("enemy:") === 0) {
      const i = parseInt(w.slice(6), 10);
      const f = lastFoes.find(x => x.i === i) || lastFoes[i];
      return f ? f.name : "Foe " + (i + 1);
    }
    if (names[w]) return names[w];
    const r = PACK.party && PACK.party.roster && PACK.party.roster[w];
    return r ? r.name : String(w);
  }

  function fmtRoll(e) {
    const dice = Array.isArray(e.dice) ? e.dice : [];
    const fate = dice.length === 4 && dice.every(d => d === -1 || d === 0 || d === 1);
    const ds = fate ? dice.map(d => (d > 0 ? "+" : d < 0 ? "-" : "0")).join(" ") : dice.join("+");
    const mod = Number.isFinite(e.mod) ? e.mod : 0;
    const modText = mod !== 0 || dice.length > 1 || fate ? ` ${mod < 0 ? "-" : "+"}${Math.abs(mod)}` : "";
    const parts = [`${whoName(e.who)} ${e.what || ""}`.trim() + ` ${ds}${modText}`];
    if (e.total != null) parts[0] += ` = ${e.total}`;
    if (e.target != null) parts[0] += ` vs ${e.target}`;
    if (e.tier) parts.push(e.tier);
    return parts.join(" · ");
  }

  const ROLLISH = /\bd\d+\b|\b\dd\d+\b|4dF| = -?\d+/;
  function eventLines(events) {
    const out = [];
    events = events || [];
    const logs = events.filter(e => e.k === "log" && e.text).map(e => e.text);
    for (const e of events) {
      switch (e.k) {
        case "log": if (e.text) out.push({ text: e.text, cls: ROLLISH.test(e.text) && / = -?\d+/.test(e.text) ? "roll" : "" }); break;
        case "light": case "bump": if (e.text) out.push({ text: e.text, cls: "" }); break;
        case "refuse": if (e.text) out.push({ text: e.text, cls: "refuse" }); break;
        case "roll": {
          // The engine often logs the same roll as text. Show the roll event only when it did not.
          const nm = whoName(e.who);
          const told = logs.some(t => t.indexOf(nm) >= 0 && t.indexOf("= " + e.total) >= 0);
          if (!told) out.push({ text: fmtRoll(e), cls: "roll" });
          break;
        }
        default: break;
      }
    }
    return out;
  }

  function addLog(lines) {
    if (!lines.length) return null;
    let first = null;
    for (const l of lines) {
      logLines.push(l);
      const p = h("p", { class: l.cls || "", text: l.text });
      if (!first) first = p;
      logEl.appendChild(p);
    }
    while (logLines.length > 50) { logLines.shift(); if (logEl.firstChild) logEl.removeChild(logEl.firstChild); }
    logEl.scrollTop = logEl.scrollHeight;
    return first;
  }

  function resetLog(strings) {
    clear(logEl);
    logLines = [];
    addLog(strings.slice(-50).map(t => ({ text: String(t), cls: "" })));
  }

  // ---------------------------------------------------------------- turtle trail

  const mod360 = n => ((n % 360) + 360) % 360;
  function pushAtom(arr, atom) {
    arr.push(atom);
    for (;;) {
      const last = arr[arr.length - 1];
      if (last.t === "T" && last.n === 0) { arr.pop(); if (!arr.length) return; }
      const n = arr.length;
      if (n >= 2 && arr[n - 2].t === arr[n - 1].t) {
        const a = arr[n - 2], b = arr[n - 1];
        arr.splice(n - 2, 2, { t: a.t, n: a.t === "T" ? mod360(a.n + b.n) : a.n + b.n });
        continue;
      }
      if (arr[arr.length - 1].t === "T" && arr[arr.length - 1].n === 0) continue;
      break;
    }
    if (arr.length > 400) arr.shift();
  }

  function trailUpdate(cmd, events, mapBefore, mapAfter) {
    if (mapBefore) {
      const t = trails[mapBefore] || (trails[mapBefore] = []);
      const moved = events.some(e => e.k === "move"), turned = events.some(e => e.k === "turn");
      if (cmd.t === "move" && moved) {
        if (cmd.dir === "forward") pushAtom(t, { t: "F", n: 1 });
        else if (cmd.dir === "back") pushAtom(t, { t: "B", n: 1 });
        else if (cmd.dir === "left") { pushAtom(t, { t: "T", n: 270 }); pushAtom(t, { t: "F", n: 1 }); pushAtom(t, { t: "T", n: 90 }); }
        else if (cmd.dir === "right") { pushAtom(t, { t: "T", n: 90 }); pushAtom(t, { t: "F", n: 1 }); pushAtom(t, { t: "T", n: 270 }); }
      } else if (cmd.t === "turn" && turned) {
        pushAtom(t, { t: "T", n: cmd.dir === "left" ? 270 : cmd.dir === "right" ? 90 : 180 });
      }
    }
    if (mapAfter && mapAfter !== mapBefore && !trails[mapAfter]) trails[mapAfter] = [];
  }

  function turtleText(atoms) {
    return atoms.map(a => {
      if (a.t === "F") return "FORWARD " + a.n * 10;
      if (a.t === "B") return "BACK " + a.n * 10;
      return a.n > 180 ? "LEFT " + (360 - a.n) : "RIGHT " + a.n;
    });
  }

  // ---------------------------------------------------------------- the wireframe

  const wire = $("wire");
  const wctx = wire.getContext("2d");
  const DIRS = ["north", "east", "south", "west"];
  const SOLID = { wall: 1, door: 1, stuck: 1, locked: 1, stairs: 1 };

  function sizeCanvas(cv, cssW, cssH) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawWire(offsetX) {
    const rect = wire.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    if (W < 10 || H < 10) return;
    if (wire.width !== Math.round(W * (window.devicePixelRatio || 1)) || wire.height !== Math.round(H * (window.devicePixelRatio || 1))) sizeCanvas(wire, W, H);
    const ctx = wctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = cssVar("--ink"), paper = cssVar("--paper"), muted = cssVar("--muted");
    ctx.save();
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(offsetX || 0, 0);
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const map = vm && vm.map;
    const ahead = map && map.ahead;
    const dark = !!((vm && vm.hud && vm.hud.dark) || (ahead && ahead[1] && ahead[1][1] === "dark"));
    if (!ahead || !ahead.length) { ctx.restore(); return; }
    if (dark) {
      ctx.fillStyle = muted;
      ctx.font = `italic ${Math.round(W * 0.11)}px ${cssVar("--font-title")}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(L("dark"), W / 2, H / 2);
      ctx.restore();
      return;
    }
    const S = 1.08 * W, c = 0.5, cx = W / 2, cy = H / 2;
    const px = (X, z) => cx + (X * S) / (z + c);
    const py = (Y, z) => cy + (Y * S) / (z + c);
    const base = Math.max(1.6, W / 150);
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    const poly = (pts, close) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      if (close) ctx.closePath();
      ctx.stroke();
    };
    const P = (X, Y, z) => [px(X, z), py(Y, z)];
    const kindAt = (d, i) => (ahead[d] && ahead[d][i]) || "wall";

    // Floor hatching for water, on a floor patch from X0..X1, z0..z1.
    const hatch = (X0, X1, z0, z1) => {
      ctx.save();
      ctx.lineWidth = base * 0.7;
      for (let k = 1; k <= 3; k++) {
        const z = z0 + ((z1 - z0) * k) / 4;
        ctx.setLineDash([base * 3, base * 2.5]);
        line(P(X0, 0.5, z), P(X1, 0.5, z));
      }
      ctx.restore();
    };

    // A door frame on a side wall: between z0+.2 and z0+.8.
    const sideDoor = (X, z0, kind) => {
      const a = z0 + 0.22, b = z0 + 0.78;
      poly([P(X, 0.5, a), P(X, -0.25, a), P(X, -0.25, b), P(X, 0.5, b)], false);
      if (kind === "stuck") { line(P(X, 0.02, z0 + 0.1), P(X, 0.02, z0 + 0.9)); line(P(X, 0.14, z0 + 0.1), P(X, 0.14, z0 + 0.9)); }
      if (kind === "locked") poly([P(X, 0.0, z0 + 0.44), P(X, 0.0, z0 + 0.56), P(X, 0.14, z0 + 0.56), P(X, 0.14, z0 + 0.44)], true);
    };

    // A front face at depth z.
    const front = (z, kind) => {
      poly([P(-0.5, -0.5, z), P(0.5, -0.5, z), P(0.5, 0.5, z), P(-0.5, 0.5, z)], true);
      if (kind === "door" || kind === "stuck" || kind === "locked") {
        poly([P(-0.28, 0.5, z), P(-0.28, -0.3, z), P(0.28, -0.3, z), P(0.28, 0.5, z)], false);
        if (kind === "stuck") {
          poly([P(-0.4, 0.0, z), P(0.4, 0.0, z), P(0.4, 0.13, z), P(-0.4, 0.13, z)], true);
          line(P(-0.28, -0.1, z), P(0.28, 0.35, z));
        }
        if (kind === "locked") {
          poly([P(-0.07, 0.04, z), P(0.07, 0.04, z), P(0.07, 0.18, z), P(-0.07, 0.18, z)], true);
          const r = Math.abs(px(0.05, z) - px(0, z));
          ctx.beginPath(); ctx.arc(px(0, z), py(0.0, z), r, Math.PI, 0); ctx.stroke();
        }
        const kx = px(0.2, z), ky = py(0.12, z);
        if (kind === "door") { ctx.beginPath(); ctx.arc(kx, ky, Math.max(1.5, base * 0.7), 0, 7); ctx.fill(); }
      }
      if (kind === "stairs") {
        const pts = [];
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
          const X = -0.5 + i * (1 / steps), Y = 0.5 - i * (1 / steps);
          if (i === 0) pts.push(P(-0.5, 0.5, z));
          pts.push(P(X, i === 0 ? 0.5 : Y + 1 / steps, z));
          pts.push(P(X, Y, z));
        }
        poly(pts, false);
      }
    };

    let reached = true;
    for (let d = 0; d <= 3; d++) {
      const C = d === 0 ? "open" : kindAt(d, 1);
      ctx.globalAlpha = 1 - 0.13 * d;
      ctx.lineWidth = base * (1 - 0.1 * d);
      if (d > 0 && SOLID[C]) { front(d, C); reached = false; break; }
      for (const side of [-1, 1]) {
        const K = kindAt(d, side < 0 ? 0 : 2);
        const X = side * 0.5, z0 = d, z1 = d + 1;
        if (SOLID[K]) {
          poly([P(X, -0.5, z0), P(X, -0.5, z1), P(X, 0.5, z1), P(X, 0.5, z0)], true);
          if (K === "door" || K === "stuck" || K === "locked") sideDoor(X, z0, K);
          if (K === "stairs") {
            for (let i = 1; i <= 3; i++) { const z = z0 + i / 4; line(P(X, 0.5 - i * 0.12, z), P(X, 0.5, z)); }
          }
        } else {
          // Open to the side: jambs and the far edge of the opening.
          line(P(X, -0.5, z1), P(X, 0.5, z1));
          line(P(X, -0.5, z1), P(X + side * 0.45, -0.5, z1));
          line(P(X, 0.5, z1), P(X + side * 0.45, 0.5, z1));
          if (K === "water") hatch(X, X + side * 0.5, z0, z1);
        }
      }
      if (C === "water" || (d === 0 && kindAt(0, 1) === "water")) hatch(-0.5, 0.5, d, d + 1);
    }
    ctx.globalAlpha = 1;
    if (reached) {
      // The corridor runs on past what you can see.
      ctx.lineWidth = base * 0.6;
      ctx.setLineDash([base * 2, base * 3]);
      poly([P(-0.5, -0.5, 4), P(0.5, -0.5, 4), P(0.5, 0.5, 4), P(-0.5, 0.5, 4)], true);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function describeView() {
    const map = vm && vm.map;
    if (!map) return "No view.";
    const dir = DIRS[((map.facing % 4) + 4) % 4];
    const dark = (vm.hud && vm.hud.dark) || (map.ahead && map.ahead[1] && map.ahead[1][1] === "dark");
    if (dark) return `Facing ${dir}. ${L("dark")}.`;
    const a = map.ahead || [];
    let n = 0;
    for (let d = 1; d < a.length; d++) {
      const k = a[d][1];
      if (k === "open" || k === "water") n++;
      else return `Facing ${dir}. ${n ? n + (n === 1 ? " square" : " squares") + " open, then " : "Directly ahead: "}${k}.`;
    }
    return `Facing ${dir}. Open ahead.`;
  }

  function shake() {
    const start = performance.now();
    const tick = now => {
      const t = (now - start) / 160;
      if (t >= 1) { drawWire(0); return; }
      drawWire(Math.sin(t * Math.PI * 4) * 6 * (1 - t));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Swipes on the view.
  (function swipes() {
    let sx = 0, sy = 0, st = 0, id = null;
    wire.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; st = e.timeStamp; id = e.pointerId; });
    wire.addEventListener("pointerup", e => {
      if (id !== e.pointerId || !vm || vm.mode !== "map" || ui.mapOpen || ui.sheet) return;
      id = null;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28 || e.timeStamp - st > 900) return;
      if (Math.abs(dy) > Math.abs(dx)) send(dy < 0 ? { t: "move", dir: "forward" } : { t: "move", dir: "back" });
      else send({ t: "turn", dir: dx < 0 ? "left" : "right" });
    });
    wire.addEventListener("pointercancel", () => { id = null; });
  })();

  // ---------------------------------------------------------------- hud

  function renderHud() {
    const hud = $("hud");
    clear(hud);
    const hv = vm.hud || {};
    let area = PACK.title || "";
    if (hv.area) area = (hv.area.key ? hv.area.key + " · " : "") + hv.area.name;
    else if (vm.mode === "hub" && vm.hub) area = vm.hub.title;
    else if (vm.mode === "roster") area = PACK.title || "";
    else if (vm.mode === "ending" && vm.ending) area = L("ending");
    hud.appendChild(h("span", { class: "hud-area", text: area, title: area }));
    if (vm.mode === "roster" || vm.mode === "ending") return;
    if (hv.turn != null) hud.appendChild(h("span", { class: "chip", text: "T " + hv.turn, title: hv.minutes != null ? hv.minutes + " min" : null }));
    if (hv.dark) hud.appendChild(h("span", { class: "chip dark", text: L("dark") }));
    else if (hv.light) hud.appendChild(h("span", { class: "chip light", title: (hv.light.label || L("light")) + " " + hv.light.left, text: (hv.light.label || L("light")) + " " + hv.light.left }));
    if (hv.tired) hud.appendChild(h("span", { class: "chip warn", text: L("tired").toUpperCase() }));
    if (hv.gold != null) hud.appendChild(h("span", { class: "chip", text: hv.gold + " " + L("gold") }));
  }

  // ---------------------------------------------------------------- party cards

  const isOse = () => (PACK.rules && PACK.rules.resolver) !== "fate4df";

  function pips(tr) {
    const w = h("span", { class: "pips" });
    for (let i = 0; i < tr.max; i++) w.appendChild(h("span", { class: "pip" + (i < tr.marked ? " on" : "") }));
    return w;
  }

  function trackRow(tr, compact) {
    if (isOse()) {
      const cur = Math.max(0, tr.max - tr.marked);
      const pct = tr.max ? Math.round((cur / tr.max) * 100) : 0;
      return h("div", { class: "row" },
        h("span", { class: "lab", text: tr.label }),
        h("span", { class: "num", text: cur + "/" + tr.max }),
        h("span", { class: "bar" }, h("i", { style: `width:${pct}%` })));
    }
    return h("div", { class: "row" }, h("span", { class: "lab", text: tr.label }), pips(tr));
  }

  function renderParty() {
    const box = $("party");
    clear(box);
    const nowId = fightNowId();
    (vm.party || []).forEach(m => {
      const status = m.dead ? L("deadWord") : m.down ? L("downWord") : null;
      const cls = ["card", m.rank === "front" ? "front" : "back", m.down ? "down" : "", m.dead ? "dead" : "", nowId === m.id ? "now" : ""].filter(Boolean).join(" ");
      const trackText = (m.tracks || []).map(t => isOse() ? `${t.label} ${Math.max(0, t.max - t.marked)} of ${t.max}` : `${t.label} ${t.marked} of ${t.max} marked`).join(", ");
      const aria = `${m.name}, ${m.rank} rank. ${trackText}. Fate ${m.fate}.${m.cond && m.cond.length ? " " + m.cond.join(", ") + "." : ""}${status ? " " + status + "." : ""} Open abilities.`;
      const kids = [
        h("span", { class: "name" }, m.name),
        ...(m.tracks || []).map(t => trackRow(t)),
        h("div", { class: "row" },
          h("span", { class: "fate", text: L("fate") + " " + m.fate }),
          status ? h("span", { class: "tag", text: status }) : null,
          ...(m.cond || []).map(c => h("span", { class: "tag", text: c }))),
      ];
      box.appendChild(h("button", { type: "button", class: cls, "data-fk": "card:" + m.id, "aria-label": aria, onclick: () => openSheet(m.id) }, kids));
    });
  }

  // ---------------------------------------------------------------- controls: buttons and keys

  function actBtn(label, cmd, opts) {
    opts = opts || {};
    return h("button", {
      type: "button", class: "btn " + (opts.cls || ""), "data-fk": opts.fk,
      "aria-label": opts.aria, "aria-disabled": opts.off ? "true" : null,
      onclick: () => { if (typeof cmd === "function") cmd(); else send(cmd); },
    }, opts.word ? h("span", { class: "word" }, label) : label);
  }

  function renderThumbs(box) {
    const m = vm.map || { can: {} };
    const can = m.can || {};
    const g = h("div", { class: "thumbs", role: "group", "aria-label": "Move" });
    const arrow = (sym, aria, cmd, fk, off) => actBtn(sym, cmd, { cls: "arrow", aria, fk, off });
    const cell = (btn, row, col, span) => { btn.style.gridRow = row; btn.style.gridColumn = span ? `${col} / span ${span}` : String(col); return btn; };
    g.append(
      cell(arrow("↶", L("turn") + " left", { t: "turn", dir: "left" }, "t:tl"), 1, 1),
      cell(arrow("↑", "Move forward", { t: "move", dir: "forward" }, "t:f", can.forward === false), 1, 2),
      cell(arrow("↷", L("turn") + " right", { t: "turn", dir: "right" }, "t:tr"), 1, 3),
      cell(arrow("←", "Move left", { t: "move", dir: "left" }, "t:sl", can.left === false), 2, 1),
      cell(arrow("↓", "Move back", { t: "move", dir: "back" }, "t:b", can.back === false), 2, 2),
      cell(arrow("→", "Move right", { t: "move", dir: "right" }, "t:sr", can.right === false), 2, 3),
      cell(actBtn(L("act"), { t: "act" }, { cls: "primary", word: true, fk: "t:act", off: can.act === false }), 1, 4),
      cell(actBtn(L("search"), { t: "search" }, { word: true, fk: "t:search", off: can.search === false }), 1, 5),
      cell(actBtn(L("listen"), { t: "listen" }, { word: true, fk: "t:listen", off: can.listen === false }), 1, 6),
      cell(actBtn(L("rest"), { t: "rest" }, { word: true, fk: "t:rest", off: can.rest === false }), 2, 4),
      cell(actBtn(L("map"), () => openMap(), { word: true, fk: "t:map" }), 2, 5, 2),
    );
    g.children[6].classList.add("act-col");
    g.children[9].classList.add("act-col");
    box.appendChild(g);
  }

  function choiceBtn(index, text, o) {
    // o: { mode, enabled, reason, onclick, fk, tag }
    const mode = o.mode || "plan";
    const disabled = o.enabled === false;
    const kids = [
      o.tag ? h("span", { class: "mode", text: o.tag }) : null,
      index != null ? h("span", { class: "num", text: index + "." }) : null,
      h("span", { text }),
      disabled && o.reason ? h("span", { class: "reason", text: o.reason }) : null,
    ];
    return h("button", {
      type: "button", class: "choice " + mode + (o.cls ? " " + o.cls : ""), "data-fk": o.fk,
      "aria-disabled": disabled ? "true" : null,
      onclick: () => { if (!disabled) o.onclick(); },
    }, kids);
  }

  // ---------------------------------------------------------------- scene

  function gateLine(sc) {
    if (!sc || !sc.gate) return null;
    const seen = storeGet(GATE_KEY) || memGate;
    if (seen && seen !== sc.id) return null;
    if (!seen) { memGate = sc.id; storeSet(GATE_KEY, sc.id); }
    return L("gate");
  }

  function renderScenePanel(p) {
    const sc = vm.scene || {};
    p.append(h("h1", { class: "title", text: sc.title || "" }));
    (sc.text || []).forEach(t => p.append(h("p", { class: "read", text: t })));
    (sc.notes || []).forEach(t => p.append(h("p", { class: "note", text: t })));
    (sc.said || []).forEach(t => p.append(h("p", { class: "said", text: t })));
    const gate = gateLine(sc);
    if (gate) p.append(h("p", { class: "gate", text: gate }));
  }

  function renderSceneControls(box) {
    const sc = vm.scene || {};
    const wrap = h("div", { class: "choices" });
    (sc.choices || []).forEach((c, i) => {
      const mode = c.mode === "act" || c.mode === "fate" ? c.mode : "plan";
      const fn = () => send({ t: "choose", id: c.id });
      wrap.append(choiceBtn(i + 1, c.text, {
        mode, enabled: c.enabled !== false, reason: c.reason, onclick: fn, fk: "c:" + c.id, tag: L(mode),
      }));
      ui.keys.push(c.enabled !== false ? fn : null);
    });
    box.append(wrap);
  }

  // ---------------------------------------------------------------- hub

  function itemName(id) { const it = PACK.items && PACK.items[id]; return it && it.name ? it.name : id; }

  // Does a scene lead out of town? True if any path through its choices ends in a goto to a map.
  const exitCache = {};
  function reachesMap(sceneId) {
    if (sceneId in exitCache) return exitCache[sceneId];
    const seen = {}, todo = [sceneId];
    let found = false;
    const walk = o => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o.goto && typeof o.goto === "object") {
        if (o.goto.map) found = true;
        else if (o.goto.scene && !seen[o.goto.scene]) { seen[o.goto.scene] = 1; todo.push(o.goto.scene); }
      }
      for (const k of Object.keys(o)) if (k !== "goto") walk(o[k]);
    };
    while (todo.length && !found) { const def = PACK.events && PACK.events[todo.pop()]; if (def) walk(def.choices); }
    return (exitCache[sceneId] = found);
  }
  const hubActionDef = id => { for (const pl of (PACK.hub && PACK.hub.places) || []) for (const a of pl.actions || []) if (a.id === id) return a; return null; };

  function renderHubPanel(p) {
    const hb = vm.hub || {};
    if (ui.swap) { renderSwapPanel(p); return; }
    p.append(h("h1", { class: "title", text: hb.title || "" }));
    (Array.isArray(hb.text) ? hb.text : hb.text ? [hb.text] : []).forEach(t => p.append(h("p", { class: "read", text: t })));
    // Number keys reach the places' own actions. Stall rows are tap or Tab and Enter, so 1 to 9 always include the way out.
    const isStall = a => a.kind === "shop" && Array.isArray(a.stock) && a.stock.length;
    const plain = [];
    (hb.places || []).forEach(pl => (pl.actions || []).forEach(a => { if (!isStall(a)) plain.push(a.id); }));
    const numOf = id => plain.indexOf(id) + 1;
    const exits = [];    // the way out to the dungeon is pinned to the bottom of the screen, so it is never three screens down
    (hb.places || []).forEach(pl => {
      const sec = h("section", { class: "place" }, h("h2", { class: "title", text: pl.label || pl.id }));
      if (pl.text) sec.append(h("p", { text: pl.text }));
      (pl.actions || []).forEach(a => {
        const off = a.enabled === false;
        if (isStall(a)) {
          sec.append(h("p", { class: "dim", text: a.label || a.id }));
          const st = h("div", { class: "stock" });
          a.stock.forEach(s => {
            const fn = () => send({ t: "hub", action: a.id, buy: s.item });
            const have = s.count ? ` (${s.count})` : "";
            const poor = s.enabled === false;
            st.append(choiceBtn(null, `${L("buy")} ${s.name || itemName(s.item)} \u00b7 ${s.price} ${L("gold")}${have}`, { mode: "act", enabled: !off && !poor, reason: poor ? s.reason : a.reason, onclick: fn, fk: `h:${a.id}:${s.item}` }));
          });
          (a.sell || []).forEach(s => {
            const fn = () => send({ t: "hub", action: a.id, sell: s.item });
            st.append(choiceBtn(null, `${L("sell")} ${s.name || itemName(s.item)} \u00b7 ${s.value} ${L("gold")} (${s.count})`, { mode: "plan", enabled: !off, reason: a.reason, onclick: fn, fk: `h:${a.id}:sell:${s.item}` }));
          });
          if (ui.toast && ui.toast.action === a.id) st.append(h("p", { class: "said", role: "status", text: ui.toast.text }));
          sec.append(st);
        } else {
          const fn = a.kind === "roster" && (hb.bench || []).length
            ? () => { ui.swap = a.id; ui.picks = null; ui.picksMode = ""; render(); }
            : () => send({ t: "hub", action: a.id });
          const n = numOf(a.id);
          const price = a.price ? ` \u00b7 ${a.price} ${L("gold")}` : "";
          const btn = choiceBtn(n, (a.label || a.id) + price, { mode: a.kind === "scene" ? "act" : "plan", enabled: !off, reason: a.reason, onclick: fn, fk: `h:${a.id}` });
          const def = a.kind === "scene" ? hubActionDef(a.id) : null;
          if (def && reachesMap(def.scene)) exits.push(btn); else sec.append(h("div", { style: "margin-top:6px" }, btn));
          if (ui.toast && ui.toast.action === a.id) sec.append(h("p", { class: "said", role: "status", text: ui.toast.text }));
          ui.keys[n - 1] = off ? null : fn;
        }
      });
      p.append(sec);
    });
    const rep = hb.report || [];
    if (rep.length) {
      const title = hb.reportTitle || (PACK.hub && PACK.hub.report && PACK.hub.report.title) || L("report");
      p.append(h("div", { class: "report" }, h("h2", { class: "title", text: title }), h("ul", null, rep.map(t => h("li", { text: t })))));
    }
    if (exits.length) p.append(h("div", { class: "exitbar" }, exits));
  }

  // ---------------------------------------------------------------- roster

  function pickerPanel(p, cfg) {
    // cfg: { mode, need, members, initial, heading, onGo(ids), onCancel? }
    const need = cfg.need || 4;
    if (ui.picksMode !== cfg.mode || !ui.picks) {
      ui.picks = cfg.initial.filter(id => cfg.members.some(m => m.id === id)).slice(0, need);
      ui.picksMode = cfg.mode;
    }
    p.append(h("h1", { class: "title", text: cfg.heading }));
    p.append(h("p", { class: "read", text: `${L("pickN")} ${need}. The first pick stands in front.` }));
    const grid = h("div", { class: "roster" });
    const toggle = id => {
      const i = ui.picks.indexOf(id);
      if (i >= 0) ui.picks.splice(i, 1);
      else if (ui.picks.length < need) ui.picks.push(id);
      render();
    };
    const labelOf = id => { const s = (PACK.rules.stats || []).find(x => x.id === id); return s ? s.label : id; };
    cfg.members.forEach(m => {
      const pos = ui.picks.indexOf(m.id);
      const statList = Array.isArray(m.stats) ? m.stats : Object.keys(m.stats || {}).map(k => ({ id: k, value: m.stats[k] }));
      const card = Array.isArray(m.card) ? m.card : m.card ? [m.card] : [];
      grid.append(h("button", {
        type: "button", class: "rcard", "aria-pressed": pos >= 0 ? "true" : "false", "data-fk": "r:" + m.id,
        "aria-label": `${m.name}, ${m.title || ""}${pos >= 0 ? ", place " + (pos + 1) : ""}`, onclick: () => toggle(m.id),
      },
        pos >= 0 ? h("span", { class: "badge", text: pos + 1 }) : null,
        h("div", { class: "nm", text: m.name }),
        m.title ? h("div", { class: "ti", text: m.title }) : null,
        m.text ? h("div", { class: "tx", text: m.text }) : null,
        h("div", { class: "stats" }, statList.map(s => h("span", { text: `${s.label || labelOf(s.id)} ${s.value > 0 && !isOse() ? "+" : ""}${s.value}` }))),
        card.map(line => h("div", { class: "cardline", text: line }))));
      ui.keys.push(() => toggle(m.id));
    });
    p.append(grid);
    const ready = ui.picks.length === need;
    const go = () => { if (ready) { const ids = ui.picks.slice(); ui.picks = null; ui.picksMode = ""; cfg.onGo(ids); } };
    p.append(h("div", { class: "pickbar" },
      cfg.onCancel ? h("button", { type: "button", class: "btn", onclick: cfg.onCancel }, L("back")) : null,
      h("button", { type: "button", class: "btn", onclick: () => { ui.picks = []; render(); } }, L("clear")),
      h("button", { type: "button", class: "btn primary", "aria-disabled": ready ? null : "true", "data-fk": "r:go", onclick: go },
        ready ? L("start") : `${ui.picks.length}/${need}`)));
    ui.enter = go;
  }

  function renderRosterPanel(p) {
    const r = vm.roster || { need: 4, members: [] };
    const cur = (vm.party || []).map(m => m.id);
    pickerPanel(p, {
      mode: "roster", need: r.need || 4, members: r.members, heading: L("chooseParty"),
      initial: cur.length ? cur : (PACK.party && PACK.party.default) || [],
      onGo: ids => send({ t: "pick", ids }),
    });
  }

  // The hub's roster action: swap bench members in.
  function cardFromPack(id) {
    const ch = (PACK.party.roster || {})[id] || {};
    return {
      id, name: ch.name || id, title: ch.title || "", text: ch.text || "",
      stats: (PACK.rules.stats || []).map(st => ({ id: st.id, label: st.label, value: (ch.stats || {})[st.id] })),
      card: [ch.oseLine || ch.class || "", ch.note5e || ""].filter(Boolean),
    };
  }
  function renderSwapPanel(p) {
    const hb = vm.hub || {};
    const live = (vm.party || []).filter(m => !m.dead);
    const members = live.map(m => cardFromPack(m.id)).concat((hb.bench || []).filter(b => !live.some(m => m.id === b.id)));
    const act = ui.swap;
    pickerPanel(p, {
      mode: "swap", need: (PACK.rules.party && PACK.rules.party.size) || 4, members,
      initial: live.map(m => m.id), heading: L("chooseParty"),
      onGo: ids => { ui.swap = null; send({ t: "hub", action: act, ids }); },
      onCancel: () => { ui.swap = null; ui.picks = null; ui.picksMode = ""; render(); },
    });
  }

  // ---------------------------------------------------------------- ending, death's door

  function renderEndingPanel(p) {
    const e = vm.ending || {};
    p.append(h("p", { class: "ending-kind", text: L({ good: "endGood", back: "endBack", dead: "endDead" }[e.kind] || "ending") }));
    p.append(h("h1", { class: "title", text: e.title || L("ending") }));
    (e.text || []).forEach(t => p.append(h("p", { class: "read", text: t })));
    const fn = () => newGame();
    p.append(h("div", { class: "row-btns" }, h("button", { type: "button", class: "btn primary", "data-fk": "ng", onclick: fn }, L("newGame"))));
    ui.keys.push(fn);
    ui.enter = fn;
  }

  function renderDeathPanel(p) {
    const party = vm.party || [];
    const dw = vm.door ? vm.door.who : null;
    let who = dw ? party.find(m => m.id === dw) : null;
    if (!who) who = party.find(m => !m.down && !m.dead && (m.tracks || []).some(t => t.marked >= t.max));
    const cost = (vm.door && vm.door.cost) || (PACK.rules && PACK.rules.fate && PACK.rules.fate.cheatDeath);
    p.append(h("h1", { class: "title", text: L("deathDoor") }));
    p.append(h("p", { class: "read", text: `${who ? who.name : "Someone"} is near death.${cost ? " Staying alive costs " + cost + " " + L("fate") + "." : ""}` }));
  }

  function renderDeathControls(box) {
    const cost = (vm.door && vm.door.cost) || (PACK.rules && PACK.rules.fate && PACK.rules.fate.cheatDeath);
    const a = () => send({ t: "cheat" }), b = () => send({ t: "letgo" });
    const cheatText = L("cheat");
    box.append(h("div", { class: "choices" },
      choiceBtn(1, cost && cheatText.indexOf(String(cost)) < 0 ? `${cheatText} (${cost} ${L("fate")})` : cheatText, { mode: "fate", onclick: a, fk: "d:cheat" }),
      h("div", { class: "apart" }, choiceBtn(2, L("letgo"), { mode: "act", onclick: b, fk: "d:letgo", cls: "quiet" }))));
    ui.keys.push(a, b);
  }

  // ---------------------------------------------------------------- fight

  const GONE = /^(fled|dead|down|gone|broken|out)/i;
  const targetable = f => !GONE.test(f.state || "");
  const ACT_LABEL = { fight: "fight", ability: "ability", item: "item", guard: "guard", run: "run" };

  function fightNowId() {
    if (!vm || vm.mode !== "fight" || !vm.fight) return null;
    const d = ensureDraft();
    const m = vm.fight.members[d.i];
    return m ? m.id : null;
  }

  function ensureDraft() {
    const f = vm.fight;
    const key = f.round + "|" + f.members.map(m => m.id).join(",");
    if (!ui.draft || ui.draftKey !== key) {
      ui.draftKey = key;
      ui.draft = { i: 0, orders: [], step: null };
    }
    return ui.draft;
  }

  const asId = x => (typeof x === "string" ? x : x && x.id);
  const asName = (x, fallback) => (typeof x === "string" ? fallback(x) : (x && (x.name || fallback(x.id))) || "");
  const abilityTarget = id => { const a = PACK.abilities && PACK.abilities[id]; return a ? a.target : "none"; };
  const itemTarget = id => { const it = PACK.items && PACK.items[id]; return it && it.use ? it.use.target : "none"; };
  const abilityName = id => { const a = PACK.abilities && PACK.abilities[id]; return a && a.name ? a.name : id; };

  function renderFightControls(box) {
    const f = vm.fight || { members: [], foes: [] };
    const d = ensureDraft();
    const mem = f.members[d.i];
    if (!mem) return;
    const pm = (vm.party || []).find(p => p.id === mem.id);
    const foes = (f.foes || []).filter(targetable);
    const foeBtns = (then) => foes.map(fo => ({
      label: `${fo.name}${fo.state ? " (" + fo.state + ")" : ""}`, run: () => then(fo.i),
    }));
    const allyBtns = (then) => (vm.party || []).filter(p => !p.dead && !p.down).map(p => ({ label: p.name, run: () => then(p.id) }));

    const commit = o => {
      d.orders.push(Object.assign({ member: mem.id }, o));
      d.step = null; d.i++;
      if (d.i >= f.members.length) {
        const orders = d.orders.slice();
        ui.draft = null; ui.draftKey = "";
        send({ t: "orders", orders });
      } else render();
    };

    const targetStep = (kind, onPick) => {
      if (kind === "foe") {
        if (foes.length <= 1) return onPick(foes.length ? foes[0].i : undefined);
        d.step = { pick: "target", options: foeBtns(onPick) };
      } else if (kind === "ally") {
        d.step = { pick: "target", options: allyBtns(onPick) };
      } else return onPick(undefined);
      render();
    };

    let options = [];
    let prompt = `Order for ${pm ? pm.name : mem.id}`;
    const step = d.step;
    if (!step) {
      const acts = (mem.acts && mem.acts.length ? mem.acts : ["fight", "ability", "item", "guard", "run"]);
      options = acts.map(a => {
        const label = L(ACT_LABEL[a] || a);
        let off = false;
        if (a === "ability" && !(mem.abilities || []).length) off = true;
        if (a === "item" && !(mem.items || []).length) off = true;
        if (a === "run" && f.canRun === false) off = true;
        const run = () => {
          if (a === "fight") targetStep("foe", t => commit({ act: "fight", target: t }));
          else if (a === "ability") { d.step = { pick: "ability" }; render(); }
          else if (a === "item") { d.step = { pick: "item" }; render(); }
          else commit({ act: a });
        };
        return { label, run, off };
      });
    } else if (step.pick === "ability") {
      prompt += ": " + L("ability");
      options = (mem.abilities || []).map(a => {
        const id = asId(a), left = typeof a === "object" && a.left != null ? ` (${a.left})` : "";
        return { label: asName(a, abilityName) + left, off: typeof a === "object" && a.usable === false, run: () => targetStep(abilityTarget(id), t => commit({ act: "ability", ability: id, target: t })) };
      });
    } else if (step.pick === "item") {
      prompt += ": " + L("item");
      options = (mem.items || []).map(a => {
        const id = asId(a), cnt = typeof a === "object" && a.count != null ? ` ×${a.count}` : "";
        return { label: asName(a, itemName) + cnt, run: () => targetStep(itemTarget(id), t => commit({ act: "item", item: id, target: t })) };
      });
    } else if (step.pick === "target") {
      prompt += ": " + L("target");
      options = step.options;
    }

    // The orders sit in a sheet pinned to the bottom of the screen (style.css), so no order button is ever below the fold.
    const undo = () => {
      if (d.step) { d.step = null; render(); }
      else if (d.i > 0) { d.i--; d.orders.pop(); render(); }
    };
    const bar = h("div", { class: "ask-btns" });
    if (d.step || d.i > 0) bar.append(h("button", { type: "button", class: "btn small", "data-fk": "o:back", onclick: undo }, d.step ? L("back") : L("undo")));
    if (f.canReroll) bar.append(h("button", { type: "button", class: "btn small primary", "data-fk": "o:reroll", onclick: () => send({ t: "reroll" }) }, L("reroll")));
    if (ui.round && ui.round.length) {
      const rb = h("div", { class: "round", tabindex: "0", "aria-label": L("lastRound") }, h("p", { class: "round-title", text: `${L("lastRound")}` }));
      ui.round.forEach(l => rb.append(h("p", { class: l.cls || "", text: l.text })));
      box.append(rb);
    }
    box.append(h("div", { class: "ask-row" }, h("p", { class: "ask" }, prompt, h("span", { class: "dim" }, `  ${d.i + 1}/${f.members.length}`)), bar));
    if (d.orders.length) {
      box.append(h("p", { class: "orders-so-far", text: d.orders.map(o => `${whoName(o.member)}: ${L(ACT_LABEL[o.act] || o.act)}`).join(" · ") }));
    }
    const wrap = h("div", { class: "choices grid2" });
    options.forEach((o, i) => {
      wrap.append(choiceBtn(i + 1, o.label, { mode: "act", enabled: !o.off, onclick: o.run, fk: "o:" + (step ? step.pick : "act") + ":" + i }));
      ui.keys.push(o.off ? null : o.run);
    });
    box.append(wrap);
    ui.undo = undo;
    ui.reroll = f.canReroll ? () => send({ t: "reroll" }) : null;
  }

  function renderPlate() {
    const pl = $("plate");
    clear(pl);
    const f = vm.fight;
    if (!f) { pl.hidden = true; return; }
    pl.hidden = false;
    const foes = f.foes || [];
    const alive = foes.filter(targetable).length;
    pl.append(h("p", { class: "plate-title", text: `${L("foes")} · ${alive}` }));
    const ol = h("ol");
    foes.forEach(fo => {
      const gone = !targetable(fo);
      const boxes = !isOse() && fo.max != null;
      const st = (boxes ? [fo.state] : [fo.state, fo.hp]).filter(Boolean).join(" · ");
      ol.append(h("li", { class: (gone ? "gone " : "") + (/asleep/i.test(fo.state || "") ? "asleep" : "") },
        h("span", { class: "n", text: "\u00b7" }), h("span", { text: fo.name }),
        st || boxes ? h("span", { class: "st" }, st, boxes ? h("span", { class: "pips", role: "img", "aria-label": fo.hp || "", title: fo.hp || "" }, Array.from({ length: fo.max }, (_, i) => h("span", { class: "pip" + (i < fo.marked ? " on" : "") }))) : null) : null));
    });
    pl.append(ol);
    // One card per kind of foe: the full stat line and the note.
    const shown = {};
    foes.forEach(fo => {
      const card = Array.isArray(fo.card) ? fo.card : fo.card ? [fo.card] : [];
      if (!card.length || shown[fo.name]) return;
      shown[fo.name] = true;
      pl.append(h("div", { class: "foecard" }, h("p", { class: "fc-name", text: fo.name }), card.map(line => h("p", { class: "fc-line mono", text: line }))));
    });
  }

  // ---------------------------------------------------------------- card sheet

  function openSheet(id) { ui.sheet = { id, pick: null }; ui.sheetReturn = doc.activeElement; renderSheet(); }
  function closeSheet() {
    ui.sheet = null;
    const s = $("sheet");
    s.hidden = true; clear(s);
    const back = ui.sheetReturn;
    ui.sheetReturn = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
    else { const c = ui.sheetCard && doc.querySelector(`[data-fk="card:${ui.sheetCard}"]`); if (c) c.focus({ preventScroll: true }); }
  }

  function renderSheet() {
    const s = $("sheet");
    if (!ui.sheet) { s.hidden = true; return; }
    const m = (vm.party || []).find(p => p.id === ui.sheet.id);
    if (!m) { closeSheet(); return; }
    ui.sheetCard = m.id;
    clear(s);
    s.hidden = false;
    const inner = h("div", { class: "sheet-in" });
    inner.append(h("div", { class: "ov-head" },
      h("h1", { class: "title", text: m.name }),
      h("button", { type: "button", class: "btn small", "data-fk": "sh:close", onclick: closeSheet }, L("close"))));
    const sub = PACK.party && PACK.party.roster && PACK.party.roster[m.id];
    inner.append(h("p", { class: "sub", text: [m.title, m.rank === "front" ? L("front") : L("back2")].filter(Boolean).join(" · ") }));
    (m.tracks || []).forEach(t => inner.append(trackRow(t)));
    inner.append(h("div", { class: "row", style: "margin-top:6px" },
      h("span", { class: "fate", text: L("fate") + " " + m.fate }), ...(m.cond || []).map(c => h("span", { class: "tag", text: c }))));

    const mode = vm.mode;
    const canUse = (mode === "map" || mode === "fight") && !m.down && !m.dead;
    inner.append(h("h2", { class: "title", text: L("abilities") }));
    const list = h("div", { class: "abil" });
    if (ui.sheet.pick) {
      const pk = ui.sheet.pick;
      list.append(h("p", { class: "dim", text: `${abilityName(pk.ability)}: ${L("target")}` }));
      pk.options.forEach(o => list.append(h("button", { type: "button", class: "btn", onclick: () => { closeSheet(); send({ t: "use", member: m.id, ability: pk.ability, target: o.value }); } }, o.label)));
      list.append(h("button", { type: "button", class: "btn", onclick: () => { ui.sheet.pick = null; renderSheet(); } }, L("back")));
    } else {
      if (!(m.abilities || []).length) list.append(h("p", { class: "dim", text: "—" }));
      (m.abilities || []).forEach(a => {
        const off = !canUse || a.usable === false;
        const run = () => {
          const tk = abilityTarget(a.id);
          if (tk === "ally") {
            ui.sheet.pick = { ability: a.id, options: (vm.party || []).filter(p => !p.dead && !p.down).map(p => ({ value: p.id, label: p.name })) };
            renderSheet();
          } else if (tk === "foe" && vm.fight) {
            const foes = (vm.fight.foes || []).filter(targetable);
            if (foes.length > 1) { ui.sheet.pick = { ability: a.id, options: foes.map(f => ({ value: f.i, label: `${f.name}` })) }; renderSheet(); }
            else { closeSheet(); send({ t: "use", member: m.id, ability: a.id, target: foes.length ? foes[0].i : undefined }); }
          } else { closeSheet(); send({ t: "use", member: m.id, ability: a.id }); }
        };
        list.append(h("button", { type: "button", class: "btn", "aria-disabled": off ? "true" : null, "data-fk": "sh:" + a.id, onclick: () => { if (!off) run(); } },
          h("span", { class: "abil-name" }, h("span", { text: a.name }), a.text ? h("span", { class: "desc", text: a.text }) : null),
          a.left != null ? h("span", { class: "mono", text: String(a.left) }) : null));
      });
    }
    inner.append(list);

    if ((mode === "map" || mode === "hub") && !m.down && !m.dead) {
      const living = (vm.party || []).filter(p => !p.down && !p.dead).map(p => p.id);
      const at = living.indexOf(m.id);
      const move = delta => {
        const ids = living.slice();
        const j = at + delta;
        if (j < 0 || j >= ids.length) return;
        ids.splice(at, 1); ids.splice(j, 0, m.id);
        send({ t: "order", ids });
        renderSheet();
      };
      inner.append(h("h2", { class: "title", text: L("order") }));
      inner.append(h("div", { class: "row-btns" },
        h("button", { type: "button", class: "btn", "aria-disabled": at <= 0 ? "true" : null, onclick: () => move(-1) }, "↑ " + L("up")),
        h("button", { type: "button", class: "btn", "aria-disabled": at >= living.length - 1 ? "true" : null, onclick: () => move(1) }, "↓ " + L("down"))));
    }
    s.append(inner);
    const first = s.querySelector('[data-fk="sh:close"]');
    if (first && !s.contains(doc.activeElement)) first.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- map overlay

  function openMap() {
    if (!vm || !vm.map) return;
    ui.mapOpen = true;
    ui.mapReturn = doc.activeElement;
    renderMap();
  }
  function closeMap() {
    ui.mapOpen = false;
    const ov = $("mapov");
    ov.hidden = true; clear(ov);
    const back = ui.mapReturn;
    ui.mapReturn = null;
    const t = doc.querySelector('[data-fk="t:map"]');
    if (t) t.focus({ preventScroll: true });
    else if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  function renderMap() {
    const ov = $("mapov");
    if (!ui.mapOpen || !vm.map) { ov.hidden = true; return; }
    const hadFocus = ov.contains(doc.activeElement);
    clear(ov);
    ov.hidden = false;
    const m = vm.map;
    const cv = h("canvas", { id: "mapcv", role: "img", "aria-label": "Map of " + (m.title || "the level") });
    const atoms = trails[m.id] || [];
    const turtle = turtleText(atoms);
    const inner = h("div", { class: "ov-in" },
      h("div", { class: "ov-head" },
        h("h1", { class: "title", text: L("map") + (m.title ? " · " + m.title : "") }),
        h("button", { type: "button", class: "btn small", "data-fk": "mo:close", onclick: closeMap }, L("close"))),
      cv,
      h("h2", { class: "title", style: "font:bold 1rem var(--font-title);margin:14px 0 2px", text: L("moves") }),
      turtle.length
        ? h("p", { class: "turtle", "aria-label": "Moves" }, turtle.map((t, i) => [i ? h("span", { class: "sep", text: "·" }) : null, h("b", { text: t.split(" ")[0] }), " " + t.split(" ")[1]]))
        : h("p", { class: "turtle dim", text: L("noMoves") }),
      h("p", { class: "scale", text: "10 ft per square." }));
    ov.append(inner);
    drawAutomap(cv, m);
    if (!hadFocus) { const c = ov.querySelector('[data-fk="mo:close"]'); if (c) c.focus({ preventScroll: true }); }
    else { const c = ov.querySelector('[data-fk="mo:close"]'); if (c) c.focus({ preventScroll: true }); }
  }

  function drawAutomap(cv, m) {
    const am = m.automap || { w: 0, h: 0, rows: [] };
    const rows = am.rows || [];
    // Crop to the squares seen so far, plus one square of margin, so an early map is not a few lines in a sea of paper.
    let x0 = m.x, x1 = m.x, y0 = m.y, y1 = m.y;
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== " ") { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
    x1 = Math.min((am.w || x1 + 2) - 1, x1 + 1); y1 = Math.min((am.h || rows.length || y1 + 2) - 1, y1 + 1);
    const w = x1 - x0 + 1, hh = y1 - y0 + 1;
    const availW = Math.min(cv.parentNode.clientWidth || 328, 560);
    const maxH = Math.max(200, Math.round((window.innerHeight || 700) * 0.55));
    const cs = Math.max(8, Math.min(40, Math.floor((availW - 16) / Math.max(1, w)), Math.floor((maxH - 16) / Math.max(1, hh))));
    const W = availW, H = cs * hh + 16;
    cv.style.height = H + "px";
    const ctx = sizeCanvas(cv, W, H);
    const ink = cssVar("--ink"), paper = cssVar("--paper"), muted = cssVar("--muted"), accent = cssVar("--accent");
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const ox = Math.round((W - cs * w) / 2), oy = 8;
    const at = (x, y) => (rows[y0 + y] && rows[y0 + y][x0 + x]) || " ";
    const isWall = ch => ch === "#" || ch === " " || ch === "S";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // floors: faint grid
    ctx.strokeStyle = muted; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (isWall(ch)) continue;
      ctx.strokeRect(ox + x * cs + 0.5, oy + y * cs + 0.5, cs - 1, cs - 1);
    }
    ctx.globalAlpha = 1;
    // walls: hatch the seen wall cells, ink line where wall meets floor
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      if (at(x, y) !== "#" && at(x, y) !== "S") continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(ox + x * cs, oy + y * cs, cs, cs); ctx.clip();
      ctx.strokeStyle = muted; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.55;
      for (let k = -cs; k < cs * 2; k += Math.max(4, cs / 3)) {
        ctx.beginPath(); ctx.moveTo(ox + x * cs + k, oy + y * cs + cs); ctx.lineTo(ox + x * cs + k + cs, oy + y * cs); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      if (isWall(at(x, y))) continue;
      const X = ox + x * cs, Y = oy + y * cs;
      const edge = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
      if (isWall(at(x, y - 1))) edge(X, Y, X + cs, Y);
      if (isWall(at(x, y + 1))) edge(X, Y + cs, X + cs, Y + cs);
      if (isWall(at(x - 1, y))) edge(X, Y, X, Y + cs);
      if (isWall(at(x + 1, y))) edge(X + cs, Y, X + cs, Y + cs);
    }
    // features
    ctx.lineWidth = 1.6; ctx.strokeStyle = ink; ctx.fillStyle = ink;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      const X = ox + x * cs, Y = oy + y * cs, cxm = X + cs / 2, cym = Y + cs / 2;
      if (ch === "+" || ch === "=" || ch === "L") {
        const vert = isWall(at(x - 1, y)) && isWall(at(x + 1, y));   // passage runs north-south
        const dw = vert ? cs * 0.78 : cs * 0.22, dh = vert ? cs * 0.22 : cs * 0.78;
        ctx.fillStyle = paper; ctx.fillRect(cxm - dw / 2, cym - dh / 2, dw, dh);
        ctx.strokeRect(cxm - dw / 2, cym - dh / 2, dw, dh);
        if (ch === "=") { ctx.beginPath(); ctx.moveTo(cxm - dw / 2, cym - dh / 2); ctx.lineTo(cxm + dw / 2, cym + dh / 2); ctx.moveTo(cxm + dw / 2, cym - dh / 2); ctx.lineTo(cxm - dw / 2, cym + dh / 2); ctx.stroke(); }
        if (ch === "L") { ctx.beginPath(); ctx.arc(cxm, cym, cs * 0.1, 0, 7); ctx.fillStyle = ink; ctx.fill(); }
      } else if (ch === "<" || ch === ">") {
        for (let i = 1; i <= 4; i++) { const yy = Y + (cs * i) / 5; ctx.beginPath(); ctx.moveTo(X + cs * 0.2, yy); ctx.lineTo(X + cs * 0.8, yy); ctx.stroke(); }
      } else if (ch === "~") {
        ctx.lineWidth = 1; ctx.setLineDash([cs * 0.15, cs * 0.12]);
        for (let i = 1; i <= 3; i++) { const yy = Y + (cs * i) / 4; ctx.beginPath(); ctx.moveTo(X + cs * 0.1, yy); ctx.lineTo(X + cs * 0.9, yy); ctx.stroke(); }
        ctx.setLineDash([]); ctx.lineWidth = 1.6;
      }
    }
    // the party
    const px = ox + (m.x - x0) * cs + cs / 2, py = oy + (m.y - y0) * cs + cs / 2, r = cs * 0.34;
    const ang = ((m.facing % 4) - 1) * (Math.PI / 2);   // 0 = east
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = accent; ctx.strokeStyle = paper; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.75); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 0.8, -r * 0.75); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- the render pass

  const app = $("app");

  function render() {
    const fk = doc.activeElement && doc.activeElement.dataset ? doc.activeElement.dataset.fk : null;
    ui.keys = [];
    ui.enter = null; ui.undo = null; ui.reroll = null;
    const mode = vm.mode;
    const panelKey = mode + "|" + (vm.scene ? vm.scene.id : "");
    const entering = panelKey !== ui.panelKey;
    if (entering && ui.lastMode !== mode) { try { window.scrollTo(0, 0); } catch (e) { /* no scroll */ } }
    ui.lastMode = mode;
    ui.panelKey = panelKey;
    if (mode !== "fight") { ui.draft = null; ui.draftKey = ""; }
    if (mode !== "hub") ui.swap = null;
    if (mode !== "roster" && !ui.swap) { ui.picks = null; ui.picksMode = ""; }

    const wireMode = mode === "map" || mode === "fight";
    app.dataset.mode = mode;
    app.dataset.stage = wireMode ? "wire" : "panel";
    app.dataset.showParty = mode === "roster" || mode === "ending" ? "0" : "1";
    app.dataset.showLog = mode === "roster" || mode === "ending" ? "0" : "1";

    renderHud();
    const panel = $("panel");
    clear(panel);
    panel.classList.toggle("enter", entering);
    const controls = $("controls");
    clear(controls);
    controls.classList.toggle("sheet", mode === "fight");
    $("plate").hidden = true;

    if (wireMode) {
      panel.hidden = true;
      wire.setAttribute("aria-label", describeView());
      if (mode === "fight") renderPlate();
    } else {
      panel.hidden = false;
    }
    switch (mode) {
      case "map": renderThumbs(controls); break;
      case "fight": renderFightControls(controls); break;
      case "scene": renderScenePanel(panel); renderSceneControls(controls); break;
      case "hub": renderHubPanel(panel); break;
      case "roster": renderRosterPanel(panel); break;
      case "ending": renderEndingPanel(panel); break;
      case "deathDoor": renderDeathPanel(panel); renderDeathControls(controls); break;
      default: break;
    }
    renderParty();
    app.style.setProperty("--sheet-h", mode === "fight" ? controls.offsetHeight + "px" : "0px");
    $("seedline").textContent = L("seed") + " " + seed;
    renderSheet();
    renderMap();
    if (wireMode) drawWire(0);
    if (fk && !(ui.mapOpen || ui.sheet)) {
      const again = doc.querySelector(`[data-fk="${CSS.escape ? CSS.escape(fk) : fk}"]`);
      if (again && again !== doc.activeElement) again.focus({ preventScroll: true });
    }
  }

  // ---------------------------------------------------------------- keys

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const k = e.key;
    if (k === "F1") {
      e.preventDefault();
      const d = $("help");
      d.open = !d.open;
      if (d.open) d.scrollIntoView({ block: "start" });
      return;
    }
    if (!vm) return;
    if (k === "Escape") {
      if (ui.sheet) { e.preventDefault(); closeSheet(); return; }
      if (ui.mapOpen) { e.preventDefault(); closeMap(); return; }
      if (vm.mode === "fight" && ui.undo) { e.preventDefault(); ui.undo(); return; }
      const d = $("help");
      if (d.open) { d.open = false; }
      return;
    }
    if (ui.sheet) return;
    if (ui.mapOpen) {
      if (k === "m" || k === "M") { e.preventDefault(); closeMap(); }
      return;
    }
    if (doc.getElementById("help").open && tag === "SUMMARY") return;
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (/^[1-9]$/.test(k)) {
      const fn = ui.keys[parseInt(k, 10) - 1];
      if (fn) { e.preventDefault(); fn(); }
      return;
    }
    const mode = vm.mode;
    if (mode === "map") {
      let cmd = null;
      switch (lower) {
        case "ArrowUp": case "w": cmd = { t: "move", dir: "forward" }; break;
        case "ArrowDown": case "s": cmd = { t: "move", dir: "back" }; break;
        case "ArrowLeft": case "a": cmd = { t: "turn", dir: "left" }; break;
        case "ArrowRight": case "d": cmd = { t: "turn", dir: "right" }; break;
        case "q": cmd = { t: "move", dir: "left" }; break;
        case "e": cmd = { t: "move", dir: "right" }; break;
        case " ": case "Enter": if (e.target && e.target.tagName === "BUTTON") return; cmd = { t: "act" }; break;
        case "f": cmd = { t: "search" }; break;
        case "l": cmd = { t: "listen" }; break;
        case "r": cmd = { t: "rest" }; break;
        case "m": e.preventDefault(); openMap(); return;
        default: return;
      }
      e.preventDefault();
      if (e.repeat && (cmd.t !== "move" && cmd.t !== "turn")) return;
      send(cmd);
      return;
    }
    if (mode === "fight" && lower === "r" && ui.reroll) { e.preventDefault(); ui.reroll(); return; }
    if ((mode === "roster" || mode === "ending") && k === "Enter" && ui.enter && !(e.target && e.target.tagName === "BUTTON")) { e.preventDefault(); ui.enter(); }
  }
  doc.addEventListener("keydown", onKey);

  // ---------------------------------------------------------------- footer

  const ngBtn = $("newgame");
  ngBtn.textContent = L("newGame");
  ngBtn.addEventListener("click", () => {
    const now = Date.now();
    if (ui.newGameArmed && now - ui.newGameArmed < 4000) {
      ui.newGameArmed = 0;
      ngBtn.textContent = L("newGame");
      newGame();
    } else {
      ui.newGameArmed = now;
      ngBtn.textContent = L("sure");
      setTimeout(() => { if (ui.newGameArmed === now) { ui.newGameArmed = 0; ngBtn.textContent = L("newGame"); } }, 4000);
    }
  });

  // ---------------------------------------------------------------- boot

  // The F1 text is static HTML, so it reads with scripting off. With scripting on, its words follow the pack's labels.
  function applyHelpLabels() {
    doc.querySelectorAll("[data-l]").forEach(e => { e.textContent = L(e.getAttribute("data-l")); });
  }

  function boot() {
    applyTheme();
    applyHelpLabels();
    try {
      const q = new URLSearchParams(location.search).get("seed");
      if (q != null && /^-?\d+$/.test(q.trim())) seedFromUrl = parseInt(q, 10) >>> 0;
    } catch (e) { seedFromUrl = null; }
    const saved = loadSave();
    if (saved && (seedFromUrl == null || saved.seed === seedFromUrl)) {
      replayRecord(saved);
    } else {
      begin(seedFromUrl != null ? seedFromUrl : randomSeed());
      vm = Crawl.view(PACK, state);
      cacheNames();
      resetLog(vm.log || []);
      writeSave();
      render();
    }
  }

  window.CRAWL = {
    pack: PACK,
    get state() { return state; },
    step(cmd) { return send(cmd); },
    view() { return Crawl.view(PACK, state); },
    replay(rec) { replayRecord(rec); writeSave(); },
    get seed() { return seed; },
  };

  // Redraw on resize and on a change of colour scheme.
  if (window.ResizeObserver) new ResizeObserver(() => { if (vm && (vm.mode === "map" || vm.mode === "fight")) drawWire(0); if (ui.mapOpen && vm) renderMap(); }).observe($("stage"));
  window.addEventListener("resize", () => { if (ui.mapOpen && vm) renderMap(); });
  if (window.matchMedia) {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const again = () => { if (vm) { render(); } };
    if (mq.addEventListener) mq.addEventListener("change", again); else if (mq.addListener) mq.addListener(again);
  }

  boot();
})();
