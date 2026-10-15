// Walk every path of a pack. node stage/tools/sim.mjs <packdir> [--routes] [--json]
// Prints the endings with path counts, one route per distinct end state, and what was never reached.
// Exits 1 if any scene, beat, option, ending or note is unreachable.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPack } from "./load.mjs";

const Stage = createRequire(import.meta.url)("../engine/stage.js");
// A step as a short label: "group.option", "group.option=tier" for a pick that rolls, "(typed)" for an input.
export const stepLabel = x => (x.opt ? x.opt + (x.result ? "=" + x.result : "") : x.input != null ? x.input : "?");
const fmt = n => (Number.isSafeInteger(n) ? n.toLocaleString("en-US") : n.toExponential(4));

export function report(pack, opts = {}) {
  const sim = Stage.simulate(pack);
  const lines = [];
  const out = s => lines.push(s);
  out(`${pack.id} (${pack.kit}, ${pack.resolver}) · ${fmt(sim.paths)} paths · ${sim.states} states`);
  out("endings");
  const w = Math.max(8, ...Object.keys(sim.endings).map(k => k.length));
  for (const [id, n] of Object.entries(sim.endings)) out(`  ${id.padEnd(w)} ${fmt(n).padStart(14)}${n ? "" : "   NEVER REACHED"}`);
  const shown = opts.routes ? sim.routes : sim.routes.slice(0, 5);
  out(`routes: ${sim.routes.length} distinct end states${sim.routes.length > shown.length ? " (first " + shown.length + "; --routes for all)" : ""}`);
  for (const r of shown) out(`  ${r.ending}: ${r.steps.map(stepLabel).join(" > ") || "(no picks)"}  [${fmt(r.count)} paths]`);
  if (sim.cycles) out(`warning: ${sim.cycles} loop edge(s) were not followed; path counts leave loops out`);
  out(`locked options seen: ${sim.locked.length ? sim.locked.join(", ") : "none"}`);
  out(`unreachable: ${sim.unreachable.length ? "" : "none"}`);
  for (const u of sim.unreachable) out(`  ${u}`);
  return { sim, text: lines.join("\n"), ok: sim.unreachable.length === 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith("--"));
  if (!dir) { console.error("usage: node stage/tools/sim.mjs <packdir> [--routes] [--json]"); process.exit(2); }
  try {
    const r = report(loadPack(dir), { routes: args.includes("--routes") });
    console.log(args.includes("--json") ? JSON.stringify(r.sim, null, 2) : r.text);
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(e.message); process.exit(2); }
}
