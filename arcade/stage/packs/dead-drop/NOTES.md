# The Dead Drop (Stage pack)

Shodann at the Harborview dead drop with Manager Chen, seen through the Algorithm's surveillance feed. Kit `feed`, resolver `fate4df`, storage key `htll.stage.dead-drop`.

This file starts with the plan (as `stage/GUIDE.md` section 2 asks), then sources, what was kept and changed, the voice checks, the theme contrast, the checks that ran, and last the CAST BRIEF and ten SET BRIEFs for the feed-kit agent.

## Plan

### Character

Ann Sho, "Shodann", the Infiltrator: Code +3, Fate 3, three identities (Ann Sho the student, Sable Harker the AlgoCratic employee, and the true self, who is never shown). She is three weeks into g0's protocols and about to run her first live dead drop.

### Plot

One morning, one cafe, one drop, one witness. Nine scenes and seven endings.

| Scene | Camera | What happens | Gate |
|-------|--------|--------------|------|
| `arrive` | CH 1 door, CH 3 floor and cup | 06:47. Seven minutes early. Chen is already here. The feed has Chen's name and not yours. | `observe` (plan): the cameras, Chen, or neither. `approach` (plan): proceed, split, abort, change. |
| `counter` | CH 2 | Order the espresso. Pay with the student card, coins or the Harker badge. The feed reads what the register reads. | `pay` (exec) |
| `drop` | CH 3 corner, CH 2 seat 9 | Walk the cup pass. Difficulty 2, or 1 down the blind line. | `pass` (exec, roll) |
| `splitdrop` | CH 3 table 7 | The split-attention pass. Difficulty 3, or 2 timed to Chen's stylus. | `pass` (exec, roll) |
| `table` | CH 3 | Chen stops at the table. Her lines depend on the roll. | `compel` (exec), `lean` (plan) |
| `invoke` | not on feed | Spend a Fate point on an aspect. | `invoke` (fate) |
| `phone` | not on feed, CH 2 | g0's dead image file. Routes to an ending by the roll and by exposure. | none |
| `abort` | CH 3 Chen's table | Sit with Chen. The drop is dropped. | none |
| `change` | CH 4 far side | Another order, another table. The window closes. | none |

Endings (all reached by `sim`):

| Ending | How | Twine outcome it keeps |
|--------|-----|------------------------|
| `clean` "Unresolved" | The drop worked. Exposure 0 or 1. | Success, success with style, tie |
| `noticed` "A Name on the Frame" | The drop worked. Exposure 2 or 3. | The same |
| `logged` "Flagged for Review" | The drop worked. Exposure 4 or more. | The same |
| `debrief` "Debrief" | A direct pass, a blind-line pass or a timed split failed. | Failure (g0 does not burn her) |
| `burned` "Cover Burned" | The untimed split failed. | `failure-end` |
| `aborted` "Safe, and Alone" | Abort. | `abort-engage` |
| `changed` "A Different Cup" | Change the order. | `change-pattern` |

### The new perspective: the Algorithm is the Game Master

The Algorithm sees, scores and logs. It never decides. The player's choices change what the feed can see.

| What the feed does | Where it shows |
|--------------------|----------------|
| Names a face only when it reads a card, a badge or a long look | `counter`: three ways to pay; the track label reads `fields.identity` |
| Holds a confidence figure on each face | The kit ties it to the `exposure` meter (see SET BRIEFs) |
| Has blind spots | `observe.cones` lifts a redaction on the cone map; `drop.pass.blind` is walked inside it; set `blind` shows no track at all |
| Cannot read what is private | Beats with `look: "ink"` and kicker `NOT ON FEED` are Shodann's own. Witnessed beats are `paint`. |
| Cannot read the dead image on a phone | `phone`: the screen stays under a bar |
| Offers complications | `table.compel`: the Algorithm is the GM and offers the Trouble |
| Files a report, or does not | The endings. `burned` ends on "Subject 2 files no report. The feed notes the omission." |

`look` here is the witness register, not the art style (SPEC section 2). Paint is what a camera saw. Ink is what only Shodann knows.

### What the commentary teaches

| Where | Teaches | Note |
|-------|---------|------|
| `arrive` first beat | What a dead drop is. The Blackout. | `lore-protocol`, `lore-blackout` |
| `arrive` track beat | Look first. Splitting is harder. | `g-observe`, `g-split` |
| `arrive` last beat | Planning is free. A redaction can lift. | `rule-plan`, `rule-reveal` |
| `counter` | Execution is final. Exposure. The coffee is a choice. | `rule-gate` (also on the first exec group, as `validate` requires), `rule-exposure`, `g-exposure`, `g-pay` |
| `drop` and `splitdrop` | 4dF: four dice, the stat, the difficulty, tie and style. The odds. | `rule-4df` (on the lead-in beat and on the group), `g-4df` |
| First tie or fail | Stress tracks | `rule-stress` |
| `table` | A compel. Spend Fate on people. | `rule-compel`, `g-fate` |
| `invoke` | Fate points and aspects | `rule-fate` |
| Every ending | One Algorithm line and one g0 line | `a-end-*`, `h-end-*` |

Voices: Algorithm lines are `algorithm` notes, shown as comments. g0 is the Handler: `handler` notes as comments, and g0's texts as speaker beats. Ann Sho's GameFAQs voice is `guide` notes on chips.

### Canon pins and what the pack invents

Pinned from the sources:

- Infiltrator duotone: orange `#FF6B35` and teal `#1B4D5C` (`CLAUDE.md`).
- Code +3, Fate 3 at the start, final tracks Meat 3, Nerves 4, Systems 5 (`sable_harker_pregen.md`).
- Aspects, by their exact names: High Concept "The Algorithm's Most Loyal Vulnerability", Trouble "My Clone Is Learning Faster Than I Am", Connection "Chen Sees Me As The Future". Badge B2C7, orange clearance, loyalty 7.2, the clone's 72.4 GB of training data.
- The Twine's plot, lines, outcomes and Fate thresholds, as listed below.

Reconciled:

- The Twine makes Chen a lecturer at Applied Systems. The pregen makes her Manager YELLOW#A1C4. Here she is both: the feed files her as "Chen, M." with yellow clearance, and Shodann calls her Manager Chen.
- The Twine makes Ann a student with a student card. The pregen makes Sable Harker an AlgoCratic employee. Here the card names Ann and the badge names Sable. The cafe is in the student district, so the badge is the careless choice.

Invented by this pack (the DM may replace any of it):

- The feed itself: channels (CH 1 to CH 4), timestamps, confidence figures, "21 days dark", "4,812 earlier frames".
- Seat 9 (the blind seat behind the espresso machine) and Chen's forty-second stylus rhythm.
- The `exposure` meter, its bands (0-1, 2-3, 4+) and every number that moves it.
- The payment choice, the blind line, the timed pass, the compel, the two invokes.
- g0's lines about the badge and about cash.
- The hook in `burned`: Chen files no report. The Twine says Chen is observant and has not reported. The pack leaves open why.

## Sources

| File | Used for |
|------|----------|
| `build/shodann-solo/scene2-contact.tw` | The plot, choices, lines and Fate rolls (17 passages) |
| `arcade/cabinet/scene-runner.html`, `DEMO` (lines 1026-1248) | The port: the split difficulty 3 (not a stat penalty), the style grading |
| `build/shodann-solo/sable_harker_pregen.md` | Stats, aspects, tracks, chrome (the prosthetic hand is Systems), Fate 3 |
| `build/shodann-solo/shodann_solo_session.md` | The first scene's frame (Chen is early, and an observer) |
| `build/shodann-solo/shodann_gamefaqs_guide.md` | Ann Sho's voice: TIP, WARNING, BOSS, ENDING NOTE |
| `build/shodann-solo/shodann_relationship_map.md` | Chen: "might be turned", has not reported |
| `arcade/personas/README.md` and `personas.json` | The Handler's voice (dry, under 90 characters) and the Algorithm's (flat STE) |
| `CLAUDE.md` | Stats, tracks, duotone, no-emoji and no-profanity rules |

## What was kept from the Twine, and what changed

Kept:

- Every passage's outcome: the four approaches, the four roll results for each roll, both aborts, the burn, Chen's lines in every branch, g0's text in every branch.
- Nerves +1 on a direct fail and a tie; Nerves +2 on a split fail; Fate +1 on style.
- The ink and the paint of the scene: the protocol is private, the cafe is witnessed.

Changed:

| Twine | Pack | Why |
|-------|------|-----|
| Roll thresholds style 5, success 3, tie 1 | `vs` 2, so style 5, success 3, tie 2, fail 1 and below | The spec ties on equal only. A total of 1 was a tie in the Twine and is a fail here. |
| Split uses "modified thresholds" that cancel the -1 | Difficulty 3 (the DEMO's reading) | The Twine's text says harder. Its thresholds made the odds equal. |
| Style adds +1 Fate twice (in the roll and in the passage) | +1 once | A double count. |
| The direct fail charges Nerves only | Also Systems +1 | The prosthetic hand "grinds" (the pregen counts chrome as Systems). |
| Scene 3 is a placeholder | Seven endings; the g0 text and the exposure bands close the scene | `ending` needs a state to end in. |
| "If you want to explore ... go back" | An `ending note` guide line on `abort` and `change` | Back is a Stage feature, so the guide says so in Ann's voice. |
| Pay is automatic (student card) | `pay` is an Execution choice | The identity field and the exposure meter need a first decision the feed can see. |
| No Fate is spent | `table.compel` and `invoke` | The Fate economy needs a way in and a way out. |

Left out:

- The Neural Deck Port and the other chrome. A deck loop would be a good second pass.
- Meat. Nothing in the scene hurts the body. The meter exists so the Card matches the pregen. It never moves.
- Tech and Cool as meters. Only Code rolls. `code` is a meter because `roll.add` must name a meter.

## Meters and fields

| Meter | Range, start | HUD | Bad when it rises | What moves it |
|-------|--------------|-----|-------------------|---------------|
| Fate | 0 to 5, 3 | yes | no | Style +1; a compel accepted +1; a compel refused -1; an invoke -1 |
| Exposure | 0 to 6, 1 | yes | yes | Card +1, badge +2; tie +0 to +2; fail +2 or +3; untimed split success +1; style -1 or -2 (not on the untimed split); a blind-line success -1; the invokes -1 or -3; a compel accepted +1 |
| Nerves | 0 to 4, 0 | yes | yes | Tie +1; fail +1; split fail +2 |
| Systems | 0 to 5, 0 | yes | yes | Any fail +1 |
| Meat | 0 to 3, 0 | no | yes | Nothing here |
| Code | 0 to 3, 3 | no | no | A stat; it never moves |

Exposure, Nerves, Systems and Meat carry `"bad": true` in `pack.json`, so a rise plays the `cost` cue and a fall plays `gain` (SPEC section 2 and the cue table). Fate is not bad: spending it is the `cost`, and winning it back is the `gain`. `tallies` is `{}`: this pack has no Lens, so no tally exists.

| Field | Side | Reads as |
|-------|------|----------|
| `identity` | front | "Ann Sho (student card)", "Unnamed (cash)" or "Sable Harker (staff badge)" |
| `chenKnows` | front | "Nothing yet", "Nothing", "Something is off", "She is watching you", "She caught you", "Only exam stress", "Small talk only" |
| `drop` | front | "Clean", "Complete", "Rushed", "Missed", "Skipped" |
| `learned` | back | The last thing Shodann learned in Planning |

No `input` is used. No condition reads a typed field.

## Voice checks

Run by a throwaway script that is not committed. Real output:

```
handler notes 16, g0 lines 21, longest handler/g0 line 74 chars; algorithm notes 29, sentences 87, longest 11 words; beats 161; failures 0
```

| Check | Result |
|-------|--------|
| Every Handler line under 90 characters (16 `handler` notes, 21 g0 speaker beats) | Longest is 74 |
| Algorithm lines: one idea per sentence, 20 words or fewer, no contraction, no figure of speech | 29 notes, 87 sentences, longest 11 words |
| Every note 60 words or fewer | `validate` agrees |
| No profanity, no emoji, no URL | No hits |
| The forbidden names from the Fort repository (Zenopus, Portown, Sleeper and the rest) | No hits (not this setting's list, run for safety) |

## Theme and contrast

Orange `#FF6B35` and teal `#1B4D5C` are the Infiltrator pair. Two facts shape the theme:

- Orange on teal is 3.27:1. That fails 4.5:1 for text. So the two never sit as text on ground.
- Orange on the light ground is 2.45:1. So the light theme uses a burnt orange `#A33708` for accent text.

The dark theme (the feed) uses the teal as the `line` colour and as the family of the grounds. The light theme uses the teal as `ink-soft` (8.03:1 on the light ground). Every text token on every ground, both themes, is 4.5:1 or better (lowest 4.70:1), and so is the button text. Recomputed 2026-10-15 from `theme.json` with the WCAG formula; no value changed:

Both themes define every token in the block TOKENS THE SHELL READS at the top of `stage/ui/style.css`: `bg`, `panel`, `card`, `line`, `ink`, `ink-soft`, `muted`, `accent`, `lamp`, `good` and `bad`. `validate` checks it. `on-accent` is optional and not set, so the text on an accent button is `bg`; that pair is in the last row of each table. The `line` colour is a hairline and not text, so it has no ratio to meet.

**dark**

| Text | on bg #0A1D24 | on panel #0E2A33 | on card #102F39 |
|------|------|------|------|
| ink #EAF2F0 | 15.20:1 | 13.21:1 | 12.41:1 |
| ink-soft #C4DAD6 | 11.82:1 | 10.26:1 | 9.64:1 |
| muted #9CBDB9 | 8.56:1 | 7.44:1 | 6.99:1 |
| accent #FF6B35 | 6.10:1 | 5.30:1 | 4.98:1 |
| lamp #FFA77E | 9.13:1 | 7.93:1 | 7.45:1 |
| good #6FD3A5 | 9.50:1 | 8.25:1 | 7.75:1 |
| bad #FF8A78 | 7.54:1 | 6.55:1 | 6.16:1 |
| bg #0A1D24 on accent #FF6B35 (button text) | 6.10:1 | | |

**light**

| Text | on bg #E9F0EE | on panel #DAE6E3 | on card #C9DBD7 |
|------|------|------|------|
| ink #0E2A33 | 13.00:1 | 11.74:1 | 10.44:1 |
| ink-soft #1B4D5C | 8.03:1 | 7.25:1 | 6.45:1 |
| muted #3F5F66 | 5.97:1 | 5.40:1 | 4.80:1 |
| accent #A33708 | 5.85:1 | 5.28:1 | 4.70:1 |
| lamp #8A3A12 | 6.74:1 | 6.09:1 | 5.42:1 |
| good #1A5F40 | 6.59:1 | 5.96:1 | 5.30:1 |
| bad #9A2A1C | 6.67:1 | 6.03:1 | 5.36:1 |
| bg #E9F0EE on accent #A33708 (button text) | 5.85:1 | | |

## Checks run

Run 2026-10-15 against the engine at the spec of that day, on the real directory (no stub `cast.json`).

```
$ node stage/tools/validate.mjs arcade/stage/packs/dead-drop
  warn cast.json: speaker "g0" is not in cast.json (21 beats; the pack has no cast.json yet)
  warn cast.json: speaker "ann" is not in cast.json (12 beats; the pack has no cast.json yet)
  warn cast.json: speaker "chen" is not in cast.json (19 beats; the pack has no cast.json yet)
  warn pack.json: storageKey is usually "htll.dead-drop"
OK dead-drop

$ node stage/tools/sim.mjs arcade/stage/packs/dead-drop
dead-drop (feed, fate4df) · 266 paths · 3786 states
endings
  clean                40
  noticed              88
  logged               44
  debrief              70
  burned               18
  aborted               3
  changed               3
routes: 251 distinct end states (first 5; --routes for all)
  changed: observe.none > approach.change  [1 paths]
  aborted: observe.none > approach.abort  [1 paths]
  noticed: observe.none > approach.split > pay.badge > pass.both=style  [1 paths]
  clean: observe.none > approach.split > pay.badge > pass.both=success > lean.invoke > invoke.loyal  [1 paths]
  noticed: observe.none > approach.split > pay.badge > pass.both=success > lean.invoke > invoke.future  [1 paths]
locked options seen: drop:pass.blind, invoke:invoke.loyal, splitdrop:pass.timed
unreachable: none

$ replay every simulated route (Stage.replay) and compare the ending
routes 251 ok 251 bad 0 {"changed":3,"aborted":3,"noticed":88,"clean":39,"logged":44,"burned":18,"debrief":56}
bad meters: exposure,nerves,systems,meat

$ voice checks (throwaway script, not committed)
handler notes 16, g0 lines 21, longest handler/g0 line 74; algorithm notes 29, sentences 87, longest 11 words; max note words 45; failures 0
```

## CAST BRIEF

For `cast.json` and `art/cast.jpg` (the feed-kit agent). One sheet, three tiles. Suggested sheet 960 by 320, one 320 px tile each, `r` 150 in `cast.json`, JPEG quality 80, 120 KB or less. Crops are circles; all pixel coordinates are in the original image. I looked at each crop in a render.

| Cast id | Name | Role | File in `build/art/` | Original size | Face centre, radius | Tile centre on the sheet |
|---------|------|------|----------------------|---------------|---------------------|--------------------------|
| `ann` | Ann Sho | Subject 1 | `ann-sho-at-workxcf.png` | 932 by 936 | (430, 390), r 200 | (160, 160) |
| `chen` | Manager Chen | Subject 2 | none: no crop (decided 2026-10-14) | — | — | — |
| `g0` | g0 | Contact | none: draw the tile | | | (800, 160) |

- **`ann`.** The best match for "Ann" in the Twine: dark bob, orange glasses, the ANN SHO // SHODANN badge, teal and orange. Alternate for the Sable identity: `sable-harker-algocratic.jpeg`, 1620 by 1663, face centre (780, 620), r 370. The kit may swap the portrait when `fields.identity` is the badge (add a `sable` entry; `validate` warns that she never speaks, which is fine).
- **`chen`.** Decided by the user, 2026-10-14: Chen has no portrait in this version. The feed shows her as a **"VIDEO FEED DISABLED"** box: a staticky outline where her face would be. Her metadata still reads ("CHEN, M. · YELLOW CLEARANCE"), but her video is masked. The Algorithm can name her and cannot see her, and that fits the scene. In `cast.json` she has a name and role and no `x`, `y` or `r`; the feed kit draws the disabled box for any person without a crop (SPEC §2, cast.json). The user also confirmed that Chen is both the Twine's lecturer and the pregen's Manager YELLOW#A1C4. Other faces may reuse art from `build/art/`.
- **`g0`.** g0 has no face; the Twine shows only dead image files. Draw a tile: teal ground, an orange "g0" glyph, a noise band across the middle. No portrait.
- Another face for reference, not needed: `infiltrator-infiltrating.jpeg`, 1620 by 972, centre (680, 230), r 170.

## SET BRIEFs

Palette for all ten sets: theme tokens only (`bg`, `panel`, `card`, `line`, `ink`, `ink-soft`, `muted`, `accent`, `lamp`, `good`, `bad`). Art style for all ten: HTLL duotone ink line art (`CLAUDE.md`), flat fills, clean technical lines, drawn as a camera would frame them. Budget for all ten: 40 KB of SVG each and 400 KB in total. The skeleton `sets.json` holds only a `frame` layer per set.

Two kit-wide notes. First, the **exposure meter drives the picture**: the kit should read `state.meters.exposure` in `update()` and set each `track` box's confidence to `30 + 12 x exposure` percent (capped at 99), and tighten the box as it rises. Second, a `track` label reads `state.fields.identity`: empty or "Unnamed (cash)" gives "SUBJECT 1 · UNRESOLVED"; "Ann Sho (student card)" gives "ANN SHO"; "Sable Harker (staff badge)" gives "SABLE HARKER".

```
SET BRIEF: door
Scenes and beats that use it: arrive, beats 0 to 5 (the scene's own set)
Look: paint (witnessed). Beats 2 to 5 are ink (Shodann's own); the frame stays but the kit may dim the track.   Art style: duotone ink
Layers, back to front:
  1. frame   art: the cafe door seen from a high corner camera. Salt-streaked glass, a chrome clinic sign and a chandler's sign at the edges, a dawn light. CH 1.   moves on: turn (hard cut in), shift
  2. track   cast: ann, at the door. Label per identity; confidence 38 percent at the start.   moves on: turn
  3. scan    a slow sweep   moves on: roll (not used here)
  4. log     two or three lines: "CH 1 MOTION", "FACE 38 PCT", "NAME NOT HELD"   moves on: cost, gain
Cues this set must answer: turn, bloom, ink (beats 2 to 5), tally none, reveal none. Bound state for update(): fields.identity, meters.exposure
What the player must read in the end state: one person at a door, boxed, with no name.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: floor
Scenes and beats that use it: arrive, beats 6 to 8 (a `shift` from door)
Look: paint   Art style: duotone ink
Layers, back to front:
  1. frame   art: the wide floor from the ceiling camera. Empty tables, a barista at the back, Chen four tables from the door with a tablet. CH 3.   moves on: shift (dissolve)
  2. track   cast: chen. Label "SUBJECT 2 · CHEN, M. · VIDEO FEED DISABLED". A staticky outline box, no face.   moves on: shift
  3. track   cast: ann at the door, small. Label per identity.   moves on: shift
  4. scan    a sweep   moves on: none
Cues this set must answer: shift, bloom, ink. Bound state for update(): fields.identity, meters.exposure
What the player must read in the end state: two faces; the feed names one.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: cup
Scenes and beats that use it: arrive, beats 9 to 12 and both plan groups; the reveal beats of `observe.cones` and `observe.chen`
Look: paint. The two reveal beats open as `ink` (a redaction lifting).   Art style: duotone ink
Layers, back to front:
  1. frame   art: a close view of the dead drop cup. Handle at four o'clock, a stirrer across the rim. Chen's tablet glow far in the back. CH 3.   moves on: shift
  2. scan    a pass across the cup   moves on: none
  3. log     "CUP: 1", "STIRRER: ACROSS RIM", "MEANING: NOT HELD"   moves on: none
  4. redact  a wide bar across the lower third: it covers the caption "CONE MAP / CHEN RHYTHM"   opensOn: reveal
Cues this set must answer: shift, ink (reveal), bloom. Bound state for update(): none
What the player must read in the end state: a cup the feed sees and cannot explain; a bar that lifts when a Planning choice earns it.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: counter
Scenes and beats that use it: counter, beats 0 to 2 and the three `then` beats of `pay` (reveal on card and badge, no reveal on cash)
Look: paint   Art style: duotone ink
Layers, back to front:
  1. frame   art: the counter from behind the register. A card reader, an espresso machine, the barista's shoulder. CH 2.   moves on: turn (hard cut in)
  2. track   cast: ann at the counter. Confidence 38 percent, rising with exposure. The label changes when the pay beat resolves.   moves on: turn, seal (shows "LOCKED")
  3. redact  a bar over the track's name field, "NAME: ██████████"   opensOn: reveal (card and badge). For cash the bar stays down.
  4. log     "PAYMENT 12 YEN", "READER: CARD / BADGE / NONE"   moves on: gain (exposure rises on card and badge), seal
Cues this set must answer: turn, seal, ink (reveal), gain (the exposure meter goes up). Bound state for update(): fields.identity, meters.exposure
What the player must read in the end state: the name field filled (card, badge) or still black (cash).
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: corner
Scenes and beats that use it: drop, splitdrop and table, every beat; the scene's own set. The roll's `then` beats shift to `blind` in the blind line only.
Look: paint; the private beats are ink   Art style: duotone ink
Layers, back to front:
  1. frame   art: the corner table seen from the ceiling camera. The cup at the window, the dead drop cup three seats down, Chen's table at the far side. CH 3.   moves on: turn
  2. track   cast: ann at the corner table. Confidence from exposure.   moves on: turn, seal ("LOCKED")
  3. track   cast: chen. 97 percent. Her box turns toward Ann when the roll fails or ties (a small tilt only; transform).   moves on: roll
  4. scan    a sweep that runs once for each roll   moves on: roll
  5. log     four dice faces, then "CODE +3 = n VS 2 (or 1, 3)", then the tier   moves on: roll, cost, gain, tear
Cues this set must answer: turn, seal, roll, cost, gain, ink. Bound state for update(): fields.identity, meters.exposure
What the player must read in the end state: two boxed faces; the roll's total and tier in the log.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: blind
Scenes and beats that use it: drop, the `then` beats of the blind-line results (a `shift` from corner)
Look: paint   Art style: duotone ink
Layers, back to front:
  1. frame   art: seat 9 behind the espresso machine. The same view, but the picture is static and grey. Kicker reads "NO SIGNAL". CH 2.   moves on: shift
  2. log     "SEAT 9: NOT COVERED", "GAP: 9 S", "REASON: NOT HELD"   moves on: none
Cues this set must answer: shift, bloom. Bound state for update(): none. There is no track: the feed has nothing here.
What the player must read in the end state: the feed has no face, no box and no reason.
Budget: 30 KB; at most 2 layers move at once
```

```
SET BRIEF: chen
Scenes and beats that use it: abort, every beat
Look: paint   Art style: duotone ink
Layers, back to front:
  1. frame   art: Chen's table with a second chair pulled out. A tablet, a cappuccino, two cups. CH 3.   moves on: turn
  2. track   cast: chen. 99 percent.   moves on: turn
  3. track   cast: ann at the second chair. 99 percent. Both boxes are steady and wide.   moves on: turn
  4. log     "FACES IN FRAME: 2", "DURATION 20 MIN", "EVENT: NONE"   moves on: none
Cues this set must answer: turn, bloom, close (the ending follows). Bound state for update(): none
What the player must read in the end state: two faces side by side, both named, no event.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: far
Scenes and beats that use it: change, every beat
Look: paint   Art style: duotone ink
Layers, back to front:
  1. frame   art: the far side of the cafe from CH 4. The back of a head, a cappuccino, a window with trawler lights. Chen's table is a small shape at the edge, out of focus. CH 4.   moves on: turn
  2. track   cast: ann, from behind. Confidence 22 percent (the back of a head).   moves on: turn
  3. log     "CUP CH 3: CLEARED 07:09", "EVENT: NONE"   moves on: none
Cues this set must answer: turn, bloom. Bound state for update(): none
What the player must read in the end state: a person with her back to the camera, and a cup the feed forgot to care about.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: phone
Scenes and beats that use it: phone, every beat (the first beat is paint; the rest are ink)
Look: ink (Shodann's own). The first beat is paint.   Art style: duotone ink
Layers, back to front:
  1. frame   art: a phone on a table seen from the ceiling. The screen is a block of noise, a dead image file. CH 2 TABLE 9; channel label "PHONE".   moves on: ink
  2. redact  a bar over the phone screen that never lifts: it is what the feed cannot read   opensOn: none
  3. plate   cast: g0, the glyph tile, large, behind the text (the speaker's portrait)   moves on: ink, bloom
Cues this set must answer: ink (the beats), bloom (the first beat). Bound state for update(): none
What the player must read in the end state: the feed sees a screen and cannot read it. The player can.
Budget: 40 KB; at most 3 layers move at once
```

```
SET BRIEF: ledger
Scenes and beats that use it: all seven endings
Look: ink for `clean` and `burned`; paint for the others   Art style: duotone ink
Layers, back to front:
  1. frame   art: the Algorithm's file as a card: a dossier border, a portrait slot, four lines of field names. ARCHIVE.   moves on: close
  2. plate   cast: ann as the file portrait, desaturated for `clean`, in full duotone for `logged`   moves on: bloom, ink
  3. log     the four `screen` lines of the ending, set as machine text   moves on: close
  4. scan    a slow sweep that stops when the feed ends   moves on: close
Cues this set must answer: close, bloom, ink. Bound state for update(): meters.exposure (the file's border thickens in bands: low, medium, high)
What the player must read in the end state: the file, closed or open, with a flag or without.
Budget: 40 KB; at most 3 layers move at once
```

## Spec notes and open questions

Brought up to the spec on 2026-10-15 (wave 1 integration). Nothing in the spec blocks this pack. What is still open:

- `storageKey` is `htll.stage.dead-drop`. `validate` warns that it is usually `htll.dead-drop`. Both start with `htll.`, so row A-13 of `arcade/TESTS.md` holds. The lead gave the first; change it only if the lead says so.
- Chen has no portrait (user decision, 2026-10-14). No script change is needed. Speakers `g0`, `ann` and `chen` are warnings until `cast.json` exists; with it, `validate` makes them errors, so `cast.json` must list all three.
- The Twine's outcomes are unchanged. The script was not edited in this pass.
