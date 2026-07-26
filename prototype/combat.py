"""
Combat system - currently stubbed with coin flip
TODO: Implement full Fate dice (4dF) mechanics
"""

import random
import time
from deck_mvp import Colors


class CombatEngine:
    """Handles combat encounters - currently using coin flip stub."""

    def __init__(self, ui):
        self.ui = ui

    def run_combat(self, enemy_name: str = "Enemy", player_name: str = "Enforcer") -> bool:
        """
        Run a combat encounter.

        Args:
            enemy_name: Name of the enemy
            player_name: Name of the player character

        Returns:
            True if player wins, False if player loses

        TODO: Replace coin flip with:
        - 4dF dice rolling
        - Stat modifiers (Body, Reflexes, etc.)
        - Stress tracking
        - Combat actions (attack, defend, special moves)
        - Enemy AI
        """

        self.ui.print_system_message(f"COMBAT ENGAGEMENT: {enemy_name}")
        time.sleep(1)

        # Stub: Coin flip for now
        print(f"{Colors.AMBER}   {player_name} vs {enemy_name}{Colors.RESET}")
        print(f"{Colors.GREY}   [STUB: Combat mechanics not yet implemented]{Colors.RESET}")
        print(f"{Colors.GREY}   [Using coin flip for demonstration]{Colors.RESET}")
        print()
        time.sleep(1.5)

        self.ui.print_system_message("RESOLVING COMBAT...")
        time.sleep(1)

        # Coin flip
        player_wins = random.choice([True, False])

        if player_wins:
            print(f"{Colors.BRIGHT_CYAN}   >> COMBAT SUCCESS{Colors.RESET}")
            print(f"{Colors.AMBER}   {player_name} prevails{Colors.RESET}")
        else:
            print(f"{Colors.BRIGHT_AMBER}   >> COMBAT FAILURE{Colors.RESET}")
            print(f"{Colors.AMBER}   {player_name} is overwhelmed{Colors.RESET}")

        print()
        time.sleep(1.5)

        return player_wins


def roll_4df() -> int:
    """
    Roll 4 Fate dice (4dF).
    Each die: -1, 0, or +1
    Returns sum (-4 to +4)

    TODO: Integrate this into combat system
    """
    dice = [random.choice([-1, 0, 1]) for _ in range(4)]
    return sum(dice)


def format_dice_result(dice_values: list) -> str:
    """
    Format 4dF dice for display.

    Example: [-1, 0, 1, 1] -> "[-] [ ] [+] [+] = +1"

    TODO: Use this in combat display
    """
    symbols = {-1: "[-]", 0: "[ ]", 1: "[+]"}
    dice_str = " ".join(symbols[d] for d in dice_values)
    total = sum(dice_values)
    sign = "+" if total >= 0 else ""
    return f"{dice_str} = {sign}{total}"
