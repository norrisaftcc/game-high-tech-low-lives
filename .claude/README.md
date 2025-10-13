# Claude Code Instructions Hub

This is the central navigation hub for AI assistance in the High Tech, Low Lives RPG project.

## Quick Navigation

### Universal Conventions
These apply to all work across the repository:
- [Git Workflow](./conventions/git-workflow.md) - GitHub process, PRs, commits, branches
- [Writing Style](./conventions/writing-style.md) - Orwell/Wolfe style, markdown standards, voice/tone
- [Design Principles](./conventions/design-principles.md) - Duotone art, visual style, UI/UX

### Active Projects
Choose the project you're working on:
- [RPG Core](./projects/rpg-core/README.md) - Playbooks, mechanics, core game design
- [Solo Play](./projects/solo-play/README.md) - Shodann campaign, fronts, solo materials
- [Twine IF](./projects/twine-if/README.md) - Interactive fiction, Twine story implementation

---

## Project Overview

**High Tech, Low Lives** is a Fate-based cyberpunk RPG set in a pelagic (water-covered) world. We're building a complete tabletop RPG with playbooks, mechanics, solo play content, and interactive fiction tools.

### Three-Phase Delivery

**Phase 1: Finalize RPG Text** (current focus)
- Polish playbook content, mechanics, and format
- Creative and editorial refinement
- Print-ready game text

**Phase 2: Markdown MVP**
- GitHub Pages deployment
- Clean markdown presentation
- Shareable, readable format

**Phase 3: Technical Implementation** (deferred)
- Interactive digital tools
- Character sheet builder
- Platform TBD (React vetoed)

---

## Development Approach

**We work through GitHub issues and pull requests** with specialized AI agents:

- **kevin-github-algorithm**: Process enforcement, proper PR/issue workflow
- **scrum-team-engineer**: Technical review, implementation guidance
- **test-engineer**: Testing strategy, test writing
- **linx-wordsmith**: Eloquent, stylistically refined text
- **liza-creative-companion**: Creative ideation, fresh perspectives
- **product-architect-advisor**: Strategic decisions, content organization

### Project Board Usage
- All work tracked on GitHub project board
- Issues move through workflow stages
- Transparency and visibility into progress
- Coordination between agents and work streams

---

## Repository Structure

```
/build/                 # Generated docs and build artifacts
  /docs-v1/            # Version 1 playbook documentation
  /docs-v2/            # Version 2 playbook documentation
  /art/                # Character art and visual assets
  /shodann-solo/       # Solo play scenarios
/solo-play/            # Active solo play content
/core-rules/           # Core game mechanics
/.claude/              # AI assistance documentation (you are here)
  /conventions/        # Universal standards
  /projects/           # Project-specific guides
build_notes.md         # Comprehensive project overview
README.md              # Public project description
```

---

## Game at a Glance

**System**: Fate-based with PbtA-style playbooks
**Dice**: 4 Fate dice (4dF) + stat modifier
**Stats**: Body, Reflexes, Code, Tech, Cool (+0 to +3)
**Stress**: Meat, Nerves, Systems (base 3 boxes, modified by chrome)
**Aspects**: High Concept, Trouble, Connection
**Setting**: Corporate cyberpunk, 93% ocean-covered world

### Available Playbooks
1. The Infiltrator - Corporate access, multiple identities (Code +3)
2. The Influencer - Streamed competence, 3.2M followers (Tech +3, Cool +2)
3. The Nomad - Boat captain, smuggler (Reflexes +3)
4. The Fixer - Broker, network connector (Cool +3)

---

## Development Philosophy

> "Make the mechanics clear through format, not explanation. The playbook teaches you how to play it."

---

## Getting Started

1. **Choose your project** from the Active Projects list above
2. **Review universal conventions** that apply to all work
3. **Check the project README** for current state and active tasks
4. **Follow the git workflow** for all changes (issues, branches, PRs)

---

**[Universal Conventions →](./conventions/)** | **[Projects →](./projects/)**
