/* Kit: paper (the pop-up book). Contract: stage/SPEC.md section 4, stage/MOTION.md sections 3 and 4.

   A set is a list of layers. The kit builds each set as one element (.k-set) with a ground (the spread), a book box
   (the layers, in a square-ish box centred on the stage) and a warm wash. Positions are fractions of the book box.

   Layer properties the kit reads (everything else is ignored):
     all           prim, art, x, y, w            (x, y: centre; w: width; the height follows the art's shape)
     spread        art                           the ground; fills the whole stage (the art is sliced to fit)
     vfold         art                           stands up; rises from its base on turn
     parallel      art                           a platform; lifts on turn
     tunnel        art, art2, art3, art4, art5   planes, far to near (all with one viewBox); drifts; a drag tilts them
     plate         art, look, screen             look: "paint" blooms it, "ink" draws it; screen: {x,y,w,h} (fractions of
                                                 the plate) is where beat.screen lines are printed
     flap          art, under, opensOn           art is a lid that covers the whole box; under shows when it opens on reveal
     pulltab       art, under, tally, value, words  art is the front card; under slides out from behind when the tally value leads;
                                                 a tap on the tab pulls it fully over (the player asks). words: [front, under],
                                                 the two cards' own names, for the tab's label (default: "Front" and the value).
                                                 The tab (.k-tab) is in the DOM, and not [hidden], only while the set on show has a
                                                 pull-tab; the shell may reserve room for it. Its label says which card shows.
     volvelle      art, range, center            range [min,max] faces round the rim (default [2,12]); the face "center" is
                                                 at the top when the wheel is at rest (default the middle one); a fixed
                                                 pointer is drawn by the kit; on roll the wheel stops with the total at the top
     ticket        art, meter                    the Fate ticket: boxes are drawn by the kit (a hole for each point left)

   Art vocabulary (SVG files are inlined, so strokes follow the map style): strokes and fills use currentColor, which the
   kit sets to ink or to Blueline blue. Fill classes: fi ink, fp paper, f1 tint-1, f2 tint-2, fg plate-gold, fu plate-umber,
   fs stone grey (the rule colour). Stroke classes: sg gold, su umber, ss grey. One path with class "d" (pathLength 1) is
   the contour the ink cue draws on. That path is the only stroke of the contour: the shapes under it are filled with
   stroke="none", so the ink cue draws the line on from nothing. Text is filled with --k-text (ink; in Blueline a darker
   blue, so that it passes 4.5:1 under the warm wash) and always sits on a paper fill (fp), never straight on gold,
   umber or a tint. Labels on a flap or a pull-tab are at least 10px on a 360px phone. In-world screen text is at least 11px.

   Motion: every duration, easing and distance is a --m-* token read in mount(). Only transform and opacity animate; the
   one exception is stroke-dashoffset on the ink contour (MOTION.md, ink). Under reduced motion or Calm no animate() is
   called: each cue sets the end state as the element's own style and resolves at once. The end state is always the
   element's own style; an animation only runs from a start keyframe (offset 0) towards it. Ambient drift is a CSS
   animation on the tunnel only, stepped (two updates a second) so the compositor can idle; the shell's reduced-motion block and the rules below stop it.

   Call order from the shell: show() builds the new set and lays it under the old; cue(turn|shift) swaps it; update(state)
   restores everything bound to state (look, revealed, tally, meters), in both directions. */
(function () {
"use strict";
// Art is ours, but it is inlined, so clean it the same way in both kits: no script, no foreign HTML, no links, no
// handlers, no href that leaves the file, and no SMIL element that could set one.
function cleanSvg(root) {
  root.querySelectorAll("script,foreignObject").forEach(n => n.remove());
  root.querySelectorAll("set,animate,animateTransform,animateMotion").forEach(n => {
    const a = (n.getAttribute("attributeName") || "").toLowerCase();
    if (a === "href" || a === "xlink:href" || a.startsWith("on")) n.remove();
  });
  root.querySelectorAll("a").forEach(a => a.replaceWith(...a.childNodes));
  for (const n of [root, ...root.querySelectorAll("*")]) for (const at of [...n.attributes]) {
    const nm = (at.localName || at.name).toLowerCase();
    if (nm.startsWith("on") || (nm === "href" && !/^#/.test(at.value))) n.removeAttribute(at.name);
  }
  return root;
}
const docEl = document.documentElement;
const redNow = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || docEl.getAttribute("data-motion") === "calm";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const pct = n => (Math.round(n * 10000) / 100) + "%";

let host = null, root = null, pack = null, assets = {};
let T = {};                         // tokens, read once in mount()
let cur = null, pend = null;         // the set on show; a swap waiting for its turn or shift cue
let last = null;                     // the state of the last update()
let active = new Set(), act = null;  // running animations; the active cue
let skip = false;                    // the cue in hand must jump to its end state
let closed = 0;                      // 0 open, 1 closed by this step, 2 closed
let stamp = null, stampAge = 0, lines = [];
const tilt = { x: 0, y: 0, tx: 0, ty: 0, down: false, sx: 0, sy: 0 };
const svgCache = new Map();

// ---------------------------------------------------------------- art
function svgText(src) {
  if (svgCache.has(src)) return svgCache.get(src);
  let out = null;
  const uri = assets[src];
  if (uri && /^data:image\/svg\+xml/.test(uri)) {
    try {
      const b64 = /;base64,/.test(uri);
      const body = uri.slice(uri.indexOf(",") + 1);
      let txt;
      if (b64) { const bin = atob(body); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); txt = new TextDecoder("utf-8").decode(u); }
      else txt = decodeURIComponent(body);
      txt = txt.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "").trim();
      const d = new DOMParser().parseFromString(txt, "image/svg+xml");
      if (!d.querySelector("parsererror")) out = new XMLSerializer().serializeToString(cleanSvg(d.documentElement));
    } catch (e) { out = null; }
  }
  svgCache.set(src, out);
  return out;
}
function aspect(src) { // width over height, from the viewBox
  const t = svgText(src), m = t && /viewBox\s*=\s*"([^"]+)"/.exec(t);
  if (!m) return 1;
  const v = m[1].trim().split(/[\s,]+/).map(Number);
  return v[3] ? v[2] / v[3] : 1;
}
function artHTML(src, ground) {
  if (!src) return "";
  const t = svgText(src);
  if (t) {
    return t.replace(/^<svg\b([^>]*)>/, (m, attrs) => {
      let a = attrs + ' focusable="false" aria-hidden="true"';
      if (ground && !/preserveAspectRatio=/.test(attrs)) a += ' preserveAspectRatio="xMidYMid slice"';
      return "<svg" + a + ">";
    });
  }
  return assets[src] ? `<img alt="" draggable="false" src="${assets[src]}">` : "";
}
const art = (src, ground) => `<div class="k-art${ground ? " k-ground-art" : ""}" aria-hidden="true">${artHTML(src, ground)}</div>`;

// ---------------------------------------------------------------- animation helpers
function run(elm, frames, dur, ease, delay) {
  if (skip || redNow() || !elm || !elm.animate) return Promise.resolve();
  frames = frames.map((f, i) => (i === 0 && f.offset == null ? Object.assign({ offset: 0 }, f) : f)); // a lone keyframe is the START
  const a = elm.animate(frames, { duration: dur, easing: ease, delay: delay || 0, fill: "backwards" }); // the end state is the element's own style
  active.add(a);
  const done = () => active.delete(a);
  a.onfinish = done; a.oncancel = done;
  return a.finished.then(done, done);
}
// The active cue: its Promise settles when the animations end, or when finish() is called, whichever is first.
function track(p, end) {
  return new Promise(res => {
    const a = act = { end, res };
    const fin = () => { if (act === a) act = null; try { end && end(); } catch (e) { console.error(e); } res(); };
    Promise.resolve(p).then(fin, fin);
  });
}
const settle = ps => Promise.all(ps);

// ---------------------------------------------------------------- building a set
function posStyle(l, dw) {
  const x = l.x == null ? 0.5 : l.x, y = l.y == null ? 0.5 : l.y, w = l.w == null ? dw : l.w;
  return `left:${pct(x)};top:${pct(y)};width:${pct(w)}`;
}
function planesOf(l) { return [l.art, l.art2, l.art3, l.art4, l.art5].filter(Boolean); }
function layerEl(l, state) {
  const p = l.prim;
  const e = el("div", "k-layer k-" + p);
  e._l = l; e.dataset.prim = p;
  e.style.cssText = posStyle(l, p === "volvelle" ? 0.3 : p === "ticket" ? 0.2 : 0.5);
  switch (p) {
    case "vfold": case "parallel":
      e.innerHTML = art(l.art);
      break;
    case "plate": {
      e.dataset.look = l.look === "ink" ? "ink" : "paint";
      if (l.screen) e.classList.add("k-hasscreen");
      e.innerHTML = `<div class="k-frame"><div class="k-artbox">${art(l.art)}</div></div>`;
      if (l.screen) {
        const s = el("div", "k-screen"), r = l.screen;
        s.style.cssText = `left:${pct(r.x)};top:${pct(r.y)};width:${pct(r.w)};height:${pct(r.h)}`;
        s.setAttribute("aria-hidden", "true");
        e.querySelector(".k-artbox").appendChild(s);
      }
      break;
    }
    case "tunnel": {
      const pl = planesOf(l), a = aspect(pl[0]);
      e.style.aspectRatio = String(a);
      const drift = el("div", "k-drift");
      pl.forEach((src, i) => {
        const z = pl.length > 1 ? i / (pl.length - 1) : 0;
        const q = el("div", "k-plane", art(src));
        q.dataset.z = String(z);
        q.style.transform = `translate(0,${(z * 6).toFixed(2)}px)`; // the depth offset: near planes sit a little lower
        drift.appendChild(q);
      });
      e.appendChild(drift);
      break;
    }
    case "flap": {
      e.dataset.open = "0";
      e.innerHTML = `<div class="k-under">${art(l.under)}</div><div class="k-lid"><div class="k-face k-front">${art(l.art)}</div><div class="k-face k-back"></div></div>`;
      setFlap(e, !!(state && state.revealed));
      break;
    }
    case "pulltab": {
      const word = l.value ? String(l.value).charAt(0).toUpperCase() + String(l.value).slice(1) : "Pull";
      e.dataset.out = "0"; e.dataset.pulled = "0";
      e.innerHTML = `<div class="k-sheet">${art(l.under)}<button type="button" class="k-tab" aria-expanded="false" aria-label="${esc(word)} reading"><span aria-hidden="true">${esc(word)}</span></button></div><div class="k-fronti">${art(l.art)}</div>`;
      tabLabel(e);
      pullState(e, state, false);
      break;
    }
    case "volvelle": {
      e.style.aspectRatio = "1";
      e.innerHTML = `<div class="k-wheel">${art(l.art)}</div><i class="k-pointer" aria-hidden="true"></i>`;
      e._rot = 0;
      break;
    }
    case "ticket": {
      e.style.aspectRatio = String(aspect(l.art));
      const whole = () => `<div class="k-tk">${art(l.art)}<div class="k-boxes" aria-hidden="true"></div></div>`;
      e.innerHTML = `<div class="k-half k-top">${whole()}</div><div class="k-half k-bot">${whole()}</div><div class="k-stub" aria-hidden="true">★ 1 FP</div>`;
      ticketState(e, state);
      break;
    }
    default:
      e.innerHTML = art(l.art);
  }
  return e;
}
function buildSet(id, set, state, washOn) {
  const s = el("div", "k-set");
  s.dataset.set = id; s.dataset.wash = "0";
  const ground = el("div", "k-ground");
  const book = el("div", "k-book");
  s.append(ground, book);
  let run_ = null;
  for (const l of set.layers || []) {
    if (!l) continue;
    if (l.prim === "spread") { if (l.art) ground.insertAdjacentHTML("beforeend", art(l.art, true)); continue; }
    const e = layerEl(l, state);
    if (l.prim === "vfold" || l.prim === "parallel") {
      if (!run_) { run_ = el("div", "k-pop"); book.appendChild(run_); }
      run_.appendChild(e);
    } else { run_ = null; book.appendChild(e); }
  }
  for (const g of book.querySelectorAll(".k-pop")) g.dataset.kind = g.querySelector(".k-vfold") ? "stand" : "lift";
  const glow = el("div", "k-glow", '<div class="k-wash"></div><div class="k-lamp"></div>');
  glow.setAttribute("aria-hidden", "true");
  s.append(glow);
  setWash(s, washOn);
  return s;
}
function setWash(s, on) {
  if (!s) return;
  s.dataset.wash = on ? "1" : "0";
  const g = s.querySelector(".k-glow");
  if (g) g.style.opacity = on ? "1" : "";
}

// ---------------------------------------------------------------- state-bound layers
function setFlap(e, open) {
  e.dataset.open = open ? "1" : "0";
  const lid = e.querySelector(".k-lid");
  if (lid) lid.style.transform = open ? `rotateX(${T.flap}deg)` : "";
}
function leads(l, state) {
  const t = (state && state.tallies && state.tallies[l.tally]) || {};
  const n = t[l.value] || 0;
  return n >= 1 && n === Math.max(0, ...Object.values(t));
}
// The tab's label says what shows: "Machine reading, showing: Sensor" once pulled, "...: Ward" while the front card is on top.
function tabLabel(e) {
  const l = e._l, btn = e.querySelector(".k-tab");
  const word = l.value ? String(l.value).charAt(0).toUpperCase() + String(l.value).slice(1) : "Pull";
  const w = Array.isArray(l.words) ? l.words : [];
  const front = typeof w[0] === "string" && w[0] ? w[0] : "Front", under = typeof w[1] === "string" && w[1] ? w[1] : word;
  btn.setAttribute("aria-label", `${word} reading, showing: ${e.dataset.pulled === "1" ? under : front}`);
}
// The tab is in the DOM, not hidden, only in the set on show. Old sets, clones and a closed book hide theirs.
function tabsOn(set, on) { for (const t of set.querySelectorAll(".k-tab")) { if (on) t.removeAttribute("hidden"); else t.setAttribute("hidden", ""); } }
// How far the sheet slides out: d4, or less, so the tab stays 4px inside the kit's box (a 360px phone has no room for all 32px).
function slideOf(e) {
  const b = e.getBoundingClientRect(), r = root && root.getBoundingClientRect();
  if (!r || !b.width || !r.width) return T.d4;
  return Math.max(0, Math.min(T.d4, Math.floor(r.right - 4 - (b.right + T.d3))));
}
// The sheet's transform for the pull-tab, by state: tucked (none), slid out (slideOf), or pulled over (none, on top).
function sheetPos(e) { return e.dataset.pulled === "1" ? "none" : e.dataset.out === "1" ? `translateX(${slideOf(e)}px)` : "none"; }
// The shell keeps its text clear of the tab on show (style.css reads --st-tab-x and --st-tab-out from the stage, the kit host's parent).
function tabReserve() {
  const stage = host && host.parentElement;
  if (!stage) return;
  const t = cur && cur.querySelector(".k-tab:not([hidden])"), e = t && t.closest(".k-pulltab");
  if (!e || !e._l) { stage.style.removeProperty("--st-tab-x"); stage.style.removeProperty("--st-tab-out"); return; }
  const x = Number(e._l.x), w = Number(e._l.w);
  if (Number.isFinite(x) && Number.isFinite(w)) stage.style.setProperty("--st-tab-x", String(Math.round((x + w / 2) * 1000) / 1000));
  stage.style.setProperty("--st-tab-out", e.dataset.out === "1" && e.dataset.pulled !== "1" ? `${slideOf(e)}px` : "0px");
}
function pullState(e, state, animate) {
  const sheet = e.querySelector(".k-sheet");
  const lead = leads(e._l, state);
  const from = sheetPos(e); // where the sheet is now (pulled counts as none)
  if (!lead && e.dataset.pulled === "1") { // the tally no longer leads (Back, or a new step): the pulled card folds back behind the front
    e.dataset.pulled = "0";
    e.querySelector(".k-tab").setAttribute("aria-expanded", "false");
    tabLabel(e);
    sheet.style.zIndex = "";
    if (animate) run(e.querySelector(".k-fronti"), [{ opacity: 0 }], T.state, T.easeOut); // the front comes back over it
  }
  e.dataset.out = lead ? "1" : "0";
  const to = sheetPos(e);
  sheet.style.transform = to === "none" ? "" : to;
  if (e.dataset.pulled === "1") sheet.style.zIndex = "2";
  if (animate && from !== to) {
    sheet.style.zIndex = "2"; // stays on top until the slide ends
    run(sheet, [{ transform: from }], T.in, T.easeOut).then(() => { if (e.dataset.pulled !== "1") sheet.style.zIndex = ""; });
  } else if (e.dataset.pulled !== "1") sheet.style.zIndex = "";
}
function pullToggle(e) {
  const sheet = e.querySelector(".k-sheet"), btn = e.querySelector(".k-tab");
  const from = sheetPos(e);
  e.dataset.pulled = e.dataset.pulled === "1" ? "0" : "1";
  const to = sheetPos(e);
  btn.setAttribute("aria-expanded", e.dataset.pulled === "1" ? "true" : "false");
  tabLabel(e);
  tabReserve();
  sheet.style.transform = to === "none" ? "" : to;
  sheet.style.zIndex = "2";
  skip = false;
  const p = run(sheet, [{ transform: from }], T.in, T.easeOut);
  if (skip || redNow() || from === to) { if (e.dataset.pulled !== "1") sheet.style.zIndex = ""; return; }
  p.then(() => { if (e.dataset.pulled !== "1") sheet.style.zIndex = ""; });
}
function ticketState(e, state) {
  const l = e._l, id = l.meter || "fate";
  const m = (pack.meters || []).find(x => x.id === id) || { max: 6, start: 3 };
  const v = state && state.meters && state.meters[id];
  const n = Math.max(0, Math.round(m.max - (m.min || 0)));
  const val = v == null ? (m.start == null ? 0 : m.start) : v;
  let h = "";
  for (let i = 1; i <= n; i++) h += `<span class="b" data-on="${i <= val - (m.min || 0) ? 1 : 0}"></span>`;
  for (const b of e.querySelectorAll(".k-boxes")) b.innerHTML = h;
  const torn = v != null && m.start != null && v < m.start;
  tearTo(e, torn);
}
function tearTo(e, torn) {
  e.dataset.torn = torn ? "1" : "0";
  const t = e.querySelector(".k-top"), b = e.querySelector(".k-bot"), s = e.querySelector(".k-stub");
  t.style.transform = torn ? `translate(0,${-T.d2}px) rotate(${-T.tilt}deg)` : "";
  b.style.transform = torn ? `translate(0,${T.d2}px) rotate(${T.tilt}deg)` : "";
  s.textContent = torn ? "★ 1 FP spent" : "★ 1 FP";
}

// ---------------------------------------------------------------- swapping sets
function cloneOf(s) {
  const c = s.cloneNode(true);
  c.setAttribute("aria-hidden", "true"); c.inert = true;
  c.style.clipPath = ""; c.style.opacity = "";
  tabsOn(c, false);
  return c;
}
function commit() { // finish a pending swap: drop the old set and the leaf, show the new set at rest
  if (!pend) return;
  const p = pend; pend = null;
  if (p.leaf && p.leaf.parentNode) p.leaf.remove();
  if (p.old && p.old.parentNode) p.old.remove();
  p.next.style.opacity = ""; p.next.style.clipPath = ""; p.next.inert = false;
}
function popEntries(next) { // the things that enter with a turn, in order: pop groups and tunnels
  const out = [];
  for (const g of next.querySelectorAll(".k-pop")) out.push(g);
  for (const t of next.querySelectorAll(".k-tunnel")) out.push(t);
  out.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return out;
}
function enterAnims(next, budget) {
  const ps = [];
  const list = popEntries(next).slice(0, Math.max(0, budget));
  list.forEach((g, i) => {
    const delay = i * T.stagger;
    if (g.classList.contains("k-tunnel")) {
      ps.push(run(g, [{ transform: "scale(1.06)", opacity: 0 }], T.in, T.easeOut, delay));
      return;
    }
    const gb = g.getBoundingClientRect();
    const kids = [...g.children].map(c => c.getBoundingClientRect());
    const stand = g.dataset.kind === "stand";
    const oy = stand ? Math.max(...kids.map(r => r.bottom)) - gb.top : Math.min(...kids.map(r => r.top)) - gb.top;
    g.style.transformOrigin = `50% ${Number.isFinite(oy) ? oy.toFixed(1) : 0}px`;
    ps.push(run(g, [{ transform: `rotateX(${stand ? T.fold : -T.fold}deg)`, opacity: 0 }], T.in, T.easeOut, delay));
  });
  return ps;
}
function turnAnim(p, dir) {
  const { next, old } = p;
  const right = dir > 0;
  const leaf = el("div", "k-leaf"); leaf.dataset.dir = right ? "r" : "l";
  const fr = el("div", "k-face k-lf"), bk = el("div", "k-face k-lb");
  const a = el("div", "k-clone"), b = el("div", "k-clone");
  a.style.left = right ? "-100%" : "0"; b.style.left = right ? "0" : "-100%";
  a.appendChild(cloneOf(old)); b.appendChild(cloneOf(next));
  fr.appendChild(a); bk.appendChild(b); leaf.append(fr, bk);
  old.style.clipPath = right ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)";
  leaf.style.transform = `rotateY(${right ? -180 : 180}deg)`; // the end state
  root.appendChild(leaf);
  p.leaf = leaf;
  const ps = [run(leaf, [{ transform: "rotateY(0deg)" }], T.turn, T.easeOut)];
  ps.push(...enterAnims(next, T.max - 1));
  return settle(ps);
}

// ---------------------------------------------------------------- the stage: stamp, screen, cover
function dropStamp() { if (stamp) { stamp.remove(); stamp = null; } }
function uncover() {
  closed = 0;
  const c = root.querySelector(".k-cover"); if (c) c.remove();
  if (cur) { cur.style.visibility = ""; tabsOn(cur, true); }
}
function renderScreen() {
  if (!cur) return;
  let box = cur.querySelector(".k-screen");
  const old = cur.querySelector(".k-screen-free");
  if (!lines.length) { if (box) box.innerHTML = ""; if (old) old.remove(); return; }
  if (!box) {
    box = old || el("div", "k-screen k-screen-free");
    box.setAttribute("aria-hidden", "true");
    if (!old) cur.querySelector(".k-book").appendChild(box);
  }
  box.innerHTML = lines.map(t => `<span>${esc(t)}</span>`).join("");
  run(box, [{ opacity: 0 }], T.state, T.easeOut);
}

// ---------------------------------------------------------------- tilt (tunnel)
function tiltApply() {
  if (!cur) return;
  for (const t of cur.querySelectorAll(".k-tunnel")) for (const q of t.querySelectorAll(".k-plane")) {
    const z = parseFloat(q.dataset.z) || 0;
    q.style.transform = `translate(${(tilt.x * z * T.tunnel).toFixed(2)}px,${(z * 6 + tilt.y * z * T.tunnel * 0.6).toFixed(2)}px)`;
  }
}
function tiltEnabled() { return !redNow() && !document.hidden && !docEl.hasAttribute("data-cue"); }

// ---------------------------------------------------------------- the kit
const kit = {
  mount(r, o) {
    host = r; assets = (o && o.assets) || {}; pack = (o && o.pack) || {};
    const cs = getComputedStyle(docEl);
    const n = (name, d) => { const x = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(x) ? x : d; };
    const s = (name, d) => (cs.getPropertyValue(name) || "").trim() || d;
    T = { turn: n("--m-turn", 650), cross: n("--m-cross", 650), ink: n("--m-ink", 800), bloom: n("--m-bloom", 700), seal: n("--m-seal", 300),
      roll: n("--m-roll", 900), tear: n("--m-tear", 500), close: n("--m-close", 1200), state: n("--m-state", 250), in: n("--m-in", 450),
      stagger: n("--m-stagger", 80), d2: n("--m-d2", 8), d3: n("--m-d3", 16), d4: n("--m-d4", 32), tilt: n("--m-tilt", 3),
      fold: n("--m-fold", 80), flap: n("--m-flap", 150), tunnel: n("--m-tunnel", 24), rollTurn: n("--m-roll-turn", 540),
      wash: n("--m-wash-alpha", 0.3), max: Math.max(1, Math.round(n("--m-layers-max", 3))),
      easeOut: s("--m-ease-out", "ease-out"), easeIn: s("--m-ease-in", "ease-in"), easeThump: s("--m-ease-thump", "ease-out") };
    if (!document.getElementById("k-paper-css")) {
      const st = document.createElement("style"); st.id = "k-paper-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    root = el("div", "k-root");
    root.dataset.map = docEl.getAttribute("data-map") || "ink";
    host.appendChild(root);
    root.addEventListener("click", e => {
      const b = e.target.closest && e.target.closest(".k-tab");
      if (b && cur && cur.contains(b)) pullToggle(b.closest(".k-pulltab"));
    });
    host.addEventListener("pointerdown", e => {
      if (!tiltEnabled() || !cur || !cur.querySelector(".k-tunnel") || (e.target.closest && e.target.closest("button"))) return;
      tilt.down = true; tilt.sx = e.clientX; tilt.sy = e.clientY;
    });
    host.addEventListener("pointermove", e => {
      if (!tilt.down) return;
      if (!tiltEnabled()) { tilt.down = false; tilt.tx = tilt.ty = 0; return; }
      const r2 = host.getBoundingClientRect();
      tilt.tx = Math.max(-1, Math.min(1, (e.clientX - tilt.sx) / (r2.width * 0.35)));
      tilt.ty = Math.max(-1, Math.min(1, (e.clientY - tilt.sy) / (r2.height * 0.35)));
    });
    const up = () => { tilt.down = false; tilt.tx = tilt.ty = 0; };
    host.addEventListener("pointerup", up); host.addEventListener("pointercancel", up); host.addEventListener("pointerleave", up);
  },

  show(id, set, o) {
    commit();
    const state = o && o.state;
    const old = cur;
    const instant = !!(o && o.instant) || !old;
    if (closed) uncover();
    dropStamp();
    const next = buildSet(id, set, state, instant ? !!(state && state.look === "paint") : !!(old && old.dataset.wash === "1"));
    cur = next;
    if (old) tabsOn(old, false);
    tilt.tx = tilt.ty = tilt.x = tilt.y = 0;
    if (instant) {
      if (old) old.remove(); root.appendChild(next); pend = null;
      if (!old) run(next, [{ opacity: 0, offset: 0 }], T.state, T.easeOut); // the page's first set fades in (the shell builds it after the title paints)
    }
    else { next.inert = true; root.insertBefore(next, old); pend = { next, old, leaf: null }; }
    tabReserve();
  },

  update(state) {
    skip = false;
    commit();
    last = state;
    if (closed === 1) closed = 2; else if (closed === 2) uncover();
    if (stamp) { if (stampAge >= 1) dropStamp(); else stampAge++; }
    if (!cur || !state) return;
    if (closed !== 2) { cur.style.visibility = ""; tabsOn(cur, true); }
    if (state.look) setWash(cur, state.look === "paint");
    else setWash(cur, false);
    for (const f of cur.querySelectorAll(".k-flap")) setFlap(f, !!state.revealed);
    for (const t of cur.querySelectorAll(".k-pulltab")) pullState(t, state, true);
    for (const t of cur.querySelectorAll(".k-ticket")) ticketState(t, state);
    tabReserve();
  },

  cue(c, o) {
    skip = !!(o && o.reduced) || redNow();
    const red = skip;
    switch (c.type) {
      case "turn": {
        dropStamp(); // the choice was final; a new page starts clean
        if (!pend) return Promise.resolve();
        const p = pend;
        setWash(p.next, false); // the look cue that follows brings it
        p.next.style.opacity = "";
        if (red || !p.old) { commit(); return Promise.resolve(); }
        p.next.inert = false;
        return track(turnAnim(p, c.dir || 1), commit);
      }
      case "shift": {
        dropStamp();
        if (!pend) return Promise.resolve();
        const p = pend;
        if (red || !p.old) { commit(); return Promise.resolve(); }
        p.old.style.opacity = "0"; // the end state of the old set: gone
        p.next.inert = false;
        const ps = [run(p.next, [{ opacity: 0 }], T.cross, T.easeOut), run(p.old, [{ opacity: 1 }], T.cross, T.easeOut)];
        return track(settle(ps), commit);
      }
      case "ink": {
        if (!cur) return Promise.resolve();
        const reveal = !!(o && o.beat && o.beat.reveal);
        const ps = [];
        let budget = T.max;
        if (cur.dataset.wash === "1") { // unwitnessed: the warm wash fades
          setWash(cur, false); budget--;
          ps.push(run(cur.querySelector(".k-glow"), [{ opacity: 1 }], T.state, T.easeOut));
        }
        if (reveal) {
          for (const f of cur.querySelectorAll(".k-flap")) {
            if (budget <= 0) { setFlap(f, true); continue; }
            setFlap(f, true); budget--;
            ps.push(run(f.querySelector(".k-lid"), [{ transform: "rotateX(0deg)" }], T.ink, T.easeOut));
            const d = f.querySelector(".k-under .d");
            if (d && budget > 0) { budget--; ps.push(run(d, [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }], T.ink, T.easeOut)); }
          }
        } else {
          const cand = [...cur.querySelectorAll(".k-vfold .d, .k-plate .d, .k-parallel .d")];
          for (const d of cand) {
            if (budget <= 0) break;
            budget--;
            ps.push(run(d, [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }], T.ink, T.easeOut));
          }
        }
        return track(settle(ps));
      }
      case "bloom": {
        if (!cur) return Promise.resolve();
        setWash(cur, true);
        const ps = [run(cur.querySelector(".k-glow"), [{ opacity: 0 }], T.bloom, T.easeOut)];
        const pl = cur.querySelector('.k-plate[data-look="paint"]');
        if (pl) ps.push(run(pl, [{ transform: `rotate(${T.tilt}deg)` }], T.bloom, T.easeOut));
        return track(settle(ps));
      }
      case "seal": {
        dropStamp();
        stamp = el("div", "k-stamp", "<span>Sealed</span>");
        stamp.setAttribute("aria-hidden", "true");
        stampAge = 0;
        root.appendChild(stamp);
        return track(run(stamp, [{ transform: "scale(1.4)", opacity: 0 }], T.seal, T.easeThump));
      }
      case "roll": {
        const w = cur && cur.querySelector(".k-volvelle");
        if (!w) return Promise.resolve();
        const l = w._l, range = Array.isArray(l.range) && l.range.length === 2 ? l.range : [2, 12];
        const n = range[1] - range[0] + 1;
        const center = l.center != null ? l.center : Math.round((range[0] + range[1]) / 2);
        const total = Math.max(range[0], Math.min(range[1], Math.round(c.total == null ? center : c.total)));
        const target = -((total - center) * 360 / n);
        const base = w._rot || 0;
        let next = base + T.rollTurn;
        next += (((target - next) % 360) + 360) % 360;
        w._rot = next;
        const wh = w.querySelector(".k-wheel");
        wh.style.transform = `rotate(${next}deg)`;
        w.dataset.total = String(total);
        return track(run(wh, [{ transform: `rotate(${base}deg)` }], T.roll, T.easeOut));
      }
      case "tear": {
        const t = cur && cur.querySelector(".k-ticket");
        if (!t) return Promise.resolve();
        const top = t.querySelector(".k-top"), bot = t.querySelector(".k-bot");
        tearTo(t, true);
        return track(settle([run(top, [{ transform: "none" }], T.tear, T.easeOut), run(bot, [{ transform: "none" }], T.tear, T.easeOut)]));
      }
      case "close": {
        if (!cur) return Promise.resolve();
        closed = 1;
        const cover = el("div", "k-cover", `<div class="k-cover-in" aria-hidden="true"><svg viewBox="0 0 48 32" focusable="false" aria-hidden="true"><path d="M24 8c-4-3-10-3-16-1v18c6-2 12-2 16 1 4-3 10-3 16-1V7c-6-2-12-2-16 1zM24 8v18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><b>${esc((pack && pack.title) || "")}</b></div>`);
        root.appendChild(cover);
        if (red) { cur.style.visibility = "hidden"; tabsOn(cur, false); return Promise.resolve(); }
        const a = el("div", "k-half-page"), b = el("div", "k-half-page");
        a.dataset.side = "l"; b.dataset.side = "r";
        const ca = el("div", "k-clone"), cb = el("div", "k-clone");
        ca.style.left = "0"; cb.style.left = "-100%";
        ca.appendChild(cloneOf(cur)); cb.appendChild(cloneOf(cur));
        a.appendChild(ca); b.appendChild(cb);
        root.insertBefore(a, cover); root.insertBefore(b, cover);
        cur.style.visibility = "hidden"; tabsOn(cur, false);
        a.style.transform = `rotateY(90deg)`; b.style.transform = `rotateY(-90deg)`; // the end states: edge on, met at the gutter
        const ps = [run(a, [{ transform: "rotateY(0deg)" }], T.close, T.easeIn), run(b, [{ transform: "rotateY(0deg)" }], T.close, T.easeIn),
          run(cover, [{ opacity: 0 }], T.close / 2, T.easeOut, T.close / 2)];
        return track(settle(ps), () => { a.remove(); b.remove(); });
      }
      default:
        return Promise.resolve(); // cost, gain, tally: the margin is the HUD, and update() restores the pull-tab
    }
  },

  // A tap during a cue: every animation jumps to its end, a pending swap completes, and the cue's Promise settles now.
  finish() {
    const a = act; act = null;
    for (const x of [...active]) { try { x.finish(); } catch (e) {} }
    active.clear();
    commit();
    if (a) { try { a.end && a.end(); } catch (e) {} a.res(); }
  },

  tick() {
    if (!root) return false;
    if (!tiltEnabled()) { // reduced, hidden or a cue is playing: the planes rest
      tilt.down = false; tilt.tx = tilt.ty = 0;
      if (tilt.x || tilt.y) { tilt.x = tilt.y = 0; tiltApply(); }
      return false;
    }
    tilt.x += (tilt.tx - tilt.x) * 0.14; tilt.y += (tilt.ty - tilt.y) * 0.14;
    if (Math.abs(tilt.tx - tilt.x) < 0.002 && Math.abs(tilt.ty - tilt.y) < 0.002) { tilt.x = tilt.tx; tilt.y = tilt.ty; }
    tiltApply();
    return tilt.down || tilt.x !== tilt.tx || tilt.y !== tilt.ty;
  },

  setMap(style) { if (root) root.dataset.map = style === "blueline" ? "blueline" : "ink"; },

  screen(l) { lines = Array.isArray(l) ? l.filter(x => typeof x === "string") : []; renderScreen(); },

  card(scene) {
    const place = scene.ending ? "Ending" : scene.place || "";
    return `<div class="scene-card">${place ? `<p class="card-place">${esc(place)}</p>` : ""}<h2 class="card-title">${esc(scene.title)}</h2><div class="card-rule"></div></div>`;
  },

  destroy() { if (root) root.remove(); if (host) host.innerHTML = ""; active.clear(); cur = pend = act = stamp = null; closed = 0; },
};

// ---------------------------------------------------------------- the kit's styles
// Colours are the shell's --st-* tokens; --plate-gold, --plate-umber and --blueline are the OSR pack's own names and
// each has a fallback. Lengths and times are the --m-* tokens.
const CSS = `
.k-root{position:absolute;inset:0;overflow:hidden;container-type:size;perspective:var(--m-persp,1200px);color:var(--k-ink);background:var(--st-bg);
  --k-ink:var(--st-ink);--k-text:var(--k-ink);--k-gold:var(--plate-gold,var(--st-lamp));--k-umber:var(--plate-umber,var(--st-ink-soft));--k-stone:var(--st-line);--k-shade:var(--st-tint2)}
html[data-map="blueline"] .k-root,.k-root[data-map="blueline"]{--k-ink:var(--blueline,var(--st-accent));--k-text:var(--st-ink)}
@supports (background:color-mix(in srgb,red 50%,blue)){html[data-map="blueline"] .k-root,.k-root[data-map="blueline"]{--k-text:color-mix(in srgb,var(--blueline,var(--st-accent)) 12%,var(--st-ink))}}
@supports (background:color-mix(in srgb,red 50%,blue)){.k-root{--k-shade:color-mix(in srgb,var(--st-ink) 20%,transparent)}}
.k-set,.k-ground,.k-glow,.k-glow>*,.k-clone,.k-half-page,.k-cover{position:absolute;inset:0}
.k-set{overflow:hidden}
.k-art.k-ground-art,.k-art.k-ground-art svg,.k-art.k-ground-art img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}
.k-ground::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 38%,var(--st-tint1) 49.2%,var(--k-shade) 49.9%,var(--st-tint1) 50.6%,transparent 62%);opacity:.9}
.k-book{position:absolute;top:0;height:100%;width:100%;left:0;perspective:var(--m-persp,1200px)}
@supports (width:1cqw){.k-book{width:min(100cqw,100cqh);left:50%;translate:-50% 0}}
.k-pop{position:absolute;inset:0;pointer-events:none}
.k-layer{position:absolute;translate:-50% -50%;pointer-events:none}
.k-art{display:block}
.k-art svg,.k-art img{display:block;width:100%;height:auto;overflow:visible}
.k-art text{font-family:var(--st-font-display);fill:var(--k-text)}
.k-art .fi{fill:currentColor}.k-art .fp{fill:var(--st-bg)}.k-art .f1{fill:var(--st-tint1)}.k-art .f2{fill:var(--st-tint2)}
.k-art .fg{fill:var(--k-gold)}.k-art .fu{fill:var(--k-umber)}.k-art .fs{fill:var(--k-stone)}
.k-art .sg{stroke:var(--k-gold)}.k-art .su{stroke:var(--k-umber)}.k-art .ss{stroke:var(--k-stone)}
.k-vfold::after,.k-parallel::after{content:"";position:absolute;left:6%;right:6%;bottom:-3%;height:7%;background:radial-gradient(closest-side,var(--k-shade),transparent);z-index:-1}
.k-vfold{transform-origin:50% 100%}
.k-frame{position:relative;padding:2.2%;background:var(--st-bg);border:2px solid var(--k-ink);container-type:inline-size}
.k-plate[data-look="paint"] .k-frame{border-color:var(--k-umber);box-shadow:0 0 0 1px var(--k-gold)}
.k-plate{transform-origin:50% 50%}
.k-artbox{position:relative}
.k-screen{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start;gap:.15em;padding:.4em .7em;box-sizing:border-box;
  font:400 clamp(11px,3.15cqw,17px)/1.3 var(--st-font-mono);color:var(--st-ink);background:var(--st-bg);overflow-wrap:anywhere}
.k-screen span{display:block}
.k-screen-free{left:50%;top:12%;translate:-50% 0;width:min(86%,24rem);height:auto;font-size:clamp(12px,3.6cqw,16px);border:1px solid var(--k-ink);pointer-events:none;container-type:normal}
@container (min-aspect-ratio:3/2){.k-plate.k-hasscreen{width:min(175cqh,94cqw)!important;top:47cqh!important}} /* a short, wide stage: the book box is only as wide as it is tall, so the screen plate grows past it to keep 11px text whole */
.k-tunnel{transform-origin:50% 50%}
.k-drift{position:relative;width:100%;height:100%;animation:k-drift var(--m-idle,26000ms) steps(52,end) infinite alternate}
.k-plane{position:absolute;inset:0}
.k-plane .k-art,.k-plane svg{width:100%;height:100%}
@keyframes k-drift{to{transform:scale(var(--m-idle-scale,1.02))}}
[data-cue] .k-drift,html[data-hidden] .k-drift{animation-play-state:paused}
.k-flap{perspective:var(--m-persp,1200px)}
.k-lid{position:relative;transform-origin:50% 0;transform-style:preserve-3d}
.k-under{position:absolute;inset:0}
.k-face{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.k-lid .k-back{position:absolute;inset:0;transform:rotateX(180deg);background:var(--st-tint2);border:1.5px solid var(--k-ink)}
.k-fronti{position:relative;z-index:1}
.k-sheet{position:absolute;inset:0;z-index:0}
.k-tab{pointer-events:auto;position:absolute;right:calc(var(--m-d3,16px) * -1);top:50%;translate:0 -50%;width:var(--m-d3,16px);min-height:44px;height:max(76px,72%);
  padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--st-bg);color:var(--st-ink);
  border:1.5px solid var(--k-ink);border-left:0;border-radius:0 6px 6px 0;font:700 .6875rem/1 var(--st-font-ui);letter-spacing:.1em;text-transform:uppercase}
.k-tab[hidden]{display:none}
.k-tab span{writing-mode:vertical-rl;white-space:nowrap}
.k-tab::before{content:"";position:absolute;top:-6px;bottom:-6px;left:-24px;right:-4px}
.k-tab:focus-visible{outline:3px solid var(--st-accent);outline-offset:2px}
.k-wheel{position:absolute;inset:0;transform-origin:50% 50%}
.k-pointer{position:absolute;left:50%;top:-6px;width:0;height:0;translate:-50% 0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:13px solid var(--k-ink)}
.k-half{position:absolute;inset:0;transform-origin:50% 50%}
.k-top{clip-path:inset(0 0 49.6% 0)}.k-bot{clip-path:inset(49.6% 0 0 0)}
.k-tk{position:absolute;inset:0}
.k-boxes{position:absolute;left:10%;right:10%;bottom:12%;display:flex;gap:3%;justify-content:center}
.k-boxes .b{flex:0 0 11%;aspect-ratio:1;border:1.5px solid currentColor;box-sizing:border-box;background:var(--st-bg)}
.k-boxes .b[data-on="1"]{background:radial-gradient(circle,var(--st-ink) 0 24%,transparent 26%)}
.k-boxes .b[data-on="0"]{background:repeating-linear-gradient(135deg,currentColor 0 1px,transparent 1px 4px)}
.k-stub{position:absolute;left:50%;top:100%;translate:-50% 4px;white-space:nowrap;padding:1px 8px;font:700 .75rem/1.3 var(--st-font-ui);letter-spacing:.06em;color:var(--st-ink);background:var(--st-bg);border:1px solid var(--k-ink);border-radius:999px}
.k-glow{pointer-events:none;opacity:0}
.k-wash{background:var(--k-gold);opacity:var(--m-wash-alpha,.3)}
.k-lamp{background:radial-gradient(ellipse 75% 65% at 50% 32%,var(--k-gold),transparent 72%);opacity:calc(var(--m-wash-alpha,.3) * .3)}
.k-leaf{position:absolute;top:0;bottom:0;width:50%;z-index:6;transform-style:preserve-3d;pointer-events:none}
.k-leaf[data-dir="r"]{left:50%;transform-origin:0 50%}
.k-leaf[data-dir="l"]{left:0;transform-origin:100% 50%}
.k-leaf .k-face{position:absolute;inset:0;overflow:hidden}
.k-leaf .k-clone{inset:auto;top:0;height:100%;width:200%}
.k-leaf .k-lb{transform:rotateY(180deg)}
.k-lf::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--k-shade),transparent 30%)}
.k-leaf[data-dir="l"] .k-lf::after{background:linear-gradient(270deg,var(--k-shade),transparent 30%)}
.k-half-page{z-index:6;width:50%;overflow:hidden;pointer-events:none;inset:0 auto 0 0}
.k-half-page[data-side="l"]{left:0;transform-origin:100% 50%}
.k-half-page[data-side="r"]{left:50%;transform-origin:0 50%}
.k-half-page .k-clone{inset:auto;top:0;height:100%;width:200%}
.k-stamp{position:absolute;left:var(--st-gutter,16px);top:36px;z-index:7;width:4.6rem;height:4.6rem;border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none;
  background:var(--st-bg);color:var(--k-text);border:3px double var(--k-ink);transform:rotate(calc(var(--m-tilt,3deg) * -3));font:700 .75rem/1 var(--st-font-display);letter-spacing:.14em;text-transform:uppercase}
.k-cover{z-index:7;display:flex;align-items:center;justify-content:center;pointer-events:none;background:var(--st-bg)}
.k-cover-in{width:min(62%,18rem);aspect-ratio:3/4;max-height:78%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;text-align:center;
  background:var(--st-ink);color:var(--st-bg);border-radius:4px 10px 10px 4px;outline:2px solid var(--k-gold);outline-offset:-10px;box-shadow:inset 8px 0 0 var(--k-shade)}
.k-cover-in svg{width:40%;height:auto}
.k-cover-in b{font:700 clamp(1.1rem,5.2cqw,1.7rem)/1.15 var(--st-font-display);letter-spacing:.04em;text-wrap:balance}
`;

window.StageKit.register("paper", kit);
})();
