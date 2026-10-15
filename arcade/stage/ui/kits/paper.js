/* STUB kit: paper (the pop-up book). Contract: stage/SPEC.md section 4, stage/MOTION.md.
   Wave 1 placeholder so the shell can be built and tested. Wave 2 replaces this file.
   Plain image layers, a few transform/opacity transitions, every duration read from --m-* tokens.
   Every cue returns a Promise. Under reduced motion (the media query, or <html data-motion="calm">) no animation starts
   and every cue resolves at once.
   Call order from the shell: show() builds the new set, then cue(turn|shift) swaps it, then update(state).
   finish() jumps the active cue to its end state and resolves its Promise now. update(state) restores bound layers
   (the pull-tab) after every step, back, load and Continue. */
(function () {
"use strict";
let skipNow = false, host, assets = {}, wash, active = new Set(), cur = null, pend = null, tokens = {}, rolled = 0, act = null;
const docEl = document.documentElement;
const redNow = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || docEl.getAttribute("data-motion") === "calm";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ms = (cs, n, d) => { const x = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(x) ? x : d; };

function run(elm, frames, dur, ease) {
  if (redNow() || skipNow || !elm) return Promise.resolve();
  const a = elm.animate(frames, { duration: dur, easing: ease, fill: "backwards" }); // end state is the element's own style
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
const img = (src, extra) => `<img alt="" draggable="false" src="${assets[src] || ""}"${extra || ""}>`;
function layerEl(l) {
  const e = document.createElement("div");
  e.className = "k-layer k-" + l.prim;
  const full = l.prim === "spread";
  e.style.cssText = full ? "position:absolute;inset:0" :
    `position:absolute;left:${(l.x == null ? 0.5 : l.x) * 100}%;top:${(l.y == null ? 0.5 : l.y) * 100}%;width:${(l.w == null ? 0.3 : l.w) * 100}%;transform:translate(-50%,-50%)`;
  if (l.x == null && !full) e.style.transform = "translate(-50%,-50%)";
  e.dataset.prim = l.prim;
  if (l.art) e.innerHTML = img(l.art, full ? ` style="width:100%;height:100%;object-fit:cover;display:block"` : ` style="width:100%;display:block"`);
  if (l.prim === "flap" || l.prim === "pulltab") {
    const under = document.createElement("div");
    under.className = "k-under";
    under.style.cssText = "position:absolute;inset:0;opacity:0";
    under.innerHTML = img(l.under, ` style="width:100%;display:block"`);
    e.appendChild(under);
    e.dataset.open = "0";
  }
  if (l.prim === "ticket") e.insertAdjacentHTML("beforeend", `<span class="k-ticket-label" style="position:absolute;left:0;right:0;bottom:-1.4em;text-align:center;font:700 .75rem system-ui;color:var(--st-ink)">★ 1 FP</span>`);
  return e;
}
function buildSet(id, set) {
  const s = document.createElement("div");
  s.className = "k-set"; s.dataset.set = id;
  s.style.cssText = "position:absolute;inset:0;overflow:hidden";
  (set.layers || []).forEach(l => { const e = layerEl(l); e._layer = l; s.appendChild(e); });
  return s;
}
function commit() { // finish a pending swap: drop the old set, show the new one at rest
  if (!pend) return;
  if (pend.old && pend.old.parentNode) pend.old.remove();
  pend.next.style.opacity = "";
  pend = null;
}
// Bind pull-tabs to the tallies in `state`. `animate` is false when a set is first built, true for update().
function restore(state, animate) {
  if (!cur) return;
  for (const e of cur.querySelectorAll(".k-pulltab")) {
    const l = e._layer, t = (state && state.tallies && state.tallies[l.tally]) || {};
    const n = t[l.value] || 0, lead = n >= 1 && n === Math.max(0, ...Object.values(t));
    const under = e.querySelector(".k-under");
    const was = e.dataset.open === "1";
    e.dataset.open = lead ? "1" : "0";
    under.style.opacity = lead ? "1" : "0";
    under.style.transform = lead ? `translateX(${tokens.d4}px)` : "none";
    if (animate && lead !== was) run(under, [{ transform: lead ? "none" : `translateX(${tokens.d4}px)`, opacity: lead ? 0 : 1 }], tokens.in, tokens.easeOut);
  }
}

const kit = {
  mount(root, o) {
    host = root; assets = o.assets || {};
    const cs = getComputedStyle(document.documentElement);
    tokens = { turn: ms(cs, "--m-turn", 650), cross: ms(cs, "--m-cross", 650), ink: ms(cs, "--m-ink", 800), bloom: ms(cs, "--m-bloom", 700),
      roll: ms(cs, "--m-roll", 900), tear: ms(cs, "--m-tear", 500), close: ms(cs, "--m-close", 1200), state: ms(cs, "--m-state", 250),
      in: ms(cs, "--m-in", 450), d2: ms(cs, "--m-d2", 8), d4: ms(cs, "--m-d4", 32), tilt: parseFloat(cs.getPropertyValue("--m-tilt")) || 3,
      rollTurn: parseFloat(cs.getPropertyValue("--m-roll-turn")) || 540, wash: parseFloat(cs.getPropertyValue("--m-wash-alpha")) || 0.3,
      easeOut: cs.getPropertyValue("--m-ease-out").trim() || "ease-out", easeIn: cs.getPropertyValue("--m-ease-in").trim() || "ease-in" };
    host.style.background = "var(--st-tint1)";
    wash = document.createElement("div");
    wash.style.cssText = "position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 35%, var(--st-lamp), transparent 70%)";
    host.appendChild(wash);
  },
  show(id, set, o) {
    commit();
    const next = buildSet(id, set);
    const old = cur;
    cur = next;
    if (o && o.instant) { if (old) old.remove(); host.insertBefore(next, wash); }
    else { next.style.opacity = "0"; host.insertBefore(next, wash); pend = { next, old }; }
    restore(o && o.state, false);
  },
  update(state) { skipNow = false; commit(); restore(state, true); },
  cue(c, o) {
    const red = (o && o.reduced) || redNow();
    skipNow = !!(o && o.reduced); // the shell asks for the end state at once (a tap, or reduced motion)
    switch (c.type) {
      case "turn": {
        if (!pend) return Promise.resolve();
        const p = pend; p.next.style.opacity = "";
        const dir = c.dir || 1;
        if (red || !p.old) { commit(); return Promise.resolve(); }
        p.old.style.zIndex = "1";
        const a = run(p.old, [{ transform: "none", opacity: 1 }, { transform: `translateX(${-dir * 40}%) rotate(${-dir * tokens.tilt}deg)`, opacity: 0 }], tokens.turn, tokens.easeIn);
        p.old.style.opacity = "0"; // end state of the old page: gone
        return track(a, commit);
      }
      case "shift": {
        if (!pend) return Promise.resolve();
        const p = pend; p.next.style.opacity = "";
        if (red || !p.old) { commit(); return Promise.resolve(); }
        const a = run(p.next, [{ opacity: 0 }, { opacity: 1 }], tokens.cross, tokens.easeOut);
        run(p.old, [{ opacity: 1 }, { opacity: 0 }], tokens.cross, tokens.easeOut);
        p.old.style.opacity = "0";
        return track(a, commit);
      }
      case "ink": {
        const flaps = cur ? cur.querySelectorAll(".k-flap") : [];
        let ps = [];
        if (o && o.beat && o.beat.reveal) for (const f of flaps) { // a reveal opens the flap
          const u = f.querySelector(".k-under"); f.dataset.open = "1"; u.style.opacity = "1";
          ps.push(run(u, [{ opacity: 0 }, { opacity: 1 }], tokens.ink, tokens.easeOut));
        } else { // unwitnessed: the warm wash fades
          wash.style.opacity = "0";
          ps.push(run(wash, [{ opacity: tokens.wash }, { opacity: 0 }], tokens.state, tokens.easeOut));
          if (cur) ps.push(run(cur, [{ opacity: 0.7 }, { opacity: 1 }], tokens.ink, tokens.easeOut));
        }
        return track(Promise.all(ps));
      }
      case "bloom":
        wash.style.opacity = String(tokens.wash);
        return track(run(wash, [{ opacity: 0 }, { opacity: tokens.wash }], tokens.bloom, tokens.easeOut));
      case "roll": {
        const w = cur && cur.querySelector(".k-volvelle");
        if (!w) return Promise.resolve();
        const from = rolled, to = from + tokens.rollTurn + ((c.total || 0) % 12) * 30;
        rolled = to; w.style.transform = `translate(-50%,-50%) rotate(${to}deg)`;
        return track(run(w, [{ transform: `translate(-50%,-50%) rotate(${from}deg)` }, { transform: `translate(-50%,-50%) rotate(${to}deg)` }], tokens.roll, tokens.easeOut));
      }
      case "tear": {
        const t = cur && cur.querySelector(".k-ticket");
        if (!t) return Promise.resolve();
        t.dataset.torn = "1"; t.style.opacity = ".6";
        t.style.transform = `translate(-50%,-50%) rotate(${-tokens.tilt}deg)`;
        const lab = t.querySelector(".k-ticket-label"); if (lab) lab.textContent = "★ 1 FP spent";
        return track(run(t, [{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${-tokens.tilt}deg)`, opacity: 0.6 }], tokens.tear, tokens.easeOut));
      }
      case "close":
        if (!cur) return Promise.resolve();
        cur.style.opacity = ".55";
        return track(run(cur, [{ opacity: 1 }, { opacity: 0.55 }], tokens.close, tokens.easeIn));
      default:
        return Promise.resolve(); // seal, cost, gain, tally: the shell shows these
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
    return `<div class="scene-card">${scene.ending ? '<p class="card-place">Ending</p>' : scene.place ? `<p class="card-place">${esc(scene.place)}</p>` : ""}<h2 class="card-title">${esc(scene.title)}</h2><div class="card-rule"></div></div>`;
  },
  destroy() { if (host) host.innerHTML = ""; active.clear(); cur = pend = act = null; },
};
window.StageKit.register("paper", kit);
})();
