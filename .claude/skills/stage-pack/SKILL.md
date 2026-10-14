---
name: stage-pack
description: Use when making or changing a Stage pack in this repository (arcade/stage/packs/<id>, such as dead-drop), or its sets, feed kit, notes or commentary; or when asked for a solo visual novel or choose-your-own-adventure with motion. The Stage is a vendored motion visual-novel engine; a pack is data (script, notes, sets, theme, art).
---

# Build a Stage pack (HTLL)

The Stage plays a solo story as a motion picture. The engine is fixed; a pack is data. Detail is in `arcade/stage/GUIDE.md`. This file is the order of work and the checks.

## Vendored: do not edit

`arcade/stage/engine/`, `ui/`, `tools/`, `test.mjs`, `SPEC.md`, `MOTION.md`, `GUIDE.md`, `packs/test` and `packs/test-feed` are copied byte for byte from the Fort repository (`games-osr-fort-on-lake`, directory `stage/`). Change them there, then copy them here. Check with `node arcade/stage/check-vendor.mjs` once it exists (it expects `vendor matches <commit>`). The pack in this repository, `arcade/stage/packs/dead-drop/`, is ours.

## Steps, in order

1. **Read** `arcade/stage/SPEC.md` (it wins), `GUIDE.md`, `MOTION.md`, then `CLAUDE.md` and `arcade/personas/README.md`.
2. **Plan.** Write the plan at the top of the pack's `NOTES.md`: character, plot, the new perspective, what the commentary teaches. Then one SET BRIEF per set (GUIDE section 8).
3. **Write the data:** `pack.json`, `script.json`, `notes.json`, `theme.json`. Copy `packs/test-feed` as the shape. Packs never name a motion.
4. **Validate and simulate:**
   - `node arcade/stage/tools/validate.mjs arcade/stage/packs/<id>` expects `OK <id>`
   - `node arcade/stage/tools/sim.mjs arcade/stage/packs/<id>` expects every ending reached, nothing unreachable
5. **Write the sets, cast and art** (`sets.json`, `cast.json`, `art/`). The usual pair: kit `feed`, resolver `fate4df`.
6. **Build:** `node arcade/stage/tools/build.mjs arcade/stage/packs/<id>` (writes `arcade/stage/dist/<id>.html`).
7. **Test:** `node --test arcade/stage/engine/test.mjs` expects `# fail 0`. Then build every pack and run `node arcade/stage/test.mjs`, which expects `PASS`.

## Rules for any pack

- The first `exec` group carries a `rule` note in its own `notes` that teaches the gate. Teach 4dF on the first roll.
- Every note is 60 words or fewer. One idea per beat.
- No condition may read a field that an `input` writes.
- `look` decides the cue: `ink` is unwitnessed (a redaction lifting), `paint` is witnessed (the frame comes into focus).

## HTLL rules for a pack

- **Storage key** starts `htll.` (for example `htll.stage.dead-drop`). `arcade/TESTS.md` row A-13 applies. No network reference.
- **Duotone per playbook.** Infiltrator orange `#FF6B35` / teal `#1B4D5C`. Influencer magenta `#FF006E` / navy `#0A1F44` with gold. Nomad cyan `#00D9FF` / purple `#4A0E4E`. Fixer brass `#C89B3C` / green `#0B3D2E`. Set the theme from the lead's pair.
- **The Handler** speaks dry Vance irony, under 90 characters a line, bent to the playbook. Check lengths with a script.
- **The Algorithm** speaks flat administrative Simplified Technical English: one idea per sentence, no metaphor. In the feed it narrates what it sees.
- No profanity, no emoji, no CTS-285 course vocabulary in a character's mouth. Do not name a DataMan behaviour.
- Ann Sho's `guide` notes use her GameFAQs voice. Facts about characters come from their playbook files.
- Personas change what you see and can do. They never change which analysis decision is defensible.

## When the spec blocks you

Stop and report. **Never edit `SPEC.md`, `MOTION.md` or `GUIDE.md` here to make a pack pass.** They are vendored, so an edit also breaks `check-vendor.mjs`. The Fort lead changes the spec, then the code, then your pack. Work through a GitHub issue and a pull request, as `CLAUDE.md` says.
