// The Stage: browser test. Contract: stage/SPEC.md section 5.
//   node stage/test.mjs               every built page in dist/, every route
//   SAMPLE=5 node stage/test.mjs      play only 5 routes per pack (one per ending first, then evenly spaced)
//   ONLY=magic-module,test node ...   only those pack ids
//   JOBS=4 node ...                   browser contexts at a time (default: one per CPU, at most 8)
//   SHOTS=/dir node ...               save a screenshot of each pack at 360 px
//
// Every path comes from this file's own place, so the same file runs in the Fort (stage/) and in HTLL (arcade/stage/).
// For every page in dist/ it checks:
//   build        the page was built from the pack and the sources beside it, art and fonts included (not stale). A pack with no built page is
//                reported (unless ONLY is set)
//   network      no network reference in the HTML; every request during play is a data: URL or the page's own file (any other file: URL fails)
//   names        no forbidden name in the pack's text or art (the lists in ../intro/test.mjs and ../generator/test.mjs). With ../intro/test.mjs
//                beside stage/ a list that does not parse fails the check; without it (HTLL) the check is SKIPPED, out loud
//   emoji        HTLL layout only (no ../intro/test.mjs): no emoji in the pack's strings
//   routes       every route from Stage.simulate, opened with ?seed=1&force=<its roll tiers>, played by keyboard under
//                reduced motion, reaches its ending; no running animation after any step; no horizontal scroll at 360 px
//                (and no speaker's avatar has a NaN size: a cast entry with no crop gets the placeholder disc)
//   verify       the Verify sheet's counts equal Stage.simulate's; it lists the first 20 routes (VERIFY_FIRST) and "Show all N routes" lists them
//                all; a route replays to its ending; Last pick stops at a choice
//   commentary   the toggle hides the track; the track's note is in the Notes sheet
//   chips        every ⓘ chip opens its note
//   contrast     light and dark text pairs are 4.5:1 or better, from the computed tokens (by data-theme and by the system setting);
//                and every visible text on a page at a few stops of the longest route (title, sheets, each kind of step, the ending), in light
//                and dark, measured as rendered: colour composited with the opacity chain over its background (disabled controls skipped)
//   begin        Enter pressed ten times at the title in full motion starts the story once; Play again from the ending still starts it
//   continue     an unforced run stopped at a choice and reloaded comes back to the same node on Continue; Back once is sane; the kit sees
//                state.ended at the ending
//   force        ?force= never writes the save or the found endings (and Continue is not offered on a normal visit afterwards); a token that
//                is not a result tier is ignored and shown in the footer; the footers say how the run was set
//   storage      the page works when localStorage throws, when its methods throw, and when it holds garbage; every key the page writes
//                is the pack's storageKey (or starts with it), and starts with htll. in HTLL
//   layout       no horizontal scroll at 360 and 1280 px (play, title, every sheet)
//   phone        (wave 3) no .m-name is clipped (scrollWidth > clientWidth) on any step of the shortest route at 360x640, 390x844 and 412x915;
//                at 568x320 and 844x390 the Begin button is fully visible and hit-testable at the title with no scrolling, and the first choice
//                panel is at least min(120 px, its own content) tall; at 320x256 every option of the first choice can be scrolled into view
//                and hit by a tap; every focusable element in #kit is hit-testable at its centre when focused, at 360x640, on each stable
//                step of the longest route (a covered pull-tab fails)
//   shortcuts    Settings > Keyboard shortcuts Off: "a" and "n" change nothing; On: "a" toggles AUTO
//   verify speed the Verify sheet opens with its route list in under 300 ms at 1x CPU, from the page's embedded window.SIM
//   calm         Settings > Calm behaves like reduced motion
//   motion       full motion plays a route by keyboard, tapping through every cue, with no console error
//   console      no console error, no console warning, no page error, anywhere
// The last line is PASS, or FAIL with the checks that failed.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import assert from "node:assert";
import { loadAll } from "./tools/load.mjs";
import { FIXTURES } from "./tools/validate.mjs";

const require = createRequire(import.meta.url);
const Stage = require("./engine/stage.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "dist");
const PACKS = path.join(HERE, "packs");
const SAMPLE = Math.max(0, Math.floor(Number(process.env.SAMPLE) || 0));
const JOBS = Math.max(1, Math.floor(Number(process.env.JOBS) || Math.min(os.cpus().length, 8)));
const ONLY = (process.env.ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const SHOTS = process.env.SHOTS || "";
const T0 = Date.now();
const secs = () => ((Date.now() - T0) / 1000).toFixed(1);

/* ---------------------------------------------------------------------------
   Playwright and Chromium
   ------------------------------------------------------------------------- */
let chromium;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright/index.js"]) {
  try { ({ chromium } = require(p)); break; } catch (e) { /* try the next */ }
}
if (!chromium) {
  try {
    const { execSync } = await import("node:child_process");
    ({ chromium } = require(execSync("npm root -g").toString().trim() + "/playwright"));
  } catch (e) { /* reported below */ }
}
if (!chromium) { console.log("FAIL: Playwright is not installed"); process.exit(1); }
let browser;
try { browser = await chromium.launch(); } catch (e) {
  const exe = ["/opt/pw-browsers/chromium", ...fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter(d => /^chromium-\d+$/.test(d)).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`) : []].find(p => fs.existsSync(p));
  if (!exe) { console.log("FAIL: no Chromium found (" + e.message.split("\n")[0] + ")"); process.exit(1); }
  browser = await chromium.launch({ executablePath: exe });
}

/* ---------------------------------------------------------------------------
   Failures: one list, deduplicated, grouped by check at the end
   ------------------------------------------------------------------------- */
const failures = []; // { pack, check, msg, n }
const failIndex = new Map();
function fail(pack, check, msg) {
  const k = `${pack}\u0000${check}\u0000${msg}`;
  const hit = failIndex.get(k);
  if (hit) { hit.n++; return; }
  const f = { pack, check, msg, n: 1 };
  failIndex.set(k, f); failures.push(f);
}
const notes = []; // information lines printed at the end
const errText = e => (e && e.message ? e.message : String(e)).split("\n")[0].slice(0, 400);

/* ---------------------------------------------------------------------------
   Forbidden names. The lists are read from the Fort's own tests, never copied here.
   ------------------------------------------------------------------------- */
// AGENTS.md: "Halcyon ... You may name it. Do not key it." The intro and the Forge forbid it; a Stage pack may say it.
const NAMEABLE = ["Halcyon"];
function regexLiterals(text) {
  const out = [];
  const re = /\/((?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\n])+)\/([gimsuy]*)/g;
  let m;
  while ((m = re.exec(text))) out.push([m[1], m[2].replace(/[gy]/g, "")]);
  return out;
}
// The Fort has ../intro/test.mjs. HTLL (arcade/stage) has not, and the names check is SKIPPED there, on purpose and out loud.
const INTRO = path.join(HERE, "..", "intro", "test.mjs");
const FORT_LAYOUT = fs.existsSync(INTRO);
function loadForbidden() {
  const intro = INTRO;
  const gen = path.join(HERE, "..", "generator", "test.mjs");
  if (!fs.existsSync(intro)) return { list: null, from: [], problems: [] };
  const list = [], from = [], problems = [];
  // `mid` is for a capitalised word that is only a name in mid-sentence ("at the Keep"); "Keep it" opening a sentence is a verb.
  let from_ = "intro";
  const add = (src, flags, mid) => {
    const alts = src.split("|").filter(a => !NAMEABLE.includes(a));
    if (alts.length) list.push({ re: new RegExp(alts.join("|"), flags + "g"), mid: !!mid, from: from_ });
  };
  const isyntax = /https?|script|link\[|<link/; // the intro's own network checks are done by the network check here
  // intro/test.mjs: `for (const bad of [ /Sleeper/i, ... ])`
  const it = fs.readFileSync(intro, "utf8");
  const m = it.match(/for \(const bad of \[([^\n]*)\]\)/);
  if (m) { for (const [s, f] of regexLiterals(m[1])) if (!isyntax.test(s)) add(s, f); from.push("intro/test.mjs"); }
  // generator/test.mjs: `const FORBIDDEN = /.../i;` and `const FORBIDDEN_CASE = /.../;`
  if (fs.existsSync(gen)) {
    const gt = fs.readFileSync(gen, "utf8");
    for (const name of ["FORBIDDEN", "FORBIDDEN_CASE"]) {
      const g = gt.match(new RegExp("const " + name + "\\s*=\\s*(/(?:\\\\.|[^/\\\\\\n])+/[a-z]*)\\s*;"));
      if (g) { const [[s, f]] = regexLiterals(g[1]); from_ = name; add(s, f, name === "FORBIDDEN_CASE"); }
    }
    if (list.length) from.push("generator/test.mjs");
  }
  // In the Fort a list that did not parse must fail the check, never weaken it. The lists must hold the player-facing names
  // (the intro's: at least Sleeper and Lintel) and both patterns of the Forge (FORBIDDEN, FORBIDDEN_CASE).
  const hits = word => list.some(x => { x.re.lastIndex = 0; return x.re.test(word); });
  if (!from.includes("intro/test.mjs")) problems.push("intro/test.mjs exists but has no `for (const bad of [ /.../, ... ])` list, so the player-facing names were not read");
  for (const w of ["Sleeper", "Lintel"]) if (!hits(w)) problems.push(`the intro's list did not parse to a pattern that matches "${w}"`);
  if (!fs.existsSync(gen)) problems.push("generator/test.mjs is missing, so FORBIDDEN and FORBIDDEN_CASE were not read");
  else {
    const gt = fs.readFileSync(gen, "utf8");
    for (const name of ["FORBIDDEN", "FORBIDDEN_CASE"]) if (!new RegExp("const " + name + "\\s*=\\s*/").test(gt) || !list.some(x => x.from === name)) problems.push(`generator/test.mjs: could not parse \`const ${name} = /.../\``);
  }
  return { list: list.length ? list : null, from, problems };
}
const FORBIDDEN = loadForbidden();

function stringsOf(x, out = []) {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const v of x) stringsOf(v, out);
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) { out.push(k); stringsOf(v, out); }
  return out;
}

/* ---------------------------------------------------------------------------
   Static checks on one built page
   ------------------------------------------------------------------------- */
const NS_OK = /^https?:\/\/www\.w3\.org\/(1999\/xhtml|2000\/svg|1999\/xlink|1998\/Math\/MathML)$/;
function networkScan(html) {
  const bad = [];
  for (const m of html.matchAll(/\bhttps?:\/\/[^\s"'<>)\\]+/gi)) if (!NS_OK.test(m[0])) bad.push(m[0]);
  for (const m of html.matchAll(/<(?:script|img|iframe|embed|source|video|audio|link|object)\b[^>]*?\b(?:src|href|data)\s*=\s*["']?(?!data:|#|\$\{|["'>])[^\s"'>]+/gi)) bad.push(m[0].slice(0, 120));
  for (const m of html.matchAll(/(?<![A-Za-z.])url\(\s*["']?(?!data:|#|\$\{)[^)"']+/gi)) bad.push(m[0].slice(0, 120));
  for (const m of html.matchAll(/@import\b[^;]{0,80}/gi)) bad.push(m[0]);
  for (const m of html.matchAll(/["'(]\/\/[a-z0-9-]+\.[a-z0-9.-]+\//gi)) bad.push("protocol-relative " + m[0]);
  for (const m of html.matchAll(/\b(?:fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|serviceWorker)/g)) bad.push("script reaches the network: " + m[0]);
  return [...new Set(bad)];
}
// The inverse of the build's escape, so the sources can be found inside the page.
const safe = s => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

/* ---------------------------------------------------------------------------
   Browser sessions
   ------------------------------------------------------------------------- */
// A page error that comes late (a timer, a frame, a cue's tail) must still be seen: sessions linger before they close.
const LINGER = 700;
const linger = page => page.waitForTimeout(LINGER).catch(() => {});
const URL_OF = (spec, query) => pathToFileURL(spec.file).href + (query ? "?" + query : "");

async function session(spec, o = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.width || 360, height: o.height || 740 },
    reducedMotion: o.reduced === false ? "no-preference" : "reduce",
    colorScheme: o.colorScheme || "light",
    deviceScaleFactor: 1,
  });
  if (o.init) await ctx.addInitScript(o.init, o.initArg);
  const page = await ctx.newPage();
  page.setDefaultTimeout(o.timeout || 5000);
  const s = { ctx, page, errors: [], requests: [], keys: new Set(), tag: o.tag || "" };
  // Every localStorage key the page writes (the page may reload; harvest before it does).
  await ctx.addInitScript(() => {
    try {
      const set = Storage.prototype.setItem; window.__lsw = [];
      Storage.prototype.setItem = function (k) { try { window.__lsw.push(String(k)); } catch (e) {} return set.apply(this, arguments); };
    } catch (e) {}
  });
  const own = spec.file ? pathToFileURL(spec.file).href : null;
  const base = u => u.replace(/[?#].*$/, "");
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") s.errors.push(`console.${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", e => s.errors.push("pageerror: " + errText(e)));
  // Every request counts except a data: URL and the page's own file (without its query). A file: request for anything else fails.
  page.on("request", r => { const u = r.url(); if (/^data:/i.test(u) || (own && base(u) === base(own))) return; s.requests.push(u.slice(0, 200)); });
  s.harvest = async () => { try { for (const k of await page.evaluate(() => window.__lsw || [])) s.keys.add(k); } catch (e) {} };
  s.close = async () => {
    await s.harvest();
    for (const e of s.errors) fail(spec.id, "console", (s.tag ? `[${s.tag}] ` : "") + e);
    for (const u of s.requests) fail(spec.id, "network", `request during play: ${u}`);
    const sk = spec.pack && spec.pack.storageKey;
    if (sk) for (const k of s.keys) {
      if (k !== sk && !k.startsWith(sk)) fail(spec.id, "storage", `the page wrote localStorage key "${k}", which is not the pack's storageKey "${sk}" or a key that starts with it`);
      // The two fixtures are vendored byte for byte, so they keep their fort-stage. keys in HTLL (SPEC section 2).
      if (!FORT_LAYOUT && !FIXTURES.includes(spec.id) && !k.startsWith("htll.")) fail(spec.id, "storage", `the page wrote localStorage key "${k}", which does not start with htll.`);
    }
    await ctx.close().catch(() => {});
  };
  return s;
}

// What the page looks like right now. Runs inside the page. With `wait`, it first waits for the page to stop being busy.
async function READ(arg) {
  const app = document.getElementById("app");
  if (arg.wait) {
    const t0 = performance.now();
    while (app.dataset.busy !== "0" && performance.now() - t0 < arg.limit) await new Promise(r => setTimeout(r, 2));
  }
  const de = document.documentElement;
  const slide = document.querySelector("#slides .sl:not(.out)");
  const track = slide && slide.querySelector(".track");
  const name = n => n ? n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\s+/).join(".") : "") : "?";
  const anims = document.getAnimations().map(a => {
    const t = a.effect && a.effect.target;
    const n = a.animationName || a.transitionProperty || "";
    return `${a.constructor.name}${n ? " " + n : ""} on ${name(t)}`;
  });
  // Content that is wider than the window or than its box, even where the page clips it so that the page itself does not scroll.
  const vw = de.clientWidth;
  let clip = 0, clipWhy = "";
  const over = (el, n) => { if (n > clip) { clip = n; clipWhy = name(el) + ` "${(el.innerText || "").replace(/\s+/g, " ").slice(0, 40)}"`; } };
  for (const b of document.querySelectorAll("#bar, #hud, #deck, #stage")) over(b, b.scrollWidth - b.clientWidth);
  if (slide) for (const p of slide.querySelectorAll("*")) {
    const r = p.getBoundingClientRect();
    if (r.width <= 1 || p.closest(".sr-only")) continue;
    over(p, Math.ceil(r.right - vw)); over(p, Math.ceil(-r.left));
  }
  const end = slide && slide.querySelector(".end-title");
  const endPanel = slide && slide.querySelector(".panel.ending");
  const a = document.activeElement;
  return {
    phase: app.dataset.phase, node: app.dataset.node, busy: app.dataset.busy === "1",
    secretHidden: !!(slide && slide.querySelector('[data-act="reveal"]')),
    keys: slide ? [...slide.querySelectorAll(".opt")].map(b => ({ key: b.dataset.key, locked: b.getAttribute("aria-disabled") === "true" })) : [],
    chips: slide ? [...slide.querySelectorAll(".chip")].map(c => c.dataset.note) : [],
    track: !!track,
    sig: slide ? slide.innerText.replace(/\s+/g, " ").slice(0, 160) : "",
    overflow: Math.max(de.scrollWidth - de.clientWidth, document.body.scrollWidth - de.clientWidth, clip),
    anims, clipWhy,
    endTitle: end ? end.textContent : null,
    ending: app.dataset.ending == null ? null : app.dataset.ending,
    endingPanel: endPanel ? endPanel.getAttribute("data-ending") : null,
    // A speaker's avatar never carries a NaN size or position (a cast entry with no crop gets the placeholder disc).
    avaBad: slide ? [...slide.querySelectorAll(".ava")].filter(v => /NaN|Infinity|undefined/.test(v.getAttribute("style") || "") || (!v.classList.contains("ava-none") && !/^[\d.]+px [\d.]+px$/.test(getComputedStyle(v).backgroundSize))).map(v => v.getAttribute("aria-label") || "?") : [],
    locked: slide ? slide.querySelectorAll('.opt[aria-disabled="true"]').length : 0,
    backOff: document.getElementById("backBtn").disabled,
    hasField: !!document.getElementById("inField"),
    fieldFocused: !!(a && a.id === "inField"),
    sheet: [...document.querySelectorAll(".sheet")].filter(s => !s.hidden).map(s => s.id),
  };
}
const read = (page, wait = true) => page.evaluate(READ, { wait, limit: 8000 });
const describe = st => `phase=${st.phase} node=${st.node} busy=${st.busy} "${st.sig.slice(0, 70)}"`;

/* The walker: plays one route from the title to an ending by keyboard.
   Options: stop(st, picks) (return true to stop at a settled state, before any key; walk then returns { st, states, stopped: true }),
            wait (wait for the page to settle before each key; the reduced-motion default),
            checkMotion (no running animation at each stop), checkWidth (no horizontal scroll at each stop),
            onState(st) (a hook for the chip and commentary checks). */
async function walk(page, spec, route, o = {}) {
  const wait = o.wait !== false;
  let si = 0, n = 0, same = 0, last = "", states = 0, busyAt = 0;
  const steps = route.steps;
  let st;
  for (;;) {
    if (++n > 4000) throw new Error("did not reach an ending in 4000 actions: " + describe(st));
    st = await read(page, wait);
    states++;
    if (wait && st.busy) throw new Error("the page stayed busy for 8 s: " + describe(st));
    if (!st.busy) {
      if (o.checkMotion && st.anims.length) fail(spec.id, "motion", `animation running under reduced motion after a step: ${[...new Set(st.anims)].sort().slice(0, 4).join("; ")}`);
      if (o.checkWidth && st.overflow > 0) fail(spec.id, "layout", `content is ${st.overflow}px wider than the ${o.checkWidth}px window at a ${st.node || st.phase}${st.clipWhy ? " (" + st.clipWhy + ")" : ""}`);
      for (const who of st.avaBad || []) fail(spec.id, "routes", `the avatar of "${who}" has a NaN or missing size (a cast entry with no crop must get the placeholder)`);
      if (o.onState) await o.onState(st);
    }
    if (st.phase === "play" && st.node === "ending" && !st.busy) break;
    if (o.stop && !st.busy && o.stop(st, si)) return { st, states, stopped: true };
    const sig = [st.phase, st.node, st.busy, st.sig, si].join("|");
    same = sig === last ? same + 1 : 0; last = sig;
    if (same > (wait ? 3 : 40) && !st.busy) throw new Error("stuck: " + describe(st));
    if (st.busy) { // full motion: a key skips the cue. Every cue must settle on finish(), so the page must stop being busy soon.
      busyAt = busyAt || Date.now();
      if (Date.now() - busyAt > 8000) throw new Error("still busy 8 s after keys that skip the motion (a kit cue that does not settle on finish()?): " + describe(st));
      // Keys during the opening cues too: the title's Begin button still has focus, and Enter on it must not start the story again.
      await page.keyboard.press("Enter");
      await page.waitForTimeout(st.node ? 20 : 50);
      continue;
    }
    busyAt = 0;
    if (st.phase === "title" || st.phase === "card") { await page.keyboard.press("Enter"); continue; }
    if (st.node === "beat") { await page.keyboard.press(st.secretHidden ? "r" : "Enter"); continue; }
    if (st.node === "roll") { await page.keyboard.press("Enter"); continue; }
    if (st.node === "choice") {
      const step = steps[si++];
      if (!step || step.opt == null) throw new Error(`the page asks a choice (${st.keys.map(k => k.key).join(",")}) but the route has ${step ? "an input" : "no step"} here`);
      const key = step.opt.slice(step.opt.indexOf(".") + 1);
      const i = st.keys.findIndex(k => k.key === key);
      if (i < 0) throw new Error(`option "${key}" (${step.opt}) is not on the page; it shows ${st.keys.map(k => k.key).join(",")}`);
      if (st.keys[i].locked) throw new Error(`option ${step.opt} is locked on the page`);
      if (i > 8) throw new Error(`option ${step.opt} is number ${i + 1}; there is no key for it`);
      await page.keyboard.press(String(i + 1));
      continue;
    }
    if (st.node === "input") {
      const step = steps[si++];
      if (!step || step.input == null) throw new Error("the page asks for typed text but the route has " + (step ? "a pick" : "no step") + " here");
      if (!st.fieldFocused) { fail(spec.id, "routes", "the text field does not take focus when the input appears"); await page.focus("#inField"); }
      await page.keyboard.type(String(step.input));
      await page.keyboard.press("Enter");
      continue;
    }
    throw new Error("cannot go on: " + describe(st));
  }
  if (si !== steps.length) throw new Error(`the page reached an ending after ${si} of ${steps.length} steps`);
  return { st, states };
}

/* ---------------------------------------------------------------------------
   Checks that need a live page
   ------------------------------------------------------------------------- */
const css = s => JSON.stringify(s); // for attribute selectors

async function checkChip(page, spec, id, where) {
  const note = spec.pack.notes[id];
  const sel = `#slides .sl:not(.out) .chip[data-note=${css(id)}]`;
  try {
    await page.click(sel, { timeout: 3000 });
    const r = await page.evaluate(id => {
      const sheet = document.getElementById("sheet-notes"), art = document.getElementById("note-" + id);
      const a = document.activeElement;
      return { open: !sheet.hidden, art: !!art, hit: !!(art && art.classList.contains("hit")), term: art ? art.querySelector("h4").textContent : null,
        text: art ? art.querySelector("p").textContent : null, focusIn: !!(a && sheet.contains(a)), inert: document.getElementById("app").inert };
    }, id);
    if (!r.open) fail(spec.id, "chips", `chip "${id}" (${where}) did not open the Notes sheet`);
    else if (!r.art) fail(spec.id, "chips", `chip "${id}" (${where}) opened the Notes sheet with no entry for the note`);
    else {
      if (!r.hit) fail(spec.id, "chips", `chip "${id}" (${where}): its note is not marked as the one asked for`);
      if (r.term !== note.term || r.text !== note.text) fail(spec.id, "chips", `chip "${id}" (${where}) shows the wrong text`);
      if (!r.focusIn) fail(spec.id, "chips", `chip "${id}" (${where}): focus is not inside the Notes sheet`);
    }
    await page.keyboard.press("Escape");
    const after = await page.evaluate(() => ({ open: !document.getElementById("sheet-notes").hidden, inert: document.getElementById("app").inert }));
    if (after.open || after.inert) fail(spec.id, "chips", `chip "${id}" (${where}): Esc did not close the Notes sheet`);
    await letGo(page);
  } catch (e) {
    fail(spec.id, "chips", `chip "${id}" (${where}): ${errText(e)}`);
    await page.keyboard.press("Escape").catch(() => {});
  }
}

// After a sheet closes, focus goes back to the button that opened it, and Enter on that button would open the sheet again.
// A player who wants to go on moves focus away; the test lets go of it.
const letGo = page => page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
async function setSetting(page, name, val) {
  await page.click("#setBtn");
  await page.click(`#sheet-settings [data-set=${css(name)}][data-val=${css(val)}]`);
  await page.keyboard.press("Escape");
  await letGo(page);
}

async function checkCommentary(page, spec) {
  const probe = () => page.evaluate(() => {
    const t = document.querySelector("#slides .sl:not(.out) .track");
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { display: getComputedStyle(t).display, w: r.width, h: r.height, attr: document.documentElement.dataset.commentary, term: (t.querySelector("b") || {}).textContent || "" };
  });
  try {
    const on = await probe();
    if (!on || on.display === "none" || !on.w || !on.h) { fail(spec.id, "commentary", "the commentary track is not visible when commentary is on"); return; }
    await setSetting(page, "commentary", "off");
    const off = await probe();
    if (!off || off.attr !== "off" || off.display !== "none" || off.w || off.h) fail(spec.id, "commentary", `the toggle did not hide the track (data-commentary=${off && off.attr}, display=${off && off.display})`);
    await setSetting(page, "commentary", "on");
    const back = await probe();
    if (!back || back.display === "none") fail(spec.id, "commentary", "turning commentary back on did not show the track");
    // A note shown in the track also joins the Notes sheet.
    const term = on.term.replace(/\.$/, "");
    await page.keyboard.press("n");
    const terms = await page.evaluate(() => [...document.querySelectorAll("#body-notes article h4")].map(h => h.textContent));
    await page.keyboard.press("Escape");
    await letGo(page);
    if (!terms.includes(term)) fail(spec.id, "commentary", `the track's note "${term}" is not in the Notes sheet`);
  } catch (e) { fail(spec.id, "commentary", errText(e)); await page.keyboard.press("Escape").catch(() => {}); }
}

const VERIFY_FIRST = 20; // routes the Verify sheet lists before "Show all" (ui/view.js VERIFY_FIRST)
async function checkVerify(page, spec) {
  const sim = spec.sim, id = spec.id;
  try {
    await page.keyboard.press("v");
    await page.waitForSelector("#body-verify .ec", { timeout: 60000 });
    const got = await page.evaluate(() => {
      const b = document.getElementById("body-verify");
      const tot = b.querySelector("[data-total]");
      return { total: tot ? tot.dataset.total : null, ends: Object.fromEntries([...b.querySelectorAll(".ec")].map(e => [e.dataset.ending, e.dataset.count])), text: b.innerText.replace(/\s+/g, " "), rows: b.querySelectorAll(".route").length };
    });
    if (got.total !== String(sim.paths)) fail(id, "verify", `Verify shows ${got.total} paths; Stage.simulate counts ${sim.paths}`);
    for (const [e, c] of Object.entries(sim.endings)) if (got.ends[e] !== String(c)) fail(id, "verify", `Verify shows ${got.ends[e]} paths to "${e}"; Stage.simulate counts ${c}`);
    for (const e of Object.keys(got.ends)) if (!(e in sim.endings)) fail(id, "verify", `Verify lists an ending "${e}" that Stage.simulate does not`);
    if (!got.text.includes(`${sim.routes.length} routes`)) fail(id, "verify", `Verify does not say "${sim.routes.length} routes"`);
    if (!got.text.includes(`${sim.states} states`)) fail(id, "verify", `Verify does not say "${sim.states} states"`);
    if (got.rows !== Math.min(VERIFY_FIRST, sim.routes.length)) fail(id, "verify", `Verify lists ${got.rows} route rows; expected ${Math.min(VERIFY_FIRST, sim.routes.length)}`);
    // Past the first VERIFY_FIRST, one button lists them all.
    if (sim.routes.length > VERIFY_FIRST) {
      const more = await page.evaluate(() => { const b = document.getElementById("vmore"); return b ? b.textContent.trim() : null; });
      if (more !== `Show all ${sim.routes.length} routes`) fail(id, "verify", `Verify has ${sim.routes.length} routes and shows ${VERIFY_FIRST}, but its button says ${JSON.stringify(more)}, not "Show all ${sim.routes.length} routes"`);
      else {
        await page.click("#vmore");
        const all = await page.evaluate(() => document.querySelectorAll("#body-verify .route").length);
        if (all !== sim.routes.length) fail(id, "verify", `"Show all ${sim.routes.length} routes" lists ${all} route rows`);
      }
    }
    // A route replays to its ending; Last pick stops at a choice.
    const i = sim.routes.findIndex((r, k) => k < VERIFY_FIRST && r.steps.some(s => s.opt));
    if (i < 0) return;
    await page.click(`#body-verify .route[data-route="${i}"]`);
    await page.waitForFunction(() => document.getElementById("app").dataset.node === "ending");
    const end = await read(page);
    const want = spec.pack.script.endings[sim.routes[i].ending].title;
    if (end.endTitle !== want) fail(id, "verify", `replaying route ${i} landed on "${end.endTitle}", not "${want}"`);
    await page.keyboard.press("v");
    await page.waitForSelector("#body-verify .ec", { timeout: 60000 });
    await page.click(`#body-verify [data-route-last="${i}"]`);
    await page.waitForFunction(() => document.getElementById("app").dataset.node === "choice");
    const mid = await read(page);
    if (mid.phase !== "play" || !mid.keys.length) fail(id, "verify", "Last pick did not stop at a choice with options");
  } catch (e) { fail(id, "verify", errText(e)); }
}

/* Contrast. A token pair is text on a ground. Tokens are read as the shell reads them (--st-*). */
const TEXT_ON = {
  ink: ["bg", "panel", "card"], "ink-soft": ["bg", "panel", "card"], muted: ["bg", "panel", "card"],
  accent: ["bg", "panel"], good: ["bg", "panel"], bad: ["bg", "panel", "card"], lamp: ["bg", "panel"], "on-accent": ["accent"],
};
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function tokensNow(page) {
  return page.evaluate(names => {
    const cs = getComputedStyle(document.documentElement), probe = document.createElement("i");
    document.body.appendChild(probe);
    const out = {};
    for (const n of names) {
      const raw = cs.getPropertyValue("--st-" + n).trim();
      if (!raw) { out[n] = null; continue; }
      probe.style.color = ""; probe.style.color = raw;
      const c = getComputedStyle(probe).color.match(/[\d.]+/g);
      out[n] = c ? c.slice(0, 3).map(Number).concat(c.length > 3 ? [Number(c[3])] : [1]) : null;
    }
    probe.remove();
    return out;
  }, [...new Set(Object.entries(TEXT_ON).flat(2))]);
}
async function checkContrast(spec) {
  const id = spec.id;
  const rows = [];
  const measure = async (label, page) => {
    const t = await tokensNow(page);
    for (const [fg, grounds] of Object.entries(TEXT_ON)) for (const g of grounds) {
      if (!t[fg] || !t[g]) { fail(id, "contrast", `${label}: token ${!t[fg] ? fg : g} is missing or not a colour`); continue; }
      const r = ratio(t[fg], t[g]);
      rows.push([label, fg, g, r]);
      if (r < 4.5) fail(id, "contrast", `${label}: ${fg} on ${g} is ${r.toFixed(2)}:1 (needs 4.5:1)`);
    }
  };
  // By the page's own theme setting, and by the system setting with no data-theme (the media query in the build).
  for (const scheme of ["light", "dark"]) {
    const s = await session(spec, { colorScheme: scheme, tag: "contrast" });
    try {
      await s.page.goto(URL_OF(spec));
      await s.page.evaluate(t => document.documentElement.setAttribute("data-theme", t), scheme);
      await measure(`${scheme} (data-theme)`, s.page);
      const attr = await s.page.evaluate(() => { document.documentElement.removeAttribute("data-theme"); return getComputedStyle(document.documentElement).colorScheme; });
      await measure(`${scheme} (system)`, s.page);
      const a = await tokensNow(s.page);
      await s.page.evaluate(t => document.documentElement.setAttribute("data-theme", t), scheme === "light" ? "dark" : "light");
      const b = await tokensNow(s.page);
      if (JSON.stringify(a) === JSON.stringify(b)) fail(id, "contrast", `the light and dark themes have the same colours (${attr})`);
    } catch (e) { fail(id, "contrast", errText(e)); }
    await s.close();
  }
  return rows;
}

/* Layout: the title and every sheet, at 360 and 1280. */
async function checkSheets(page, spec, width) {
  const id = spec.id;
  try {
    const st = await read(page);
    if (st.overflow > 0) fail(id, "layout", `horizontal scroll (${st.overflow}px) on the title screen at ${width}px`);
    const keys = [["h", "help"], ["n", "notes"], ["c", "card"], ["v", "verify"]];
    for (const [k, name] of keys) {
      await page.keyboard.press(k);
      if (name === "verify") await page.waitForSelector("#body-verify .ec", { timeout: 60000 });
      const r = await page.evaluate(name => {
        const de = document.documentElement, p = document.querySelector(`#sheet-${name} .sheet-panel`), b = document.querySelector(`#sheet-${name} .sheet-body`);
        return { page: de.scrollWidth - de.clientWidth, panel: p.scrollWidth - p.clientWidth, body: b.scrollWidth - b.clientWidth };
      }, name);
      if (r.page > 0 || r.panel > 0 || r.body > 0) fail(id, "layout", `the ${name} sheet scrolls sideways at ${width}px (page ${r.page}, panel ${r.panel}, body ${r.body})`);
      await page.keyboard.press("Escape");
    }
    await page.click("#setBtn");
    const r = await page.evaluate(() => { const de = document.documentElement, p = document.querySelector("#sheet-settings .sheet-panel"); return { page: de.scrollWidth - de.clientWidth, panel: p.scrollWidth - p.clientWidth }; });
    if (r.page > 0 || r.panel > 0) fail(id, "layout", `the settings sheet scrolls sideways at ${width}px (page ${r.page}, panel ${r.panel})`);
    await page.keyboard.press("Escape");
  } catch (e) { fail(id, "layout", `${width}px: ${errText(e)}`); }
}

/* ---------------------------------------------------------------------------
   Route sessions
   ------------------------------------------------------------------------- */
const forceOf = route => route.steps.filter(s => s.opt != null && s.result != null).map(s => s.result);
const queryOf = route => { const f = forceOf(route); return "seed=1" + (f.length ? "&force=" + f.join(",") : ""); };
const stepsOf = route => route.steps.map(s => s.opt != null ? s.opt + (s.result ? "=" + s.result : "") : "(typed)").join(" > ");

// The ending is read from the page (#app[data-ending] and the ending panel's data-ending), never from storage.
async function checkEnding(spec, route, st, label) {
  const want = route.ending;
  const wantTitle = spec.pack.script.endings[want].title;
  if (st.endTitle !== wantTitle) { fail(spec.id, "routes", `${label}: ended on "${st.endTitle}", not "${wantTitle}" (${want})`); return false; }
  if (st.ending !== want) { fail(spec.id, "routes", `${label}: #app[data-ending] is ${JSON.stringify(st.ending)}, not "${want}"`); return false; }
  if (st.endingPanel !== want) { fail(spec.id, "routes", `${label}: the ending panel's data-ending is ${JSON.stringify(st.endingPanel)}, not "${want}"`); return false; }
  return true;
}

async function routeTask(spec, route, idx, wide) {
  const s = await session(spec, { width: wide ? 1280 : 360, height: wide ? 800 : 740, tag: `route ${idx}${wide ? " @1280" : ""}` });
  const label = `route ${idx} [${stepsOf(route).slice(0, 90)}]`;
  try {
    await s.page.goto(URL_OF(spec, queryOf(route)));
    const { st } = await walk(s.page, spec, route, {
      checkMotion: true, checkWidth: wide ? 1280 : 360,
      onState: st => hooks(s.page, spec, st),
    });
    await checkEnding(spec, route, st, label);
    if (wide) await linger(s.page);
  } catch (e) { fail(spec.id, "routes", `${label}: ${errText(e)}`); }
  await s.close();
}

// Chip and commentary checks run once per pack (and per kind of place), inside whichever route meets them first.
async function hooks(page, spec, st) {
  const claim = k => { if (spec.claims.has(k)) return false; spec.claims.add(k); return true; };
  if (st.track && spec.pack.commentary && claim("commentary")) await checkCommentary(page, spec);
  for (const id of st.chips) {
    if (!spec.pack.notes[id]) { fail(spec.id, "chips", `a chip names "${id}", which is not in notes.json`); continue; }
    if (claim("chip:" + id + ":" + st.node)) { spec.chipsTested.add(id); await checkChip(page, spec, id, st.node); }
  }
}

/* Variants on the shortest route: storage that throws, storage with garbage, Calm, full motion. */
async function variantTask(spec, kind) {
  // A forced run never writes the save, so the garbage record can only be replaced by play on a route that needs no ?force=.
  const route = kind === "storage-garbage" && spec.shortestFree ? spec.shortestFree : spec.shortest;
  const key = spec.pack.storageKey;
  const o = { tag: kind };
  if (kind === "storage-getter") o.init = () => { Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } }); };
  if (kind === "storage-methods") o.init = () => { for (const m of ["getItem", "setItem", "removeItem", "clear", "key"]) Storage.prototype[m] = function () { throw new DOMException("full", "QuotaExceededError"); }; };
  if (kind === "storage-garbage") {
    o.init = k => { try { localStorage.setItem(k, "{{not json"); } catch (e) {} };
    o.initArg = key;
  }
  if (kind === "full-motion") { o.reduced = false; o.timeout = 15000; }
  if (kind === "calm") { o.reduced = false; }
  const s = await session(spec, o);
  const label = `${kind}: route [${stepsOf(route).slice(0, 80)}]`;
  try {
    await s.page.goto(URL_OF(spec, queryOf(route)));
    if (kind === "calm") {
      await setSetting(s.page, "motion", "calm");
      const m = await s.page.evaluate(() => document.documentElement.dataset.motion);
      if (m !== "calm") fail(spec.id, "calm", `Settings > Calm left data-motion="${m}"`);
    }
    const { st } = await walk(s.page, spec, route, {
      wait: kind !== "full-motion",
      checkMotion: kind === "calm",
      checkWidth: kind === "full-motion" ? 0 : 360, // a slide still sliding in is wider than the window for a moment
    });
    const ok = await checkEnding(spec, route, st, label);
    const check = kind === "calm" ? "calm" : kind === "full-motion" ? "motion" : "storage";
    if (!ok) fail(spec.id, check, `${label}: did not reach its ending`);
    if (kind === "storage-garbage") {
      // The garbage must be replaced by a good record as play goes on, or at least ignored.
      if (forceOf(route).length) { await setSetting(s.page, "speed", "fast"); await s.page.waitForTimeout(50); } // a forced run still saves settings
      const rec = await s.page.evaluate(k => localStorage.getItem(k), key);
      if (rec === "{{not json") fail(spec.id, "storage", "the page never replaced a garbage record");
    }
    if (kind === "storage-getter" || kind === "storage-methods") {
      const title = await s.page.evaluate(() => document.querySelector(".brand-sub").textContent);
      if (!/Endings found 1 of/.test(title)) fail(spec.id, "storage", `with storage blocked, the top bar says "${title}" at the end instead of counting the ending found`);
    }
  } catch (e) {
    fail(spec.id, kind === "calm" ? "calm" : kind === "full-motion" ? "motion" : "storage", `${label}: ${errText(e)}`);
  }
  await linger(s.page);
  await s.close();
}

/* Starting the story: ten Enter and Space presses at the title begin it once; Play again from the ending still begins it.
   While it runs, the kit's update(state) calls are logged: the last one, at the ending, has state.ended; none before it has. */
async function beginTask(spec) {
  const route = spec.shortest;
  const s = await session(spec, { reduced: false, timeout: 15000, tag: "begin" });
  const label = `begin: route [${stepsOf(route).slice(0, 80)}]`;
  const begins = () => s.page.evaluate(() => window.__begins);
  try {
    await s.page.goto(URL_OF(spec, queryOf(route)));
    await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
    await s.page.evaluate(() => {
      window.__begins = 0; window.__ended = [];
      const o = Stage.create; Stage.create = function () { window.__begins++; return o.apply(this, arguments); };
      const k = window.StageKit.kits[window.PACK.kit];
      if (k && typeof k.update === "function") { const u = k.update; k.update = function (st) { window.__ended.push(!!(st && st.ended)); return u.apply(this, arguments); }; }
    });
    for (let i = 0; i < 10; i++) { await s.page.keyboard.press(i % 2 ? "Space" : "Enter"); await s.page.waitForTimeout(30); }
    await s.page.waitForTimeout(400);
    const n = await begins();
    if (n !== 1) fail(spec.id, "begin", `Enter and Space pressed ten times at the title began the story ${n} times, not once`);
    const { st } = await walk(s.page, spec, route, { wait: false, checkWidth: 0 });
    if (!await checkEnding(spec, route, st, label)) fail(spec.id, "begin", `${label}: did not reach its ending`);
    const ended = await s.page.evaluate(() => window.__ended);
    if (ended.length) {
      const first = ended.indexOf(true);
      if (first < 0 || ended.slice(first).includes(false) || first === 0) fail(spec.id, "begin", `the kit's update(state) saw state.ended as [${ended.map(x => x ? "T" : "F").join("")}]; it must be false until the ending and true from the ending on`);
    }
    // Play again: it must start a second story, once, even if keys arrive while it starts.
    await s.page.click('#slides .sl:not(.out) [data-act="again"]');
    for (let i = 0; i < 4; i++) { await s.page.keyboard.press("Enter"); await s.page.waitForTimeout(20); }
    await s.page.waitForFunction(() => { const a = document.getElementById("app"); return a.dataset.busy === "0" && a.dataset.node && a.dataset.node !== "ending"; }, null, { timeout: 15000 });
    const m = await begins();
    if (m !== 2) fail(spec.id, "begin", `Play again began the story ${m - 1} times, not once`);
    const gone = await s.page.evaluate(() => document.getElementById("app").dataset.ending);
    if (gone != null) fail(spec.id, "begin", `#app[data-ending] is still "${gone}" after Play again`);
    await linger(s.page);
  } catch (e) { fail(spec.id, "begin", `${label}: ${errText(e)}`); }
  await s.close();
}

/* Continue and Back, on an unforced run. The run stops at a choice before any roll, the page reloads, Continue brings back the
   same node, and Back once either moves or (where the engine forbids it) leaves the page as it was. */
async function continueTask(spec) {
  const route = spec.longest, steps = route.steps;
  let lead = 0;
  while (lead < steps.length && steps[lead].result == null && lead < 2) lead++; // picks that cannot roll
  const s = await session(spec, { tag: "continue" });
  const label = `continue: stop after ${lead} pick(s) of route [${stepsOf(route).slice(0, 80)}]`;
  try {
    await s.page.goto(URL_OF(spec)); // no ?seed and no ?force: those switch Continue off
    await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
    const { st: before, stopped } = await walk(s.page, spec, route, { stop: (st, picks) => picks === lead && (st.node === "choice" || st.node === "input") });
    if (!stopped) throw new Error("the route ended before the stop");
    await s.harvest();
    await s.page.reload();
    await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
    if (!await s.page.$("#contBtn")) { fail(spec.id, "continue", `${label}: no Continue button after a reload`); await s.close(); return; }
    await s.page.click("#contBtn");
    await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "play");
    const after = await read(s.page);
    if (after.node !== before.node || after.sig !== before.sig) fail(spec.id, "continue", `${label}: Continue came back to ${describe(after)}, not ${describe(before)}`);
    // Back once.
    const wasOff = after.backOff;
    await s.page.evaluate(() => document.getElementById("backBtn").click());
    await s.page.waitForTimeout(60);
    const back = await read(s.page);
    const moved = back.node !== after.node || back.sig !== after.sig || back.phase !== after.phase;
    if (!wasOff && !moved) fail(spec.id, "continue", `${label}: Back was on, and pressing it changed nothing`);
    if (wasOff && moved) fail(spec.id, "continue", `${label}: Back was off, and pressing it moved the story`);
    if (!back.phase || back.phase === "title") fail(spec.id, "continue", `${label}: Back left the story (phase ${back.phase})`);
  } catch (e) { fail(spec.id, "continue", `${label}: ${errText(e)}`); }
  await s.close();
}

/* ?force= and ?seed= edge cases. A forced run never writes the save or the found endings. */
async function forceTask(spec) {
  const id = spec.id, key = spec.pack.storageKey;
  const foot = page => page.evaluate(() => document.getElementById("foot").textContent);
  const title = page => page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
  const record = page => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, key);
  // 1. The footers say how the run was set; a token that is not a tier is ignored and shown, not warned about.
  {
    const s = await session(spec, { tag: "params" });
    try {
      await s.page.goto(URL_OF(spec, "force=sucess,bogus")); await title(s.page);
      let f = await foot(s.page);
      if (!f.includes("ignored in ?force: sucess, bogus")) fail(id, "force", `?force=sucess,bogus: the footer says "${f}", not that both tokens were ignored`);
      if (/set by/.test(f)) fail(id, "force", `?force=sucess,bogus fixed the run (footer "${f}") though no valid tier was left`);
      if (await s.page.$("#contBtn")) fail(id, "force", "?force=sucess,bogus switched Continue on or off oddly");
      await s.page.goto(URL_OF(spec, "force=fail,nope")); await title(s.page);
      f = await foot(s.page);
      if (!f.includes("(set by ?seed or ?force)") || !f.includes("ignored in ?force: nope")) fail(id, "force", `?force=fail,nope: the footer says "${f}"`);
      await s.page.goto(URL_OF(spec, "seed=5")); await title(s.page);
      f = await foot(s.page);
      if (!f.includes("Seed 5 (set by ?seed)")) fail(id, "force", `?seed=5: the footer says "${f}"`);
      await s.page.goto(URL_OF(spec, "seed=3&force=fail")); await title(s.page);
      f = await foot(s.page);
      if (!f.includes("Seed 3 (set by ?seed or ?force)")) fail(id, "force", `?seed=3&force=fail: the title footer says "${f}"`);
      await s.page.keyboard.press("Enter");
      await s.page.waitForFunction(() => document.getElementById("app").dataset.busy === "0" && document.getElementById("app").dataset.node);
      f = await foot(s.page);
      if (!f.includes("?seed=3&force=fail repeats this run")) fail(id, "force", `?seed=3&force=fail: the play footer says "${f}", not "?seed=3&force=fail repeats this run"`);
    } catch (e) { fail(id, "force", errText(e)); }
    await s.close();
  }
  // 2. A forced run to a roll and on to its ending leaves no save and no found ending, and a normal visit offers no Continue.
  const route = spec.sim.routes.find(r => r.steps.some(x => x.result != null));
  if (!route) { notes.push(`${id}: no route has a roll, so the ?force= leak check was not run`); return; }
  const s = await session(spec, { tag: "force leak" });
  const q = queryOf(route);
  const leak = async where => {
    const rec = await record(s.page);
    if (rec && rec.save) fail(id, "force", `${where}: a forced run wrote a save to storage`);
    if (rec && rec.found && rec.found.length) fail(id, "force", `${where}: a forced run wrote found endings ${JSON.stringify(rec.found)} to storage`);
  };
  const plain = async where => {
    await s.page.goto(URL_OF(spec)); await title(s.page);
    if (await s.page.$("#contBtn")) fail(id, "force", `${where}: a normal visit offers Continue after a forced run`);
    const sub = await s.page.evaluate(() => document.querySelector(".brand-sub").textContent);
    if (!/Endings found 0 of/.test(sub)) fail(id, "force", `${where}: a normal visit says "${sub}" after a forced run`);
  };
  try {
    await s.page.goto(URL_OF(spec, q)); await title(s.page);
    await walk(s.page, spec, route, { stop: st => st.node === "roll" });
    const f = await foot(s.page);
    if (!f.includes("&force=" + forceOf(route).join(",") + " repeats this run")) fail(id, "force", `the play footer says "${f}", which does not give the forced tiers`);
    await leak("at the roll");
    await plain("after the roll");
    await s.page.goto(URL_OF(spec, q)); await title(s.page);
    const { st } = await walk(s.page, spec, route);
    await checkEnding(spec, route, st, "forced route");
    await leak("at the ending");
    await plain("after the ending");
  } catch (e) { fail(id, "force", errText(e)); }
  await s.close();
}

/* Text contrast as rendered. Runs inside the page: walks the visible text, composites its colour with the opacity chain over the
   background it sits on, and measures. Colours go through a canvas, because color-mix() computes to color(srgb ...). */
function SAMPLEFN() {
  const out = [];
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const parse = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest(".sr-only, script, style, noscript, [hidden], [inert], .out")) continue;
    if (el.closest("[disabled], [aria-disabled='true']")) continue; // a disabled control is exempt (WCAG 1.4.3)
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    let op = 1, gone = false, img = false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      op *= Number(s.opacity);
      if (s.display === "none") gone = true;
      if (s.backgroundImage !== "none" && e !== document.documentElement) img = true;
    }
    if (gone || op === 0) continue;
    const stack = [];
    for (let e = el; e; e = e.parentElement) { const bg = parse(getComputedStyle(e).backgroundColor); if (bg.a > 0) stack.push(bg); if (bg.a === 1) break; }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    if (!stack.length || stack[stack.length - 1].a < 1) { const root = parse(getComputedStyle(document.body).backgroundColor); if (root.a) bg = over(root, bg); }
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
    let fg = parse(cs.color); fg.a *= op; fg = over(fg, bg);
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), big = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = big ? 3 : 4.5;
    if (ratio < need) out.push({ sel: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : ""), ratio: +ratio.toFixed(2), need, op: +op.toFixed(2), img, txt: n.textContent.trim().replace(/\s+/g, " ").slice(0, 30) });
  }
  return out;
}
async function textContrastTask(spec, scheme, width) {
  const id = spec.id, route = spec.longest;
  const s = await session(spec, { colorScheme: scheme, width, height: width === 360 ? 740 : 800, tag: `text contrast ${scheme} @${width}` });
  const seen = new Set();
  const said = new Set(); // one report per text and element, from the first stop that shows it
  const sample = async where => {
    for (const x of await s.page.evaluate(SAMPLEFN)) {
      if (said.has(x.sel + "\u0000" + x.txt)) continue;
      said.add(x.sel + "\u0000" + x.txt);
      fail(id, "contrast", `${scheme} @${width}, ${where}: "${x.txt}" (${x.sel}) is ${x.ratio}:1, needs ${x.need}:1${x.op < 1 ? ` (opacity ${x.op})` : ""}${x.img ? " (over an image)" : ""}`);
    }
  };
  try {
    await s.page.goto(URL_OF(spec, queryOf(route)));
    await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
    await sample("the title");
    for (const [k, name] of [["h", "help"], ["n", "notes"], ["c", "card"], ["v", "verify"]]) {
      await s.page.keyboard.press(k);
      if (name === "verify") await s.page.waitForSelector("#body-verify .ec", { timeout: 60000 });
      await sample(`the ${name} sheet`);
      await s.page.keyboard.press("Escape");
    }
    await s.page.click("#setBtn"); await sample("the settings sheet"); await s.page.keyboard.press("Escape"); await letGo(s.page);
    await walk(s.page, spec, route, {
      onState: async st => {
        const kind = [st.phase, st.node, st.track ? "track" : "", st.chips.length ? "chips" : "", st.secretHidden ? "secret" : "", st.locked ? "locked" : ""].filter(Boolean).join(" ");
        if (!seen.has(kind)) { seen.add(kind); await sample(kind); }
      },
    });
    await s.page.keyboard.press("n"); await sample("the notes sheet at the ending"); await s.page.keyboard.press("Escape");
  } catch (e) { fail(id, "contrast", `${scheme} @${width}: ${errText(e)}`); }
  await s.close();
}


/* ---------------------------------------------------------------------------
   Phone layouts (wave 3). Generic over packs; the same code runs in the Fort and in HTLL.
   One session each, reused for every size: setViewportSize, then a fresh load with the route's ?seed and ?force.
   ------------------------------------------------------------------------- */
const PHONES = [[360, 640], [390, 844], [412, 915]];
const SHORT_SCREENS = [[568, 320], [844, 390]];
const TINY = [320, 256];
async function openAt(s, spec, route, w, h) {
  await s.page.setViewportSize({ width: w, height: h });
  await s.page.goto(URL_OF(spec, queryOf(route)));
  await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
  await read(s.page); // settled
}
const atChoice = st => st.node === "choice" || st.node === "input";

// T1. A meter's name is never cut (the shell wraps it). Runs inside the page.
function CLIPPED_NAMES() {
  return [...document.querySelectorAll(".m-name")]
    .filter(n => n.getClientRects().length && n.scrollWidth > n.clientWidth)
    .map(n => ({ name: (n.textContent || "").trim().slice(0, 30), sw: n.scrollWidth, cw: n.clientWidth }));
}
async function phoneNamesTask(spec) {
  const route = spec.shortest;
  const s = await session(spec, { tag: "phone names" });
  try {
    for (const [w, h] of PHONES) {
      await openAt(s, spec, route, w, h);
      const seen = new Map();
      await walk(s.page, spec, route, {
        onState: async () => { for (const x of await s.page.evaluate(CLIPPED_NAMES)) if (!seen.has(x.name)) seen.set(x.name, x); },
      });
      for (const x of seen.values()) fail(spec.id, "phone", `${w}x${h}: the meter name "${x.name}" is clipped (scrollWidth ${x.sw} > clientWidth ${x.cw})`);
    }
  } catch (e) { fail(spec.id, "phone", `meter names: ${errText(e)}`); }
  await s.close();
}

// T2. Short and tiny screens. Runs inside the page.
function BEGIN_VISIBLE() {
  const b = document.querySelector("#slides .sl:not(.out) #beginBtn");
  if (!b) return { missing: true };
  const r = b.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const inside = r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= vh + 0.5 && r.right <= vw + 0.5;
  // Hit-test the centre and the middle of each edge, pulled in by 3 px (a rounded corner is not the button): a button under a panel's
  // edge, or clipped by it, fails.
  const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + r.height / 2], [r.right - 3, r.top + r.height / 2], [r.left + r.width / 2, r.top + 3], [r.left + r.width / 2, r.bottom - 3]];
  const blocked = pts.filter(([x, y]) => { const t = document.elementFromPoint(x, y); return !t || !b.contains(t); }).length;
  return { inside, blocked, top: Math.round(r.top), bottom: Math.round(r.bottom), vh, scrollY: Math.round(window.scrollY) };
}
function PANEL_HEIGHT() {
  const p = document.querySelector("#slides .sl:not(.out) .panel");
  if (!p) return null;
  return { h: Math.round(p.getBoundingClientRect().height * 10) / 10, content: p.scrollHeight };
}
async function REACHABLE() {
  const out = [];
  const els = document.querySelectorAll("#slides .sl:not(.out) :is(.opt, #inField, .in-form button)");
  for (const o of els) {
    o.scrollIntoView({ block: "center", inline: "nearest" });
    await new Promise(r => requestAnimationFrame(r));
    const r = o.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const t = document.elementFromPoint(x, y);
    const inView = x >= 0 && y >= 0 && x <= document.documentElement.clientWidth && y <= window.innerHeight;
    out.push({ label: (o.id ? "#" + o.id : (o.innerText || o.className || "?").replace(/\s+/g, " ").trim().slice(0, 30)), ok: inView && !!t && o.contains(t), inView, cover: t && !o.contains(t) ? t.tagName.toLowerCase() + (typeof t.className === "string" && t.className.trim() ? "." + t.className.trim().split(/\s+/).join(".") : "") : "" });
  }
  return out;
}
async function shortScreensTask(spec) {
  const route = spec.shortest;
  const s = await session(spec, { tag: "short screens" });
  try {
    for (const [w, h] of [...SHORT_SCREENS, TINY]) {
      const at = `${w}x${h}`, small = w < 568;
      await openAt(s, spec, route, w, h);
      if (!small) {
        const b = await s.page.evaluate(BEGIN_VISIBLE);
        if (b.missing) fail(spec.id, "phone", `${at}: no Begin button at the title`);
        else if (!b.inside || b.blocked) fail(spec.id, "phone", `${at}: the Begin button is not fully visible at the title without scrolling (top ${b.top}, bottom ${b.bottom} of ${b.vh}${b.blocked ? `; ${b.blocked} of 5 test points are covered` : ""})`);
      }
      const { st, stopped } = await walk(s.page, spec, route, { stop: atChoice });
      if (!stopped) { fail(spec.id, "phone", `${at}: the route reached its end with no choice or input`); continue; }
      if (!small) {
        const p = await s.page.evaluate(PANEL_HEIGHT);
        if (!p) fail(spec.id, "phone", `${at}: no panel at the first ${st.node}`);
        else if (p.h + 1 < Math.min(120, p.content)) fail(spec.id, "phone", `${at}: the first ${st.node} panel is ${p.h} px tall (its content is ${p.content} px); it needs at least 120 px`);
      } else {
        const list = await s.page.evaluate(REACHABLE);
        if (!list.length) fail(spec.id, "phone", `${at}: the first ${st.node} has nothing to reach`);
        for (const o of list) if (!o.ok) fail(spec.id, "phone", `${at}: "${o.label}" at the first ${st.node} cannot be hit after scrolling it to the middle of the screen (${o.inView ? "covered by " + o.cover : "centre is outside the window"})`);
      }
    }
  } catch (e) { fail(spec.id, "phone", `short screens: ${errText(e)}`); }
  await s.close();
}

// T3. Every focusable thing in the kit can be tapped where it is. A pull-tab under the text panel fails here. Runs inside the page.
function KIT_FOCUS() {
  const host = document.getElementById("kit");
  const out = { n: 0, bad: [] };
  if (!host) return out;
  const prior = document.activeElement;
  const nameOf = n => n.tagName.toLowerCase() + (typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\s+/).join(".") : "");
  for (const el of host.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')) {
    if (el.disabled || el.closest("[hidden], [inert]") || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    el.focus({ preventScroll: true });
    out.n++;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const t = document.elementFromPoint(x, y);
    if (document.activeElement !== el) out.bad.push(`${nameOf(el)} "${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 20)}" could not be focused`);
    else if (!t) out.bad.push(`${nameOf(el)} "${el.getAttribute("aria-label") || ""}" has its centre (${Math.round(x)},${Math.round(y)}) outside the window`);
    else if (!el.contains(t)) out.bad.push(`${nameOf(el)} "${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 20)}" is covered at its centre by ${nameOf(t)}`);
    el.blur();
  }
  if (prior && prior !== document.body && document.contains(prior)) prior.focus({ preventScroll: true }); else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  return out;
}
async function kitFocusTask(spec) {
  const route = spec.longest;
  const s = await session(spec, { tag: "kit focus" });
  try {
    await openAt(s, spec, route, 360, 640);
    const said = new Set();
    spec.kitFocus = 0;
    await walk(s.page, spec, route, {
      onState: async st => {
        const r = await s.page.evaluate(KIT_FOCUS);
        spec.kitFocus += r.n;
        for (const b of r.bad) if (!said.has(b)) { said.add(b); fail(spec.id, "phone", `360x640, at a ${st.node || st.phase}: ${b}`); }
      },
    });
  } catch (e) { fail(spec.id, "phone", `kit focus: ${errText(e)}`); }
  await s.close();
}

// T4. The shortcuts setting is honoured (WCAG 2.1.4).
async function shortcutsTask(spec) {
  const s = await session(spec, { tag: "shortcuts" });
  const p = s.page;
  const state = () => p.evaluate(() => ({ auto: document.getElementById("autoBtn").getAttribute("aria-pressed"), sheets: [...document.querySelectorAll(".sheet")].filter(x => !x.hidden).map(x => x.id), live: document.getElementById("live").textContent }));
  try {
    await p.goto(URL_OF(spec, "seed=1"));
    await p.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
    const base = await state();
    if (base.auto !== "false") fail(spec.id, "shortcuts", `AUTO starts as aria-pressed="${base.auto}", not "false"`);
    await setSetting(p, "shortcuts", "off");
    const off0 = await state();
    for (const k of ["a", "n", "A", "N"]) {
      await p.keyboard.press(k);
      const now = await state();
      if (now.auto !== off0.auto) fail(spec.id, "shortcuts", `with Keyboard shortcuts Off, pressing "${k}" changed AUTO (${off0.auto} to ${now.auto})`);
      if (now.sheets.length) fail(spec.id, "shortcuts", `with Keyboard shortcuts Off, pressing "${k}" opened ${now.sheets.join(", ")}`);
      if (now.sheets.length) await p.keyboard.press("Escape");
    }
    // Esc and the arrows are not letter keys: the page still takes them (Esc is tested through the settings sheet below).
    await setSetting(p, "shortcuts", "on");
    await p.keyboard.press("a");
    const on1 = await state();
    if (on1.auto !== "true") fail(spec.id, "shortcuts", `with Keyboard shortcuts On, pressing "a" left AUTO at aria-pressed="${on1.auto}", not "true"`);
    await p.keyboard.press("a");
    const on2 = await state();
    if (on2.auto !== "false") fail(spec.id, "shortcuts", `with Keyboard shortcuts On, pressing "a" twice left AUTO at aria-pressed="${on2.auto}", not "false"`);
    await p.keyboard.press("n");
    const on3 = await state();
    if (!on3.sheets.includes("sheet-notes")) fail(spec.id, "shortcuts", `with Keyboard shortcuts On, pressing "n" did not open the Notes sheet`);
    await p.keyboard.press("Escape");
  } catch (e) { fail(spec.id, "shortcuts", errText(e)); }
  await linger(p);
  await s.close();
}

// T5. Verify uses the result the build embedded (window.SIM), so it opens at once. Time: key press to a painted route list, in the page.
async function verifySpeedTask(spec) {
  const s = await session(spec, { tag: "verify speed" });
  const p = s.page;
  try {
    await p.goto(URL_OF(spec, "seed=1"));
    await p.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
    const has = await p.evaluate(() => !!(window.SIM && window.SIM.routes && window.SIM.routes.length));
    if (!has) fail(spec.id, "verify", "the page carries no window.SIM, so Verify must walk the story itself (the build embeds Stage.simulate's result)");
    let best = Infinity, rows = 0;
    for (let k = 0; k < 3 && best >= 300; k++) { // a loaded machine may slow one try; the best of up to three counts
      const r = await p.evaluate(async () => {
        const t0 = performance.now();
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
        const frame = () => new Promise(r => requestAnimationFrame(r));
        while (!document.querySelector("#body-verify .route") && performance.now() - t0 < 3000) await frame(); // (a page without window.SIM walks the story first)
        await frame(); await frame(); // two frames: painted
        return { ms: performance.now() - t0, rows: document.querySelectorAll("#body-verify .route").length, open: !document.getElementById("sheet-verify").hidden };
      });
      if (!r.open) { fail(spec.id, "verify", "the v key did not open the Verify sheet"); break; }
      rows = r.rows;
      best = Math.min(best, r.ms);
      await p.keyboard.press("Escape"); await letGo(p);
    }
    if (best < Infinity && !rows) fail(spec.id, "verify", "the Verify sheet opened with no route list");
    else if (best >= 300) fail(spec.id, "verify", `the Verify sheet took ${Math.round(best)} ms to show its route list (limit 300 ms)`);
    spec.verifyMs = Math.round(best);
  } catch (e) { fail(spec.id, "verify", errText(e)); }
  await s.close();
}

/* The page-level task: layout, verify, contrast, shots. */
async function pageTask(spec) {
  for (const width of [360, 1280]) {
    const s = await session(spec, { width, height: width === 360 ? 740 : 800, tag: `title @${width}` });
    try {
      await s.page.goto(URL_OF(spec, "seed=1"));
      await s.page.waitForFunction(() => document.getElementById("app").dataset.phase === "title");
      await checkSheets(s.page, spec, width);
      if (width === 360) {
        await checkVerify(s.page, spec);
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await s.page.keyboard.press("Escape"); await s.page.screenshot({ path: path.join(SHOTS, `${spec.id}-title.png`) }); }
      }
    } catch (e) { fail(spec.id, "layout", `${width}px: ${errText(e)}`); }
    await s.close();
  }
  await checkContrast(spec);
}

/* ---------------------------------------------------------------------------
   Prelude: find the pages, check each against its sources, plan the work
   ------------------------------------------------------------------------- */
if (!fs.existsSync(DIST)) { console.log("FAIL: no dist/ folder beside test.mjs. Build the packs first (node stage/tools/build.mjs stage/packs/<id>)"); process.exit(1); }
const files = fs.readdirSync(DIST).filter(f => f.endsWith(".html")).sort().filter(f => !ONLY.length || ONLY.includes(f.replace(/\.html$/, "")));
if (!files.length) { console.log("FAIL: no built page in dist/"); process.exit(1); }

console.log(`The Stage test: ${files.length} page(s) in ${path.relative(process.cwd(), DIST) || "."}; ${JOBS} at a time${SAMPLE ? `; SAMPLE=${SAMPLE} routes per pack` : ""}`);
console.log(FORBIDDEN.problems.length ? `forbidden names: FAILED to load (${FORBIDDEN.problems.length} problem(s), listed per pack below)`
  : FORBIDDEN.list ? `forbidden names: ${FORBIDDEN.list.length} pattern(s) from ${FORBIDDEN.from.join(" and ")} (Halcyon may be named)` : "forbidden names: SKIPPED (no ../intro/test.mjs beside stage/)");

// A pack with no built page is not tested. Say so, loudly, unless the run was narrowed with ONLY.
const unbuilt = [];
if (!ONLY.length && fs.existsSync(PACKS)) {
  for (const d of fs.readdirSync(PACKS).sort()) {
    if (fs.existsSync(path.join(PACKS, d, "pack.json")) && !fs.existsSync(path.join(DIST, d + ".html"))) unbuilt.push(d);
  }
  for (const d of unbuilt) console.log(`WARNING: packs/${d}/ has no dist/${d}.html, so it is NOT tested. Build it: node tools/build.mjs packs/${d}`);
}

const specs = [];
for (const f of files) {
  const file = path.join(DIST, f);
  const html = fs.readFileSync(file, "utf8");
  const stem = f.replace(/\.html$/, "");
  const net = networkScan(html);
  // Read the pack the page carries.
  let carried, assets;
  {
    const s = await session({ id: stem, file }, { tag: "prelude" });
    try {
      await s.page.goto(pathToFileURL(file).href);
      ({ carried, assets } = await s.page.evaluate(() => ({ carried: JSON.parse(JSON.stringify(window.PACK)), assets: window.ASSETS || {} })));
    } catch (e) { fail(stem, "build", `cannot open ${f}: ${errText(e)}`); }
    await s.close();
  }
  if (!carried) continue;
  const id = carried.id;
  for (const u of net) fail(id, "network", `network reference in the HTML: ${u}`);
  const packDir = path.join(PACKS, id);
  if (!fs.existsSync(path.join(packDir, "pack.json"))) { fail(id, "build", `dist/${f} carries pack "${id}" but packs/${id}/ does not exist`); continue; }
  const loaded = loadAll(packDir);
  const pack = JSON.parse(JSON.stringify(loaded.pack));
  let stale = false;
  const staleMsg = what => { stale = true; fail(id, "build", `dist/${f} is stale: ${what}. Run node tools/build.mjs packs/${id}`); };
  try { assert.deepStrictEqual(carried, pack); } catch (e) { staleMsg(`it does not match packs/${id}/`); }
  // Art: the page's assets are the pack's art/ files, byte for byte. Fonts: each font file is in the page's CSS, and no other face is.
  {
    const have = new Set(Object.keys(assets)), want = new Set(Object.keys(loaded.assets));
    const missing = [...want].filter(k => !have.has(k)), extra = [...have].filter(k => !want.has(k)), changed = [...want].filter(k => have.has(k) && assets[k] !== loaded.assets[k]);
    if (missing.length || extra.length || changed.length) staleMsg(`its art differs from packs/${id}/art (${[missing.length ? "missing " + missing.slice(0, 3).join(", ") : "", extra.length ? "not in the pack: " + extra.slice(0, 3).join(", ") : "", changed.length ? "changed: " + changed.slice(0, 3).join(", ") : ""].filter(Boolean).join("; ")})`);
    const faces = ((pack.theme && pack.theme.fonts) || []);
    for (const ft of faces) if (loaded.fonts[ft.file] == null || !html.includes(loaded.fonts[ft.file])) staleMsg(`its CSS does not hold the font file ${ft.file}`);
    const nFaces = (html.match(/@font-face\s*\{/g) || []).length;
    if (nFaces !== faces.length) staleMsg(`it has ${nFaces} @font-face rule(s) and the theme lists ${faces.length}`);
  }
  const src = p => fs.readFileSync(path.join(HERE, p), "utf8");
  for (const p of ["engine/stage.js", "ui/view.js", `ui/kits/${pack.kit}.js`, "ui/style.css"]) {
    if (!fs.existsSync(path.join(HERE, p))) { fail(id, "build", `${p} is missing`); continue; }
    const text = p.endsWith(".css") ? src(p).replace(/<\/style/gi, "<\\/style") : safe(src(p));
    if (!html.includes(text)) staleMsg(`it does not contain the current ${p}`);
  }
  // The shell's page: every fixed stretch of ui/index.html (the text between the build's markers) is in the page.
  if (fs.existsSync(path.join(HERE, "ui", "index.html"))) {
    for (const chunk of src("ui/index.html").split(/<!-- @\w+ -->|\{\{title\}\}/)) if (chunk.trim() && !html.includes(chunk)) { staleMsg("it does not contain the current ui/index.html"); break; }
  }
  // A forbidden-name list that did not load fails the check; it is never skipped without a word.
  for (const pr of FORBIDDEN.problems) fail(id, "names", pr);
  // HTLL: no emoji in the pack's strings (the house rule). The Fort's packs may use the glyphs the shell itself uses.
  if (!FORT_LAYOUT) {
    // Emoji by default (Emoji_Presentation), by selector (U+FE0F, joiner) or in the pictograph planes. Text glyphs such as ★ © → are not emoji.
    const emoji = /\p{Emoji_Presentation}|[\uFE0F\u200D]|[\u{1F000}-\u{1FAFF}]/u;
    for (const t of stringsOf(pack)) { const m = t.match(emoji); if (m) fail(id, "emoji", `emoji ${JSON.stringify(m[0])} (U+${m[0].codePointAt(0).toString(16).toUpperCase()}) in: ${t.replace(/\s+/g, " ").slice(0, 100)}`); }
  }
  // Forbidden names, in the pack's text and in its SVG art.
  if (FORBIDDEN.list) {
    const texts = stringsOf(pack);
    for (const [name, uri] of Object.entries(assets)) {
      const m = String(uri).match(/^data:image\/svg\+xml;base64,(.*)$/);
      if (m) texts.push(Buffer.from(m[1], "base64").toString("utf8"));
    }
    for (const { re, mid } of FORBIDDEN.list) {
      for (const t of texts) {
        for (const m of t.matchAll(re)) {
          if (mid && !/[^\s.!?:;"“”‘’'()—-]\s+$/.test(t.slice(0, m.index))) continue; // opens a sentence or a line
          fail(id, "names", `forbidden text "${m[0]}" (${re.source.slice(0, 40)}) in: ${t.replace(/\s+/g, " ").slice(0, 100)}`);
          break;
        }
      }
    }
  }
  if (stale) continue; // the page would play a different story than the one the routes come from
  const sim = Stage.simulate(pack);
  const check = Stage.check(pack);
  if (check.errors && check.errors.length) fail(id, "build", `the pack does not validate: ${check.errors[0]}`);
  // Which routes to play.
  let routes = sim.routes.map((r, i) => ({ ...r, i }));
  if (SAMPLE && routes.length > SAMPLE) {
    const pick = new Map();
    for (const r of routes) if (!pick.has(r.ending) && pick.size < SAMPLE) pick.set(r.ending, r);
    for (let k = 0; pick.size < SAMPLE && k < SAMPLE * 4; k++) { const r = routes[Math.floor((k * routes.length) / SAMPLE) % routes.length]; pick.set("#" + r.i, r); }
    for (let k = 0; pick.size < SAMPLE; k++) pick.set("#" + routes[k].i, routes[k]);
    routes = [...pick.values()];
  }
  const byLen = [...sim.routes].sort((a, b) => a.steps.length - b.steps.length);
  specs.push({ id, file, pack, sim, routes, shortest: byLen[0], shortestFree: byLen.find(r => !r.steps.some(x => x.result != null)), longest: byLen[byLen.length - 1],
    claims: new Set(), chipsTested: new Set(), done: 0, total: 0, t0: Date.now(), failedBefore: 0 });
  for (const e of Object.keys(sim.endings)) if (!sim.endings[e]) fail(id, "routes", `ending "${e}" is never reached by Stage.simulate`);
}

// Notes that a chip can show: every `notes` array in the script.
function chipNotes(pack) {
  const ids = new Set();
  const take = a => { for (const n of a || []) ids.add(n); };
  const beats = bs => { for (const b of bs || []) take(b.notes); };
  const sc = pack.script || {};
  for (const s of sc.scenes || []) {
    beats(s.beats);
    for (const g of s.choices || []) {
      take(g.notes);
      for (const o of g.options || []) {
        beats(o.then);
        for (const r of Object.values((o.roll && o.roll.results) || {})) beats(r.then);
      }
    }
  }
  for (const e of Object.values(sc.endings || {})) beats(e.beats);
  return ids;
}

/* ---------------------------------------------------------------------------
   The work, run in parallel
   ------------------------------------------------------------------------- */
const queue = [];
const add = (spec, name, fn) => { spec.total++; queue.push({ spec, name, fn }); };
for (const spec of specs) {
  // The first route of each pack runs first, so chip and commentary claims are made early; the long page task is spread out.
  add(spec, "page", () => pageTask(spec));
  const first = spec.longest;
  add(spec, "longest route at 1280", () => routeTask(spec, first, "longest", true));
  for (const kind of ["storage-getter", "storage-methods", "storage-garbage", "calm", "full-motion"]) add(spec, kind, () => variantTask(spec, kind));
  for (const scheme of ["light", "dark"]) for (const width of [360, 1280]) add(spec, `text contrast ${scheme} @${width}`, () => textContrastTask(spec, scheme, width));
  add(spec, "begin", () => beginTask(spec));
  add(spec, "continue", () => continueTask(spec));
  add(spec, "force", () => forceTask(spec));
  add(spec, "phone names", () => phoneNamesTask(spec));
  add(spec, "short screens", () => shortScreensTask(spec));
  add(spec, "kit focus", () => kitFocusTask(spec));
  add(spec, "shortcuts", () => shortcutsTask(spec));
  add(spec, "verify speed", () => verifySpeedTask(spec));
  for (const r of spec.routes) add(spec, "route", () => routeTask(spec, r, r.i, false));
}
function doneOne(spec) {
  spec.done++;
  if (spec.done === spec.total) {
    const mine = failures.filter(f => f.pack === spec.id);
    const sec = ((Date.now() - spec.t0) / 1000).toFixed(1);
    console.log(`${mine.length ? "FAIL" : "ok  "} ${spec.id}: ${spec.routes.length} of ${spec.sim.routes.length} routes, ${spec.total - spec.routes.length} page checks${mine.length ? `, ${mine.length} problem(s)` : ""} (${secs()} s elapsed)`);
  }
}
let next = 0;
async function worker() {
  while (next < queue.length) {
    const job = queue[next++];
    try { await job.fn(); } catch (e) { fail(job.spec.id, "routes", `${job.name}: ${errText(e)}`); }
    doneOne(job.spec);
  }
}
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, worker));
await browser.close();

/* Coverage of the chip check, and the verdict. */
for (const spec of specs) {
  const want = chipNotes(spec.pack);
  const unseen = [...want].filter(id => !spec.chipsTested.has(id));
  notes.push(`${spec.id}: chips tested for ${spec.chipsTested.size} of ${want.size} note ids${spec.pack.commentary ? `; commentary ${spec.claims.has("commentary") ? "tested" : "NOT TESTED (no track met)"}` : "; no commentary"}${unseen.length ? `; not met on the routes played: ${unseen.join(", ")}` : ""}`);
  notes.push(`${spec.id}: ${spec.kitFocus || 0} kit focus test(s) at 360x640; Verify opened in ${spec.verifyMs == null ? "?" : spec.verifyMs} ms`);
  if (spec.pack.commentary && !spec.claims.has("commentary") && !SAMPLE) fail(spec.id, "commentary", "no commentary track appeared on any route, so the toggle was not tested");
  if (unseen.length && !SAMPLE) fail(spec.id, "chips", `chips for these notes were never met on a route: ${unseen.join(", ")}`);
}
console.log("");
for (const d of unbuilt) console.log(`WARNING: packs/${d}/ has no dist/${d}.html, so it was NOT tested.`);
for (const n of notes) console.log(n);
if (failures.length) {
  console.log("");
  const by = {};
  for (const f of failures) (by[f.check] = by[f.check] || []).push(f);
  for (const [check, list] of Object.entries(by)) {
    console.log(`${check}: ${list.length} problem(s)`);
    for (const f of list.slice(0, 8)) console.log(`  ${f.pack}: ${f.msg}${f.n > 1 ? `  (x${f.n})` : ""}`);
    if (list.length > 8) console.log(`  ... and ${list.length - 8} more`);
  }
}
console.log(`\n${(Date.now() - T0) / 1000 | 0} s total`);
if (failures.length) {
  const by = {};
  for (const f of failures) by[f.check] = (by[f.check] || 0) + 1;
  console.log("FAIL: " + Object.entries(by).map(([c, n]) => `${c} (${n})`).join(", "));
  process.exit(1);
}
console.log("PASS");
