# Hard Land, Rising — M3 cartridge

Single-file `index.html`: scene-runner engine copied verbatim from
`arcade/cabinet/scene-runner.html`, a Windows 98 skin, `CARTRIDGE` inline
(byte-equal to `cartridge.json` — run `node check-cartridge-equal.js`). Open
`index.html`, pick a Lead and a Handler, read the readme, pack for Ledge 1,
climb, ride the complication and the compel, revise the pack for Ledge 2 under
a lower limit and the ladder-release gate, climb again, export (Copy/Download).
F1/F2/Back-to-Canvas live in the bottom taskbar. `gen_cartridge.py` builds
`cartridge.json` from `m3-content.json` (lead/handler voice, item notes, the
readme/wizard/progress/complication copy, the two field prompts per round) and
`../../personas/personas.json` (Handler banter per pair), and injects the same
JSON into `index.html`.

## The mechanic

Eight items are staged at the base of a flooding Meridian Holdings shaft.
Ledge 1's weight limit is 13; the water rises after you climb it, and Ledge
2's limit is 10. Some items anchor others (pack a dependent before its anchor
and the ladder won't take it; drop an anchor and its dependents cascade back
out). Two free-text fields gate every Climb. After the complication, the
**manual ladder release** is required — no chrome, no other way up — and a
compel against the Lead's Trouble offers Meridian's sponsor stream feed: accept
forces it into the pack, locked, for +1 Fate; refuse costs the starting Fate
point. Round 2 badges every item live: **Keep**, **Deferred by the tide**,
**Reopened**, **Locked** (compel), **Swapped in** / **Swapped out** (the
most-recently-toggled reopened+deferred pair).

## Win98 trope → gate

Setup Wizard → choosing the Lead and the Handler. README.TXT — Notepad → the
brief. Explorer-style cargo list → the pack node itself, per round. A nested
Win98 Confirm inside that same window → "are you sure," with the weight and
limit filled in. Segmented progress bar → the climb between ledges (instant
under reduced motion). Yellow-triangle System Alert → the complication.
Incoming Line → the compel. LED readout → `LEDGE n · PACK w/limit · SHIFTS
±n · FP n`, where SHIFTS is ledges climbed minus items deferred by the tide (a
different quantity from M2's Fate-based SHIFTS, reusing the same taskbar chip
id). A thin blue flood bar along the window's bottom edge rises from 20% to
60% after the first climb — decoration only; the LED and the System Alert
carry the actual meaning.

## What I changed from the shared format, and why

- **`scene.pack`, own copy, additive.** The shared engine has no
  capacity-with-anchors node. Added one `pack` dispatch branch (checked before
  `compel`/`check`/`choices`, same precedence slot M2 gave `form`) that
  renders inside `#formOverlay` as an Explorer-style list: a checkbox-style
  button per item (`aria-pressed`, 44px, digit keys 1–8), anchor cascade on
  unpack, proactive over-limit disabling with a `title` reason, two required
  textareas, and a nested Win98 Confirm before committing. `scene-runner.html`
  is untouched.
- **`renderReadout`'s body is replaced, not hooked.** M2 could get its
  `PINGS: n/n` LED text from the stock `budget` field. M3's
  `LEDGE n · PACK w/limit · SHIFTS ±n · FP n` has no equivalent in
  `budget`/`score`, so this one function's body is this cartridge's own —
  everything else in the engine copy is additive the way M2's was.
- **Handler event writer, own copy.** `scene.event` (`begin`, `stageClear`,
  `hull40`, `core50`, `win`) appends one Handler line, read from an embedded
  `cartridge.pairs` (the relevant slice of `personas.json`) keyed by the
  actual Lead/Handler flags at that moment: neutral at `begin`, then "going
  well" (shifts ≥ 0) or "going badly" (shifts < 0). Pair key is alphabetical
  `lead+handler`; if the actual assignment matches the pair's declared
  default, the 3-line variant set is used (index 0 well, 1 badly, 2 neutral);
  otherwise the 1-line `swapped` set is used for every event. Fires after the
  scene's own `messages` print, so it reads as a reaction.
- **One `brief` per Lead, not one per Lead+Handler pair.** The spec names the
  scene id singular (`brief`); this build uses `brief-<lead>` (4 scenes, one
  per Lead) because `handler_intro[lead]`/`lead_intro[lead]` only vary by
  Lead, and scene ids must be unique. The dialog classifier matches the
  `^brief` prefix, so it still reads as one `readme` dialog kind. The pair's
  Handler `begin` line (which *does* depend on both Lead and Handler) is
  appended by the dynamic Handler event writer, after the static
  `handler_intro`/`lead_intro`/Scenario messages rather than before them —
  it reads as the Handler's first live word as the climb starts, not as a
  scripted opening line.
- **Compel carries `acceptText`/`refuseText`.** The stock `compel` node has no
  slot for the short narrative once a decision resolves. Added two optional
  fields (absent = stock behavior unchanged) that this copy's `resolveCompel`
  prints as one `lead`-speaker message after applying effects.
- **`pack-slice` / `pack-table` log pair.** Committing a round pushes two
  choice-shaped log entries: one with `flags_set`/`flags_unset` matching the
  node (so the *stock* engine's generic Revision-family pairing in
  `scene-runner.html` would still find it, unused by this cartridge's own
  exporter but kept for format fidelity), and one carrying the round's
  Markdown table for the M3 exporter to read back.
- **M3-shaped exporter.** `exportRecord()` dispatches to `exportRecordM3()`
  when `cartridge.record.layout === "m3-product-owner"`; the stock exporter
  stays in the file, unchanged, for any cartridge without that layout. Headed
  to match `cts-285-course-simulations/m3/product-owner-sprint/index.html`'s
  `rec` template, with `## Compel` and `## Shifts` inserted between Tradeoff
  and Transfer.
- **Six badge classes, five reachable at once.** With the ported item table
  (floor weight of the anchor + the required ladder release + the
  compel-forced sponsor feed = 7, against a limit of 10, leaves 3 spare), a
  genuine swap pair (Swapped in/out) and a *separate* plain Deferred item
  coexist with Keep and Locked in the same Ledge-2 edit — five classes at
  once, verified below. A sixth, plain **Reopened**, only renders when an
  item is added while the deferred list is still empty, which requires a
  Round 1 pack light enough that no drop has happened yet; that is
  incompatible, under these exact weights, with also having a Round-1 extra
  to defer or swap in the same session. The badge logic itself is unchanged
  from the spike (ported verbatim) and produces the correct text in both
  cases — verified separately below with a second, lighter Round-1 pack.
  Redesigning the item weights to force all six simultaneously was out of
  scope for a data-driven port.
- **`data-confirm` reset on every `renderPack` entry.** A real bug found
  during verification: the nested Confirm's `data-confirm="1"` marker on
  `#formOverlay` was never cleared by "No" or Esc, so a second Confirm/Esc
  cycle in the same pack scene stayed in "confirm" keyboard mode (digit keys
  blocked, Escape reinterpreted as still-inside-Confirm). Fixed by clearing
  the attribute at the top of `renderPack`.

## Verified (Playwright, `/opt/pw-browsers` headless_shell)

Full run: wizard (Nomad/Fixer) → Ledge 1 pack (anchor cascade on
pump-bypass, unpack cascades ladder-release and crew-beacon-relay; a
dependent disabled with an anchor-missing `title` before its anchor is
packed) → two required fields gate Climb → Confirm shows `Weight 13 of 13`
→ Esc backs out to the pack list with toggles and text intact (`data-confirm`
cleared) → Climb → Confirm → Enter commits exactly once (`ledgesClimbed` = 1,
not 2) → `climbing-1` → complication: `#ledReadout` reads
`LEDGE 2 · PACK 13/10 · SHIFTS +1 · FP 1`, the System Alert names the manual
ladder release → compel Accept: Fate 1 → 2, sponsor stream feed packed and
`title`-locked → Ledge 2 edit: Keep (pump bypass), Locked (sponsor feed), a
plain **Deferred by the tide** (auto-route advisory, order 1 of 2 deferred
candidates) simultaneous with a genuine **Swapped in** / **Swapped out** pair
(bulkhead seal / crew beacon relay, the highest-order reopened+deferred pair)
— five badge classes in one render — → unpacking the ladder release disables
Climb, repacking re-enables it → both fields required → Confirm → Enter
commits once → `climbing-2` → top → `#recordText` contains every required
heading (`# M3 Product Owner Decision Record`, `## Scenario`,
`## Round 1 — Capacity 13`, `## Complication`,
`## Revised Release Slice — Capacity 10`, `### Removed after complication`,
`### Added after complication`, `## Compel`, `## Shifts`,
`## Transfer to DataMan`) and both the swap and the deferred reasons in prose.
Zero console/page errors across the whole run. A second, separate pass with a
minimal Ledge-1 pack (pump bypass + ladder release only, compel refused, Fate
0) reaches a plain **Reopened** badge on the first item added, confirming the
sixth badge class renders correctly (see "what I changed," above, for why it
does not coexist with a swap in one economy). Digit keys 1–8 toggle the
matching item by the cartridge's declared order while the pack overlay is
open. Every focusable control measured ≥ 44px. `prefers-reduced-motion`
fills the progress bar instantly (12/12 blocks on) instead of animating.
`javaScriptEnabled:false` shows the F2 first sentence verbatim and the real
`Back to Canvas` `<a href>`. Zero non-`file:` network requests during a run.
`node check-cartridge-equal.js` → OK, 20 scenes. `node --check` on the
extracted `<script>` block → pass. Screenshots at 400px width:
`smoke-pack1.png`, `smoke-complication.png`, `smoke-pack2.png`.

## Three questions for a human playtester

1. With the ported item weights, one badge class (plain Reopened) can't
   co-occur with a swap pair in the same Ledge-2 revision — does that read as
   a natural consequence of tight capacity, or as a gap in the mechanic a
   player would notice?
2. Does routing the Handler's personality only through short reactive lines
   (no per-item banter) feel thin next to M2's denser Windows-98 dialog
   sequence, or does the climb's pace want exactly that much?
3. Does the flood bar read as "the water is rising" on its own, or does a
   player need the LED's `PACK w/limit` change to notice the stakes shifted?

**Engine port, 2026-09-11.** The second review round's engine fixes were applied to this copy
the same day they landed in `scene-runner.html`: `fate_min` in `conditionsMet`; the canonical
tie (`total === difficulty`); a `data:` download URL; F1/F2 toggle the frame-bar panels; the
Enter fallback also yields to a focused summary or link. Pack-specific: the pack and confirm
windows carry `role="dialog"`, `aria-modal`, and `aria-labelledby`; Esc pops the pack scene's
own visited entry before returning, so Esc → re-enter → Esc cannot strand the run; focus
returns to the keypad's primary button on close and on commit.
