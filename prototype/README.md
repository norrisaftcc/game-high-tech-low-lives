# Prototype: Deck Interface MVP

**Status**: Working prototype - BBS aesthetic proof of concept
**Related**: Issue #22, PR #23

## Concept

You are the **HANDLER** - a netrunner remotely guiding an Enforcer through field operations.

This terminal interface is your **DECK** - a neural bridge system connecting you to your field agent. The console aesthetic is **diegetic** (part of the story world), not just a technical limitation.

## Aesthetic

- **BBS/Terminal UI**: Box-drawing characters, system messages, transmission logs
- **Cyan & Amber Color Scheme**: Classic retro terminal palette (ANSI colors)
  - Cyan: System UI, borders, status displays
  - Amber: Field transmissions, warnings, enforcer comms
  - White: Normal text content
  - Grey: Secondary info
- **Pelagic Solutions Neural Bridge**: In-world justification for the interface
- **Handler/Enforcer Dynamic**: You guide, they execute
- **Connection Status**: Shows link quality, enforcer vitals, latency
- **Transmission Format**: Radio-style communication with field agent

## Running the Prototype

### Interactive Mode (Default)

```bash
cd prototype
python3 deck_mvp.py
```

Play through the prologue, making choices at each decision point.

### Batch Mode (Non-Interactive Testing)

```bash
python3 deck_mvp.py --batch
# or
python3 deck_mvp.py --demo
```

Auto-selects choices and plays through the full scenario. Great for:
- Quick testing after code changes
- Seeing the full narrative flow
- CI/CD integration
- Demonstrating the aesthetic without interaction

**Requirements**: Python 3.6+ (no external dependencies)

## What It Demonstrates

### ✅ Working Features

1. **BBS-Style Interface**
   - ASCII box drawing (═, ║, ┌, ┐, └, ┘)
   - System messages with timestamps
   - Status displays (connection, vitals)
   - Clean visual hierarchy

2. **Narrative Framing**
   - Player as handler/netrunner
   - Enforcer (Nomad-7) in the field
   - Remote guidance dynamic
   - Diegetic interface (deck = console)

3. **Stress Display**
   - Meat/Nerves/Systems tracks
   - Filled (■) vs empty (□) boxes
   - Real-time status updates

4. **Choice System**
   - Numbered menu options
   - Command-line input
   - Branching dialogue
   - State affects relationship (connection status changes)

5. **Transmission System**
   - Incoming messages from field agent
   - Source labeling [NOMAD-7]
   - Formatted for readability
   - Timed delays for pacing

### 🎮 Playthrough

**Prologue Scene**: "First Contact"

1. Neural bridge initialization sequence
2. Connection established with Nomad-7
3. Field report: Guards, patrol boats, heavy chrome
4. **Choice 1**: How to respond? (3 options, affects next transmission)
5. Follow-up based on your choice:
   - Ask about approach preference
   - Scan enemy chrome (threat assessment)
   - Pull building schematics
6. **Choice 2**: Why this mission? (3 options, affects connection status)
   - Professional distance ("need-to-know")
   - Mission details ("extraction job")
   - Personal stakes ("I'll explain later")
7. Enforcer goes dark (entering shielded area)
8. End of prologue

**Playtime**: ~3-5 minutes

## Design Decisions

### Why This Works

1. **Solves the "CLI problem"**: Text interface is now narratively justified
2. **Cyberpunk aesthetic**: BBS terminals fit the genre perfectly
3. **Handler role**: Player is strategist, not just observer
4. **Remote guidance**: Explains why you give commands via text
5. **Pelagic setting**: Corporate infrastructure, neural bridges, deck culture

### Technical Choices

- **No external dependencies**: Pure Python stdlib
- **No ncurses yet**: Testing if we even need it (probably not!)
- **ANSI colors**: Cyan/amber terminal palette for cyberpunk aesthetic
- **Simple typewriter effect**: `time.sleep()` for pacing
- **Cross-platform clear**: Works on Mac/Linux/Windows
- **Box drawing characters**: UTF-8 supported everywhere now

### Narrative Benefits

- **Enforcer has personality**: Nomad-7 talks back, has opinions
- **Dynamic relationship**: Your choices affect connection status
- **Voice**: Field agent has distinct voice (practical, slightly cynical)
- **Stakes feel real**: Rain, guards, chrome, risk
- **Meta-layer**: You're not *playing* an Enforcer, you're *guiding* one

## Next Steps

### If This Works (Aesthetic Validation)

1. **Build scene system**: Load scenes from JSON
2. **Add combat**: Handler calls targets, Enforcer executes
3. **Expand stress**: Track enforcer damage remotely
4. **Add chrome**: Remote scanner shows augments
5. **Environmental data**: Deck displays building schematics, thermals
6. **Signal degradation**: When enforcer goes dark, limit options
7. **Multiple enforcers?**: Could guide different agents (Nomad-7, Spectre-2, etc)

### If We Need More

- ~~**Color**: ANSI color codes~~ ✓ DONE - Cyan/amber palette implemented
- **ASCII art**: Small graphics for status indicators
- **Sound effects**: Terminal beeps (via `\a`)
- **Save/load**: Store deck logs
- **Playback**: Review past transmissions
- **Animation**: Scanlines, glitch effects for authenticity

## Code Structure

```python
class DeckInterface:
    """BBS-style terminal for guiding Enforcer"""

    def print_header(self):
        """ASCII art header, version info"""

    def print_status(self):
        """Connection status, enforcer vitals"""

    def print_transmission(self, text, source):
        """Incoming message from field"""

    def print_system_message(self, text):
        """Deck system status"""

    def get_choice(self, choices):
        """Command menu input"""
```

**Scene Flow**:
1. System initialization
2. Status display
3. Transmission from field
4. Present choices
5. Get player command
6. Respond based on choice
7. Update status/relationship
8. Continue or end scene

## Example Output

```
════════════════════════════════════════════════════════════
╔══════════════════════════════════════════════════════════╗
║          D E C K   I N T E R F A C E   v2.4.1           ║
║          PELAGIC SOLUTIONS NEURAL BRIDGE SYSTEM          ║
╚══════════════════════════════════════════════════════════╝
════════════════════════════════════════════════════════════

[SYSTEM] CONNECTION ESTABLISHED

┌─ CONNECTION STATUS ────────────────────────────────────┐
│ ENFORCER:  NOMAD-7         STATUS: SECURE       │
│ LINK:      NEURAL BRIDGE        LATENCY: 24ms         │
└────────────────────────────────────────────────────────┘

┌─ ENFORCER VITALS ──────────────────────────────────────┐
│ MEAT:     ■■■  NERVES:   ■■■  SYSTEMS:  ■■■  │
└────────────────────────────────────────────────────────┘

>> INCOMING TRANSMISSION [NOMAD-7]
────────────────────────────────────────────────────────────
   Handler, this is Nomad-7. I'm in position outside the
   target. Rain's coming down hard. Visibility is shit.
────────────────────────────────────────────────────────────

┌─ AVAILABLE ACTIONS ────────────────────────────────────┐
│ [1] "Copy that. What's your approach preference?"          │
│ [2] "Scan their chrome. I need threat assessment."         │
│ [3] "Hold position. I'm pulling building schematics."      │
└────────────────────────────────────────────────────────┘

COMMAND >
```

## Feedback Questions

After testing, consider:

1. **Does the deck interface feel natural?**
2. **Is the handler/enforcer dynamic clear?**
3. **Does the BBS aesthetic enhance or distract?**
4. **Is the text readable/formatted well?**
5. **Do the transmissions feel like radio comms?**
6. **Does the prologue establish the relationship?**
7. **Would you want to play more of this?**

## Files

- `deck_mvp.py` - Standalone prototype (run this!)
- `README.md` - This file

---

**Next**: If this aesthetic works, build full JSON-driven scene system with this as the presentation layer.
