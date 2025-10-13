# Game Mechanics Reference

[← Back to RPG Core](./README.md) | [← Back to Hub](../../README.md)

---

## Overview

Complete mechanical systems for High Tech, Low Lives. This is a Fate-based game with PbtA-style playbooks, set in a pelagic cyberpunk world.

---

## Core Mechanic: The Fate Roll

### Basic Roll
**Roll 4 Fate dice + stat modifier**

Fate dice (dF) show:
- **[+]** = +1
- **[ ]** = 0 (blank)
- **[-]** = -1

Sum the dice, add your stat modifier, compare to:
- **Difficulty** (passive opposition)
- **Opposing roll** (active opposition)

### Interpreting Results

**10+**: **Strong success**
- You get what you want
- No cost, no complication
- You're in control

**7-9**: **Success with cost**
- You succeed, but:
  - Pay a price (stress, resources, position)
  - Accept a complication (hard choice, additional threat)
  - Succeed partially (choose from limited options)

**6-**: **Failure or hard bargain**
- You don't get what you want, or
- You get it at a terrible cost
- GM makes a move (introduce threat, escalate danger)

### When to Roll

**Don't roll** when:
- Outcome is certain (trivial task, impossible task)
- Failure isn't interesting
- Success doesn't cost anything to achieve

**Do roll** when:
- Outcome is uncertain
- Failure creates complications
- Success costs something or creates tension
- Player triggers a move

---

## Stats

Characters have five stats rated **+0 to +3** (exceptional cases: +4).

### The Five Stats

**BODY** - Physical endurance, strength, resilience
- Resist physical damage
- Endure hardship
- Overpower obstacles
- Absorb punishment

**REFLEXES** - Speed, precision, reaction time
- Move quickly
- React to danger
- Aim precisely
- Pilot vehicles

**CODE** - Digital intrusion, programming, system manipulation
- Hack systems
- Analyze security
- Write exploits
- Navigate digital space

**TECH** - Hardware engineering, repair, jury-rigging
- Fix broken systems
- Build devices
- Install chrome
- Jury-rig solutions

**COOL** - Nerve, presence, emotional control
- Maintain cover
- Resist pressure
- Influence people
- Keep your nerve

### Stat Distribution

**Playbooks assign stats** (no point-buy):
- One primary stat: **+3**
- Optional secondary stat: **+2**
- Others distributed: **+0 to +2**
- Total bonus: **+6 to +8**

This ensures playbook identity drives character capability.

---

## Stress and Consequences

### Three Stress Tracks

**MEAT** - Physical damage
- Base: **3 boxes**
- Modified by chrome (often reduced)
- Absorbs physical harm

**NERVES** - Psychological strain
- Base: **3 boxes**
- Modified by chrome (often reduced)
- Absorbs mental/emotional stress

**SYSTEMS** - Technical damage to chrome
- Base: **3 boxes**
- Modified by chrome (often increased)
- Absorbs cyber/technical damage

### Marking Stress

When you take damage:
1. Choose which stress track to mark
2. Mark boxes equal to shifts of damage
3. If you run out of boxes, take a consequence

Example:
- 2 shifts of damage → mark 2 boxes
- 4 shifts of damage → mark 4 boxes (or take consequence)

### Chrome Modifies Stress

Chrome typically trades one track for another:

```
Neural Deck Port
Systems +1 box / Meat -1 box

Final tracks:
MEAT:    [ ] [ ]        (reduced)
NERVES:  [ ] [ ] [ ]    (unchanged)
SYSTEMS: [ ] [ ] [ ] [ ] (increased)
```

This creates mechanical vulnerability: more chrome = more Systems stress capacity but less physical/mental resilience.

### Consequences

When you can't (or won't) absorb stress with boxes, take a consequence.

**Mild Consequence** (absorbs 2 shifts)
- Clears after one scene
- Minor complication
- Example: "Bruised Ribs", "Rattled Nerves", "Glitchy Audio Feed"

**Moderate Consequence** (absorbs 4 shifts)
- Requires attention to clear (scene of rest/repair)
- Significant complication
- Example: "Fractured Wrist", "Identity Bleed", "Corrupted Neural Interface"

**Severe Consequence** (absorbs 6 shifts)
- Permanent until bought off with advancement
- Major complication, changes character
- Example: "Shattered Knee", "Paranoid Delusion", "Security Backdoor in Your Chrome"

**Consequence slots**:
- 1 mild
- 1 moderate
- 1 severe

You can use multiple consequences to absorb one big hit.

### Clearing Consequences

**Mild**: Clears automatically after one scene

**Moderate**: Requires attention (scene of rest, medical care, repair)

**Severe**: Permanent until you spend advancement to buy it off

### Taken Out

If you can't absorb damage (all stress boxes full, all consequences used), you're **taken out**:
- Opponent decides what happens
- You're out of the scene
- Severe narrative consequences

---

## Aspects

### The Three Aspects

Every character has three aspects:

**High Concept**
- Who you are, what you do
- Primary identity
- Example: "Three Faces for Three Worlds"

**Trouble**
- What complicates your life
- Built-in pressure
- Example: "Which Face Is Real Anymore?"

**Connection**
- Someone who matters to you
- NPC with wants, needs, complications
- Example: "Marcus Kain Recruited Me, Now He's Paranoid"

### Using Aspects

**Invoke** (spend Fate point):
- Add **+2** to your roll, or
- Reroll all four dice
- Explain how aspect helps

**Compel** (GM offers Fate point):
- Accept complication tied to aspect
- Gain Fate point
- Make situation more interesting/difficult

### Fate Points

**Start each session** with Fate points equal to your refresh (typically 3)

**Gain Fate points** when:
- You accept a compel
- Someone invokes your aspect against you
- End of session (refresh to starting amount)

**Spend Fate points** to:
- Invoke your aspect (+2 or reroll)
- Declare a story detail (within reason)
- Resist a consequence (once per session)

---

## Moves

### Basic Moves (Available to Everyone)

**Assess the Situation**
When you pause to analyze what's happening, roll +Code or +Cool.
- **10+**: Ask GM 3 questions
- **7-9**: Ask GM 1 question
- **6-**: Ask 1, but you reveal yourself or waste time

Questions:
- What here is not what it seems?
- What's the biggest threat?
- What's my best way in/out?
- Who's really in control here?
- What should I be watching for?

**Act Under Pressure**
When you do something risky or react to immediate danger, roll +Reflexes or +Cool.
- **10+**: You do it
- **7-9**: You do it, but choose: hard choice, worse position, or pay a cost
- **6-**: Things get worse

**Go Aggro**
When you threaten credible violence to make someone do what you want, roll +Body or +Cool.
- **10+**: They do it or get out of your way
- **7-9**: They choose: do what you want, back off but complicate things, or force your hand
- **6-**: They call your bluff or escalate

**Seize by Force**
When you use violence to take something or someone, roll +Body.
- **10+**: Choose 3
- **7-9**: Choose 2
- Suffer little harm
- Take what you want
- Terrify, impress, or scatter them
- Inflict terrible harm

**Help or Hinder**
When you help or hinder another PC, describe how and roll +Connection (aspect) or relevant stat.
- **10+**: They get +2 or -2 to their roll
- **7-9**: They get +1 or -1, but you're exposed to danger, cost, or complication
- **6-**: Your attempt backfires

**Interface with Systems**
When you access, analyze, or manipulate digital systems, roll +Code.
- **10+**: Choose 3
- **7-9**: Choose 2
- You get in undetected
- You get what you need (data, access, control)
- You don't trigger alerts or countermeasures
- You leave no trace

**Fix or Fabricate**
When you repair, build, or jury-rig technical systems, roll +Tech.
- **10+**: It works as intended, quickly
- **7-9**: Choose 2: it works, it's fast, it's clean (no complications)
- **6-**: It might work, but there's a problem (unstable, traceable, incomplete)

### Playbook Moves

Each playbook has **signature moves** specific to their role. See individual playbooks for details.

### Custom Moves

GM can create **custom moves** for specific situations:
- Navigating the pelagic storms
- Negotiating with corporate AI
- Managing multiple identities under surveillance
- Resisting chrome malfunction

Format:
```
When you [trigger], roll +[Stat].
10+: [strong success]
7-9: [success with cost]
6-: [failure/complication]
```

---

## Chrome (Cybernetic Augmentation)

### Chrome Rules

**Stress Trade-off**: Chrome always costs something
- Typically: **+Systems** (increase cyber vulnerability)
- And: **-Meat or -Nerves** (decrease physical/mental resilience)

**Fictional Positioning**: Chrome changes what you can do
- Neural deck port → instant system access
- Subvocal comm → silent coordination
- Pressure adaptation → deep water operation

**Maintenance**: Chrome requires upkeep
- Systems stress = chrome damage
- Severe Systems consequence = critical malfunction
- Tech rolls to repair, Resources to replace

### Chrome Selection

**At character creation**: Choose 2-3 from playbook list

**During play**: Acquire through:
- Advancement (spend advance, accept stress trade-off)
- Fiction (find, steal, install via Tech roll)
- Resources (purchase, install, pay maintenance)

### Chrome Malfunction

When you have **Systems consequences**:

**Mild**: Glitchy, unreliable (GM compels at worst moments)

**Moderate**: Partially offline (reduced functionality, requires Tech roll to activate)

**Severe**: Critical failure (backdoored, corrupted, or broadcasting your location)

### Example Chrome

```
NEURAL DECK PORT
Instant corporate access, zero-delay intrusion
Systems +1 / Meat -1
When you interface with systems, you're already inside before security notices

SUBVOCAL COMMUNICATOR
Encrypted comms that look like thinking
Systems +1 / Nerves -1
Coordinate silently without moving your lips

REFLEX BOOSTER
Reaction speed faster than thought
Systems +1 / Meat -1
When bullets fly, your chrome moves before your brain catches up
```

---

## Advancement

### Earning Advances

**End of session**, discuss as group:
- Did we learn something important about the world?
- Did we overcome a serious threat or obstacle?
- Did we make a significant choice or sacrifice?

If yes to any question: **everyone gets 1 advance**

### Spending Advances

Choose one:
- **New talent** from your playbook
- **+1 to any stat** (max +3, or +4 with multiple advances)
- **Additional chrome** (accept stress trade-off)
- **Clear severe consequence** permanently
- **Establish new aspect** (replace old one)
- **Take talent** from another playbook
- **Create new identity** with full documentation (Infiltrator)
- **Train primary stat to +4** (requires 2 advances, becomes exceptional)

---

## Setting-Specific Mechanics

### Pelagic World

**93% ocean coverage** - land is rare, valuable, vertical

**The Raft**: Massive floating platform city (corporate territory)
- Corporate towers rise above
- Working platforms at sea level
- Depths below (maintenance, smuggling, resistance)

**Navigation**: Reflexes for piloting, Code for nav systems, Cool for reading weather

**Water Hazards**:
- Storms (Reflexes to navigate, Body to endure)
- Corporate patrols (Cool to avoid, Code to spoof transponders)
- Depth pressure (chrome or consequences)

### Corporate Control

**AlgoCratic-Fujikara**: Dominant megacorp
- Surveillance everywhere (Code to evade, Cool to blend)
- AI monitoring (Code to analyze, Cool to deceive)
- Access control (Code to bypass, Cool to social engineer)

**Resistance (g0)**: Decentralized network
- Dead drops (Cool to operate, Code to encrypt)
- Identity management (Cool to maintain, Code to fabricate)
- Network security (Code to protect, Cool to coordinate)

### Digital Systems

**AR Overlays**: Augmented reality everywhere
- Code to manipulate
- Cool to notice manipulation
- Systems stress when hacked

**Neural Interfaces**: Direct brain-computer connection
- Code for intrusion speed
- Tech for installation/maintenance
- Systems consequences = chrome vulnerability

---

## GM Principles and Moves

### Principles

- Make the world dangerous and unpredictable
- Give NPCs wants, not just stats
- Advance fronts when players look away
- Ask provocative questions, build on answers
- Think offscreen (what's happening elsewhere?)
- Make chrome cost something (stress, maintenance, vulnerability)
- Surveillance is everywhere (someone is always watching)
- Identity is performance (which face is real?)

### GM Moves

When players roll **6-** or when they give you opportunity:

**Threat/Danger Moves**:
- Put them in danger (immediate threat appears)
- Separate them (split the party, isolate someone)
- Advance a front (countdown clock ticks)
- Reveal an unwelcome truth (information that complicates)

**Cost/Complication Moves**:
- Trade harm for harm (they succeed but take damage)
- Offer hard choice (both options suck, pick one)
- Make them pay a price (resources, position, relationship)
- Turn their move back on them (consequences of success)

**NPC/World Moves**:
- NPC acts on their want (pursues agenda)
- Show the cost of chrome (malfunction, surveillance, maintenance)
- Expose surveillance (they were being watched)
- Identity pressure (which face are they wearing?)

---

## Quick Reference Tables

### Difficulty Numbers

| Difficulty | Target | Example |
|---|---|---|
| Routine | 6+ | Familiar task, ideal conditions |
| Challenging | 8+ | Significant obstacle, pressure |
| Hard | 10+ | Serious opposition, complications |
| Extreme | 12+ | Nearly impossible, perfect execution needed |

### Damage Scale

| Severity | Shifts | Example |
|---|---|---|
| Minor | 1-2 | Punch, fall, light shock |
| Moderate | 3-4 | Gunshot, bad fall, electrical burn |
| Severe | 5-6 | Explosion, long fall, chrome feedback |
| Catastrophic | 7+ | Vehicle crash, building collapse, system overload |

### Chrome Installation Difficulty

| Chrome Complexity | Tech Roll | Time | Example |
|---|---|---|---|
| Simple | 6+ | Hours | Subdermal display, comm implant |
| Moderate | 8+ | Days | Neural interface, reflex booster |
| Complex | 10+ | Weeks | Deck port, full prosthetic limb |
| Experimental | 12+ | Months | Pressure adaptation, AI co-processor |

---

## Example of Play

**GM**: You're in the server room. Three racks, minimal lighting, climate control humming. The data you need is on rack two. Security patrols pass every four minutes. You hear footsteps approaching.

**Player (Infiltrator, Code +3)**: I interface with the system through my neural deck port. I'm going for speed—grab the data and ghost before they arrive. Rolling Interface with Systems, +Code.

**Dice**: [+] [ ] [-] [+] = +1, +3 Code = **total 4** (6-)

**GM**: Okay, you're in, but the system's more hardened than you expected. You can get the data, but not before they arrive. Choose: leave now empty-handed, or stay and take the data but get spotted?

**Player**: I stay. I'm getting what I came for.

**GM**: The patrol rounds the corner as your deck finishes the pull. Two guards, both armed. They see you. What do you do?

**Player**: I switch to my surface identity—flash my corporate credentials. Act like I'm supposed to be here. Act Under Pressure, rolling +Cool.

**Dice**: [+] [+] [ ] [-] = +1, +2 Cool = **total 3** (6-)

**GM**: They're not buying it. The lead guard raises his weapon. "Access code, now." And I'm going to compel your Trouble: *"Which Face Is Real Anymore?"* You've been surface-Ann so long you freeze for a second—which credentials did you pull? You hesitate, and that tells them everything. Take a Fate point.

**Player**: Damn. Okay, I accept the compel. I'm hesitating, reaching for the wrong credentials. Can I invoke my High Concept *"Three Faces for Three Worlds"* to recover—I've done this a thousand times, muscle memory takes over, I pull the right ID?

**GM**: Sure, spend the Fate point you just earned. You smoothly produce valid credentials—but they're already suspicious. They're calling it in. You've got maybe thirty seconds before this gets very bad.

---

This is how the mechanics create pressure, force choices, and drive story. Rules support fiction, fiction justifies mechanics.

---

[← Back to RPG Core](./README.md) | [Playbook Structure →](./playbooks.md) | [← Back to Hub](../../README.md)
