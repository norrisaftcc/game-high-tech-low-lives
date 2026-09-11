# Personas
Six pair sheets, one per Lead/Handler combination of the four canonical playbooks
(`fixer-infiltrator.md` … `influencer-nomad.md`). Each holds the default Lead/Handler, a
crossing vignette in phase-trio format, the sortie-card opening exchange, Handler lines for
all eight event moments (default and swapped Handler), and a compel on the default Lead's
Trouble. `personas.json` is the same content in the shape the cabinet inlines directly.

## Voice
The Handler speaks dry Vance irony, under 90 characters a line, bent per playbook: Nomad
laconic/maritime, Fixer transactional with favours as currency, Influencer performing to an
always-present audience, Infiltrator clipped/procedural. The Algorithm speaks flat
administrative Simplified Technical English, one idea per sentence, no metaphor. No profanity,
no emoji, no line over 90 characters, no CTS-285 course vocabulary in a character's mouth.

## The Fixer palette
Brass/gold `#C89B3C` against deep green `#0B3D2E`. Gold-brass reads as brokered currency for a
playbook whose whole trade is favours; the ledger-paper green sits apart from all three
existing duotones and stays clear of the Influencer's own gold accent.

## Validation
```
python3 -c "import json;json.load(open('arcade/personas/personas.json'))"
```
A line-length check (every `opening`, `lines`, `swapped.lines`, and `algorithm` string under
90 characters) was run against the current file and passed with zero violations.
