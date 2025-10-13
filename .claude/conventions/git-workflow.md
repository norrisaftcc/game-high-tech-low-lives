# Git Workflow & GitHub Process

[← Back to Hub](../README.md)

---

## Core Principle

**All work happens through GitHub issues, PRs, and the project board.**

---

## Standard Workflow

### 1. Create Issues
- For features, bugs, or content improvements
- Use descriptive titles and clear descriptions
- Add appropriate labels
- Reference related issues if applicable

### 2. Add to Project Board
- All issues tracked on GitHub project board
- Ensures transparency and visibility
- Helps coordinate between agents and work streams

### 3. Branch from Main
- Each piece of work gets its own branch
- Use descriptive branch names (e.g., `feature/playbook-format`, `fix/stress-calculation`)
- Branch from latest `main`

### 4. Submit Pull Requests
- Clear description of changes
- Link to related issues
- Tag appropriate agents for review:
  - `kevin-github-algorithm` - Process compliance
  - `scrum-team-engineer` - Technical review
  - `linx-wordsmith` - Content/writing quality
  - `test-engineer` - Testing strategy

### 5. Update Project Board
- Move issues through workflow stages
- Keep status current as work progresses
- Close issues when PRs are merged

### 6. Merge to Main
- Only merge when approved
- Delete feature branch after merge
- Main branch should always be stable

---

## Commit Message Standards

**Format**: Clear, concise description of what changed and why

Good examples:
- "Add chrome selection rules to Infiltrator playbook"
- "Fix stress track calculation for Systems damage"
- "Update duotone color palette for Nomad"

Avoid:
- Vague messages like "updates" or "fixes"
- Messages that don't explain the change
- Multiple unrelated changes in one commit

---

## PR Description Template

```markdown
## Changes
Brief description of what this PR does

## Related Issues
Fixes #123
Related to #456

## Testing
How was this tested or verified?

## Review Notes
Anything specific reviewers should focus on?
```

---

## Branch Naming

**Pattern**: `type/short-description`

Types:
- `feature/` - New features or content
- `fix/` - Bug fixes
- `refactor/` - Code/content reorganization
- `docs/` - Documentation updates
- `test/` - Test additions or updates

Examples:
- `feature/nomad-chrome-options`
- `fix/infiltrator-stat-calculation`
- `docs/playbook-format-guide`
- `refactor/stress-track-structure`

---

## Project Board Stages

1. **Backlog** - Not yet started
2. **Ready** - Prepared and ready to work
3. **In Progress** - Actively being worked on
4. **In Review** - PR submitted, awaiting approval
5. **Done** - Merged and complete

---

## Agent-Specific Guidelines

### kevin-github-algorithm
- Ensures PRs follow proper procedures
- Verifies issue linking and labeling
- Checks that project board is updated
- Enforces workflow standards

### scrum-team-engineer
- Reviews technical implementation
- Provides architectural guidance
- Assesses code/content quality
- Suggests improvements

### linx-wordsmith
- Reviews writing quality and style
- Ensures tone consistency
- Polishes prose and descriptions
- Checks for clarity and elegance

### test-engineer
- Verifies mechanics calculations
- Tests game rule interactions
- Ensures stress track logic is correct
- Validates chrome/stat combinations

---

## What NOT to Do

- Don't commit directly to `main`
- Don't skip issue creation for non-trivial work
- Don't create PRs without linking to issues
- Don't merge without review/approval
- Don't leave stale branches hanging
- Don't batch unrelated changes into one PR

---

## Quick Reference

**Start new work**:
1. Create issue
2. Add to project board
3. Create branch
4. Make changes
5. Submit PR
6. Update board status

**Review process**:
1. Tag appropriate agents
2. Address feedback
3. Update PR as needed
4. Get approval
5. Merge and close

---

[← Back to Hub](../README.md) | [Writing Style →](./writing-style.md) | [Design Principles →](./design-principles.md)
