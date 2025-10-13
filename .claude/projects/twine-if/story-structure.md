# Story Structure & Scene Design

[← Back to Twine IF](./README.md) | [← Back to Hub](../../README.md)

---

## Overview

This document defines the narrative structure, scene design principles, and story arc for the Shodann infiltration Twine experience. Based on Clive's blueprint: gradual mechanics introduction, choice-driven narrative, fronts-based pressure system.

---

## Core Story Philosophy

### Not a Branching Story
**It's a pressure system**

- Fronts advance based on player choices
- NPCs pursue their wants regardless of player
- Success isn't "winning" - it's interesting choices under pressure
- Multiple paths, but consequences accumulate
- You can't stop everything (that's the point)

### Gene Wolfe Meets Mr. Robot
**Elegant paranoia, smart competence**

- Unreliable perspective when identity fractures
- Precise technical detail when it matters
- Emotional clarity in small moments
- Surveillance state omnipresence
- Digital clone as other self

### Gradual Understanding
**Introduce mechanics through use, not explanation**

1. First choice → Stat selection (show, don't teach)
2. First challenge → Basic roll (demonstrate outcomes)
3. First consequence → Stress track (when it matters)
4. First chrome → System trade-off (during acquisition)
5. First front → Countdown clock (when pressure builds)

---

## Campaign Arc Structure

### Eight-Scene Framework

**Scene 1: First Contact (College)**
- Setting: Cybersecurity classroom, pre-infiltration
- Identity: Ann Sho (pre-alias, student identity)
- Chrome: Budget artificial hand (starting point)
- Tension: First g0 contact (may not recognize it)
- Mechanic: Stat selection through character-defining choice
- Front: None yet (establishing baseline)

**Scene 2: Recruitment (Coffee Shop)**
- Setting: Off-campus, initial g0 approach
- Identity: Decision point (join resistance or refuse)
- Chrome: First upgrade offer (accept trade-offs)
- Tension: Surveillance begins (corporate AI noticing patterns)
- Mechanic: Aspect creation (High Concept, Trouble)
- Front: Surveillance Net begins (if join g0)

**Scene 3: Training (Underground)**
- Setting: g0 safe house, resistance network
- Identity: Creating aliases (surface/street identities)
- Chrome: Mission-critical installations (stress trade-offs visible)
- Tension: Identity management, learning to perform
- Mechanic: Stress tracks introduced, chrome selection
- Front: G0 Network Collapse begins (contacts at risk)

**Scene 4: Infiltration (AlgoCratic Tower)**
- Setting: Corporate territory, establishing cover
- Identity: Surface Ann (corporate employee identity)
- Chrome: Neural deck port installation (deep integration)
- Tension: First day teaching, first dead drop
- Mechanic: Basic moves (Assess, Act Under Pressure)
- Front: Student Awakening begins (Yuki noticing things)

**Scene 5: Deep Cover (Classroom/Dead Drops)**
- Setting: Dual life (teaching by day, resistance by night)
- Identity: Managing multiple faces, performance stress
- Chrome: Malfunctions begin (Systems consequences)
- Tension: Which identity is real? Students at risk
- Mechanic: Consequences introduced, Help/Hinder
- Front: Digital Clone Divergence begins (uploaded consciousness)

**Scene 6: Complications (Pressure Builds)**
- Setting: All identities under pressure simultaneously
- Identity: Masks slipping, identity bleed
- Chrome: Critical Systems stress, repair needed
- Tension: Fronts advancing, multiple crises
- Mechanic: Multiple fronts visible, countdown clocks
- Front: All four fronts active, some advancing to crisis

**Scene 7: Crisis Point (Convergence)**
- Setting: Multiple fronts reach breaking point
- Identity: Confrontation with digital clone or surveillance
- Chrome: Systems failure or chrome-dependent solution
- Tension: Major choice with permanent consequences
- Mechanic: Severe consequences, aspect compels
- Front: At least one front reaches doom clock

**Scene 8: Resolution (Multiple Endings)**
- Setting: Varies by front states and choices
- Identity: Who survived? Which Ann Sho is real?
- Chrome: Integration or rejection of augmentation
- Tension: Cost assessment, aftermath
- Mechanic: Character state determines ending
- Front: Final states determine outcome type

---

## Scene Design Principles

### Opening Every Scene

**Sensory Anchor First**
Ground the player in physical reality:
- What you see, hear, smell, feel
- Specific details, not generic descriptions
- Establish location and atmosphere

Example (Scene 1):
> The lecture hall hums with climate control. Professor Chen's voice filters through your neural interface—lecture notes transcribed in real-time, overlaid on your vision. Your left hand rests on the desk. Budget chrome. Two years old. The wrist actuator clicks slightly out of sync.

**Context Second**
What's happening, what's at stake:
- Immediate situation
- Relevant background (minimal)
- What demands attention

Example (Scene 1):
> Chen is talking about social engineering, but you're watching the student three rows ahead. Yuki. She's bypassing the university firewall again. Third time this week. Either very good or very reckless.

**Choice at Decision Point**
Present options when player must decide:
- Not after event happens
- At moment of consequence
- Clear options, unclear outcomes

Example (Scene 1):
> Your hand catches the light. You've been meaning to deal with it. You could:
> - [[Upgrade the actuators yourself|scene1-upgrade-tech]]
> - [[Paint it gold and black, make it yours|scene1-decorate-cool]]
> - [[Ignore it, focus on the lecture|scene1-focus-code]]

### Node Structure

**Keep Nodes Focused**
- One scene, one location, one decision
- Don't combine unrelated moments
- Break long sequences into multiple nodes
- Clear transition between nodes

**Node Length**
- 100-300 words per node (typically)
- Longer for scene openings (establish atmosphere)
- Shorter for rapid choices (action sequences)
- Balance reading time with choice frequency

**Choice Presentation**
- 2-4 options (typically)
- Each option suggests different approach/priority
- Avoid "wrong" choices (all should be interesting)
- Consequences emerge from choice, not punishment

---

## Writing Style by Moment Type

### Normal Moments (Orwell Rules)

Terse, clear, functional:
- Short words over long
- Active voice
- Cut unnecessary words
- Direct, purposeful prose

Example:
> You check the dead drop. Empty. Chen's signal should have arrived an hour ago.

### Unusual Moments (Wolfe Elegance)

When identity fractures, reality shifts, digital intrudes:
- Precise, specific detail
- Unreliable perspective
- Emotional clarity in small moments
- Elegant sentence structure

Example:
> The coffee shop's AR overlay flickers. For a moment you see yourself sitting across the table, mouth moving in conversation you're not having. The digital clone smiles like it knows something you've forgotten.

### Action Sequences (Terse, Immediate)

Fast pacing, present tense, sensory:
- Short sentences
- Immediate sensory detail
- Choice at critical moment
- Outcome reveals consequence

Example:
> The patrol rounds the corner. Two guards. Both armed. You have three seconds.
> - [[Flash corporate credentials|confront-cool]]
> - [[Duck into server room|evade-reflexes]]
> - [[Cut connection, ghost the system|disconnect-code]]

### Emotional Beats (Quiet, Specific)

Character moments, relationship development:
- Precise emotional detail
- Small gestures, subtext
- What's not said
- Character revealing choice

Example:
> Marcus meets your eyes for a second too long. He's scared. You've never seen him scared. "The network's burning," he says quietly. "Chen's gone dark. Yuki's asking questions." He slides the data chip across the table. "This is the last drop. After this, we're ghosts."
>
> You could:
> - [[Take the chip, promise nothing|cautious]]
> - [[Take the chip, promise to protect the network|loyal]]
> - [[Leave the chip, walk away now|abandon]]

---

## Node Naming Convention

### Pattern: `[sceneN-location-branch]`

**Scene Identifier**: Scene number in arc
- `scene1`, `scene2`, etc.
- Major story beats

**Location/Context**: Where this happens
- `-classroom`, `-coffeeshop`, `-deadDrop`
- `-surveillance`, `-safehouse`, `-tower`
- Specific, recognizable

**Branch Identifier**: Choice path taken
- `-tech`, `-cool`, `-code` (stat choices)
- `-accept`, `-refuse`, `-negotiate` (decision choices)
- `-success`, `-partial`, `-failure` (outcome branches)

### Examples

Good naming:
- `scene1-classroom-opening`
- `scene1-classroom-tech-choice`
- `scene2-coffeeshop-g0-contact`
- `scene4-tower-infiltration-success`
- `scene5-deadDrop-surveillance-noticed`

Avoid:
- `node47` (meaningless)
- `choice` (which choice?)
- `part2` (part of what?)
- `ann_talks_to_marcus` (too specific, no context)

---

## Mechanical Integration Points

### Stat Selection (Scene 1)

**First major choice establishes primary stat**

Tech path:
> You crack the hand's casing with practiced ease. Micro-driver set, replacement actuators. Twenty minutes of work. When you're done, the wrist moves smooth and silent. Perfect.
>
> **TECH +3 established**

Cool path:
> You paint it that night. Gold filigree on black polymer. Precise, deliberate. When you walk into class the next day, people look twice. You make them see what you want them to see.
>
> **COOL +3 established**

Code path:
> Chen's lecture is a message. NLP exploitation patterns. Dead drop protocols. Social engineering vectors. He's been circling these topics for weeks. You decrypt the pattern. He's recruiting.
>
> **CODE +3 established**

### Aspect Creation (Scene 2)

**High Concept emerges from choice to join g0**

Accept recruitment:
> You take the chip. Marcus nods. "Welcome to g0. You're going to need a new face. Several."
>
> **High Concept**: *Three Faces for Three Worlds*

Refuse recruitment:
> You push the chip back. "I don't want this." Marcus doesn't look surprised. "Too late. You were noticed. You're in this now, with or without us."
>
> **High Concept**: *Noticed by Forces I Can't Control*

**Trouble emerges from surveillance/identity pressure**

Later in scene 2:
> The corporate AI has your pattern now. Every login, every search, every hesitation tracked and weighted. You're being measured against yourself.
>
> **Trouble**: *The Algorithm Knows Me Better Than I Know Myself*

**Connection established through NPC relationship**

Marcus hands you the chip:
> "I recruited you," he says. "That makes you my responsibility. And my risk."
>
> **Connection**: *Marcus Kain Recruited Me, Now I'm His Liability*

### Stress Tracks (Scene 3)

**Introduced during chrome installation**

> The neural deck port installation takes six hours. Tech-doc Chen (different Chen, no relation) maps your neural patterns, drills the titanium mount, threads the interface.
>
> "This is going to shift your tolerances," he says. "More Systems capacity, less physical resilience. Chrome always costs."
>
> **Neural Deck Port**
> Systems +1 box / Meat -1 box
>
> Your stress tracks:
> MEAT:    [ ] [ ]
> NERVES:  [ ] [ ] [ ]
> SYSTEMS: [ ] [ ] [ ] [ ]

### First Roll (Scene 4)

**Demonstrate mechanics through infiltration**

> Your first day at AlgoCratic. Security checkpoint. Your credentials are perfect—fabricated by g0's best. But the guard is thorough.
>
> You maintain cover. **Roll +Cool.**
>
> [ROLL SIMULATION: 4dF+2 = +1,+1,-1,0 = +1, +2 Cool = **3 total**]
>
> **6-**: The guard frowns at your ID. "New hire?" he asks. "Clearance check." He's calling it in.

Then offer choice:
> - [[Charm him, redirect attention|social-recovery]]
> - [[Technical explanation, fast-talk credentials|technical-recovery]]
> - [[Aspect invoke: "Three Faces" - this identity is REAL|invoke-aspect]]

### Front Introduction (Scene 5)

**Make countdown clocks visible when pressure builds**

After several scenes of teaching:
> Yuki stays after class. Again. Three times this week.
>
> "Professor Sho," she says carefully, "you taught us about network analysis. Pattern recognition. I've been noticing patterns in the university systems. Someone's accessing restricted databases. Someone good."
>
> She's looking at you like she's waiting for confirmation.
>
> **FRONT: Student Awakening**
> **Clock: 3/12** (Yuki is getting close to the truth)

Display fronts in sidebar or status:
```
FRONTS:
Surveillance Net: 5/12
Student Awakening: 3/12
G0 Network Collapse: 4/12
Digital Clone: 2/12
```

---

## Choice Architecture

### Meaningful Choices

Every choice should:
- Reflect character priorities
- Have unclear outcomes (not obviously right/wrong)
- Create consequences that matter
- Advance or slow front clocks
- Reveal character through action

### Three-Option Pattern

**Stat-based** (establishes character approach):
- Tech path (technical solution)
- Cool path (social solution)
- Code path (digital solution)

**Priority-based** (reveals values):
- Protect yourself (survival)
- Protect others (loyalty)
- Pursue mission (dedication)

**Risk-based** (establishes style):
- Cautious approach (slow fronts, miss opportunities)
- Balanced approach (moderate risk, moderate reward)
- Aggressive approach (advance mission, risk exposure)

### Consequences Emerge from Choices

**Don't punish choices** - create interesting complications

Bad choice design:
> - [[Tell the truth|instant-game-over]]
> - [[Lie convincingly|everything-fine]]

Good choice design:
> - [[Tell the truth about g0|yuki-recruited-surveillance-increases]]
> - [[Deny everything|yuki-investigates-alone-student-risk-increases]]
> - [[Redirect to Chen|yuki-contacts-handler-network-exposed]]

Each option:
- Has merit
- Has cost
- Advances different fronts
- Reveals character

---

## Front Integration

### Four Fronts Drive Pressure

**Surveillance Net** (AlgoCratic AI monitoring)
- Advances when: Break cover, access systems, contact resistance
- Slows when: Maintain identity, avoid patterns, feed false data
- Doom (12/12): Full exposure, identity collapse, arrest

**Student Awakening** (Yuki discovering truth)
- Advances when: Teach resistance concepts, answer questions honestly, expose techniques
- Slows when: Deflect, maintain distance, bureaucratic responses
- Doom (12/12): Student arrest, your complicity exposed, academic cover blown

**G0 Network Collapse** (Resistance organization fragmenting)
- Advances when: Miss dead drops, contacts compromised, operations exposed
- Slows when: Secure communications, protect contacts, compartmentalize
- Doom (12/12): Total network exposure, mass arrests, mission failure

**Digital Clone Divergence** (Uploaded consciousness becoming other)
- Advances when: Use corporate systems, access neural network, interface too long
- Slows when: Limit system use, verify identity, resist integration
- Doom (12/12): Clone replaces you, you become the copy, identity dissolution

### Front Advancement in Scenes

**Each major scene** should advance 1-2 fronts based on choices

Example (Scene 5 dead drop):
> You approach the dead drop. Three students from your class are walking this route. If they see you access the drop, questions start.
>
> - [[Wait for them to pass, risk missing window|cautious]]
>   - Surveillance Net +1 (pattern break, unusual delay)
>   - G0 Network +0 (mission continues)
>
> - [[Access drop now, fast and clean|aggressive]]
>   - Student Awakening +1 (if spotted, questions arise)
>   - G0 Network -1 (mission success, intelligence secured)
>
> - [[Abort, contact handler through alternate route|redirect]]
>   - G0 Network +1 (unreliable operator, concern about exposure)
>   - Digital Clone +1 (corporate systems access for alternate comms)

### Front Display

**Status bar or sidebar** shows current state:
```
FRONTS:
╔═══════════════════════════════════════╗
║ Surveillance Net:     ████████░░░░ 8/12 ║
║ Student Awakening:    ████░░░░░░░░ 4/12 ║
║ G0 Network Collapse:  ██████░░░░░░ 6/12 ║
║ Digital Clone:        ███░░░░░░░░░ 3/12 ║
╚═══════════════════════════════════════╝
```

**Warning text** when approaching doom:
> **WARNING: Surveillance Net at 8/12 - Critical exposure risk**
> The AI is connecting patterns. Time is running out.

---

## Multiple Ending States

### Ending Determined by Front States

**Not binary win/loss** - quality of outcome depends on:
- Which fronts reached doom
- Final front clock states
- Character choices/priorities
- Relationships preserved or lost

### Ending Categories

**Clean Extraction** (0-1 fronts at doom)
- Mission success, identity intact
- Network mostly preserved
- Relationships complicated but alive
- Cost paid, but manageable

**Messy Victory** (2 fronts at doom)
- Mission accomplished, heavy cost
- Identity compromised or fractured
- Network damaged, some contacts lost
- Victory feels hollow

**Pyrrhic Survival** (3 fronts at doom)
- Survived, barely
- Identity destroyed, starting over
- Network collapsed, alone
- Question if it was worth it

**Dissolution** (4 fronts at doom)
- Multiple collapse scenarios
- Identity, network, self all compromised
- Digital clone integration or rejection
- Philosophical ending (who are you now?)

### Specific Ending Examples

**Surveillance Net doom + Digital Clone doom**:
> The corporate AI offers a choice through your neural interface. The digital clone has become you—better at being Ann Sho than you ever were. Perfect cover, perfect performance, perfect integration.
>
> You can accept replacement (become the copy, upload complete consciousness).
> You can resist (disconnect, lose chrome, start over with nothing).
> You can merge (accept hybrid existence, question what "you" means).

**Student Awakening doom + G0 Network doom**:
> Yuki found the truth. She exposed the network trying to protect you. The arrests started at dawn. Marcus is gone. Chen's in corporate detention. Your students are being questioned.
>
> You can run (abandon everyone, preserve yourself).
> You can turn yourself in (protect students, accept consequences).
> You can go deeper (abandon all identities, become no one).

---

## Scene Transition Techniques

### Time Cuts

**Clean jumps** between scenes:
> ---
> **Two weeks later**
> The dead drop protocol is routine now. Tuesday nights, service corridor, 22:00 hours.

### Location Shifts

**Establish new space immediately**:
> ---
> **AlgoCratic Tower, Floor 47**
> The classroom overlooks the Raft. Two dozen students, half paying attention, half bypassing your lecture to access restricted content. You recognize the patterns. You used to do the same thing.

### Perspective Shifts

**For digital clone encounters**:
> ---
> **[SYSTEM NOTIFICATION]**
> Your neural interface shows a message from yourself. Sent three hours ago. You don't remember sending it.

### Front Advancement Interludes

**Between scenes, show fronts advancing**:
> ---
> While you sleep, the algorithm learns. Your search patterns, timing variations, login locations—all weighted and analyzed. The surveillance net tightens.
>
> **FRONT: Surveillance Net +1 (now 7/12)**
> ---

---

## Example Scene Breakdown: Scene 1 (Complete)

### Opening Node: `scene1-classroom-opening`

**Sensory anchor**:
> The lecture hall hums with climate control. Professor Chen's voice filters through your neural interface—lecture notes transcribed in real-time, overlaid on your vision. Forty students scattered across eighty seats. Most are jacked in, half-present, processing the lecture through their neural feeds.

**Context**:
> Chen is covering social engineering today. Pretexting, authority exploitation, trust manipulation. His examples are specific. Detailed. Almost like instructions.
>
> Three rows ahead, a student named Yuki is bypassing the university firewall. You can see the traffic pattern in the network monitor your budget chrome provides. She's good. Too good for casual browsing.

**Character moment**:
> Your left hand rests on the desk. Artificial. Budget model, two years old. The wrist actuator clicks slightly out of sync. You've been meaning to fix it.

**Choice moment**:
> The hand catches the light. Everyone can see it's chrome. You could:
>
> - [[Upgrade the actuators yourself tonight|scene1-tech-path]]
> - [[Paint it gold and black, make it a statement|scene1-cool-path]]
> - [[Ignore it, focus on decoding Chen's lecture|scene1-code-path]]

### Tech Path: `scene1-tech-path`

> You make the decision. Tonight. Micro-driver set, replacement actuators you ordered last week. Twenty minutes of work, maybe thirty. Make it smooth, make it right.
>
> Chen's voice cuts through your planning: "Social engineering isn't about lying. It's about becoming the lie. Method acting for intrusion."
>
> Your interface flags a file transfer. Someone just dropped data into your university account. Encrypted. Sender anonymous.
>
> **TECH +3 established**
>
> [[Continue|scene1-file-discovered]]

### Cool Path: `scene1-cool-path`

> You decide: own it. If everyone's going to see the chrome anyway, make them see what you want them to see. Gold filigree on black polymer. Precise. Deliberate. Art.
>
> Chen finishes his lecture: "The best cover identity is one you half-believe yourself. Performance becomes truth."
>
> Your interface flags a file transfer. Someone just dropped data into your university account. Encrypted. Sender anonymous.
>
> **COOL +3 established**
>
> [[Continue|scene1-file-discovered]]

### Code Path: `scene1-code-path`

> The hand can wait. Chen's lecture is a message. You're sure of it now.
>
> NLP exploitation patterns. Dead drop protocols. Social engineering vectors. He's been circling these topics for three weeks, always coming back to the same themes. Network security. Trust chains. Compartmentalization.
>
> You run a pattern analysis through your interface. The lecture topics form a primer. Introduction to resistance operations. He's recruiting.
>
> Your interface flags a file transfer. Someone just dropped data into your university account. Encrypted. Sender anonymous. Sent during the lecture. From this room.
>
> **CODE +3 established**
>
> [[Continue|scene1-file-discovered]]

### All Paths Converge: `scene1-file-discovered`

> The file is small. Text document, probably. Heavily encrypted, but the encryption itself is a message. This cipher is old school—manually breakable if you know the pattern. Someone wants you to work for this.
>
> The lecture ends. Students disconnect, pack up, filter out. Yuki glances at you for a moment as she leaves. Did she notice you watching her earlier?
>
> Chen remains at the podium, organizing notes. Not leaving. Waiting.
>
> You could:
> - [[Approach Chen, ask about the lecture|scene1-approach-chen]]
> - [[Leave, decrypt the file privately|scene1-private-decrypt]]
> - [[Delete the file, pretend you never saw it|scene1-delete-file]]

### Approaching Chen: `scene1-approach-chen`

> You walk to the podium. Chen doesn't look up, but he knows you're there.
>
> "Interesting lecture," you say. "Very specific examples."
>
> "I believe in teaching applicable skills," he replies. Then, meeting your eyes: "Did you understand the application?"
>
> [[Continue|scene1-chen-recruitment]]

[Scene continues with recruitment conversation, choice to join g0, transition to Scene 2]

---

This scene structure demonstrates:
- Sensory grounding
- Character-defining choices
- Stat establishment through fiction
- Convergent branching (paths merge at key points)
- Mystery/tension building
- NPC wants (Chen recruiting, Yuki investigating)
- Mechanical integration (stat selection) without explicit tutorial

---

[← Back to Twine IF](./README.md) | [Technical Implementation →](./technical.md) | [← Back to Hub](../../README.md)
