/* STUB kit: feed (the Algorithm's surveillance view). Contract: stage/SPEC.md section 4, stage/MOTION.md.
   Wave 1 placeholder so the shell can be built and tested. Wave 2 replaces this file.
   A frame with a channel and a clock, a box on a face, a scan line, a log, bars. Transform and opacity only.
   Durations come from --m-* tokens. Every cue returns a Promise and resolves at once under reduced motion
   (the media query, or <html data-motion="calm">).
   `turn` is a hard cut (no animation); `shift` is a dissolve. Call order: show(), then cue(turn|shift), then update(state).
   finish() jumps the active cue to its end state and resolves its Promise now. */
(function () {
"use strict";
let skipNow = false, host, assets = {}, cast = null, active = new Set(), cur = null, pend = null, tokens = {}, secs = 0, act = null, last = null;
const docEl = document.documentElement;
const redNow = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || docEl.getAttribute("data-motion") === "calm";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ms = (cs, n, d) => { const x = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(x) ? x : d; };

function run(elm, frames, dur, ease) {
  if (redNow() || skipNow || !elm) return Promise.resolve();
  const a = elm.animate(frames, { duration: dur, easing: ease, fill: "backwards" });
  active.add(a);
  const done = () => active.delete(a);
  a.onfinish = done; a.oncancel = done;
  return a.finished.then(done, done);
}
// The active cue: its Promise settles when the animation ends or when finish() is called, whichever comes first.
function track(p, end) {
  return new Promise(res => {
    const a = act = { end, res };
    const fin = () => { if (act === a) act = null; try { end && end(); } catch (e) {} res(); };
    Promise.resolve(p).then(fin, fin);
  });
}
const stamp = n => { const s = n % 60, m = Math.floor(n / 60) % 60, h = 7 + Math.floor(n / 3600); return [h, m, s].map(x => String(x).padStart(2, "0")).join(":"); };
function layerEl(l) {
  const e = document.createElement("div");
  e.className = "k-layer k-" + l.prim; e.dataset.prim = l.prim;
  const abs = "position:absolute;";
  const at = `left:${(l.x == null ? 0.5 : l.x) * 100}%;top:${(l.y == null ? 0.5 : l.y) * 100}%;width:${(l.w == null ? 0.3 : l.w) * 100}%;transform:translate(-50%,-50%)`;
  switch (l.prim) {
    case "frame":
      e.style.cssText = abs + "inset:0;border:2px dashed var(--st-edge)";
      e.innerHTML = (l.art ? `<img alt="" draggable="false" src="${assets[l.art] || ""}" style="width:100%;height:100%;object-fit:cover;display:block">` : "") +
        `<span class="k-ch" style="${abs}left:8px;top:30px;font:700 .75rem ui-monospace,monospace;color:var(--st-ink);background:var(--st-scrim);padding:0 6px">${esc(l.channel || "CH 1")}</span>` +
        `<span class="k-clock" style="${abs}right:8px;top:30px;font:700 .75rem ui-monospace,monospace;color:var(--st-ink);background:var(--st-scrim);padding:0 6px">${stamp(0)}</span>`;
      break;
    case "track": {
      e.style.cssText = abs + at + ";aspect-ratio:1;border:2px dashed var(--st-accent)";
      const p = cast && cast.people && l.cast && cast.people[l.cast];
      e.innerHTML = `<span style="${abs}left:0;bottom:100%;font:700 .75rem ui-monospace,monospace;color:var(--st-ink);background:var(--st-scrim);padding:0 4px;white-space:nowrap">${esc(l.label || (p && p.name) || "SUBJECT")} 0.${p ? 91 : 80}</span>`;
      break;
    }
    case "scan":
      e.style.cssText = abs + "left:0;right:0;top:0;height:2px;opacity:0;background:var(--st-accent)";
      break;
    case "log":
      e.style.cssText = abs + "left:8px;bottom:8px;font:.75rem/1.5 ui-monospace,monospace;color:var(--st-ink);background:var(--st-scrim);padding:4px 8px;max-width:60%";
      e.innerHTML = (l.lines || []).map(t => `<div>${esc(t)}</div>`).join("");
      break;
    case "redact":
      e.style.cssText = abs + at + ";height:2.2em;background:var(--st-ink);color:var(--st-bg);display:grid;place-items:center;font:700 .75rem ui-monospace,monospace";
      e.textContent = "REDACTED";
      break;
    default: // plate
      e.style.cssText = abs + at;
      e.innerHTML = l.art ? `<img alt="" draggable="false" src="${assets[l.art] || ""}" style="width:100%;display:block;border:2px solid var(--st-edge)">` : "";
  }
  return e;
}
function buildSet(id, set) {
  const s = document.createElement("div");
  s.className = "k-set"; s.dataset.set = id; s.style.cssText = "position:absolute;inset:0;overflow:hidden";
  (set.layers || []).forEach(l => { const e = layerEl(l); e._layer = l; s.appendChild(e); });
  return s;
}
function commit() {
  if (!pend) return;
  if (pend.old && pend.old.parentNode) pend.old.remove();
  pend.next.style.opacity = "";
  pend = null;
}
function setClock() { if (cur) for (const c of cur.querySelectorAll(".k-clock")) c.textContent = stamp(secs); }

const kit = {
  mount(root, o) {
    host = root; assets = o.assets || {}; cast = o.pack && o.pack.cast;
    const cs = getComputedStyle(document.documentElement);
    tokens = { cross: ms(cs, "--m-cross", 650), ink: ms(cs, "--m-ink", 800), bloom: ms(cs, "--m-bloom", 700), roll: ms(cs, "--m-roll", 900),
      tear: ms(cs, "--m-tear", 500), close: ms(cs, "--m-close", 1200), state: ms(cs, "--m-state", 250), d3: ms(cs, "--m-d3", 16),
      easeOut: cs.getPropertyValue("--m-ease-out").trim() || "ease-out", easeIn: cs.getPropertyValue("--m-ease-in").trim() || "ease-in",
      easeLinear: cs.getPropertyValue("--m-ease-linear").trim() || "linear" };
    host.style.background = "var(--st-tint1)";
  },
  show(id, set, o) {
    commit();
    const next = buildSet(id, set), old = cur;
    cur = next;
    if (o && o.instant) { if (old) old.remove(); host.appendChild(next); }
    else { next.style.opacity = "0"; host.appendChild(next); pend = { next, old }; }
    last = o && o.state;
    setClock();
  },
  // Nothing in this stub is bound to state; it keeps the last state so a real kit's rule is visible here.
  // Restores what no cue replays after back, load or Continue: redactions lifted after a reveal in this set.
  update(state) {
    skipNow = false; commit(); last = state; setClock();
    if (cur && state) for (const b of cur.querySelectorAll(".k-redact")) { // lifted after a reveal in this set, down before it
      const base = b.style.transform.replace(" translateY(-120%)", "");
      b.style.opacity = state.revealed ? "0" : ""; b.style.transform = state.revealed ? base + " translateY(-120%)" : base;
    }
  },
  cue(c, o) {
    const red = (o && o.reduced) || redNow();
    skipNow = !!(o && o.reduced); // the shell asks for the end state at once (a tap, or reduced motion)
    switch (c.type) {
      case "turn": // a hard cut: swap in one frame, the clock jumps
        secs += 94; commit(); setClock();
        return Promise.resolve();
      case "shift": {
        if (!pend) return Promise.resolve();
        const p = pend; p.next.style.opacity = "";
        if (red || !p.old) { commit(); return Promise.resolve(); }
        const a = run(p.next, [{ opacity: 0 }, { opacity: 1 }], tokens.cross, tokens.easeOut);
        run(p.old, [{ opacity: 1 }, { opacity: 0 }], tokens.cross, tokens.easeOut);
        p.old.style.opacity = "0";
        return track(a, commit);
      }
      case "ink": { // a redaction lifts
        const bars = cur ? [...cur.querySelectorAll(".k-redact")] : [];
        if (!(o && o.beat && o.beat.reveal)) return Promise.resolve();
        bars.forEach(b => { b.style.opacity = "0"; b.style.transform += " translateY(-120%)"; });
        return track(Promise.all(bars.map(b => run(b, [{ opacity: 1, transform: b.style.transform.replace(" translateY(-120%)", "") }, { opacity: 0, transform: b.style.transform }], tokens.ink, tokens.easeOut))));
      }
      case "bloom": // the frame comes into focus
        return cur ? track(run(cur, [{ opacity: 0.7 }, { opacity: 1 }], tokens.bloom, tokens.easeOut)) : Promise.resolve();
      case "roll": {
        const s = cur && cur.querySelector(".k-scan");
        if (!s) return Promise.resolve();
        return track(run(s, [{ opacity: 0.15, transform: "translateY(0)" }, { opacity: 0.15, transform: `translateY(${host.clientHeight}px)` }], tokens.roll, tokens.easeLinear));
      }
      case "tear": // the signal slips once
        return cur ? track(run(cur, [{ transform: `translateX(${tokens.d3}px)` }, { transform: "none" }], tokens.tear, tokens.easeOut)) : Promise.resolve();
      case "seal": {
        const t = cur && cur.querySelector(".k-track");
        if (t) { t.style.borderStyle = "solid"; }
        return Promise.resolve();
      }
      case "close":
        if (!cur) return Promise.resolve();
        cur.style.transform = "scaleY(.02)";
        return track(run(cur, [{ transform: "none" }, { transform: "scaleY(.02)" }], tokens.close, tokens.easeIn));
      default:
        return Promise.resolve(); // cost, gain, tally: the shell shows these
    }
  },
  // A tap during a cue: every animation jumps to its end, a pending swap completes, and the cue's Promise resolves now.
  finish() {
    const a = act; act = null;
    for (const x of [...active]) { try { x.finish(); } catch (e) {} }
    active.clear();
    commit();
    if (a) { try { a.end && a.end(); } catch (e) {} a.res(); }
  },
  card(scene) {
    return `<div class="scene-card"><p class="card-place">${scene.ending ? "Feed closed" : esc(scene.place || "")}</p><h2 class="card-title">${esc(scene.title)}</h2><div class="card-rule"></div></div>`;
  },
  destroy() { if (host) host.innerHTML = ""; active.clear(); cur = pend = act = last = null; },
};
window.StageKit.register("feed", kit);
})();
