#!/usr/bin/env python3
"""
Narrative Engine - JSON-driven story system
Using Pydantic models and deck interface for presentation
"""

import json
import time
import sys
from pathlib import Path
from typing import Optional

try:
    from models import Story, GameState, Scene, Choice, SpeakerType, Effects
    from deck_mvp import DeckInterface, Colors
    from combat import CombatEngine
except ImportError:
    print("ERROR: Missing dependencies. Run from prototype directory.")
    print("Consider: pip install pydantic rich")
    sys.exit(1)


class NarrativeEngine:
    """Core engine for running JSON-driven narrative scenes."""

    def __init__(self, story_path: str, batch_mode: bool = False):
        self.batch_mode = batch_mode
        self.ui = DeckInterface(batch_mode=batch_mode)
        self.combat = CombatEngine(self.ui)

        # Load story from JSON
        with open(story_path, 'r') as f:
            story_data = json.load(f)

        self.story = Story(**story_data)

        # Initialize game state
        self.state = GameState(
            current_scene=self.story.start_scene,
            character=self.story.character,
            flags=[],
            items=[]
        )

    def run(self):
        """Main game loop."""
        self.ui.clear_screen()
        self.ui.print_header()
        self.ui.print_status()

        while True:
            scene = self.story.scenes.get(self.state.current_scene)
            if not scene:
                print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} Scene not found: {self.state.current_scene}")
                break

            # Check if scene has no choices (end scene)
            if not scene.choices:
                # Show messages and end
                self.display_messages(scene)
                break

            # Display scene and get choice
            choice_made = self.run_scene(scene)

            if not choice_made:
                break

    def run_scene(self, scene: Scene) -> bool:
        """
        Run a single scene. Returns False if game should end.
        """
        # Display all messages
        self.display_messages(scene)

        # Handle choice loop (for submenu returns)
        while True:
            # Build available choices
            available_choices = self.get_available_choices(scene.choices)

            # Add submenu if present
            if scene.submenu:
                submenu_choice = Choice(
                    id="__submenu__",
                    text=scene.submenu.label,
                    speaker=SpeakerType.PLAYER
                )
                available_choices.append(submenu_choice)

            if not available_choices:
                print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} No available choices!")
                return False

            # Get player choice
            choice_texts = [c.text for c in available_choices]
            choice_idx = self.ui.get_choice(choice_texts)
            print()

            chosen = available_choices[choice_idx]

            # Handle submenu
            if chosen.id == "__submenu__":
                submenu_result = self.run_submenu(scene.submenu.choices)
                if submenu_result == "back":
                    continue  # Redisplay main choices
                elif submenu_result == "return":
                    continue  # Redisplay main choices
                else:
                    # Submenu led to scene transition
                    return True

            # Apply choice effects
            if chosen.effects or chosen.next:
                effects = chosen.effects or Effects(next=chosen.next)
                return_to_choices = self.apply_effects(effects)

                if return_to_choices:
                    # Refresh status and continue choice loop
                    self.ui.print_status()
                    continue
                else:
                    # Move to next scene
                    return True

            return True

    def run_submenu(self, submenu_choices: list) -> str:
        """
        Display submenu and handle choice.
        Returns: "back", "return", or "transition"
        """
        available = self.get_available_choices(submenu_choices)

        if not available:
            print(f"{Colors.GREY}No actions available.{Colors.RESET}")
            time.sleep(1)
            return "back"

        # Display submenu choices (indented)
        print(f"{Colors.CYAN}└─ SUBMENU ─────────────────────────────────────────────┐{Colors.RESET}")
        for i, choice in enumerate(available, 1):
            style_prefix = ""
            if hasattr(choice, 'style') and choice.style == "warning":
                style_prefix = f"{Colors.BRIGHT_AMBER}⚠ {Colors.RESET}"
            print(f"{Colors.CYAN}│{Colors.RESET} {Colors.AMBER}[{i}]{Colors.RESET} {style_prefix}{Colors.WHITE}{choice.text:<51}{Colors.RESET} {Colors.CYAN}│{Colors.RESET}")
        print(f"{Colors.CYAN}└────────────────────────────────────────────────────────┘{Colors.RESET}")
        print()

        # Get submenu choice
        choice_idx = 0  # Default for batch mode
        if not self.batch_mode:
            while True:
                try:
                    choice_input = input(f"{Colors.BRIGHT_CYAN}SUBMENU >{Colors.RESET} ").strip()
                    choice_num = int(choice_input)
                    if 1 <= choice_num <= len(available):
                        choice_idx = choice_num - 1
                        break
                    else:
                        print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} Invalid selection.")
                except ValueError:
                    print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} Enter a number.")
                except KeyboardInterrupt:
                    print(f"\n{Colors.BRIGHT_CYAN}[SYSTEM]{Colors.RESET} Connection terminated.")
                    sys.exit(0)
        else:
            print(f"{Colors.BRIGHT_CYAN}SUBMENU >{Colors.RESET} {Colors.AMBER}1{Colors.RESET} {Colors.GREY}[BATCH MODE]{Colors.RESET}")
            time.sleep(1.0)

        print()

        chosen = available[choice_idx]

        # Check for back
        if chosen.id == "back":
            return "back"

        # Apply effects
        if chosen.effects or chosen.next:
            effects = chosen.effects or Effects(next=chosen.next)
            return_to_choices = self.apply_effects(effects)

            if return_to_choices:
                return "return"
            else:
                return "transition"

        return "back"

    def display_messages(self, scene: Scene):
        """Display all messages in a scene with speaker-appropriate formatting."""
        for msg in scene.messages:
            if msg.speaker == SpeakerType.SYSTEM:
                self.ui.print_system_message(msg.text)
            elif msg.speaker == SpeakerType.ENFORCER:
                source = msg.source or "ENFORCER"
                self.ui.print_transmission(msg.text, source)
            elif msg.speaker == SpeakerType.DATA:
                # Display data with cyan bullets
                for line in msg.text.split('\n'):
                    print(f"   {Colors.CYAN}>>{Colors.RESET} {Colors.AMBER}{line}{Colors.RESET}")
                print()
            elif msg.speaker == SpeakerType.PLAYER:
                # Player messages shown as quotes
                print(f"{Colors.WHITE}   {msg.text}{Colors.RESET}")
                print()

            time.sleep(msg.delay)

    def get_available_choices(self, choices: list) -> list:
        """Filter choices based on conditions."""
        available = []
        for choice in choices:
            if self.check_conditions(choice.conditions):
                available.append(choice)
        return available

    def check_conditions(self, conditions) -> bool:
        """Check if conditions are met."""
        if not conditions:
            return True

        # Check flags
        for flag in conditions.flags_set:
            if flag not in self.state.flags:
                return False

        for flag in conditions.flags_not_set:
            if flag in self.state.flags:
                return False

        # Check items
        for item in conditions.items:
            if item not in self.state.items:
                return False

        # Check stress (TODO: implement stress checks)

        # Check stats (TODO: implement stat checks)

        return True

    def apply_effects(self, effects: Effects) -> bool:
        """
        Apply choice effects to game state.
        Returns True if should return to choices, False if transitioning scenes.
        """
        # Set/unset flags
        for flag in effects.flags_set:
            if flag not in self.state.flags:
                self.state.flags.append(flag)

        for flag in effects.flags_unset:
            if flag in self.state.flags:
                self.state.flags.remove(flag)

        # Add/remove items
        for item in effects.items_add:
            if item not in self.state.items:
                self.state.items.append(item)

        for item in effects.items_remove:
            if item in self.state.items:
                self.state.items.remove(item)

        # Consume item
        if effects.consume_item:
            if effects.consume_item in self.state.items:
                self.state.items.remove(effects.consume_item)
                print(f"{Colors.GREY}[Used: {effects.consume_item}]{Colors.RESET}")
                print()

        # Apply stress (TODO: implement stress system)
        if effects.stress:
            for track, amount in effects.stress.items():
                print(f"{Colors.AMBER}[Stress: {track} {amount:+d}]{Colors.RESET}")
            print()

        # Show data displays
        if effects.show_data:
            self.display_data(effects.show_data)

        # Apply special effects
        if effects.apply_effect:
            self.state.active_effects.append(effects.apply_effect)
            print(f"{Colors.BRIGHT_CYAN}[Effect: {effects.apply_effect}]{Colors.RESET}")
            print()

        # Handle combat
        if effects.combat:
            combat_result = self.run_combat(effects.combat)
            # Combat result affects which scene to go to
            if combat_result:
                # Victory - go to success scene
                success_scene = effects.combat.get("success_scene", effects.next)
                if success_scene:
                    self.state.current_scene = success_scene
                    self.state.flags.append("combat_victory")
                    return False
            else:
                # Defeat - go to failure scene
                failure_scene = effects.combat.get("failure_scene", "game_over")
                self.state.current_scene = failure_scene
                self.state.flags.append("combat_defeat")
                return False

        # Handle scene transition or return
        if effects.return_to_choices:
            return True

        if effects.next:
            self.state.current_scene = effects.next
            return False

        return False

    def run_combat(self, combat_config: dict) -> bool:
        """
        Run a combat encounter.

        Args:
            combat_config: Combat configuration from scene data
                - enemy_name: Name of enemy
                - success_scene: Scene to go to on victory
                - failure_scene: Scene to go to on defeat

        Returns:
            True if player wins, False otherwise
        """
        enemy_name = combat_config.get("enemy", "Enemy")
        player_name = self.state.character.name

        return self.combat.run_combat(enemy_name, player_name)

    def display_data(self, data: dict):
        """Display formatted data based on type."""
        data_type = data.get("type")

        if data_type == "enforcer_status":
            self.ui.print_system_message("ENFORCER STATUS:")
            name = data.get("name", "UNKNOWN")
            meat = data.get("stress_meat", 0)
            nerves = data.get("stress_nerves", 0)
            systems = data.get("stress_systems", 0)

            print(f"   {Colors.CYAN}>>{Colors.RESET} AGENT: {Colors.AMBER}{name}{Colors.RESET}")
            print(f"   {Colors.CYAN}>>{Colors.RESET} MEAT: {Colors.AMBER}{'■' * meat}{'□' * (3-meat)}{Colors.RESET}")
            print(f"   {Colors.CYAN}>>{Colors.RESET} NERVES: {Colors.AMBER}{'■' * nerves}{'□' * (3-nerves)}{Colors.RESET}")
            print(f"   {Colors.CYAN}>>{Colors.RESET} SYSTEMS: {Colors.CYAN}{'■' * systems}{'□' * (3-systems)}{Colors.RESET}")
            print()
            time.sleep(1.5)

        # Add other data display types as needed


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Narrative Engine - High Tech, Low Lives")
    parser.add_argument("story", nargs="?", default="stories/contact_demo.json",
                        help="Path to story JSON file")
    parser.add_argument("--batch", action="store_true", help="Run in batch mode")
    parser.add_argument("--demo", action="store_true", help="Alias for --batch")

    args = parser.parse_args()
    batch_mode = args.batch or args.demo

    if batch_mode:
        print(f"{Colors.BRIGHT_CYAN}[SYSTEM]{Colors.RESET} Running in {Colors.AMBER}BATCH MODE{Colors.RESET}")
        print()
        time.sleep(1)

    try:
        engine = NarrativeEngine(args.story, batch_mode=batch_mode)
        engine.run()
    except KeyboardInterrupt:
        print(f"\n{Colors.BRIGHT_CYAN}[SYSTEM]{Colors.RESET} Connection terminated.")
        sys.exit(0)
    except FileNotFoundError:
        print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} Story file not found: {args.story}")
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
