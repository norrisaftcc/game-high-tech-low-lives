---
name: code-review
description: Review pull requests in the High Tech, Low Lives repository for voice, palette, Fate mechanics and vendoring rules, as well as code correctness.
---

# Reviewing a High Tech, Low Lives pull request

This repository is a Fate-based cyberpunk RPG on a 93% ocean world: playbooks, solo play, and offline browser prototypes under `arcade/`. Guidance lives in `CLAUDE.md` and `arcade/README.md`. Cite the file and line when you raise a rule.

## Blocking: raise these as high severity

| Check | What to look for |
|-------|------------------|
| Vendored files | An edit to `arcade/crawler/engine/`, `ui/`, `tools/`, `test.mjs`, `SPEC.md`, the fixture packs, or to `arcade/stage/engine/`, `ui/`, `tools/`, `SPEC.md`, `MOTION.md`, `GUIDE.md`, `test.mjs` or the stage fixtures. These are byte-for-byte copies from the games-osr-fort-on-lake repository. They change there first, then are re-copied; `check-vendor.mjs` must pass. |
| Storage | `localStorage` outside try/catch, or a key that does not start with `htll.`. |
| Network | Any external script, style, font or image in a page under `arcade/` that must open from `file://`. |
| Fate math | 4dF is four dice of −1, 0, +1, so totals run −4 to +4 before the stat. Success with style is 3 or more over the difficulty. A tie is equal. Check thresholds against this. |
| Stress | Meat, Nerves and Systems are 3 boxes each, modified by chrome. |

## Voice (medium severity)

- **Handler** lines: dry Vance irony, under 90 characters a line, bent per playbook (Nomad laconic and maritime; Fixer transactional; Influencer performing to an audience; Infiltrator clipped and procedural).
- **Algorithm** lines: flat administrative Simplified Technical English. One idea per sentence. No metaphor.
- No profanity, no emoji, no CTS-285 course vocabulary in a character's mouth.
- Playbook text teaches through format, not explanation.

## Palette (medium severity)

Duotone ink line art, one pair per playbook: Infiltrator orange `#FF6B35` / teal `#1B4D5C`; Influencer magenta `#FF006E` / navy `#0A1F44` with gold; Nomad cyan `#00D9FF` / purple `#4A0E4E`; Fixer brass `#C89B3C` / green `#0B3D2E`. Text must reach 4.5:1 on its ground in every theme.

## The Stage (`arcade/stage/`)

This section applies once `arcade/stage/` lands (PR #34). The contract is `arcade/stage/SPEC.md` (vendored). A pack (`arcade/stage/packs/<id>/`) is data only. It never names a motion; the engine picks cues. Every ending must be reachable (`sim.mjs`). Note texts are 60 words or fewer.

## Do not raise

- Taste in prose that follows the voice rules.
- Missing features that the PR description lists as a later wave.
