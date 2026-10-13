# SPEC: The Crawler

A first-person, grid-based party crawler (a "blobber") for phones. One engine, any number of packs. A pack is data: the theme, the rules, the party, the monsters, the maps, the scenes. The engine knows nothing about rats, torches or corporations.

This file is the contract. Every agent builds to it. Where this file and any other file disagree, this file wins until someone changes it here.

Two packs ship as examples:

| Pack | Repo | Resolver | Source |
|------|------|----------|--------|
| `drowned-tower` | this repo, `crawler/packs/drowned-tower/` | `ose` | `dm/Module_2_The_Drowned_Tower.md`, all 25 areas |
| `drowned-floors` | `game-high-tech-low-lives`, `arcade/crawler/packs/drowned-floors/` | `fate4df` | New. Rhymes Module 2 area for area, in the HTLL world |

Two fixture packs, `packs/test` (`ose`) and `packs/test-fate` (`fate4df`), exercise every feature on a 9 × 7 map. Use them for engine tests and view development.

---

## 1. Files and layout

```
crawler/
  SPEC.md                 this file
  engine/crawl.js         the engine: pure, no DOM, browser and Node
  engine/test.mjs         node tests for the engine
  ui/index.html           the page template, with build markers
  ui/view.js              the view: draws Crawl.view(), sends commands
  ui/style.css
  tools/load.mjs          reads a pack directory into one object
  tools/validate.mjs      node crawler/tools/validate.mjs <packdir>
  tools/build.mjs         node crawler/tools/build.mjs <packdir> [--out file]
  tools/sim.mjs           node crawler/tools/sim.mjs <packdir>: balance simulator and rules audit (see its header)
  packs/<id>/             one directory per pack
  dist/<id>.html          built, single-file, opens from disk
  test.mjs                Playwright acceptance walk: node crawler/test.mjs [dist files...]
  README.md               what it is, how to play, how to make a pack, the checks
```

A second repository may vendor `engine/`, `ui/`, `tools/`, `test.mjs`, this file and the two fixture packs, and build its own packs against them (HTLL does: `arcade/crawler/`). The Fort copy is the source. The vendored copy must match it byte for byte; `check-vendor.mjs` in the vendoring repo says so.

No libraries, no network, no npm install. Node 22 and the global Playwright (`/opt/node22/lib/node_modules/playwright`, Chromium at `/opt/pw-browsers`) only.

### A pack directory

| File | Holds |
|------|-------|
| `pack.json` | `id`, `title`, `version`, `credits`, optional `start: {scene}`: a scene that opens the first time the party reaches the hub (the job), and optional `storage`: the localStorage key prefix (default `crawl`; lower-case letters, digits, dots and dashes) |
| `theme.json` | Look and words only: palette, fonts, labels. A reskin changes only this file. |
| `rules.json` | Numbers and procedures: resolver, stats, tracks, clock, combat, fate, skills |
| `party.json` | `default` (four ids, marching order) and `roster` (all characters) |
| `bestiary.json` | Monsters by id |
| `encounters.json` | Encounters by id: which monsters, who acts first, what happens after |
| `items.json` | Items by id |
| `abilities.json` | Spells, powers, chrome and Fate abilities by id. All one kind of thing. |
| `events.json` | Scenes by id |
| `hub.json` | The town: places, actions, the report |
| `endings.json` | Endings by id |
| `maps/<id>.json` | One file per map |

`tools/load.mjs` merges them into one object, `PACK`, with the same keys (`PACK.theme`, `PACK.rules`, ..., `PACK.maps[id]`). Every id is lower-kebab-case, except area keys, which are the module's keys (`S1`, `C12`, `G8`).

---

## 2. Engine API

`engine/crawl.js` is one classic script. In a browser it sets `globalThis.Crawl`. In Node, `require` returns it (`createRequire(import.meta.url)("./crawl.js")` from an `.mjs` file).

```js
Crawl.create(pack, { seed })        → state
Crawl.step(pack, state, command)    → { state, events }
Crawl.view(pack, state)             → view model (section 9)
Crawl.version                       → "0.1"
```

- **Pure.** `step` never mutates its input state. It returns a new state. A state is plain JSON: `JSON.parse(JSON.stringify(state))` round-trips it.
- **Seeded.** The RNG is the demo's mulberry32, with its state kept in `state.rng`:
  ```js
  function rand(s) {
    let t = s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const d = (s, n) => 1 + Math.floor(rand(s) * n);
  ```
  Same pack, same seed, same commands: same state, byte for byte. A replay is `{seed, commands[]}`.
- **Never throws on a bad command.** An illegal command returns the same state (the very same object) and one event `{k:"refuse", text}`. A catch-all turns any internal error into a refusal too.

### Commands

| Command | Mode | Does |
|---------|------|------|
| `{t:"pick", ids:[...]}` | roster | Choose the party (exactly `rules.party.size`, default 4), in marching order. Goes to the hub. |
| `{t:"hub", action}` | hub | Run a hub action by id (section 7). *Settled at integration:* a `roster` action takes `ids:[...]` (the new party, in marching order; with no `ids`, the places of the dead are filled from the bench); a `shop` action takes `buy:<item id>` or `sell:<treasure id>` and an optional `n` |
| `{t:"turn", dir:"left"\|"right"\|"about"}` | map | Face a new way. No time. |
| `{t:"move", dir:"forward"\|"back"\|"left"\|"right"}` | map | Step one cell. Left and right strafe. |
| `{t:"act"}` | map | Act on the cell ahead: open or force a door, use a link |
| `{t:"search"}` | map | Search the current area (section 5) |
| `{t:"listen"}` | map | Listen at the door ahead |
| `{t:"rest"}` | map | Rest one turn |
| `{t:"use", member, ability?, item?, target?}` | map, fight | Use an ability or item outside the orders flow |
| `{t:"order", ids:[...]}` | map, hub | Change marching order. Name every member who is up, once |
| `{t:"choose", id}` | scene | Pick a scene choice |
| `{t:"orders", orders:[{member, act, target?, ability?, item?}]}` | fight | One round. `act`: `fight`, `ability`, `item`, `guard`, `run`. `target` is a foe's index (its `i` in the view) when the target kind is `foe`, and a member id when it is `ally`. A member with no order fights (front rank, or ranged) or guards |
| `{t:"reroll"}` | fight | Spend Fate to reroll the last missed attack |
| `{t:"cheat"}` / `{t:"letgo"}` | deathDoor | Spend Fate to stay up, or go down |
| `{t:"restart"}` | any | New game, same seed |

### Events

`step` returns an array of events for the view to show, in order:

`{k:"log", text}` · `{k:"roll", who, what, dice:[...], mod, total, target, tier}` · `{k:"tick", turn}` · `{k:"light", text}` · `{k:"wander", roll, hit}` · `{k:"move"}` · `{k:"turn"}` · `{k:"bump", text}` · `{k:"scene", id}` · `{k:"fight", phase:"start"|"end", result?}` · `{k:"harm", who, track, amount}` · `{k:"heal", who, track, amount}` · `{k:"down", who}` · `{k:"ending", id}` · `{k:"refuse", text}`

`who` is a member id or `"enemy:<index>"`. Dice show as numbers (`4dF` dice as -1, 0, +1).

---

## 3. State

```js
{
  v: 1, seed, rng,
  mode: "roster" | "hub" | "map" | "scene" | "fight" | "deathDoor" | "ending",
  turn: 0, sinceRest: 0,
  light: { source: null | "<item id>" | "spell", left: 0, stash: {} },  // stash: snuffed sources' remaining turns
  pos: { map, x, y, facing: 0 },         // facing 0 N, 1 E, 2 S, 3 W; x east, y south
  prev: { map, x, y, facing },           // where "run" retreats to
  party: [ { id, marked: { <track>: n }, fate, used: { <ability>: n }, cond: [], down: false, dead: false } ],
  order: [ ids ],                         // marching order; front = first rules.combat.front living
  bench: [ ids ],                         // roster members not in the party
  flags: {}, items: {}, gold: 0,
  visited: { "<map>": { "<area>": true } },
  seen:    { "<map>": { "x,y": 1 } },     // automap
  doors:   { "<map>": { "x,y": "open" | "found" } },   // "found": a secret door seen, now a closed door
  done:    { "<encounter id>": true },
  foes:    { "<encounter id>": [ { id, hp, marked, state } ] },  // survivors persist across a retreat
  scene: null | { id, said: [], taken: [], from: "map" | "hub", gate: bool },
  fight: null | { enc, round, first, lastMiss: null | {member, order}, after, wander, nonLethal, morale },
  queued: null | "<encounter id>",        // a wandering encounter rolled while a scene was open; it starts when the party is on the map again
  ending: null | "<ending id>",
  log: [],                                // last 50 log lines, for the view
}
```

`state.done` also holds engine markers that start with `@`: `@start`, `@gate`, `@dark`, `@search:<map>:<area>`, `@cell:<map>:<x,y>`, `@joined:<id>`, `@dead:<id>`. A member may carry `bonus: {next, fight}` (the `bonus` verb). A fight has no `foes` array: its foes live only in `state.foes[enc]`, so nothing can fall out of step. A wandering fight never sets `done[enc]` and deletes its foes when it ends.

A fight's foes live in `state.foes[enc]` from the first round on, so a retreat and return finds the same monsters with the same hp, asleep or awake. (PR #1's review found exactly this bug in the classroom version. Do not repeat it.)

---

## 4. Rules (`rules.json`)

```jsonc
{
  "resolver": "ose",                   // or "fate4df"
  "party": { "size": 4 },
  "stats":  [ { "id": "str", "label": "STR" } ],          // display order
  "tracks": [ { "id": "hp",  "label": "HP" } ],           // fate4df: meat, nerves, systems
  "down": "dead",                      // "dead": out for good, recruit from the bench at the hub. "recover": back up after a hub rest.
  "clock": {
    "turnMinutes": 10,
    "newArea": 1,                      // turns to enter an area not yet visited; known areas are free
    "search": 1, "fight": 1, "rest": 1, "listen": 0,
    "wander": { "every": 2, "inSix": 1, "onNoise": true },   // onNoise: each forced-door try also checks
    "tired":  { "every": 6, "mod": -1 },                     // turns since rest before TIRED; -1 to attack and damage (ose) or to every roll (fate4df)
    "light":  { "order": ["oil-flask", "torch"], "outScene": "dark" }
  },
  "combat": { "front": 2, "reach": 2, "flee": { "inSix": 4 }, "defense": "reflexes" },
  "fate":   { "start": 3, "reroll": 1, "cheatDeath": 2, "bonus": 2 },
  "endings": { "wipe": "end-dead" },
  "skills": {                          // a check names a skill; the resolver reads this
    "listen":    { "inSix": 1 },       // ose: default chance; a member's skills.listen overrides
    "forceDoor": { "inSix": 2 },
    "search":    { "inSix": 1 }
    // fate4df: "listen": { "stat": "reflexes", "difficulty": 1 }
  },
  "statMods": "ose"                    // ose only: modifier from score by the standard table
}
```

### The two resolvers

Everything else in the engine is shared. A resolver is one object with four functions: `check`, `attack`, `defend`, `harm`. Keep each under about 80 lines.

**Tiers.** Every roll ends in a tier: `style`, `success`, `tie` or `fail`. Scene outcomes key off the tier (section 6).

**`ose`** (B/X, Old-School Essentials):

| Roll | How | Tier |
|------|-----|------|
| Check `{skill}` | d6 ≤ chance. Chance = the best living member's `skills[skill]`, else `rules.skills[skill].inSix` | `success` or `fail` |
| Check `{inSix: n}` | d6 ≤ n, rolled once for the party | `success` or `fail` |
| Check `{save: "D"\|"W"\|"P"\|"B"\|"S", who}` | d20 ≥ the member's `saves[save]` | `success` or `fail` |
| Member attacks | d20 + `attack.bonus` + stat mod (`attack.stat`, default `str`) + tired mod ≥ the foe's ascending `ac`. Natural 20 hits; natural 1 misses. Damage: `attack.damage` + stat mod + tired mod, minimum 1 | `success` or `fail` |
| Foe attacks | d20 + `attack.bonus` ≥ the member's ascending `ac` (+2 if the member guards). Damage: `attack.damage`, marked on `attack.track` (default `hp`) | — |
| Morale | When a foe group first loses one, and again at half: 2d6 > `ml` and the rest flee. A `breakAt: {dead: n}` replaces the roll: at n dead the rest flee. | — |

Stat mods from a score, the standard table: 3: −3; 4–5: −2; 6–8: −1; 9–12: 0; 13–15: +1; 16–17: +2; 18: +3.

**`fate4df`** (HTLL, the canonical ladder from `build/docs-v2/core_moves_sheet.md`):

| Roll | How | Tier |
|------|-----|------|
| Any roll | 4dF (each die d3 − 2) + stat + mods vs a difficulty. Shifts = total − difficulty | shifts ≥ 3 `style`; ≥ 1 `success`; 0 `tie`; < 0 `fail` |
| Check `{skill}` | `rules.skills[skill]` gives `stat` and `difficulty`. The best living member rolls. | ladder |
| Check `{stat, difficulty}` | The best living member rolls | ladder |
| Member attacks | `attack.stat` vs the foe's `rating`. Style or success: the foe marks max(1, shifts). Tie: the foe marks 1 and the attacker marks 1 on `attack.costTrack` (default the first track). Fail: nothing. | ladder |
| Foe attacks | The target rolls `rules.combat.defense` vs `attack.rating`, and the roll gets +2 if the target is guarding (the rating is never raised). Style: the foe marks 1. Success: no harm. Tie: mark 1. Fail: mark −shifts. Marked on `attack.track`. | ladder |
| Breaking | `breakAt: {dead: n}` or `{marked: n}` (total stress marked across the group) | — |

*Settled at integration.* On `fate4df` a **tie** passes a `listen`, `search`, `forceDoor` or flee check (it is a success), so a pack sets those difficulties with ties counted. A scene outcome with no `tie` entry uses `success`; so does a missing `style`. A `bonus` adds to every roll the member makes (`fate4df`) or to the member's to-hit only (`ose`); `scope: "next"` is spent by the member's next roll, `scope: "fight"` ends with the fight. `rules.statMods` is read by the engine alone, so a `fate4df` pack must not set it. A member's own `fate` field wins over `rules.fate.start`; `rules.fate.bonus` is reserved and unused.

**Harm and down.** A track has a maximum: `ose` from the member's `hp`; `fate4df` from the member's `tracks[id]` (default 3). Harm marks boxes; it never subtracts from a pool. When any track is full, the member is down. If the member has at least `fate.cheatDeath` Fate, the mode becomes `deathDoor` first: `cheat` spends it and leaves the member one box short of full; `letgo` puts them down. A down member drops out of the marching order. If every member is down, go to the ending named by `rules.endings.wipe`.

**Fate.** Each member starts each delve with `fate.start`. `reroll` costs `fate.reroll` and rerolls the last missed attack of the round just played. Fate refreshes at a hub rest.

---

## 5. Maps (`maps/<id>.json`)

```jsonc
{
  "id": "cellars", "title": "The Lamp Cellars", "tier": "Level 1",
  "grid": [                             // one character per 10' square; every row the same length
    "##########",
    "#aaa=bbb.#"
  ],
  "legend": { "a": { "area": "C1" }, "b": { "area": "C2" } },
  "cells":  { "3,1": { "link": { "map": "surface", "x": 4, "y": 2, "facing": 0 } } },
  "areas":  {
    "C1": { "name": "The Cellar Stair", "light": "dark", "enter": "c1", "search": "c1-search", "encounter": null },
    "C2": { "name": "The Oil Store",    "light": "dark", "encounter": "c2-rats",
            "listen": { "flag": "heard-rats", "say": ["Scratching. Squeaks. Many."] } }
  },
  "wander": [ { "weight": 1, "encounter": "lone-rat" } ]
}
```

**Glyphs the engine knows.** A pack's `legend` may add glyphs and may give any glyph more fields (`area`, `water`).

| Glyph | Is |
|-------|----|
| `#` | Wall |
| `.` | Floor with no area. Entering it never costs time. |
| `+` | Door. Walking into it opens it. Free. |
| `=` | Stuck door. Blocks until forced: `act` rolls `forceDoor`. Each try is noise (a wander check if `clock.wander.onNoise`). |
| `L` | Locked door. `act` opens it if the party carries the item named in `cells["x,y"].key`; otherwise it blocks. |
| `S` | Secret door. A wall until found by `search` or a `reveal` effect; then a door (`+`). |
| `<` `>` | Stairs. Must have `cells["x,y"].link`. Moving into the cell, or `act` while facing it, uses the link. |
| `~` | Water. Passable. The view hatches it. |

A secret door not yet found is a wall: `act` on it is refused even if the cell carries a `link` (the link works once the door is found). `cells["x,y"]` may set `area`, `link`, `key`, and `event` (a scene that opens the first time the party steps on the cell). A `link` is `{map, x, y, facing}` or `{hub: true}` or `{scene: id}`.

**Areas.** Every lettered cell belongs to an area. Entering an area not yet visited costs `clock.newArea` turns; then its `enter` scene opens, if it has one. If the area has an `encounter` that is not done, the fight starts on entry, unless the area also has an `enter` scene: then the scene must start it with `goto: {encounter}`. `light` is `daylight`, `dim` or `dark`.

**Listening.** `listen` while facing a door (`+`, `=`, `L`, or a found `S`) costs `clock.listen` turns and rolls the `listen` skill. On a success, if the area beyond the door has `listen`, the engine sets its `flag` and shows its `say`; otherwise it logs that you hear nothing. A failure always logs "You hear nothing", so a player cannot tell a miss from silence.

**Searching.** `search` costs `clock.search` turns. It rolls the `search` skill once for each unfound `S` cell next to (4-neighbour) any cell of the current area; a success finds it. If the area has a `search` scene, that opens once, after the roll.

**Wandering monsters.** Every `clock.wander.every` turns, roll d6 ≤ `clock.wander.inSix`. A hit picks from the current map's `wander` table by weight. A wandering encounter with `"nonLethal": true` cannot take a member below one box from full. *Settled at integration:* the check does not roll during a fight or in the hub. A hit that lands while a scene is open (a search that opens a scene, a scene choice with `turns`, an area entry that opens its scene) is kept in `state.queued` and starts as a fight when the party is on the map again. Going home drops it. `clock.fight` is charged once, when a fight ends (a win, a break or a flee), not each round and not when it starts. A fight on the sixth turn is therefore not played TIRED; the party is tired after it.

**Light.** In a `dark` area, if no light is lit, the engine lights the first carried item in `clock.light.order` (an item is carried if `state.items[id] > 0` and any `light.requires` item is also carried) and logs it. A lit source loses one turn per tick. At zero it is spent and the next is lit. If none is left in a dark area, the view shows nothing ahead and the `outScene` opens once. Entering a `daylight` area snuffs the source, keeping its turns in `light.stash`. An ability with a `light` effect lights `"spell"`.

---

## 6. Scenes (`events.json`)

```jsonc
{
  "c1": {
    "title": "The Cellar Stair", "area": "C1",
    "text": [ "Read-aloud. Two to four sentences." ],
    "notes": [ "Optional. Plain lines for the player that are not read-aloud: a size, a stat line, a rule." ],
    "choices": [
      { "id": "look-door", "mode": "plan", "text": "Look at the door.", "say": [ "Oak, swollen in its frame." ] },
      { "id": "listen", "mode": "act", "text": "Listen at the door.", "turns": 0,
        "check": { "skill": "listen" },
        "on": { "success": { "flag": { "set": ["heard-rats"] }, "say": ["Scratching. Squeaks. Many."] },
                "fail":    { "say": ["Nothing."] } }, "once": true },
      { "id": "made", "mode": "fate", "ability": "know-how-made", "text": "I Know How This Was Made.",
        "effects": { "flag": { "set": ["door-silent"] }, "say": ["..."] } },
      { "id": "home", "mode": "act", "text": "Row home.", "effects": { "goto": { "hub": true } } }
    ]
  }
}
```

**The gate.** Every choice has a `mode`:

| Mode | Cost | Drawn |
|------|------|-------|
| `plan` | Free. No time, no dice. Must not have `turns` or `check`. | Dashed border |
| `act` | `turns` (default 0) tick first, then any `check`, then effects. | Solid border |
| `fate` | Free. Spends one use of `ability` (which some living member must have unused). | Double border |

The view names the gate the first time a scene shows both a `plan` and an `act` choice: *Planning is free. Acting costs time.* Use the Year Two words, **Planning** and **Execution**, in packs for the Fort.

**Outcomes.** A choice has either `effects`, or `check` plus `on: {style?, success, tie?, fail}`. A missing `style` uses `success`. A missing `tie` uses `success` (fate4df: success at a cost; put the cost in `tie` when there is one). `say` lines are shown under the scene text and kept in `scene.said`. A choice with `"once": true` stays in its place after it is taken, greyed, with the reason *Done.*, so the number keys do not shift.

**Leaving.** A scene opened from the map gets a last choice, *Leave* (`theme.labels.leave`), which closes it. Set `"noLeave": true` to remove it (a trap, a fight about to start). The auto choice has the id `leave`; a scene that defines its own choice with that id gets no auto choice. Hub and interrupt scenes must have their own way out.

**Conditions** (`"if": {...}` on a choice; an unmet choice is shown greyed, with `reason`, so number keys stay stable):
`flags: []`, `notFlags: []`, `items: {id: n}`, `member: id` (in the party and up), `ability: id` (unused), `fate: n` (some member has n), `gold: n`, `visited: "<area>"`.

### Effects: the whole vocabulary

Items, abilities, scene choices, encounters' `onWin` and hub actions all use these ten verbs, and nothing else. Apply them in this order:

| Verb | Shape | Does |
|------|-------|------|
| `flag` | `{set: [], unset: []}` | Story flags |
| `item` | `{add: {id: n}, remove: {id: n}}` | Shared party pack. `gold` is an item id. |
| `damage` | `{who, amount, track?}` | Marks harm. `amount` is a number or dice (`"1d8"`). |
| `heal` | `{who, amount, track?}` | Clears marks |
| `condition` | `{who, add?, remove?, budget?}` | `asleep`, `tired`, or any pack word. `budget: "2d8"` with `who: "foes"` affects foes in order while their `hd` fits the budget (Sleep). |
| `bonus` | `{who, amount, scope: "next"\|"fight"}` | A modifier to rolls |
| `reveal` | `{map, cells: ["x,y"]}` | Finds secret doors; marks cells seen |
| `fate` | `{who, amount}` | Gives or spends Fate |
| `light` | `{turns}` or `{item}` | Lights a source |
| `goto` | `{scene}` \| `{map, x, y, facing}` \| `{hub: true}` \| `{encounter}` \| `{ending}` \| `{close: true}` | Moves the game. At most one. Applied last. |

Plus `say: []` (lines to show) on any effect block.

`who`: `self`, `target`, `leader` (first living in order), `front`, `party`, `random`, `foes`, `foe` (the targeted foe), `nearest` (with `n`).

---

## 7. Party, monsters, items, abilities, hub, endings

**Characters** (`party.json` → `roster.<id>`):

```jsonc
{
  "name": "The Fighter", "title": "The Next Blacksmith", "npc": true,
  "class": "Fighter", "text": "One-line read-aloud for the roster card.",
  "stats": { "str": 14, "int": 9, "wis": 10, "dex": 11, "con": 13, "cha": 10 },   // fate4df: { "body": 2, ... } as modifiers
  "ac": 15, "hp": 8,                         // ose. fate4df: "tracks": { "meat": 3, "nerves": 3, "systems": 3 }
  "attack": { "name": "sword", "bonus": 0, "damage": "1d8", "stat": "str", "ranged": false },
  "saves": { "D": 12, "W": 13, "P": 14, "B": 15, "S": 16 },
  "skills": { "listen": 1, "forceDoor": 3 },
  "abilities": ["know-how-made"],
  "items": { "torch": 3 },                   // added to the shared pack when the member joins
  "fate": 3,
  "oseLine": "AC 4 [15] · HD 1 (8 hp) · ...",  "note5e": "..."   // shown on the card
}
```

Only the front rank can make a melee attack or be attacked in melee. A back-rank member with a `ranged` attack can fight from the back.

**Monsters** (`bestiary.json`): `ose`: `{name, ac, hd, hp: [..] or "1d8", attack: {bonus, damage, track?}, ml, breakAt?, xp, oseLine, note5e}`. `fate4df`: `{name, rating, stress, attack: {rating, track}, breakAt?, aura?}`.

`aura` (both resolvers): at the start of each round, each living member not using the `avoid` stance rolls `check` and on a fail gains `condition`. `{check: {...}, condition: "flagged", avoid: "guard"}`. Use sparingly.

Both lines of a card, `oseLine` and `note5e`, are shown in the fight view, once for each kind of foe (`view.fight.foes[].card`).

**Encounters** (`encounters.json`): `{foes: [{id, count?, hp?: [..]}], first: "party" | "foes" | {ifFlag, then, else}, reach?, nonLethal?, onWin?: effects, onFlee?: effects, after?: sceneId, text?: [..]}`. `first` decides only round one.

**Items**: `{name, kind: "light"|"use"|"gear"|"treasure", value?, light?: {turns, requires?}, use?: {when: "map"|"fight"|"any", target, effects}}`.

**Abilities**: `{name, text?, kind: "spell"|"power"|"chrome"|"fate", per: "rest"|"delve", uses: 1, when: "map"|"fight"|"any"|"scene", target: "foe"|"foes"|"ally"|"party"|"self"|"none", effects, check?, on?}`. A `fate` ability is used only through a `fate`-mode scene choice.

**Hub** (`hub.json`): `{title, text, places: [{id, label, text, actions: [{id, label, kind, ...}]}], report: {title, lines: {flag: text}}}`. Kinds: `rest` (clears all marks and conditions, restores uses and Fate; `"recover"` packs raise the down; costs `price` gold), `shop` (`stock: [{item, price}]`, and sells treasure at `value`), `scene` (`scene: id`; how the party leaves for the dungeon), `roster` (swap bench members in, fill places left by the dead). When the party comes home, the hub shows `report.lines` for every set flag.

**Endings** (`endings.json`): `{title, kind: "good"|"back"|"dead", text: [..]}`. `rules.endings.wipe` names the ending for a dead party.

---

## 8. Theme (`theme.json`)

```jsonc
{
  "palette":     { "paper": "#F2EAD3", "ink": "#1B1712", "accent": "#7A2E1C", "muted": "#6B6253" },
  "paletteDark": { "paper": "#14120F", "ink": "#E9E0C9", "accent": "#D0704E", "muted": "#9C927F" },
  "fonts": { "title": "Georgia, serif", "body": "Georgia, serif", "mono": "ui-monospace, Menlo, monospace" },
  "titleCaps": true,
  "labels": { "leave": "Leave", "turn": "Turn", "light": "Light", "search": "Search", "rest": "Rest", "map": "Map", "gold": "gp" }
}
```

System fonts only. The view fills any missing label with its English default. `gold` names the money, in the HUD, the shops and the engine's "Not enough …" lines. The F1 help follows the pack's labels (section 9).

---

## 9. The view model and the view

`Crawl.view(pack, state)` returns what the screen needs. The view draws only this, and sends only commands.

```js
{
  mode,
  hud:   { turn, minutes, light: { label, left } | null, dark, tired, gold, area: { key, name } | null },
  party: [ { id, name, title, rank: "front"|"back", down, dead, fate,
             tracks: [ { id, label, max, marked } ], cond: [], abilities: [ { id, name, text, left, usable } ] } ],
  map:   { id, title, x, y, facing,                // facing 0..3
           ahead: [ [L, C, R], ... ],              // depth 0..3; each a cell kind
           can: { forward, back, left, right, act, search, listen, rest },
           automap: { w, h, rows: [ "string per row, unseen cells as space" ] } } | null,
  scene: { id, title, text: [], notes: [], said: [], choices: [ { id, text, mode, enabled, reason } ], gate: bool } | null,
  fight: { round, foes: [ { i, name, state, hp: "label", marked, max, card: [ "stat line", "note" ] } ],   // state: awake | asleep | fled | dead
           members: [ { id, acts: [ "fight", ... ], abilities: [ ids ], items: [ ids ] } ],
           canReroll, canRun } | null,
  hub:   { title, text, places: [ { id, label, text, actions: [ { id, label, kind, enabled, reason, price?, stock?: [ { item, name, price, count, enabled, reason } ], sell?: [ { item, name, value, count } ] } ] } ],
           report: [ "lines" ], reportTitle, bench: [ roster cards of the living members not in the party ] } | null,
  roster:{ need, members: [ { id, name, title, text, npc, stats, card } ] } | null,
  ending:{ id, title, kind, text } | null,
  door:  { who, cost } | null,                       // while mode is "deathDoor": whose box is full, and what Fate staying up costs
  log:   [ last 50 lines ]
}
```

`map` is non-null in the modes `map`, `fight` and `deathDoor`, and in a scene opened from the map; it is null in the hub and in hub scenes.

Cell kinds in `ahead`: `wall`, `open`, `door`, `stuck`, `locked`, `stairs`, `water`. A secret door not yet found is `wall`. Out of bounds is `wall`. `ahead[0][1]` is the party's own cell. When dark, every kind except `ahead[0][1]` is `dark`.

### The screen (portrait first, 360 px wide and up)

```
┌──────────────────────────┐
│ C2 · The Oil Store  T 14 │  hud: area, turn, light, TIRED
│                          │
│   wireframe view         │  square; ink lines on paper; depth 0..3
│   (foe plate in a fight) │
├──────────────────────────┤
│ Fighter ▮▮▮▯  Elf ▮▮▯▯    │  four cards, 2 × 2; front rank on top
│ Paladin ▮▮▮▮  Minister ▮▮ │  tap a card for its abilities
├──────────────────────────┤
│ log, 3 lines, aria-live  │
├──────────────────────────┤
│  ↶   ↑   ↷     [ Act ]   │  thumb zone
│  ←   ↓   →  [Map] [Rest] │  scene: choices replace it. fight: orders replace it.
└──────────────────────────┘
```

- **Wireframe.** Canvas 2D, device-pixel-ratio aware. Lines only, in `ink` on `paper`: walls as trapezoids, doors as a frame inside the wall, stairs as a few steps, water as hatching. No fills except the paper. This is the Otus-ink house look; a theme's palette makes it duotone.
- **Input.** Tap the arrows; swipe on the view (up forward, down back, left and right turn); keys: ↑/W forward, ↓/S back, ←/A and →/D turn, Q/E strafe, Space or Enter act, F search, L listen, R rest, M map, 1–9 choices and orders, Esc closes the map. *Settled at integration:* in the hub, the number keys reach the places' own actions, in order; stall rows are tap, or Tab and Enter (so 1 to 9 always include the way out of a town with a long shop list). On the roster, Enter starts with the default party already picked. In a fight, the first number picks the member's act, and a second picks a foe when more than one can be hit. Tap targets at least 44 px. No horizontal scroll at 360 px.
- **The map.** An overlay draws `automap`, cropped to the squares seen so far plus one square of margin and drawn at a whole-pixel cell size of at most 40 px, and under it the route as a turtle: `FORWARD 30 · RIGHT 90 · FORWARD 20` (10' per cell). The route is kept for each map. This is Module 2's mapping lesson.
- **Scenes.** Read-aloud (`text`) in the title font. `notes` below it in the body font, small and muted: a size, a stat line, a rule, never read-aloud. Choices as buttons with the mode border; greyed choices show `reason`. A taken `once` choice stays, greyed, as *Done.*
- **Fight.** One member at a time: the view asks for each living member's order, then sends one `orders` command. Rolls appear in the log in mono: `Fighter d20 14 +1 = 15 vs AC 12 · hit · 1d8+1 = 6`. On a portrait screen the orders sit in a sheet pinned to the bottom of the screen, two buttons to a row, with *Undo* and *Reroll* beside the question, so no order button is below the fold at 360 × 780. A round writes about nine lines, and the log shows three. So the sheet keeps the lines of the round just played above the next orders (*Last round*, until the next round plays), and when a step writes more than three lines outside a fight the log grows to seven lines and scrolls to the first new one.
- **The hub.** The action that leaves for the dungeon (kind `scene`) is pinned to the bottom of the screen, so it is never below the fold. A stall row the party cannot pay for is greyed, and the line after a purchase shows under the stall.
- **Light and dark.** CSS tokens on `:root` from `theme.palette`; `prefers-color-scheme: dark` uses `paletteDark`. Respect `prefers-reduced-motion`.
- **Saves.** `localStorage["<storage>.<pack id>"]` holds (`<storage>` is `pack.storage`, default `crawl`) `{seed, commands}`, written after each step; the page replays it on load. Wrap every storage call in try/catch; the page must work without storage. `?seed=N` sets the seed; the footer shows it. A *New game* button clears the save: tap it twice within four seconds (no dialog). The line *Planning is free. Acting costs time.* is shown once, and that is remembered in a second key, `<storage>.<pack id>.gate`, which is not part of `{seed, commands}`.
- **Frame bar.** `F1 How to play` (a `<details>` with the controls and the gate) in the static HTML, so it reads with scripting off. Words in it that are labels carry `data-l="<label key>"`; with scripting on, the view sets their text from the pack's labels, so the help says Hit where the button says Hit.
- **Test hook.** `window.CRAWL = { pack, get state(), step(cmd), view(), replay({seed, commands}), seed }`.

---

## 10. Build and validate

- `node crawler/tools/validate.mjs <packdir>`: prints `OK <id>` or a list of errors and exits non-zero. It checks: required fields; ids resolve (events, encounters, monsters, items, abilities, maps, endings, flags used in `if` against flags set anywhere); grid rows equal length; every glyph known; every lettered cell in an area that exists; every link lands on a passable cell; every area reachable from some entry, with secret doors counted as passable (and reports areas reachable only through a secret door); `plan` choices have no `turns` or `check`; resolver-specific monster and character fields; the default party is in the roster. Scene `notes`, if present, are an array of strings. Warnings (not errors): text lines and notes over 400 characters, labels missing.
- `node crawler/tools/build.mjs <packdir> [--out <file>]`: reads `ui/index.html` and replaces `<!-- @style -->`, `<!-- @pack -->`, `<!-- @engine -->`, `<!-- @view -->` with inline `<style>`/`<script>` blocks, and `{{title}}` with the pack title. Default output `crawler/dist/<id>.html`. It looks for `engine/` and `ui/` next to `tools/`, so a vendored copy builds the same way.

---

## 11. Canon and IP rules for pack writers

- **This repo.** Read `AGENTS.md`. Module 2's pinned facts are fixed: names, sizes, numbers, the rat line. Copy the module's read-aloud and stat lines; do not rewrite them. Do not key Halcyon. Never mention the Sleeper. The Door Beneath the Lake is not opened. Use "the Gorgon Queen", never "the Basilisk Queen". Full OSE line plus one 5e note per monster, on its card.
- **Wizardry is someone else's.** Take its structure (the grid, the party of ranks, the town, the camp) and nothing else: no names, spell words, places, monsters, art or text from any Wizardry game.
- **HTLL.** Read `.claude/conventions/writing-style.md` and `design-principles.md` there. Stress is marked, not subtracted. Palettes are the playbooks' own. The pregens' facts come from their files.
- **Style.** Plain words, short sentences. UI labels in Simplified Technical English. Read-aloud in the Wolfe and Vance register: dry, exact, odd, never explaining itself.

---

## 12. Settled at integration

Four agents built the engine, the view and two packs at once, to this file. Where they answered a question differently, or the spec was silent, this is the answer. Items 1 to 16 are also written into the sections above. Items 17 to 22 are engine details, recorded here.

| # | Question | Answer |
|---|----------|--------|
| 1 | How does a hub action swap the party, buy or sell? | `{t:"hub", action, ids}`; `{t:"hub", action, buy, n?}`; `{t:"hub", action, sell, n?}` (section 2). A bare roster action fills the places of the dead from the bench. A `pick` in the hub is the same swap. |
| 2 | What does a fight `target` hold? | A foe's index for `foe`, a member id for `ally`. |
| 3 | Who is at death's door? | `view.door = {who, cost}`. |
| 4 | Are `fight.members[].abilities` and `items` objects? | Arrays of ids. The view reads names from the pack. |
| 5 | Does a wandering hit during a scene vanish? | No. It is queued in `state.queued` and starts when the party is back on the map (section 5). |
| 6 | Does `act` use a link on an unfound secret door? | No. It is a wall until found. |
| 7 | Does a tie pass a check on `fate4df`? | Yes, for `listen`, `search`, `forceDoor` and flee. Packs set difficulties with ties counted. |
| 8 | What does `bonus` add? | Every roll the member makes (`fate4df`); to-hit only (`ose`). |
| 9 | Who is `self` in a plain scene choice? | The leader. In a `fate`-mode choice, the member who spent the ability. A pack that needs the Trouble's holder to be `self` makes two `fate`-mode choices on one ability. |
| 10 | Can a scene mark an encounter done, or open a door? | Not yet. The effect vocabulary stays at ten verbs. Both packs ask for a `done` list on `goto`/effects; it is the first thing to add if a third pack wants it. |
| 11 | Can a scene spend a spell? | Not yet. A scene-only spell is a `fate`-kind ability. |
| 12 | Does the Fort need a calendar? | The engine has turns, not days. Night counts and the restock table are not modelled. |
| 13 | How is the gate line remembered? | A second storage key, `<storage>.<id>.gate`. |
| 14 | How are foe stat cards shown? | `foes[].card`, once per kind, in the foe plate (section 7). |
| 15 | Do the number keys reach a long hub? | Only the places' own actions; stall rows are tap, or Tab and Enter (section 9). |
| 16 | New game: a dialog? | A second tap within four seconds. |
| 17 | An area with an enter scene and an encounter, entered again? | The first entry opens the scene, which must start the fight. A later entry (after a `run`, say) starts the fight directly if it is not done. |
| 18 | How is a round ordered? | A living member with no order fights (front rank, or ranged) or guards. One bad order refuses the whole command. `use` in a fight takes no round. If `first` is `foes`, they act before the party in round one. The party makes one flee roll a round, when the first member orders `run`; a successful run goes back to `state.prev` and ends the fight with the result `flee`. |
| 19 | Whose morale? | The first foe of the group: its `breakAt`, else its `ml`. Broken foes flee and the fight counts as a win: `onWin` runs and `done[enc]` is set. |
| 20 | Who is TIRED? | Everyone once `sinceRest` reaches `clock.tired.every`. A member holding the `tired` condition has the modifier too. |
| 21 | Daylight and spell light? | Daylight snuffs a spell light into `light.stash.spell`. A stashed spell light is relit last, if nothing else is carried. A dark area with no light opens `outScene` once; the guard clears when a light is lit or the party reaches daylight or the hub. |
| 22 | A foe with a condition? | It keeps the word in `foe.state`. `asleep` stops it acting; sleeping foes are still hit. |
| 23 | Does guarding help on `fate4df`? | Yes: the guarding defender's roll gets +2. The rating is not raised (it used to be, which made Guard a trap). |
| 24 | When is `clock.fight` charged? | When the fight ends, so a fight on the sixth turn is not played TIRED. A fight that never ends (a wipe) charges nothing. |
| 25 | What happens to a taken `once` choice? | It stays in place, greyed, reason *Done.* The number keys do not shift. |
| 26 | Where do a size, a stat line or a rule go? | In `notes[]`, not `text[]`. `text` is read-aloud only. |
| 27 | Does the view model carry foe boxes? | Yes: `fight.foes[].marked` and `.max`. The `hp` label stays for screen readers. A stall row carries `enabled` and `reason`; an ability carries its one-line `text`. |
