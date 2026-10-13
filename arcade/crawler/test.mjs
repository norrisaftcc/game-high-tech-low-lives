// The crawler: acceptance walk.
//   node crawler/test.mjs [dist files...]
// With no arguments it tests every built page in crawler/dist, plus the HTLL page if that checkout is next to this one.
// Environment: SEEDS=1,7 (default 1,7,42,2026)   VERBOSE=1 (print the last commands of a run that did not finish)
//
// For each built page, at 360 x 780:
//   1. it loads with zero console errors and page errors, no horizontal overflow, and window.CRAWL;
//   2. an explorer plays four seeds through window.CRAWL.step, with the commands a tap sends, and visits every area;
//   3. one short recorded path, replayed with real key presses on a fresh page, reaches the same state;
//   4. a reload restores the game; with localStorage blocked the game still plays;
//   5. for drowned-tower, the pinned facts of Module 2 appear on screen when their areas are entered.
// Uses the global Playwright install (no package.json needed).
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
let chromium;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright/index.js"]) {
  try { ({ chromium } = require(p)); break; } catch (e) { /* try next */ }
}
if (!chromium) {
  const { execSync } = await import("child_process");
  ({ chromium } = require(execSync("npm root -g").toString().trim() + "/playwright"));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(",").map(Number) : [1, 7, 42, 2026];
const VERBOSE = !!process.env.VERBOSE;
const MAX_COMMANDS = +process.env.MAXCMD || 12000;       // per seed; an explorer that needs more is lost
const HTLL_DIST = path.resolve(here, "../../game-high-tech-low-lives/arcade/crawler/dist/drowned-floors.html");

let files = process.argv.slice(2).map(f => path.resolve(f));
if (!files.length) {
  const dist = path.join(here, "dist");
  if (fs.existsSync(dist)) files = fs.readdirSync(dist).filter(f => f.endsWith(".html")).sort().map(f => path.join(dist, f));
  if (fs.existsSync(HTLL_DIST)) files.push(HTLL_DIST);
}
if (!files.length) { console.error("no built pages: run node crawler/tools/build.mjs <packdir> first"); process.exit(2); }

let browser;
try { browser = await chromium.launch(); }
catch (e) { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }

const fails = [];
const errs = [];
const fail = (page, msg) => { fails.push(`${page}: ${msg}`); console.log("  FAIL " + msg); };

async function open(file, query, { blocked = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  const label = path.basename(file);
  page.on("console", m => { if (["error", "warning"].includes(m.type())) errs.push(`${label}: ${m.type()}: ${m.text()}`); });
  page.on("pageerror", e => errs.push(`${label}: pageerror: ${String(e)}`));
  if (blocked) {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
    });
  }
  await page.goto(pathToFileURL(file).href + (query || ""));
  return { ctx, page };
}

/* ---------------------------------------------------------------------------
   The explorer. It runs inside the page, through window.CRAWL.step, and sends only
   commands a tap sends. It is written as one self-contained function so that
   Playwright can ship it to the page.
   ------------------------------------------------------------------------- */
function explorer(opts) {
  const process_debug = !!opts.debug;
  const C = window.CRAWL, P = C.pack, R = P.rules;
  const BUILTIN = { "#": "wall", ".": "floor", "+": "door", "=": "stuck", L: "locked", S: "secret", "<": "stairs", ">": "stairs", "~": "water" };
  const key = (x, y) => x + "," + y;
  const out = { n: 0, cmds: [], refused: [], overflow: [], text: {}, hubTrips: 0, fights: 0, outcome: null, desperate: false, trace: [], fightLog: [], order: [], ui: [] };

  // ---- map reading, the same rules as the engine ----
  const info = (m, x, y) => {
    const mp = P.maps[m], ch = mp.grid[y] && mp.grid[y][x];
    return ch === undefined ? null : Object.assign({ ch }, mp.legend && mp.legend[ch], mp.cells && mp.cells[key(x, y)]);
  };
  const kind = (s, m, x, y) => {
    const i = info(m, x, y);
    if (!i) return "wall";
    const k = i.wall ? "wall" : i.water ? "water" : BUILTIN[i.ch] || "floor";
    const st = s.doors[m] && s.doors[m][key(x, y)];
    if (k === "stuck" || k === "locked") return st === "open" ? "door" : k;
    if (k === "secret") return st ? "door" : "wall";
    return k === "floor" ? "open" : k;
  };
  const areaOf = (m, x, y) => { const i = info(m, x, y); return i ? i.area || null : null; };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  // ---- what a scene can lead to (static): an ending, the hub, a map ----
  const edgeCache = {};
  const gotos = x => {
    const found = [];
    const walk = o => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(walk);
      if (o.goto) found.push(o.goto);
      for (const k of Object.keys(o)) if (k !== "goto") walk(o[k]);
    };
    walk(x);
    return found;
  };
  const encGotos = id => { const e = P.encounters[id]; return e ? gotos([e.onWin, e.onFlee]).concat(e.after ? [{ scene: e.after }] : []) : []; };
  function closure(gs) {
    const r = { end: false, hub: false, map: false, enc: false, maps: [] }, seen = {}, todo = gs.slice();
    while (todo.length) {
      const g = todo.pop();
      if (g.ending) r.end = true;
      if (g.hub) r.hub = true;
      if (g.map) { r.map = true; r.maps.push(g); }
      if (g.encounter) { r.enc = true; todo.push(...encGotos(g.encounter)); }
      if (g.scene && !seen[g.scene]) {
        seen[g.scene] = 1;
        const def = P.events[g.scene];
        if (def) todo.push(...gotos(def.choices));
      }
    }
    return r;
  }
  const reachScene = id => edgeCache[id] || (edgeCache[id] = closure([{ scene: id }]));
  const choiceReach = def => closure(gotos(def));

  // ---- bookkeeping ----
  const allAreas = [];
  for (const [m, mp] of Object.entries(P.maps)) for (const a of Object.keys(mp.areas || {})) allAreas.push([m, a]);
  const seenAreas = () => allAreas.filter(([m, a]) => (C.state.visited[m] || {})[a]).length;
  const tries = {};          // gate cell -> times walked into
  const searches = {};       // map:area -> searches
  const hubDone = {};        // hub scenes taken this trip
  const forced = {};         // door -> tries
  let sceneStall = 0, lastSceneSig = "", lastMode = "";
  const bump = (o, k) => (o[k] = (o[k] || 0) + 1);

  const send = cmd => {
    const r = C.step(cmd);
    out.n++;
    const refused = r.events.find(e => e.k === "refuse");
    if (refused) out.refused.push({ cmd, text: refused.text, mode: C.state.mode });
    else out.cmds.push(cmd);
    out.trace.push(JSON.stringify(cmd) + (refused ? " REFUSED " + refused.text : ""));
    if (out.trace.length > 40) out.trace.shift();
    const s = C.state;
    for (const [m, a] of allAreas) if ((s.visited[m] || {})[a] && !out.order.find(o => o.startsWith(m + "/" + a + " "))) out.order.push(`${m}/${a} @cmd ${out.n} turn ${s.turn}`);
    for (const e of r.events) if (e.k === "fight") out.fightLog.push(`${e.phase} ${e.result || ""} turn ${s.turn} ${s.pos ? s.pos.map + ":" + s.pos.x + "," + s.pos.y : ""} hp ${s.party.map(m => (m.dead ? "X" : (m.marked.hp ?? Object.values(m.marked).join("/")))).join(",")}`);
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth && out.overflow.length < 5) {
      out.overflow.push(`${s.mode}${s.scene ? ":" + s.scene.id : ""} ${document.documentElement.scrollWidth}px`);
    }
    if (out.ui.length < 6) {
      const v = C.view(), txt = document.body.innerText, bad = m => out.ui.push(`${s.mode}${s.scene ? ":" + s.scene.id : ""}: ${m}`);
      const buttons = sel => document.querySelectorAll(sel).length;
      if (s.mode === "scene" && buttons("#controls .choice") !== v.scene.choices.length) bad(`${buttons("#controls .choice")} choice buttons for ${v.scene.choices.length} choices`);
      if (s.mode === "scene" && !txt.includes(v.scene.title)) bad("the scene title is not on screen");
      if (s.mode === "fight" && (document.getElementById("plate").hidden || !txt.includes(v.fight.foes[0].name))) bad("the foe plate is missing");
      if (s.mode === "fight" && !buttons("#controls .choice")) bad("no order buttons");
      if (s.mode === "deathDoor" && !document.querySelector('[data-fk="d:cheat"]')) bad("no death's door buttons");
      if (s.mode === "map" && (buttons(".thumbs button") < 10 || document.getElementById("wire").getBoundingClientRect().height < 100)) bad("the map controls or the wireframe are missing");
      if (s.mode === "hub" && !v.hub.places.every(pl => txt.includes(pl.label))) bad("a hub place is not on screen");
      if (s.mode === "ending" && !txt.includes(v.ending.title)) bad("the ending title is not on screen");
      if (s.mode === "map" && v.hud.area && !document.getElementById("hud").innerText.includes(v.hud.area.name)) bad("the area name is not in the HUD");
    }
    if (s.mode === "scene" || s.mode === "fight") {
      const k = s.mode === "scene" ? "scene:" + s.scene.id : "fight:" + s.fight.enc;
      const t = document.body.innerText;
      out.text[k] = out.text[k] ? out.text[k] + "\n" + t : t;
      if (out.text[k].length > 60000) out.text[k] = out.text[k].slice(-30000);
    }
    return r;
  };

  // ---- navigation: breadth-first over cells, across maps through links ----
  function bfs(s, from) {
    const p = s.pos, start = from || p.map + "|" + p.x + "|" + p.y;
    const dist = { [start]: 0 }, par = {}, queue = [start], gates = [], edges = [];
    let hub = null;
    while (queue.length) {
      const cur = queue.shift();
      if (cur === "HUB") continue;
      const [m, xs, ys] = cur.split("|"), x = +xs, y = +ys;
      for (let d = 0; d < 4; d++) {
        const tx = x + DIRS[d][0], ty = y + DIRS[d][1], k = kind(s, m, tx, ty);
        if (k === "wall") continue;
        const i = info(m, tx, ty);
        if (k === "stuck" && (forced[m + "|" + tx + "|" + ty] || 0) > 60) continue;
        if (k === "locked" && !(s.items[i.key] > 0)) continue;
        let node = m + "|" + tx + "|" + ty;
        const L = i.link;
        if (L && L.scene) { gates.push({ from: cur, d, m, x: tx, y: ty, scene: L.scene, dist: dist[cur] + 1 }); continue; }
        if (L && L.hub) node = "HUB";
        else if (L && L.map) node = L.map + "|" + L.x + "|" + L.y;
        edges.push([cur, node]);
        if (dist[node] !== undefined) continue;
        dist[node] = dist[cur] + 1; par[node] = { from: cur, d };
        if (node === "HUB") hub = node; else queue.push(node);
      }
    }
    // Nodes from which the way home is open. A rope that only goes down leaves them behind.
    const back = {}, home = new Set(hub ? ["HUB"] : []);
    for (const [a, c] of edges) (back[c] = back[c] || []).push(a);
    const todo = [...home];
    while (todo.length) for (const a of back[todo.pop()] || []) if (!home.has(a)) { home.add(a); todo.push(a); }
    return { dist, par, gates, start, hub, home };
  }
  function firstDir(b, node) {
    let n = node, d = null;
    while (n !== b.start) { const q = b.par[n]; d = q.d; n = q.from; }
    return d;
  }
  function stepDir(s, d) {
    const p = s.pos;
    if (p.facing !== d) { const t = (d - p.facing + 4) % 4; return { t: "turn", dir: t === 3 ? "left" : "right" }; }
    const f = kind(s, p.map, p.x + DIRS[d][0], p.y + DIRS[d][1]);
    if (f === "stuck" || f === "locked") { bump(forced, p.map + "|" + (p.x + DIRS[d][0]) + "|" + (p.y + DIRS[d][1])); return { t: "act" }; }
    return { t: "move", dir: "forward" };
  }

  // ---- light and health ----
  function lightSupply(s) {
    let t = s.light.left || 0;
    for (const [id, n] of Object.entries(s.light.stash || {})) if (id !== s.light.source) t += n;
    for (const id of (R.clock.light && R.clock.light.order) || []) {
      const it = P.items[id];
      if (!it || !it.light || (it.light.requires && !(s.items[it.light.requires] > 0))) continue;
      t += (s.items[id] || 0) * it.light.turns;
    }
    return t;
  }
  const hubActions = () => [].concat(...((P.hub && P.hub.places) || []).map(pl => pl.actions));
  const restAction = () => hubActions().find(a => a.kind === "rest");
  const lightStock = s => {
    const rows = [];
    for (const a of hubActions()) if (a.kind === "shop") for (const r of a.stock || []) {
      const it = P.items[r.item];
      if (it && it.kind === "light" && it.light && (!it.light.requires || s.items[it.light.requires] > 0)) rows.push({ action: a.id, item: r.item, price: r.price, turns: it.light.turns });
    }
    return rows.sort((a, b) => a.price / a.turns - b.price / b.turns);
  };
  const treasureValue = s => Object.entries(s.items).reduce((t, [id, n]) => t + (P.items[id] && P.items[id].kind === "treasure" ? (P.items[id].value || 0) * n : 0), 0);
  // An area that forces a fight or a scene is entered hale, or not before a rest.
  const committing = (m, a) => { const d = P.maps[m].areas[a]; return !!d && (!!d.encounter || !!(d.enter && P.events[d.enter] && P.events[d.enter].noLeave)); };
  function restBeforeCommit(s, v) {
    if (out.hubTrips >= 25 || v.party.every(m => m.dead || m.down || m.tracks.every(t => t.marked * 4 <= t.max))) return false;
    const rest = restAction();
    if (!rest || (rest.price || 0) > s.gold + treasureValue(s)) return false;
    return allAreas.some(([m, a]) => !(s.visited[m] || {})[a] && committing(m, a));
  }
  function needHub(s, v) {
    if (out.hubTrips >= 25) return false;
    const rest = restAction(), cash = s.gold + treasureValue(s);
    if (v.party.some(m => !m.dead && m.tracks.some(t => t.marked * 2 > t.max)) && rest && (rest.price || 0) <= cash) return true;
    if (s.party.some(m => m.dead) && s.bench.length) return true;
    const stock = lightStock(s);
    if (lightSupply(s) < 5 && stock.length && stock[0].price <= cash) return true;
    return false;
  }

  // ---- the modes ----
  function fightOrders(v) {
    const f = v.fight, live = f.foes.filter(x => x.state !== "dead" && x.state !== "fled");
    const tgt = (live.find(x => x.state === "awake") || live[0] || { i: 0 }).i;
    return { t: "orders", orders: f.members.map(m => (m.acts.includes("fight") ? { member: m.id, act: "fight", target: tgt } : { member: m.id, act: "guard" })) };
  }

  // Is there an unvisited area, or a search worth making, that does not cost the way home?
  function safeWorkLeft(s) {
    const b = bfs(s);
    for (const n of Object.keys(b.dist)) {
      if (n === "HUB" || n === b.start || !b.home.has(n)) continue;
      const [m, x, y] = n.split("|"), a = areaOf(m, +x, +y);
      if (a && !(s.visited[m] || {})[a]) return true;
    }
    return false;
  }

  function sceneStep(v, s) {
    const sc = v.scene, def = P.events[sc.id], taken = s.scene.taken, from = s.scene.from;
    const sig = sc.id + "|" + taken.join(",") + "|" + sc.said.length;
    sceneStall = sig === lastSceneSig ? sceneStall + 1 : 0;
    lastSceneSig = sig;
    const pick = c => ({ t: "choose", id: c.id });
    const defOf = c => def.choices.find(x => x.id === c.id);
    const avail = sc.choices.filter(c => c.enabled && c.id !== "leave");
    // The engine adds a Step back (id "leave") unless the scene has a choice of that id. Trust it only if it is the engine's.
    const leave = sc.choices.find(c => c.id === "leave" && c.enabled && (!defOf(c) || !choiceReach(defOf(c)).end));
    if (sceneStall > 6) return pick(leave || avail[0] || sc.choices.find(c => c.enabled));
    const untaken = avail.filter(c => !taken.includes(c.id));
    const danger = c => { const r = choiceReach(defOf(c)); return r.end || (from === "map" && r.hub); };
    const hasGoto = c => gotos(defOf(c)).length > 0;
    if (opts.takePlans) {
      const p = untaken.find(c => c.mode === "plan" && !hasGoto(c));
      if (p) return pick(p);
    }
    // The first act that is not a sure fight. A sure fight only if there is no way to step back.
    const acts = untaken.filter(c => c.mode === "act");
    // A sure fight is a choice with no roll that ends in an encounter. A roll may still go well.
    const sure = c => !defOf(c).check && choiceReach(defOf(c)).enc;
    // A way to another map waits until the rest of this one is done.
    const wait = from === "map" && s.pos && safeWorkLeft(s);
    const oneWay = c => wait && choiceReach(defOf(c)).maps.some(g => g.map !== s.pos.map);
    // A roll that can end in a fight is for the hale.
    const hale = v.party.every(m => m.dead || m.down || m.tracks.every(t => t.marked * 4 <= t.max));
    const risky = c => !hale && !!defOf(c).check && choiceReach(defOf(c)).enc;
    const calm = acts.find(c => !danger(c) && !sure(c) && !oneWay(c) && !risky(c));
    if (calm) return pick(calm);
    const brave = acts.find(c => !danger(c) && !oneWay(c));
    if (brave && !leave) return pick(brave);
    if (out.desperate && acts.length) return pick(acts[0]);
    if (leave) return pick(leave);
    const rest = untaken.filter(c => !danger(c));
    if (rest.length) return pick(rest.find(c => c.mode !== "fate") || rest[0]);
    if (untaken.length) return pick(untaken[0]);
    return pick(avail.find(c => hasGoto(c)) || avail[0] || sc.choices.find(c => c.enabled));
  }

  function hubStep(v, s) {
    const acts = hubActions().map(a => Object.assign({}, a, v.hub.places.reduce((f, pl) => f || pl.actions.find(x => x.id === a.id), null)));
    if (s.party.some(m => m.dead) && s.bench.length) {
      const a = acts.find(x => x.kind === "roster" && x.enabled);
      if (a) return { t: "hub", action: a.id };
    }
    for (const a of acts) if (a.kind === "shop" && a.enabled) for (const r of a.sell || []) return { t: "hub", action: a.id, sell: r.item, n: r.count };
    const hurt = s.party.some(m => !m.dead && (Object.values(m.marked).some(n => n > 0) || m.cond.length || Object.keys(m.used).length));
    const rest = acts.find(a => a.kind === "rest" && a.enabled && (a.price || 0) <= s.gold);
    if (hurt && rest) return { t: "hub", action: rest.id };
    const stock = lightStock(s);
    if (lightSupply(s) < 30 && stock.length && stock[0].price <= s.gold) return { t: "hub", action: stock[0].action, buy: stock[0].item };
    const sceneActs = acts.filter(a => a.kind === "scene" && a.enabled);
    const leaving = sceneActs.find(a => reachScene(a.scene).map);
    if (leaving) return { t: "hub", action: leaving.id };
    const other = sceneActs.find(a => !hubDone[a.id]);
    if (other) { hubDone[other.id] = 1; return { t: "hub", action: other.id }; }
    return null;
  }

  // A healing ability, used on whoever has the most marked.
  function healStep(s, v) {
    const hurt = v.party.filter(m => !m.dead && !m.down && m.tracks.some(t => t.marked > 0))
      .sort((a, b) => b.tracks.reduce((n, t) => n + t.marked, 0) - a.tracks.reduce((n, t) => n + t.marked, 0))[0];
    if (!hurt) return null;
    for (const m of v.party) {
      if (m.dead || m.down) continue;
      for (const a of m.abilities) {
        const def = P.abilities[a.id];
        if (a.usable && def.target === "ally" && def.effects && def.effects.heal && (def.when === "map" || def.when === "any")) return { t: "use", member: m.id, ability: a.id, target: hurt.id };
      }
    }
    return null;
  }

  function mapStep(v, s) {
    const why = (w, c) => { if (process_debug) { out.dec = out.dec || []; out.dec.push("   -> " + w + " " + JSON.stringify(c)); } return c; };
    const heal = healStep(s, v);
    if (heal) return heal;
    const b = bfs(s), p = s.pos, here = areaOf(p.map, p.x, p.y);
    const nodeArea = n => { const [m, x, y] = n.split("|"); return n === "HUB" ? null : areaOf(m, +x, +y); };
    const nodeMap = n => n.split("|")[0];
    const go = n => stepDir(s, firstDir(b, n));
    // 1. home, to rest or to buy light
    if (b.hub && b.home.has(b.start) && (needHub(s, v) || restBeforeCommit(s, v))) return why("needHub", go("HUB"));
    // 2. the nearest area not yet visited
    // Areas past a one-way link wait until the rest is done.
    // This map before the next. Past a one-way link, last.
    let same = null, other = null, trap = null;
    const nearer = (n, o) => !o || b.dist[n] < b.dist[o];
    // An area on this map whose shortest way runs over another map counts as another map's area. Otherwise the party can walk up a
    // hatch toward it, then walk back down to search for the hidden door that is the short way, and never stop.
    const local = n => { for (let c = n; c !== b.start; c = b.par[c].from) if (c === "HUB" || c.split("|")[0] !== p.map) return false; return true; };
    for (const n of Object.keys(b.dist)) {
      if (n === "HUB" || n === b.start) continue;
      const a = nodeArea(n), m = nodeMap(n);
      if (!a || (s.visited[m] || {})[a]) continue;
      if (!b.home.has(n)) { if (nearer(n, trap)) trap = n; }
      else if (m === p.map && local(n)) { if (nearer(n, same)) same = n; }
      else if (nearer(n, other)) other = n;
    }
    if (process_debug) { out.dec = out.dec || []; out.dec.push(`cmd ${out.n} ${p.map}:${p.x},${p.y} same=${same} other=${other} trap=${trap} startHome=${b.home.has(b.start)} hale=${v.party.every(m => m.dead || m.down || m.tracks.every(t => t.marked * 4 <= t.max))} marks=${JSON.stringify(v.party.map(m => m.tracks.map(t => t.marked + '/' + t.max).join(' ') + (m.down ? ' down' : '')))} gold=${s.gold} hubpath=${(() => { const c = []; let n = 'HUB'; while (b.par[n] && c.length < 40) { c.push(n + '<' + b.par[n].d); n = b.par[n].from; } return c.slice(-6).join(' '); })()}`); if (out.dec.length > 600) out.dec.shift(); }
    if (same) return why("same", go(same));
    // 3. a search, where an area has an unfound secret door next to it
    const want = {};
    for (const [m, mp] of Object.entries(P.maps)) {
      for (let y = 0; y < mp.grid.length; y++) for (let x = 0; x < mp.grid[y].length; x++) {
        const i = info(m, x, y);
        if (i.ch !== "S" || (s.doors[m] || {})[key(x, y)]) continue;
        for (const [dx, dy] of DIRS) { const a = areaOf(m, x + dx, y + dy); if (a && (searches[m + ":" + a] || 0) < 8) want[m + ":" + a] = 1; }
      }
    }
    if (want[p.map + ":" + here]) { bump(searches, p.map + ":" + here); return why("search", { t: "search" }); }
    let sBest = null;
    for (const n of Object.keys(b.dist)) {
      if (n === "HUB" || n === b.start) continue;
      if (want[nodeMap(n) + ":" + nodeArea(n)] && (!sBest || b.dist[n] < b.dist[sBest])) sBest = n;
    }
    if (sBest) return why("searchWalk", go(sBest));
    // 4. another map, then an area past a one-way link. Go over hale: home first, to rest and to buy light, if the purse allows.
    const next = other || trap;
    if (next) {
      const cash = s.gold + treasureValue(s), rest = restAction();
      const topUp = v.party.some(m => !m.dead && m.tracks.some(t => t.marked > 0)) || (s.party.some(m => m.dead) && s.bench.length)
        || (lightSupply(s) < 30 && lightStock(s).length && lightStock(s)[0].price <= cash);
      if (b.hub && b.home.has(b.start) && topUp && out.hubTrips < 25 && (!rest || (rest.price || 0) <= cash)) return why("topUp", go("HUB"));
      return why("next", go(next));
    }
    // 5. a doorway that opens a scene
    const pool = () => b.gates.filter(g => (tries[g.m + "|" + g.x + "|" + g.y] || 0) < (out.desperate ? 6 : 2)
      && (out.desperate || !choicesDanger(g.scene)));
    if (!out.gateLog) out.gateLog = [];
    if (out.gateLog.length < 6) out.gateLog.push(`cmd ${out.n} turn ${s.turn} at ${p.map}:${p.x},${p.y} facing ${p.facing}; unvisited ${allAreas.filter(([m, a]) => !(s.visited[m] || {})[a]).map(x => x.join("/")).join(" ")}; reachable nodes ${Object.keys(b.dist).length}; gates ${b.gates.map(g => g.scene).join(" ")}`);
    let gate = pool().sort((x, y) => x.dist - y.dist)[0];
    if (!gate && !out.desperate && seenAreas() < allAreas.length) { out.desperate = true; out.desperateAt = `turn ${s.turn} at ${p.map}:${p.x},${p.y} area ${here}; unvisited ${allAreas.filter(([m, a]) => !(s.visited[m] || {})[a]).map(x => x.join("/")).join(" ")}; doors ${JSON.stringify(s.doors)}; gates ${b.gates.map(g => g.scene + ":" + (tries[g.m + "|" + g.x + "|" + g.y] || 0)).join(" ")}`; gate = pool().sort((x, y) => x.dist - y.dist)[0]; }
    if (gate) {
      if (gate.from === b.start) { bump(tries, gate.m + "|" + gate.x + "|" + gate.y); return why("gate", stepDir(s, gate.d)); }
      return why("gateWalk", go(gate.from));
    }
    return null;
  }
  // A gate scene is dangerous when every way through it ends the game or goes home.
  function choicesDanger(sceneId) {
    const def = P.events[sceneId];
    if (!def) return false;
    const acts = def.choices.filter(c => c.mode === "act");
    return acts.length > 0 && acts.every(c => { const r = choiceReach(c); return r.end || r.hub; });
  }

  function decide() {
    const s = C.state, v = C.view();
    if (s.mode !== lastMode) { if (s.mode === "hub" && lastMode !== "scene") out.hubTrips++; if (s.mode === "fight") out.fights++; lastMode = s.mode; }
    switch (s.mode) {
      case "roster": return { t: "pick", ids: P.party.default };
      case "ending": return null;
      case "deathDoor": return { t: "cheat" };
      case "fight": return fightOrders(v);
      case "scene": return sceneStep(v, s);
      case "hub": return hubStep(v, s);
      case "map": return mapStep(v, s);
      default: return null;
    }
  }

  // ---- the run ----
  for (;;) {
    const s = C.state;
    if (s.mode === "ending") { out.outcome = s.ending; break; }
    if (seenAreas() === allAreas.length && s.mode === "map") { out.outcome = "complete"; break; }
    if (opts.untilHub && s.mode === "hub") { out.outcome = "hub"; break; }
    if (opts.untilMap && s.mode === "map") { out.outcome = "map"; break; }
    if (out.n >= opts.max) { out.outcome = "cap"; break; }
    const cmd = decide();
    if (!cmd) { out.outcome = "stuck in " + s.mode + (s.scene ? ":" + s.scene.id : ""); break; }
    send(cmd);
  }
  const s = C.state;
  out.turn = s.turn;
  out.seen = seenAreas();
  out.total = allAreas.length;
  out.missing = allAreas.filter(([m, a]) => !(s.visited[m] || {})[a]).map(([m, a]) => m + "/" + a);
  out.visitedList = allAreas.filter(([m, a]) => (s.visited[m] || {})[a]).map(([m, a]) => m + "/" + a);
  out.dead = s.party.filter(m => m.dead).length;
  return out;
}

/* ---------------------------------------------------------------------------
   Keys: turn a recorded command list into the key presses that send it.
   Runs in the page. Stops at the first command no key can send.
   ------------------------------------------------------------------------- */
function keyRecorder(cmds) {
  const C = window.CRAWL, P = C.pack;
  const keys = [];
  // Number keys reach the places' own actions. Stall rows have no key (see ui/view.js).
  const hubKey = (v, cmd) => {
    if (cmd.buy || cmd.sell || cmd.ids) return null;
    const plain = [];
    for (const pl of v.hub.places) for (const a of pl.actions) if (!(a.kind === "shop" && Array.isArray(a.stock) && a.stock.length)) plain.push(a.id);
    const i = plain.indexOf(cmd.action);
    return i < 0 ? null : i + 1;
  };
  const MOVE = { forward: "ArrowUp", back: "ArrowDown", left: "q", right: "e" };
  const TURN = { left: "ArrowLeft", right: "ArrowRight" };
  const SIMPLE = { act: "Space", search: "f", listen: "l", rest: "r" };
  let used = 0;
  for (const cmd of cmds) {
    const v = C.view();
    let k = null;
    if (cmd.t === "pick") k = JSON.stringify(cmd.ids) === JSON.stringify(P.party.default) && v.mode === "roster" ? "Enter" : null;
    else if (cmd.t === "hub") { const n = hubKey(v, cmd); k = n && n < 10 ? String(n) : null; }
    else if (cmd.t === "choose") { const n = v.scene.choices.findIndex(c => c.id === cmd.id) + 1; k = n > 0 && n < 10 ? String(n) : null; }
    else if (cmd.t === "move") k = MOVE[cmd.dir] || null;
    else if (cmd.t === "turn") k = TURN[cmd.dir] || null;
    else if (SIMPLE[cmd.t]) k = SIMPLE[cmd.t];
    else if (cmd.t === "orders") {
      // One key for each member's act, and one more to pick a foe when there is a choice.
      const seq = [], f = v.fight, gone = /^(fled|dead|down|gone|broken|out)/i;
      const foes = f.foes.filter(x => !gone.test(x.state || ""));
      let good = f.members.length === cmd.orders.length;
      f.members.forEach((m, i) => {
        const o = cmd.orders[i];
        if (!o || o.member !== m.id) { good = false; return; }
        seq.push(String(m.acts.indexOf(o.act) + 1));
        if (o.act === "fight" && foes.length > 1) seq.push(String(foes.findIndex(x => x.i === o.target) + 1));
      });
      if (!good || seq.some(x => x === "0" || x.length > 1)) break;
      keys.push(...seq);
      C.step(cmd);
      used++;
      continue;
    }
    else if (cmd.t === "cheat") k = "1";
    else if (cmd.t === "letgo") k = "2";
    if (!k) break;
    keys.push(k);
    C.step(cmd);
    used++;
  }
  return { keys, used, state: JSON.stringify(C.state) };
}

/* ---------------------------------------------------------------------------
   Pinned facts: Module 2 as the module and the spine pin them. Each fact is a list of
   ways to say it; one of them must be on screen, in the text seen at that scene.
   ------------------------------------------------------------------------- */
const PINNED = [
  ["S1", "scene:s1", "the rope burn", [/rope burn/i]],
  ["S2", "scene:s2", "30'", [/30'|thirty feet/i]],
  ["S2", "scene:s2", "40'", [/40'|forty feet/i]],
  ["S3", "scene:s3", "ash less than a week old", [/ash less than a week old/i]],
  ["S3", "scene:s3", "the chalk eye", [/chalk[^.]*\beye\b[^.]*\bline\b/i]],
  ["S3", "scene:s3", "two flasks", [/two flasks/i]],
  ["C1", "scene:c1", "20'", [/20'|twenty feet/i]],
  ["C1", "scene:c1", "the stuck door", [/\bstuck\b/i]],
  ["C2", "scene:c2", "30' x 20'", [/30'\s*[x×]\s*20'/i]],
  ["C2", "scene:c2", "five giant rats", [/giant rats,? five|five giant rats/i]],
  ["C3", "scene:c3", "one step a turn", [/one step/i, /\bturn\b/i]],
];

/* ---------------------------------------------------------------------------
   The run
   ------------------------------------------------------------------------- */
const t0 = Date.now();
let pagesDone = 0;
for (const file of files) {
  const name = path.basename(file);
  console.log(`\n${name}`);
  const mark = fails.length, errMark = errs.length;

  // 1. Loads clean at 360 x 780.
  {
    const { ctx, page } = await open(file, "?seed=1");
    const probe = await page.evaluate(() => ({
      crawl: typeof window.CRAWL === "object" && window.CRAWL !== null && typeof window.CRAWL.step === "function",
      id: window.CRAWL && window.CRAWL.pack && window.CRAWL.pack.id,
      scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth,
      mode: window.CRAWL && window.CRAWL.state.mode, seed: window.CRAWL && window.CRAWL.seed,
    }));
    if (!probe.crawl) fail(name, "window.CRAWL is missing");
    if (probe.scroll > probe.width) fail(name, `horizontal overflow on load: ${probe.scroll}px > ${probe.width}px`);
    if (probe.mode !== "roster") fail(name, `a fresh page should open on the roster, not ${probe.mode}`);
    if (probe.seed !== 1) fail(name, `?seed=1 gave seed ${probe.seed}`);
    var packId = probe.id;
    await ctx.close();
    console.log(`  loads: pack ${probe.id}, roster, no overflow`);
  }

  // 2. The explorer, one seed at a time, each on a fresh page.
  const texts = {};
  const visited = new Set();
  let total = 0, recorded = null, recordedSeed = null, endingChecked = false;
  for (const seed of SEEDS) {
    const { ctx, page } = await open(file, "?seed=" + seed);
    const t1 = Date.now();
    const r = await page.evaluate(explorer, { max: MAX_COMMANDS, takePlans: true, debug: !!process.env.DEBUG });
    total = r.total;
    r.visitedList.forEach(a => visited.add(a));
    for (const [k, v] of Object.entries(r.text)) texts[k] = (texts[k] || "") + "\n" + v;
    if (r.refused.length) fail(name, `seed ${seed}: ${r.refused.length} refused commands, first: ${JSON.stringify(r.refused[0])}`);
    if (r.overflow.length) fail(name, `seed ${seed}: horizontal overflow in ${r.overflow.join(", ")}`);
    if (r.ui.length) fail(name, `seed ${seed}: the screen does not match the view model: ${r.ui.join("; ")}`);
    if (!endingChecked && r.outcome && r.outcome !== "complete" && /^end/.test(r.outcome) && (await page.evaluate(() => window.CRAWL.state.mode)) === "ending") {
      endingChecked = true;
      await page.click('[data-fk="ng"]');
      const after = await page.evaluate(() => ({ mode: window.CRAWL.state.mode, seed: window.CRAWL.seed, cmds: window.CRAWL.state.turn }));
      if (after.mode !== "roster" || after.seed !== seed) fail(name, `New game on the ending screen gave mode ${after.mode}, seed ${after.seed} (wanted roster, seed ${seed})`);
      else console.log(`  ending screen (${r.outcome}): New game returns to the roster with seed ${seed}`);
    }
    if (!recorded || (recordedSeed !== 7 && seed === 7)) { recorded = r.cmds; recordedSeed = seed; }
    console.log(`  seed ${String(seed).padEnd(4)} ${r.seen}/${r.total} areas · ${r.turn} turns · ${r.n} commands · ${r.fights} fights · ${r.hubTrips} hub visits · ${r.dead} dead · ${r.outcome} · ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    if (VERBOSE && r.desperateAt) console.log("    desperate: " + r.desperateAt);
    if (r.dec) console.log("    decisions:\n      " + r.dec.slice(-(+process.env.DEBUG || 25)).join("\n      "));
    if (VERBOSE && r.gateLog) console.log("    gates:\n      " + r.gateLog.join("\n      "));
    if (VERBOSE) console.log("    order: " + r.order.join(" | "));
    if (VERBOSE) console.log("    fights:\n      " + r.fightLog.join("\n      "));
    if ((VERBOSE && r.outcome !== "complete") || process.env.TRACE) console.log("    last commands:\n      " + r.trace.slice(-(+process.env.TRACE || 15)).join("\n      "));
    await ctx.close();
  }
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify({ seed: recordedSeed, commands: recorded }));
  const { ctx: c0, page: p0 } = await open(file, "?seed=1");
  const everything = await p0.evaluate(() => { const o = []; for (const [m, mp] of Object.entries(window.CRAWL.pack.maps)) for (const a of Object.keys(mp.areas || {})) o.push(m + "/" + a); return o; });
  await c0.close();
  const missing = everything.filter(a => !visited.has(a));
  console.log(`  coverage across seeds: ${everything.length - missing.length}/${everything.length} areas`);
  if (missing.length) fail(name, `areas never visited: ${missing.join(", ")}`);

  // 3. Keyboard replay: the same short path, with real key presses, from a fresh page.
  {
    const seed = recordedSeed;
    const a = await open(file, "?seed=" + seed);
    const rec = await a.page.evaluate(keyRecorder, recorded.slice(0, 80));
    await a.ctx.close();
    const b = await open(file, "?seed=" + seed);
    for (const k of rec.keys) await b.page.keyboard.press(k);
    const got = await b.page.evaluate(() => JSON.stringify(window.CRAWL.state));
    const mode = JSON.parse(rec.state).mode;
    if (got !== rec.state) fail(name, `keyboard replay of ${rec.keys.length} keys (seed ${seed}) did not reach the same state`);
    if (rec.keys.length < 8) fail(name, `the recorded path is too short to mean anything: ${rec.keys.length} keys`);
    await b.ctx.close();
    console.log(`  keyboard replay: ${rec.keys.length} key presses from seed ${seed} reach the same state (mode ${mode})`);
  }

  // 4. Reload restores the game. Blocked storage still plays.
  {
    const a = await open(file, "?seed=" + recordedSeed);
    const before = await a.page.evaluate(cmds => { cmds.forEach(c => window.CRAWL.step(c)); return JSON.stringify(window.CRAWL.state); }, recorded.slice(0, 40));
    await a.page.reload();
    const after = await a.page.evaluate(() => JSON.stringify(window.CRAWL.state));
    if (before !== after) fail(name, "a reload did not restore the game from localStorage");
    // The save keeps playing after a reload.
    const more = await a.page.evaluate(() => { window.CRAWL.step({ t: "turn", dir: "right" }); return window.CRAWL.state.mode; });
    // Every key the page writes sits under the pack's storage prefix.
    const keys = await a.page.evaluate(() => Object.keys(localStorage));
    const prefix = (await a.page.evaluate(() => window.CRAWL.pack.storage)) || "crawl";
    const stray = keys.filter(k => !k.startsWith(prefix + "."));
    if (!keys.length) fail(name, "the page wrote no save to localStorage");
    if (stray.length) fail(name, `localStorage keys outside "${prefix}.": ${stray.join(", ")}`);
    await a.ctx.close();
    const b = await open(file, "?seed=" + recordedSeed, { blocked: true });
    const played = await b.page.evaluate(cmds => {
      cmds.forEach(c => window.CRAWL.step(c));
      return { turn: window.CRAWL.state.turn, mode: window.CRAWL.state.mode, cmds: cmds.length };
    }, recorded.slice(0, 40));
    const same = await b.page.evaluate(() => JSON.stringify(window.CRAWL.state));
    if (same !== before) fail(name, "with storage blocked the game played differently");
    await b.ctx.close();
    console.log(`  reload: ${before === after ? "restored" : "NOT restored"} (${before.length} bytes of state) · storage blocked: ${played.cmds} commands played to turn ${played.turn}, mode ${played.mode}${more ? "" : ""}`);
  }

  // 5. The interface, by clicks: the roster, the hub's change-the-party picker, the card sheet, New game.
  {
    const { ctx, page } = await open(file, "?seed=7");
    const roster = await page.evaluate(() => ({
      cards: document.querySelectorAll(".rcard").length, size: Object.keys(window.CRAWL.pack.party.roster).length,
      picked: document.querySelectorAll('.rcard[aria-pressed="true"]').length, need: window.CRAWL.pack.rules.party.size || 4,
    }));
    if (roster.cards !== roster.size) fail(name, `the roster shows ${roster.cards} cards for ${roster.size} characters`);
    if (roster.picked !== roster.need) fail(name, `the default party is not picked on the roster (${roster.picked} of ${roster.need})`);
    await page.click('[data-fk="r:go"]');
    if ((await page.evaluate(() => window.CRAWL.state.mode)) === "roster") fail(name, "the Start button did not leave the roster");
    // To the hub, through any opening scene.
    await page.evaluate(explorer, { max: 200, takePlans: true, untilHub: true, debug: false });
    const hub = await page.evaluate(() => {
      const v = window.CRAWL.view();
      return { mode: v.mode, bench: v.hub ? v.hub.bench.map(b => b.id) : [], party: v.party.map(m => m.id), roster: v.hub ? [].concat(...v.hub.places.map(p => p.actions)).filter(a => a.kind === "roster").map(a => a.id) : [] };
    });
    if (hub.mode !== "hub") fail(name, `could not reach the hub by clicks (mode ${hub.mode})`);
    let swapped = "no bench";
    if (hub.mode === "hub" && hub.bench.length && hub.roster.length) {
      await page.click(`[data-fk="h:${hub.roster[0]}"]`);
      await page.click(`[data-fk="r:${hub.party[hub.party.length - 1]}"]`);
      await page.click(`[data-fk="r:${hub.bench[0]}"]`);
      await page.click('[data-fk="r:go"]');
      const now = await page.evaluate(() => window.CRAWL.state.party.map(m => m.id));
      if (!now.includes(hub.bench[0]) || now.includes(hub.party[hub.party.length - 1])) fail(name, `the change-the-party picker did not swap ${hub.party[hub.party.length - 1]} for ${hub.bench[0]}: ${now.join(",")}`);
      else swapped = `swapped ${hub.party[hub.party.length - 1]} for ${hub.bench[0]}`;
    }
    // Out to the map; open a card; use an ally ability from the sheet if the pack has one.
    await page.evaluate(explorer, { max: 400, takePlans: true, untilMap: true, debug: false });
    const sheet = await page.evaluate(() => {
      const P = window.CRAWL.pack, v = window.CRAWL.view();
      if (v.mode !== "map") return { mode: v.mode };
      for (const m of v.party) for (const a of m.abilities) {
        const d = P.abilities[a.id];
        if (d.target === "ally" && d.effects && d.effects.heal && (d.when === "map" || d.when === "any")) return { mode: "map", first: v.party[0].id, member: m.id, ability: a.id, target: v.party[1].id };
      }
      return { mode: "map", first: v.party[0].id };
    });
    let sheetNote = "";
    if (sheet.mode !== "map") fail(name, `could not reach the map by clicks (mode ${sheet.mode})`);
    else {
      await page.click(`[data-fk="card:${sheet.first}"]`);
      if (await page.isHidden("#sheet")) fail(name, "tapping a card did not open its sheet");
      await page.keyboard.press("Escape");
      if (!(await page.isHidden("#sheet"))) fail(name, "Esc did not close the card sheet");
      if (sheet.ability) {
        const before = await page.evaluate(([m, a]) => (window.CRAWL.state.party.find(x => x.id === m).used[a] || 0), [sheet.member, sheet.ability]);
        await page.click(`[data-fk="card:${sheet.member}"]`);
        await page.click(`[data-fk="sh:${sheet.ability}"]`);
        const targets = await page.$$eval("#sheet .abil button", bs => bs.length);
        await page.click("#sheet .abil button >> nth=0");
        const after = await page.evaluate(([m, a]) => (window.CRAWL.state.party.find(x => x.id === m).used[a] || 0), [sheet.member, sheet.ability]);
        if (after !== before + 1) fail(name, `using ${sheet.ability} from the card sheet did not spend a use (${before} to ${after})`);
        else sheetNote = ` · ${sheet.ability} used from the sheet (${targets - 1} targets)`;
      }
      // The map overlay opens and closes.
      await page.click('[data-fk="t:map"]');
      if (await page.isHidden("#mapov")) fail(name, "the Map button did not open the map");
      await page.keyboard.press("Escape");
      if (!(await page.isHidden("#mapov"))) fail(name, "Esc did not close the map");
    }
    // New game takes two taps.
    await page.click("#newgame");
    const armed = await page.evaluate(() => ({ mode: window.CRAWL.state.mode, text: document.getElementById("newgame").textContent }));
    if (armed.mode === "roster") fail(name, "New game cleared the game on the first tap");
    await page.click("#newgame");
    const fresh = await page.evaluate(() => ({ mode: window.CRAWL.state.mode, seed: window.CRAWL.seed }));
    if (fresh.mode !== "roster" || fresh.seed !== 7) fail(name, `New game gave mode ${fresh.mode}, seed ${fresh.seed} (wanted roster, seed 7)`);
    await ctx.close();
    console.log(`  interface by clicks: roster ${roster.picked}/${roster.cards} picked · hub picker: ${swapped} · card sheet, map overlay, New game (two taps)${sheetNote}`);
  }

  // 6. Pinned facts, for the Fort's pack.
  if (packId === "drowned-tower") {
    const fightText = Object.entries(texts).filter(([k]) => k === "fight:c2-rats").map(([, v]) => v).join("\n");
    let ok = 0;
    for (const [area, k, label, pats] of PINNED) {
      const t = texts[k] || "";
      if (pats.every(p => p.test(t))) ok++;
      else fail(name, `pinned fact missing on screen in ${area}: ${label}`);
    }
    // The full OSE line for the rats appears when the fight starts.
    const probe = await open(file, "?seed=1");
    const line = await probe.page.evaluate(() => { const e = window.CRAWL.pack.encounters["c2-rats"]; return window.CRAWL.pack.bestiary[e.foes[0].id].oseLine; });
    await probe.ctx.close();
    if (fightText.includes(line)) ok++; else fail(name, "pinned fact missing on screen in C2: the full OSE line of the giant rats");
    console.log(`  pinned facts on screen: ${ok} of ${PINNED.length + 1}`);
  }

  // Console health for this page.
  const mine = errs.slice(errMark);
  if (mine.length) fail(name, `${mine.length} console errors or page errors, first: ${mine[0]}`);
  else console.log("  console: zero errors, zero page errors");
  pagesDone++;
  console.log(`  ${fails.length === mark ? "ok" : "FAILED"} (${((Date.now() - t0) / 1000).toFixed(0)}s so far)`);
}

await browser.close();

console.log(`\n${pagesDone} page(s), seeds ${SEEDS.join(", ")}`);
if (fails.length) {
  console.log("\nFAILURES:");
  fails.forEach(f => console.log("  " + f));
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
