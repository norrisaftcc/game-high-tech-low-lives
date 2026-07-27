# Playthrough: The Enforcer — Debt Collection (default path)

Real terminal output from `prototype/engine.py`, unedited except for
stripping ANSI color codes and squeezing repeated blank lines from the
batch-mode screen clear. Combat is genuinely randomized (not seeded), so
re-running this will produce a different fight-by-fight outcome — this is
one real run, not a scripted "best case."

**How it was generated:**

```bash
cd prototype
python3 -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python engine.py stories/debt_collection.json --batch
```

`--batch` mode always auto-selects option `[1]` at every choice — this is
the game's own smoke-test path, not a curated "good" playthrough. It's
useful precisely because it's the least favorable lens: whatever the game
does when nobody is steering it toward a good outcome.

**What it demonstrates:**

- All 5 scenes (Negotiation → Heist → Ambush → Betrayal → Reckoning) chain
  together correctly, including the router/variant scenes the schema
  conversion introduced.
- Combat fires 4 times along this path (optional in Negotiation and Heist,
  mandatory in Ambush, optional pursuit in Betrayal) using the real 4dF +
  stat-modifier engine from PR #27 — including two losses, which the
  content handles narratively rather than dead-ending.
- Stress persists on the real character (`MEAT` track visibly drops across
  the Ambush and Betrayal losses) and the `effects.stress` pipeline fires
  correctly (`[Stress: meat +1 -> 1/3]`).
- Flags set early (`THREATENED_COLLECTIVE` from the Negotiation choice)
  pay off later (the "marked" coda in the Clean Payoff ending), proving
  the branching state actually threads through 40+ scenes rather than
  resetting per-scene.
- The run exits cleanly (`exit code 0`) — no tracebacks, no unresolved
  scene references, no orphaned choices.

**Known rough edge, not a bug:** around the Ambush combat loss, both the
narrative text ("I'm not walking as fast as I was") and a mechanical
`effects.stress` penalty land back-to-back — the loss is being described
twice, once in prose and once as a separate stat hit on the next scene.
Not incorrect, just a little redundant; worth a look if someone's doing a
narrative pass later.

---

```text
[SYSTEM] Running in BATCH MODE

════════════════════════════════════════════════════════════
╔══════════════════════════════════════════════════════════╗
║          D E C K   I N T E R F A C E   v2.4.1           ║
║          PELAGIC SOLUTIONS NEURAL BRIDGE SYSTEM          ║
╚══════════════════════════════════════════════════════════╝
════════════════════════════════════════════════════════════

┌─ CONNECTION STATUS ────────────────────────────────────┐
│ ENFORCER:  NOMAD-7         STATUS: SECURE       │
│ LINK:      NEURAL BRIDGE        LATENCY: 24ms         │
└────────────────────────────────────────────────────────┘

┌─ ENFORCER VITALS ──────────────────────────────────────┐
│ MEAT:     ■■■  NERVES:   ■■■  SYSTEMS:  ■■■  │
└────────────────────────────────────────────────────────┘

[SYSTEM] LINK ESTABLISHED — LOW BAND

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Handler, Riptide-3, checking in. I'm inside the Undertow den — gutted
   cargo hulk on pylons, low-tide access only. Walked in dry. Won't
   stay that way.

   Juno's here. On her feet, arms wrapped around herself, won't look
   at the door. This isn't a standard extraction brief, Handler. This
   is your sister. Say so if I'm wrong about what we're doing tonight.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Vane's laying out terms. Fifty thousand credits by dawn, or the
   regulator comes out of her chest 'however it comes out' — his
   words, not mine. No anesthetic if we're late. Given what that
   chrome does for her lungs down in the deep sectors, that's not
   repossession. That's a body bag with a payment schedule attached.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   There's a wrinkle. Vane says Undertow's got a job needs doing
   tonight — corp remittance barge, sitting fat at low tide. Clear it
   for them, debt's gone, nobody's chrome comes out of anybody. He's
   watching me while he says it. Wants an answer, Handler.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Tell him fifty thousand isn't the only thing that leaves this room broken." │
│ [2] "We're reasonable people. Ask him what this job actually is." │
│ [3] "Take the job. We don't have four hours to spend talking." │
│ [4] More actions...                                        │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] COMBAT ENGAGEMENT: Coral Vane — Intimidation Contest (Body)

   RIPTIDE-3 vs Coral Vane — Intimidation Contest (Body)
   Opposed 4dF exchange - stat mods: RIPTIDE-3 +2 / Coral Vane — Intimidation Contest (Body) +1

   -- Round 1 --
   RIPTIDE-3: [ ] [+] [+] [+] = +3 (+2 stat -> +5)
   Coral Vane — Intimidation Contest (Body): [ ] [+] [ ] [ ] = +1 (+1 stat -> +2)
   >> RIPTIDE-3 lands a hit! Coral Vane — Intimidation Contest (Body) MEAT: 2/3

   -- Round 2 --
   RIPTIDE-3: [ ] [ ] [ ] [ ] = +0 (+2 stat -> +2)
   Coral Vane — Intimidation Contest (Body): [ ] [+] [ ] [+] = +2 (+1 stat -> +3)
   >> Coral Vane — Intimidation Contest (Body) lands a hit! RIPTIDE-3 MEAT: 2/3

   -- Round 3 --
   RIPTIDE-3: [ ] [-] [+] [ ] = +0 (+2 stat -> +2)
   Coral Vane — Intimidation Contest (Body): [+] [-] [ ] [+] = +1 (+1 stat -> +2)
   >> Clash - no clear hit

   -- Round 4 --
   RIPTIDE-3: [+] [-] [-] [+] = +0 (+2 stat -> +2)
   Coral Vane — Intimidation Contest (Body): [ ] [ ] [+] [+] = +2 (+1 stat -> +3)
   >> Coral Vane — Intimidation Contest (Body) lands a hit! RIPTIDE-3 MEAT: 1/3

   -- Round 5 --
   RIPTIDE-3: [-] [+] [+] [+] = +2 (+2 stat -> +4)
   Coral Vane — Intimidation Contest (Body): [-] [+] [+] [ ] = +1 (+1 stat -> +2)
   >> RIPTIDE-3 lands a hit! Coral Vane — Intimidation Contest (Body) MEAT: 1/3

   -- Round 6 --
   RIPTIDE-3: [ ] [+] [+] [-] = +1 (+2 stat -> +3)
   Coral Vane — Intimidation Contest (Body): [ ] [+] [+] [ ] = +2 (+1 stat -> +3)
   >> Clash - no clear hit

   -- Round 7 --
   RIPTIDE-3: [+] [ ] [-] [+] = +1 (+2 stat -> +3)
   Coral Vane — Intimidation Contest (Body): [+] [-] [-] [ ] = -1 (+1 stat -> +0)
   >> RIPTIDE-3 lands a hit! Coral Vane — Intimidation Contest (Body) MEAT: 0/3

[SYSTEM] COMBAT RESOLVED

   >> COMBAT SUCCESS
   RIPTIDE-3 prevails

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   That landed. Vane's jaw is doing something ugly, but he's giving
   ground on the clock — four hours, hard stop, and his crew's
   counting it too now, so it's real. Doesn't feel like a man who's
   going to forget I said it, though.
────────────────────────────────────────────────────────────

[SYSTEM] FLAG SET: THREATENED_COLLECTIVE

[SYSTEM] CLOCK: 4 HOURS TO DAWN

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Move to the barge.                                     │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

   >> TARGET: Corp remittance clearing platform, open-water mooring
   >> GUARD ROTATION: 4-minute intervals, underhull hatch blind 90 sec/pass
   >> ALARM GRID: Standard corp mesh, ledger-side trip
   >> TIDE WINDOW: Closing — underhull access floods in nine minutes

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Handler, I'm not alone out here. Local fixer caught wind we're
   moving on the barge — goes by Ratchet, says he knows this hull's
   blind spots better than the guards do. Offering to help carry,
   split the load 'so we're not both holding fifty grand if this goes
   sideways.' Practical guy. I trust the practical ones less than the
   ones who stay home, but he's not wrong about the math.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Small thing — Ratchet clocked a second patrol I hadn't logged and
   pulled me back before I walked into their sightline. Didn't have
   to. Didn't ask for a cut of the take to do it either. Noting that,
   Handler, because guys like that don't usually last long down here.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Go quiet. Hack the ledger, take exactly what we're owed." │
│ [2] "Blow the vault. Grab it and go."                      │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] COMBAT ENGAGEMENT: Barge Ledger Security — Stealth Contest (Code/Tech)

   RIPTIDE-3 vs Barge Ledger Security — Stealth Contest (Code/Tech)
   Opposed 4dF exchange - stat mods: RIPTIDE-3 +2 / Barge Ledger Security — Stealth Contest (Code/Tech) +1

   -- Round 1 --
   RIPTIDE-3: [-] [ ] [ ] [+] = +0 (+2 stat -> +2)
   Barge Ledger Security — Stealth Contest (Code/Tech): [-] [ ] [-] [+] = -1 (+1 stat -> +0)
   >> RIPTIDE-3 lands a hit! Barge Ledger Security — Stealth Contest (Code/Tech) MEAT: 2/3

   -- Round 2 --
   RIPTIDE-3: [-] [+] [ ] [ ] = +0 (+2 stat -> +2)
   Barge Ledger Security — Stealth Contest (Code/Tech): [ ] [+] [-] [ ] = +0 (+1 stat -> +1)
   >> RIPTIDE-3 lands a hit! Barge Ledger Security — Stealth Contest (Code/Tech) MEAT: 1/3

   -- Round 3 --
   RIPTIDE-3: [+] [+] [-] [-] = +0 (+2 stat -> +2)
   Barge Ledger Security — Stealth Contest (Code/Tech): [-] [+] [ ] [-] = -1 (+1 stat -> +0)
   >> RIPTIDE-3 lands a hit! Barge Ledger Security — Stealth Contest (Code/Tech) MEAT: 0/3

[SYSTEM] COMBAT RESOLVED

   >> COMBAT SUCCESS
   RIPTIDE-3 prevails

[SYSTEM] LEDGER ACCESS — SIPHON IN PROGRESS...

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   In. Quiet. Fifty thousand, clean transfer — nobody on this hull
   even twitched.
────────────────────────────────────────────────────────────

   >> TIDE WINDOW: 3 minutes remaining

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   That took longer than I wanted it to. Tide's turning under us.
   We move now.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Decide the take.                                       │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Ratchet's got the case open. Question's how much we take before
   this window shuts.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Take more than fifty. We might need the cushion."     │
│ [2] "Exactly fifty. Nothing extra. We're gone."            │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   More zeros than the number Vane gave us. Ratchet's counting it
   twice, doesn't say much. Just looks at it a beat longer than he
   needs to.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Head for the causeway.                                 │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] TRANSIT — FLOODED CAUSEWAY — TIDE RISING

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Handler, we're mid-tunnel, water's climbing our boots, and I don't
   like the way our footsteps are echoing back at us in here.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Fight through. We keep everything."                   │
│ [2] "Split up — Ratchet takes the money ahead, you hold the line." │
│ [3] "Dump the extra credits. Lighten the load, shorten this." │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Continue                                               │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Don't recognize the colors. Not corp, not Undertow — somebody else
   clocked we're carrying fifty grand and decided to make it their
   problem.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Ratchet's already got his back to the wall, hand on his own blade —
   watching the water, not the enemy. Filing that away.
────────────────────────────────────────────────────────────

[SYSTEM] HOSTILE ENGAGEMENT — MANDATORY

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Engage!                                                │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] COMBAT ENGAGEMENT: Unmarked Water Raiders

   RIPTIDE-3 vs Unmarked Water Raiders
   Opposed 4dF exchange - stat mods: RIPTIDE-3 +2 / Unmarked Water Raiders +1

   -- Round 1 --
   RIPTIDE-3: [+] [ ] [-] [-] = -1 (+2 stat -> +1)
   Unmarked Water Raiders: [ ] [+] [+] [-] = +1 (+1 stat -> +2)
   >> Unmarked Water Raiders lands a hit! RIPTIDE-3 MEAT: 0/3

[SYSTEM] COMBAT RESOLVED

   >> COMBAT FAILURE
   RIPTIDE-3 is overwhelmed

[SYSTEM] CRITICAL — STRESS APPLIED, PARTIAL LOSS

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Handler — they got into the case. Some of it's gone, and I'm not
   walking as fast as I was five minutes ago. We're going into the
   meet worse off than we came in here.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Head for the meet point.                               │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[Stress: meat +1 -> 1/3]

[SYSTEM] RENDEZVOUS POINT — RATCHET: NO CONTACT

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Handler, meet point's empty. Ratchet's not here.
────────────────────────────────────────────────────────────

[SYSTEM] CORRECTION — MULTIPLE CONTACTS, VANE'S COLORS

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Scratch that. He's here. So's Vane's crew, standing around him like
   they've been waiting a while. He's not tied up, Handler. He's just
   standing there. This wasn't a snatch. This was a delivery — of us.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   The job was never a favor. Vane rigged it so Undertow wins either
   way — skims a cut if we pull the heist clean, or takes the
   collateral off Juno if we don't. Ratchet was here to make sure of
   it. He doesn't even look sorry.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   I need to ask, Handler — did you know this route was rigged when you
   sent us in, or did you just need it to be over? Either answer
   changes what I do in the next ten seconds.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Go after him. Don't let him walk with our money."     │
│ [2] "Let him go. Take what we've got and move to the meet." │
│ [3] "Forget the cash. Find out who Ratchet actually answers to." │
│ [4] "Cover the gap. Whatever it costs, whoever we owe."    │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] COMBAT ENGAGEMENT: Ratchet — Pursuit Contest (Reflexes/Cool)

   RIPTIDE-3 vs Ratchet — Pursuit Contest (Reflexes/Cool)
   Opposed 4dF exchange - stat mods: RIPTIDE-3 +2 / Ratchet — Pursuit Contest (Reflexes/Cool) +1

   -- Round 1 --
   RIPTIDE-3: [ ] [ ] [-] [-] = -2 (+2 stat -> +0)
   Ratchet — Pursuit Contest (Reflexes/Cool): [+] [ ] [-] [ ] = +0 (+1 stat -> +1)
   >> Ratchet — Pursuit Contest (Reflexes/Cool) lands a hit! RIPTIDE-3 MEAT: 0/3

[SYSTEM] COMBAT RESOLVED

   >> COMBAT FAILURE
   RIPTIDE-3 is overwhelmed

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Lost him in the market stalls. Fistful of nothing, worse mood. We're
   walking into the den lighter than we've ever been, Handler.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] Return to Undertow's den.                              │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] RETURN — UNDERTOW DEN — TIDE: RISING

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   We're back where we started, Handler. Water's coming up through the
   grates now instead of keeping us out. Vane's waiting. So's Juno.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Juno's talking before Vane even opens his mouth. Says she took the
   loan because deep-sector work pays triple and she wasn't going to
   sit topside and watch us cover her rent forever. Wants that said
   out loud before whatever happens next happens.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Pay him. All of it. We're done here."                 │
│ [2] "We take Juno by force. Right now."                    │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   Money's counted. Vane's satisfied — publicly, anyway. Juno's free.
────────────────────────────────────────────────────────────

>> INCOMING TRANSMISSION [RIPTIDE-3]
────────────────────────────────────────────────────────────
   He's still got that look from when you threatened him, though. This
   isn't over just because the math is. We're marked, Handler, paid
   or not.
────────────────────────────────────────────────────────────

[SYSTEM] DEBT CLEARED — UNDERTOW: MARKED (SOFT TARGET)

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] [ENDING: CLEAN PAYOFF]                                 │
└────────────────────────────────────────────────────────┘

COMMAND > 1 [BATCH MODE: AUTO-SELECTED]

[SYSTEM] ═══════════════════════════════════════════════════════════

[SYSTEM] E N D   O F   S C E N A R I O

[SYSTEM] ═══════════════════════════════════════════════════════════
```
