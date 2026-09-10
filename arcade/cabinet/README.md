# Cabinet shell — Hard/Wired Coast

Open `index.html` directly in a browser (`file://…`). No build step, no network, no CDN.

## The two profiles
Chosen on the sortie card, stored in `localStorage['htll.cabinet.profile']`. Default **classroom**.
- **Arcade** — hull bar, score, defeat at zero hull. The reference build's register.
- **Classroom** — no hull/score. A capacity board (To Do / In Progress / Blocked / Done, WIP
  limit 2) holds five backlog items; each hit of damage blocks the top in-progress item; a
  stage clear moves one item to Done. When everything is blocked, the Lead's Trouble is
  compelled: Accept gains a Fate point and resets the stage's progress; Refuse spends a Fate
  point (only offered while you have one) and frees one blocked item. Score becomes **shifts**
  (+1 per stage cleared, -1 per hull-40/shield complication), shown and explained in the record.

## Events and the writer
`emit(event, extra)` fires at exactly: `begin` (each stage start), `node1` (first shield node
breaks), `shield` (shield fails), `hull40` (hull first below 40%, once per run), `core50`,
`win`, `lose`, `stage-clear` (shore stages only, Handler line). Each carries
`{event, stage, band:{hull, accuracy}, retries, controlMode, personaPair, decision}` to
`writer()`, which picks a line by event, then by accuracy band (≥.48 vs below), skips the last
line used for that event, and calls `say()`. `say()` queues a lower-priority line rather than
interrupting; `win`/`lose` always pre-empt.

## PERSONAS and `build.py`
The inline block between `/* @personas:start */` and `/* @personas:end */` in `index.html` is
`const PERSONAS = <json>;`. Run `python3 arcade/cabinet/build.py` to regenerate it from
`arcade/personas/personas.json` — it replaces the block in place and is idempotent (a second
run with no source changes reports "no changes"). Shape: `pairs["id+id"]` (six keys, sorted
alphabetically) each with `lead`, `handler`, `opening` (3-line exchange), `lines` (`begin`,
`stageClear`, `node1`, `shield`, `hull40`, `core50`, `win`, `lose`, each 3 lines: going-well /
going-badly / neutral), `swapped` (alternate lead/handler, 1 line per event), and `compel`
(`trouble`, `offer`, `accept`, `refuse`). Plus top-level `algorithm` (same 7 events, no
`stageClear`) and `palettes`. If the sortie card's chosen Lead differs from a pair's authored
default (the "swap" control), the compel falls back to a small in-file `GENERIC_COMPEL` keyed
by persona, since `personas.json` only authors the default pairing's compel.

## Record
End-of-run "Record" button renders Markdown (`# Sortie Record — Hard/Wired Coast`, profile,
Lead/Handler, a Stages table with per-stage accuracy and trade-off accepted, a Complications
list, a Shifts list, and a fixed Transfer line) into a textarea with Copy and Download
(`data:` URL `<a download>`). Nothing is transmitted anywhere.

## localStorage
`htll.cabinet.pair` (last persona pair), `htll.cabinet.profile`, `htll.cabinet.haptics`,
`htll.cabinet.history` (run count + last accuracy, for the delta shown at run end). Clear via
browser site-data settings for this file's origin, or DevTools → Application → Local Storage.

## Verified
Zero console errors through a full classroom run and an arcade run (Playwright, headless
Chromium); F1/F2 open by keyboard and by click; F2's text and Canvas link are present in the
raw HTML with JavaScript disabled; screenshots at `smoke-classroom.png` / `smoke-arcade.png`.
**Not verified**: a real touch device, and the fully turn-based "complication rounds" framing
from the plan's §5.4 table — this cartridge stays real-time under both profiles (see the PR
description for why).
