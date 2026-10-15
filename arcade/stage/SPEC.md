# The Stage: Spec

The Stage plays a solo visual novel as a motion picture you step through. It is one engine and any number of packs. A pack is data: the script, the notes, the sets, the theme and the art. The engine knows nothing about clerics, coffee or the Fort. The build writes each pack to one HTML file that opens from disk.

This spec is **frozen** for the first build (see [`PLAN.md`](PLAN.md)). An agent that needs a change stops and reports it; the lead changes the spec, then the code. Where this file and any other disagree, this file wins.

The model for the production value is *Neon On-Call* (team-ycbbb, `spooks/neon-on-call/`). The model for the layout is the crawler: `engine/`, `ui/`, `tools/`, `packs/`, one `test.mjs`.

## 1. Files

```
stage/
  SPEC.md  PLAN.md  MOTION.md  GUIDE.md  README.md
  engine/stage.js        rules only: state, conditions, effects, dice, cues, simulate. No DOM.
  engine/test.mjs        node --test, no browser
  ui/index.html          the shell, with @style @pack @engine @view @kit markers
  ui/style.css           the shell's styles; every colour and length is a custom property
  ui/view.js             deck, typewriter, HUD, sheets, chips, keys, audio, film mode
  ui/kits/paper.js       the pop-up book: page turn, folds, tunnel, flap, pull-tab, volvelle, ticket, reveal ink
  ui/kits/feed.js        the surveillance feed: frames, tracking boxes, scan, log, redaction
  tools/build.mjs        node stage/tools/build.mjs stage/packs/<id> → stage/dist/<id>.html
  tools/validate.mjs     schema and reference checks; prints OK <id>
  tools/sim.mjs          walks every path; prints endings and unreachable nodes
  packs/test/            a fixture that uses every feature, paper kit
  packs/test-feed/       the same fixture in the feed kit and fate4df
  packs/magic-module/    the OSR pack: the elf cleric
  test.mjs               Playwright, every built pack
  dist/                  built files (committed, as in crawler/)
```

The HTLL repository vendors `engine/`, `ui/`, `tools/`, `SPEC.md`, `MOTION.md`, `GUIDE.md`, `test.mjs`, `packs/test/` and `packs/test-feed/` byte for byte into `arcade/stage/`, with a `check-vendor.mjs` like the crawler's. Its own pack is `arcade/stage/packs/dead-drop/`.

## 2. A pack

| File | Holds | Required |
|------|-------|----------|
| `pack.json` | Identity, kit, resolver, meters, card fields, start scene, storage key | Yes |
| `script.json` | Scenes, beats, choice groups, endings | Yes |
| `notes.json` | Every ⓘ note and every commentary line | Yes |
| `sets.json` | Each set: a kit and its layers | Yes |
| `theme.json` | Two themes as custom-property values; fonts; map styles | Yes |
| `cast.json` | One cast sheet image and a face circle for each speaker | No |
| `art/` | SVG and JPEG/WebP files the sets and cast name | No |
| `fonts/` | WOFF2 files and their licence | No |
| `NOTES.md` | Sources, canon pins, what the pack teaches | Yes |

### pack.json

```json
{ "id": "magic-module", "title": "The Magic Module", "subtitle": "The elf cleric",
  "kit": "paper", "resolver": "ose", "start": "s1",
  "storageKey": "fort-stage.magic-module",
  "meters": [ { "id": "fate", "label": "Fate", "min": 0, "max": 6, "start": 3, "hud": true } ],
  "fields": [ { "id": "lens", "label": "The Lens", "side": "front" } ],
  "tallies": { "lens": ["hymn", "machine"] },
  "commentary": { "label": "How the module DMs", "kinds": ["dm", "rule"] } }
```

- A meter that is bad when it rises (stress, exposure) has `"bad": true`; its rises play as `cost`.
- `kit` is `paper` or `feed`. `resolver` is `ose` (dN notation) or `fate4df`.
- `storageKey` starts with `fort-stage.` in this repository and with `htll.` in HTLL; the usual key is `fort-stage.<id>` here and `htll.stage.<id>` there. The vendored fixtures (`test`, `test-feed`) keep `fort-stage.` in both.
- `fields` are the card the player carries away; `side` is `front` (the default) or `back`, the face of the card in the Card sheet. `tallies` maps each tally to its allowed values (a map, never a list of ids); a choice adds to one value (the Lens: hymn, machine). `validate` rejects any other value.
- `commentary.kinds` lists the note kinds a `comment` may use; `validate` rejects any other kind. A note shown in the track also joins the Notes sheet.
- **`look` is the witness register, not the art style.** `paint` means witnessed (cue `bloom`); `ink` means unwitnessed (cue `ink`). The art style of a set (Elmore or Otus) is named in the set brief and drawn by the kit; an Otus interior can be witnessed.

### script.json

```json
{ "scenes": [ {
    "id": "s1", "title": "The Queen's Chamber", "place": "Year One · the Gorgon Caves",
    "look": "ink", "set": "chamber",
    "beats": [
      { "text": "…", "kicker": "YEAR ONE", "notes": ["lens"], "comment": "dm-describes" },
      { "text": "…", "speaker": "cassandra" },
      { "text": "…", "reveal": true, "when": { "tally": "lens", "top": "machine" } }
    ],
    "choices": [ {
      "key": "lens1", "ask": "What do you see in the carved eyes?", "gate": "plan",
      "options": [
        { "key": "a", "label": "Wards", "sub": "Lens: hymn", "effects": [ { "tally": "lens", "add": "hymn" } ] },
        { "key": "b", "label": "Sensors", "sub": "Lens: machine", "effects": [ { "tally": "lens", "add": "machine" } ],
          "then": [ { "text": "…" } ] }
      ] } ],
    "next": "s2" } ],
  "endings": { "milestone": { "title": "…", "look": "paint", "set": "road", "beats": [ { "text": "…" } ] } } }
```

**Scene**: `id`, `title`, `place`, `look`, `set`, `beats`, `choices` (zero or more groups, played in order after the beats), and one of `next` (a scene id), `ending` (an ending id) or `route` (a list of `{ "when": cond, "to": id }`, first match wins, last entry has no `when`).

**Beat**: `text` (plain text; `*word*` is the only markup, for emphasis), and optional `kicker`, `speaker` (a cast id), `set` (changes the set inside the scene), `notes` (ⓘ chips), `comment` (one commentary note id, shown in the commentary track), `reveal` (hidden until the player reveals it), `screen` (a non-empty array of strings shown on an in-world screen, kit-drawn), `look` (overrides the scene's look for this beat only; use it in an option's `then` when a choice decides the register, as in the cleric's *Nine Breaths*), `when`.

**Choice group**: `key`, `ask`, `gate`, optional `cost` (`{ "meter": "fate", "n": 1 }`, only with gate `fate`), `notes` and `comment` (as on a beat; shown with the ask, before the player commits), `options`.

**Option**: `key`, `label`, optional `sub` (the mechanical effect in plain words: shown under the label), `when` (hidden when false), `lock` with `hint` (greyed while the condition is false, with the hint shown), `effects`, `then` (beats played after the pick), `to` (leave the scene now: a scene id or an ending id), `roll`, `input`.

- `gate` is `plan`, `exec` or `fate`. A `plan` pick can be changed by going back. An `exec` or `fate` pick cannot. This is the Planning/Execution gate; the view shows it, and the first `exec` group in a pack must carry a `rule` note in its `notes` that teaches it (`validate` checks this).
- `roll`: `{ "dice": "2d6" | "1d20" | "3d6" | "4dF", "add": "<meter id>", "vs": n, "results": { "fail": {…}, "success": {…}, "style": {…} } }`. Each result is `{ "effects", "then" }`. `ose` reads `fail`/`success` (meet or beat `vs`). `fate4df` reads `fail` (below `vs`), `tie` (equal, falls back to `fail` if absent), `success`, `style` (`vs` + 3 or more, falls back to `success`).
- `input`: `{ "field": "public", "prompt": "…", "max": 140 }`. The player types; the text goes to that card field. Simulation fills it with `"(typed)"`. No condition may read a field that an `input` writes; `validate` rejects it, because typed text cannot be explored.

**Conditions** (`when`, `lock`, `route`): `{ "tally": "lens", "value": "machine", "gte": 1 }` (also `lte`; a count of one value), `{ "flag": "x" }`, `{ "field": "x", "is": "y" }`, `{ "meter": "fate", "gte": 1 }` (also `lte`), `{ "tally": "lens", "top": "machine" }` (that value leads or ties), `{ "all": [ … ] }`, `{ "any": [ … ] }`, `{ "not": cond }`.

**Effects**: `{ "flag": "x" }`, `{ "set": { "field": "value" } }`, `{ "meter": "fate", "add": -1 }`, `{ "tally": "lens", "add": "hymn" }`.

**Endings**: `title`, `look`, `set`, `beats`. Every ending must be reachable (`sim.mjs` fails otherwise).

### notes.json

```json
{ "lens":         { "kind": "rule", "term": "The Lens", "text": "Old things show at the edge. You read each one as hymn or machine. Neither is wrong." },
  "dm-describes": { "kind": "dm",   "term": "The DM describes", "text": "A DM tells you what you see. The read-aloud box does it here." } }
```

`kind` is one of `rule` (how the game works), `dm` (how the module does a DM's job), `lore` (the world), `handler`, `algorithm`, `guide` (HTLL voices). A note opens from a chip in a sheet; a `comment` note appears in the commentary track under the text, and the track can be turned off. Every note text is 60 words or fewer.

### sets.json

```json
{ "chamber": { "kit": "paper", "layers": [
    { "prim": "spread",  "art": "art/chamber-back.svg" },
    { "prim": "vfold",   "art": "art/eyes.svg", "x": 0.5, "y": 0.55, "w": 0.6 },
    { "prim": "flap",    "art": "art/plinth.svg", "under": "art/plinth-under.svg", "opensOn": "reveal" } ] } }
```

Positions are fractions of the stage. Each kit defines its primitives in section 4. A set never names a motion; the engine's cues decide what moves (section 3).

### theme.json

Two themes, `light` and `dark`, each a map of custom-property names (without `--`) to colours. The names the shell and kits read are listed at the top of `ui/style.css`, in the block TOKENS THE SHELL READS; `validate` checks that both themes define every one. In that block, a row `a | b` is one token under either name (define one of them); `x, y` names separate tokens (define each); a row marked optional is not checked. A kit that reads a new token adds a row. A pack may define more (the OSR pack keeps Blueline's names). The OSR pack copies Blueline's `paper` and `lamp` values. `fonts`: `[{ "family", "file", "weight", "style" }]`, embedded by the build as base64. `mapStyles`: `["ink", "blueline"]`; the first is the default and the reader can toggle.

### cast.json

`{ "sheet": "art/cast.jpg", "w": 1200, "h": 660, "people": { "chen": { "name": "Manager Chen", "role": "…", "x": 400, "y": 220, "r": 90 } } }`. Portraits are crops of the one sheet by background position, as in Neon On-Call. A person with no `x`, `y` and `r` has no portrait: the paper kit draws an ink silhouette, and the feed kit draws a staticky outline labelled **VIDEO FEED DISABLED**. `cast.json` may then omit `sheet` if no person has a crop.

## 3. The engine

`engine/stage.js` defines `Stage` (a global in the browser, `module.exports` in Node). It has no DOM and no timers.

```js
const game = Stage.create(pack, { seed: 42, save: null });
game.view()            // → { node, scene, beat, group, options, meters, fields, tallies, flags, cues, canBack }; scene.look and beat.look are the effective look
game.next()            // advance one beat; at a choice group, does nothing
game.choose(optKey)    // pick an option in the current group; returns view()
game.reveal()          // reveal the current beat if it is a reveal
game.input(text)       // answer an input option
game.back()            // review one beat back; undoes the last pick only if its gate was plan
game.save()            // → JSON string
Stage.replay(pack, route, { seed, upTo }) // → a game played through a route (or its first `upTo` choices); a step's `result` forces that roll tier (dice faces are drawn within the tier, seeded)
Stage.create(pack, { seed, force: ['fail', …] }) // `force` steers the next rolls to the given results, in order
Stage.simulate(pack)  // → { paths, endings: { id: count }, routes, unreachable: [ids], locked: [ids] }
Stage.validate(pack, warnings) // → [error strings]; warnings, if given, is an array that receives warning strings
Stage.check(pack)      // → { errors, warnings }
```

**Simulation.** Every path cannot be walked: the cleric alone has billions. `simulate` explores states projected onto the keys that change behaviour: those read by any `when`, `lock` or `route`, by a roll's `add`, and by a group's `cost`. Writes nobody reads do not split states. It counts paths with multiplicity (as numbers; large counts are fine), takes as a branch every roll result the dice can reach from the current modifier (4dF + 0 against 2 cannot reach `style`) and fills inputs with `"(typed)"`. `routes` is one representative path (a list of steps: `{ "opt": "a" }`, `{ "opt": "b", "result": "success" }`, `{ "input": "(typed)" }`) for each distinct projected state that reaches an ending; Verify lists them and replays one on tap. `unreachable` lists scenes, beats (by `scene:index`), options, endings and notes never reached (a note is reached when a reached beat or group names it); `locked` lists options that some route sees locked.

`node` is `beat`, `choice`, `input`, `roll` or `ending`. Dice use mulberry32 seeded from `seed`; `?seed=N` sets it in the browser and the footer shows it.

**Cues.** Each step returns `cues`, a list the view plays in order. A cue is an object with a `type` (the names below) and its fields: `turn {dir}`, `roll {dice, faces, total, add, vs, result, used}` (`used` is the result table read after the tie and style fallbacks), `cost`/`gain {meter, n}`, `tally {id, value}`. Within one step the order is: `seal`, `tear`, `roll`, `cost`/`gain`, `tally`, then `turn` or `shift`, then `ink`/`bloom`. `ink` and `bloom` fire on entering a scene and whenever a beat's effective look differs from the previous beat's, not on every beat; a revealed beat always fires `ink`, and the ink stays: the next beat compares its look with `ink`, so a paint beat after a reveal blooms again. The engine picks them from the data. Packs cannot pick a motion, so one motion always means one thing:

| Cue | Fires when | Means, and nothing else |
|-----|-----------|-------------------------|
| `turn` (`dir` +1/−1) | The scene changes | Time passes |
| `shift` | A beat changes the set inside a scene | The same moment, a new view |
| `ink` | A beat with look `ink`, or a `reveal`, comes into view | Unwitnessed or secret |
| `bloom` | A beat with look `paint` comes into view | Witnessed or public |
| `seal` | An `exec` or `fate` pick is made | The choice is final |
| `roll` (`dice`, `faces`, `total`) | A roll resolves | The dice decide |
| `cost` / `gain` (`meter`, `n`) | A meter goes down / up; reversed for a meter marked `bad` (stress rising is a `cost`) | Consequence |
| `tear` | A Fate point is spent | Player authority used |
| `tally` (`id`, `value`) | A tally changes | The player's reading of the world changes (the Lens pull-tab) |
| `close` | An ending is reached | The story stops |

## 4. The view

**Layout** (one screen, after Neon On-Call): top bar (title, endings found, AUTO/STEP, settings, help) · HUD (meters, the Lens tally, the card button) · stage (the kit draws the set; text panels slide over it) · deck (back, a hint line, next). It works at 360 × 640 and up, with no page scroll; long text scrolls inside its panel.

**Text.** Text types out at 28 ms a character, and a beat never takes longer than 4 s to type (the rate rises for long beats). A tap finishes the line; the next tap goes on. Screen readers get the whole line at once through one polite live region, never a character at a time.

**Commentary track.** Under the text panel, one line in the commentary voice when the beat has a `comment`. A toggle in settings hides it. ⓘ chips open the notes sheet at that note.

**Sheets.** Help (controls, how to play), Notes (every note met so far, grouped by kind), Card (the fields, copy as text), Verify (every route and the path count for each ending, as Neon On-Call's `--VERIFY`; tap a row to replay that route), Settings (theme, map style, motion Full or Calm, commentary, sound, AUTO speed). Calm behaves exactly as reduced motion, so ambient motion can be stopped inside the page (WCAG 2.2.2). Calm sets `<html data-motion="calm">` (Full sets `"full"`). Kits get a `reduced` flag in `mount()` and `cue()` only; in `show()`, `update()` and `tick()` they read the attribute or the media query. Each Verify row also has a Last pick button: it replays the route to its final choice (`upTo`).

**Film mode.** AUTO plays beats like a film and stops at every choice, roll, input and reveal.

**Sound.** Web Audio only, no files, off until the player turns it on. One sound per cue at most.

**Keys.** → Space Enter: next. ←: back. 1–9: pick. R: reveal. N: notes. C: card. V: verify. H or ?: help. Esc: close a sheet. A: AUTO. All controls are buttons with labels; targets are 44 px or larger.

**Kit: paper** (the pop-up book). Primitives: `spread` (the two-page ground), `vfold` (rises from the gutter), `parallel` (a platform that lifts flat), `tunnel` (three to five layered planes; tilt moves them), `flap` (lifts on `reveal`, shows `under`), `pulltab` (slides a second layer out when the tally named by its `tally` property leads with its `value`, e.g. `{ "prim": "pulltab", "tally": "lens", "value": "machine" }`), `volvelle` (a wheel that turns on `roll`), `ticket` (tears on `tear`), `plate` (a framed image; `look` paint blooms it, `ink` draws it). `turn` is a page turn. `ink` draws SVG strokes on (stroke-dashoffset). `bloom` is a warm wash and lamplight.

**Kit: feed** (the Algorithm's view). Primitives: `frame` (a camera frame with timestamp and channel), `track` (a box that follows a cast face with a label and confidence), `scan` (a sweep line), `log` (scrolling machine lines), `redact` (bars that lift on `reveal`), `plate`. `turn` is a hard cut with a channel change. `ink` is a redaction lifting. `bloom` is the frame coming into focus.

**The kit interface.** A kit draws the stage layer behind the text. The view owns the text, the HUD and the sheets. `ui/index.html` defines the `StageKit` registry in a small inline script before the kit loads. A kit registers itself:

```js
StageKit.register("paper", {
  mount(root, { pack, assets, reduced }) {},  // once; root is the stage element
  show(setId, set, { instant, state }) {},    // build or swap the set's layers; state as in update()
  update(state) {},                           // after every step: { meters, fields, tallies, flags }; restores bound layers (pull-tab) after back, load or save
  cue(cue, { scene, beat, reduced }) {},      // play one cue; returns a Promise that resolves when it ends (at once if reduced)
  finish() {},                                // jump the active cue to its end state and resolve its Promise now
  tick(t) {},                                 // optional, per frame; returns true while anything moves
  card(scene) {},                             // returns an HTML string: the scene's title card
  destroy() {}
});
```

Optional hooks: `setMap(style)` (the reader changed the map style) and `screen(lines)` (draw a beat's `screen` in the set; without it the view draws the lines in the text panel). The view calls `show()` before the `turn` or `shift` cue that reveals the new set, so the kit can lay it under the old one, then `update(state)` after the cues. `assets` maps each `art/` path to a data URI. Durations, easings and end states come from [`MOTION.md`](MOTION.md) as custom properties (`--m-*`); kits read them, never hard-code them. The view plays cues one at a time and waits for each Promise; a tap during a cue calls `finish()`.

**Reduced motion.** Under `prefers-reduced-motion: reduce` every cue jumps to its end state, text appears whole, and nothing loops. Every primitive has a static end state that reads correctly.

**Performance.** Animate only `transform` and `opacity` in CSS. Canvas at device pixel ratio 2 or less. Stop the frame loop when the page is hidden and when no layer is moving.

**Storage.** `localStorage` under `storageKey`, in try/catch: progress, endings found, settings. Bad or missing data is ignored. The page works when storage throws.

**Network.** None. No external scripts, styles, fonts or images. Fonts and art are inlined by the build.

## 5. Checks

| Run | Expect |
|-----|--------|
| `node stage/tools/validate.mjs stage/packs/<id>` | `OK <id>`. While a pack has no `cast.json` yet, unknown speakers are warnings, so a script can be finished before its cast art |
| `node --test stage/engine/test.mjs` | `# fail 0` |
| `node stage/tools/sim.mjs stage/packs/<id>` | Every ending reached; no unreachable scene, beat or note |
| `node stage/tools/build.mjs stage/packs/<id>` for every pack, then `node stage/test.mjs` | `PASS` |

`test.mjs` checks, for every built pack: no network reference; the pack's forbidden-name list (the OSR pack uses `intro/test.mjs`'s list); every route from `Stage.simulate(pack).routes` played by keyboard (`Stage.replay` forces the roll tiers), so every ending is reached, while path counts are checked in simulation; reduced motion leaves no running animation (`document.getAnimations()`); no horizontal scroll at 360 and 1280 px; works with `localStorage` throwing; no console errors; the Verify sheet's counts match `sim.mjs`; the commentary toggle hides the track; every ⓘ chip opens its note; light and dark both pass 4.5:1 for text (sampled from the computed tokens).
