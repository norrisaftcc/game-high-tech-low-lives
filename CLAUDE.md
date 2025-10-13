# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Fate-based cyberpunk RPG development project called **"game-high-tech-low-lives-project"** set in a pelagic (water-covered) world. The game itself is "High Tech, Low Lives" - we're building a complete tabletop RPG with playbooks, mechanics, and eventually digital tools.

## Project Structure

```
/build/                 # Generated documentation and build artifacts
  /docs-v1/            # Version 1 playbook documentation
  /docs-v2/            # Version 2 playbook documentation
  /art/                # Character art and visual assets
  /shodann-solo/       # Solo play scenarios
build_notes.md         # Comprehensive project overview and requirements
README.md              # Basic project description
.github/               # Issues and PR templates for workflow
```

## Development Approach

**We work through GitHub issues and pull requests** with specialized AI agents handling different aspects:

- **kevin-github-algorithm**: Ensures PRs and issues follow proper procedures
- **scrum-team-engineer**: Reviews technical implementation and provides guidance
- **test-engineer**: Handles testing strategy and test writing
- **linx-wordsmith**: Crafts eloquent, stylistically refined text
- **liza-creative-companion**: Provides creative ideation and fresh perspectives

### Three-Phase Delivery

1. **Phase 1: Finalize RPG Text** *(current focus)*
   - Polish playbook content, mechanics, and format
   - Creative and editorial refinement
   - Print-ready game text

2. **Phase 2: Markdown MVP**
   - Quick GitHub Pages deployment
   - Clean markdown presentation
   - Shareable, readable format

3. **Phase 3: Technical Implementation** *(deferred)*
   - Interactive digital tools
   - Character sheet builder
   - Decided later (React vetoed)

## Game Mechanics Summary

- **System**: Fate-based with PbtA-style playbooks
- **Dice**: 4 Fate dice (4dF) + stat modifier
- **Stats**: Body, Reflexes, Code, Tech, Cool (rated +0 to +3)
- **Stress Tracks**: Meat, Nerves, Systems (base 3 boxes each, modified by chrome)
- **Aspects**: High Concept, Trouble, Connection
- **Setting**: Corporate cyberpunk in 93% ocean-covered world

## Available Playbooks

1. **The Infiltrator** - Corporate access, multiple identities (Code +3)
2. **The Influencer** - Streamed competence, 3.2M followers (Tech +3, Cool +2)  
3. **The Nomad** - Boat captain, smuggler (Reflexes +3)
4. **The Fixer** - Broker, network connector (Cool +3)

## Visual Design Requirements

- **Duotone ink line art style** with character-specific color palettes:
  - Infiltrator: Orange (#FF6B35) / Teal (#1B4D5C)
  - Influencer: Magenta (#FF006E) / Navy (#0A1F44) with Gold accents
  - Nomad: Cyan (#00D9FF) / Purple (#4A0E4E)
- High contrast, clean technical illustration
- Print-and-play format (2-4 pages per playbook)

## Current Focus: Content Quality

**Phase 1 Priorities:**
- Format consistency across all playbooks
- Clear, evocative writing that teaches through example
- Chrome/gear lists that inspire character concepts
- Move lists that feel cinematic and specific
- Print-ready layout (2-4 pages per playbook)

**Phase 2 Priorities:**
- Clean markdown structure for GitHub Pages
- Navigation between playbooks
- Quick reference for core mechanics
- Shareable URLs for individual playbooks

## Key Reference Documents

- `build_notes.md` - Complete project specification and requirements
- `build/docs-v1/claude_md_file.md` - Duplicate of build_notes.md with technical details
- `build/docs-v1/` - Individual playbook markdown files
- `build/docs-v2/` - Updated playbook versions

## Development Philosophy

"Make the mechanics clear through format, not explanation. The playbook teaches you how to play it."

## Workflow Guidelines

**All work happens through GitHub issues, PRs, and the project board:**

1. **Create issues** for features, bugs, or content improvements
2. **Add issues to the project board** for transparency and tracking
3. **Branch from main** for each piece of work
4. **Submit PRs** with clear descriptions of changes
5. **Tag appropriate agents** for review (kevin for process, scrum-team-engineer for technical, linx for content)
6. **Update project board status** as work progresses
7. **Merge to main** when approved

**Project Board Usage:**
- Use the GitHub project board to track all active work
- Update issue status as it moves through workflow stages
- Ensures transparency and visibility into project progress
- Helps coordinate between different agents and work streams

**When working on content:**
- Read existing playbooks to match tone and format
- Test that mechanics are clear without excessive explanation
- Ensure chrome/moves inspire specific character moments
- Think print-first, digital-later

**When working on Phase 2 (markdown MVP):**
- Focus on readability and navigation
- Keep it simple - GitHub Pages with minimal styling
- Make sure it's shareable and useful immediately
- Don't over-engineer - save that for Phase 3

## Agent Collaboration

Different agents excel at different tasks:

- **linx-wordsmith**: Polish prose, refine move descriptions, make chrome evocative
- **liza-creative-companion**: Brainstorm new chrome ideas, explore thematic variations
- **scrum-team-engineer**: Review markdown structure, assess technical approach
- **kevin-github-algorithm**: Ensure issues/PRs follow standards and link properly
- **product-architect-advisor**: Strategic decisions about content organization
- **test-engineer**: Verify mechanics calculations, stress track logic