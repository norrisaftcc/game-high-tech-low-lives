# Playtest Guide - Python Narrative Engine

**Version**: MVP Prototype
**Estimated Time**: 5-10 minutes
**Status**: Ready for feedback

---

## Quick Start

### Setup (One Time Only)

```bash
# 1. Navigate to prototype directory
cd prototype

# 2. Create virtual environment
python3 -m venv venv

# 3. Install dependencies
venv/bin/pip install pydantic

# Done! You're ready to play.
```

### Running the Game

```bash
# Interactive mode (make your own choices)
venv/bin/python3 engine.py

# Batch mode (auto-plays for quick demo)
venv/bin/python3 engine.py --batch
```

---

## What You're Testing

### Core Experience

**Narrative Framing**: You are the **HANDLER** - a netrunner remotely guiding your field agent (**NOMAD-7**, an Enforcer) through a mission. The terminal is your neural bridge "deck" connecting you to the field.

**BBS/Deck Aesthetic**: Cyan and amber terminal colors, box-drawing characters, classic cyberpunk BBS feel.

**Story Flow**: Make choices, see consequences, guide your enforcer through the mission.

### Demo Scenario: "First Contact"

**Setup**: Nomad-7 is in position outside a corporate tower. Three guards, patrol boats, heavy security. What's your play?

**Paths Available**:
1. **Scan threats** → Get intel on enemy chrome → Make tactical decision
2. **Pull building schematics** → Find alternate route → Stealth approach
3. **Go loud** → Trust enforcer's combat chrome → Combat encounter

**Submenu Actions** (press `4` then explore):
- Use combat stim (if you have one)
- Check enforcer vitals
- Abort mission
- Back to main choices

**Outcomes**:
- Stealth path: Enforcer goes dark, mission continues
- Loud path: Combat (50/50 coin flip for now) → Victory or defeat
- Abort: Mission failed

---

## Feedback We Need

### 1. Narrative & Flow

- [ ] Does the Handler/Enforcer dynamic feel natural?
- [ ] Are the choices clear and meaningful?
- [ ] Does the pacing work? Too fast? Too slow?
- [ ] Does the story pull you in?

**Notes:**
```
_________________________________________
_________________________________________
_________________________________________
```

### 2. UI & Aesthetics

- [ ] Is the cyan/amber color scheme readable?
- [ ] Do the colors enhance or distract from the experience?
- [ ] Are the boxes and borders clean?
- [ ] Does it feel like a cyberpunk deck interface?

**Notes:**
```
_________________________________________
_________________________________________
_________________________________________
```

### 3. Technical Issues

- [ ] Did setup work smoothly?
- [ ] Any crashes or errors?
- [ ] Text formatting issues?
- [ ] Colors not showing up correctly?

**Report Issues:**
```
_________________________________________
_________________________________________
_________________________________________
```

### 4. Combat Feel (Even Though It's a Coin Flip!)

- [ ] Does combat feel tense or impactful?
- [ ] Do victory and defeat feel different?
- [ ] Can you imagine 4dF dice making it better?

**Notes:**
```
_________________________________________
_________________________________________
_________________________________________
```

### 5. Submenu System

- [ ] Did you find the submenu? (Choice #4)
- [ ] Was it intuitive to use?
- [ ] Did "Back" work as expected?
- [ ] Useful for context actions?

**Notes:**
```
_________________________________________
_________________________________________
_________________________________________
```

### 6. Overall Impressions

**What worked well:**
```
_________________________________________
_________________________________________
_________________________________________
```

**What didn't work:**
```
_________________________________________
_________________________________________
_________________________________________
```

**What would make this better:**
```
_________________________________________
_________________________________________
_________________________________________
```

**Would you play more of this?** (Yes/No/Maybe)
```
_________________________________________
```

---

## Known Limitations (Expected)

These are things we know about and are working on:

- ✅ **Combat is a coin flip** - Full 4dF dice mechanics coming
- ✅ **Short scenario** - This is a 5-minute demo, not full story
- ✅ **No save/load** - Can't save progress yet
- ✅ **Stress not tracked** - Stress boxes shown but not functional
- ✅ **Limited choices** - Focused demo, not full branching narrative

These are **not bugs**, they're **TODOs** for the next iteration.

---

## Reporting Feedback

### Option 1: GitHub Issue

Create an issue: https://github.com/norrisaftcc/game-high-tech-low-lives/issues/new

Use label: `playtest-feedback`

### Option 2: PR Comment

Comment on PR #23: https://github.com/norrisaftcc/game-high-tech-low-lives/pull/23

### Option 3: Direct Message

Share your filled-out feedback form directly with the team.

---

## Troubleshooting

### "Command not found: python3"
Try `python` instead of `python3`

### "No module named 'pydantic'"
Run: `venv/bin/pip install pydantic`

### "externally-managed-environment" error
You need to use the venv:
```bash
python3 -m venv venv
venv/bin/pip install pydantic
```

### Colors not showing up
Your terminal might not support ANSI colors. Try:
- iTerm2 (Mac)
- Windows Terminal (Windows)
- Any modern terminal emulator

### Game won't start
Make sure you're in the `prototype` directory:
```bash
cd prototype
venv/bin/python3 engine.py
```

---

## Thank You!

Your feedback helps us build something great. This is a game jam prototype - rough edges expected, polish comes later. We want to know:

1. Does the core concept work?
2. Is the aesthetic compelling?
3. Would you want to play more?

Everything else we can iterate on.

**Have fun guiding your enforcer!** 🎮

---

**Technical Info**:
- Engine: Python 3.10+
- Dependencies: Pydantic (type validation)
- Story Format: JSON
- Platform: Mac/Linux/Windows (terminal required)
