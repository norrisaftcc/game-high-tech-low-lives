# Twine Interactive Fiction Project

[← Back to Hub](../../README.md)

---

## Project Status

**Current Phase**: Planning/Early Development
**Focus**: Converting solo play content into interactive Twine experience

---

## What This Is

Interactive fiction implementation of the Shodann solo play campaign using Twine. Players experience Ann Sho's infiltration through choice-driven narrative with integrated game mechanics.

**Platform**: Twine (SugarCube format)
**Style**: Gene Wolfe meets Mr. Robot - elegant paranoia, unreliable narrator
**Structure**: Scene-based nodes with mechanical integration

---

## Key Files

### Development Documents
- `/build/shodann-solo/SOLO PLAY TWINE STYLE.md` - Style guide and approach
- `/solo-play/` - Source material for conversion

### Twine Format
- Each scene = separate Twee file (for now)
- Node labeling: `[scene1-classroom]` format
- Gradual mechanics introduction
- Merge files later to avoid conflicts

---

## Current Tasks

### Active
- [ ] Define scene 1 structure (college classroom)
- [ ] Create Twee template format
- [ ] Map core mechanics to choice points
- [ ] Design gradual tutorial flow

### Planning
- [ ] Scene breakdown (full campaign)
- [ ] Choice/consequence flowchart
- [ ] Mechanical integration points
- [ ] Art asset requirements

---

## Narrative Structure

### Scene 1: First Contact
**Setting**: College classroom, cybersecurity course
**Protagonist**: Ann Sho (pre-alias identity)
**Chrome**: Artificial left hand (budget model)
**Tension**: First contact with g0, may not know what's happening

**First Choice** (establishes character):
- **Upgrade hand yourself** (+TECH) - Competent technical operator
- **Decorate it (gold/black)** (+COOL) - Make it a statement piece
- **Focus on class** (+CODE) - Prioritize learning/academics

This choice:
- Introduces stat system organically
- Establishes character personality
- Hooks into first aspect creation
- Sets tone for future decisions

### Planned Scene Arc
1. **College/Origin** - First contact, identity formation
2. **Recruitment** - g0 approach, resistance choice
3. **Training** - Skills, chrome, preparation
4. **Infiltration** - Identity establishment at AlgoCratic
5. **Deep Cover** - Teaching, dead drops, surveillance
6. **Complications** - Fronts advance, pressure builds
7. **Crisis Point** - Major choices, consequences
8. **Resolution** - Multiple endings based on front states

---

## Writing Style Guidelines

### General Tone
**Orwell's rules for terse, clear writing**
- Short words over long
- Active voice
- Cut unnecessary words
- Direct, functional prose

### Unusual Moments
**Wolfean elegance and Bandlerism**
- When identity fractures
- Digital clone encounters
- Surveillance state paranoia
- Consciousness questions

### Examples

**Normal moment** (Orwell):
> You check the dead drop. Empty. Chen's signal should have arrived an hour ago.

**Unusual moment** (Wolfe):
> The coffee shop's AR overlay flickers. For a moment you see yourself sitting across the table, mouth moving in conversation you're not having. The digital clone smiles like it knows something you've forgotten.

**Choice presentation**:
> Your left hand catches the light. Budget chrome, two years old, slightly misaligned at the wrist. You could:
> - [[Upgrade the actuators yourself|upgrade-tech]]
> - [[Paint it gold and black, make it yours|decorate-cool]]
> - [[Ignore it, focus on the lecture|focus-code]]

---

## Technical Structure

### Twee File Format
```
:: Scene1-Classroom [scene1]
[Narrative text here]

Your choice establishes who you are:
- [[Technical path|scene1-tech-choice]]
- [[Social path|scene1-cool-choice]]
- [[Academic path|scene1-code-choice]]

:: scene1-tech-choice
You crack the hand's casing...
[Continues]
```

### Node Naming Convention
- **Scene identifier**: `scene1`, `scene2`, etc.
- **Location/context**: `-classroom`, `-deadDrop`, `-surveillance`
- **Choice branch**: `-tech`, `-cool`, `-code`
- **Format**: `[sceneN-location-branch]`

### Gradual Mechanics Introduction

**Don't front-load rules. Introduce as used:**

1. **First choice** → Stat selection (show, don't explain)
2. **First challenge** → Aspect invoke (teach when needed)
3. **First failure** → Stress/consequence (as it happens)
4. **First chrome** → System trade-off (when acquired)
5. **First front** → Countdown clock (when pressure builds)

---

## Art Direction

### Visual Style
**"Ink and duotone, cyan/orange, cyberpunk manga art"**

### Scene Art Specs
- Duotone: Cyan `#00D9FF` / Orange `#FF6B35`
- Ink line art foundation
- Cyberpunk manga influence
- Key moments only (not every node)
- Emotional/atmospheric (not decorative)

### When to Use Art
- Scene transitions (new location)
- Major reveals (clone encounter, surveillance moment)
- Identity shifts (mask on/mask off)
- Chrome acquisition (visual enhancement)
- Crisis points (front advances)

---

## Mechanical Integration

### Core Systems in Twine

**Stats** (Code, Tech, Cool, Body, Reflexes)
- Track via Twine variables: `$statCode`, `$statTech`, etc.
- Display in sidebar or status bar
- Modified by choices and chrome

**Stress Tracks** (Meat, Nerves, Systems)
- Track boxes filled: `$stressMeat`, `$stressNerves`, `$stressSystems`
- Visual display: `[ ] [ ] [X]` format
- Modified by chrome selection and consequences

**Aspects** (High Concept, Trouble, Connection)
- Store as text variables: `$aspectHC`, `$aspectTrouble`, `$aspectConnection`
- Invoke choices: spend Fate point for +2
- Compel prompts: offer Fate point for complication

**Fronts** (4 countdown clocks)
- Track segments: `$frontSurveillance`, `$frontStudents`, etc. (0-12)
- Advance based on choices/time
- Display warning when close to doom

**Dice Rolls**
- Simulate 4dF: random(-4, 4) weighted to bell curve
- Add stat modifier
- Show result with narrative outcome
- 10+/7-9/6- outcomes presented as choices/text

---

## Detailed Documentation

For comprehensive information:
- [Story Structure Guide](./story-structure.md) - Scene design, Clive's blueprint
- [Technical Implementation](./technical.md) - Twee format, variables, mechanics

---

## Working on This Project

### Before Starting
1. Read [Writing Style Guide](../../conventions/writing-style.md) - Orwell/Wolfe approach
2. Review solo play source material in `/solo-play/`
3. Study existing Twine examples
4. Understand gradual mechanics tutorial philosophy
5. Review [Git Workflow](../../conventions/git-workflow.md)

### Content Checklist
- [ ] Scenes open with sensory anchor
- [ ] Choices presented at decision point (not after)
- [ ] Nodes are focused (one scene, one decision)
- [ ] Node labels follow naming convention
- [ ] Mechanics introduced as needed (not front-loaded)
- [ ] Tone shifts appropriately (Orwell → Wolfe)
- [ ] Art moments chosen for impact
- [ ] Variables tracked consistently

### Agent Collaboration
- **linx-wordsmith**: Craft Wolfe-style unusual moments, elegant prose
- **liza-creative-companion**: Brainstorm scene variations, choice consequences
- **scrum-team-engineer**: Structure Twee files, validate technical approach
- **test-engineer**: Test variable tracking, mechanical integration

---

## Connection to Other Projects

### Solo Play
- Source material for scenes
- Fronts system drives narrative pressure
- Relationship map = NPC interactions
- Phase Trio = backstory integration

### RPG Core
- Uses Infiltrator playbook mechanics
- Shares stress/consequence system
- Demonstrates rules through play

---

## Design Philosophy

**Gradual understanding** - Introduce mechanics as used, don't overload
**Show, don't tell** - Rules emerge from choices, not explanation
**Orwell for clarity** - Terse, active, functional writing
**Wolfe for strange** - Elegance when identity/reality fractures
**Choices matter** - Consequences accumulate, fronts advance

---

## Scene 1 Blueprint (Detailed)

### Opening
**Sensory anchor**:
> The lecture hall hums with climate control. Professor Chen's voice filters through your neural interface—lecture notes transcribed in real-time, overlaid on your vision. Your left hand rests on the desk. Budget chrome. Two years old. The wrist actuator clicks slightly out of sync.

**Context establishment**:
> Chen is talking about social engineering, but you're watching the student three rows ahead. Yuki. She's bypassing the university firewall again. Third time this week. Either very good or very reckless.

**Choice moment**:
> Your hand catches the light. You've been meaning to deal with it. You could:

### Three Branches

**Technical path** (+Tech established):
> [[Upgrade the actuators yourself|scene1-upgrade-tech]]
> You have the tools. Micro-driver set, replacement actuators ordered last week. Twenty minutes of work, maybe thirty. Make it smooth, make it right.

**Social path** (+Cool established):
> [[Paint it gold and black, make it a statement|scene1-decorate-cool]]
> If everyone's going to see the chrome anyway, own it. Gold filigree on black polymer. Make them look twice for the right reasons.

**Academic path** (+Code established):
> [[Ignore it, focus on the lecture|scene1-focus-code]]
> Chen's covering NLP exploitation patterns. This is the third time he's circled back to this topic. He's trying to tell you something without saying it directly.

### Branch Outcomes

Each leads to:
- Stat establishment (first stat set)
- First aspect seed (who are you becoming?)
- Connection to g0 contact (different approach per branch)
- Yuki interaction (technical, social, or academic)

---

## Future Development

### Planned Features
- [ ] Full scene breakdown (all campaign beats)
- [ ] Multiple ending states (based on front advancement)
- [ ] Chrome acquisition choices (integrated mechanics)
- [ ] Digital clone encounters (unreliable narrator)
- [ ] Save/load system (progress preservation)

### Technical Enhancements
- [ ] Custom Twine stylesheet (duotone aesthetic)
- [ ] Animated stress track displays
- [ ] Front countdown visualizations
- [ ] Character sheet sidebar
- [ ] Dice roll animations

### Content Expansion
- [ ] Alternate identity paths (not just Infiltrator)
- [ ] Different infiltration targets (not just AlgoCratic)
- [ ] Multiplayer decision points (crew integration setup)
- [ ] Post-campaign continuation (what happens after)

---

[← Back to Hub](../../README.md) | [Story Structure →](./story-structure.md) | [Technical Guide →](./technical.md)
