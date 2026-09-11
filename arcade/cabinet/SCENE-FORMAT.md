# Cartridge format — `scene-runner.html`

Turn-based half of the cabinet. Public surface: `Runner.load(cartridgeObject)`, `Runner.start()`,
`Runner.exportRecord()`. Ports `prototype/scene_format.md` with the two README conventions
fixed (stress positive = damage; `scene_type` dropped) and `vars` not implemented.

## Top level
`{metadata{title,module,version,transfer?}, profile_default, personas{lead,handler}, budget?{label,start},
character{stats{body,reflexes,cool,code,tech}, stress{meat,nerves,systems:{max,current}}, fate_points},
start_scene, scenes{id:scene}, score?{label}, record{title,sections}}`
`budget` and `score` are additions this runner needed and the README named but didn't shape;
`budget` backs the LED readout and `budget_min`/`budget:-n`; `score` is arcade-profile-only
flavor (sum of positive check shifts), never shown under `profile:"classroom"`.

## Scene: `{messages, choices?, check?, board?, complication?, compel?}`
Precedence when several are present: `compel` > `check` > `choices` > (none = terminal, ends the run).

**messages** — `{speaker, text}`. Speakers `handler|algorithm|stakeholder|system|lead|data`, one
CSS class each; `stakeholder` renders as a `<blockquote>`. Example:
`{"speaker":"stakeholder","text":"Manager Chen is here."}`

**choices** — `{id, text, conditions?, effects?}`, max 4 visible (amber keycaps, number keys
1–4), more scroll. `conditions: {flags_set[], flags_not_set[], items[], budget_min, stat_min{stat:n}}`
gray out (not hide) an unmet choice so hotkey numbering stays stable. `effects: {next, flags_set[],
flags_unset[], items_add[], items_remove[], stress{track:+n}, budget:-n, board_add{board,id,text,kind},
fate:+n, return_to_choices}`. Example: `{"id":"proceed","text":"Proceed.","effects":{"next":"roll-1"}}`

**check** — `{stat, difficulty, on_style, on_success, on_tie, on_fail}`. Rolls 4dF (each die
−1/0/+1, shown as `[+] [0] [−]`), `total = sum(dice) + stats[stat]`. **Tier thresholds are
offsets from `difficulty`, generalized from the four-tier Twine ladder in
`build/shodann-solo/scene2-contact.tw`, which states them against difficulty 2** (style 5,
success 3, tie 1, else fail): `style: total ≥ difficulty+3`, `success: total ≥ difficulty+1`,
`tie: total ≥ difficulty−1`, else `fail`. Displayed "shifts" = `total − difficulty`. Style
grants +1 Fate point automatically; fail marks +1 Nerves stress automatically; every roll is
logged for `## Shifts`. The demo's `split-roll` scene reaches the Twine "split attention, CODE
−1" case by raising `difficulty` to 3 instead of penalizing the stat — same odds, one lever.

**board** — declares named boards up front: `[{name, label?, columns?, limit?}]`. Entries arrive
only via `effects.board_add {board,id,text,kind}`; `kind` doubles as the column name when
`columns` is set (a capacity/WIP board), else entries render as a flat labeled list (evidence,
assumptions). Undeclared boards auto-create on first `board_add`. Example:
`"board":[{"name":"capacity","columns":["Backlog","In Progress","Blocked","Done"],"limit":10}]`

**complication** — `complication: true` on a scene. On first entry the runner snapshots the
choice log so far as "before"; the exporter later diffs against "after."

**compel** — `{trouble, offer, accept:{effects}, refuse:{effects}}`. Runner hardcodes the Fate
cost: accept → +1 Fate point, refuse → −1 and disabled at 0 Fate. `accept.effects`/`refuse.effects`
apply on top (do not also set `fate` there — it double-counts).

## Record: `record{title, sections{Heading:[glob,...]}}`
Globs match scene ids (`*` wildcard) against every scene actually visited, in play order.
`Complication`, `Revision`, `Shifts`, `Transfer` are **reserved** — if a cartridge's `sections`
names one, the exporter still generates it automatically and ignores the cartridge's entry for
it (a `record.sections` example may include `"Complication":["complication"]` harmlessly; it is
skipped in the walk).

`exportRecord()` output, in order:
1. `# <record.title>`
2. One `## Heading` per non-reserved section with at least one matching visited scene: the
   choice text made there, plus any `data`/`stakeholder` message text from that scene, plus the
   roll tier if a `check` fired there.
3. `## Complication` (only if a `complication:true` scene was visited): its message text, then
   the choices already made "before this point."
4. `## Revision` (only alongside a Complication): an *Original / Revised / What changed* table.
   Pairing rule, generic over any cartridge: a choice's `effects.flags_set` opens a "decision
   family" keyed by that flag; a later choice whose `effects.flags_unset` closes that same flag
   while also setting a new one is logged as a revision of the family's most recent choice text.
   Closing a family consumes it: a further close of the same flag pairs again only if some
   choice in between reopened it with a matching `effects.flags_set`.
   No matching pair → "No item decisions were revised after the complication."
5. `## Shifts` (only if any roll or compel occurred): one line per roll (dice, stat, total,
   difficulty, tier, shifts, any Fate/Nerves delta) and per compel (accepted/refused, cost).
6. `## Transfer` (only if `metadata.transfer` is set): that line verbatim.

## Frame and profile
`F1`/`F2`/Canvas link ship in the shell markup itself (static `<details>` + `<a href>`), so F2's
required first sentence and the Canvas link survive `javaScriptEnabled:false`. `profile` (from
`profile_default`, default `classroom`) gates the LED's `score` line and nothing else — boards
and Shifts show under both profiles; neither profile runs a timer.

## Demo cartridge — `DEMO` (embedded), a port of `scene2-contact.tw`
Nodes exercised: messages (all six speakers), choices with effects, `check` at two difficulties
(2 and 3, the second replacing the Twine "CODE −1" with "difficulty +1"), `board` (`evidence`,
`assumptions`), `complication` + `compel` (on the tie branch, Chen's suspicion / the
Infiltrator's Trouble), and `record`. Ten terminal branches match the Twine scene's style /
success / tie / fail outcomes for both the direct and split-attention approaches, plus the two
no-roll abort / change-pattern endings.

Sample export (`proceed` → tie roll → compel accepted), abridged — full text in the report:
```
# Dead Drop Decision Record
## Approach
- **Choice:** Proceed with the dead drop — make it look natural.
  - *stakeholder:* Manager Chen is here... / *data:* Dead drop cup: three seats from Chen...
## Roll Outcome
  - *roll:* tie (shifts +0)
## Complication
The photo is rushed... "Burnout doesn't look like tiredness. It looks like sloppy operational
security." / Before this point you had decided: - Proceed with the dead drop...
## Revision
No item decisions were revised after the complication.
## Shifts
- Roll at `dead-drop-roll`: [0][0][0][0] (+0) + CODE +2 = 2 vs difficulty 2 → **tie** (shifts +0).
- Compel at `tie-end` (My Former Employer Wants Me Back or Dead): accepted — +1 Fate point.
## Transfer
Carry this forward: an investigation decision is only as strong as the evidence you can point to...
```

## Validation run
`node --check` on the extracted `<script>` block: pass. Playwright (v1.56.1, against the
pre-installed `/opt/pw-browsers` build) loaded the file over `file://` and: played all four
`brief` branches to a terminal scene with zero console/page errors; forced a tie roll to confirm
the compel, Complication, and Revision sections render correctly; forced all-`+1` and all-`−1`
dice to confirm the style/fail automatic Fate and Nerves deltas and the evidence/assumptions
board writes; drove the whole run by keyboard (`1`, `Enter`) only; and loaded the page with
`javaScriptEnabled:false` to confirm the F2 first sentence and the real Canvas `<a href>` are
present without script support.
