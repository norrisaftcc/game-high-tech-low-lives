# Writing Style Guide

[← Back to Hub](../README.md)

---

## Core Principles

**General Style**: Orwell's rules for terse, clear writing
**Unusual Moments**: Gene Wolfe elegance and Bandlerism when things get strange
**Markdown**: Clean, scannable, print-friendly format

---

## Orwell's Rules (Our Foundation)

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print
2. Never use a long word where a short one will do
3. If it is possible to cut a word out, always cut it out
4. Never use the passive where you can use the active
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent
6. Break any of these rules sooner than say anything outright barbarous

**Application**: Game text should be direct, clear, and functional. No purple prose in mechanics. Save elegance for flavor.

---

## Voice and Tone

### For Mechanics Text
**Terse, active, functional**

Good:
- "Choose two chrome upgrades"
- "Mark stress when you take damage"
- "Roll 4dF + Cool to maintain cover"

Avoid:
- "You may wish to select two chrome upgrades from the list"
- "Stress should be marked when your character experiences damage"
- "The player rolls four Fate dice and adds their Cool modifier"

### For Flavor Text
**Evocative, specific, cinematic**

Good:
- "You're the ghost in the corporate machine, three faces for three worlds"
- "Your boat knows these waters better than you do. She groans when the nav computer suggests the charted route"
- "3.2 million followers watch you work. They want authenticity. They'll accept performance"

Avoid:
- "You are skilled at infiltration and espionage"
- "You are a skilled boat pilot"
- "You have many social media followers"

### For Twine/Interactive Fiction
**Gene Wolfe meets Mr. Robot**

- Elegant paranoia
- Smart competence under pressure
- Unreliable perspective when identity fractures
- Precise technical detail when it matters
- Emotional clarity in small moments

---

## Markdown Standards

### Headers
```markdown
# Main Title (H1 - once per document)
## Major Section (H2)
### Subsection (H3)
```

Use sentence case, not Title Case
Exception: Proper nouns and game terms (Chrome, Fate Points, etc.)

### Lists
**Bulleted** for options, examples, non-sequential items
**Numbered** for procedures, steps, ordered sequences

### Emphasis
**Bold** for game terms, mechanics keywords, important choices
*Italic* for thoughts, inner voice, emphasis in dialogue

### Code/Mechanics Blocks
Use `backticks` for:
- Stats: `Code +3`
- Dice notation: `4dF+2`
- Inline mechanical references

Use code blocks for:
- Character sheet sections
- Move formats
- Example rolls with results

---

## Game-Specific Terminology

### Always Capitalize
- Chrome (augmentations)
- Fate Points / Fate Dice
- Aspect (and specific types: High Concept, Trouble, Connection)
- Playbook names (The Infiltrator, The Nomad)
- The Raft (specific location)
- Corporate names (AlgoCratic-Fujikara, Apex Chrome)

### Don't Capitalize
- stress (stress tracks, stress boxes)
- consequence (mild/moderate/severe consequence)
- move (playbook move, basic move)
- dice roll, dice pool

---

## Playbook Writing Patterns

### Move Format
```markdown
**Move Name**: When you [trigger], roll +[Stat].

**On 10+**: [strong success]
**On 7-9**: [success with cost]
**On 6-**: [failure or hard bargain]
```

### Chrome Format
```markdown
**[Chrome Name]**
[Brief evocative description]
Stress: [+Systems/-Meat/-Nerves as applicable]
[Optional mechanical benefit or trigger]
```

### Example Format
```markdown
**Example**: [Brief scenario showing the rule in action, not explaining it]
```

---

## Content Patterns to Avoid

**Don't explain what should be shown**
- Bad: "This chrome helps you in combat situations"
- Good: "When bullets fly, your reflex booster moves faster than thought"

**Don't repeat yourself**
- If it's in the mechanics, don't restate it in flavor
- If it's in the example, don't explain it again

**Don't use generic cyberpunk clichés**
- Avoid: "jack in", "the matrix", "meat space" (unless subverting them)
- Prefer: Specific, setting-appropriate terminology

**Don't write "lore dumps"**
- World builds through play examples and character perspective
- Setting details emerge from chrome descriptions and moves
- Players learn by doing, not reading history

---

## Twine-Specific Style

### Scene Structure
- Open with sensory anchor (what you see, hear, feel)
- Present choice at moment of decision, not after
- Keep nodes focused (one scene, one decision)
- Label nodes clearly: `[scene1-classroom]` not `[node47]`

### Writing Style
**Orwell for action, Wolfe for unusual**

Normal moment:
> You check the dead drop. Empty. Chen's signal should have arrived an hour ago.

Unusual moment:
> The coffee shop's AR overlay flickers. For a moment you see yourself sitting across the table, mouth moving in conversation you're not having. The digital clone smiles like it knows something you've forgotten.

### Gradual Mechanics Introduction
Don't front-load rules. Introduce as used:
1. First choice → Aspect invoke (explain then)
2. First challenge → Basic roll (show, don't teach)
3. First consequence → Stress track (as it matters)

---

## Quality Checklist

Before finalizing any text, verify:

- [ ] Active voice where possible
- [ ] Shortest words that work
- [ ] Every word earns its place
- [ ] Mechanics are clear without explanation
- [ ] Examples show, don't tell
- [ ] Terminology is consistent
- [ ] Markdown is clean and scannable
- [ ] Tone matches context (terse for rules, evocative for flavor)

---

## Examples in Practice

### Mechanics Text (Terse)
**Before**:
> When your character attempts to maintain their cover identity while under scrutiny, you should roll four Fate dice and add your Cool modifier to determine the outcome.

**After**:
> When you maintain cover under scrutiny, roll +Cool.

### Flavor Text (Evocative)
**Before**:
> You have augmentations that help you in your work.

**After**:
> Your chrome writes checks your meat can't cash. Three bars of Systems stress buy you capabilities that would take a lifetime to earn naturally. The maintenance costs are someone else's problem—until the chrome breaks mid-job.

### Twine Scene (Wolfe-style)
**Before**:
> You see the corporate security guard approaching. What do you do?

**After**:
> The guard's badge reads "Chen, M." but the gait is wrong—too confident for a mid-level supervisor, too purposeful for a random patrol. Your subvocal comm is silent. You have three seconds to decide if this is your handler or your exposure.

---

[← Back to Hub](../README.md) | [Git Workflow →](./git-workflow.md) | [Design Principles →](./design-principles.md)
