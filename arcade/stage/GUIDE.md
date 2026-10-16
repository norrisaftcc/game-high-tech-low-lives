# How to build a Stage pack

This guide is for anyone, human or agent, who makes or changes a pack for the Stage. It is generic: the Fort repository and the HTLL repository both carry it. The contract is [`SPEC.md`](SPEC.md). The motion rules are [`MOTION.md`](MOTION.md). Where this guide and the spec disagree, the spec wins.

## 1. What the Stage is

The Stage plays a solo visual novel as a motion picture you step through. It is one engine and any number of packs. A pack is data: the script, the notes, the sets, the theme and the art. The engine knows nothing about your setting. A kit draws the set behind the text. The build writes each pack to one offline HTML file.

The bar is *Neon On-Call*. A pack that does less is not done.

| Neon On-Call does | The Stage does | You supply |
|-------------------|----------------|-----------|
| A moving set under the text | A kit draws it: `paper` (pop-up book) or `feed` (surveillance feed) | `sets.json`, `art/` |
| A deck that slides forward and back | The `turn` cue | A scene change |
| Typewriter; tap to finish, tap to go on | The same | Beats of plain text |
| An act card for each act | A scene card, drawn by the kit | `title` and `place` |
| A HUD that flashes on cost | `cost`, `gain`, `tear` cues | Meters and effects |
| Film mode (AUTO) | The same; stops at every choice, roll, input and reveal | Nothing |
| Sound from code | Web Audio, off until the player turns it on | Nothing |
| A cast cropped from one poster | `cast.json` | One cast sheet |
| ⓘ notes, a manual, `--VERIFY` | ⓘ chips, a commentary track, Help, Verify | `notes.json` |

## 2. Plan before you build

Write the pack's plan first. Put it in the pack's `NOTES.md`, in this order:

1. **Character.** Who plays, in one sentence.
2. **Plot.** The scenes, each in one line, and the endings.
3. **The new perspective.** What the player sees that a plain script would not show. (OSR: the book is the Dungeon Master. HTLL: the Algorithm is the Game Master.)
4. **What the commentary teaches.** One rule or job per scene, and where it first matters.
5. **Canon pins and IP.** What you must not break, and what you made up.

Then write the data (`pack.json`, `script.json`, `notes.json`, `theme.json`). Run `validate` and `sim`. Only then write the sets and the art.

**Why.** The Neon Wake autopsy built one idea two ways. The sand castle took five prompts in a row on one file. The blueprint did a design pass first. The sand castle was quicker to a page that played. Only the blueprint could be changed and checked, and in the sand castle two of three meters decided nothing. Sets drawn before the script is checked are the sand castle.

## 3. Anatomy of a pack

Everything lives in `stage/packs/<id>/` (HTLL: `arcade/stage/packs/<id>/`).

| File | Holds | Required | You usually get wrong |
|------|-------|----------|-----------------------|
| `pack.json` | Identity, `kit`, `resolver`, `start`, `storageKey`, meters, card `fields`, `tallies`, `commentary` | Yes | `storageKey` (`fort-stage.<id>` here, `htll.stage.<id>` in HTLL) |
| `script.json` | Scenes, beats, choice groups, endings | Yes | A scene with none of `next`, `ending`, `route` |
| `notes.json` | Every ⓘ note and every commentary line | Yes | A note over 60 words; a note nothing uses |
| `sets.json` | Each set: a kit and its layers | Yes | A set a scene names but the file lacks |
| `theme.json` | `light` and `dark` token maps, `fonts`, `mapStyles` | Yes | Text below 4.5:1 in one theme |
| `cast.json` | One cast sheet and a face circle per speaker | No | A `speaker` with no entry (a warning until the file exists, then an error). A person with no circle gets the kit's placeholder |
| `art/` | SVG, JPEG, WebP | No | A path in `sets.json` with no file |
| `fonts/` | WOFF2 and their licence | No | A font with no licence |
| `NOTES.md` | Plan, sources, canon pins, what the pack teaches, what you cut | Yes | Writing it last |

### A minimal pack that passes `validate`

Start by copying `packs/test` (paper) or `packs/test-feed` (feed). This is the smallest shape: one scene, one plan group, one exec group, one note, one set.

`pack.json`
```json
{ "id": "tiny", "title": "Tiny", "subtitle": "One room", "kit": "paper", "resolver": "ose",
  "start": "s1", "storageKey": "fort-stage.tiny",
  "meters": [ { "id": "luck", "label": "Luck", "min": 0, "max": 3, "start": 1, "hud": true } ],
  "fields": [], "tallies": {},
  "commentary": { "label": "How the module DMs", "kinds": ["rule"] } }
```

`script.json`
```json
{ "scenes": [ { "id": "s1", "title": "The Room", "place": "Day One · the cellar",
    "look": "ink", "set": "room",
    "beats": [
      { "text": "A door, a lamp and a *cold* draught.", "kicker": "DAY ONE" },
      { "text": "The latch is stiff. Look first, or break it now." } ],
    "choices": [
      { "key": "c1", "ask": "What do you do first?", "gate": "plan", "options": [
          { "key": "a", "label": "Look at the floor", "sub": "No dice, no time", "effects": [ { "flag": "looked" } ],
            "then": [ { "text": "Dust on the floor shows one set of prints." } ] },
          { "key": "b", "label": "Wait and listen", "sub": "No dice, no time" } ] },
      { "key": "c2", "ask": "Force the latch?", "gate": "exec", "notes": ["gate"], "options": [
          { "key": "a", "label": "Force it", "sub": "2d6 + Luck vs 8", "roll": { "dice": "2d6", "add": "luck", "vs": 8,
              "results": { "fail": { "effects": [ { "meter": "luck", "add": -1 } ], "then": [ { "text": "It jams." } ] },
                           "success": { "then": [ { "text": "It gives." } ] } } } } ] } ],
    "ending": "end" } ],
  "endings": { "end": { "title": "Out of the cellar", "look": "paint", "set": "room",
    "beats": [ { "text": "Cold air, and the stair." } ] } } }
```

`notes.json`
```json
{ "gate": { "kind": "rule", "term": "Planning and Execution",
    "text": "Planning is free: look, talk, wait. You can go back. Execution is final: once you break the seal, the dice decide and nothing can be undone." } }
```

`sets.json` (and `art/room.svg`: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="none" stroke="currentColor"/></svg>`)
```json
{ "room": { "kit": "paper", "layers": [ { "prim": "spread", "art": "art/room.svg" } ] } }
```

`theme.json` (the fixture's tokens; every row in the header of `ui/style.css`)
```json
{ "light": { "bg": "#F2EAD3", "panel": "#EAE0C4", "card": "#E3D7B5", "line": "#C9BB98", "ink": "#1B1712", "ink-soft": "#4F4638",
             "muted": "#5F5646", "accent": "#7A2E1C", "lamp": "#7A4806", "good": "#285E33", "bad": "#9A2A1C" },
  "dark":  { "bg": "#14120F", "panel": "#1C1914", "card": "#26221A", "line": "#3A3428", "ink": "#E9E0C9", "ink-soft": "#C9BFA8",
             "muted": "#A89E8A", "accent": "#D0704E", "lamp": "#E0A24A", "good": "#7FC48A", "bad": "#E67A66" },
  "fonts": [], "mapStyles": ["ink", "blueline"] }
```

A meter that hurts as it rises (stress, exposure) takes `"bad": true`, so its rises play as `cost` and its falls as `gain`. A group's `cost` may not name a bad meter.

Then `NOTES.md` (the plan, section 2). Check: `node stage/tools/validate.mjs stage/packs/tiny` prints `OK tiny`.

## 4. Writing beats

A beat is one screen of text.

| Rule | Why |
|------|-----|
| One idea per beat. Two or three short sentences. | The typewriter shows it at 28 ms a character. Long beats are slow. |
| `text` is plain. `*word*` is the only markup, for emphasis. | The shell does the styling. |
| `kicker` is a few capital words above the text: a time, a place, a label. | It orients the player. Use it when the beat changes ground. Not on every beat. |
| `speaker` is a cast id. | The cast sheet crops the face. A speaker with no cast entry fails `validate`. |
| `reveal: true` hides the beat until the player presses R or taps. | For a secret the player earns. AUTO stops there. |
| `screen` holds lines shown on an in-world screen, drawn by the kit. | A terminal, a log, a note. The screen never speaks as a mind (see the setting rules). |
| `when` shows the beat only if the condition holds. | Use it to echo an earlier choice. `sim` flags a beat that no path reaches. |
| `look` (`ink` or `paint`) overrides the scene's look for this beat only. | Use it in an option's `then` when the choice decides the register. |
| `notes` is a list of ⓘ chips. `comment` is one commentary line. | Section 6. |

**A `shift` or a `turn`?** Ask: has time passed?

| Situation | Use | Written as |
|-----------|-----|------------|
| Same moment, new view (close on the lock, then pull back to the room) | `shift` | A beat with `set` |
| Minutes, hours or days pass; or the place changes | `turn` | A new scene (`next`, `route`, or an option's `to`) |
| The story is over | `close` | An `ending` |

A `shift` that hides a jump in time lies to the player. A `turn` for a new camera angle makes time pass that did not.

## 5. The motion grammar

The engine picks the cue from your data. Packs never name a motion. That is why one motion always means one thing.

| Cue | You cause it by | It means, and nothing else |
|-----|-----------------|----------------------------|
| `turn` | A scene change | Time passes |
| `shift` | A beat with `set` | The same moment, a new view |
| `ink` | A beat or scene with `look: "ink"`, or a `reveal` beat; only when the look changes. After a reveal the ink holds, so the next paint beat blooms again | Unwitnessed or secret |
| `bloom` | A beat, scene or ending with `look: "paint"` | Witnessed or public |
| `seal` | Picking an `exec` or `fate` option | The choice is final |
| `roll` | An option with `roll` | The dice decide |
| `cost` / `gain` | An effect `{ "meter", "add" }` below / above zero | Consequence |
| `tear` | A `fate` pick | Player authority used |
| `tally` | An effect `{ "tally", "add" }` | The player's reading of the world changes (the Lens pull-tab) |
| `close` | An `ending` | The story stops |

| Right | Wrong |
|-------|-------|
| "I want the flap to open here." Mark the beat `reveal: true`. The `flap` opens on `ink`. | Add a custom `open` animation to the layer. |
| "A page should turn when they reach the cellar." Make the cellar a new scene. | Fake a turn with a long `shift`. |
| "The Fate ticket should tear." Make the option `gate: "fate"` with a `cost`. | Name a `tear` effect in the script. |
| "Make the Lens tab slide." Add the `pulltab` layer to the set and bind it: `{ "prim": "pulltab", "tally": "lens", "value": "machine" }`. It slides when that value leads. | Add a `glow` to invite the pull. The machine side is left alone unless the player asks. |
| "Shake the screen when they fail." Put the cost in `effects`. `cost` flashes once. | Shake. There is no shake. |

If you need a motion the table lacks, stop and ask for a spec change. Do not hide one in a set.

## 6. Commentary and help

Two channels teach. Use the right one.

| Channel | What it is | Use it for |
|---------|-----------|-----------|
| **Commentary track** (`comment`) | One line under the text, in the pack's commentary voice. The player can turn it off. | What the module or the Algorithm is doing right now. One line per beat, at most. |
| **ⓘ chip** (`notes`) | A button that opens the notes sheet at that note. The sheet keeps every note met. | A term or rule the player may want to look up. |

Every note text is **60 words or fewer**. A note has a `kind` and a `term`. `commentary.kinds` in `pack.json` lists the kinds the track shows. When the track carries more than one voice (the Algorithm and g0), give it a neutral label ("The feed and g0").

A note that teaches odds or a difficulty must not show before the note that teaches the dice. An ending line that quotes an earlier choice ("you said once") is gated on a flag that only that choice sets: a tally-routed ending is also reached by players who chose otherwise. When a scene shows a place line, a kicker and a set clock, all three agree, and "five minutes later" lands on the next scene's time. Art states only what canon gives every player ("TRY IT NEAR OLD STONE", not "WARMS NEAR").

**Teach a rule the first time it matters.** Not before, not only in Help. The first `roll`, the first `exec` group, the first `fate` pick, the first `reveal` each need a note, on the beat that leads into them or in the group's own `notes`. Help repeats; it does not introduce.

| Kind | Use | Example |
|------|-----|---------|
| `rule` | How the game works | *The Lens.* "Old things show at the edge. You read each one as hymn or machine. Neither is wrong." |
| `dm` | How the module does a DM's job | *The DM describes.* "A DM tells you what you see. The read-aloud box does it here." |
| `lore` | The world | *The Lamp.* "The Fort keeps one lamp lit on the water. When it goes out, the Fort is cut off." |
| `handler` (HTLL) | The Handler's dry aside | "Chen is early. Nobody is early to a dead drop unless they are selling." |
| `algorithm` (HTLL) | A flat administrative line | "Subject entered Channel 4. Subject carried one bag. Subject did not look at the camera." |
| `guide` (HTLL) | Ann Sho's GameFAQs-style tip | "TIP: If a door says AUTHORISED ONLY, check what you are carrying. You may be authorised." |

## 7. Gates, rolls, Fate

| Gate | Meaning | What the player sees | Can they go back? |
|------|---------|----------------------|-------------------|
| `plan` | Talk, look, wait. No dice, no time. | A dashed option | Yes |
| `exec` | Dice and consequences. | A solid option; `seal` on pick | No |
| `fate` | Spend a Fate point (`cost`) to act with player authority. | A starred option; `seal`, `tear`, `cost` | No |

- **The first `exec` group in a pack carries a `rule` note in its own `notes` that teaches the gate.** `validate` checks it. A group also takes `comment`. Both show with the ask, before the player commits.
- A condition (`when`, `lock`, `route`) must not read a field that an `input` writes. Typed text cannot be explored, and `validate` rejects it. Use a flag for the choice that matters and keep the typed text for the card.
- Put the mechanical effect in `sub`, in plain words: "2d6 + Luck vs 8".
- `roll` gives `fail` and `success` in `ose`. In `fate4df` it gives `fail`, `tie`, `success` and `style`. Give each result its own `effects` and `then`. A roll with no consequence is not a roll.
- A `fate` group needs `cost`: `{ "meter": "fate", "n": 1 }`. Make a `lock` with a `hint` for the option the player cannot afford, so they see why.
- Check your Fate meter against the setting's pin (the OSR pack starts at 3 of 6). Spend the first Fate pick in a scene that teaches it. Give the player something they could not have done by luck.

## 8. Sets and kits

A kit is a module that draws the stage layer behind the text. It registers itself with `StageKit.register(name, { mount, show, update, cue, finish, tick, card, destroy })`. The view owns the text, HUD and sheets. A kit gets a set (`show`, with the current `state`), plays a cue and returns a Promise when it ends, and draws the scene's title card. `update(state)` runs after every step and restores layers bound to state (the pull-tab) after back, load or save. `finish()` jumps the active cue to its end state and resolves its Promise now: it is what a tap calls. It reads durations and easings from the `--m-*` tokens and never hard-codes them. Under reduced motion, or the Calm setting (`<html data-motion="calm">`), every cue jumps to its end state. `show`, `update` and `tick` get no `reduced` flag, so a kit that animates there reads the attribute. A kit that reads a new theme token adds a row to the token header of `ui/style.css`, or `validate` will not check it. Details: SPEC §4, MOTION.md.

**Kit `paper`** (pop-up book). A set is a list of layers, each `{ "prim", "art", ... }`, with positions as fractions of the stage.

| Primitive | What it is | Moves on |
|-----------|-----------|----------|
| `spread` | The two-page ground | `turn`, `bloom`, `close` |
| `vfold` | Rises from the gutter | `turn`, `ink` |
| `parallel` | A platform that lifts flat | `turn` |
| `tunnel` | Three to five planes; tilt moves them | Drift; drag |
| `flap` | Lifts on `reveal`, shows `under` | `ink` |
| `pulltab` | Slides a second layer out; bound to a tally value | The `tally` cue; `update(state)` restores it |
| `volvelle` | A wheel that turns to the result | `roll` |
| `ticket` | A Fate ticket that tears | `tear` |
| `plate` | A framed image | `bloom`, `ink` |

**Kit `feed`** (the Algorithm's view).

| Primitive | What it is | Moves on |
|-----------|-----------|----------|
| `frame` | A camera frame with timestamp and channel | `turn` (hard cut), `shift` (dissolve) |
| `track` | A box on a cast face, with label and confidence | `turn`, `seal` ("Locked") |
| `scan` | A sweep line | `roll` |
| `log` | Lines of machine text | `roll`, `cost`, `gain`, `tear` |
| `redact` | Bars that lift on `reveal` | `ink` |
| `plate` | A framed image | `bloom`, `ink` |

### Layer properties each kit reads

SPEC §4 names the primitives. Each kit reads more properties than that table lists. These are the ones the shipped kits read; `validate` checks only `art/` paths, so a misspelt property is silently ignored.

**Paper kit**

| Property | Prim | Meaning | Used in `magic-module` |
|---|---|---|---|
| `art2`, `art3`, `art4`, `art5` | tunnel | More planes, far to near. `art` is the farthest. 1 to 5 planes in all, all with one viewBox. | terminal (art to art4), breaths (art to art3), wall (art to art4), milestone (art to art5) |
| `screen` `{x,y,w,h}` | plate | Fractions of the plate (the art box inside the frame) where `beat.screen` lines are printed, in the shell's mono font. Without it, screen lines appear in a free box near the top of the book. | glass |
| `range` `[min,max]` | volvelle | Faces round the rim, default `[2,12]`. On `roll` the wheel stops with the total at the top. | plinth `[2,12]` |
| `center` | volvelle | The face at the top at rest. Default is the middle of `range`. | not used (default 7) |
| `meter` | ticket | The meter id whose points are drawn as boxes. Default `fate`. A hole is punched for each point left, and `tear` splits the ticket. | wall `fate` |
| `x`, `y`, `w` (meaning) | all | SPEC says "fractions of the stage". In the paper kit they are fractions of the book box: a square of side min(stage width, stage height), centred on the stage, at the stage's full height. `x`, `y` are the centre. `w` is the width; the height follows the art's aspect. Defaults: x and y 0.5, w 0.5 (volvelle 0.3, ticket 0.2). | all |
| `spread` (art optional) | spread | `art` fills the whole stage (the art is sliced to fit). A spread with no `art` draws only the gutter. | terminal and glass have none |
| `flap` `art` and `under` | flap | `art` is a lid covering the whole layer box. `under` is the same box, behind the lid. On `reveal` the lid turns up to `--m-flap` degrees and the under sheet's `.d` contour draws on. The under sheet cannot be larger than the lid. | all flaps |
| `pulltab` `art` and `under` | pulltab | `art` is the front card. `under` is the second sheet, same size, tucked behind it. It slides out up to `--m-d4` to the right when the tally leads (the kit shortens the slide so the tab stays inside the stage). The kit tells the shell where the tab is, so the text keeps clear of it wherever the layer sits; a tab near the right edge (`x + w/2` about .87) costs the text the least width. `words: [front, under]` names the two cards for the tab's spoken label. A tap on the tab pulls it fully over. `update()` folds it back when the tally no longer leads. | chamber, pen-autumn, glass, plinth |
| `look` | plate | `paint` blooms (wash and lamp, settles by `--m-tilt`). `ink` draws the `.d` contour. | cover, pen-stone, muster-pen, milestone (paint); glass, breaths (ink) |
| Art vocabulary | all SVG art | SVG is inlined. Strokes and fills use currentColor, which is ink, or Blueline blue in the Blueline map. Fill classes: `fi` ink, `fp` paper, `f1` tint-1, `f2` tint-2, `fg` plate-gold, `fu` plate-umber, `fs` rule grey. Stroke classes: `sg`, `su`, `ss`. One `path.d` with `pathLength="1"` is the contour the ink cue draws, and it must be the only stroke of that contour (shapes beneath it use stroke="none"). Text fills with `--k-text`. | all art |
| Text on a layer | all SVG art | Text must sit on a `fp` paper fill, never directly on gold, umber or a tint. A label on a flap or pull-tab must be at least 10 px at 360x640: the SVG font-size in user units times (layer w x book side / viewBox width) is at least 10. | all art |
| Tokens read | kit | `--k-text` (new, kit-local): ink in the ink map; in Blueline, a mix of 12% Blueline and 88% `--st-ink`. `--plate-gold`, `--plate-umber`, `--blueline` (pack names, with fallbacks) are used as before. | theme.json |

**Feed kit**

The feed kit's layer properties. SPEC section 4 names only the primitives (frame, track, scan, log, redact, plate), so none of these properties appear there. "dd" means The Dead Drop uses it. Coordinates x, y, w, h are fractions.

| Prim | Property | Meaning | dd |
|---|---|---|---|
| any | `space` | "cam" (fractions of the art) or "stage" (fractions of the stage). Defaults: track is cam; log, redact, plate and scan are stage | yes (ledger log and plate, phone redact, former cup redact) |
| frame | `art` | Path of the art. SVG is inlined and sanitised (script, foreignObject, on* attributes and any href not starting with # are removed). Anything else is an img | yes |
| frame | `channel`, `view` | The top-left chip: "CH 3 · FLOOR" | yes |
| frame | `time` | Clock start "HH:MM:SS". The scene's place line overrides hours and minutes and keeps these seconds | yes |
| frame | `status` | A centred chip such as "NO SIGNAL" | yes (blind) |
| frame | `static` | Noise over the art | yes (blind) |
| frame | `file` | The art carries data-band borders that show by exposure band | yes (ledger) |
| frame | `focus` [x, y] | The art point to anchor. y sits 30% down the stage; x is used only when the set has no tracks, plates or cam-space logs or redactions | yes (ledger [.5,.22]) |
| frame | `aspect` | Overrides the art's aspect | no |
| track | `cast`, `x`, `y`, `w` | The person, and the box centre and width as fractions of the art (the box is square) | yes |
| track | `label` or `bind` + `labels` | A fixed label, or a field plus a map from its value to text; a value not in the map falls back to the value with any "(...)" removed | yes |
| track | `conf` | A number sets the confidence; false hides it | yes |
| track | `confs` | NEW. Map from the bound field's value to a confidence. Wins over the formula, which is 26 + 12 x exposure capped at 99. An empty-string key covers an empty field | yes |
| track | `face: false` | No portrait, a bare box | yes (far) |
| track | `labelAt: "below"` | The label sits under the box. A label that would reach the chips goes below anyway | yes (corner Chen) |
| log | `lines` | Strings, or { t, red } for a line under a bar | yes |
| log | `on` | The cues that print a line: seal, roll, cost, gain, tear, ink | yes |
| log | `x` or `right`, `y`, `w` | Position as fractions of the space; w is a limit | yes |
| log | `max` | Rows kept (default 8). This is the rolling window of the log | yes (corner 3) |
| log | `modLabel` | The roll's modifier name ("CODE +3 = ...") | yes (corner) |
| log | `keep` | The beat's screen lines stay in the log | yes (ledger) |
| redact | `text`, `x`, `y`, `w`, `h` | Caption under the bar, and the bar's centre and size | yes |
| redact | `opensOn` | "reveal" or "none": whether the bar lifts on a reveal | yes |
| redact | `over: "track"` + `cast` | The bar covers that track's name field | yes (counter) |
| plate | `cast` or `art`, `x`, `y`, `w` | A framed portrait or art. In the stage, w is a fraction of the stage's shorter side. In the cam, it is a fraction of the art | yes |
| plate | `desat: "exposure"` | Greyscale by exposure band | yes (ledger) |
| scan | none | Ambient sweep and the roll pass | yes |

Layout rules the kit applies (behaviour, not properties):
- Cover scale, unless the x span of the tracks, cam plates, cam redactions and cam logs, with half their widths, does not fit in the stage width minus 20 px. Then the cam scales down to fit, centred on the span, and the ground colour fills.
- Any square box is capped to 2 x the smaller of the room above its centre (down to 36 px) and below it (down to 6 px).
- The art's pan comes from the focus line (30% down the stage); there is no pan on phones, where the art height equals or is under the stage.
- Cast `alt` entries ({ when: { field, is }, x, y, r }) swap the crop, as SPEC section 3 already says.
- The clock counts on a one-second timer, not per frame. tick() returns false.

### A SET BRIEF for the kit agent

The script author writes it, one per set, before any art is drawn. It goes at the end of `NOTES.md`.

```
SET BRIEF: <set id>
Scenes and beats that use it: <scene ids; beat indexes where it shifts in>
Look: ink | paint        Art style: <the setting's two looks>
Layers, back to front:
  1. <prim>  art: <what it shows>   moves on: <cue>
Cues this set must answer: <reveal? roll? tear? tally?>  Bound state for update(): <tally or flag, if any>
What the player must read in the end state: <one sentence>
Palette and tokens: <theme tokens only>
Budget: <KB for art>; at most 3 layers move at once
```

## 9. Art and cast

- **One cast sheet** (JPEG or WebP) holds every face. `cast.json` gives each speaker a circle: `{ "x", "y", "r" }` on the sheet. Portraits are crops by background position, as in Neon On-Call. Do not export one file per face.
- **Ink and cut paper are SVG.** Draw with strokes and flat fills. Use `currentColor` or theme tokens, not literal colours, so light and dark both work.
- **Photos and paintings** (the cast sheet, a hero plate) are JPEG or WebP, compressed. The build inlines every file as base64.
- **Size budget.** Aim for under 1 MB of art per pack and under 8 MB for the built page. The hard limit is the SPEC's single offline file; keep a phone in mind. Never put a base64 image on one line in a file you will read: it is not reviewable.
- Fonts are WOFF2 with a licence file. No network, ever.

## 10. Checks

Run these before you hand off. Paths shown for the Fort repository; HTLL prefixes `arcade/`.

| Run | Expect | If it fails, it usually means |
|-----|--------|-------------------------------|
| `node stage/tools/validate.mjs stage/packs/<id>` | `OK <id>` | A dangling id (scene, set, note, speaker, art path); a note over 60 words; a missing `next`/`ending`/`route`; the first `exec` group without a gate note in its `notes`; a condition on a field an `input` writes; a bad storage prefix |
| `node --test stage/engine/test.mjs` | `# fail 0` | You changed the engine or a fixture. Stop. Engine changes need a spec change |
| `node stage/tools/sim.mjs stage/packs/<id>` | Every ending reached; no unreachable scene, beat or note | A `when` that no path can satisfy; a route with no fallback; an option set no path picks; a note nothing cites; a roll tier the dice cannot reach (4dF + 0 against 2 has no `style`) |
| `node stage/tools/build.mjs stage/packs/<id>` for every pack, then `node stage/test.mjs` | `PASS` | See below |

**What `sim` explores.** It does not walk every path. It splits states only on what changes behaviour: keys read by a `when`, `lock` or `route`, a roll's `add`, and a group's `cost`. A flag nobody reads costs nothing. It returns one replayable *route* for each distinct state that reaches an ending: steps like `{ "opt": "b", "result": "success" }`. `Stage.replay(pack, route)` plays a route and forces the roll tier. `test.mjs` and the Verify sheet play routes, not every path. If a beat is wrongly "unreachable", the condition reads a key the pack never sets.

When `test.mjs` fails:

| Test | Usually |
|------|--------|
| No network reference | An `http` link or external font in a set, theme or text |
| Forbidden names | A name from the setting's list in a beat, note or SVG text |
| Every simulated route played by keyboard (`Stage.replay` forces the roll tiers) | A choice with no selectable option; a `lock` that always shows; a state the sim projected away but the script reads |
| Reduced motion leaves no running animation | A kit animation with `fill: forwards` and no end style |
| No horizontal scroll at 360 and 1280 | A layer with a fixed pixel width |
| Works with `localStorage` throwing | Storage outside try/catch |
| No console errors | A missing art path; a bad cue payload |
| Verify routes and path counts match `sim` | The pack changed since the last build: rebuild |
| Commentary toggle; every ⓘ chip opens its note | A `notes` id not in `notes.json`; a `comment` of a kind not in `commentary.kinds` |
| 4.5:1 in light and dark | A token the pack set in one theme only |

## 11. Building with agents

The plan for the first build (`PLAN.md`) is the model.

1. **The lead freezes the spec.** `SPEC.md`, `MOTION.md` and this guide are the contract. Agents never edit them. An agent that needs a change stops and reports it.
2. **Builders are Sonnet agents that own disjoint files.** Wave 1: engine, shell, and one script agent per pack (no sets, no art). Wave 2: the kit agents (kit, `sets.json`, art) and the test agent. No two agents write the same file.
3. **Reviewers last, read only.** Canon and IP; access and motion; phone performance. Each reports; the lead fixes.
4. **One pull request per wave, opened for review early,** so Copilot reviews while the next wave builds. The lead commits. Agents do not commit, push or switch branches.

**Prompt skeleton: pack-script agent**
```
You write the SCRIPT for the Stage pack "<id>" in <repo>. You own only stage/packs/<id>/
(pack.json, script.json, notes.json, theme.json, NOTES.md). Do not touch sets.json, art/, engine/, ui/.
Read first: stage/SPEC.md (it wins), stage/MOTION.md, stage/GUIDE.md, <the repo's rules file>, <the source scenes>.
Plan first: write the plan section of NOTES.md (character, plot, new perspective, what the commentary teaches).
Then write the data. Packs never name a motion. Notes are 60 words or fewer; teach each rule the first
time it matters; the first exec group's lead-in beat carries the gate note.
Write one SET BRIEF per set at the end of NOTES.md.
Done when: validate prints OK, sim reaches every ending with nothing unreachable, and NOTES.md answers the
canon and IP checklist. If SPEC.md is unclear or blocks you, stop and report. Never edit it.
Report: files written, line counts, spec ambiguities, what you left vague.
```

**Prompt skeleton: kit agent**
```
You write the KIT and the SETS for the Stage kit "<paper|feed>" in <repo>. You own only
stage/ui/kits/<kit>.js, stage/packs/<id>/sets.json and stage/packs/<id>/art/ (and cast.json for feed).
Read first: stage/SPEC.md §3-4, stage/MOTION.md (every cue, every primitive), stage/GUIDE.md §8-9,
the pack's NOTES.md SET BRIEFs. Register with StageKit.register. Read all timing from --m-* tokens.
Animate only transform and opacity, from a start state to the element's own style. Every primitive has a
static end state. Under reduced motion do not call animate.
Done when: every primitive in the SPEC is drawn, every set in the brief is built, the pack builds and
test.mjs passes. Never edit SPEC.md or MOTION.md; report a conflict instead.
```

## 12. Setting rules

This guide does not copy a setting's rules. Read them before you write a word.

| Repository | Rules file | What matters most for a pack |
|------------|-----------|------------------------------|
| Fort (OSR) | `AGENTS.md` | IP (take structure, never expression); Halcyon may be named, never keyed; the Sleeper never appears; the Terminal never speaks as a mind; the Brush (machine side at brush depth unless the player asks); Elmore (colour) and Otus (ink) looks; Planning/Execution words; storage `fort-stage.` |
| HTLL | `CLAUDE.md`, `arcade/personas/README.md` | Duotone per playbook; Handler lines under 90 characters; the Algorithm in Simplified Technical English; no profanity, no emoji; storage `htll.` |

Each repository's `stage-pack` skill (`.claude/skills/stage-pack/SKILL.md`) carries the exact commands and the canon checklist.
