/* The Stage: the shell. Contract: stage/SPEC.md section 4; motion: stage/MOTION.md.
   The shell owns the text, the HUD, the sheets, the keys, the sound and film mode.
   A kit (ui/kits/<kit>.js) draws the set behind the text and plays each cue.
   The engine (Stage, from engine/stage.js) holds the rules. This file has no rules in it.

   How a step runs:   engine call -> view -> present()
     1. show the new set to the kit (so it can lay it under the old one)
     2. play the step's cues one at a time; each cue is a shell effect plus kit.cue(); wait for both
     3. sync the HUD and kit.update(state), then show the card or the next panel and start the line
   A tap during the cues skips the rest of them. Under reduced motion no animation is started.
   Text panels slide only on a `turn`; any other new panel crossfades over --m-state (MOTION.md, "beat"). The page carries window.SIM (Stage.simulate, embedded by the build) for Verify.

   Kit notes for wave 2:
     - Call order is show() then cue(): for `turn` and `shift` the kit gets the new set first and animates the swap in cue().
       After the step's last cue the shell calls update(state); it also calls update(state) after back, load, Continue and a Verify replay.
     - A tap during a cue calls the kit's finish(): jump the active cue to its end state and resolve its Promise now.
     - A kit element that should react to a tap must be a <button> or carry data-kit-hit; any other tap on the stage is "go on".
     - The engine sends `ink` and `bloom` only when the look changes (and `ink` on a reveal). The shell plays every cue it is given.
     - Map style: <html data-map="ink|blueline"> and a window "stage:map" event; the shell also calls setMap(style) if the kit has it.
     - A beat's `screen` lines: the shell calls screen(lines) if the kit has it (and screen([]) when no beat shows one),
       and then keeps a screen-reader copy only. Without it the shell draws the lines in the text panel.
     - The state a kit gets (show, update): meters, fields, tallies, flags, look (the look on show), revealed (a secret is open) and
       ended (true when the view is at the final ending node: a kit may draw its closed state after a replay or Continue lands there).
     - Motion: <html data-motion="full|calm">. Calm behaves exactly as prefers-reduced-motion: reduce. A kit that decides for itself
       whether to animate (in show(), update() or tick()) must treat data-motion="calm" like the media query. The `reduced` flag
       the shell passes to mount() and cue() already includes it.
   Hooks for tests: #app[data-phase], #app[data-node], #app[data-busy]; #app[data-ending="<id>"] and .panel.ending[data-ending="<id>"]
   while an ending is on show (and absent otherwise); every control is a labelled button.
   Page parameters: ?seed=N fixes the seed. ?force=fail,success steers the next rolls to those result tiers (the browser test uses it).
   Either one fixes the run: no Continue. A forced run, like a Verify replay, never writes the save, the found endings or the notes met. */
(function () {
"use strict";

const PACK = window.PACK;
const ASSETS = window.ASSETS || {};
const root = document.documentElement;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plain = s => String(s).replace(/\*/g, "");
const sgn = n => (n < 0 ? "−" : "+") + Math.abs(n);
const fmt = n => (Number.isSafeInteger(n) ? n.toLocaleString("en-US") : n.toExponential(4));
const el = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const lastOf = a => a[a.length - 1];

// ---------------------------------------------------------------- tokens and reduced motion
const cs = getComputedStyle(root);
const tok = n => cs.getPropertyValue(n).trim();
const num = (n, d) => { const x = parseFloat(tok(n)); return Number.isFinite(x) ? x : d; };
const M = {
  state: num("--m-state", 250), sheet: num("--m-sheet", 300), in: num("--m-in", 450), out: num("--m-out", 380),
  turn: num("--m-turn", 650), roll: num("--m-roll", 900), close: num("--m-close", 1200), flash: num("--m-flash", 700),
  flashGap: num("--m-flash-gap", 340), hold: num("--m-hold", 2000), seal: num("--m-seal", 300), tear: num("--m-tear", 500),
  type: num("--m-type", 28), autoBase: num("--m-auto-base", 2600), autoChar: num("--m-auto-char", 42),
  d1: num("--m-d1", 4), d2: num("--m-d2", 8), d4: num("--m-d4", 32), d5: num("--m-d5", 48),
  flashAlpha: num("--m-flash-alpha", 0.28), rollTicks: num("--m-roll-ticks", 3),
  easeOut: tok("--m-ease-out") || "ease-out", easeIn: tok("--m-ease-in") || "ease-in", easeLinear: tok("--m-ease-linear") || "linear",
};
const mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
// Reduced motion is the system setting or the reader's Calm setting. Both behave the same (WCAG 2.2.2).
const isCalm = () => !!(V && V.settings && V.settings.motion === "calm");
const isReduced = () => !!mq.matches || isCalm();

// ---------------------------------------------------------------- pack indexes
const KIT_ID = PACK.kit;
const SCRIPT = PACK.script || { scenes: [], endings: {} };
const ENDINGS = SCRIPT.endings || {};
const ENDING_IDS = Object.keys(ENDINGS);
const NOTES = PACK.notes || {};
const METERS = PACK.meters || [];
const FIELDS = PACK.fields || [];
const TALLY_VALUES = PACK.tallies || {}; // tally id -> allowed values
const TALLY_IDS = Object.keys(TALLY_VALUES);
const COMMENTARY = PACK.commentary || null;
const MAP_STYLES = ((PACK.theme && PACK.theme.mapStyles) || []).slice();
const sceneById = {}; SCRIPT.scenes.forEach(s => { sceneById[s.id] = s; });
const meterLabel = id => { const m = METERS.find(x => x.id === id); return m ? m.label : id; };
// The signed change a cost or gain cue made. A bad meter (stress, exposure) rises on a cost and falls on a gain.
const cueDelta = c => { const m = METERS.find(x => x.id === c.meter); return ((c.type === "cost") === !!(m && m.bad) ? 1 : -1) * c.n; };
const fieldLabel = id => { const f = FIELDS.find(x => x.id === id); return f ? f.label : id; };
const KIND_NAMES = { rule: "Rules", dm: "How the module DMs", lore: "The world", handler: "Handler", algorithm: "Algorithm", guide: "Guide" };
const ASK_MAP = { ink: "Unwitnessed", paint: "Witnessed" };

// ---------------------------------------------------------------- storage (every access in try/catch)
const store = {
  mem: null,
  read() {
    try { const t = localStorage.getItem(PACK.storageKey); if (t) { const d = JSON.parse(t); if (d && typeof d === "object") return d; } } catch (e) {}
    return this.mem;
  },
  write(d) { this.mem = d; try { localStorage.setItem(PACK.storageKey, JSON.stringify(d)); } catch (e) {} },
};
const DEFAULTS = { theme: "auto", map: MAP_STYLES[0] || "ink", motion: "full", commentary: true, sound: false, auto: false, speed: "normal", shortcuts: true };
function cleanRecord(d) {
  const r = { save: null, found: [], met: [], settings: Object.assign({}, DEFAULTS) };
  if (!d || typeof d !== "object") return r;
  if (typeof d.save === "string") r.save = d.save;
  if (Array.isArray(d.found)) r.found = d.found.filter(x => typeof x === "string" && ENDING_IDS.includes(x));
  if (Array.isArray(d.met)) r.met = d.met.filter(x => typeof x === "string" && NOTES[x]);
  const s = d.settings;
  if (s && typeof s === "object") {
    if (["auto", "light", "dark"].includes(s.theme)) r.settings.theme = s.theme;
    if (MAP_STYLES.includes(s.map)) r.settings.map = s.map;
    if (["full", "calm"].includes(s.motion)) r.settings.motion = s.motion;
    if (typeof s.commentary === "boolean") r.settings.commentary = s.commentary;
    if (typeof s.sound === "boolean") r.settings.sound = s.sound;
    if (typeof s.auto === "boolean") r.settings.auto = s.auto;
    if (typeof s.shortcuts === "boolean") r.settings.shortcuts = s.shortcuts;
    if (["slow", "normal", "fast"].includes(s.speed)) r.settings.speed = s.speed;
  }
  return r;
}

// ---------------------------------------------------------------- state
const V = {
  game: null, view: null, kit: null, phase: "title", token: 0, rec: null,
  settings: null, found: new Set(), extraMet: new Set(), seen: new Set(),
  shown: { meters: {}, high: {}, tallies: {} }, setId: null, preview: null,
  slide: null, typing: null, cueBusy: false, ctx: null, waiters: new Set(),
  autoT: null, sheet: null, opener: null, replaying: false, seedPending: 1, seedFixed: false, force: [], forceIgnored: [], starting: false,
  lastFlash: -1e9, sealed: false, rollEl: null, sim: null, simAt: 0, rafId: 0, dragX: 0, dragY: 0, restartT: null,
};
const TIERS = ["fail", "tie", "success", "style"]; // the result tiers ?force= accepts
const SPEED = { slow: 1.6, normal: 1, fast: 0.6 };
const TYPE_MAX = 4000; // ms: the longest a beat may take to type

// ---------------------------------------------------------------- live region
function announce(parts) {
  const text = (Array.isArray(parts) ? parts : [parts]).filter(Boolean).join(". ");
  if (!text) return;
  const live = $("live");
  live.textContent = live.textContent === text ? text + " " : text;
}

// A touch screen has no keys to name. Key hints are true only when the reader has a pointer and a keyboard and has not turned shortcuts off.
const isTouch = () => { try { return !matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { return false; } };
const keysOn = () => !!(V.settings && V.settings.shortcuts) && !isTouch();

// ---------------------------------------------------------------- sound (Web Audio, no files, off until asked)
const snd = {
  ctx: null, on: false,
  init() {
    if (!this.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return false; try { this.ctx = new A(); } catch (e) { return false; } }
    if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
    return true;
  },
  set(on) { this.on = !!on; if (this.on) { this.init(); this.tone("triangle", 660, 0, 0.08, 0.03); } },
  unlock() { if (this.on && !this.ctx) this.init(); else if (this.on && this.ctx && this.ctx.state === "suspended") this.init(); },
  tone(type, f0, f1, d, v, delay, lin) {
    if (!this.on || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + (delay || 0), o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) { if (lin) o.frequency.linearRampToValueAtTime(f1, t + d); else o.frequency.exponentialRampToValueAtTime(f1, t + d); }
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.03);
    } catch (e) {}
  },
  tick() { this.tone("triangle", 1250, 0, 0.018, 0.016); },
  // One sound per cue at most (MOTION.md section 3). `shift` and `tally` are silent.
  cue(c) {
    switch (c.type) {
      case "turn": this.tone("sine", 180, 900, 0.18, 0.03); break;
      case "ink": this.tone("triangle", 520, 0, 0.12, 0.02); break;
      case "bloom": this.tone("triangle", 440, 0, 0.3, 0.02); break;
      case "seal": this.tone("square", 140, 0, 0.09, 0.06); break;
      case "roll": for (let i = 0; i < M.rollTicks; i++) this.tone("triangle", [1100, 1250, 1400][i % 3], 0, 0.018, 0.016, i * (M.roll / M.rollTicks) / 1000); break;
      case "cost": this.tone("sawtooth", 220, 140, 0.18, 0.07, 0, true); break;
      case "gain": [330, 440, 554.37, 659.25].forEach((f, i) => this.tone("triangle", f, 0, 0.3, 0.04, i * 0.08)); break;
      case "tear": this.tone("sawtooth", 900, 200, 0.15, 0.04); break;
      case "close": this.tone("triangle", 220, 0, 0.6, 0.04); this.tone("triangle", 164.81, 0, 0.6, 0.04); break;
    }
  },
};

// ---------------------------------------------------------------- the kit
function kitCall(fn, ...args) {
  const k = V.kit;
  if (!k || typeof k[fn] !== "function") return undefined;
  try { return k[fn](...args); } catch (e) { console.error("kit." + fn + ":", e); return undefined; }
}
// What a kit needs to rebuild the stage after back, load, Continue or a replay, with no cue to play:
// the look on show (ink or paint) and whether a secret in the current set is open. Both come from the engine,
// so they follow back, load and Continue exactly as forward play left them.
function stateOf(v) {
  return { meters: v.meters, fields: v.fields, tallies: v.tallies, flags: v.flags,
    look: v.shown || null, revealed: !!v.opened,
    ended: v.node === "ending" }; // the view is at the final ending node: a kit may show its closed state
}
const kitHas = fn => !!(V.kit && typeof V.kit[fn] === "function");
function kitShow(setId, v, instant) {
  const set = (PACK.sets || {})[setId];
  if (!set) return;
  kitCall("show", setId, set, { instant: !!instant, state: stateOf(v) });
  kick();
}
function kitUpdate(v) { kitCall("update", stateOf(v)); kick(); }
// One timer per wait; a tap fires them all.
function wait(ms) {
  return new Promise(res => {
    if (ms <= 0 || isReduced() || (V.ctx && V.ctx.skip)) return res();
    const done = () => { clearTimeout(t); V.waiters.delete(done); res(); };
    const t = setTimeout(done, ms);
    V.waiters.add(done);
  });
}
function kitCue(c, ctx) {
  const reduced = isReduced() || ctx.skip;
  let p;
  try { p = V.kit && V.kit.cue ? V.kit.cue(c, { scene: ctx.scene, beat: ctx.beat, reduced }) : null; } catch (e) { console.error("kit.cue:", e); p = null; }
  kick();
  if (!p || typeof p.then !== "function") return Promise.resolve();
  // A kit that never resolves must not freeze the story.
  const cap = reduced ? 300 : 6000;
  return new Promise(res => {
    const t = setTimeout(() => { console.warn("kit cue did not resolve in time:", c.type); kitCall("finish"); res(); }, cap);
    p.then(() => { clearTimeout(t); res(); }, e => { clearTimeout(t); console.error("kit cue:", e); res(); });
  });
}
// The frame loop runs only while the kit says something moves, and never when reduced or hidden.
function kick() {
  const k = V.kit;
  if (!k || typeof k.tick !== "function") return;
  if (isReduced() || document.hidden) { try { k.tick(performance.now()); } catch (e) { console.error(e); } return; }
  if (!V.rafId) V.rafId = requestAnimationFrame(loop);
}
function loop(t) {
  V.rafId = 0;
  let more = false;
  try { more = !!V.kit.tick(t); } catch (e) { console.error("kit.tick:", e); }
  if (more && !isReduced() && !document.hidden) V.rafId = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- HUD
function buildHud() {
  const box = $("meters"); box.innerHTML = "";
  for (const m of METERS) {
    if (m.hud === false) continue;
    V.shown.meters[m.id] = m.start == null ? m.min : m.start;
    V.shown.high[m.id] = V.shown.meters[m.id];
    box.appendChild(el(`<div class="meter" data-meter="${esc(m.id)}" role="meter" aria-label="${esc(m.label)}" aria-valuemin="${m.min}" aria-valuemax="${m.max}">
      <div class="m-top"><span class="m-name">${esc(m.label)}</span><span class="m-val"></span></div>
      <div class="pips" aria-hidden="true"></div><span class="m-delta" hidden aria-hidden="true"></span><span class="m-flash" aria-hidden="true"></span></div>`));
    setMeter(m.id, V.shown.meters[m.id]);
  }
  renderTallies();
}
function setMeter(id, value, animate) {
  const m = METERS.find(x => x.id === id), node = document.querySelector(`.meter[data-meter="${CSS.escape(id)}"]`);
  if (!m || !node) return;
  V.shown.meters[id] = value;
  V.shown.high[id] = Math.max(V.shown.high[id] == null ? value : V.shown.high[id], value);
  const span = m.max - m.min;
  node.setAttribute("aria-valuenow", value);
  node.setAttribute("aria-valuetext", `${value} of ${m.max}`);
  node.querySelector(".m-val").innerHTML = `${esc(value)}<small> / ${esc(m.max)}</small>`;
  const pips = node.querySelector(".pips");
  if (span > 12) { pips.innerHTML = `<span class="bar-track" style="flex:1 1 auto;margin:0"><i style="--p:${(value - m.min) / span}"></i></span>`; return; }
  const high = V.shown.high[id];
  const cls = i => { const at = m.min + i; return "pip" + (at <= value ? " on" : at <= high ? " spent" : ""); };
  // The pips are built once. A change toggles a class on the pip that changed (never innerHTML), and that pip fades in over --m-state
  // (MOTION section 3: the pip fills). Calm and reduced motion start nothing.
  if (pips.children.length !== span || pips.firstElementChild.classList.contains("bar-track")) {
    let h = "";
    for (let i = 1; i <= span; i++) h += `<span class="${cls(i)}"></span>`;
    pips.innerHTML = h;
    return;
  }
  for (let i = 1; i <= span; i++) {
    const pip = pips.children[i - 1], c = cls(i);
    if (pip.className === c) continue;
    pip.className = c;
    if (animate && !isReduced()) pip.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: M.state, easing: M.easeOut });
  }
}
function syncHud(v) {
  for (const m of METERS) { if (m.hud !== false && v.meters[m.id] != null) setMeter(m.id, v.meters[m.id]); }
  V.shown.tallies = JSON.parse(JSON.stringify(v.tallies || {}));
  renderTallies();
  const met = metSet(v);
  $("notesCount").textContent = met.size ? String(met.size) : "";
  $("notesBtn").setAttribute("aria-label", met.size ? `Notes, ${met.size}` : "Notes");
}
function renderTallies() {
  const box = $("tallies");
  const parts = TALLY_IDS.map(id => {
    const t = V.shown.tallies[id] || {};
    const vals = TALLY_VALUES[id] || Object.keys(t);
    if (!vals.length) return "";
    const lab = id.charAt(0).toUpperCase() + id.slice(1);
    return `<span data-tally="${esc(id)}"><b>${esc(lab)}</b> ${vals.map(x => `<i data-v="${esc(x)}">${esc(x)} ${t[x] || 0}</i>`).join(", ")}</span>`;
  }).filter(Boolean);
  box.innerHTML = parts.join("");
}
// The `tally` cue: the reading that moved gets one small flash. Calm and reduced motion get a still mark instead.
function flashTally(id, value) {
  const node = document.querySelector(`#tallies [data-tally="${CSS.escape(id)}"] [data-v="${CSS.escape(value)}"]`);
  if (!node) return;
  node.classList.add("bump");
  clearTimeout(flashTally.t); flashTally.t = setTimeout(() => node.isConnected && node.classList.remove("bump"), M.hold);
  if (!isReduced()) node.animate([{ opacity: 0.25, transform: "scale(1.18)" }, { opacity: 1, transform: "none" }], { duration: M.flash, easing: M.easeOut });
}
function flashEdge() {
  const now = performance.now();
  if (now - V.lastFlash < M.flashGap) return false;
  V.lastFlash = now;
  if (isReduced()) return false;
  const fr = [{ opacity: M.flashAlpha }, { opacity: 0 }];
  $("edge").animate(fr, { duration: M.flash, easing: M.easeOut });
  return true;
}
function showDelta(id, d, kind) {
  const node = document.querySelector(`.meter[data-meter="${CSS.escape(id)}"]`);
  if (!node) return;
  const lab = node.querySelector(".m-delta");
  lab.textContent = `${sgn(d)} ${meterLabel(id)}`;
  lab.className = "m-delta " + (kind === "cost" ? "neg" : "pos");
  lab.hidden = false;
  // MOTION section 3: a cost rises in, a gain falls in. The direction is the cue's, not the number's sign (a cost on a bad meter is a plus).
  if (!isReduced()) lab.animate([{ opacity: 0, transform: `translateY(${kind === "cost" ? M.d1 : -M.d1}px)` }, { opacity: 1, transform: "none" }], { duration: M.state, easing: M.easeOut });
  clearTimeout(lab._t); lab._t = setTimeout(() => { lab.hidden = true; }, M.hold);
  if (kind === "cost" && flashEdge() && !isReduced()) node.querySelector(".m-flash").animate([{ opacity: M.flashAlpha }, { opacity: 0 }], { duration: M.flash, easing: M.easeOut });
}
function showCueTag(text) {
  const t = $("cuetag"); t.textContent = text; t.hidden = false;
  if (!isReduced()) t.animate([{ opacity: 0, transform: "translateX(-50%) translateY(-4px)" }, { opacity: 1, transform: "translateX(-50%)" }], { duration: M.state, easing: M.easeOut });
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, M.hold);
}

// ---------------------------------------------------------------- notes met
function metSet(v) {
  const s = new Set();
  for (const id of (v && v.met) || []) if (NOTES[id]) s.add(id);
  for (const id of V.extraMet) if (NOTES[id]) s.add(id);
  return s;
}

// ---------------------------------------------------------------- panels
function parseEm(s) {
  const out = []; let em = false;
  for (const part of String(s).split("*")) { if (part) out.push({ t: part, em }); em = !em; }
  return out;
}
const segHtml = (segs, n) => {
  let left = n, d = "", r = "";
  for (const s of segs) {
    const a = s.t.slice(0, Math.max(0, left)), b = s.t.slice(a.length);
    left -= a.length;
    if (a) d += s.em ? `<em>${esc(a)}</em>` : esc(a);
    if (b) r += s.em ? `<em>${esc(b)}</em>` : esc(b);
  }
  return [d, r];
};
function avatar(id) {
  const c = PACK.cast && PACK.cast.people && PACK.cast.people[id];
  if (!c) return "";
  const who = `<span class="who-t"><b>${esc(c.name)}</b>${c.role ? `<small>${esc(c.role)}</small>` : ""}</span>`;
  const fin = v => typeof v === "number" && Number.isFinite(v);
  // A cast entry with no crop (x, y and r) has no face on the sheet: draw a still placeholder, not the sheet's top-left corner.
  if (!fin(c.x) || !fin(c.y) || !fin(c.r) || c.r <= 0 || !fin(PACK.cast.w) || !fin(PACK.cast.h)) {
    return `<div class="who"><span class="ava ava-none" aria-hidden="true"></span>${who}</div>`;
  }
  const size = 44, k = size / (2 * c.r);
  const style = `background-size:${PACK.cast.w * k}px ${PACK.cast.h * k}px;background-position:${-(c.x - c.r) * k}px ${-(c.y - c.r) * k}px`;
  return `<div class="who"><span class="ava" style="${style}" aria-hidden="true"></span>${who}</div>`;
}
function chipsHtml(ids) {
  const list = (ids || []).filter(id => NOTES[id]);
  list.forEach(id => V.extraMet.add(id));
  if (!list.length) return "";
  return `<div class="chips">${list.map(id => `<button type="button" class="chip" data-note="${esc(id)}"><span aria-hidden="true">&#9432;</span> ${esc(NOTES[id].term)}<span class="sr-only"> (note)</span></button>`).join("")}</div>`;
}
function trackHtml(id) {
  const n = id && NOTES[id];
  if (!n || !COMMENTARY) return "";
  V.extraMet.add(id);
  return `<aside class="track late" data-kind="${esc(n.kind)}" aria-label="${esc(COMMENTARY.label)}"><span class="t-label">${esc(COMMENTARY.label)}</span><b>${esc(n.term)}.</b> ${esc(n.text)}</aside>`;
}
const lookTag = look => look === "ink" || look === "paint" ? `<span class="tag" data-k="${look}">${ASK_MAP[look]}</span>` : "";
const gateParts = (gate, cost) => gate === "plan" ? ["Planning", "free"] : gate === "exec" ? ["Execution", "final"] : [cost ? cost.n + " " + meterLabel(cost.meter) : "Fate", "final"];
const gateWord = (gate, cost) => gateParts(gate, cost).join(" · ");
// What a screen reader says when a choice appears: words, no dot. "Execution, final."
const gateSay = (gate, cost) => gate === "plan" ? "Planning, free" : gate === "exec" ? "Execution, final" : cost ? `Spends ${cost.n} ${meterLabel(cost.meter)}, final` : "Fate point, final";
let gateSeq = 0;
function gateTag(gate, cost, id) {
  const glyph = gate === "exec" ? `<span class="seal-glyph" aria-hidden="true"></span>` : gate === "fate" ? `<span class="star" aria-hidden="true">&#9733;</span>` : "";
  const [a, b] = gateParts(gate, cost);
  // The dot is for the eye; the space after it keeps the two words apart for a screen reader.
  return `<span class="gate" data-gate="${gate}"${id ? ` id="${id}"` : ""}>${glyph}${esc(a)}<span aria-hidden="true"> &middot;</span> ${esc(b)}</span>`;
}

// A slide holds one panel (and sometimes a commentary track). Slides enter and leave with a direction.
function slideHtml(inner, cls) { return `<div class="sl ${cls || ""}">${inner}</div>`; }
function enterFrames(dir, fade) {
  return fade ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateX(${dir * M.d5}px)` }, { opacity: 1, transform: "translateX(0)" }];
}
function retire(old, dir, fade, instant) {
  if (!old) return;
  // A button that held focus goes inert with its panel; let go of focus so the keys keep working (Enter on a dead button does nothing).
  if (old.contains(document.activeElement) && document.activeElement !== document.body) { try { document.activeElement.blur(); } catch (e) {} }
  old.setAttribute("inert", ""); old.setAttribute("aria-hidden", "true"); old.classList.add("out");
  if (isReduced() || instant) { gone(old); return; }
  const a = old.animate(fade ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: `translateX(${-dir * M.d5}px)` }],
    { duration: fade ? M.state : M.out, easing: M.easeIn, fill: "forwards" });
  const done = () => gone(old);
  a.onfinish = done; a.oncancel = done;
}
const fadeOnly = () => KIT_ID === "feed"; // a hard cut does not slide
function clearOutgoing() { for (const x of $("slides").querySelectorAll(".sl.out")) gone(x); } // at most one panel leaves at a time
// A panel slides (--m-in, 48 px) only when the step has a `turn`: time passes. Any other new panel (a beat, a choice, a roll, a `shift`)
// crossfades by opacity over --m-state. The feed kit never slides.
function showSlide(sl, dir, instant, slide) {
  const old = V.slide, fade = !slide || fadeOnly();
  clearOutgoing();
  V.slide = sl;
  $("slides").appendChild(sl);
  if (old && old !== sl) retire(old, dir, fade, instant);
  if (!isReduced() && !instant) sl.animate(enterFrames(dir, fade), { duration: fade ? M.state : M.in, easing: M.easeOut, fill: "backwards" });
  watchOverflow(sl);
}
// A panel or track that scrolls says so (data-overflow="1" while there is more below) and can be reached by keyboard.
function syncOverflow(e) {
  const over = e.scrollHeight > e.clientHeight + 1;
  const atEnd = e.scrollTop + e.clientHeight >= e.scrollHeight - 1;
  if (over && !atEnd) e.setAttribute("data-overflow", "1"); else e.removeAttribute("data-overflow");
  if (over) {
    if (e.dataset.scr !== "1") { e.dataset.scr = "1"; e.dataset.lab = e.getAttribute("aria-label") || ""; }
    e.tabIndex = 0; e.setAttribute("role", "region"); e.setAttribute("aria-label", (e.dataset.lab || "Passage") + ", scrollable");
  } else if (e.dataset.scr === "1") {
    e.dataset.scr = ""; e.removeAttribute("tabindex"); e.removeAttribute("role");
    if (e.dataset.lab) e.setAttribute("aria-label", e.dataset.lab); else e.removeAttribute("aria-label");
  }
}
function watchOverflow(sl) {
  const els = [...sl.querySelectorAll(".panel, .track")];
  if (!els.length) return;
  const run = () => els.forEach(syncOverflow);
  for (const e of els) e.addEventListener("scroll", () => syncOverflow(e), { passive: true });
  if (window.ResizeObserver) { try { sl._ro = new ResizeObserver(run); els.forEach(e => sl._ro.observe(e)); } catch (e) {} }
  requestAnimationFrame(run);
}
window.addEventListener("resize", () => { if (V.slide) V.slide.querySelectorAll(".panel, .track").forEach(syncOverflow); });
const gone = n => { if (n._ro) { n._ro.disconnect(); n._ro = null; } n.remove(); };
function dropSlide(dir) { // retire the current panel now (the turn cue)
  const old = V.slide;
  if (!old) return;
  clearOutgoing();
  V.slide = null;
  retire(old, dir, fadeOnly(), false);
}

function titleSlide() {
  const cont = canContinue();
  const found = V.found.size;
  const sl = el(slideHtml(`<section class="panel title-panel" aria-label="${esc(PACK.title)}">
      <p class="title-name">${esc(PACK.title)}</p>${PACK.subtitle ? `<p class="title-sub">${esc(PACK.subtitle)}</p>` : ""}
      <p class="fine">Endings found: ${found} of ${ENDING_IDS.length}</p>
      <div class="row">
        ${cont ? `<button type="button" class="btn primary" id="contBtn">Continue</button><button type="button" class="btn" id="beginBtn">New game</button>`
               : `<button type="button" class="btn primary" id="beginBtn">Begin</button>`}
        <button type="button" class="btn" data-act="help">How to play</button>
      </div></section>`, "mid"));
  return sl;
}
function cardSlide(scene) {
  let inner = "";
  const sc = scene || { title: "", place: "" };
  try { inner = V.kit && V.kit.card ? V.kit.card(sc) : ""; } catch (e) { console.error("kit.card:", e); }
  if (!inner) inner = `<div class="scene-card">${sc.ending ? `<p class="card-place">Ending</p>` : sc.place ? `<p class="card-place">${esc(sc.place)}</p>` : ""}<h2 class="card-title">${esc(sc.title)}</h2><div class="card-rule"></div></div>`;
  return el(slideHtml(`<section class="panel card-panel" data-look="${esc(sc.look || "")}" aria-label="Scene">${inner}<div class="tags" style="justify-content:center;margin:8px 0 0">${lookTag(sc.look)}</div></section>`, "mid"));
}

function beatSlide(v) {
  const b = v.beat, look = b.look || (v.scene ? v.scene.look : ""); // the beat's effective look
  if (b.hidden) {
    const tag = KIT_ID === "feed" ? "Unwitnessed" : "Referee only";
    return { el: el(slideHtml(`<section class="panel is-secret" data-look="ink" aria-label="Hidden note">
        <div class="tags"><span class="tag" data-k="secret">${tag}</span></div>
        <p class="secret-note">A note is sealed here. Reveal it when you are ready. It is yours to open.</p>
        <div class="row" style="margin-top:0"><button type="button" class="btn primary" data-act="reveal">Reveal${keysOn() ? ' <span class="kbd-hint" aria-hidden="true">R</span>' : ""}</button></div></section>`)),
      say: keysOn() ? "Hidden note. Use the Reveal button, or press R." : "Hidden note. Use the Reveal button.", typing: null };
  }
  const segs = parseEm(b.text);
  const secret = b.reveal;
  const tags = secret ? `<span class="tag" data-k="secret">${KIT_ID === "feed" ? "Unwitnessed" : "Referee only"}</span>` : lookTag(look);
  // The kit draws a screen itself when it has screen(lines); the panel then keeps a copy for screen readers only
  // (.screen-copy: on a short screen, where the panel covers the stage, style.css shows it).
  const screen = b.screen ? `<div class="${kitHas("screen") ? "sr-only screen-copy" : "screen late"}" role="group" aria-label="Screen">${b.screen.map(l => esc(l)).join("\n")}</div>` : "";
  const html = slideHtml(`<section class="panel ${secret ? "is-secret" : ""}" data-look="${esc(secret ? "ink" : look)}" aria-label="Passage">
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      ${b.kicker ? `<p class="kicker">${esc(b.kicker)}</p>` : ""}
      ${b.speaker ? avatar(b.speaker) : ""}
      <p class="txt" aria-hidden="true"></p><span class="sr-only sr-copy">${esc(plain(b.text))}</span>
      ${screen}${chipsHtml(b.notes)}</section>${trackHtml(b.comment)}`);
  const node = el(html);
  return { el: node, say: plain(b.text), typing: { segs, ref: b.ref + (secret ? "!" : ""), total: segs.reduce((n, s) => n + s.t.length, 0) } };
}

function choiceSlide(v) {
  const g = v.group; // the engine puts the group's notes and comment in view().group
  const notes = g.notes || [];
  const opts = v.options.map((o, i) => {
    const locked = o.locked;
    return `<li><button type="button" class="opt" data-key="${esc(o.key)}" data-gate="${g.gate}" ${locked ? 'aria-disabled="true"' : ""}>
      <span class="o-n" aria-hidden="true">${i + 1}</span>
      <span class="o-body"><span class="o-label">${esc(o.label)}</span>${o.sub ? `<span class="o-sub">${esc(o.sub)}</span>` : ""}${locked && o.hint ? `<span class="o-hint">${esc(o.hint)}</span>` : ""}</span>
      <span class="o-seal"><span class="seal-glyph" aria-hidden="true"></span>Sealed</span></button></li>`;
  }).join("");
  const gid = "gate-" + (++gateSeq);
  const html = slideHtml(`<section class="panel choice" data-look="${esc(v.scene ? v.scene.look : "")}" aria-label="Choice">
      <div class="tags">${gateTag(g.gate, g.cost, gid)}</div>
      <h2 class="ask" tabindex="-1" aria-describedby="${gid}">${esc(g.ask)}</h2>
      ${chipsHtml(notes)}
      <ul class="opts">${opts}</ul><p class="sealed-note" hidden>Sealed. No going back.</p></section>${trackHtml(g.comment)}`);
  const node = el(html);
  return { el: node, say: `${gateSay(g.gate, g.cost)}. ${g.ask}`, focus: ".ask" };
}

function resultWord(r) { return { fail: "Fail", success: "Success", tie: "Tie", style: "Style" }[r] || r; }
function faceText(dice, f) { return /dF$/i.test(dice) ? (f > 0 ? "+" : f < 0 ? "−" : "0") : String(f); }
function rollLine(info) {
  const dF = /dF$/i.test(info.dice);
  const sum = info.faces.reduce((a, b) => a + b, 0);
  const faces = dF ? info.faces.map(f => faceText(info.dice, f)).join(" ") + ` (${sgn(sum)})` : info.faces.join(" + ");
  const add = info.add ? ` ${info.add < 0 ? "−" : "+"} ${Math.abs(info.add)}` : "";
  return `${info.dice}: ${faces}${add} = ${info.total} vs ${info.vs}`;
}
// The meter a roll adds, for the spoken line ("plus 3 for Code"). A pick names its option; with no pick (Back, Continue) the scene's rolls
// that match the dice and the target decide, when they agree.
function rollMeter(info, ref, v) {
  const sc = ref ? sceneById[ref.scene] : v && v.scene ? sceneById[v.scene.id] : null;
  if (!sc) return null;
  const adds = new Set();
  for (const g of sc.choices || []) {
    if (ref && g.key !== ref.group) continue;
    for (const o of g.options || []) {
      if (ref && o.key !== ref.opt) continue;
      if (o.roll && (ref || (o.roll.dice === info.dice && o.roll.vs === info.vs))) adds.add(o.roll.add || "");
    }
  }
  return adds.size === 1 && [...adds][0] ? [...adds][0] : null;
}
const spokenNum = n => n < 0 ? "minus " + Math.abs(n) : String(n);
// The roll in words, never in symbols: "plus, minus, blank, minus, plus 3 for Code: total 2 against 2".
function rollWords(info, meterId) {
  const dF = /dF$/i.test(info.dice);
  const faces = info.faces.map(f => dF ? (f > 0 ? "plus" : f < 0 ? "minus" : "blank") : String(f)).join(", ");
  const add = info.add ? `, ${info.add < 0 ? "minus" : "plus"} ${Math.abs(info.add)}${meterId ? " for " + meterLabel(meterId) : ""}` : "";
  return `${faces}${add}: total ${spokenNum(info.total)} against ${info.vs}`;
}
const rollPlain = (info, meterId) => `${rollWords(info, meterId)}. ${resultWord(info.result)}`; // (announce() joins parts with ". ")
function rollSlide(info, pending, meterId) {
  const dF = /dF$/i.test(info.dice);
  const dice = info.faces.map(f => `<span class="die ${pending ? "pending" : ""}" aria-hidden="true">${pending ? "?" : esc(faceText(info.dice, f))}</span>`).join("");
  const addHtml = info.add ? `<span class="op" aria-hidden="true">${info.add < 0 ? "−" : "+"} ${Math.abs(info.add)}</span>` : "";
  const text = pending ? "Rolling…" : `${rollLine(info)}: `;
  const html = slideHtml(`<section class="panel roll-panel" data-look="${esc(V.view && V.view.scene ? V.view.scene.look : "")}" aria-label="Roll">
      <div class="tags">${gateTag("exec")}</div>
      <p class="roll-ask">The dice decide${dF ? " (four Fate dice)" : ""}</p>
      <div class="dice" role="img" aria-label="${esc(pending ? "Rolling" : rollWords(info, meterId))}">${dice}${pending ? "" : addHtml}</div>
      <p class="roll-line ${pending ? "pending" : ""}" data-r="${pending ? "" : esc(info.result)}"><span class="rl-t" aria-hidden="true">${esc(text)}</span>${pending ? "" : `<span class="res">${esc(resultWord(info.result))}</span>`}</p></section>`);
  return el(html);
}

function inputSlide(v) {
  const i = v.input;
  const html = slideHtml(`<section class="panel input-panel" data-look="${esc(v.scene ? v.scene.look : "")}" aria-label="Write">
      <form class="in-form" novalidate>
        <label class="ask" for="inField">${esc(i.prompt)}</label>
        <input class="field" id="inField" type="text" maxlength="${i.max}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
        <div class="field-meta"><span>Goes on your card: ${esc(fieldLabel(i.field))}</span><span id="inCount">0 / ${i.max}</span></div>
        <div class="row"><button type="submit" class="btn primary">Write it down</button></div>
      </form></section>`);
  return { el: el(html), say: "", focus: "#inField" };
}

function endingSlide(v) {
  const e = v.ending;
  const html = slideHtml(`<section class="panel ending" data-look="${esc(e.look || "")}" data-ending="${esc(e.id != null ? e.id : "")}" aria-label="Ending">
      <div class="tags"><span class="tag">Ending</span>${lookTag(e.look)}</div>
      <h2 class="end-title" tabindex="-1">${esc(e.title)}</h2>
      <p class="fine" style="margin-top:0">Endings found: ${V.found.size} of ${ENDING_IDS.length}</p>
      <div class="row">
        <button type="button" class="btn primary" data-act="again">Play again</button>
        <button type="button" class="btn" data-act="card">Card</button>
        <button type="button" class="btn" data-act="copy">Copy result</button>
        <button type="button" class="btn" data-act="verify">Verify</button>
      </div></section>`);
  return { el: el(html), say: "", focus: ".end-title" };
}

// ---------------------------------------------------------------- typewriter
function stopTyping() { if (V.typing) { V.typing.finish(true); } }
function startTyping(slide, spec, done) {
  const txt = slide.querySelector(".txt"), panel = slide.querySelector(".panel");
  const paint = (n, caret) => {
    const [d, r] = segHtml(spec.segs, n);
    txt.innerHTML = `<span class="t-done">${d}</span>${caret ? '<span class="caret" aria-hidden="true"></span>' : ""}<span class="t-rest">${r}</span>`;
  };
  const key = spec.ref;
  const instant = isReduced() || V.seen.has(key) || spec.total === 0;
  // 28 ms a character, but no beat takes longer than TYPE_MAX to type: a long beat types faster (SPEC section 4).
  const per = Math.min(M.type, TYPE_MAX / Math.max(1, spec.total));
  V.seen.add(key);
  if (instant) { paint(spec.total, false); slide.classList.add("done"); panel.classList.add("done"); if (done) done(); return; }
  let rf = 0, last = -1, ended = false;
  const t0 = performance.now();
  const finish = silent => {
    if (ended) return; ended = true;
    cancelAnimationFrame(rf);
    paint(spec.total, false); slide.classList.add("done"); panel.classList.add("done");
    V.typing = null;
    if (!silent && done) done();
  };
  const frame = now => {
    const n = Math.min(spec.total, Math.floor((now - t0) / per));
    if (n !== last) { if (Math.floor(n / 4) !== Math.floor(Math.max(last, 0) / 4)) snd.tick(); last = n; paint(n, true); }
    if (n >= spec.total) finish(false); else rf = requestAnimationFrame(frame);
  };
  V.typing = { finish };
  paint(0, true);
  rf = requestAnimationFrame(frame);
}
function finishTyping() { if (V.typing) V.typing.finish(false); }

// ---------------------------------------------------------------- cues
async function playCue(c, ctx) {
  const reduced = isReduced() || ctx.skip;
  const v = ctx.v;
  snd.cue(c);
  let shell = Promise.resolve();
  switch (c.type) {
    case "turn":
      ctx.say.push(`${v.scene ? v.scene.title : ""}${v.scene && v.scene.place ? ", " + v.scene.place : ""}`);
      break;
    case "seal": {
      sealPanel(ctx.pickKey);
      ctx.say.push("Sealed");
      shell = wait(M.state);
      break;
    }
    case "tear":
      showCueTag("★ 1 FP spent");
      ctx.say.push("Fate point spent");
      break;
    case "roll": {
      const info = { dice: c.dice, faces: c.faces, total: c.total, add: c.add, vs: c.vs, result: c.result, used: c.used };
      const mid = rollMeter(info, ctx.pickRef, v);
      const sl = rollSlide(info, !reduced, mid);
      V.rollEl = sl;
      showSlide(sl, 1, false, false); // a roll crossfades in: no time has passed
      shell = wait(M.roll).then(() => {
        const done = rollSlide(info, false, mid);
        sl.innerHTML = done.innerHTML;
      });
      ctx.say.push(rollPlain(info, mid));
      break;
    }
    case "cost":
    case "gain": {
      const cur = V.shown.meters[c.meter], d = cueDelta(c);
      if (cur != null) setMeter(c.meter, cur + d, true);
      showDelta(c.meter, d, c.type); // the sign is the number's; cost or gain is the colour and the direction of the label
      // Words, with the direction: a cost on a stress meter makes it rise ("Nerves rises by 1").
      ctx.say.push(`${c.type === "cost" ? "Cost" : "Gain"}: ${meterLabel(c.meter)} ${d < 0 ? "falls" : "rises"} by ${Math.abs(d)}`);
      shell = wait(c.type === "cost" ? M.flash : M.state);
      break;
    }
    case "tally": {
      const t = V.shown.tallies[c.id] || (V.shown.tallies[c.id] = {});
      const final = v.tallies && v.tallies[c.id] ? v.tallies[c.id][c.value] : null;
      t[c.value] = (t[c.value] || 0) + 1;
      if (final != null && t[c.value] > final) t[c.value] = final;
      renderTallies();
      flashTally(c.id, c.value);
      ctx.say.push(`${c.id.charAt(0).toUpperCase() + c.id.slice(1)}, ${c.value}`);
      shell = wait(M.state);
      break;
    }
    case "close":
      ctx.say.push(v.ending ? v.ending.title : "The end");
      break;
  }
  await Promise.all([kitCue(c, ctx), shell]);
}

function sealPanel(key) {
  V.sealed = true;
  const sl = V.slide;
  if (!sl) return;
  for (const b of sl.querySelectorAll(".opt")) {
    if (b.dataset.key === key) { b.classList.add("sealed"); b.setAttribute("aria-pressed", "true"); }
    else { b.classList.add("spent"); b.setAttribute("aria-disabled", "true"); }
  }
  const n = sl.querySelector(".sealed-note"); if (n) n.hidden = false;
  deckUI();
}

function skipCues() {
  if (!V.cueBusy) return;
  if (V.ctx) V.ctx.skip = true;
  kitCall("finish");
  for (const f of [...V.waiters]) f();
}

// ---------------------------------------------------------------- present: one step of the story
async function present(v, o) {
  const tk = ++V.token;
  o = o || {};
  const cues = v.cues || [];
  const turn = cues.find(c => c.type === "turn");
  const hasShift = cues.some(c => c.type === "shift");
  const dir = turn ? (turn.dir || 1) : (o.dir || 1);
  const ctx = { skip: false, scene: v.scene, beat: v.beat, v, setChange: !!turn || hasShift, pickKey: o.pickKey, pickRef: o.pickRef || null, say: [] };
  V.ctx = ctx; V.cueBusy = true; V.rollEl = null; V.sealed = false;
  root.setAttribute("data-cue", "");
  setBusy();
  stopTyping(); clearAuto();

  const setId = v.scene && v.scene.set;
  if (setId && (o.fresh || o.instant || ctx.setChange || V.setId !== setId)) { kitShow(setId, v, !ctx.setChange || !!o.instant); V.setId = setId; }
  if (turn) dropSlide(dir);

  for (const c of cues) {
    if (tk !== V.token) return;
    await playCue(c, ctx); // the engine sends ink and bloom only when the look changes: play what it sends
  }
  if (tk !== V.token) return;

  V.cueBusy = false; V.ctx = null;
  root.removeAttribute("data-cue");
  syncHud(v);
  kitUpdate(v);
  record(v);
  setPlace(v);
  setNode(v);

  const card = !!v.scene && ((turn && dir > 0) || o.fresh) && !o.noCard;
  if (card) {
    V.phase = "card"; $("app").dataset.phase = "card";
    kitCall("screen", []);
    showSlide(cardSlide(v.scene), dir, false, true); // the card arrives with the turn
    announce(ctx.say.filter(Boolean));
    deckUI(); armAuto();
  } else {
    V.phase = "play"; $("app").dataset.phase = "play";
    renderNode(v, dir, ctx.say, Object.assign({}, o, { slide: !!turn || !!o.fresh })); // only a turn (or the first scene) slides the text
  }
  setBusy();
}

function renderNode(v, dir, say, o) {
  say = (say || []).filter(Boolean);
  o = o || {};
  setNode(v);
  let built = null, slide;
  if (v.node === "roll") {
    if (V.rollEl && V.rollEl.isConnected && V.slide === V.rollEl) { slide = V.rollEl; V.rollEl = null; }
    else if (v.roll) { const mid = rollMeter(v.roll, null, v); slide = rollSlide(v.roll, false, mid); say.push(rollPlain(v.roll, mid)); showSlide(slide, dir, o.instant, o.slide); }
    else return;
  } else {
    built = v.node === "beat" ? beatSlide(v) : v.node === "choice" ? choiceSlide(v) : v.node === "input" ? inputSlide(v)
      : v.node === "ending" ? endingSlide(v) : null;
    if (!built) return;
    slide = built.el;
    showSlide(slide, dir, o.instant, o.slide);
    if (built.say) say.push(built.say);
  }
  kitCall("screen", v.node === "beat" && v.beat && !v.beat.hidden && v.beat.screen ? v.beat.screen : []);
  announce(say);
  if (built && built.typing) startTyping(slide, built.typing, () => { deckUI(); armAuto(); });
  else if (v.node === "beat" || v.node === "roll") { slide.classList.add("done"); }
  if (built && built.focus) { const f = slide.querySelector(built.focus); if (f) f.focus({ preventScroll: true }); }
  if (v.node === "ending") { slide.classList.add("done"); }
  if (v.node === "choice") slide.classList.add("done");
  deckUI();
  if (!(built && built.typing && V.typing)) armAuto();
}

// #app[data-node] and #app[data-ending] follow the view. The ending id is there for tests and kits; it is absent at any other node.
function setNode(v) {
  const app = $("app");
  app.dataset.node = v.node || "";
  if (v.node === "ending" && v.ending && v.ending.id != null) app.dataset.ending = v.ending.id; else delete app.dataset.ending;
}
function setPlace(v) {
  $("place").textContent = v.scene && v.scene.place ? v.scene.place : "";
  $("brandSub").textContent = `Endings found ${V.found.size} of ${ENDING_IDS.length}`;
}
function setBusy() { $("app").dataset.busy = (V.cueBusy || V.typing) ? "1" : "0"; }

// ---------------------------------------------------------------- deck
function deckUI() {
  const v = V.view, back = $("backBtn"), next = $("nextBtn"), hint = $("hint");
  setBusy();
  if (V.phase === "title" || !v) {
    // At the title Next acts as the main button (Begin, or Continue when there is a save), on every device.
    const cont = canContinue();
    back.disabled = true; next.disabled = false;
    next.innerHTML = `${cont ? "Continue" : "Begin"} <span aria-hidden="true">&rarr;</span>`;
    hint.textContent = isTouch() ? `Tap ${cont ? "Continue" : "Begin"}.` : cont ? "Press Enter to continue." : "Press Enter to begin.";
    return;
  }
  back.disabled = !v.canBack || V.sealed;
  let nextLabel = 'Next <span aria-hidden="true">&rarr;</span>', h = "", off = false;
  if (V.cueBusy) h = "Tap to skip the motion.";
  else if (V.typing) h = "Tap to finish the line.";
  else if (V.phase === "card") h = "Tap or press → to open the scene.";
  else if (v.node === "beat") {
    if (v.beat && v.beat.hidden) { nextLabel = 'Reveal <span aria-hidden="true">&rarr;</span>'; h = keysOn() ? "Press R to reveal the note." : "Tap Reveal."; }
    else h = "Tap or press → to go on.";
  } else if (v.node === "choice") {
    off = true;
    h = V.sealed ? "Sealed. No going back." : `${gateWord(v.group.gate, v.group.cost)}. ${keysOn() ? "Press " + (v.options.length > 2 ? "1 to " + v.options.length : v.options.length === 2 ? "1 or 2" : "1") : "Tap an option"}.`;
    if (v.group.gate === "plan" && !V.sealed) h += " You can go back.";
  } else if (v.node === "input") { off = true; h = "Type, then press Enter."; }
  else if (v.node === "roll") h = "Tap or press → to go on.";
  else if (v.node === "ending") { off = true; h = `Endings found ${V.found.size} of ${ENDING_IDS.length}.`; }
  next.innerHTML = nextLabel;
  next.disabled = off && !V.cueBusy && !V.typing;
  if (V.settings.auto && !off) h += " AUTO is on.";
  hint.textContent = h;
  setFoot(footPlay(v));
}
// The seed line. A touch screen has no room for it under the deck: it moves into the Settings sheet.
function footPlay(v) {
  const seed = v && v.seed != null ? v.seed : V.seedPending;
  return `Seed ${seed}${V.replaying ? " · replay" : ""} · ${runUrl(seed)} repeats this run${ignoredNote()}`;
}
const footTitle = () => `Seed ${V.seedPending}${V.force.length ? " (set by ?seed or ?force)" : V.seedFixed ? " (set by ?seed)" : ""}${ignoredNote()}`;
function setFoot(text) {
  V.footText = text;
  const f = $("foot"), t = isTouch();
  f.textContent = t ? "" : text;
  f.hidden = t;
  if (t && V.sheet === "settings") renderSettings();
}
// The query that repeats this run: the seed, and the forced tiers when ?force= was given.
const runUrl = seed => `?seed=${seed}${V.force.length ? "&force=" + V.force.join(",") : ""}`;
const ignoredNote = () => V.forceIgnored.length ? ` · ignored in ?force: ${V.forceIgnored.join(", ")}` : "";

// ---------------------------------------------------------------- film mode
function clearAuto() {
  clearTimeout(V.autoT); V.autoT = null;
  const f = $("autoFill"); f.getAnimations().forEach(a => a.cancel());
}
function armAuto() {
  clearAuto();
  if (!V.settings.auto || !V.view || V.sheet || document.hidden || V.cueBusy || V.typing) return;
  const v = V.view;
  let len = 0;
  if (V.phase === "card") len = (v.scene ? (v.scene.title + v.scene.place).length : 0);
  else if (V.phase === "play" && v.node === "beat" && v.beat && !v.beat.hidden) len = v.beat.text.length;
  else return; // AUTO stops at every choice, roll, input, reveal and ending
  const ms = Math.min(14000, M.autoBase + len * M.autoChar) * SPEED[V.settings.speed];
  if (!isReduced()) $("autoFill").animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: ms, easing: M.easeLinear });
  V.autoT = setTimeout(() => { V.autoT = null; advance(); }, ms);
}
function syncAutoBtn() {
  const b = $("autoBtn"), on = !!V.settings.auto;
  // One fixed name; aria-pressed says whether film mode is on (WCAG 2.5.3: the name holds the visible word).
  b.setAttribute("aria-pressed", String(on));
  b.textContent = "AUTO";
  b.setAttribute("aria-label", "Film mode (AUTO)");
}
function setAuto(on) {
  V.settings.auto = !!on;
  syncAutoBtn();
  announce(on ? "AUTO on" : "AUTO off");
  persistSettings();
  if (on) armAuto(); else clearAuto();
  deckUI();
  if (V.sheet === "settings") renderSettings();
}

// ---------------------------------------------------------------- input from the player
function advance() {
  if (V.sheet) return;
  if (V.phase === "title") { const b = $("slides").querySelector("#contBtn, #beginBtn"); if (b) b.click(); return; }
  if (V.cueBusy) return skipCues();
  if (V.typing) return finishTyping();
  if (V.phase === "card") return dismissCard();
  const v = V.view;
  if (v.node === "beat") return v.beat.hidden ? reveal() : step(() => V.game.next(), { dir: 1 });
  if (v.node === "roll") return step(() => V.game.next(), { dir: 1 });
}
function dismissCard() {
  V.phase = "play"; $("app").dataset.phase = "play";
  renderNode(V.view, 1, [], {});
}
function reveal() {
  if (V.phase !== "play" || !V.view || V.view.node !== "beat" || !V.view.beat.hidden || V.cueBusy) return;
  step(() => V.game.reveal(), { dir: 1, reveal: true });
}
function pick(key) {
  const v = V.view;
  if (V.phase !== "play" || !v || v.node !== "choice" || V.cueBusy || V.sealed) return;
  const o = v.options.find(x => x.key === key);
  if (!o) return;
  if (o.locked) { announce(`Locked. ${o.hint || ""}`); return; }
  step(() => V.game.choose(key), { dir: 1, pickKey: key, pickRef: { scene: v.scene ? v.scene.id : "", group: v.group ? v.group.key : "", opt: key } });
}
function goBack() {
  if (V.phase === "title" || !V.view) return;
  if (V.cueBusy) return skipCues();
  if (V.typing) finishTyping();
  if (!V.view.canBack || V.sealed) { announce(V.sealed ? "Sealed. No going back." : "You cannot go back from here."); return; }
  step(() => V.game.back(), { dir: -1 });
}
async function step(fn, o) {
  if (!V.game) return;
  if (V.cueBusy) return skipCues();
  stopTyping(); clearAuto();
  const v = fn();
  if (v.refused) { announce(v.refused); return; }
  V.view = v;
  await present(v, o);
}
function submitInput(text) {
  if (V.phase !== "play" || !V.view || V.view.node !== "input") return;
  step(() => V.game.input(text), { dir: 1 });
}

// ---------------------------------------------------------------- game start, save and restore
function canContinue() {
  if (V.seedFixed) return false;
  const s = V.rec && V.rec.save;
  if (!s) return false;
  try { const d = JSON.parse(s); return d && d.pack === PACK.id && Array.isArray(d.hist) && d.hist.length > 1; } catch (e) { return false; }
}
// A Verify replay and a ?force= run are not the reader's own play: neither writes the save, the found endings or the notes met.
const volatileRun = () => V.replaying || V.force.length > 0;
function persist(v) {
  if (volatileRun()) return;
  V.rec.found = [...V.found];
  V.rec.met = [...V.extraMet];
  V.rec.settings = V.settings;
  V.rec.save = v && v.node === "ending" ? null : V.game.save();
  store.write(V.rec);
}
function persistSettings() {
  if (!V.rec) return;
  V.rec.settings = V.settings;
  if (!volatileRun()) { V.rec.found = [...V.found]; V.rec.met = [...V.extraMet]; }
  store.write(V.rec);
}
function record(v) {
  for (const id of v.found || []) V.found.add(id);
  if (v.node === "ending" && v.ending && v.ending.id != null) V.found.add(v.ending.id);
  persist(v);
}
function newSeed() { return Math.floor(Math.random() * 0x7fffffff) + 1; }

function begin(cont) {
  // Enter or Space during the opening cues (the title's button keeps focus) must not start the story again.
  // The flag is set here and cleared when the first beat or card has rendered, when the start fails, or at the title.
  if (V.starting) return;
  V.starting = true;
  cancelPreview();
  if (V.sheet) closeSheet(true);
  V.token++; stopTyping(); clearAuto();
  V.replaying = false;
  const seed = V.seedPending;
  let save = null;
  if (cont && canContinue()) save = V.rec.save;
  try { V.game = Stage.create(PACK, { seed, save, force: V.force.slice() }); } catch (e) { V.starting = false; console.error(e); announce("This story could not start."); return; }
  V.view = V.game.view();
  V.seen = new Set(); V.sealed = false; V.rollEl = null; V.cueBusy = false;
  V.seedPending = V.view.seed;
  for (const id of V.view.found || []) V.found.add(id);
  buildHud();
  $("app").dataset.phase = "play";
  if (save) restore(V.view);
  else {
    V.phase = "play";
    Promise.resolve(present(V.view, { dir: 1, fresh: true })).catch(e => console.error(e)).finally(() => { V.starting = false; });
  }
  if (save) V.starting = false;
}
function restore(v) {
  cancelPreview();
  V.token++; stopTyping(); clearAuto();
  V.phase = "play"; V.cueBusy = false; V.sealed = false; V.ctx = null; V.rollEl = null;
  root.removeAttribute("data-cue");
  $("app").dataset.phase = "play";
  const setId = v.scene && v.scene.set;
  if (setId) { kitShow(setId, v, true); V.setId = setId; }
  syncHud(v); kitUpdate(v); setPlace(v);
  if (V.slide) { gone(V.slide); V.slide = null; }
  renderNode(v, 1, [], { instant: true });
  deckUI();
}
function adopt(game) { // Verify: play a route and land on its end
  cancelPreview();
  V.replaying = true;
  V.game = game; V.view = game.view();
  V.seen = new Set(); buildHud();
  restore(V.view);
}
// Run fn in the task after the next frame has painted (a frame callback runs before the paint, a timer after it).
function afterPaint(fn) { requestAnimationFrame(() => setTimeout(fn, 0)); }
// At boot the title's set is built after the title has painted, in a task of its own, so the boot task and the first frame
// stay short. Until then the stage is clear; the kit fades its first set in. Anything that puts a set on the stage first
// (begin, restore, adopt, a second title) calls cancelPreview().
function deferPreview(build) {
  const mark = V.preview = {};
  afterPaint(() => {
    if (V.preview !== mark) return;
    V.preview = null;
    build();
  });
}
function cancelPreview() { V.preview = null; }
function toTitle() {
  cancelPreview();
  if (V.sheet) closeSheet(true);
  V.token++; stopTyping(); clearAuto();
  V.starting = false;
  V.game = null; V.view = null; V.phase = "title"; V.cueBusy = false; V.sealed = false; V.ctx = null; V.replaying = false;
  root.removeAttribute("data-cue");
  $("app").dataset.phase = "title"; $("app").dataset.node = ""; delete $("app").dataset.ending;
  V.seedPending = V.seedFixed ? V.seedPending : newSeed();
  buildHud();
  $("place").textContent = "";
  $("brandSub").textContent = `Endings found ${V.found.size} of ${ENDING_IDS.length}`;
  const start = sceneById[PACK.start];
  if (start && PACK.sets && PACK.sets[start.set]) {
    const preview = () => {
      const pv = Stage.create(PACK, { seed: 1 }).view();
      kitShow(start.set, pv, true); V.setId = start.set; kitUpdate(pv);
    };
    if (V.kit && V.setId == null) deferPreview(preview); else preview(); // the first title of the page waits; later ones swap at once
  }
  kitCall("screen", []);
  const sl = titleSlide();
  showSlide(sl, 1, true);
  sl.classList.add("done");
  deckUI();
  setFoot(footTitle());
  // Focus waits for the frame to paint: focusing forces a full style and layout pass, which would sit in this task.
  const b = sl.querySelector("#contBtn") || sl.querySelector("#beginBtn");
  if (b) afterPaint(() => { if (V.phase === "title" && !V.sheet && b.isConnected) b.focus({ preventScroll: true }); });
  announce(`${PACK.title}. ${PACK.subtitle || ""}`);
}

// ---------------------------------------------------------------- sheets
function openSheet(name, arg) {
  if (V.sheet === name && !arg) { closeSheet(); return; }
  if (V.sheet && V.sheet !== name) closeSheet(true);
  if (!V.sheet) V.opener = document.activeElement;
  const sheet = $("sheet-" + name);
  RENDERERS[name](arg);
  sheet.hidden = false;
  $("app").inert = true;
  V.sheet = name;
  clearAuto();
  if (!isReduced()) sheet.querySelector(".sheet-panel").animate([{ opacity: 0, transform: `translateY(${M.d4}px)` }, { opacity: 1, transform: "none" }], { duration: M.sheet, easing: M.easeOut });
  const target = arg && arg.focus ? arg.focus : sheet.querySelector("[data-close]");
  if (target) target.focus({ preventScroll: true });
}
function closeSheet(keepFocus) {
  if (!V.sheet) return;
  $("sheet-" + V.sheet).hidden = true;
  $("app").inert = false;
  V.sheet = null;
  if (!keepFocus) {
    const o = V.opener;
    if (o && o.isConnected && typeof o.focus === "function") o.focus({ preventScroll: true });
    armAuto();
  }
  V.opener = keepFocus ? V.opener : null;
}
const section = (h, body) => `<h3>${esc(h)}</h3>${body}`;
const RENDERERS = { help: renderHelp, notes: renderNotes, card: renderCard, verify: renderVerify, settings: renderSettings };

function renderHelp() {
  const hasCost = METERS.length ? `<dl class="kv">${METERS.map(m => `<dt>${esc(m.label)}</dt><dd>${m.min} to ${m.max}. You start with ${m.start}.</dd>`).join("")}</dl>` : "";
  $("body-help").innerHTML = `
    ${section("How to play", `<p>You read a short scene, one beat at a time. When the story asks, you choose. Some choices have dice. Some cost a point from a meter at the top. The story changes with what you choose.</p>
      <p>A line types out. Tap to finish it. Tap again to go on. The pictures behind the text move only to mark something that happened. The table below says what each motion means.</p>`)}
    ${section("Planning and Execution", `<p>Every choice carries a word.</p>
      <p><span class="gate" data-gate="plan">Planning · free</span> You look, talk and wait. You can go back and choose again.</p>
      <p><span class="gate" data-gate="exec"><span class="seal-glyph" aria-hidden="true"></span>Execution · final</span> The dice and the results are real. The choice is sealed. You cannot undo it.</p>
      <p><span class="gate" data-gate="fate"><span class="star" aria-hidden="true">&#9733;</span>1 Fate · final</span> You spend a point to act on your own authority. It is sealed too.</p>`)}
    ${hasCost ? section("Meters", hasCost) : ""}
    ${section("Keys", `<dl class="kv">
      <dt><kbd>→</kbd> <kbd>Space</kbd> <kbd>Enter</kbd></dt><dd>Finish the line, then go on</dd>
      <dt><kbd>←</kbd></dt><dd>Go back</dd>
      <dt><kbd>1</kbd> to <kbd>9</kbd></dt><dd>Pick an option</dd>
      <dt><kbd>R</kbd></dt><dd>Reveal a sealed note</dd>
      <dt><kbd>A</kbd></dt><dd>AUTO: play like a film. It stops at every choice, roll, input and reveal</dd>
      <dt><kbd>N</kbd></dt><dd>Notes</dd>
      <dt><kbd>C</kbd></dt><dd>Card</dd>
      <dt><kbd>V</kbd></dt><dd>Verify</dd>
      <dt><kbd>H</kbd> or <kbd>?</kbd></dt><dd>This help</dd>
      <dt><kbd>Esc</kbd></dt><dd>Close a sheet</dd></dl>
      <p>The letter and digit keys can be turned off in Settings (Keyboard shortcuts). The arrows, Space, Enter and Esc then still work.</p>`)}
    ${section("What each motion means", `<dl class="kv">
      <dt>Page turn, or a cut</dt><dd>Time passes. A new scene begins.</dd>
      <dt>Crossfade</dt><dd>The same moment, a new view.</dd>
      <dt>Ink drawn on</dt><dd>Unwitnessed or secret. The tag says so.</dd>
      <dt>Warm wash</dt><dd>Witnessed or public. The tag says so.</dd>
      <dt>Stamp</dt><dd>The choice is final.</dd>
      <dt>Turning wheel</dt><dd>The dice decide.</dd>
      <dt>One flash</dt><dd>A meter went down. A number beside the meter says how much.</dd>
      <dt>Ticket tears</dt><dd>You spent a Fate point.</dd>
      ${TALLY_IDS.length ? `<dt>Small flash by a reading</dt><dd>Your reading of the world changed. The number says by how much.</dd>` : ""}
      <dt>Book shuts</dt><dd>The story stops.</dd></dl>
      <p>Every motion has a word beside it. To stop all motion, choose Calm in Settings, or turn motion off in your system. Nothing is lost.</p>`)}
    ${section("Your card", `<p>The Card sheet lists what you wrote and chose. You can copy it as text.</p>`)}`;
}

function renderNotes(arg) {
  const met = metSet(V.view);
  const kinds = {};
  for (const id of met) (kinds[NOTES[id].kind] = kinds[NOTES[id].kind] || []).push(id);
  const order = ["rule", "dm", "lore", "handler", "algorithm", "guide"].filter(k => kinds[k]);
  let html = `<p>Every note you have met so far. Tap the ⓘ chips to open a note here.</p>`;
  if (!order.length) html += `<p>No notes yet. A chip marked ⓘ appears when a term or rule is worth a look.</p>`;
  for (const k of order) {
    html += `<h3>${esc(KIND_NAMES[k] || k)}</h3>`;
    for (const id of kinds[k]) {
      const n = NOTES[id];
      html += `<article class="note${arg && arg.note === id ? " hit" : ""}" id="note-${esc(id)}" tabindex="-1"><h4>${esc(n.term)}</h4><p>${esc(n.text)}</p></article>`;
    }
  }
  $("body-notes").innerHTML = html;
  if (arg && arg.note) {
    const n = document.getElementById("note-" + arg.note);
    if (n) { arg.focus = n; setTimeout(() => n.scrollIntoView({ block: "center" }), 0); }
  }
}

function cardText() {
  const v = V.view;
  const lines = [PACK.title + (PACK.subtitle ? " — " + PACK.subtitle : "")];
  const fields = v ? v.fields : {};
  for (const side of ["front", "back"]) {
    const list = FIELDS.filter(f => (f.side || "front") === side);
    if (!list.length) continue;
    lines.push("", side === "front" ? "Front" : "Back");
    for (const f of list) lines.push(`${f.label}: ${fields[f.id] ? fields[f.id] : "—"}`);
  }
  if (v && TALLY_IDS.length) {
    lines.push("", "Readings");
    for (const id of TALLY_IDS) { const t = v.tallies[id] || {}; const vals = TALLY_VALUES[id] || Object.keys(t); lines.push(`${id}: ${vals.map(x => `${x} ${t[x] || 0}`).join(", ")}`); }
  }
  if (v && METERS.length) { lines.push("", "Meters"); for (const m of METERS) lines.push(`${m.label}: ${v.meters[m.id]} of ${m.max}`); }
  lines.push("", `Endings found: ${V.found.size} of ${ENDING_IDS.length}`);
  if (V.view) lines.push(`Seed: ${V.view.seed}`);
  return lines.join("\n");
}
function renderCard() {
  const v = V.view, fields = v ? v.fields : {};
  const face = side => {
    const list = FIELDS.filter(f => (f.side || "front") === side);
    if (!list.length) return "";
    return `<div class="facing"><h3>${side === "front" ? "Front" : "Back"}</h3><dl class="kv">${list.map(f => `<dt>${esc(f.label)}</dt><dd>${fields[f.id] ? esc(fields[f.id]) : '<span class="none">—</span>'}</dd>`).join("")}</dl></div>`;
  };
  const text = cardText();
  $("body-card").innerHTML = `${FIELDS.length ? face("front") + face("back") : "<p>This story has no card fields.</p>"}
    <label for="cardText" class="vlist-h" style="display:block">Card as text</label>
    <textarea class="asText" id="cardText" readonly>${esc(text)}</textarea>
    <div class="row" style="margin-top:0"><button type="button" class="btn primary" id="copyBtn">Copy as text</button></div>`;
}
function copyText(text) {
  const fallback = () => {
    const t = $("cardText");
    if (t) { t.focus(); t.select(); try { document.execCommand("copy"); announce("Selected. Copy it with your keyboard."); } catch (e) { announce("Select the text and copy it."); } }
    else { openSheet("card"); }
  };
  try { navigator.clipboard.writeText(text).then(() => announce("Copied."), fallback); } catch (e) { fallback(); }
}

// The build embeds Stage.simulate's result (window.SIM), so Verify does not walk the story on the main thread. Without it, the page computes it.
function getSim() {
  if (!V.sim) {
    if (window.SIM && typeof window.SIM === "object" && window.SIM.routes) V.sim = unpackSim(window.SIM);
    else { try { V.sim = Stage.simulate(PACK); } catch (e) { V.sim = { error: e.message }; } }
  }
  return V.sim;
}
// The build packs each route's steps into one string (tools/build.mjs): "group.option", "group.option=tier" or "(typed)", joined by "|".
function unpackSim(sim) {
  const step = w => { if (w === "(typed)") return { input: "(typed)" }; const i = w.indexOf("="); return i < 0 ? { opt: w } : { opt: w.slice(0, i), result: w.slice(i + 1) }; };
  return { ...sim, routes: sim.routes.map(r => r.steps ? r : { ending: r.ending, count: r.count, steps: r.s ? r.s.split("|").map(step) : [] }) };
}
const VERIFY_FIRST = 20; // routes listed before "Show all"
// A route is { ending, count, steps }; a step is { opt, result? } or { input }. Label: "group.option", "group.option=tier", "(typed)".
const stepWord = x => (x.opt ? x.opt + (x.result ? "=" + x.result : "") : x.input != null ? "(typed)" : "?");
const pickCount = r => r.steps.filter(x => x.opt).length;
function pathLabel(r) {
  return r.steps.length ? r.steps.map(stepWord).join(" › ") : "(no picks)";
}
function renderVerify() {
  const body = $("body-verify");
  const draw = now => {
    const sim = getSim();
    if (!now && V.sheet !== "verify") return; // (the sheet is marked open just after it renders)
    if (sim.error) { body.innerHTML = `<p>Verify could not run: ${esc(sim.error)}</p>`; return; }
    const ends = Object.keys(sim.endings);
    const shown = V.verifyAll ? sim.routes.length : Math.min(VERIFY_FIRST, sim.routes.length);
    const byEnd = {};
    sim.routes.forEach((r, i) => { if (i < shown) (byEnd[r.ending] = byEnd[r.ending] || []).push(i); });
    let html = `<p>This walks the story with the same rules as the game. It counts every path to each ending. Tap a route to replay it and land on its ending. Then use Back to look at it.</p>
      <p><b data-total="${sim.paths}">${esc(fmt(sim.paths))}</b> paths · ${sim.routes.length} routes · ${sim.states} states</p>
      <div class="ecounts">${ends.map(id => { const c = sim.endings[id]; const t = ENDINGS[id] ? ENDINGS[id].title : id; return `<div class="ec ${c ? "" : "zero"}" data-ending="${esc(id)}" data-count="${c}"><b>${esc(fmt(c))}</b>${esc(t)}${c ? "" : "<br>Never reached"}${V.found.has(id) ? "<br>Found" : ""}</div>`; }).join("")}</div>
      <p>${sim.unreachable.length ? `Not reached: ${esc(sim.unreachable.join(", "))}` : "Nothing is unreachable."} ${sim.locked.length ? `Locked options seen: ${esc(sim.locked.join(", "))}.` : ""}</p>`;
    for (const id of Object.keys(byEnd)) {
      html += `<h3 class="vlist-h">${esc(ENDINGS[id] ? ENDINGS[id].title : id)}</h3><div class="routes">${byEnd[id].map(i => {
        const r = sim.routes[i], n = pickCount(r);
        return `<div class="route-row"><button type="button" class="route" data-route="${i}" data-ending="${esc(r.ending)}" data-count="${r.count}"><b>${esc(pathLabel(r))}</b><small>${esc(fmt(r.count))} paths</small></button>${n ? `<button type="button" class="btn route-last" data-route-last="${i}" aria-label="Replay this route up to its last pick, then choose for yourself" title="Stop before the last pick">Last pick</button>` : ""}</div>`;
      }).join("")}</div>`;
    }
    if (shown < sim.routes.length) html += `<div class="row"><button type="button" class="btn" id="vmore">Show all ${sim.routes.length} routes</button></div>`;
    body.innerHTML = html;
  };
  // Embedded (or already computed): draw now. Otherwise say so, let the sheet paint, then compute.
  if (V.sim || (window.SIM && window.SIM.routes)) draw(true);
  else { body.innerHTML = `<p>Walking every route…</p>`; setTimeout(draw, 30); }
}
// Replay a route with Stage.replay(pack, route, { seed, upTo }). `upTo` stops at the choice after that many picks.
function replayRoute(i, beforeLast) {
  const sim = getSim(), r = sim.routes && sim.routes[i];
  if (!r) return;
  try {
    const opts = { seed: V.view ? V.view.seed : V.seedPending };
    if (beforeLast) opts.upTo = Math.max(0, pickCount(r) - 1);
    const g = Stage.replay(PACK, r, opts);
    closeSheet(true);
    adopt(g);
    announce(beforeLast ? "Replaying a route. You are at its last choice. Pick for yourself, or use Back." : "Replaying a route. You are at its end. Use Back to look at it.");
  } catch (e) { announce("That route could not be replayed: " + e.message); }
}

function seg(label, name, options, current) {
  return `<span class="seg" role="group" aria-label="${esc(label)}">${options.map(([val, text]) => `<button type="button" class="btn" data-set="${name}" data-val="${esc(val)}" aria-pressed="${String(current === val)}">${esc(text)}</button>`).join("")}</span>`;
}
function renderSettings() {
  const s = V.settings;
  $("body-settings").innerHTML = `
    <div class="set-row"><span id="l-theme">Theme</span>${seg("Theme", "theme", [["auto", "System"], ["light", "Light"], ["dark", "Dark"]], s.theme)}</div>
    ${MAP_STYLES.length > 1 ? `<div class="set-row"><span>Map style</span>${seg("Map style", "map", MAP_STYLES.map(m => [m, m === "ink" ? "Black ink" : m === "blueline" ? "Blueline" : m]), s.map)}</div>` : ""}
    <div class="set-row"><span>Motion</span>${seg("Motion", "motion", [["full", "Full"], ["calm", "Calm"]], s.motion)}</div>
    ${mq.matches ? `<p class="fine">Your system asks for reduced motion, so motion is already Calm.</p>` : s.motion === "calm" ? `<p class="fine">Calm: nothing moves, and each line appears whole.</p>` : ""}
    ${COMMENTARY ? `<div class="set-row"><span>${esc(COMMENTARY.label)}</span>${seg("Commentary", "commentary", [["on", "On"], ["off", "Off"]], s.commentary ? "on" : "off")}</div>` : ""}
    <div class="set-row"><span>Sound</span>${seg("Sound", "sound", [["off", "Off"], ["on", "On"]], s.sound ? "on" : "off")}</div>
    <div class="set-row"><span>Keyboard shortcuts</span>${seg("Keyboard shortcuts", "shortcuts", [["on", "On"], ["off", "Off"]], s.shortcuts ? "on" : "off")}</div>
    ${s.shortcuts ? "" : `<p class="fine">Off: letter and digit keys do nothing. The arrow keys, Space, Enter and Esc still work.</p>`}
    <div class="set-row"><span>Film mode</span>${seg("Film mode", "auto", [["off", "Step"], ["on", "AUTO"]], s.auto ? "on" : "off")}</div>
    <div class="set-row"><span>AUTO speed</span>${seg("AUTO speed", "speed", [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]], s.speed)}</div>
    <div class="set-actions">
      <button type="button" class="btn" data-act="notes">Notes</button>
      <button type="button" class="btn" data-act="card">Card</button>
      <button type="button" class="btn" data-act="verify">Verify</button>
      <button type="button" class="btn" data-act="help">Help</button>
      <button type="button" class="btn" data-act="restart" id="restartBtn">Start over</button>
    </div>
    ${isTouch() && V.footText ? `<p class="fine" id="seedLine">${esc(V.footText)}</p>` : ""}
    <p class="fine">${esc(PACK.storageKey)} · nothing leaves this page.</p>`;
}

// ---------------------------------------------------------------- settings applied
function applySettings() {
  const s = V.settings;
  if (s.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", s.theme);
  root.setAttribute("data-map", s.map);
  root.setAttribute("data-motion", s.motion);
  root.setAttribute("data-commentary", s.commentary ? "on" : "off");
  snd.on = s.sound;
  syncAutoBtn();
}
function changeSetting(name, val) {
  const s = V.settings;
  if (name === "theme") s.theme = val;
  else if (name === "map") { s.map = val; applyMap(); }
  else if (name === "motion") { s.motion = val === "calm" ? "calm" : "full"; applySettings(); if (isReduced()) stopAllMotion(); announce(s.motion === "calm" ? "Calm on" : "Calm off"); }
  else if (name === "commentary") s.commentary = val === "on";
  else if (name === "sound") { s.sound = val === "on"; snd.set(s.sound); announce(s.sound ? "Sound on" : "Sound off"); }
  else if (name === "shortcuts") { s.shortcuts = val === "on"; announce(s.shortcuts ? "Keyboard shortcuts on" : "Keyboard shortcuts off"); if (V.phase !== "title" && V.view) deckUI(); }
  else if (name === "auto") { setAuto(val === "on"); return; }
  else if (name === "speed") { s.speed = val; if (V.phase !== "title") armAuto(); }
  applySettings(); persistSettings(); renderSettings();
  const b = $("body-settings").querySelector(`[data-set="${name}"][aria-pressed="true"]`); if (b) b.focus({ preventScroll: true });
}
// Reduced motion (the system's or Calm) switched on: every cue and animation jumps to its end now.
function stopAllMotion() {
  finishTyping(); // the typewriter runs on requestAnimationFrame, not Web Animations: show the whole line now
  skipCues(); kitCall("finish");
  document.getAnimations().forEach(a => { try { a.cancel(); } catch (e) {} });
  clearAuto();
}
function applyMap() {
  root.setAttribute("data-map", V.settings.map);
  kitCall("setMap", V.settings.map);
  try { window.dispatchEvent(new CustomEvent("stage:map", { detail: V.settings.map })); } catch (e) {}
}

// ---------------------------------------------------------------- events
function onAct(act) {
  if (act === "help") openSheet("help");
  else if (act === "notes") openSheet("notes");
  else if (act === "card") openSheet("card");
  else if (act === "verify") openSheet("verify");
  else if (act === "reveal") reveal();
  else if (act === "again") { if (!V.seedFixed) V.seedPending = newSeed(); begin(false); }
  else if (act === "copy") copyText(cardText());
  else if (act === "restart") {
    const b = $("restartBtn");
    if (V.restartT) { clearTimeout(V.restartT); V.restartT = null; closeSheet(true); toTitle(); }
    else { b.textContent = "Press again to start over"; V.restartT = setTimeout(() => { V.restartT = null; if (b.isConnected) b.textContent = "Start over"; }, 4000); }
  }
}

$("slides").addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  e.stopPropagation();
  if (t.id === "beginBtn") begin(false);
  else if (t.id === "contBtn") begin(true);
  else if (t.classList.contains("opt")) pick(t.dataset.key);
  else if (t.dataset.note) openSheet("notes", { note: t.dataset.note });
  else if (t.dataset.act) onAct(t.dataset.act);
});
$("slides").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target.querySelector("#inField");
  if (f) submitInput(f.value);
});
$("slides").addEventListener("input", e => {
  if (e.target.id === "inField") { const c = $("inCount"); if (c) c.textContent = `${e.target.value.length} / ${e.target.maxLength}`; }
});
const stage = $("stage");
stage.addEventListener("pointerdown", e => { V.dragX = e.clientX; V.dragY = e.clientY; kick(); });
document.addEventListener("pointerdown", () => snd.unlock(), true);
stage.addEventListener("click", e => {
  if (e.target.closest("button, a, input, textarea, select, label, [data-kit-hit]")) return;
  if (Math.abs(e.clientX - V.dragX) + Math.abs(e.clientY - V.dragY) > 12) return; // a drag, not a tap
  if (V.phase === "title") return;
  advance();
});
$("nextBtn").addEventListener("click", () => advance());
$("backBtn").addEventListener("click", goBack);
$("autoBtn").addEventListener("click", () => setAuto(!V.settings.auto));
$("setBtn").addEventListener("click", () => openSheet("settings"));
$("helpBtn").addEventListener("click", () => openSheet("help"));
$("notesBtn").addEventListener("click", () => openSheet("notes"));
$("cardBtn").addEventListener("click", () => openSheet("card"));
for (const sh of document.querySelectorAll(".sheet")) {
  sh.addEventListener("click", e => {
    if (e.target === sh || e.target.closest("[data-close]")) { closeSheet(); return; }
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.set) changeSetting(t.dataset.set, t.dataset.val);
    else if (t.dataset.act) onAct(t.dataset.act);
    else if (t.id === "copyBtn") copyText(cardText());
    else if (t.dataset.route != null) replayRoute(+t.dataset.route, false);
    else if (t.dataset.routeLast != null) replayRoute(+t.dataset.routeLast, true);
    else if (t.id === "vmore") { V.verifyAll = true; renderVerify(); }
  });
}

window.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target, tag = t && t.tagName;
  if (e.key === "Escape") { if (V.sheet) { e.preventDefault(); closeSheet(); } return; }
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  snd.unlock();
  const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
  // WCAG 2.1.4: with shortcuts off, a letter, a digit or "?" does nothing. Arrows, Space, Enter and Escape still work.
  if (!V.settings.shortcuts && /^[a-z0-9?]$/i.test(k)) return;
  const onBtn = tag === "BUTTON";
  if (low === "n") { e.preventDefault(); openSheet("notes"); return; }
  if (low === "c") { e.preventDefault(); openSheet("card"); return; }
  if (low === "v") { e.preventDefault(); openSheet("verify"); return; }
  if (low === "h" || k === "?") { e.preventDefault(); openSheet("help"); return; }
  if (V.sheet) return;
  if (low === "a") { e.preventDefault(); setAuto(!V.settings.auto); return; }
  if (V.phase === "title") {
    if (k === "Enter" && !onBtn) { e.preventDefault(); const b = $("slides").querySelector("#contBtn, #beginBtn"); if (b) b.click(); }
    return;
  }
  if ((k === " " || k === "Enter") && onBtn) return; // the button handles its own press
  if (k === "ArrowRight" || k === " " || k === "Enter") { e.preventDefault(); advance(); }
  else if (k === "ArrowLeft") { e.preventDefault(); goBack(); }
  else if (low === "r") { e.preventDefault(); reveal(); }
  else if (/^[1-9]$/.test(k)) {
    const v = V.view;
    if (v && v.node === "choice") { e.preventDefault(); const o = v.options[+k - 1]; if (o) pick(o.key); }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { root.setAttribute("data-hidden", ""); clearAuto(); }
  else { root.removeAttribute("data-hidden"); armAuto(); kick(); }
});
if (mq.addEventListener) {
  mq.addEventListener("change", () => { if (mq.matches) stopAllMotion(); });
}

// ---------------------------------------------------------------- boot
function boot() {
  V.rec = cleanRecord(store.read());
  V.settings = V.rec.settings;
  V.rec.found.forEach(id => V.found.add(id));
  V.rec.met.forEach(id => V.extraMet.add(id));
  try {
    const q = new URLSearchParams(location.search).get("seed");
    if (q != null && q !== "" && Number.isFinite(Number(q))) { V.seedPending = Math.floor(Number(q)) >>> 0; V.seedFixed = true; }
    // ?force=fail,success steers the next rolls to those result tiers, in order (the browser test uses it). Like ?seed=, it fixes the run, so Continue is off.
    const f = new URLSearchParams(location.search).get("force");
    // Tokens that are not a result tier are dropped and shown in the footer (a console warning would fail the browser test).
    // The run is fixed only if at least one valid tier is left.
    if (f != null && f !== "") {
      const toks = f.split(",").map(x => x.trim()).filter(Boolean);
      V.force = toks.filter(x => TIERS.includes(x));
      V.forceIgnored = toks.filter(x => !TIERS.includes(x));
      if (V.force.length) V.seedFixed = true;
    }
  } catch (e) {}
  if (PACK.cast && PACK.cast.sheet && ASSETS[PACK.cast.sheet]) root.style.setProperty("--cast-sheet", `url("${ASSETS[PACK.cast.sheet]}")`);
  applySettings();
  const kit = window.StageKit && window.StageKit.kits[PACK.kit];
  if (kit) {
    V.kit = kit;
    try { kit.mount($("kit"), { pack: PACK, assets: ASSETS, reduced: isReduced() }); } catch (e) { console.error("kit.mount:", e); V.kit = null; }
  } else console.error("No kit registered for " + PACK.kit);
  applyMap();
  toTitle();
}
boot();
})();
