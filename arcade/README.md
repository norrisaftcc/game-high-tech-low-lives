# Arcade — the cabinet and its cartridges

Single-file HTML mini-games in the High Tech Low Lives world. Each cartridge carries one
CTS-285 module's decision mechanic underneath an in-character surface. The pedagogy, the
governance, and the per-module cartridge concepts are recorded on the course side, in
`AMLW05/cts-285_SOURCE/planning/HTLL-SIMULATIONS-AND-ARCADE-CABINET-PLAN-2026-09-10.md`.
This file holds what is HTLL's to define: the personas, the format, and the reference build.

**Status: proposed.** The reference build is the only runnable thing here.

## Layout

```
arcade/
  README.md                       this file
  hardwired-coast/
    index.html                    field build 0.8, the reference build, unchanged
    REVIEW-2026-09-10.md          the review that becomes the shell's first sprint
  cabinet/                        (planned) the shared shell: input profiles, event record,
                                  frame bar, record exporter, profile switch
  cartridges/                     (planned) one JSON + one stage module per module
  personas/                       (planned) six pair sheets
```

Phase note: this is technical implementation, which the project deferred to Phase 3. A
single-file HTML game with no framework sits inside the *Hard/Wired Coast* precedent and
outside the React veto. It does not start Phase 3; it is a spike beside it.

## Personas

The player picks two of the four canonical playbooks. One is the **Lead** in the field. One is
the **Handler** on comms. The Handler is the *Coastal Control* voice with a face; the
antagonist voice is **The Algorithm**, this world's own emergent AI.

**The rule.** Personas change what you see, hear, and can do. They never change which analysis
decision is defensible. A stat gives fuller evidence text, a different move, a warmer line. It
does not make a wrong triage right, and it does not make a right one score higher.

| Stat | In a decision stage | In an action stage |
|---|---|---|
| Cool | Stakeholder evidence is fuller; the Handler's lines are warmer | — |
| Code | Systems evidence is fuller; the dependency door opens faster | — |
| Tech | Design evidence is fuller; the design door opens faster | — |
| Reflexes | — | Handling |
| Body | — | Hull, arcade profile only |

Each playbook brings one move and one Trouble into the cabinet:

| Playbook | Move in the cabinet | Trouble that gets compelled |
|---|---|---|
| Infiltrator | **Familiar Ground** — once per run, an investigation stage opens with one evidence item already on the board; The Algorithm names what is different | *My Former Employer Wants Me Back or Dead* |
| Influencer | **The Stream** — once per run, +2 Cool for a stage; every decision in that stage is public and cannot be reversed without a recorded cost | *I Can't Turn Off — The Stream Is Always Running* |
| Nomad | **Nobody Stops Me** — once per run, pass a blockade stage cleanly or pass it and be known | *My Boat Is Falling Apart and Repairs Cost More Than I Make* |
| Fixer | **I Know Someone Who Can Help** — once per run, bring in a specialist who answers one question for free; the favour is recorded | *I Owe Favors to Rival Corps — They'll Both Call Them In* |

The six pairs, with the crossing that seeds the opening exchange (from the phase-trio
crossings where one exists; the others are to be written):

| Pair | Lead / Handler default | Opening seed |
|---|---|---|
| Infiltrator + Nomad | Infiltrator / Nomad | *Extraction Protocol Tango* — the Nomad gets the Infiltrator out |
| Infiltrator + Fixer | Infiltrator / Fixer | to write |
| Infiltrator + Influencer | Infiltrator / Influencer | to write: secrecy against performance |
| Nomad + Fixer | Nomad / Fixer | to write: the Fixer books the berths the Nomad runs |
| Nomad + Influencer | Nomad / Influencer | to write: the smuggling partner on camera |
| Fixer + Influencer | Influencer / Fixer | to write: the sponsor's broker |

Either persona can be Lead; the table gives the default. Each pair sheet holds the six event
lines (encounter begins; first node breaks; shield fails; hull first below 40 %; core at 50 %;
victory or defeat), the opening exchange, and the compel text. Lines are under 90 characters.
No line names a DataMan behaviour.

**Palettes.** Infiltrator orange `#FF6B35` / teal `#1B4D5C`. Influencer magenta `#FF006E` /
navy `#0A1F44` with gold accents. Nomad cyan `#00D9FF` / purple `#4A0E4E`. **The Fixer has no
palette on record and needs one before the Fixer pair sheets are drawn.** Face, Hacker, and
Enforcer are not canonical and are not in the cabinet.

## Stakes: the two profiles

`profile: "arcade" | "classroom"`. The arcade profile is the reference build's register: hull,
score, a rising threat. The classroom profile is what a cartridge runs under if it is ever
launched from Canvas, and it converts each stake instead of removing it:

| Arcade | Classroom |
|---|---|
| Hull | A three-column capacity board with a WIP limit; damage pushes an item back to *blocked* |
| Score | Shifts, the Fate term, written into the record as the trade-off accepted |
| Rising threat on a clock | Complication rounds, turn-based; the water rises one round per decision |
| Lives, retries | A compel on the Lead's Trouble: accept for a Fate point, or spend one to refuse |
| Rank | A perk with a plus and a minus, stated as an aspect, chosen at the sortie card |

Invoke and compel are already a trade-off engine. The classroom profile leans on them.

Build every cartridge to the classroom profile first, then add the arcade profile on top.

## Format

The seed is `prototype/` — a scene dictionary, messages with a speaker, choices with
conditions and effects, flat additive state. Three nodes are added and two conventions fixed.

```jsonc
{
  "metadata": { "title": "Suspended, Coastal", "module": "M2", "version": "0.1" },
  "profile_default": "classroom",
  "personas": { "lead": null, "handler": null },      // filled at the sortie card
  "start_scene": "brief",
  "scenes": {
    "brief":  { "messages": [ { "speaker": "handler", "text": "..." } ],
                "choices":  [ { "id": "go", "text": "Begin", "effects": { "next": "ping-1" } } ] },

    // added: a 4dF check with the four outcome tiers from core_moves_sheet.md
    "ping-1": { "check": { "stat": "cool", "difficulty": 2,
                           "on_style": "ev-full", "on_success": "ev-plain",
                           "on_tie": "ev-cost", "on_fail": "ev-none" } },

    // added: a real-time stage for the action cartridges
    "sortie": { "stage": { "rule": "capacity", "spawn": "black-tide", "limit": 20,
                           "events": ["begin", "node-1", "shield", "hull-40", "core-50", "end"] } }
  },

  // added: which flags and choices the exporter writes under which record heading
  "record": {
    "title": "M2 Elicitation Decision Record",
    "sections": { "Investigation Path": ["ping-*"], "Initial Position": ["position"],
                  "Complication": ["complication"], "Revision": ["revise"] }
  }
}
```

The Twine scene at `build/shodann-solo/scene2-contact.tw` is the working model for the check
node: thresholds `+5` style, `+3` success, `+1` tie, else fail, with a Fate point on style and
Nerves stress on fail. Port that, not the prototype's combat loop, which flattens the ladder to
one stress per exchange.

Conventions fixed on the way in:

- Stress is marked, not subtracted: positive numbers damage. The prototype has it inverted.
- `scene_type` is dropped; the engine never read it.
- The `vars` block, `threat_scan`, and `building_intel` in `scene_format.md` were specified and
  never implemented. They are not carried.

## The event record and the banter writer

Every cartridge emits `{event, stage, band, retries, controlMode, personaPair, decision}` to
one local writer, which picks an authored line from the pair sheet. That is the review's
`{event, hullBand, accuracyBand, retries, controlMode}` with two fields added. Authored offline
lines are the default and the fallback; a live connection, if one is ever made, sits behind
the same record.

## The frame bar

A bar on the frame edge that belongs to the tool, never to the fiction: `F1 How this works`,
`F2 Step out of character`, and a real link out. The no-penalty statement leads the panel. The
link works with scripting disabled. This is not optional and it is not a cartridge's to omit;
it ships in the shell.

## Reference build

`hardwired-coast/index.html` is field build 0.8 as reviewed, unchanged. The review is the first
sprint. Play it on a phone; the workspace browser runner would not launch and the review had to
be done from the code, so the first human playtest note is the most valuable file this
directory does not yet have.
