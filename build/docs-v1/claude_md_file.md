# Cyberpunk RPG Playbook Website

## Project Overview

Interactive website for a Fate-based cyberpunk RPG with PbtA-style playbooks. The game uses Fate dice (4dF) with five stats, three stress tracks modified by chrome, and character aspects. Setting is pelagic/water world with corporate cyberpunk themes.

## Core Design Principles

**Print-and-Play in Web Format**
- Everything needed to play on 2-4 pages per playbook
- No external reference required
- Format IS the rules explanation
- "To do it, do it" - Apocalypse World pedagogy

**Visual Aesthetic**
- Duotone ink line art style
- Character-specific color palettes:
  - Infiltrator: Orange (#FF6B35) / Teal (#1B4D5C)
  - Influencer: Magenta (#FF006E) / Navy (#0A1F44) with Gold accents
  - Nomad: Cyan (#00D9FF) / Purple (#4A0E4E)
- High contrast, clean technical illustration
- Minimal chrome, maximum clarity

## Game Mechanics Summary

### Stats (Rated +0 to +3)
- **Body**: Physical endurance, strength, resilience
- **Reflexes**: Speed, precision, reaction time
- **Code**: Digital intrusion, programming, system manipulation
- **Tech**: Hardware engineering, repair, jury-rigging
- **Cool**: Nerve, presence, emotional control

### Stress Tracks
- **Meat**: Physical damage (bullets, falls, toxins)
- **Nerves**: Psychological strain (fear, pressure, betrayal)
- **Systems**: Technical damage to chrome and gear

Base: 3 boxes each. Chrome shifts these (+Systems usually costs -Meat or -Nerves).

### Consequences (When stress full)
- **Mild** (2 shifts): Clears after one scene
- **Moderate** (4 shifts): Requires attention
- **Severe** (6 shifts): Permanent until bought off

### Core Roll
Roll 4 Fate dice (showing +, -, or blank). Add relevant stat. Compare to difficulty or opposing roll.

### Chrome & Talents
- Chrome: Each piece shifts stress tracks, costs maintenance
- Talents: Choose 2 from 8-point budget
- Chrome can break (mechanical consequences)

### Aspects
- **High Concept**: Primary identity
- **Trouble**: What complicates life
- **Connection**: Someone who matters

Each can be invoked (spend Fate point for +2) or compelled (GM offers Fate point for complication).

## Completed Playbooks

### THE INFILTRATOR
- **Core Identity**: Corporate access, finding vulnerabilities
- **Primary Stat**: Code +3
- **Key Tension**: Multiple identities (surface/street/truth)
- **Distinctive Feature**: Layered identity structure (Sable Harker / Ann Sho / Samantha Hayes O'Day)
- **Chrome Focus**: Neural deck port, pattern recognition, subvocal comm
- **Signature Move**: "I Know This System" (analyzing familiar security)

### THE INFLUENCER  
- **Core Identity**: Streamed competence, corporate sponsors
- **Primary Stat**: Tech +3, Cool +2
- **Key Tension**: Performance vs authenticity
- **Distinctive Feature**: 3.2M followers as asset and liability, sponsor obligations
- **Chrome Focus**: Flagship optics, neural interface (broadcast quality), subdermal display mesh
- **Signature Move**: "Everything Is Content" (streaming jobs for benefits/complications)

### THE NOMAD
- **Core Identity**: Boat captain, smuggler, knows the routes
- **Primary Stat**: Reflexes +3
- **Key Tension**: Boat is home and liability, freedom vs maintenance costs
- **Distinctive Feature**: The boat is separate character with personality and condition tracking
- **Chrome Focus**: Pressure adaptation, neural link (boat interface), prosthetic limb
- **Signature Move**: "The Water Is Home" (navigating pelagic routes)

### THE FIXER
- **Core Identity**: Broker, connector, knows everyone
- **Primary Stat**: Cool +3
- **Key Tension**: Playing all sides means eventually choosing one
- **Distinctive Feature**: Network tracking (favors owed, debts outstanding, reputation), The Raft access
- **Chrome Focus**: Encrypted comm suite, analysis overlay, subdermal storage
- **Signature Move**: "I Know Someone" (introducing specialist NPCs)

## Key Setting Elements

### The Raft
- Armed libertarian seasteading platform
- Mutual assured destruction keeps peace
- Reputation-based economy (your word is bond)
- Neutral ground where hostile parties meet safely
- Black market hub, no jurisdiction
- Mechanical resource (roll Cool to arrange meetings there)

### Pelagic World
- 93% ocean coverage
- Corporate platforms and tower cities
- Nomad boats run cargo between platforms
- Corporate patrols vs smuggler routes
- Underwater infrastructure

### Corporate Presence
- AlgoCratic-Fujikara (AI/algorithm corp with digital clones)
- Apex Chrome (premium augmentation manufacturer)
- StreamLine Networks (content/bandwidth provider)
- Hexagon Solutions (security/counter-intelligence)

## Playbook Structure (Consistent Format)

1. Flavor text (who you are, what you do)
2. Name suggestions
3. Look choices (visual descriptor)
4. Stats (pre-assigned)
5. Starting stress tracks
6. Chrome options (choose X, each shifts stress)
7. Talents (choose 2 from list)
8. Aspects (High Concept, Trouble, Connection with examples)
9. Starting gear
10. Example consequences (for each stress track)
11. How to play section (good at, bad at, when you roll)
12. Playbook move (signature ability)
13. Relationships (Phase Four connection to another PC)
14. Advancement options
15. Questions to answer (discover through play)

## Technical Requirements

### Core Features
- **Interactive Playbook Selection**: Browse/filter by archetype
- **Character Sheet Builder**: 
  - Fill-in-the-blank for aspects
  - Chrome selection with real-time stress track updates
  - Talent picker with point budget tracking
  - Gear checklist
- **Stress/Consequence Tracker**: 
  - Visual stress boxes (checkable)
  - Consequence slots with severity
- **Fate Point Counter**: Track current/refresh
- **Relationship Phase**: Link to another player's character
- **Print-Friendly Export**: CSS for clean printing
- **Dice Roller**: 4dF roller with stat modifier

### Stretch Features
- Save/load character sheets (localStorage or export JSON)
- Example character quick-load (Ann Sho, Kaida Voss, Reyes Tovan)
- GM tools (NPC quick generator, complication tables)
- The Raft encounter generator
- Mobile-responsive design

## File Structure Suggestion

```
/src
  /components
    PlaybookSelector.jsx
    CharacterSheet.jsx
    StressTracker.jsx
    ChromePicker.jsx
    TalentPicker.jsx
    AspectBuilder.jsx
    DiceRoller.jsx
  /data
    playbooks.json (or individual files)
    chrome-catalog.json
    talents-catalog.json
  /styles
    duotone-themes.css (color palettes per playbook)
    print.css
  /assets
    character-portraits/ (duotone ink art)
    schematics/ (AR display style diagrams)
```

## Design Notes

**Duotone Implementation**
- Use CSS filters and blend modes for duotone effect
- Each playbook has distinctive color palette applied via theme class
- Portraits: Organic, human, personality visible
- Schematics: Cold technical documentation, surveillance perspective

**Typography**
- Clean sans-serif for UI (system fonts)
- Monospace for stats/numbers
- Headers: Bold, sentence case, minimal

**Layout Priority**
1. Mobile-first responsive
2. Print-friendly (no chrome tracking on print, just final values)
3. Accessibility (WCAG AA minimum)
4. Fast loading (minimize assets, lazy load portraits)

## Content Source

All playbook content exists as markdown artifacts in this conversation. Reference them for:
- Complete playbook text
- Chrome options with mechanical effects
- Talent descriptions
- Example consequences
- Signature moves

## Success Criteria

**A player should be able to:**
1. Choose playbook in < 2 minutes
2. Build complete character in < 15 minutes
3. Print character sheet that contains everything needed
4. Track stress/consequences during play without confusion
5. Reference rules without leaving character sheet

**Technical:**
- Load in < 2 seconds
- Work offline after initial load
- Print cleanly without web artifacts
- Mobile-friendly for table reference

## Starting Point

Begin with:
1. Playbook selector (grid of 4 current playbooks)
2. Single playbook viewer (Infiltrator as test case)
3. Basic character sheet with stress tracking
4. Chrome picker with stress calculation

Build incrementally. Test each feature with actual playbook content before adding next.

---

**Project Philosophy**: Make the mechanics clear through format, not explanation. The playbook teaches you how to play it. The website makes that tactile.