/* Kit: feed (the Algorithm's surveillance view). Contract: stage/SPEC.md section 4, stage/MOTION.md.
   One camera frame with a channel and a clock, boxes on faces, a scan line, a log, redaction bars and framed plates.

   How the picture is laid out
   - The frame's art is drawn in a "cam": a box with the art's own aspect. Its scale is cover (like object-fit: cover) unless
     the x span of what must be seen (every track and plate in the cam, with half their widths, and any log or redaction bar
     placed in the cam) is wider than the stage; then it scales down until the span fits, and the ground colour fills what the
     art no longer covers. The cam is centred on that span (on frame.focus[0] when there is none) and anchored so that the
     art's focus line (frame.focus[1], default y 0.30) sits 30 percent down the stage. The text panel covers the lower stage
     on a phone, so a set keeps what matters in the top third of its art.
   - Tracks live in the cam (x, y, w are fractions of the art), so a box stays on its face at every size. Logs, redaction bars,
     plates and the frame chrome (channel, clock, rule) live in stage space. A layer takes "space": "cam" or "stage" to override.
     A box (track or plate) is never made taller than the room above and below its centre; a plate in the stage space is w of
     the stage's shorter side wide.
   - Art is SVG, injected inline so it reads the theme. An svg with class="ink" on its root styles itself with the classes below
     (s, h, b, a, m, f0 to f3, fk, fa, fl, q0, q1, q2); any other svg keeps the colours it carries. The kit removes script,
     foreignObject, every on* attribute and every href that does not start with #. A raster file is an <img>.

   Layer properties (all optional unless marked; x, y, w, h are fractions)
     frame   art (path), channel, view, time ("06:47:12"), status (a centred chip, "NO SIGNAL"), static (noise over the art),
             file (the art carries data-band borders for the exposure bands), focus [x, y] (the art point to anchor), aspect
     track   cast (id), x, y, w; label (text) or bind (a field) with labels (field value to text); conf (a number, false to
             hide) or confs (field value to number, for a bound track; wins over the formula) and otherwise 26 + 12 x exposure;
             face false (no portrait, a bare box); labelAt "below"
             A person with no x, y and r in cast.json draws as a staticky VIDEO FEED DISABLED box. A person's `alt` list
             ({ when: { field, is }, x, y, r }) swaps the crop while the field matches.
     log     lines (strings, or { t, red: true } for a line under a bar), on (the cues that print a line: seal, roll, cost,
             gain, tear, ink), x or right, y (a fraction of the stage; left out, the log sits 54 px down, just under the channel
             chips, where a phone's text panel does not reach), w (a limit), max (rows kept, default 8), modLabel (the roll's
             modifier name), keep (the beat's screen lines stay)
     redact  text (the caption under the bar), x, y, w, h, space, opensOn "reveal" | "none", over "track" (the bar covers
             that track's name field)
     plate   cast (id) or art, x, y, w, space, desat "exposure"
     scan    nothing: one layer of ambient sweep and the roll pass

   What each cue does (end states are the elements' own styles; animation runs from a start keyframe, with fill: backwards)
     turn   hard cut: new set, new channel, clock set from the scene's place line, log prints again, boxes lock in at 1.12.
     shift  crossfade over --m-cross; the clock holds.
     ink    focus goes soft, box fills and faces dim (the dashed border keeps full strength), a redaction lifts on a reveal.
     bloom  focus comes up (sharp layer over a pre-blurred copy); box fills and faces brighten by opacity. No scale.
     seal   boxes go from dashed to solid, the frame rule goes firm, the label reads LOCKED. No scale.
     roll   one scan pass; the dice cells fill left to right; the log prints the roll. The boxes do not move.
     cost, gain, tear, close as MOTION.md section 3.
   update(state) restores every state-bound visual in both directions: focus (look), boxes (exposure), labels (identity),
   redactions (revealed), the file border and plate (exposure bands). It does this in update() only, so forward cues still animate.
   The box scale animates on a turn only (1.12 to 1). The scale a box rests at follows its confidence and changes with no motion.
   Nothing here is animated except transform and opacity. Timings come from --m-* tokens; colours from --st-* tokens.
   Under reduced motion (the media query, or <html data-motion="calm">) no animate() is called and the end state shows at once.
   The clock counts on a one-second timer (cleared when hidden, reduced or closed); tick() returns false: nothing moves per frame.
   The drift and the sweep move in steps, about two a second (--k-idle-steps, --k-sweep-steps, set in mount() from --m-idle and
   --m-scan), so a 2 percent scale or a faint line does not keep the compositor at 60 frames a second. */
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
const ms = (cs, n, d) => { const x = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(x) ? x : d; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pct = f => (f * 100).toFixed(3) + "%";
const MINUS = "−", FOCAL = 0.30;

const CSS = `
.k-set{position:absolute;inset:0;overflow:hidden;background:var(--st-bg);color:var(--st-ink);font-family:var(--st-font-mono)}
.k-camwrap{position:absolute;overflow:visible}
.k-cam{position:absolute;inset:0}
.k-art,.k-soft{position:absolute;inset:0}
.k-soft{filter:blur(3px);transform:scale(1.03)}
.k-art svg,.k-soft svg,.k-art img,.k-soft img{display:block;width:100%;height:100%}
.k-sharp{opacity:0}
.k-in-focus .k-sharp{opacity:1}
.k-lines{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,transparent 0,transparent 2px,var(--k-line-ink,transparent) 2px,var(--k-line-ink,transparent) 3px)}
.k-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 40%,transparent 55%,var(--k-vig,transparent) 100%)}
.k-noise{position:absolute;inset:0;pointer-events:none;background:var(--st-ink-soft);opacity:.5;-webkit-mask-image:var(--k-noise);mask-image:var(--k-noise);-webkit-mask-size:96px 96px;mask-size:96px 96px}
.k-static-art{position:absolute;inset:0;background:var(--st-panel);opacity:.55;pointer-events:none}

:where(.k-art svg.ink *,.k-soft svg.ink *){vector-effect:non-scaling-stroke;fill:none;stroke:none}
.k-art .s,.k-soft .s{stroke:var(--st-ink-soft);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.k-art .h,.k-soft .h{stroke:var(--st-line);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
.k-art .b,.k-soft .b{stroke:var(--st-ink);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.k-art .a,.k-soft .a{stroke:var(--st-accent);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.k-art .m,.k-soft .m{stroke:var(--st-muted);stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}
.k-art .f0,.k-soft .f0{fill:var(--st-bg)}
.k-art .f1,.k-soft .f1{fill:var(--st-panel)}
.k-art .f2,.k-soft .f2{fill:var(--st-card)}
.k-art .f3,.k-soft .f3{fill:var(--st-line)}
.k-art .fk,.k-soft .fk{fill:var(--st-ink-soft)}
.k-art .fa,.k-soft .fa{fill:var(--st-accent)}
.k-art .fl,.k-soft .fl{fill:var(--st-lamp)}
.k-art .q0,.k-soft .q0{opacity:.18}
.k-art .q1,.k-soft .q1{opacity:.35}
.k-art .q2,.k-soft .q2{opacity:.6}
.k-art text,.k-soft text{fill:var(--st-ink-soft);stroke:none;font-family:var(--st-font-mono);font-weight:700;letter-spacing:.08em}
.k-art text.ta,.k-soft text.ta{fill:var(--st-accent)}

.k-chrome{position:absolute;inset:0;pointer-events:none;z-index:2}
.k-rule{position:absolute;left:6px;right:6px;top:28px;bottom:6px;border:1px solid var(--st-line)}
.k-locked .k-rule{border:2px solid var(--st-ink-soft)}
.k-br{position:absolute;width:14px;height:14px;border:2px solid var(--st-ink-soft)}
.k-br.tl{left:6px;top:28px;border-right:0;border-bottom:0}.k-br.tr{right:6px;top:28px;border-left:0;border-bottom:0}
.k-br.bl{left:6px;bottom:6px;border-right:0;border-top:0}.k-br.br{right:6px;bottom:6px;border-left:0;border-top:0}
.k-chip{position:absolute;top:34px;font:700 .75rem/1.4 var(--st-font-mono);letter-spacing:.06em;color:var(--st-ink);background:var(--st-scrim);padding:0 6px;white-space:nowrap}
.k-chip.l{left:12px}.k-chip.r{right:12px}
.k-chip .dot{display:inline-block;width:.5em;height:.5em;border-radius:50%;background:var(--st-accent);margin-right:.4em;vertical-align:.05em}
.k-status{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 .875rem/1.4 var(--st-font-mono);letter-spacing:.14em;color:var(--st-ink);background:var(--st-scrim);padding:2px 10px;border:1px solid var(--st-edge)}

.k-track{position:absolute;aspect-ratio:1/1;transform:translate(-50%,-50%)}
.k-tbox{position:absolute;inset:0;border:2px dashed var(--st-accent);transform:scale(var(--k-s,1))}
.k-tdim{position:absolute;inset:0;background:var(--st-card)}
.k-locked .k-tbox,.k-track.is-locked .k-tbox{border-style:solid}
.k-tface{position:absolute;inset:0;background-repeat:no-repeat;background-image:var(--k-sheet);opacity:var(--k-fo,1)}
.k-track.is-bare .k-tdim{background:transparent}
.k-tnoise{position:absolute;inset:0;background:var(--st-ink-soft);opacity:.5;-webkit-mask-image:var(--k-noise);mask-image:var(--k-noise);-webkit-mask-size:96px 96px;mask-size:96px 96px}
.k-tcam{position:absolute;left:50%;top:50%;width:46%;height:46%;transform:translate(-50%,-50%)}
.k-tcam svg{display:block;width:100%;height:100%;fill:none;stroke:var(--st-ink);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.k-tlabel{position:absolute;font:700 .75rem/1.35 var(--st-font-mono);letter-spacing:.04em;color:var(--st-ink);background:var(--st-scrim);padding:1px 6px;text-transform:uppercase}
.k-tname{display:block;position:relative;overflow:hidden}
.k-tname .k-rbar{position:absolute;inset:0}
.k-tconf{display:block;color:var(--st-accent)}

.k-log:empty{display:none}
.k-log{position:absolute;font:.75rem/1.5 var(--st-font-mono);letter-spacing:.03em;color:var(--st-ink);background:var(--st-scrim);padding:4px 8px;border-left:2px solid var(--st-accent);overflow:hidden}
.k-ln{position:relative;white-space:pre-wrap;overflow-wrap:anywhere}
.k-ln.k-dice{display:flex;gap:4px;margin:2px 0}
.k-cell{flex:1 1 0;text-align:center;border:1px solid var(--st-edge);font-weight:700}
.k-cover{position:absolute;background:var(--st-panel);z-index:1}
.k-ln.k-red>.k-rbar{position:absolute;inset:0}
.k-rbar{background:var(--st-ink-soft);color:var(--st-bg);display:flex;align-items:center;justify-content:center;font:700 .625rem/1.4 var(--st-font-mono);letter-spacing:.02em;overflow:hidden;text-transform:uppercase}

.k-redact{position:absolute;transform:translate(-50%,-50%)}
.k-rcap{display:block;font:700 .8125rem/1.5 var(--st-font-mono);letter-spacing:.08em;text-align:center;color:var(--st-ink);background:var(--st-scrim);padding:2px 8px}
.k-redact .k-rbar{position:absolute;inset:0}
.k-redact.is-open .k-rbar,.k-ln.is-open .k-rbar,.k-tname.is-open .k-rbar{opacity:0;transform:translateY(-120%)}

.k-plate{position:absolute;transform:translate(-50%,-50%);aspect-ratio:1/1;border:2px solid var(--st-edge);background:var(--st-card);overflow:hidden}
.k-plate .k-pface,.k-plate .k-psoft{position:absolute;inset:0;background-repeat:no-repeat;background-image:var(--k-sheet)}
.k-plate .k-psoft{filter:blur(3px);transform:scale(1.05)}
.k-plate .k-pface{opacity:0}
.k-plate.in-focus .k-pface{opacity:1}
.k-plate .k-pface svg,.k-plate .k-psoft svg,.k-plate img{display:block;width:100%;height:100%}

.k-scanbox{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.k-sweep{position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(to bottom,var(--st-accent) 0,var(--st-accent) 2px,transparent 2px)}
.k-pass{position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(to bottom,var(--st-accent) 0,var(--st-accent) 2px,transparent 2px)}
.k-idle{animation:k-drift var(--m-idle) steps(var(--k-idle-steps,52),end) infinite alternate}
.k-sweep.on{animation:k-sweep var(--m-scan) steps(var(--k-sweep-steps,16),end) infinite}
@keyframes k-drift{to{transform:scale(var(--m-idle-scale))}}
@keyframes k-sweep{from{transform:translateY(0);opacity:.15}to{transform:translateY(100%);opacity:.15}}
html[data-cue] .k-idle,html[data-cue] .k-sweep.on,html[data-hidden] .k-idle,html[data-hidden] .k-sweep.on{animation-play-state:paused}
.k-stop .k-sweep.on{animation:none;opacity:0}
.k-stop .k-idle{animation:none}

.k-band{position:absolute;left:0;right:0;overflow:hidden;z-index:2;pointer-events:none}
.k-end{position:absolute;inset:0;pointer-events:none;z-index:5}
.k-endline{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:var(--st-ink-soft);opacity:0}
.k-closed .k-endline{opacity:1}
.k-endcap{position:absolute;left:50%;top:50%;transform:translate(-50%,-150%);font:700 .75rem/1.4 var(--st-font-mono);letter-spacing:.14em;color:var(--st-ink);background:var(--st-scrim);padding:0 8px;opacity:0;white-space:nowrap}
.k-closed .k-endcap{opacity:1}
.k-file [data-band]{display:none}
.k-file[data-b="1"] [data-band="1"],.k-file[data-b="2"] [data-band="1"],.k-file[data-b="2"] [data-band="2"],.k-file[data-b="3"] [data-band="1"],.k-file[data-b="3"] [data-band="2"],.k-file[data-b="3"] [data-band="3"]{display:inline}
.k-card-chan{margin-top:6px;font:700 .75rem/1.4 var(--st-font-mono);letter-spacing:.14em;color:var(--st-muted);text-align:center;text-transform:uppercase}
@supports (background: color-mix(in srgb, red 50%, blue)){
  .k-set{--k-line-ink:color-mix(in srgb,var(--st-ink) 5%,transparent);--k-vig:color-mix(in srgb,var(--st-bg) 70%,transparent)}
}
`;

// ---------------------------------------------------------------- state
let host, assets = {}, pack = null, cast = null, tk = {}, meterDefs = {}, styleEl = null, ro = null, endEl = null;
let cur = null;            // the newest set: after show() and before its swap it is not yet on screen
let pend = null;           // { next, old } between show() and the turn or shift cue that swaps them
let act = null, active = new Set(), skipNow = false;
let S = { meters: {}, fields: {}, tallies: {}, flags: {}, look: "", revealed: false }; // the last state update() saw
let focusOn = false;       // the look on show: true is paint (sharp), false is ink (soft)
let locked = false, closed = false, closedFresh = false;
let cueSeq = 0, stoppedSeq = -1;
let noiseOn = false;       // --k-noise is set on the host
let shownOnce = false;     // the page has had a set; the first one is laid out late (see settle())
const clock = { base: 0, acc: 0 };
let timer = 0, mq = null, mo = null;
const svgCache = new Map();

// ---------------------------------------------------------------- helpers
// A cue animation: from a start keyframe to the element's own style. Nothing runs under reduced motion.
function run(elm, frames, dur, ease, extra) {
  if (redNow() || skipNow || !elm) return Promise.resolve();
  const a = elm.animate(frames, Object.assign({ duration: dur, easing: ease, fill: "backwards" }, extra || {}));
  active.add(a);
  const done = () => active.delete(a);
  a.onfinish = done; a.oncancel = done;
  return a.finished.then(done, done);
}
// The active cue: its Promise settles on the natural end or on finish(), whichever comes first.
function track(p, end) {
  return new Promise(res => {
    const a = act = { end, res };
    const fin = () => { if (act === a) act = null; try { end && end(); } catch (e) {} res(); };
    Promise.resolve(p).then(fin, fin);
  });
}
const dead = seq => seq !== cueSeq || stoppedSeq === seq;
const stamp = n => { const t = ((Math.floor(n) % 86400) + 86400) % 86400; return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(x => String(x).padStart(2, "0")).join(":"); };
const parseTime = s => { const m = /(\d\d):(\d\d)(?::(\d\d))?/.exec(s || ""); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : null; };
const layersOf = set => (set && set.layers) || [];
const meterLabel = id => String((meterDefs[id] && meterDefs[id].label) || id).toUpperCase();
const signed = n => (n < 0 ? MINUS : "+") + Math.abs(n);
const faceChar = (dice, f) => (/dF$/i.test(dice) ? (f > 0 ? "+" : f < 0 ? MINUS : "0") : String(f));
// The set a cue should draw on. show() runs before a step's cues, so a seal, roll, cost, gain or tear (which come
// before the turn or shift) belongs to the set still on screen, not to the new one waiting underneath.
const visible = () => (pend && pend.old ? pend.old : cur);
function div(cls, css) { const e = document.createElement("div"); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; }

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// One 96 px tile of static, as an alpha mask. The colour comes from the element's own background (a theme token).
// The PNG is written by hand (grey + alpha, stored deflate blocks): a canvas and its PNG encoder cost far more than this.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xFFFFFFFF;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xFFFFFFFF) >>> 0);
  return out;
}
function makeNoise() {
  try {
    const N = 96, r = mulberry(1977);
    const raw = new Uint8Array(N * (1 + 2 * N)); // each row: filter byte 0, then (grey 0, alpha) per pixel
    let o = 0;
    for (let y = 0; y < N; y++) { raw[o++] = 0; for (let x = 0; x < N; x++) { raw[o++] = 0; raw[o++] = r() < 0.5 ? 0 : 80 + Math.floor(r() * 175); } }
    let a1 = 1, a2 = 0;
    for (let i = 0; i < raw.length; i++) { a1 = (a1 + raw[i]) % 65521; a2 = (a2 + a1) % 65521; }
    const z = new Uint8Array(2 + 5 + raw.length + 4), zv = new DataView(z.buffer); // zlib header, one stored block, Adler-32
    z[0] = 0x78; z[1] = 0x01; z[2] = 1; zv.setUint16(3, raw.length, true); zv.setUint16(5, ~raw.length & 0xFFFF, true);
    z.set(raw, 7); zv.setUint32(7 + raw.length, ((a2 << 16) | a1) >>> 0);
    const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
    hv.setUint32(0, N); hv.setUint32(4, N); ihdr[8] = 8; ihdr[9] = 4; // 8-bit grey with alpha
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr), pngChunk("IDAT", z), pngChunk("IEND", new Uint8Array(0))];
    let bin = "";
    for (const p of parts) for (let i = 0; i < p.length; i += 8192) bin += String.fromCharCode.apply(null, p.subarray(i, i + 8192));
    return `url("data:image/png;base64,${btoa(bin)}")`;
  } catch (e) { return "none"; }
}

// ---------------------------------------------------------------- art
function decodeSvg(uri) {
  const i = uri.indexOf(","), b = atob(uri.slice(i + 1)), u = new Uint8Array(b.length);
  for (let k = 0; k < b.length; k++) u[k] = b.charCodeAt(k);
  return new TextDecoder("utf-8").decode(u);
}
// The art at `path` as a node, or null. SVG goes in inline so it can read the theme tokens.
function artNode(path) {
  const uri = path && assets[path];
  if (!uri) return null;
  if (/^data:image\/svg/.test(uri)) {
    if (!svgCache.has(path)) {
      let root = null;
      try {
        const d = new DOMParser().parseFromString(decodeSvg(uri), "image/svg+xml");
        if (!d.querySelector("parsererror")) {
          root = d.documentElement;
          cleanSvg(root);
          root.removeAttribute("width"); root.removeAttribute("height");
          root.setAttribute("preserveAspectRatio", "xMidYMid slice");
          root.setAttribute("aria-hidden", "true"); root.setAttribute("focusable", "false");
        }
      } catch (e) { root = null; }
      svgCache.set(path, root);
    }
    const r = svgCache.get(path);
    return r ? document.importNode(r, true) : null;
  }
  const im = document.createElement("img");
  im.alt = ""; im.draggable = false; im.src = uri;
  return im;
}
function aspectOf(node, layer) {
  if (layer && layer.aspect > 0) return layer.aspect;
  const vb = node && node.getAttribute && node.getAttribute("viewBox");
  if (vb) { const p = vb.split(/[ ,]+/).map(Number); if (p.length === 4 && p[2] > 0 && p[3] > 0) return p[2] / p[3]; }
  return 4 / 3;
}

// ---------------------------------------------------------------- cast
const personOf = id => (cast && cast.people && cast.people[id]) || null;
const hasCrop = p => !!p && [p.x, p.y, p.r].every(Number.isFinite);
// The crop for a person now. An `alt` entry whose condition holds on a field replaces the base crop (Ann shows as Sable on the badge).
function cropFor(p, st) {
  if (!p) return null;
  for (const a of (Array.isArray(p.alt) ? p.alt : [])) {
    const w = a.when || {};
    if (w.field && String(((st || S).fields || {})[w.field] || "") === String(w.is) && [a.x, a.y, a.r].every(Number.isFinite)) return a;
  }
  return hasCrop(p) ? p : null;
}
function cropStyle(el, c) {
  if (!c || !cast || !cast.w || !cast.h) return;
  const d = 2 * c.r, px = (c.x - c.r) / (cast.w - d), py = (c.y - c.r) / (cast.h - d);
  el.style.backgroundSize = `${(cast.w / d) * 100}% ${(cast.h / d) * 100}%`;
  el.style.backgroundPosition = `${Number.isFinite(px) ? px * 100 : 0}% ${Number.isFinite(py) ? py * 100 : 0}%`;
}

// ---------------------------------------------------------------- building a set
const CAMERA_OFF = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="14" width="26" height="20" rx="3"/><path d="M32 22l10-6v16l-10-6"/><path d="M6 40L42 8"/></svg>`;

function buildSet(id, set, st) {
  const K = { id, set, el: div("k-set"), tracks: [], logs: [], redacts: [], scans: [], plates: [], frame: null, aspect: 4 / 3, focus: [0.5, FOCAL], time: null, file: false, screenOn: false, st: st || S, expo: 0 };
  K.el.dataset.set = id;
  const layers = layersOf(set);
  const fl = layers.find(l => l.prim === "frame") || null;
  K.frame = fl;
  K.wrap = div("k-camwrap"); K.cam = div("k-cam k-idle");
  K.wrap.appendChild(K.cam); K.el.appendChild(K.wrap);
  K.art = div("k-art k-sharp"); K.soft = div("k-soft");
  const a1 = fl ? artNode(fl.art) : null;
  if (a1) { K.art.appendChild(a1); const a2 = artNode(fl.art); if (a2) K.soft.appendChild(a2); }
  K.aspect = aspectOf(a1, fl);
  if (fl && Array.isArray(fl.focus)) K.focus = [Number(fl.focus[0]) || 0.5, Number(fl.focus[1]) || FOCAL];
  if (fl && fl.time) K.time = parseTime(fl.time);
  K.cam.appendChild(K.soft); K.cam.appendChild(K.art);
  if (fl && fl.static) { K.cam.appendChild(div("k-static-art")); K.cam.appendChild(div("k-noise")); }
  K.cam.appendChild(div("k-lines")); K.cam.appendChild(div("k-vig"));
  if (fl && fl.file) { K.file = true; K.cam.classList.add("k-file"); }

  // the chrome: rule, brackets, channel chip, clock, status
  const ch = div("k-chrome");
  ch.innerHTML = `<div class="k-rule"></div><i class="k-br tl"></i><i class="k-br tr"></i><i class="k-br bl"></i><i class="k-br br"></i>`;
  const chip = document.createElement("span"); chip.className = "k-chip l";
  chip.innerHTML = `<i class="dot"></i>${esc([fl && fl.channel, fl && fl.view].filter(Boolean).join(" · ") || "CH 1")}`;
  const clk = document.createElement("span"); clk.className = "k-chip r"; clk.setAttribute("aria-hidden", "true");
  ch.appendChild(chip); ch.appendChild(clk);
  if (fl && fl.status) { const t = document.createElement("span"); t.className = "k-status"; t.textContent = fl.status; ch.appendChild(t); }
  K.chrome = ch; K.rule = ch.firstChild; K.clockEl = clk;
  K.el.appendChild(ch);

  let z = 3;
  for (const l of layers) {
    if (l.prim === "frame") continue;
    const inCam = (l.space || (l.prim === "track" ? "cam" : "stage")) === "cam";
    let e = null;
    if (l.prim === "track") e = buildTrack(K, l);
    else if (l.prim === "log") e = buildLog(K, l);
    else if (l.prim === "redact") e = buildRedact(K, l);
    else if (l.prim === "scan") e = buildScan(K, l);
    else if (l.prim === "plate") e = buildPlate(K, l);
    if (!e) continue;
    e.dataset.prim = l.prim; e.style.zIndex = String(z++);
    (inCam ? K.cam : K.el).appendChild(e);
  }
  // a redaction bar that sits over a track's name goes inside that track's name field
  for (const r of K.redacts) if (r.layer.over === "track") {
    const t = K.tracks.find(x => !r.layer.cast || x.layer.cast === r.layer.cast) || K.tracks[0];
    if (!t) continue;
    r.el.remove(); r.el = null; r.over = t; r.bar = makeBar(); t.name.appendChild(r.bar);
  }
  return K;
}
function makeBar() { const b = document.createElement("i"); b.className = "k-rbar"; b.textContent = "Redacted"; return b; }
const frac = (v, d) => (v == null ? d : v);

function buildTrack(K, l) {
  const e = div("k-track");
  e.style.left = pct(frac(l.x, 0.5)); e.style.top = pct(frac(l.y, 0.3)); e.style.width = pct(frac(l.w, 0.12));
  const box = div("k-tbox"), dim = div("k-tdim"), label = div("k-tlabel");
  box.appendChild(dim);
  const p = personOf(l.cast), off = l.face !== false && !cropFor(p, K.st);
  let face = null;
  if (l.face === false) e.classList.add("is-bare");
  if (l.face !== false && !off) { face = div("k-tface"); dim.appendChild(face); }
  if (off) {
    e.classList.add("is-off");
    dim.appendChild(div("k-tnoise"));
    const ic = div("k-tcam"); ic.innerHTML = CAMERA_OFF; dim.appendChild(ic);
  }
  const name = document.createElement("span"); name.className = "k-tname";
  const tn = document.createElement("span"); tn.className = "k-tn"; name.appendChild(tn);
  const conf = document.createElement("span"); conf.className = "k-tconf";
  label.appendChild(name); label.appendChild(conf);
  e.appendChild(box); e.appendChild(label);
  K.tracks.push({ layer: l, el: e, box, dim, face, name, tn, conf, label, off, scale: 1 });
  return e;
}
function buildLog(K, l) {
  const e = div("k-log"); e.setAttribute("aria-hidden", "true");
  if (l.x != null || l.y != null || l.w != null || l.right != null) {
    if (l.right != null) e.style.right = pct(l.right); else e.style.left = pct(frac(l.x, 0.02));
    e.style.top = l.y != null ? pct(l.y) : "54px";
    e.style.maxWidth = pct(l.w != null ? l.w : 0.62); // w is a limit: the box is as wide as its longest line
  } else { e.style.right = "12px"; e.style.top = "54px"; e.style.maxWidth = "62%"; }
  const L = { K, layer: l, el: e, model: (l.lines || []).map(x => (typeof x === "string" ? { t: x } : Object.assign({}, x))), on: new Set(l.on || []), max: l.max || 8, has: false };
  K.logs.push(L);
  renderLog(L);
  return e;
}
function renderLog(L, lines) {
  L.el.innerHTML = "";
  for (const x of lines || L.model) L.el.appendChild(lineEl(x));
  // A log that gains its first line (or loses its last) may now be in the way of a label, or clear of it.
  const had = L.has, K = L.K; L.has = !!L.el.firstChild;
  if (K.geo && K.tracks.length) {
    // A log that appears or goes, or that changes size while it moves a label or runs into one, may move the labels.
    const r = had === L.has ? logRect(K, L) : null;
    if (had !== L.has || (r && sigOf(r) !== L.sig && (K.byLog || K.tracks.some(T => T.rect && hits(T.rect, r))))) placeLabels(K);
  }
}
function lineEl(x) {
  const e = div("k-ln");
  if (x.cells) { e.classList.add("k-dice"); e.innerHTML = x.cells.map(c => `<span class="k-cell">${esc(c)}</span>`).join(""); return e; }
  const t = document.createElement("span"); t.textContent = x.t; e.appendChild(t);
  if (x.red) { e.classList.add("k-red"); e.appendChild(makeBar()); if (x.open) e.classList.add("is-open"); }
  return e;
}
function buildRedact(K, l) {
  const e = div("k-redact");
  e.style.left = pct(frac(l.x, 0.5)); e.style.top = pct(frac(l.y, 0.5)); e.style.width = pct(frac(l.w, 0.5));
  if (l.h != null) e.style.height = pct(l.h);
  e.setAttribute("role", "img"); e.setAttribute("aria-label", "Redacted");
  const cap = document.createElement("span"); cap.className = "k-rcap"; cap.textContent = l.text || " "; e.appendChild(cap);
  const bar = makeBar(); e.appendChild(bar);
  K.redacts.push({ layer: l, el: e, bar, opens: l.opensOn === "reveal", over: null });
  return e;
}
// What assistive tech hears for a redaction: "Redacted" while the bar is down, the caption once it is lifted.
function redactAria(r, open) {
  if (!r.el) return;
  r.el.setAttribute("aria-label", !open ? "Redacted" : r.layer.text ? r.layer.text : "Redaction lifted");
}
function buildScan(K, l) {
  const e = div("k-scanbox"); e.setAttribute("aria-hidden", "true");
  const sw = div("k-sweep on"), ps = div("k-pass");
  e.appendChild(sw); e.appendChild(ps);
  K.scans.push({ layer: l, el: e, sweep: sw, pass: ps });
  return e;
}
function buildPlate(K, l) {
  const e = div("k-plate");
  e.style.left = pct(frac(l.x, 0.5)); e.style.top = pct(frac(l.y, 0.5)); e.style.width = pct(frac(l.w, 0.3));
  const sharp = div("k-pface"), soft = div("k-psoft");
  const p = personOf(l.cast);
  if (l.cast) {
    const c = cropFor(p, K.st);
    if (c) { cropStyle(sharp, c); cropStyle(soft, c); }
    e.setAttribute("role", "img"); e.setAttribute("aria-label", (p && p.name) || l.cast);
  } else if (l.art) {
    const a = artNode(l.art), b = artNode(l.art);
    if (a) sharp.appendChild(a);
    if (b) soft.appendChild(b);
    sharp.style.backgroundImage = soft.style.backgroundImage = "none";
  }
  e.appendChild(soft); e.appendChild(sharp);
  K.plates.push({ layer: l, el: e, sharp, soft });
  return e;
}

// ---------------------------------------------------------------- layout
const PAD = 30;    // the shell's place line covers the top of the stage; the art starts below it
const EDGE = 10;   // the room kept between what must be seen and the stage edge
const spaceOf = l => l.space || (l.prim === "track" ? "cam" : "stage");
// The x range (fractions of the art) that must stay on screen: every track and plate in the cam, with half their widths,
// and any log or redaction bar placed in the cam. Null when the set has none.
function spanOf(K) {
  let lo = Infinity, hi = -Infinity;
  const add = (a, b) => { lo = Math.min(lo, a); hi = Math.max(hi, b); };
  for (const T of K.tracks) { const x = frac(T.layer.x, 0.5), w = frac(T.layer.w, 0.12); add(x - w / 2, x + w / 2); }
  for (const P of K.plates) if (spaceOf(P.layer) === "cam") { const x = frac(P.layer.x, 0.5), w = frac(P.layer.w, 0.3); add(x - w / 2, x + w / 2); }
  for (const R of K.redacts) if (spaceOf(R.layer) === "cam" && !R.over) { const x = frac(R.layer.x, 0.5), w = frac(R.layer.w, 0.5); add(x - w / 2, x + w / 2); }
  for (const L of K.logs) if (spaceOf(L.layer) === "cam") {
    const w = L.layer.w != null ? L.layer.w : 0.62;
    if (L.layer.right != null) add(1 - L.layer.right - w, 1 - L.layer.right); else add(frac(L.layer.x, 0.02), frac(L.layer.x, 0.02) + w);
  }
  return hi > lo ? [lo, hi] : null;
}
// The first set of a page is built in one task and laid out in the next two, so the cold first layout (styles, the art, the
// text) does not sit in one long task. The set is display:none until then (it costs no layout), has no geometry, and layout()
// leaves it alone. late is 2 before any layout, 1 once the chrome is laid out (the camera still waits), 0 when done.
// Any call that needs the geometry (a new set, a cue) calls settle() first and finishes it at once.
function settle(K, partial) {
  if (!K || !K.late) return;
  if (partial && K.late === 2) {
    K.late = 1; K.el.style.visibility = "hidden"; K.wrap.style.display = "none"; K.el.style.display = "";
    void K.el.offsetWidth;
    return;
  }
  const faded = K.late === 1;
  K.late = 0;
  const size = [host.clientWidth, host.clientHeight];
  K.wrap.style.display = ""; K.el.style.display = ""; K.el.style.visibility = "";
  layout(K, size);
  if (faded) run(K.el, [{ opacity: 0, offset: 0 }], tk.state, tk.easeOut);
}
// The art is drawn in a cam of its own aspect. The scale is cover (like object-fit) unless the span that must be seen is
// wider than the stage; then the cam shrinks until the span fits, and the ground colour shows where the art ends. The cam
// is centred on the span (on the focus point when there is none) and sits so that the focus line is FOCAL down the stage.
// `size` is the stage's [width, height] when the caller read it before the set went in: the read then lays out only what was
// already there, not the new set at a size it is about to leave.
function layout(K, size) {
  if (!K || !host || K.late) return;
  const W = (size ? size[0] : host.clientWidth) || 360, H = (size ? size[1] : host.clientHeight) || 392, Hs = Math.max(1, H - PAD), a = K.aspect;
  const sp = spanOf(K);
  let cw = Math.max(W, Hs * a), cx = K.focus[0];
  if (sp) {
    cx = (sp[0] + sp[1]) / 2;
    const room = Math.max(1, W - 2 * EDGE);
    if ((sp[1] - sp[0]) * cw > room) cw = room / (sp[1] - sp[0]);
  }
  const ch = cw / a;
  const left = cw >= W ? clamp(W * 0.5 - cw * cx, W - cw, 0) : (W - cw) / 2;
  const top = PAD + clamp(Hs * FOCAL - ch * K.focus[1], Math.min(0, Hs - ch), 0);
  Object.assign(K.wrap.style, { left: left + "px", top: top + "px", width: cw + "px", height: ch + "px" });
  K.geo = { W, H, cw, ch, left, top };
  // A square box (a track, or a plate) is never taller than the room above and below its centre. A track or a plate in
  // the cam is w of the cam wide; a plate in the stage is w of the stage's shorter side wide.
  const fit = (el, cy, want) => {
    const side = 2 * Math.min(cy - (PAD + 6), H - 6 - cy);
    el.style.width = (side > 0 && side < want ? side : want) + "px";
  };
  for (const T of K.tracks) fit(T.el, top + frac(T.layer.y, 0.3) * ch, frac(T.layer.w, 0.12) * cw);
  for (const P of K.plates) {
    const l = P.layer;
    if (spaceOf(l) === "cam") fit(P.el, top + frac(l.y, 0.5) * ch, frac(l.w, 0.3) * cw);
    else fit(P.el, frac(l.y, 0.5) * H, frac(l.w, 0.3) * Math.min(W, H));
  }
  placeLabels(K);
}
// Labels sit above their boxes, inside the stage, each within the band between its neighbours so they never overlap.
// A label that would run up into the channel chips goes beside its box instead (below it when there is no room beside).
// Beside means on the side with more room, level with the box centre, in the room between the box and the nearest other
// box on that side: higher than below the box, so a text panel that rises over the stage reaches it later. Labels beside
// a box take no part in the bands. A label below has only the labels below as neighbours (one above and one below cannot
// touch), so a long label that has gone below gets the room it needs and stays short.
// A log that has lines is in the way of a label above it: the label keeps to the free side of the log, and when the box
// sits under the log it goes beside the box. A label with labelAt "side" is always beside, one with "below" always below.
// The labels are placed again when a log gains its first line or loses its last.
const SIDE_MIN = 120;
// A log's rectangle in the set's own space, 4 px wider on each side so that a label keeps its distance. Only a log in the set's
// own layer (not in the cam) that has lines.
const logRect = (K, L) => (L.has && L.el.parentNode === K.el && L.el.offsetWidth ? { x0: L.el.offsetLeft - 4, x1: L.el.offsetLeft + L.el.offsetWidth + 4, y0: L.el.offsetTop, y1: L.el.offsetTop + L.el.offsetHeight } : null);
const sigOf = r => (r ? [r.x0, r.y0, r.x1, r.y1].join() : "");
const logRects = K => K.logs.map(L => { const r = logRect(K, L); L.sig = sigOf(r); return r; }).filter(Boolean);
const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function placeLabels(K) {
  const g = K.geo; if (!g || !K.tracks.length) return;
  for (const T of K.tracks) T.moved = false;
  const cxOf = T => g.left + frac(T.layer.x, 0.5) * g.cw;
  const bwOf = T => T.el.offsetWidth || frac(T.layer.w, 0.12) * g.cw;
  // The room beside a box: from the box's edge to the nearest other box on that side, or to the stage edge.
  const sideOf = T => {
    const cx = cxOf(T), bw = bwOf(T), left = cx > g.W / 2;
    let edge = left ? 12 : g.W - 12;
    for (const O of K.tracks) {
      if (O === T) continue;
      const ox = cxOf(O), ow = bwOf(O);
      if (left && ox < cx) edge = Math.max(edge, ox + ow / 2 + 6);
      if (!left && ox > cx) edge = Math.min(edge, ox - ow / 2 - 6);
    }
    const room = left ? cx - bw / 2 - 6 - edge : edge - (cx + bw / 2 + 6);
    return { left, room: Math.min(230, g.W - 24, room) };
  };
  // The logs that have lines, as rectangles in the set's own space (one read, and only when there is such a log).
  const logs = logRects(K);
  K.byLog = false; // set when a log moved a label: the labels are placed again when that log changes
  for (const T of K.tracks) { T.clipL = 0; T.clipR = Infinity; T.beside = T.layer.labelAt === "side" && sideOf(T).room >= SIDE_MIN; }
  // Each label hugs its text up to the room it has between its neighbours (and clear of a log). Labels do not affect one
  // another's width, so the writes, the reads and the final writes each run as one batch: one layout pass per batch.
  const widen = group => {
    const plan = group.map((T, i) => {
      const cx = cxOf(T);
      const bandL = Math.max(T.clipL, i > 0 ? (cxOf(group[i - 1]) + cx) / 2 + 2 : 12), bandR = Math.min(T.clipR, i < group.length - 1 ? (cx + cxOf(group[i + 1])) / 2 - 2 : g.W - 12);
      const cap = Math.max(96, Math.min(230, bandR - bandL, g.W - 24));
      T.label.style.width = "max-content"; T.label.style.maxWidth = cap + "px";
      return { T, cx, bandL, bandR, cap };
    });
    for (const p of plan) {
      p.lw = Math.min(p.cap, Math.ceil(p.T.label.getBoundingClientRect().width));
      p.bw = bwOf(p.T);
    }
    for (const p of plan) {
      const want = clamp(p.cx - p.lw / 2, p.bandL, Math.max(p.bandL, p.bandR - p.lw));
      p.T.lx = want; p.T.lw = p.lw;
      p.T.label.style.width = p.lw + "px";
      p.T.label.style.left = (want - (p.cx - p.bw / 2)) + "px";
    }
  };
  // The room above a box, from the chips to the box, is the most a label above it can take (it keeps 2 px off the box at least).
  // On a stage much shorter than it is tall the text panel covers most of it, so a label that has room lifts up to LIFT px off
  // its box: the higher the label, the later the panel reaches it.
  const LIFT = g.H < 1.3 * g.W ? 10 : 0;
  const tops = new Map(K.tracks.map(T => [T, g.top + frac(T.layer.y, 0.3) * g.ch - bwOf(T) / 2 - 54]));
  const rooms = new Map(K.tracks.map(T => [T, tops.get(T) - 2]));
  let order = K.tracks.filter(T => !T.beside).sort((a, b) => cxOf(a) - cxOf(b));
  // pass 1: every label shares the bands; the label's height at that width says which side it takes
  widen(order);
  for (const T of order) {
    T.below = T.layer.labelAt === "below" || T.layer.labelAt === "side";
    if (!T.below && T.label.offsetHeight > rooms.get(T)) { if (sideOf(T).room >= SIDE_MIN) T.beside = true; else T.below = true; }
  }
  order = order.filter(T => !T.beside);
  // a log in the way: keep to the free side of it, or go beside the box when the box is under it
  if (logs.length) {
    for (const T of order) {
      if (T.below) continue;
      const cx = cxOf(T), top = tops.get(T) + 54, r = { x0: T.lx, x1: T.lx + T.lw, y0: top - 6 - LIFT - T.label.offsetHeight, y1: top };
      const hit = logs.find(o => hits(r, o));
      if (!hit) continue;
      K.byLog = true;
      // the label keeps to one side of the log, if that side has room and still reaches over the box (10 px at least)
      const bw = bwOf(T), leftOk = hit.x0 - 12 >= SIDE_MIN && hit.x0 >= cx - bw / 2 + 10, rightOk = g.W - 12 - hit.x1 >= SIDE_MIN && hit.x1 <= cx + bw / 2 - 10;
      if (leftOk && (!rightOk || cx <= (hit.x0 + hit.x1) / 2)) T.clipR = hit.x0;
      else if (rightOk) T.clipL = hit.x1;
      else if (sideOf(T).room >= SIDE_MIN) T.beside = true;
      else T.below = true;
    }
    order = order.filter(T => !T.beside);
  }
  // pass 2: the bands are shared by the labels on one side only
  const settle = () => {
    for (const side of [false, true]) {
      const grp = order.filter(T => !T.beside && T.below === side);
      widen(grp);
      for (const T of grp) {
        if (side) { T.label.style.top = "100%"; T.label.style.bottom = "auto"; T.label.style.marginTop = "6px"; T.label.style.marginBottom = ""; }
        else { T.label.style.bottom = "100%"; T.label.style.top = "auto"; T.label.style.marginTop = ""; }
      }
      if (!side) { // one read for the heights, then the writes
        const lift = grp.map(T => clamp(tops.get(T) - T.label.offsetHeight, 2, 6 + LIFT));
        grp.forEach((T, i) => { T.label.style.marginBottom = lift[i] + "px"; });
      }
      for (const T of grp) { // where the label is, for the labels that sit beside a box
        const h = T.label.offsetHeight, boxTop = tops.get(T) + 54, boxBottom = boxTop + bwOf(T);
        const y0 = side ? boxBottom + 6 : boxTop - clamp(tops.get(T) - h, 2, 6 + LIFT) - h;
        T.rect = { x0: T.lx, x1: T.lx + T.lw, y0, y1: y0 + h };
      }
    }
  };
  settle();
  // a label that kept clear of a log is narrower and so taller: it may no longer fit above
  const tall = order.filter(T => !T.below && T.label.offsetHeight > rooms.get(T));
  if (tall.length) { for (const T of tall) { if (sideOf(T).room >= SIDE_MIN) T.beside = true; else T.below = true; } order = order.filter(T => !T.beside); settle(); }
  // side labels: write the widths, read the sizes, write the places. Two labels that face each other across the gap
  // between their boxes share it.
  const plan = K.tracks.filter(T => T.beside).map(T => {
    const s = sideOf(T);
    const O = K.tracks.filter(o => o !== T && o.beside && sideOf(o).left !== s.left && (s.left ? cxOf(o) < cxOf(T) : cxOf(o) > cxOf(T)))
      .sort((a, b) => Math.abs(cxOf(a) - cxOf(T)) - Math.abs(cxOf(b) - cxOf(T)))[0];
    if (O) { // the gap from this box's edge to the other box's edge, less the margins, is split between the two labels
      const gap = Math.abs(cxOf(O) - cxOf(T)) - (bwOf(O) + bwOf(T)) / 2 - 12 - 6;
      s.room = Math.max(40, Math.min(s.room, gap / 2)); // never wider than half the gap (40 px at least); the overlap check below moves a label that still meets another
    }
    T.label.style.width = "max-content"; T.label.style.maxWidth = s.room + "px";
    return { T, s };
  });
  for (const p of plan) { p.lw = Math.min(p.s.room, Math.ceil(p.T.label.getBoundingClientRect().width)); p.lh = p.T.label.offsetHeight; p.bw = bwOf(p.T); }
  const others = order.map(T => T.rect).concat(logs);
  for (const p of plan) {
    const st = p.T.label.style, cx = cxOf(p.T), cy = g.top + frac(p.T.layer.y, 0.3) * g.ch;
    const x0 = p.s.left ? cx - p.bw / 2 - 6 - p.lw : cx + p.bw / 2 + 6;
    let y0 = cy - p.lh / 2; // level with the box centre, or just under a label or a log that is in the way
    for (const r of others.slice().sort((a, b) => a.y0 - b.y0)) {
      if (x0 < r.x1 && x0 + p.lw > r.x0 && y0 < r.y1 - 2 && y0 + p.lh > r.y0 + 2) { y0 = r.y1 + 2; if (logs.includes(r)) K.byLog = true; } // (an overlap of 2 px is a touch)
    }
    st.width = p.lw + "px"; st.left = (p.s.left ? -6 - p.lw : p.bw + 6) + "px";
    st.top = "50%"; st.bottom = "auto"; st.marginTop = (y0 - cy) + "px"; st.marginBottom = "";
    p.T.rect = { x0, x1: x0 + p.lw, y0, y1: y0 + p.lh };
    others.push(p.T.rect); // a later side label keeps clear of this one
  }
}

// ---------------------------------------------------------------- state-bound looks (the end states)
// Confidence, in order: a number on the layer (conf); the layer's confs table, keyed by the bound field's value (the script
// prints those numbers, so they win); then 26 + 12 x exposure, capped at 99 (exposure 1, the start, reads 38).
const confOf = (K, T) => {
  const l = T.layer;
  if (typeof l.conf === "number") return l.conf;
  if (l.bind && l.confs && typeof l.confs === "object") {
    const v = String((K.st.fields || {})[l.bind] || "");
    if (Object.prototype.hasOwnProperty.call(l.confs, v) && Number.isFinite(Number(l.confs[v]))) return clamp(Number(l.confs[v]), 0, 99);
  }
  if (meterDefs.exposure) return clamp(26 + 12 * (K.expo || 0), 0, 99);
  return 90;
};
const tightOf = conf => 1 + 0.12 * (1 - conf / 100); // a low-confidence box is loose; at 99 it is tight
function labelOf(K, T) {
  const l = T.layer;
  if (l.bind) {
    const v = String((K.st.fields || {})[l.bind] || ""), m = l.labels || {};
    if (Object.prototype.hasOwnProperty.call(m, v)) return m[v];
    if (v) return v.replace(/\s*\(.*\)\s*$/, "");
    return Object.prototype.hasOwnProperty.call(m, "") ? m[""] : "SUBJECT";
  }
  if (l.label) return l.label;
  const p = personOf(l.cast);
  return String((p && p.name) || "SUBJECT");
}
function applyTrack(K, T, later) {
  const l = T.layer, conf = confOf(K, T), p = personOf(l.cast);
  let name = labelOf(K, T);
  if (T.off && !/VIDEO FEED DISABLED/i.test(name)) name += " · VIDEO FEED DISABLED";
  const showConf = l.conf !== false;
  const confText = showConf ? `CONF ${Math.round(conf)}%${locked ? " · LOCKED" : ""}` : (locked ? "LOCKED" : "");
  const confHidden = !showConf && !locked;
  const sig = name + "\n" + confText + "\n" + confHidden;
  if (T.sig !== sig) { T.sig = sig; T.moved = true; } // the label's words changed: its size, so its place, may have
  T.tn.textContent = name;
  T.conf.textContent = confText;
  T.conf.hidden = confHidden;
  T.scale = tightOf(conf);
  T.box.style.setProperty("--k-s", String(T.scale));
  T.dim.style.opacity = focusOn ? "" : "0.55"; // the fill and the face dim; the border keeps full strength
  if (T.face) { cropStyle(T.face, cropFor(p, K.st)); T.face.style.setProperty("--k-fo", String(0.5 + 0.5 * conf / 100)); }
  T.el.classList.toggle("is-locked", locked);
  T.el.setAttribute("role", "img");
  T.el.setAttribute("aria-label", `${name}${showConf ? ", confidence " + Math.round(conf) + " percent" : ""}`);
  if (K.geo && !later && T.moved) placeLabels(K);
}
// Every track at once: the labels are placed once, not once per track.
function applyTracks(K) {
  for (const T of K.tracks) applyTrack(K, T, true);
  if (K.geo && K.tracks.some(T => T.moved)) placeLabels(K);
}
function applyFocus(K) {
  K.cam.classList.toggle("k-in-focus", focusOn);
  for (const P of K.plates) P.el.classList.toggle("in-focus", focusOn);
}
function applyReveal(K, open) {
  for (const r of K.redacts) { const o = !!(r.opens && open); (r.over ? r.over.name : r.el).classList.toggle("is-open", o); redactAria(r, o); }
  for (const L of K.logs) { for (const x of L.model) if (x.red) x.open = open; for (const e of L.el.querySelectorAll(".k-red")) e.classList.toggle("is-open", open); }
}
const band = e => (e <= 1 ? 1 : e <= 3 ? 2 : 3);
function applyBands(K) {
  const b = band(K.expo || 0);
  if (K.file) K.cam.dataset.b = String(b);
  for (const P of K.plates) if (P.layer.desat === "exposure") P.el.style.filter = `grayscale(${b === 1 ? 1 : b === 2 ? 0.5 : 0})`;
}
// Put every state-bound visual at its end state for state `st`.
function applyAll(K, st) {
  K.st = st || K.st || S;
  K.expo = K.st.meters && K.st.meters.exposure != null ? K.st.meters.exposure : 0;
  applyFocus(K);
  applyTracks(K);
  applyReveal(K, !!K.st.revealed);
  applyBands(K);
  K.el.classList.toggle("k-locked", locked);
  K.chrome.classList.toggle("k-locked", locked);
  K.el.classList.toggle("k-stop", closed);
  setClock(K);
}

// ---------------------------------------------------------------- the clock
function setClock(K) {
  if (!K || !K.clockEl) return;
  const t = stamp(clock.base + Math.floor(clock.acc / 1000));
  if (K.clockEl.textContent !== t) K.clockEl.textContent = t;
}
// A new scene: the clock starts at the set's time, with the hour and minute of the scene's place line when it has one.
function resetClock(K, scene) {
  let base = K && K.time != null ? K.time : clock.base;
  const m = scene && scene.place ? /(\d\d):(\d\d)\s*$/.exec(scene.place) : null;
  if (m) base = (+m[1]) * 3600 + (+m[2]) * 60 + (K && K.time != null ? K.time % 60 : 0);
  clock.base = base; clock.acc = 0;
}
// The clock counts whole seconds on a one-second timer, not on the frame loop. It runs only while the feed is open, the page
// is visible and motion is on; any other time the timer is cleared (and syncTimer() restarts it when that changes).
function unhook() {
  stopTimer();
  document.removeEventListener("visibilitychange", syncTimer);
  if (mq) { try { mq.removeEventListener("change", syncTimer); } catch (e) {} mq = null; }
  if (mo) { try { mo.disconnect(); } catch (e) {} mo = null; }
}
const clockWanted = () => !!cur && !closed && !document.hidden && !redNow();
function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }
function syncTimer() {
  if (!clockWanted()) { stopTimer(); return; }
  if (timer) return;
  timer = setInterval(() => {
    if (!clockWanted()) { stopTimer(); return; }
    clock.acc += 1000;
    setClock(cur);
  }, 1000);
}
function restartSweeps(K) {
  for (const s of K.scans) { s.sweep.style.animation = "none"; void s.sweep.offsetWidth; s.sweep.style.animation = ""; }
}

// ---------------------------------------------------------------- the log
const logFor = (K, cue) => (K && K.logs.find(L => L.on.has(cue))) || null;
// Add one entry (a line, or a list of rows) and return the new elements, or null when a screen is showing over the log.
function addEntry(L, K, entry) {
  const items = Array.isArray(entry) ? entry : [entry];
  for (const x of items) L.model.push(x);
  while (L.model.length > L.max) L.model.shift();
  if (K.screenOn) return null;
  renderLog(L);
  return [...L.el.children].slice(-items.length);
}
function printLine(K, cue, text) {
  const L = logFor(K, cue);
  const els = L ? addEntry(L, K, { t: text }) : null;
  return els ? run(els[0], [{ opacity: 0, offset: 0 }], tk.state, tk.easeOut) : Promise.resolve();
}

// After back, load or Continue no turn cue brings the scene, so the clock takes the hour and minute of the place line the shell
// shows. The shell writes that line just after show() (and update()), so watch it until it changes once.
let placeMo = null;
function unfollowPlace() { if (placeMo) { try { placeMo.disconnect(); } catch (e) {} placeMo = null; } }
function followPlace() {
  unfollowPlace();
  const pl = document.getElementById("place");
  if (!pl) return;
  const take = () => { if (cur && /\d\d:\d\d\s*$/.test(pl.textContent || "")) { resetClock(cur, { place: pl.textContent }); setClock(cur); return true; } return false; };
  take();
  try { placeMo = new MutationObserver(() => { if (take()) unfollowPlace(); }); placeMo.observe(pl, { childList: true, characterData: true, subtree: true }); } catch (e) { placeMo = null; }
}

// ---------------------------------------------------------------- swapping sets
function commit() {
  if (!pend) return;
  const p = pend; pend = null;
  if (p.old && p.old.el.parentNode) p.old.el.remove();
  p.next.el.style.opacity = "";
  cur = p.next;
}

const kit = {
  mount(root, o) {
    host = root; assets = (o && o.assets) || {}; pack = (o && o.pack) || {}; cast = pack.cast || null;
    meterDefs = {}; for (const m of pack.meters || []) meterDefs[m.id] = m;
    const cs = getComputedStyle(docEl), tok = n => cs.getPropertyValue(n).trim();
    tk = { cross: ms(cs, "--m-cross", 650), ink: ms(cs, "--m-ink", 800), bloom: ms(cs, "--m-bloom", 700), roll: ms(cs, "--m-roll", 900),
      tear: ms(cs, "--m-tear", 500), close: ms(cs, "--m-close", 1200), state: ms(cs, "--m-state", 250), seal: ms(cs, "--m-seal", 300),
      stagger: ms(cs, "--m-stagger", 80), d3: ms(cs, "--m-d3", 16), max: ms(cs, "--m-layers-max", 3),
      idle: ms(cs, "--m-idle", 26000), scan: ms(cs, "--m-scan", 8000),
      easeOut: tok("--m-ease-out") || "ease-out", easeIn: tok("--m-ease-in") || "ease-in", easeLinear: tok("--m-ease-linear") || "linear" };
    // log lines that print in turn start far enough apart that no more than --m-layers-max are fading at once
    tk.step = Math.max(tk.stagger, Math.ceil(tk.state / Math.max(1, tk.max)) + 1);
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.setAttribute("data-kit", "feed"); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
    host.style.background = "var(--st-bg)";
    noiseOn = false; shownOnce = false;
    // the drift and the sweep move in steps, two a second
    host.style.setProperty("--k-idle-steps", String(Math.max(2, Math.round(tk.idle / 500))));
    host.style.setProperty("--k-sweep-steps", String(Math.max(2, Math.round(tk.scan / 500))));
    if (cast && cast.sheet && assets[cast.sheet]) host.style.setProperty("--k-sheet", `url("${assets[cast.sheet]}")`);
    endEl = div("k-end"); endEl.innerHTML = `<i class="k-endline"></i><span class="k-endcap">FEED CLOSED</span>`; endEl.setAttribute("aria-hidden", "true");
    host.appendChild(endEl);
    // A resize that left the stage the size it was laid out at needs nothing (the observer's first call is one of those).
    const relayout = () => {
      const W = host.clientWidth || 360, H = host.clientHeight || 392;
      const go = K => { if (K && !(K.geo && K.geo.W === W && K.geo.H === H)) layout(K); };
      go(cur); if (pend) { go(pend.next); go(pend.old); }
    };
    if (window.ResizeObserver) { ro = new ResizeObserver(relayout); ro.observe(host); } else window.addEventListener("resize", relayout);
    // the clock timer follows the page: hidden, reduced motion and Calm stop it
    unhook();
    document.addEventListener("visibilitychange", syncTimer);
    try { mq = window.matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", syncTimer); } catch (e) { mq = null; }
    try { mo = new MutationObserver(syncTimer); mo.observe(docEl, { attributes: true, attributeFilter: ["data-motion"] }); } catch (e) { mo = null; }
    syncTimer();
  },

  show(id, set, o) {
    commit(); unfollowPlace();
    settle(cur);
    const st = (o && o.state) || S;
    const next = buildSet(id, set, st), old = cur;
    const size = [host.clientWidth, host.clientHeight];
    // The grain is drawn the first time a set needs it (a canvas and a PNG encode: too slow to sit in the page's boot task).
    if (!noiseOn) { noiseOn = true; host.style.setProperty("--k-noise", makeNoise()); }
    host.insertBefore(next.el, endEl);
    if (o && o.instant) {
      // back, load, Continue, a new game: nothing animates, so the set takes the state it is shown with
      if (st.look) focusOn = st.look === "paint";
      locked = false; closed = false; closedFresh = false; endEl.classList.remove("k-closed");
      if (old) old.el.remove();
      cur = next; pend = null;
      next.el.style.transform = "";
      applyAll(next, st);
      if (!old && !shownOnce && typeof requestAnimationFrame === "function") {
        next.late = 2; next.el.style.display = "none";
        requestAnimationFrame(() => { settle(next, true); setTimeout(() => settle(next), 0); });
      } else layout(next, size);
      shownOnce = true;
      resetClock(next, null); setClock(next);
      followPlace();
    } else {
      applyAll(next, st); layout(next, size);
      next.el.style.opacity = "0";
      cur = next; pend = old ? { next, old } : null;
      if (!old) next.el.style.opacity = "";
    }
    syncTimer();
  },

  update(state) {
    skipNow = false;
    commit();
    if (state) S = Object.assign({}, state);
    if (!cur) return;
    if (closedFresh) closedFresh = false; else closed = false; // the update that follows a close keeps it; any later one (Back, load) opens it
    if (S.look) focusOn = S.look === "paint";
    applyAll(cur, S);
    cur.el.style.transform = closed ? "scaleY(.002)" : "";
    endEl.classList.toggle("k-closed", closed);
    syncTimer();
  },

  cue(c, o) {
    const red = (o && o.reduced) || redNow();
    skipNow = !!(o && o.reduced);
    settle(cur); if (pend) { settle(pend.next); settle(pend.old); }
    const seq = ++cueSeq;
    let p;
    switch (c.type) {
      case "turn": p = cueTurn(o, red, seq); break;
      case "shift": p = cueShift(red); break;
      case "ink": p = cueInk(o, red); break;
      case "bloom": p = cueBloom(red); break;
      case "seal": p = cueSeal(red); break;
      case "roll": p = cueRoll(c, red); break;
      case "cost": case "gain": p = cueMeter(c, red); break;
      case "tear": p = cueTear(red); break;
      case "close": p = cueClose(red); break;
      default: p = Promise.resolve(); // tally: this kit has none
    }
    syncTimer();
    return p;
  },

  // A tap during a cue: every animation jumps to its end, a pending swap completes, and the cue's Promise resolves now.
  finish() {
    stoppedSeq = cueSeq;
    const a = act; act = null;
    for (const x of [...active]) { try { x.finish(); } catch (e) {} }
    active.clear();
    commit();
    if (a) { try { a.end && a.end(); } catch (e) {} a.res(); }
  },

  // The beat's screen lines, drawn in the set's log. The log's own lines come back when the next beat has none.
  // A log with "keep" leaves the last screen up (the ledger holds the ending's lines).
  screen(lines) {
    const K = cur;
    if (!K) return;
    const has = Array.isArray(lines) && lines.length > 0;
    let L = K.logs[0];
    if (has && !L) { // a set with no log gets a plain one for the screen
      const e = buildLog(K, { prim: "log", lines: [], x: 0.02, y: 0.16, w: 0.6 });
      e.style.zIndex = "9"; K.el.appendChild(e); L = K.logs[K.logs.length - 1]; L.auto = true;
    }
    if (!L) return;
    if (has) {
      const key = lines.join("\n");
      if (K.screenOn && K.screenKey === key) return;
      K.screenOn = true; K.screenKey = key;
      renderLog(L, lines.map(t => ({ t })));
      if (L.layer.keep) L.model = lines.map(t => ({ t }));
      run(L.el, [{ opacity: 0, offset: 0 }], tk.state, tk.easeOut);
    } else if (K.screenOn) {
      K.screenOn = false; K.screenKey = "";
      if (L.auto) { L.el.remove(); K.logs.splice(K.logs.indexOf(L), 1); }
      else renderLog(L);
    }
  },

  // Ambient: nothing here moves per frame. The drift and the sweep are CSS animations (paused while a cue plays and while the
  // page is hidden, absent under reduced motion and when the feed is closed); the clock counts on its own one-second timer.
  // So tick() only makes sure the timer is right (the shell calls it once on a cue, also when hidden or reduced) and returns
  // false, which lets the shell stop its frame loop.
  tick() {
    syncTimer();
    return false;
  },

  card(scene) {
    const sc = scene || {};
    const set = sc.set && pack && pack.sets && pack.sets[sc.set];
    const f = layersOf(set).find(l => l.prim === "frame");
    const chan = f ? [f.channel, f.view].filter(Boolean).join(" · ") : "";
    return `<div class="scene-card"><p class="card-place">${sc.ending ? "Feed closed" : esc(sc.place || "")}</p><h2 class="card-title">${esc(sc.title || "")}</h2><div class="card-rule"></div>${chan && !sc.ending ? `<p class="k-card-chan">${esc(chan)}</p>` : ""}</div>`;
  },

  destroy() {
    if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
    unhook(); unfollowPlace();
    if (host) host.innerHTML = "";
    if (styleEl && styleEl.parentNode) styleEl.remove();
    styleEl = null; endEl = null; active.clear(); cur = pend = act = null;
  },
};

// ---------------------------------------------------------------- the cues
// turn: a hard cut. The new set is in place in one frame, soft, with a new channel and time. The boxes lock in (1.12 to 1),
// then the log prints a line at a time. The look cue that follows sets focus (bloom) or leaves it soft (ink).
function cueTurn(o, red, seq) {
  const K = cur;
  if (!K) return Promise.resolve();
  unfollowPlace();
  const p = pend; pend = null;
  if (p && p.old && p.old.el.parentNode) p.old.el.remove();
  K.el.style.opacity = ""; K.el.style.transform = "";
  closed = false; closedFresh = false; locked = false; endEl.classList.remove("k-closed");
  focusOn = false;
  resetClock(K, o && o.scene);
  applyAll(K); restartSweeps(K);
  if (red) return Promise.resolve();
  return track(playTurn(K, seq));
}
async function playTurn(K, seq) {
  await Promise.all(K.tracks.map(T => run(T.box, [{ transform: `scale(${T.scale * 1.12})`, offset: 0 }], tk.state, tk.easeOut)));
  if (dead(seq)) return;
  const L = K.logs[0];
  if (L && !K.screenOn) await Promise.all([...L.el.children].map((ln, i) => run(ln, [{ opacity: 0, offset: 0 }], tk.state, tk.easeOut, { delay: i * tk.step })));
}

// shift: the old layers fade out and the new fade in together. The clock holds; only the channel changes.
function cueShift(red) {
  if (!pend) return Promise.resolve();
  const p = pend; p.next.el.style.opacity = "";
  if (locked || focusOn) applyAll(p.next, p.next.st);
  if (red || !p.old) { commit(); return Promise.resolve(); }
  const a = run(p.next.el, [{ opacity: 0, offset: 0 }], tk.cross, tk.easeOut);
  run(p.old.el, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 1 }], tk.cross, tk.easeOut);
  p.old.el.style.opacity = "0";
  return track(a, commit);
}

// ink: unwitnessed. The frame goes out of focus and the boxes dim. A reveal also lifts the redaction.
function cueInk(o, red) {
  const K = cur; if (!K) return Promise.resolve();
  const reveal = !!(o && o.beat && o.beat.reveal);
  focusOn = false;
  K.cam.classList.remove("k-in-focus");
  for (const P of K.plates) P.el.classList.remove("in-focus");
  for (const T of K.tracks) T.dim.style.opacity = "0.55";
  const ps = [];
  if (!red) {
    ps.push(run(K.art, [{ opacity: 1, offset: 0 }], tk.ink, tk.easeOut));
    for (const T of K.tracks) ps.push(run(T.dim, [{ opacity: 1, offset: 0 }], tk.ink, tk.easeOut));
    for (const P of K.plates) ps.push(run(P.sharp, [{ opacity: 1, offset: 0 }], tk.ink, tk.easeOut));
  }
  if (reveal) {
    K.st = Object.assign({}, K.st, { revealed: true });
    for (const r of K.redacts) if (r.opens) {
      (r.over ? r.over.name : r.el).classList.add("is-open");
      redactAria(r, true);
      if (!red) ps.push(run(r.bar, [{ opacity: 1, transform: "none", offset: 0 }], tk.ink, tk.easeOut));
    }
    const L = logFor(K, "ink");
    if (L) addEntry(L, K, { t: "REDACTION LIFTED" });
  }
  return track(Promise.all(ps));
}

// bloom: witnessed. A sharp layer fades in over the pre-blurred copy; the box fills and faces come up by opacity. No scale.
function cueBloom(red) {
  const K = cur; if (!K) return Promise.resolve();
  focusOn = true;
  K.cam.classList.add("k-in-focus");
  for (const P of K.plates) P.el.classList.add("in-focus");
  for (const T of K.tracks) T.dim.style.opacity = "";
  if (red) return Promise.resolve();
  const ps = [run(K.art, [{ opacity: 0, offset: 0 }], tk.bloom, tk.easeOut)];
  for (const T of K.tracks) ps.push(run(T.dim, [{ opacity: 0.55, offset: 0 }], tk.bloom, tk.easeOut));
  for (const P of K.plates) ps.push(run(P.sharp, [{ opacity: 0, offset: 0 }], tk.bloom, tk.easeOut));
  return track(Promise.all(ps));
}

// seal: the choice is final. Boxes go from dashed to solid and the rule goes firm at once; the label reads LOCKED and fades in.
// Nothing scales.
function cueSeal(red) {
  const K = visible(); if (!K) return Promise.resolve();
  locked = true;
  K.el.classList.add("k-locked"); K.chrome.classList.add("k-locked");
  applyTracks(K);
  const ps = [];
  if (!red) {
    for (const T of K.tracks) if (!T.conf.hidden) ps.push(run(T.conf, [{ opacity: 0, offset: 0 }], tk.seal, tk.easeOut));
  }
  ps.push(printLine(K, "seal", "INPUT LOCKED"));
  return track(Promise.all(ps));
}

// roll: one scan pass. The dice cells fill left to right. The log prints the roll. The boxes do not move.
function cueRoll(c, red) {
  const K = visible(); if (!K) return Promise.resolve();
  const faces = Array.isArray(c.faces) ? c.faces : [];
  const lab = ((K.logs.find(L => L.layer.modLabel) || { layer: {} }).layer.modLabel) || "MOD";
  const L = logFor(K, "roll");
  const els = L ? addEntry(L, K, [{ cells: faces.map(f => faceChar(c.dice || "", f)) },
    { t: `${lab} ${signed(c.add || 0)} = ${c.total} VS ${c.vs}` }, { t: `TIER: ${String(c.used || c.result || "").toUpperCase()}` }]) : null;
  const ps = [];
  if (!red && !skipNow) {
    const sc = K.scans[0];
    if (sc) ps.push(run(sc.pass, [{ opacity: 0.35, transform: "translateY(0)", offset: 0 }, { opacity: 0.35, transform: "translateY(100%)", offset: 1 }], tk.roll, tk.easeLinear));
    if (els && els.length) {
      // one cover over the three rows slides off to the right in n steps, so each cell changes once, left to right
      const first = els[0], last = els[els.length - 1], cov = document.createElement("i");
      cov.className = "k-cover";
      cov.style.cssText = `left:0;right:0;top:${first.offsetTop}px;height:${last.offsetTop + last.offsetHeight - first.offsetTop}px;transform:translateX(100%)`;
      L.el.appendChild(cov);
      const a = run(cov, [{ transform: "translateX(0)", offset: 0 }], tk.roll, `steps(${Math.max(1, faces.length)}, end)`);
      ps.push(a.then(() => cov.remove(), () => cov.remove()));
    }
  }
  return track(Promise.all(ps), () => { for (const e of host.querySelectorAll(".k-cover")) e.remove(); });
}

// cost and gain: one new line in the log. A change to the exposure meter changes the confidence numbers and the rest scale of
// every bound box, with no motion.
function cueMeter(c, red) {
  const K = visible(); if (!K) return Promise.resolve();
  const def = meterDefs[c.meter] || {};
  const d = ((c.type === "gain") !== !!def.bad ? 1 : -1) * (c.n || 0); // the way the meter's value moved
  const ps = [];
  if (c.meter === "exposure") {
    K.expo = (K.expo || 0) + d;
    applyTracks(K);
    applyBands(K);
  }
  ps.push(printLine(K, c.type, `${meterLabel(c.meter)} ${signed(d)}`));
  return track(Promise.all(ps));
}

// tear: one band of the frame slips sideways and returns; the boxes drop out under it for that moment.
function cueTear(red) {
  const K = visible(); if (!K) return Promise.resolve();
  const ps = [printLine(K, "tear", "PLAYER AUTHORITY: 1 FP SPENT")];
  const art = K.geo && !red && !skipNow ? artNode(K.frame && K.frame.art) : null;
  if (!art) return track(Promise.all(ps));
  const g = K.geo, top = Math.round(g.H * 0.2), h = Math.round(g.H * 0.14);
  const bandEl = div("k-band", `top:${top}px;height:${h}px`);
  const inner = div("", `position:absolute;left:${g.left}px;top:${g.top - top}px;width:${g.cw}px;height:${g.ch}px`);
  const holder = div(focusOn ? "k-art" : "k-soft"); holder.appendChild(art); inner.appendChild(holder);
  bandEl.appendChild(inner); K.el.appendChild(bandEl);
  ps.push(run(inner, [{ transform: "translateX(0)", offset: 0 }, { transform: `translateX(${tk.d3}px)`, offset: 0.35 }, { transform: "translateX(0)", offset: 1 }], tk.tear, tk.easeOut)
    .then(() => bandEl.remove(), () => bandEl.remove()));
  return track(Promise.all(ps), () => bandEl.remove());
}

// close: the frame collapses to a line, and the line is labelled. The line and its caption fade in while the frame collapses,
// all in one Promise.all, so the cue ends with the collapse (--m-close) and a tap on it reaches every animation.
function cueClose(red) {
  const K = cur; if (!K) return Promise.resolve();
  closed = true; closedFresh = true;
  K.el.classList.add("k-stop");
  K.el.style.transform = "scaleY(.002)"; // the end states are the elements' own styles
  endEl.classList.add("k-closed");
  if (red) return Promise.resolve();
  const line = endEl.querySelector(".k-endline"), cap = endEl.querySelector(".k-endcap");
  return track(Promise.all([
    run(K.el, [{ transform: "none", offset: 0 }], tk.close, tk.easeIn),
    run(line, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.55 }], tk.close, tk.easeOut),
    run(cap, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.4 }], tk.close, tk.easeOut),
  ]));
}

window.StageKit.register("feed", kit);
})();
