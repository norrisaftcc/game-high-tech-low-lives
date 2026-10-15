# Motion

The motion contract for the Stage. It is also the **Motion** section of the Blueline design system. The cue table is in [`SPEC.md`](SPEC.md) §3; the kit rules are in §4. Where this file and the spec disagree, the spec wins.

Blueline gives each signal channel one meaning. Motion is one more channel, with the same law: **one motion, one meaning, and a word beside it.** The engine picks the cue. A pack cannot name a motion. A kit chooses the form (a page turn, a hard cut). It does not choose the meaning.

## 1. Principles

1. **One cue, one meaning.** Each motion below answers one row of the cue table. Do not reuse a motion for a second meaning.

   | Cue | Means, and nothing else | The word that pairs it |
   |-----|-------------------------|------------------------|
   | `turn` | Time passes | The scene's place line: "Year One · the Gorgon Caves" |
   | `shift` | The same moment, a new view | The place line does not change |
   | `ink` | Unwitnessed or secret | Tag "Unwitnessed" (a reveal: "Referee only") |
   | `bloom` | Witnessed or public | Tag "Witnessed" |
   | `seal` | The choice is final | Option label "Sealed"; the hint line says "No going back" |
   | `roll` | The dice decide | The sum and the result: "9 vs 8: Success" |
   | `cost` | Consequence, a meter goes down | Signed number: "−1 Fate" |
   | `gain` | Consequence, a meter goes up | Signed number: "+1 Fate" |
   | `tear` | Player authority used | "★ 1 FP spent" (the star is Blueline's Fate-only glyph) |
   | `close` | The story stops | The ending's title |

2. **Motion never carries meaning alone.** Every cue ends on a still state that says the same thing in words. Skip the motion and nothing is lost. Reading the end state is the whole test.
3. **One end state, three ways to reach it.** A cue can play, be finished by a tap, or be jumped by reduced motion. All three land on the same end state. Write the end state first (as the element's own style); animate *from* a start state *to* it.
4. **No flashing.** No more than three flashes in any second (WCAG 2.3.1). A flash is one decay (`--m-flash`), never a strobe. Flash onsets are at least `--m-flash-gap` apart. A flash tints with `--m-flash-color` at no more than `--m-flash-alpha`. It never fills the screen with white. No value cycles faster than three changes a second (`--m-roll-ticks`).
5. **Ambient motion lives on the set layer only.** It is slow and small (`--m-idle`, `--m-idle-scale`). It pauses while any cue plays. It stops under reduced motion and when the page is hidden. The HUD, text, sheets and buttons are still when nothing has happened. Neon On-Call's blinking LED and glitching numeral are not taken.
6. **Few things move.** At most `--m-layers-max` layers move at once. A group driven by one transform on its parent counts as one.
7. **Only `transform` and `opacity` animate.** No width, height, top, left, blur or box-shadow in motion. A soft focus is a second, pre-blurred layer that fades.
8. **Colour is the theme's.** Motion sets time and alpha. It adds no hue. The one exception: `bloom` may bring in `plate-gold`, because a paint beat is a colour plate (Blueline: plates only).
9. **Sound is a second channel, never the only one.** Off until the player turns it on. At most one sound per cue. Reduced motion does not mute it; the sound setting does.

## 2. Tokens

The shell and kits read these. They never hard-code a timing. **Source** says where each value comes from: *Neon* is read from Neon On-Call's source; *spec* is from `SPEC.md`; *derived* is arithmetic on other tokens; *chosen* is a first guess that nobody has measured on a phone. Tune the *chosen* values in wave 2.

| Token | Value | Source | Use |
|-------|-------|--------|-----|
| `--m-state` | 250ms | Neon | HUD change: meter pip, chip, label fade-in |
| `--m-sheet` | 300ms | Neon | A sheet rises by `--m-d4` (Help, Notes, Card, Verify, Settings) |
| `--m-in` | 450ms | Neon | A text panel arrives |
| `--m-out` | 380ms | Neon | A text panel leaves |
| `--m-cross` | 650ms | Neon | `shift`: the set crossfade |
| `--m-turn` | 650ms | derived | `turn`: 380 out + 450 in, overlapped by 180 |
| `--m-ink` | 800ms | chosen | `ink`: strokes draw on, a flap opens, a bar lifts |
| `--m-bloom` | 700ms | chosen (= Neon's flash) | `bloom`: wash and focus come up |
| `--m-seal` | 300ms | chosen | `seal`: the stamp lands |
| `--m-roll` | 900ms | chosen | `roll`: the volvelle turns, the numbers settle |
| `--m-tear` | 500ms | chosen | `tear`: the ticket parts |
| `--m-close` | 1200ms | Neon (rule sweep) | `close`: the book shuts, the feed ends |
| `--m-flash` | 700ms | Neon | One flash, one decay |
| `--m-flash-gap` | 340ms | derived | Least gap between flash onsets: 1000 ÷ 3, rounded up |
| `--m-hold` | 2000ms | Neon | A delta label stays up |
| `--m-stagger` | 80ms | chosen | Gap between items that enter in turn |
| `--m-type` | 28ms | spec | Typewriter: one character |
| `--m-auto-base` | 2600ms | Neon | AUTO: pause after a line, plus the next token |
| `--m-auto-char` | 42ms | Neon | AUTO: extra pause per character of the line |
| `--m-idle` | 26000ms | Neon | Ambient: one drift, there and back |
| `--m-scan` | 8000ms | chosen | Feed: one scan-line pass |
| `--m-ease-out` | `cubic-bezier(.2,.8,.2,1)` | Neon | Anything that arrives |
| `--m-ease-in` | `ease-in` | Neon | Anything that leaves |
| `--m-ease-inout` | `ease-in-out` | Neon | Ambient drift |
| `--m-ease-linear` | `linear` | Neon | Scan line, AUTO bar |
| `--m-ease-thump` | `cubic-bezier(.3,1.4,.4,1)` | chosen | `seal` only: one small overshoot |
| `--m-d1` … `--m-d5` | 4 · 8 · 16 · 32 · 48px | Neon, on Blueline's grid | Neon's 4, 10, 14, 30, 48 snapped to `space-1`, `-2`, `-4`, `-6`, `-7` |
| `--m-persp` | 1200px | chosen | Perspective for folds and the page turn |
| `--m-fold` | 80deg | chosen | `vfold` and `parallel`: the lying-down angle |
| `--m-flap` | 150deg | chosen | `flap`: the open angle |
| `--m-tilt` | 3deg | Neon (memo, −3deg) | Ticket halves, a plate settling |
| `--m-tunnel` | 24px | chosen | `tunnel`: how far the near plane shifts at full tilt |
| `--m-roll-turn` | 540deg | chosen | Volvelle: extra turn before it stops on the result |
| `--m-idle-scale` | 1.02 | chosen | Ambient scale. Neon's 1.14 is too big behind text |
| `--m-layers-max` | 3 | chosen | Most layers moving at once |
| `--m-roll-ticks` | 3 | derived (WCAG 2.3.1) | Most value changes a second inside `roll` |
| `--m-flash-alpha` | .28 | Neon | Most opacity of a flash |
| `--m-flash-color` | `var(--ink)` | theme | Set by the pack's theme |
| `--m-wash-alpha` | .30 | chosen | `bloom`'s warm wash, held |

**Budgets (computed from the tokens).** The view plays one step's cues in order. The worst step in the spec is a Fate pick with a roll: `seal` 300 + `tear` 500 + `roll` 900 + `cost` 700 = **2400 ms**. A new scene with paint is `turn` 650 + `bloom` 700 = 1350 ms. An ending is `close` 1200 ms. A tap finishes the cue at once, and the next tap goes on. Text starts when the last cue of the step ends.

```css
:root {
  /* time */
  --m-state: 250ms; --m-sheet: 300ms; --m-in: 450ms; --m-out: 380ms;
  --m-cross: 650ms; --m-turn: 650ms; --m-ink: 800ms; --m-bloom: 700ms;
  --m-seal: 300ms; --m-roll: 900ms; --m-tear: 500ms; --m-close: 1200ms;
  --m-flash: 700ms; --m-flash-gap: 340ms; --m-hold: 2000ms; --m-stagger: 80ms;
  --m-type: 28ms; --m-auto-base: 2600ms; --m-auto-char: 42ms;
  --m-idle: 26000ms; --m-scan: 8000ms;
  /* easing */
  --m-ease-out: cubic-bezier(.2, .8, .2, 1); --m-ease-in: ease-in;
  --m-ease-inout: ease-in-out; --m-ease-linear: linear;
  --m-ease-thump: cubic-bezier(.3, 1.4, .4, 1);
  /* distance (Blueline space-1, -2, -4, -6, -7) */
  --m-d1: 4px; --m-d2: 8px; --m-d3: 16px; --m-d4: 32px; --m-d5: 48px;
  /* shape */
  --m-persp: 1200px; --m-fold: 80deg; --m-flap: 150deg; --m-tilt: 3deg;
  --m-tunnel: 24px; --m-roll-turn: 540deg; --m-idle-scale: 1.02;
  /* limits */
  --m-layers-max: 3; --m-roll-ticks: 3;
  --m-flash-alpha: .28; --m-flash-color: var(--ink); --m-wash-alpha: .30;
}
@media (prefers-reduced-motion: reduce) {
  :root { --m-idle-scale: 1; }
  *, *::before, *::after {
    animation-duration: .001ms !important; animation-delay: 0s !important;
    animation-iteration-count: 1 !important; transition-duration: .001ms !important;
    transition-delay: 0s !important; scroll-behavior: auto !important;
  }
  .m-idle { animation: none !important; }
}
.m-idle { animation: m-drift var(--m-idle) var(--m-ease-inout) infinite alternate; }
@keyframes m-drift { to { transform: scale(var(--m-idle-scale)); } }
[data-cue] .m-idle, html[data-hidden] .m-idle { animation-play-state: paused; }
```

**How code reads them.** Durations are in `ms`, so `parseFloat(getComputedStyle(root).getPropertyValue("--m-in"))` gives a number. Read once, in `mount()`. Kits animate with the Web Animations API: `el.animate([{ ...from, offset: 0 }], { duration, easing, fill: "backwards" })`. Easing is the token string as it stands. Set the end state as the element's own style first. The one keyframe then animates to it. Give a lone keyframe `offset: 0`: without it, it is the end frame, and the motion runs backwards and snaps. `anim.finished` is the Promise `cue()` returns; `anim.finish()` is the tap. Under reduced motion do not call `animate` at all. The CSS block above is only a net. The Settings sheet has a Motion setting, Full or Calm (WCAG 2.2.2). Calm sets `<html data-motion="calm">`, and the block is repeated under that selector. `mount()` and `cue()` get a `reduced` flag; `show()`, `update()` and `tick()` do not, so a kit that animates there reads the attribute. The view also sets `data-cue` while a cue plays and `data-hidden` while the page is hidden.

## 3. The cues

Each entry names what moves in the **Shell** (HUD, text, hint line) and in each kit, the tokens, the end state and the reduced-motion end state. Sound is Web Audio, with the notes and shapes taken from Neon On-Call's `synth` where it has one. Gains are Neon's (.03 to .07).

### turn (`dir` +1 forward, −1 back): time passes
- **Shell.** The text panel leaves (`--m-out`, `--m-ease-in`, by `--m-d5` toward `−dir`) and the new one arrives (`--m-in`, `--m-ease-out`, from `+dir`). In the feed kit the panel fades over `--m-state` and does not slide: a cut does not slide.
- **Paper.** A page turn: the old spread rotates about the gutter (`rotateY`, `--m-persp`) while the new one lies beneath. Duration `--m-turn`, `--m-ease-out`. Primitives on the new spread enter by their own rule (§4), `--m-stagger` apart, grouped so no more than `--m-layers-max` move at once. The scene card (`card(scene)`) shows the title and place line.
- **Feed.** A hard cut: the frame swaps in one frame. The channel label and timestamp change. The log clears and prints again.
- **End.** The new scene's set at rest, the place line shown. **Reduced.** The same, with no slide and no rotation.
- **Sound.** Neon's swoosh: sine 180 → 900 Hz (exponential, 0.18 s), gain .03, 0.2 s.

### shift: the same moment, a new view
- **Paper and Feed.** The old layers fade out and the new fade in together over `--m-cross`, `--m-ease-out`. Nothing slides. In the feed the timestamp holds and only the channel label changes. In both kits the place line stays.
- **Shell.** Nothing moves; the text panel stays.
- **End.** The new set, text untouched. **Reduced.** The swap with no fade. **Sound.** None: the moment has not changed.

### ink: unwitnessed or secret
- **Paper.** SVG strokes draw on (`stroke-dashoffset` to 0) over `--m-ink`, `--m-ease-out`. A `flap` with `opensOn: "reveal"` opens (`--m-flap`) over the same time. The beat sits on `tint-1` with the label "Referee only" (Blueline: secrets live in shade).
- **Feed.** A `redact` bar lifts (`translateY` out of frame) over `--m-ink`. The tag "Unwitnessed" stays.
- **Shell.** The tag fades in over `--m-state`. A reveal beat's text waits for the player's R or tap.
- **End.** Strokes complete, flap open, bar gone, tag shown. The ink holds: after a reveal, the next paint beat blooms again. **Reduced.** The same, at once.
- **Sound.** Triangle 520 Hz, 0.12 s, gain .02 (chosen).

### bloom: witnessed or public
- **Paper.** A warm wash of `plate-gold` rises to `--m-wash-alpha` over `--m-bloom`, `--m-ease-out`, with a lamplight layer (a radial gradient, static, fading in to 0.3 × `--m-wash-alpha`, so text under the wash keeps 4.5:1). The `plate` settles by `--m-tilt` to level.
- **Feed.** The frame comes into focus: a sharp layer fades in over a pre-blurred copy, `--m-bloom`. The `track` box tightens from 1.08 to 1.
- **Shell.** Tag "Witnessed" fades in over `--m-state`.
- **End.** The wash and lamplight stay while the beat is up; they fade over `--m-state` when a beat without paint comes into view. **Reduced.** Wash and focus present at once. **Sound.** Triangle 440 Hz, 0.3 s, gain .02 (chosen).

### seal: the choice is final
- **Shell.** The picked option's label becomes "Sealed". The other options go to `tint-2` (spent). The back button disables. Over `--m-state`.
- **Paper.** A stamp disc scales 1.4 → 1 on the option over `--m-seal`, `--m-ease-thump`. It carries the word "Sealed".
- **Feed.** The `track` box goes from dashed to solid, the frame rule from `rule-hair` to `rule-firm`, the label reads "Locked". `--m-seal`, `--m-ease-out`.
- **End.** Stamp or lock at rest. **Reduced.** At rest at once. The words are the same.
- **Sound.** Square 140 Hz, 0.09 s, gain .06 (a thud; Neon's `beep` with a low pitch).

### roll (`dice`, `faces`, `total`): the dice decide
- **Paper.** The `volvelle` turns `--m-roll-turn` plus the angle of the result's sector over `--m-roll`, `--m-ease-out`, and stops on it. The dice and total settle in at most `--m-roll-ticks` steps.
- **Feed.** One `scan` pass across the frame over `--m-roll`. With `4dF`, the four cells fill left to right, `--m-roll` ÷ 4 apart; each changes once. The `log` prints the roll.
- **Shell.** The result line "2d6: 4 + 5 = 9 vs 8: Success" appears at the end (`--m-state`). A `fate4df` result is one of Fail, Tie, Success, Style.
- **End.** The sector marked, the result line shown. **Reduced.** Final angle and numbers at once.
- **Sound.** Neon's tick (triangle, 1100–1400 Hz, 18 ms, gain .016), `--m-roll-ticks` times, evenly spaced.

### cost (`meter`, `n`): a meter goes down
- **Shell.** The pip fills with `tint-2` (spent) over `--m-state`. The label "−1 Fate" rises in by `--m-d1` over `--m-state` and stays `--m-hold`. One flash: `--m-flash-color` at `--m-flash-alpha` on the stage edge and the meter, decaying over `--m-flash`, never twice inside `--m-flash-gap`.
- **Paper and Feed.** The Feed `log` prints a line "FATE −1". Paper adds nothing: the margin is the HUD.
- **End.** The lower value, the label gone after `--m-hold`, a spent pip. **Reduced.** The lower value and pip at once; the label shows `--m-hold` then goes; no flash.
- **Sound.** One pulse of Neon's klaxon: sawtooth 220 → 140 Hz (linear, 0.18 s), gain .07. Neon plays three; we play one.

### gain (`meter`, `n`): a meter goes up
- **Shell.** The pip fills with `ink` over `--m-state`. The label "+1 Fate" falls in from `−--m-d1`. No flash: a gain is quiet.
- **Paper and Feed.** The Feed `log` prints "FATE +1".
- **End and reduced.** As `cost`, with the higher value and a filled pip.
- **Sound.** Neon's good chord: triangle 330, 440, 554.37, 659.25 Hz, 0.3 s each, 0.08 s apart, gain .04.

### tear: player authority used
- **Paper.** The `ticket` parts along its perforation: the halves move `±--m-d2` and rotate `±--m-tilt` over `--m-tear`, `--m-ease-out`. The stub stays, reading "★ 1 FP spent".
- **Feed.** One band of the frame slips sideways by `--m-d3` and returns over `--m-tear`. It happens once. The `log` prints "PLAYER AUTHORITY: 1 FP SPENT". The Algorithm loses the signal for a moment.
- **Shell.** The Fate meter takes `cost` next, so its label reads "−1 Fate".
- **End.** Ticket torn, stub in place; the feed whole. **Reduced.** Both at once.
- **Sound.** Sawtooth 900 → 200 Hz (exponential, 0.15 s), gain .04 (chosen).

### close: the story stops
- **Paper.** Both pages rotate to meet over `--m-close`, `--m-ease-in`: the book shuts on its cover plate and the ending title.
- **Feed.** The frame collapses to a line (`scaleY` to .002) over `--m-close`; the end line and the "Feed closed" caption fade in over the second half of the same cue, so the cue ends within `--m-close`.
- **Shell.** The deck shows "Endings found n of m". AUTO stops.
- **End.** A still card: the ending's title and look. **Reduced.** The card at once. **Sound.** Triangle 220 and 164.81 Hz, 0.6 s, gain .04.

## 4. Primitives

Idle means nothing has happened. Only the set layer may move in idle, marked **drift**. Any layer that answers a cue does it by the entry in §3. Cues not listed do not touch the primitive.

### Kit: paper (the pop-up book)

| Primitive | Idle | Answers |
|-----------|------|---------|
| `spread` | Still. | `turn`: it is the page that rotates. `shift`: crossfades. `bloom`: takes the wash. `close`: shuts. |
| `vfold` | Standing at rest. | `turn`: rises from the gutter, `--m-fold` → 0 about its base, `--m-in`, `--m-stagger` apart. `shift`: crossfades its art. `ink`: strokes draw. `close`: lies flat. |
| `parallel` | Lifted flat; its shadow at rest. | `turn`: lifts from `--m-fold`, its shadow fades in with it (opacity). `close`: lowers. |
| `tunnel` | **Drift**: the group scales to `--m-idle-scale` and back (`.m-idle`). A pointer drag tilts it, up to `--m-tunnel` at the near plane. The planes count as one layer. | `turn`: planes settle from 1.06 to 1, far to near. `shift`: crossfade. Reduced: no drift, no tilt; the planes stay at their depth offsets. |
| `flap` | Closed, labelled "Referee only". | `ink` on a reveal: opens to `--m-flap` and shows `under`. A new scene (`turn`) starts it closed. |
| `pulltab` | Tab edge showing `--m-d3`, labelled with the value's word ("Machine"). The back layer rests behind. Nothing pulses. | A change to its bound tally slides the layer out `--m-d4` over `--m-in`, `--m-ease-out`. That is **brush** depth. Further only on the player's tap on the tab (the player asks). Reduced: at the same offset at once. |
| `volvelle` | Still at its last result. | `roll`: turns. |
| `ticket` | Whole, with its star and "1 FP". | `tear`: parts. |
| `plate` | Framed, still. | `bloom` (paint): wash and settle. `ink`: strokes draw. `turn`: arrives with the page. |

### Kit: feed (the Algorithm's view)

| Primitive | Idle | Answers |
|-----------|------|---------|
| `frame` | **Drift**: the frame scales to `--m-idle-scale` and back. The timestamp counts in whole seconds. Reduced: frozen at the scene's time. | `turn`: hard cut, new channel and time. `shift`: crossfade, time holds. `bloom`: focus. `close`: collapses. |
| `track` | A box on a face with a label and a confidence number. Still. | `turn`: appears at 1.12 and locks to 1 in `--m-state`. `bloom`: tightens. `seal`: dashed → solid, "Locked". `close`: fades; label "Lost". |
| `scan` | **Drift**: one sweep per `--m-scan`, `--m-ease-linear`, at most .15 opacity. | `roll`: one pass in `--m-roll`. `turn`: restarts at the top. `close`: stops. Reduced: the line rests at the top, hidden. |
| `log` | Lines of machine text, still. They are not a scroll. | `turn`: clears, prints `--m-stagger` apart. `ink`: redacted lines open. `roll`, `cost`, `gain`, `tear`: one new line each, fade in over `--m-state`. |
| `redact` | Bars over the text, each marked "Redacted". | `ink`: lifts. Reduced: the bars are gone. |
| `plate` | Framed, still. | As in paper. |

A line printed by `log` is a record, not a signal. The live region does not read it; the shell's words do (§5).

## 5. The text

- **Typewriter.** One character every `--m-type` (28 ms). The line's whole text is laid out first: typed characters are visible and the untyped tail is `opacity: 0`, so the panel never changes size. A solid block caret sits at the end while it types. It does not blink: Neon's caret loops, ours does not.
- **Tap to finish.** A tap, Space, Enter or → on a typing line shows the rest at once and does not go on. The next press goes on. ← while typing finishes the line, then goes back. A tap during a cue finishes the cue; it does not go on either.
- **AUTO.** Waits `--m-auto-base` + length × `--m-auto-char` (capped at 14000 ms) after the line is whole, then goes on. The progress bar is a `scaleX` on the deck's top edge, `--m-ease-linear`. AUTO stops at every choice, roll, input and reveal. It pauses while a sheet is open and while the page is hidden. Under reduced motion the bar is not drawn; the delay stays, because it is a reading pause, not motion.
- **The live region.** There is one `aria-live="polite"` region (`aria-atomic="true"`) on the page. The whole line goes into it when the line starts. The typing element is `aria-hidden`, so a screen reader never hears a half line, and a tap-to-finish never says it twice. The region also gets, once and in this order: the scene's title and place on `turn`; the result line on `roll`; the label on `cost` and `gain` ("Fate, minus 1"); "Sealed" on `seal`; "Fate point spent" on `tear`; the ending's title on `close`. `shift`, `ink`, `bloom` and `log` lines are silent: they are looks, not events.
- **Reduced motion.** The line is whole from the first frame and the region gets it the same way.
- **Tick sound.** Neon's tick on every fourth character (about 9 a second at 28 ms), only when sound is on.

## 6. Do and don't

| Do | Don't |
|----|-------|
| Open the Referee flap on `ink` only. The player earned it. | Open it on a timer or on hover. |
| Cut hard on the feed's `turn` and dissolve on its `shift`. The two motions tell time passing from a new angle on one moment. | Dissolve a `turn`, or cut a `shift`. |
| Let the Lens pull-tab sit still, with its word "Machine", until the tally moves it `--m-d4`. That is brush depth. | Pulse, glow or bounce the tab to invite a pull. The machine side is left alone unless the player asks. |
| Flash once on `cost` and let it decay over `--m-flash`. | Pulse a low meter forever. (Neon's LED blinks while a meter is at zero.) |
| Show "Sealed" and take the back button away on `seal`. The gate is a fact, not a shake. | Shake the screen. |
| Make the cleric's roll end on a marked sector of the volvelle and print "9 vs 8: Success". | Spin the wheel with no result line. A wheel that only spins says nothing. |
| In the feed, lift the redaction bar and leave the word "Redacted" in the log's line history. | Scroll the log in a loop for atmosphere. |
| Read `var(--m-in)` and `--m-ease-out` from the root. | Write `450ms` or `cubic-bezier(.2,.8,.2,1)` in a kit. |
| Animate from a start state to the element's own style. | Leave an end state that exists only as a `fill: forwards` animation. `document.getAnimations()` then shows it running under reduced motion. |
| Animate `transform` and `opacity`, and scale a bar with `scaleX`. | Animate `width` (Neon's AUTO bar does) or `filter`. |
| Keep the glyph and the word together: "★ 1 FP spent". | Show a torn ticket with no label. |
| Let AUTO pause when the tab is hidden. | Let it advance a story the player cannot see. |

## 7. Checks this contract asks of the tests

SPEC §5 already requires that reduced motion leaves no running animation. This contract adds the rest as a proposal for `stage/test.mjs`. For every built pack: with reduced motion emulated, `document.getAnimations()` has no running animation and no cue Promise is pending; with motion on, every cue Promise resolves within its token plus 100 ms and no step's chain is longer than 2400 ms; no more than `--m-layers-max` elements carry a running animation at once; the page has no animation when `document.hidden`; the computed tokens match this file's table.
