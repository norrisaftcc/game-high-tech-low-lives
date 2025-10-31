# Python Narrative Engine Architecture

**Project**: High Tech, Low Lives - Interactive Fiction Engine
**Version**: 1.0 (Game Jam 2025)
**Status**: Architecture Spike
**Related**: Issue #22 - Python Narrative Engine Epic

---

## Design Philosophy

**SIMPLE Principles:**
- **S**eparated concerns - clear boundaries between layers
- **I**mmutable state updates - functional style where possible
- **M**inimal dependencies - stdlib + typing, pytest
- **P**edagogical comments - teach why, not just what
- **L**ogging everything - learning through observation
- **E**xtensible design - students can build on it

**Core Value**: Clear over clever. This engine teaches how choice-based narratives work.

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│      CLI Presentation Layer (ui/)       │
│   - Text rendering and formatting       │
│   - Input handling and prompts          │
│   - Display logic only                  │
├─────────────────────────────────────────┤
│      Game Controller (controller/)      │
│   - Orchestrates game loop              │
│   - Connects all layers                 │
│   - Save/load coordination              │
├─────────────────────────────────────────┤
│       Domain Services (engine/)         │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ Scene    │ │ Combat   │ │ Dice    ││
│  │ Engine   │ │ System   │ │ Roller  ││
│  └──────────┘ └──────────┘ └─────────┘│
│   - Business logic lives here           │
│   - Pure functions preferred            │
├─────────────────────────────────────────┤
│      State Management (state/)          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │Character │ │ Story    │ │ World   ││
│  │ State    │ │ Progress │ │ State   ││
│  └──────────┘ └──────────┘ └─────────┘│
│   - Immutable updates                   │
│   - State transitions explicit          │
├─────────────────────────────────────────┤
│         Data Layer (data/)              │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ JSON     │ │ Schema   │ │ Loader  ││
│  │ Stories  │ │ Validator│ │         ││
│  └──────────┘ └──────────┘ └─────────┘│
│   - Story data in JSON format           │
│   - Validated on load                   │
└─────────────────────────────────────────┘
```

**Layer Communication**:
- Each layer only knows about the one below it
- No circular dependencies
- Data flows down, events flow up (via return values)

---

## Project Structure

```
high-tech-low-lives-engine/
├── README.md                   # Quick start guide
├── requirements.txt            # Minimal dependencies
├── setup.py                   # Make it pip installable
│
├── src/
│   └── htll_engine/
│       ├── __init__.py
│       ├── main.py           # Entry point, game loop
│       │
│       ├── data/              # JSON loaders and validators
│       │   ├── __init__.py
│       │   ├── loader.py     # Load and validate JSON
│       │   ├── models.py     # Data classes for stories
│       │   └── schemas/      # JSON schema definitions
│       │       └── story_v1.json
│       │
│       ├── state/             # Game state management
│       │   ├── __init__.py
│       │   ├── character.py  # Character stats, stress, chrome
│       │   ├── story.py      # Current scene, flags, choices made
│       │   └── world.py      # Time, environment, NPCs
│       │
│       ├── engine/            # Core game logic
│       │   ├── __init__.py
│       │   ├── scene.py      # Scene progression, choice evaluation
│       │   ├── combat.py     # Combat resolution, stress application
│       │   ├── dice.py       # Fate dice (4dF) mechanics
│       │   └── conditions.py # Requirement checking (stat >= X, flag set, etc)
│       │
│       ├── ui/                # Presentation layer
│       │   ├── __init__.py
│       │   ├── cli.py        # Terminal interface, main display
│       │   ├── renderer.py   # Format text, stress bars, etc
│       │   └── prompts.py    # Input handling, choice menus
│       │
│       └── controller/        # Orchestration
│           ├── __init__.py
│           └── game.py       # Main game controller, connects everything
│
├── stories/                   # Story data (JSON)
│   ├── tutorial.json         # Minimal teaching example
│   └── enforcer_debt.json    # "The Enforcer: Debt Collection"
│
├── tests/                     # Comprehensive tests
│   ├── test_dice.py          # 4dF mechanics
│   ├── test_combat.py        # Combat resolution
│   ├── test_scene_flow.py    # Scene transitions
│   ├── test_state.py         # State management
│   └── test_integration.py   # Full story playthrough
│
└── docs/                      # Student documentation
    ├── ARCHITECTURE.md       # This file
    ├── JSON_FORMAT.md        # Story data format guide
    ├── TUTORIAL.md           # Building your first story
    └── examples/             # Code snippets, patterns
```

---

## Core Components

### 1. Data Layer (`data/`)

**Purpose**: Load and validate story data from JSON files.

**Key Classes**:
- `StoryLoader`: Reads JSON, validates against schema
- `StoryData`: Dataclass representing loaded story
- `SceneData`: Individual scene with choices, conditions
- `EnemyTemplate`: Combat enemy definitions

**Design Decisions**:
- Use `dataclasses` for simple, readable data structures
- Validate on load, fail fast with clear error messages
- JSON schema uses flat ID references (not nested objects)
- Human-readable keys (not UUIDs)

**Example**:
```python
@dataclass
class SceneData:
    id: str
    type: str  # "narrative", "combat", "choice"
    title: str
    description: str
    choices: List[ChoiceData]
    next_scene: Optional[str] = None
```

---

### 2. State Management (`state/`)

**Purpose**: Track all game state - character, story progress, world state.

**Key Classes**:
- `CharacterState`: Stats, stress tracks, chrome, aspects
- `StoryProgress`: Current scene, flags set, choices made
- `WorldState`: Time, environment, NPCs

**Design Decisions**:
- **Immutable updates**: State changes return new state objects
- **Explicit mutations**: All state changes go through methods
- **No hidden side effects**: Pure functions where possible
- **Stress tracks**: 3 boxes base, modified by chrome (Meat, Nerves, Systems)

**Example**:
```python
class CharacterState:
    def apply_stress(self, track: str, amount: int) -> Tuple['CharacterState', Optional[str]]:
        """
        Apply stress to a track. Returns new state and consequence (if triggered).

        Example: Taking 2 Meat stress when at 2/3 boxes:
        - Fills Meat track (3/3)
        - Triggers "Mild Consequence"
        - Returns updated state + consequence name
        """
        # Implementation shows clear state transition
```

---

### 3. Engine Services (`engine/`)

**Purpose**: Core game logic - dice, combat, scene progression.

**Key Modules**:
- `dice.py`: Fate dice mechanics (4dF + stat)
- `combat.py`: Combat resolution, stress application
- `scene.py`: Scene loading, choice evaluation, navigation
- `conditions.py`: Check requirements (stat >= X, flag set, etc)

**Design Decisions**:
- **Pure functions preferred**: `roll_4df(stat: int) -> int`
- **Clear interfaces**: Input/output explicit
- **Strategy pattern for actions**: Easy to extend
- **Separate data from logic**: Scene data vs scene engine

**Example - Dice Mechanics**:
```python
def roll_4df() -> List[int]:
    """
    Roll 4 Fate dice. Returns list of [-1, 0, 1].

    Educational Note:
    We return the raw rolls instead of just the sum
    so students can see the individual dice results.
    This makes debugging easier and teaches probability.
    """
    return [random.choice([-1, 0, 1]) for _ in range(4)]

def check_success(roll_total: int, difficulty: int) -> str:
    """
    Determine success level for Fate roll.

    Returns: "success", "tie", or "failure"

    Thresholds:
    - Success: Roll >= difficulty
    - Tie: Roll == difficulty - 1
    - Failure: Roll < difficulty - 1
    """
    # Clear, testable logic
```

---

### 4. CLI Interface (`ui/`)

**Purpose**: Present game to player, handle input.

**Key Modules**:
- `cli.py`: Main terminal interface
- `renderer.py`: Format text, stress bars, status displays
- `prompts.py`: Input handling, choice menus

**Design Decisions**:
- **No game logic here**: Pure presentation
- **Clear formatting**: Use ANSI colors sparingly
- **Readable output**: Text adventure aesthetic
- **Simple input**: Number choices, not text parsing

**Example Output**:
```
=== THE ENFORCER: DEBT COLLECTION ===

SCENE 2: THE HEIST
Location: Corporate Payroll Skiff, Tower 19 Docks

The skiff bobs gently in the oily water. Security lights sweep the deck
every 30 seconds. You've got your chrome, your nerve, and not much time.

[CHARACTER STATUS]
Body: +3  |  Cool: +2  |  Reflexes: +1
Meat: ■■□  |  Nerves: ■□□  |  Systems: ■■■

[CHOICES]
1. Loud Approach - Breach the hull, fight through guards (Body +3)
2. Stealth Infiltration - Submerge and cut through below waterline (Reflexes +1)
3. Social Engineering - Pose as maintenance crew (Cool +2, needs credstick)

Enter choice [1-3]: _
```

---

### 5. Game Controller (`controller/`)

**Purpose**: Orchestrate the game loop, connect all layers.

**Key Class**:
- `GameController`: Main game loop, coordinates layers

**Design Decisions**:
- **Single responsibility**: Coordinate, don't implement
- **Dependency injection**: Pass in dependencies, don't create them
- **Clear game loop**: Load → Play → Save pattern

**Example Flow**:
```python
class GameController:
    def play(self):
        """Main game loop."""
        while not self.game_over:
            # 1. Get current scene from story progress
            scene = self.story_data.get_scene(self.progress.current_scene)

            # 2. Render scene via UI
            self.ui.display_scene(scene, self.character)

            # 3. Get player choice via UI
            choice = self.ui.get_player_choice(scene.choices)

            # 4. Process choice via engine
            new_state = self.engine.process_choice(
                choice, self.character, self.progress
            )

            # 5. Update state
            self.character = new_state.character
            self.progress = new_state.progress
```

---

## JSON Story Format

### Design Principles
- **Human-readable first**: Writers should understand the format
- **Flat ID references**: Use string IDs, not nested objects
- **Explicit state changes**: All consequences spelled out
- **Validation-friendly**: Clear types, required fields

### Core Structure

```json
{
  "metadata": {
    "title": "The Enforcer: Debt Collection",
    "author": "Game Jam 2025",
    "version": "1.0.0",
    "playbook": "enforcer"
  },

  "start_scene": "opening_call",

  "character": {
    "name": "Your Enforcer",
    "stats": {
      "body": 3,
      "reflexes": 1,
      "cool": 2,
      "code": 0,
      "tech": 0
    },
    "stress_tracks": {
      "meat": {"max": 3, "current": 3},
      "nerves": {"max": 3, "current": 3},
      "systems": {"max": 3, "current": 3}
    },
    "chrome": ["subdermal_armor", "mantis_blades", "pain_editor"],
    "aspects": {
      "high_concept": "Chrome-Plated Muscle",
      "trouble": "Family First, Everything Else Never",
      "connection": "Mei-Lin's Big Brother"
    }
  },

  "scenes": {
    "opening_call": {
      "id": "opening_call",
      "type": "narrative",
      "title": "The Call",
      "text": "Your comm chirps at 2 AM. It's Mei-Lin...",

      "choices": [
        {
          "id": "accept_job",
          "text": "\"I'm coming. Stay hidden.\"",
          "requirements": null,
          "consequences": {
            "next_scene": "negotiation",
            "flags_set": ["accepted_job"],
            "stress": null
          }
        }
      ]
    },

    "negotiation": {
      "id": "negotiation",
      "type": "skill_check",
      "title": "The Negotiation",
      "text": "The Undertow's den reeks of rust and threat...",

      "choices": [
        {
          "id": "intimidate",
          "text": "Flex your chrome. \"Give me more time.\"",
          "requirements": {"stat": "body", "min": 2},
          "test": {
            "type": "opposed",
            "stat": "body",
            "difficulty": 3,
            "success_scene": "four_hours",
            "failure_scene": "two_hours"
          }
        },
        {
          "id": "negotiate",
          "text": "Appeal to reason. \"I can get you more than 50k.\"",
          "requirements": {"stat": "cool", "min": 1},
          "test": {
            "type": "opposed",
            "stat": "cool",
            "difficulty": 2,
            "success_scene": "four_hours",
            "tie_scene": "two_hours",
            "failure_scene": "fight_breaks_out"
          }
        }
      ]
    },

    "combat_example": {
      "id": "combat_example",
      "type": "combat",
      "title": "Alley Brawl",
      "setup_text": "Three Undertow thugs block your path...",

      "enemies": [
        {"template": "undertow_thug", "count": 3}
      ],

      "victory": {
        "next_scene": "aftermath",
        "rewards": {"items": ["credstick_5k"]}
      },

      "defeat": {
        "next_scene": "captured",
        "consequences": {"stress": {"meat": -2}}
      }
    }
  },

  "enemy_templates": {
    "undertow_thug": {
      "name": "Undertow Thug",
      "stats": {"body": 2, "reflexes": 1},
      "stress": {"meat": 2},
      "attacks": [
        {
          "name": "Shock Baton",
          "damage": 1,
          "target_stress": "meat"
        }
      ]
    }
  }
}
```

### Key Format Decisions

**Scene Types**:
- `narrative`: Pure story, no tests
- `skill_check`: Roll dice against difficulty
- `combat`: Full combat encounter
- `choice`: Branch without tests

**Requirements**:
- `null`: Always available
- `{"stat": "body", "min": 2}`: Need Body +2 or higher
- `{"flag": "accepted_job"}`: Need story flag set
- `{"items": ["credstick"]}`: Need specific item

**Consequences**:
- `next_scene`: Where to go next (required)
- `flags_set`: Story flags to set (array)
- `flags_unset`: Story flags to clear (array)
- `stress`: Stress to apply ({"meat": -2} means take 2 Meat stress)
- `items`: Items to add/remove

---

## Design Patterns

### Use These Patterns

#### 1. Strategy Pattern (Combat Actions)
```python
class CombatAction(ABC):
    @abstractmethod
    def execute(self, actor: Character, target: Character) -> CombatResult:
        """Execute this combat action."""
        pass

class MeleeAttack(CombatAction):
    def execute(self, actor, target):
        # Specific melee logic
        pass
```

**Why**: Easy to add new combat actions without modifying core combat engine.

#### 2. State Pattern (Scene Types)
```python
class SceneType(Enum):
    NARRATIVE = "narrative"
    SKILL_CHECK = "skill_check"
    COMBAT = "combat"
    CHOICE = "choice"
```

**Why**: Clear, testable scene flow.

#### 3. Command Pattern (Player Actions)
```python
@dataclass
class PlayerAction:
    choice_id: str
    timestamp: float

    def to_dict(self) -> dict:
        """Serializable for save games."""
        return {"choice": self.choice_id, "time": self.timestamp}
```

**Why**: Makes undo/replay/save possible.

### Avoid These Patterns

- Abstract Factory - Too complex for students
- Visitor - Confusing for narrative systems
- Singleton - Teaches bad habits, use DI instead
- Deep inheritance - Keep it flat, composition over inheritance

---

## Testing Strategy

### Unit Tests (Fast, Isolated)
- Dice mechanics: `test_dice.py`
- State transitions: `test_state.py`
- Condition checking: `test_conditions.py`
- Combat resolution: `test_combat.py`

**Example**:
```python
def test_4df_roll_range():
    """4dF rolls should always be between -4 and +4."""
    for _ in range(100):
        roll = sum(roll_4df())
        assert -4 <= roll <= 4

def test_stress_triggers_consequence():
    """Taking stress beyond track max triggers consequence."""
    char = CharacterState(stress_meat=2, stress_meat_max=3)
    new_char, consequence = char.apply_stress("meat", 2)

    assert new_char.stress_meat == 3  # Capped at max
    assert consequence == "mild_meat"  # Triggered consequence
```

### Integration Tests (Full Scenarios)
- Load story, play through scene transitions
- Save/load game state
- Complete combat encounters

**Example**:
```python
def test_debt_collection_intro():
    """Test opening scenes of Debt Collection scenario."""
    game = GameController(story="enforcer_debt.json")

    # Scene 1: The Call
    assert game.current_scene.id == "opening_call"
    game.make_choice("accept_job")

    # Scene 2: Negotiation
    assert game.current_scene.id == "negotiation"
    assert "accepted_job" in game.progress.flags
```

### Manual Playtesting
- Full story playthroughs
- Edge cases (what if player always fails?)
- Narrative flow and pacing

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Architecture validated, basic structure in place

- [ ] Project structure created
- [ ] JSON schema v1 defined
- [ ] Data models (dataclasses)
- [ ] JSON loader with validation
- [ ] Character state management
- [ ] Basic dice mechanics (4dF)
- [ ] Unit tests for above

**Deliverable**: Can load a JSON story and create character state.

---

### Phase 2: Core Engine (Week 2)
**Goal**: Scene progression works, dice rolls functional

- [ ] Scene engine (load, display, navigate)
- [ ] Condition checking (requirements)
- [ ] Choice processing (consequences)
- [ ] Story progress tracking (flags, current scene)
- [ ] Basic CLI display (text, choices)
- [ ] Integration tests for scene flow

**Deliverable**: Can play through a simple narrative (no combat).

---

### Phase 3: Combat System (Week 3)
**Goal**: Combat encounters work, stress matters

- [ ] Combat state management
- [ ] Combat action resolution
- [ ] Stress application and consequences
- [ ] Enemy AI (basic)
- [ ] Combat UI (turn display, choices)
- [ ] Combat tests

**Deliverable**: Can fight enemies and track stress.

---

### Phase 4: "The Enforcer" Content (Week 3-4)
**Goal**: Full scenario playable

- [ ] Write all 5 scenes in JSON
- [ ] Design combat encounters
- [ ] Balance stress/chrome/difficulty
- [ ] Playtest and iterate
- [ ] Polish prose

**Deliverable**: Complete "Debt Collection" scenario.

---

### Phase 5: Polish & Documentation (Week 4-5)
**Goal**: Game jam ready, student-friendly

- [ ] Save/load system
- [ ] Enhanced CLI formatting
- [ ] Tutorial story (minimal example)
- [ ] Architecture documentation
- [ ] JSON format guide
- [ ] Student tutorial ("Build Your First Story")
- [ ] Code comments and docstrings
- [ ] README with setup instructions

**Deliverable**: Shippable game jam package.

---

## Technical Decisions & Rationale

### Why Python?
- **Pedagogical clarity**: Readable syntax, students know it
- **No build step**: Run directly, easy to modify
- **Rich standard library**: Don't need external dependencies
- **Cross-platform**: Works everywhere without hassle

### Why CLI Instead of Web?
- **Simplicity**: No HTML/CSS/JS complexity
- **Focus on logic**: Learn narrative engine, not web framework
- **Text adventure aesthetic**: Fits cyberpunk noir vibe
- **Easier testing**: No browser automation needed

### Why JSON Instead of YAML/TOML?
- **Universal**: Every language can parse JSON
- **Validation**: JSON Schema is mature and well-documented
- **IDE support**: Syntax highlighting, validation built-in
- **Students know it**: Common format, no learning curve

### Why Dataclasses Instead of Plain Dicts?
- **Type safety**: Catch errors at "compile time" (import time)
- **IDE support**: Autocomplete, type checking
- **Documentation**: Fields are explicit
- **But not too fancy**: Simpler than full OOP classes

### Why Immutable State Updates?
- **Easier to reason about**: Old state still exists for comparison
- **Undo/replay possible**: Keep history of states
- **Testing**: Pure functions, no side effects
- **Teaches functional patterns**: Industry best practice

---

## Extensibility Points

Students can extend this engine:

### 1. New Scene Types
```python
class PuzzleScene(SceneType):
    """Add puzzle-solving scenes with inventory logic."""
    pass
```

### 2. New Combat Actions
```python
@register_combat_action("hack_chrome")
class HackChromeAction(CombatAction):
    """Disable enemy chrome."""
    pass
```

### 3. New Chrome Types
Just add to JSON:
```json
"chrome": {
  "neural_link": {
    "name": "Neural Link",
    "effect": {"stat_bonus": {"code": 1}},
    "stress_mod": {"systems": -1}
  }
}
```

### 4. New UI Renderers
```python
class MarkdownRenderer(Renderer):
    """Export playthrough to Markdown."""
    pass
```

---

## Success Metrics

### For Students
- Can understand any module in < 10 minutes
- Can add new scene type in < 50 lines
- Can write new story in < 100 JSON lines
- Can extend chrome/combat without breaking existing code

### For Quality
- 80%+ test coverage
- All public functions documented
- Zero external dependencies (beyond pytest)
- Clean separation of concerns (no cross-layer calls)

### For Game Experience
- "Debt Collection" takes 20-30 minutes to play
- Combat feels tactical, not random
- Choices matter (different outcomes)
- Stress creates tension
- Story has emotional impact

---

## Next Steps

1. **Validate this architecture** with team
2. **Create JSON schema v1** (define exact format)
3. **Build data layer** (loader, models, validation)
4. **Implement state management** (character, progress, world)
5. **Build scene engine** (load, display, navigate)
6. **Add dice mechanics** (4dF + stat)
7. **Create minimal CLI** (text display, choice input)
8. **Test integration** (play through simple story)
9. **Add combat system** (actions, stress, enemies)
10. **Write "Debt Collection"** (full scenario)
11. **Polish and document** (README, tutorials, comments)
12. **Ship it** (game jam ready!)

---

## Questions & Decisions Needed

### Immediate
- [ ] Approve this architecture approach?
- [ ] Confirm JSON format decisions?
- [ ] Agree on project structure?

### Soon
- [ ] How much chrome variety in "Debt Collection"?
- [ ] Should we include save/load in MVP or defer?
- [ ] Tutorial story scope (1 scene or 3)?

### Later
- [ ] GUI version someday? (Phase 3?)
- [ ] Web export? (Phase 3?)
- [ ] Multiplayer? (Way later?)

---

**Status**: Architecture spike complete, ready for implementation.
**Next Action**: Create JSON schema v1 and start data layer implementation.
**Blocker**: None - architecture validated by team agents.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
