# AGENTS.md

Guidance for AI agents working in this repository on the Stage. The rest of the project guidance is in [CLAUDE.md](CLAUDE.md); read it first.

## What `arcade/stage` is

The Stage is a motion visual-novel engine and its packs. A pack is data (script, notes, sets, theme, art). The engine, shell and tools come from the Fort repository (`games-osr-fort-on-lake`, directory `stage/`). They are **vendored**: copied byte for byte. Do not edit them here. Change them in the Fort repository, then copy them over.

| Path | What it is |
|------|-----------|
| `arcade/stage/engine/`, `ui/`, `tools/`, `test.mjs` | Vendored. The rules, the shell and kits (`paper`, `feed`), build, validate, sim, and the browser test |
| `arcade/stage/SPEC.md`, `MOTION.md`, `GUIDE.md` | Vendored. The contract, the motion tokens, how to build a pack. Where they disagree, `SPEC.md` wins |
| `arcade/stage/packs/test`, `packs/test-feed` | Vendored fixtures |
| `arcade/stage/packs/dead-drop/` | **Ours.** *The Dead Drop*: Shodann at the Harborview drop, seen through the Algorithm's surveillance feed (kit `feed`, resolver `fate4df`) |
| `arcade/stage/check-vendor.mjs` | Fails if a vendored file differs from the Fort's |

## Checks to run before you push

| Changed | Run | Expect |
|---------|-----|--------|
| `arcade/stage/packs/<id>` | `node arcade/stage/tools/validate.mjs arcade/stage/packs/<id>`, then `node arcade/stage/tools/sim.mjs arcade/stage/packs/<id>` | `OK <id>`; every ending reached, nothing unreachable |
| Any pack | `node arcade/stage/tools/build.mjs arcade/stage/packs/<id>`, then `node arcade/stage/test.mjs` | `PASS` |
| The vendored files | `node --test arcade/stage/engine/test.mjs`; `node arcade/stage/check-vendor.mjs` | `# fail 0`; `vendor matches <commit>` |

## Rules that matter for a pack

- **Storage.** Every key starts with `htll.` (`arcade/TESTS.md`, row A-13). A pack's `storageKey` does too.
- **Duotone.** Each playbook keeps its own pair. Infiltrator: orange `#FF6B35` and teal `#1B4D5C`. The full table is in `arcade/README.md`.
- **The Handler** speaks dry, in under 90 characters a line.
- **The Algorithm** speaks flat Simplified Technical English: one idea per sentence, no metaphor.
- Packs never name a motion. The engine picks the cue (`SPEC.md`, section 3).
- Notes and commentary lines are 60 words or fewer. Teach a rule the first time it matters.
- Voices, no-profanity and no-emoji rules, and playbook facts: `arcade/personas/README.md` and `CLAUDE.md`.

## Workflow

- Work through a GitHub issue and a pull request, as `CLAUDE.md` says. Branch from `main`.
- An agent that needs a spec change stops and reports it. Never edit `SPEC.md` here to make a pack pass.
- To update the vendored copy, follow `arcade/crawler/README.md` (the same method), with `arcade/stage/` in place of `arcade/crawler/`.

## Skill

`stage-pack` (`.claude/skills/stage-pack/SKILL.md`) gives the steps, the commands and the rules above. Use it for any pack, set, kit, note or commentary work.
