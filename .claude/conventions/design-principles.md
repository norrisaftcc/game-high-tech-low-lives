# Design Principles

[← Back to Hub](../README.md)

---

## Core Philosophy

> "Make the mechanics clear through format, not explanation. The playbook teaches you how to play it."

---

## Visual Design

### Duotone Ink Line Art Style

**Aesthetic**: High contrast, clean technical illustration with character-specific color palettes

**Characteristics**:
- Ink line art foundation (black lines)
- Two-color palette (duotone) per playbook
- High contrast for clarity
- Clean technical illustration style
- Print-friendly, minimal shading

### Color Palettes by Playbook

**The Infiltrator**
- Primary: Orange `#FF6B35`
- Secondary: Teal `#1B4D5C`
- Theme: Corporate/underground duality

**The Influencer**
- Primary: Magenta `#FF006E`
- Secondary: Navy `#0A1F44`
- Accent: Gold (for highlights)
- Theme: Performance/authenticity

**The Nomad**
- Primary: Cyan `#00D9FF`
- Secondary: Purple `#4A0E4E`
- Theme: Water/freedom

**The Fixer** (when implemented)
- TBD - likely Green/Crimson or similar

---

## Print-and-Play Format

### Layout Requirements
- **2-4 pages per playbook** maximum
- Everything needed to play on the pages
- No external reference required
- Print-friendly (standard letter/A4)
- Clean margins, readable fonts

### Information Hierarchy
1. Who you are (identity/concept) - immediate
2. What you can do (stats/chrome) - scannable
3. How you do it (moves/mechanics) - clear
4. Why you do it (aspects/relationships) - thematic

---

## Typography

### Web/Digital
- **UI Text**: Clean sans-serif (system fonts)
- **Stats/Numbers**: Monospace for alignment
- **Headers**: Bold, sentence case, minimal decoration
- **Body**: Readable size (16px minimum), good line height

### Print
- **Headers**: Bold sans-serif
- **Body**: Serif for readability in long text
- **Mechanics**: Sans-serif or monospace for clarity
- **Emphasis**: Bold for game terms, italic for voice

---

## UI/UX Principles

### For Print Materials
- **Scannable**: Headers, bullets, whitespace
- **Functional**: Form follows mechanical function
- **Self-Teaching**: Format explains the rules
- **Example-Driven**: Show, don't tell

### For Web Application (Phase 3)
- **Mobile-First**: Responsive, touch-friendly
- **Fast Loading**: < 2 seconds initial load
- **Offline-Capable**: Works after initial load
- **Print-Clean**: CSS for artifact-free printing

### For Markdown (Phase 2)
- **GitHub Pages Ready**: Clean, simple styling
- **Navigation**: Clear links between content
- **Readable**: Good contrast, appropriate sizing
- **Shareable**: Permanent URLs for sections

---

## Mechanical Clarity Through Format

### Stress Track Design
Visual boxes, not abstract numbers:
```
MEAT:     [ ] [ ] [ ]
NERVES:   [ ] [ ] [ ] [ ]
SYSTEMS:  [ ] [ ] [ ] [ ] [ ]
```

### Chrome Format
Always show the trade-off:
```
NEURAL DECK PORT
Instant corporate access, zero-delay intrusion
+Systems (1 box) / -Meat (1 box)
```

### Move Format
Trigger → Roll → Outcomes (10+/7-9/6-)
```
When you [specific trigger], roll +[Stat].

10+: [clear strong success]
7-9: [success with cost or choice]
6-:  [failure with consequence]
```

---

## Content Design Patterns

### Playbook Structure (Consistent Across All)
1. Identity/Concept (who you are)
2. Name suggestions
3. Look options (visual descriptors)
4. Stats (pre-assigned)
5. Starting stress tracks
6. Chrome options (with stress trade-offs)
7. Talents (choose 2 from list)
8. Aspects (High Concept, Trouble, Connection)
9. Starting gear
10. Example consequences (per stress track)
11. How to play (good at, bad at, when to roll)
12. Signature move (playbook-specific)
13. Relationships (Phase Four)
14. Advancement options
15. Discovery questions (answer through play)

### Chrome Design Pattern
Each piece of chrome must:
- Have evocative name
- Include brief flavor (what it is/does)
- Show mechanical trade-off (stress shifts)
- Suggest fictional application
- Cost maintenance (implicit or explicit)

### Move Design Pattern
Each move must:
- Have clear trigger condition
- Specify stat to roll
- Define 10+/7-9/6- outcomes
- Show, not tell, fictional application
- Integrate with playbook identity

---

## Art Direction

### Character Portraits
- **Style**: Duotone ink line art
- **Perspective**: Organic, human, personality visible
- **Mood**: Character's essential nature
- **Detail**: Face, expression, key chrome visible

### Schematics/Diagrams
- **Style**: AR display, surveillance perspective
- **Perspective**: Cold technical documentation
- **Mood**: Corporate/clinical
- **Detail**: Chrome specs, system diagrams

### Scene Illustrations (Twine)
- **Style**: Manga-influenced cyberpunk
- **Colors**: Cyan/Orange duotone
- **Mood**: Tension, paranoia, competence
- **Detail**: Environmental storytelling

---

## Accessibility Standards

### Visual
- High contrast ratios (WCAG AA minimum)
- Clear font sizing (16px+ for body text)
- No color-only information (use icons/patterns too)
- Print-friendly black/white fallback

### Content
- Plain language for mechanics
- Examples show edge cases
- Consistent terminology
- Clear navigation structure

### Technical (Phase 3)
- Semantic HTML
- Keyboard navigation
- Screen reader friendly
- Responsive breakpoints

---

## Setting Aesthetic

### Pelagic World Visual Language
- Water everywhere (reflections, waves, depth)
- Vertical corporate towers
- Horizontal boat/platform sprawl
- Corporate clean vs nomad weathered
- AR overlays vs physical reality

### Cyberpunk Elements
- Chrome visible but integrated
- Corporate aesthetics (clean, branded)
- Underground aesthetics (jury-rigged, functional)
- Digital/physical blur (AR, neural interfaces)
- Surveillance omnipresent

---

## Phase-Specific Design Goals

### Phase 1: Print-Ready Text
- Clean markdown format
- Print-friendly layout
- Self-contained playbooks
- Example-driven mechanics

### Phase 2: Markdown MVP
- GitHub Pages clean display
- Simple navigation
- Shareable URLs
- Minimal styling, maximum clarity

### Phase 3: Interactive Tools (Deferred)
- Character sheet builder
- Stress/consequence tracker
- Dice roller
- Print export
- (Platform TBD - React vetoed)

---

## Quality Standards

**Every design decision must:**
- Serve the mechanics clearly
- Support the fiction strongly
- Print cleanly
- Scale responsively (web)
- Load quickly
- Teach through use, not explanation

**Visual elements must:**
- Match playbook color palette
- Support high contrast printing
- Reinforce thematic elements
- Enhance, not obscure, content

**Layout must:**
- Guide eye naturally
- Separate mechanics from flavor clearly
- Allow quick reference in play
- Work on multiple devices/media

---

## Anti-Patterns to Avoid

**Don't:**
- Use color as only differentiator (accessibility)
- Create single-purpose illustrations (must reinforce identity)
- Design for desktop-only (mobile-first approach)
- Rely on external references (self-contained)
- Obscure mechanics with style (clarity first)
- Use generic cyberpunk stock art (setting-specific)

---

## Success Criteria

**A player should:**
- Identify their playbook by color instantly
- Find relevant rules in < 10 seconds
- Understand mechanics from format alone
- Print cleanly without web artifacts
- Reference easily at the table

**An illustration should:**
- Reinforce playbook identity
- Use setting-specific aesthetics
- Print well in black/white
- Load quickly on mobile
- Tell story, not just decorate

---

[← Back to Hub](../README.md) | [Git Workflow →](./git-workflow.md) | [Writing Style →](./writing-style.md)
