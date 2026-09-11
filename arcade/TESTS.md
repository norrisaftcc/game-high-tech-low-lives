# Arcade tests

A checklist a human runs today and a case table Playwright runs later. Every row has a stable
ID, one check, one expected result, and a probe: the selector, key, or call that an automated
run would use. Rows without a probe are human-only and stay that way.

**How to run now.** Open the file from `file://` on a phone and a laptop. Walk the rows for
that artifact in order. Record a failing row by ID in a playtest note beside the artifact
(`PLAYTEST-<date>.md`).

**How it automates later.** One script, `arcade/tests/run.js`, loads each artifact headless
(Playwright; launch with `executablePath` under `/opt/pw-browsers`), walks the rows whose probe
is filled, and prints pass/fail by ID. The rows are the spec; the script is a reader of this
table. A row's probe must not change without changing its ID.

## A · Every artifact

Applies to `cabinet/index.html`, `cabinet/scene-runner.html`, `spikes/hard-land-rising/index.html`,
and every `cartridges/*/index.html`.

| ID | Check | Expected | Probe |
|---|---|---|---|
| A-01 | Opens from `file://` | Page renders; no blank screen | `page.goto('file://…')`; body has content |
| A-02 | No network | Zero requests to any host except none | `page.on('request')` count of non-`file:` = 0 |
| A-03 | No external script or style | No `<script src>`, no `<link rel=stylesheet href=http…>` | grep the raw file |
| A-04 | Console clean | Zero console errors and page errors through a full run | `page.on('console')` level error; `page.on('pageerror')` |
| A-05 | Exit with scripting off | F2 panel text present; first sentence verbatim *You can stop at any time, and stopping costs you nothing. Your grade is not affected. You do not need permission, and you do not have to explain.* | context `javaScriptEnabled:false`; `details` contains the sentence |
| A-06 | Canvas link real | `<a href="https://faytechcc.instructure.com">` present with scripting off | same context; `a[href^="https://faytechcc"]` |
| A-07 | Exit keeps place | Pressing F2 pauses, keeps state, and closing resumes where you were | press `F2`, read readout, close, read again: equal |
| A-08 | Phone width | Legible at 400 px; body never scrolls sideways | viewport 400×800; `document.documentElement.scrollWidth <= 400` |
| A-09 | Keyboard operable | Every choice reachable by number key or Tab + Enter | tab through; no focus trap |
| A-10 | Reduced motion | No shake, flash, or animated water when the media query is on | `emulateMedia({reducedMotion:'reduce'})`; canvas frame diff ≈ 0 while idle |
| A-11 | Buttons are buttons | Every tappable control is a `<button>` or `<a>`, ≥ 44 px | query all clickables; bounding box ≥ 44 |
| A-12 | Nothing transmitted | Record export writes only to the textarea and a `data:` link | `page.on('request')` during export: none |
| A-13 | Storage is clearable | Only `localStorage` keys under `htll.`; clearing them resets cleanly | list keys; `localStorage.clear()`; reload |

## B · Cabinet shell (`cabinet/index.html`)

| ID | Check | Expected | Probe |
|---|---|---|---|
| B-01 | Pick two personas | Start disabled until exactly two are selected | click `[data-id="nomad"]`, `[data-id="fixer"]`; `#startBtn` enabled |
| B-02 | Lead / Handler swap | `#roleSummary` swaps names; `#openingPreview` changes | click `#swapRoleBtn` |
| B-03 | Profile default | First load is classroom | `localStorage['htll.cabinet.profile']` unset; pick two personas, click `#startBtn` → `#boardPanel` visible, `#arcadeMeters` hidden |
| B-04 | Arcade profile | Hull and score visible, board hidden | set profile arcade; `#hullBar`, `#scoreText` visible |
| B-05 | TRACE steer / aim | Pointer near the air car steers; elsewhere fires, including left of centre | synthetic pointerdown at player x−10; at x=40 → shot spawned |
| B-06 | Aim reticle and lock | Reticle drawn at aim; lock bracket when aim ray crosses an enemy; one tone per lock | inspect draw calls or expose `game.lock` |
| B-07 | DUAL dead zone | Centre press on `#movePad` yields zero move; magnitude never exceeds 1 | read `input.move` after synthetic events |
| B-08 | Overlord hit count | 95 hits total: core 63, nodes 16 + 16 | read `makeBoss()` values |
| B-09 | Events fire once and only there | `begin`, `node1`, `shield`, `hull40`, `core50`, `win`/`lose`, `stage-clear` each fire at their moment; no timer-driven line | spy on `emit`; assert no line between events |
| B-10 | Priority queue | A `win`/`lose` line is never overwritten; lower lines wait | fire `hull40` then `win`; `#line` shows the win line |
| B-11 | Stage-clear beat | ≈ 1 s hold with the phase name before the next stage | timestamps around `advance()` |
| B-12 | Final line survives | Results overlay waits for the last line or a tap | `#endOverlay` hidden until ≥ 4 s or tap |
| B-13 | Capacity board | Damage moves the top In Progress item to Blocked; WIP limit 2 holds | `#colProg` children ≤ 2; after hit, `#colBlocked` grows |
| B-14 | Compel loop | All blocked → `#compelOverlay` opens and the game pauses; Accept +1 FP; Refuse spends 1 FP and is disabled at 0 | `#compelFate`, `#compelAccept`, `#compelRefuse` |
| B-15 | Shifts can fall | +1 per stage cleared, −1 per complication | `#shiftsText` |
| B-16 | Record shape | Export has `# Sortie Record`, `## Stages`, `## Complications`, `## Shifts`, `## Transfer` | `#recordText` value |
| B-17 | Persona data current | `build.py --check` style: inline block equals `personas/personas.json` | run `python3 cabinet/build.py`; expect "No changes" |
| B-18 | Haptics off under reduced motion | `#hapticsBtn` reads off; `navigator.vibrate` never called | stub `navigator.vibrate` |
| B-19 | Full boss cycle | A run reaches `win` and another reaches `lose`; both records export | scripted play with dodge logic |
| B-20 | Human: touch feel | TRACE reads clear on a phone; pads do not cover the air car in portrait | — |

## C · Scene runner (`cabinet/scene-runner.html`)

| ID | Check | Expected | Probe |
|---|---|---|---|
| C-01 | Public surface | `Runner.load`, `Runner.start`, `Runner.exportRecord` exist | `typeof window.Runner.exportRecord === 'function'` |
| C-02 | Check node tiers | With forced dice, difficulty 2: sum 5 → style (+1 FP), 3 → success, 2 → tie, 1 → fail (+1 Nerves) | stub the dice; read `#statusStrip` |
| C-03 | Conditions grey, not hide | A choice failing its conditions is disabled and still numbered | `#keypad button[disabled]` present |
| C-04 | Boards | `board_add` writes to the named board; evidence and assumptions render separately | `#boardsBody` sections |
| C-05 | Budget | `budget:-n` lowers the readout; `budget_min` gates a choice | `#ledReadout` |
| C-06 | Compel | Refuse disabled at 0 FP; Accept adds 1 FP and applies effects | status strip before/after |
| C-07 | Record sections | Export has `## Complication`, `## Revision`, `## Shifts`, `## Transfer` even when a cartridge lists them itself, and never twice | count headings in `#recordText` |
| C-08 | Demo plays through | Every branch of the demo terminates; three random runs each | loop first enabled choice |
| C-09 | One-line readout | `#ledReadout` never wraps | `scrollHeight == clientHeight` |

## D · Hard Land, Rising spike (`spikes/hard-land-rising/index.html`)

| ID | Check | Expected | Probe |
|---|---|---|---|
| D-01 | Anchors | Unpacking pump bypass drops its four dependents; a dependent cannot be packed first | `#items1` states; `#capLine1` |
| D-02 | Over-limit disabled | An item that would exceed the limit is disabled with a stated reason | `button[disabled][title]` |
| D-03 | Two fields gate the climb | `#btnClimb1` disabled until `#r1reason` and `#r1defer` are filled | fill, assert enabled |
| D-04 | Water rises = capacity drops | After the first climb the readout reads `LEDGE 2 · PACK n/10` and the complication names the ladder release | `#readout`, `#stage-complication` visible |
| D-05 | Ladder release load-bearing | Round 2 climb disabled while the release is unpacked | `#btnClimb2` |
| D-06 | Five moves reachable | Keep, Deferred by the tide, Reopened, Locked (compel), and a swap all appear as badges in one run | badge text in `#items2` |
| D-07 | Compel | Accept forces the sponsor feed in, +1 FP; Refuse spends 1 FP | `#btnCompelAccept`, `#btnCompelRefuse`, `#readout` |
| D-08 | Shifts fall | Deferring by the tide lowers shifts | `#readout` |
| D-09 | Record shape | `# M3 Product Owner Decision Record`, `Removed after complication`, `Added after complication`, `Transfer to DataMan` | `#recordOut` |
| D-10 | Stale notice | No Round-1 message remains on the complication screen | `#flash` empty when `#stage-complication` is visible |
| D-11 | Human: does the water read as the capacity drop without being told? | — | — |
| D-12 | Human: does the shaft read as a place or as a diagram? | — | — |

## E · M2 cartridge, Suspended Coastal (`cartridges/m2-suspended-coastal/index.html`)

| ID | Check | Expected | Probe |
|---|---|---|---|
| E-01 | Wizard | Two units of four must be chosen; the brief follows | `#keypad` unit choices; second pick enables Next |
| E-02 | Ping confirm | Every ping passes a Confirm scene (`#dialogTitle` = Confirm) with Yes / No | `#dialogTitle` text; `#keypad` buttons 1–2 |
| E-03 | Budget three | `#ledReadout` reads `PINGS: 3 / 3` at start and `0 / 3` after three; no fourth ping without reopen | `#ledReadout` |
| E-04 | Channel rule | The same ping through two units returns different data text | run twice with different pairs; compare `#crt` data lines |
| E-05 | Technology ping | Error scene (`#dialogTitle` = Error, red-X icon); budget still drops; nothing on the evidence board | `#dialogIcon`, `#ledReadout`, `#boardsBody` |
| E-06 | Cosmetic ping | *Did you know…* tip scene; budget drops; nothing on the board | `#dialogTitle`, `#boardsBody` |
| E-07 | Sort gate | Filing ping 5 or 6 as Evidence opens the Office Assistant scene first; filing as Assumption does not | `#dialogTitle` = Office Assistant |
| E-08 | Position commit | `#formOverlay` requires six fields; commit confirm states no more pings | `#formOverlay textarea[required]` count = 6 |
| E-09 | Complication | Alert scene (yellow triangle) names intermittent uplink and half-booked berths | `#dialogIcon`, `#crt` text |
| E-10 | Four moves | Revise, keep, defer, reopen each pass a Confirm with a stated cost; reopen sets Fate 1 → 0 and `#ledReadout` to `1 / 4` | `#statusStrip` Fate chip; `#ledReadout` |
| E-11 | Compel | Accept: Fate +1 and a recorded solution without evidence; Refuse: Fate −1, disabled at 0 | `#statusStrip`; `#keypad button[disabled]` |
| E-12 | Record shape | `# M2 Elicitation Decision Record`, `Investigation Path`, `Initial Position`, `Complication`, `Revision`, `Transfer` | `#recordText` |
| E-13 | Inline equals file | `CARTRIDGE` in the HTML parses equal to `cartridge.json` | `node check-cartridge-equal.js` |
| E-14 | Empty keypad slots | Unused choice slots are blank or absent, never a disabled button with stale text | `#keypad button[disabled]` text empty |
| E-15 | Human: does the technology-ping error read as the lesson or as a bug? | — | — |
| E-16 | Human: do the confirm dialogs read as gates or as nagging? | — | — |
| E-17 | Human: does the confirm read as a dialog box, or as text in the log with a Yes key? | — | — |

## F · Persona data (`personas/personas.json`)

| ID | Check | Expected | Probe |
|---|---|---|---|
| F-01 | Valid JSON | Parses | `python3 -c "import json;json.load(open(...))"` |
| F-02 | Six pairs, keys sorted | Exactly the six alphabetical `a+b` keys | key list equality |
| F-03 | Line length | Every line under 90 characters | walk all strings |
| F-04 | Complete | Each pair: 3 lines × 8 events, swapped 1 × 8, opening, compel with four fields; `algorithm` 3 × 7; four palettes | shape walk |
| F-05 | No course vocabulary in a character's mouth | No *backlog*, *requirement*, *acceptance criteria* in `lines`, `opening`, `swapped` | grep |
| F-06 | No DataMan behaviour | No *DataMan* in any line | grep |

## G · M3 cartridge, Hard Land Rising (`cartridges/m3-hard-land-rising/index.html`)

| ID | Check | Expected | Probe |
|---|---|---|---|
| G-01 | Wizard picks Lead then Handler | Handler-pick choices exclude the chosen Lead (3 of 4) | click a Lead choice; `#keypad` buttons text excludes that Lead's name |
| G-02 | Anchor cascade | Packing a dependent before its anchor is disabled with a `title`; unpacking an anchor drops its dependents | `#formOverlay button.item[data-id]:disabled` + `title`; toggle anchor off, dependents `aria-pressed=false` |
| G-03 | Over-limit disabled | An item that would exceed the round's limit is disabled with a stated `title`, not refuse-on-click | `button.item[disabled][title]` |
| G-04 | Two fields gate Climb | The Climb button stays disabled until both textareas are non-empty | fill both `#formOverlay textarea`; Climb `disabled` flips false |
| G-05 | Confirm shows weight/limit | Clicking Climb opens a nested Confirm whose text names the current weight and the round's limit | `#formOverlay[data-confirm="1"] p` text |
| G-06 | Esc closes the Confirm | Esc on the Confirm returns to the pack list with toggles and field text intact, not to the previous scene | press Escape; `#formOverlay:not([hidden])` with no `data-confirm`; cap line unchanged |
| G-07 | Enter fires once | Reopening Confirm and pressing Enter commits exactly one round (no double-apply) | `window.Runner._debugState().ledgesClimbed` equals 1 after the first commit |
| G-08 | Water rises | After the Ledge 1 climb, `#ledReadout` reads `LEDGE 2 · PACK n/10`, replacing the round 1 limit of 13 | `#ledReadout` text before and after `climbing-1` |
| G-09 | Alert names the ladder release | The complication's System Alert text names the manual ladder release by name | `#crt` text at the complication scene includes "ladder release" |
| G-10 | Ladder release gates Climb | With the manual ladder release unpacked, Ledge 2's Climb is disabled; repacking it re-enables Climb (fields and weight held constant) | toggle `data-id="ladder-release"` off/on; Climb `disabled` |
| G-11 | Compel accept | Accepting forces the sponsor stream feed into the pack, locked (`title` names the compel), and Fate rises by 1 | click Accept; `window.Runner._debugState().fate`; sponsor item `aria-pressed=true` + `title` |
| G-12 | Compel refuse | Refusing spends 1 Fate point and leaves the sponsor feed out of the pack | click Refuse; `_debugState().fate` drops by 1; sponsor item `aria-pressed=false` |
| G-13 | Badges, one render | Keep, Deferred by the tide, a genuine Swapped in / Swapped out pair, and Locked all appear together in one Ledge-2 edit | badge text in `#formOverlay .pack-items` |
| G-14 | Badges, sixth class | A plain Reopened badge appears when an item is added before any item has been dropped in Ledge 2 (a lighter Ledge-1 pack) | badge text on the freshly-added item, deferred list still empty |
| G-15 | Digit keys | 1–8 toggle the matching item (by the cartridge's declared order, not DOM position) while the pack overlay is open and focus is outside a textarea | press `1`…`8`; matching `button.item[data-id]` `aria-pressed` |
| G-16 | Record shape | `# M3 Product Owner Decision Record`, `## Scenario`, `## Round 1 — Capacity 13`, `## Complication`, `## Revised Release Slice — Capacity 10`, `### Removed after complication`, `### Added after complication`, `## Compel`, `## Shifts`, `## Transfer to DataMan` | `#recordText` value |
| G-17 | Inline equals file | `CARTRIDGE` in the HTML parses equal to `cartridge.json` | `node check-cartridge-equal.js` |
| G-18 | Human: does the flood bar read as rising water on its own, before reading the LED? | — | — |
| G-19 | Human: does losing the plain Reopened badge alongside a swap (see CARTRIDGE.md) feel like a real capacity trade-off, or an arbitrary gap? | — | — |
