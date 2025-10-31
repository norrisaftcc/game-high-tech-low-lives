# Scene Data Format

**Design principle**: Speaker-based color markup. Mark who's talking (system/enforcer/player), engine applies colors automatically.

## Core Structure

```json
{
  "metadata": {
    "title": "Scene Name",
    "scene_type": "narrative" | "combat" | "decision"
  },

  "messages": [
    {
      "speaker": "system" | "enforcer" | "player" | "data",
      "text": "Message content",
      "delay": 1.0
    }
  ],

  "choices": [
    {
      "id": "choice_id",
      "text": "Choice text",
      "next": "next_scene_id",
      "conditions": {},
      "effects": {}
    }
  ],

  "submenu": {
    "label": "More actions...",
    "choices": [...]
  }
}
```

## Speaker Types

**system**: Deck/interface messages
- Color: Bright cyan
- Prefix: `[SYSTEM]`
- Use for: Connection status, scanning, database access

**enforcer**: Field agent transmissions
- Color: Amber
- Prefix: `>> INCOMING TRANSMISSION [AGENT-ID]`
- Use for: Field reports, combat updates, responses

**player**: Handler responses/actions
- Color: White (commands are cyan)
- Prefix: None (shown as choices or `COMMAND >`)
- Use for: Strategic decisions, orders to enforcer

**data**: System readouts, scans, analysis
- Color: Cyan markers, amber/white data
- Prefix: `>>` bullets
- Use for: Threat scans, building intel, sensor data

## Choice Structure

### Regular Choice
```json
{
  "id": "scan_threats",
  "text": "\"Scan their chrome. I need threat assessment.\"",
  "next": "scene_after_scan",
  "speaker": "player",
  "effects": {
    "flags_set": ["scanned_enemies"],
    "show_data": {
      "type": "threat_scan",
      "enemies": ["guard_1", "guard_2", "guard_3"]
    }
  }
}
```

### Submenu Pattern
Last choice is always submenu if present:

```json
{
  "choices": [
    {"id": "option_a", "text": "Primary action A"},
    {"id": "option_b", "text": "Primary action B"},
    {"id": "option_c", "text": "Primary action C"},
    {
      "id": "submenu",
      "text": "More actions...",
      "submenu": [
        {
          "id": "use_stim",
          "text": "Use combat stim (1 remaining)",
          "conditions": {"items": ["combat_stim"]},
          "effects": {
            "consume_item": "combat_stim",
            "apply_effect": "stimmed",
            "return_to_choices": true
          }
        },
        {
          "id": "abort",
          "text": "Bug out (abort mission)",
          "next": "mission_abort",
          "style": "warning"
        },
        {
          "id": "back",
          "text": "← Back",
          "return_to_choices": true
        }
      ]
    }
  ]
}
```

## Conditions

```json
"conditions": {
  "flags_set": ["flag_name"],
  "flags_not_set": ["other_flag"],
  "items": ["item_id"],
  "stress_meat_max": 2,
  "stat_body_min": 2
}
```

If conditions not met, choice is grayed out or hidden.

## Effects

```json
"effects": {
  "next": "scene_id",
  "flags_set": ["flag_name"],
  "flags_unset": ["other_flag"],
  "items_add": ["item_id"],
  "items_remove": ["item_id"],
  "consume_item": "item_id",
  "stress": {"meat": -1, "nerves": -2},
  "apply_effect": "effect_name",
  "show_data": {...},
  "return_to_choices": true
}
```

## Data Display Types

### Threat Scan
```json
"show_data": {
  "type": "threat_scan",
  "enemies": [
    {
      "name": "Guard-1",
      "chrome": "Subdermal armor (grade 2), shock baton",
      "threat_level": "medium"
    },
    {
      "name": "Guard-2",
      "chrome": "Reflex boosters (military), SMG",
      "threat_level": "high"
    }
  ],
  "assessment": "High threat. Coordinated response likely."
}
```

### Building Intel
```json
"show_data": {
  "type": "building_intel",
  "building": "Tower 19-C, Corporate Sector",
  "access_points": ["Main entrance", "Maintenance shaft (east)"],
  "security": ["Motion sensors (floors 1-3)", "Camera grid"],
  "weakness": "Maintenance shaft bypasses sensors"
}
```

## Dynamic Variables

Scenes can reference variables for dynamic content:

```json
{
  "speaker": "enforcer",
  "text": "Handler, I'm {mood} this. {approach_comment}",
  "vars": {
    "mood": {
      "if_flag": "player_was_harsh",
      "then": "not feeling great about",
      "else": "ready for"
    },
    "approach_comment": {
      "if_flag": "chose_stealth",
      "then": "Going quiet like you said.",
      "else": "This is gonna get loud."
    }
  }
}
```

## Complete Example Scene

```json
{
  "id": "contact_scene",
  "metadata": {
    "title": "First Contact",
    "scene_type": "narrative"
  },

  "messages": [
    {
      "speaker": "system",
      "text": "CONNECTION ESTABLISHED",
      "delay": 0.5
    },
    {
      "speaker": "enforcer",
      "text": "Handler, this is Nomad-7. I'm in position outside the target.\n   Rain's coming down hard. Visibility is shit. I've got eyes on\n   three guards at the main entrance, two patrol boats circling.\n   Corporate IDs, recent chrome. They're expecting trouble.",
      "source": "NOMAD-7",
      "delay": 0.5
    }
  ],

  "choices": [
    {
      "id": "ask_approach",
      "text": "\"Copy that. What's your approach preference?\"",
      "speaker": "player",
      "effects": {
        "next": "enforcer_responds_approach"
      }
    },
    {
      "id": "scan_chrome",
      "text": "\"Scan their chrome. I need threat assessment.\"",
      "speaker": "player",
      "effects": {
        "next": "threat_scan_results",
        "flags_set": ["scanned_threats"],
        "show_data": {
          "type": "threat_scan",
          "enemies": ["guard_1", "guard_2", "guard_3"]
        }
      }
    },
    {
      "id": "pull_schematics",
      "text": "\"Hold position. I'm pulling building schematics.\"",
      "speaker": "player",
      "effects": {
        "next": "schematic_results",
        "flags_set": ["pulled_schematics"],
        "show_data": {
          "type": "building_intel",
          "building": "Tower 19-C",
          "access": ["main", "maintenance_east"]
        }
      }
    },
    {
      "id": "submenu",
      "text": "More actions...",
      "submenu": [
        {
          "id": "check_status",
          "text": "Check enforcer status",
          "effects": {
            "show_data": {"type": "enforcer_status"},
            "return_to_choices": true
          }
        },
        {
          "id": "abort",
          "text": "Abort mission",
          "style": "warning",
          "effects": {
            "next": "mission_abort"
          }
        },
        {
          "id": "back",
          "text": "← Back",
          "effects": {
            "return_to_choices": true
          }
        }
      ]
    }
  ]
}
```

## Engine Behavior

**Speaker → Color Mapping**:
- `system` → Bright cyan `[SYSTEM]` + white text
- `enforcer` → Amber `>> INCOMING TRANSMISSION [SOURCE]` + amber text
- `player` → White text (shown as choices)
- `data` → Cyan `>>` bullets + context-colored data

**Submenu Handling**:
- Last choice with `submenu` key → rendered as "More actions..."
- Submenu choices shown indented with `└─` or similar
- `return_to_choices: true` → redisplay parent choices
- `back` choice always returns to parent

**Dynamic Content**:
- `{var_name}` in text → replaced from vars or state
- Flags control visibility and text variants
- Items enable/disable choices

**Data Display**:
- `show_data` effect → render formatted data before next scene
- Each type has specific color/format rules
- Pauses for player to read

---

This format keeps data clean while giving engine full control over presentation.
