# Hard Land, Rising — spike

## What this tests
One idea: **the water rising is the capacity drop.** A vertical climb through a flooding Meridian Holdings shaft — the backlog is a pack the Nomad carries, each ledge is a sprint with a weight limit, the tide rising after a decision is the complication. Underneath: CTS-285's M3 mechanic exactly — constrained selection under limited capacity; keep/remove/swap/defer/reopen.

## The pack (StudyTrack's eight, same weights, renamed)
| Item | Wt | Value | Anchor | Risk | Ready |
|---|---|---|---|---|---|
| Pump bypass | 3 | High | — | Low | Ready |
| Bulkhead seal | 2 | High | Pump bypass | Low | Ready |
| Crew beacon relay | 3 | High | Pump bypass | Med | Ready |
| **Manual ladder release** (no chrome needed) | 2 | High | Pump bypass | Low | Ready |
| Cargo manifest sync | 4 | Med | Pump bypass, Bulkhead seal | Med | Ready |
| Sponsor stream feed | 2 | Low | — | Low | Ready |
| Auto-route advisory (AI-routing) | 5 | Med | telemetry feed, unbuilt | High | Needs refinement |
| Medbay uplink (privacy-unsettled) | 5 | Med | Cargo manifest sync | Med | Needs refinement |

Total 26; round 1 cap 13, round 2 cap 10 — identical to ST-01..ST-08. Ladder release mirrors ST-04 (keyboard-accessible task entry): low weight, ready, becomes mandatory after the complication.

## The rounds
**R1 (cap 13).** Tap/number-key items in; dependencies are anchors (can't pack a dependent first; unpacking an anchor cascades). Two required fields, then Climb.
**Complication.** Pack persists; cap drops to 10; ladder release becomes mandatory (Climb refuses without it) — the StudyTrack accessibility beat, restated as "the crew below has no chrome."
**R2 (cap 10).** Same pack, edited. Every item shows a live badge — Keep / Deferred by the tide / Reopened / Locked (compel) — so all five verbs (keep/remove/swap/defer/reopen) are reachable through one toggle. Two required fields, then Climb.
**Swap.** Packing a left-behind item while removing a previously-packed item in the same round badges the most-recently-toggled pair Swapped in / Swapped out instead of Reopened / Deferred by the tide; the record notes the swap under Removed/Added after complication.

## The compel
After the complication, the Fixer relays Meridian's offer against the Nomad's Trouble *My Boat Is Falling Apart and Repairs Cost More Than I Make*: accept → +1 Fate point, sponsor feed forced in (locked, counts against 10); refuse → spend the starting Fate point. Recorded either way.

## What converts (§5.4)
Hull → the pack limit itself. Score → **Shifts** (+1/ledge, −1/deferred item, can fall). Timer → **complication rounds**, turn-based, water rises only after a decision. Lives/retries → the compel on Trouble. Rank → not used; out of scope for a single-mechanic spike.

## How to play
Open `index.html`, no server/network. Start, pack the eight items (tap or 1–8), fill both fields, Climb. Read the complication, choose the compel, revise under 10 plus the ladder gate, fill both fields, Climb. Copy/download the record at the top.
**Keyboard.** Digits 1–8 toggle the matching item in the current round; Enter activates that round's Climb (or Continue) button when enabled; Esc closes an open F1/F2 panel. All three are ignored while focus is in a textarea.

## What was verified
Playwright (headless Chromium `chromium_headless_shell-1194`, explicit `executablePath`) drove `file://` end to end: packed R1 (10/13); confirmed anchor-unpack cascades; climbed, cap dropped to 10; accepted the compel (pack over limit at 12/10 until revised); deferred one item, reopened another within budget, badges matched; over-limit items disable proactively with a stated reason instead of refuse-on-click; climbed to the top; exported record contains `Removed after complication`, `Added after complication`, and `Transfer to DataMan` verbatim, plus the R1 table, both field pairs, and a Shifts line; copy works via an `execCommand` fallback (no clipboard permission headless); zero console/page errors. Re-ran with `javaScriptEnabled:false`: F2 opens natively, its first sentence matches verbatim, `Back to Canvas` links to faytechcc.instructure.com. Screenshots: `smoke-round1.png`, `smoke-complication.png`, `smoke-round2.png`.

## Changed from spec, and why
The spec names six in-world items plus the ladder release plus "an AI-routing item" — nine names for eight slots. Resolved by treating the privacy-unsettled item as the medbay uplink (named once, not twice) and inventing "Auto-route advisory" for the AI-routing item, then mapping StudyTrack's weights/anchors 1:1 onto the eight. Keep/remove/swap/defer/reopen are derived badge states of one toggle, not five buttons — phone width has no room for five controls per item. Over-limit items disable proactively rather than refuse-on-click. Added a "Run the climb again" reset button (near-zero cost, not in spec).

## Three questions for a human playtest
1. Does the rising water read as *capacity dropping*, or as a danger clock despite being turn-based?
2. Do the on-item badges alone convey the revision's shape, or is the exported record needed?
3. Does the forced sponsor feed feel like a real trade against the Nomad's Trouble, or a bolted-on rule?
