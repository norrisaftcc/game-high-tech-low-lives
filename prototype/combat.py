"""
Combat system - opposed 4dF exchange with stress tracking.
"""

import random
import time
from typing import Optional

from deck_mvp import Colors
from models import CharacterState, StressTrack

TIES_BEFORE_FATE_POINT = 3


class CombatEngine:
    """Handles combat encounters as an opposed 4dF exchange."""

    def __init__(self, ui):
        self.ui = ui

    def run_combat(
        self,
        enemy_name: str = "Enemy",
        player_name: str = "Enforcer",
        player_stress_track: Optional[StressTrack] = None,
        player_stat_mod: int = 0,
        enemy_stat_mod: int = 1,
        character: Optional[CharacterState] = None,
    ) -> bool:
        """
        Run a combat encounter as a round-by-round opposed 4dF exchange.

        Each round, both sides roll 4dF and add their stat modifier. The
        loser of the exchange takes 1 stress to their Meat track. Combat
        ends when either side's Meat track hits 0 (taken out).

        Only the player tracks Fate points (NPCs don't have a refreshing
        pool per the core rules). Three consecutive clashes force a
        tie-break: the player must spend a Fate point to win it if they
        have one; with none left, the enemy forces the issue instead.

        Args:
            enemy_name: Name of the enemy
            player_name: Name of the player character
            player_stress_track: The player's stress_meat StressTrack, so
                damage persists on the real character. Defaults to a fresh
                local 3-box track if not supplied.
            player_stat_mod: Player's stat modifier added to each roll
            enemy_stat_mod: Enemy's stat modifier added to each roll
                (kept dead simple - just an int, no enemy class)
            character: The player's CharacterState, so Fate point spending
                persists across encounters. Defaults to a local 3-point
                pool (not persisted) if not supplied.

        Returns:
            True if the player wins, False if the player is taken out.
        """
        pause = (lambda seconds: None) if self.ui.batch_mode else time.sleep

        self.ui.print_system_message(f"COMBAT ENGAGEMENT: {enemy_name}")
        pause(1)

        player_stress = player_stress_track or StressTrack()
        enemy_stress = 3  # simple 3-box counter, taken out at 0
        fate_points = character.fate_points if character is not None else 3
        consecutive_ties = 0

        print(f"{Colors.AMBER}   {player_name} vs {enemy_name}{Colors.RESET}")
        print(f"{Colors.GREY}   Opposed 4dF exchange - stat mods: "
              f"{player_name} {player_stat_mod:+d} / {enemy_name} {enemy_stat_mod:+d}{Colors.RESET}")
        print()
        pause(1)

        round_num = 0
        while player_stress.current > 0 and enemy_stress > 0:
            round_num += 1
            print(f"{Colors.CYAN}   -- Round {round_num} --{Colors.RESET}")

            player_dice = roll_4df_dice()
            enemy_dice = roll_4df_dice()

            player_total = sum(player_dice) + player_stat_mod
            enemy_total = sum(enemy_dice) + enemy_stat_mod

            print(f"   {Colors.WHITE}{player_name}:{Colors.RESET} {format_dice_result(player_dice)} "
                  f"{Colors.GREY}({player_stat_mod:+d} stat -> {player_total:+d}){Colors.RESET}")
            print(f"   {Colors.AMBER}{enemy_name}:{Colors.RESET} {format_dice_result(enemy_dice)} "
                  f"{Colors.GREY}({enemy_stat_mod:+d} stat -> {enemy_total:+d}){Colors.RESET}")

            if player_total > enemy_total:
                consecutive_ties = 0
                enemy_stress -= 1
                print(f"{Colors.BRIGHT_CYAN}   >> {player_name} lands a hit! "
                      f"{enemy_name} MEAT: {enemy_stress}/3{Colors.RESET}")
            elif enemy_total > player_total:
                consecutive_ties = 0
                player_stress.current = max(0, player_stress.current - 1)
                print(f"{Colors.BRIGHT_AMBER}   >> {enemy_name} lands a hit! "
                      f"{player_name} MEAT: {player_stress.current}/{player_stress.max}{Colors.RESET}")
            else:
                consecutive_ties += 1
                if consecutive_ties < TIES_BEFORE_FATE_POINT:
                    print(f"{Colors.GREY}   >> Clash - no clear hit{Colors.RESET}")
                else:
                    consecutive_ties = 0
                    if fate_points > 0:
                        fate_points -= 1
                        if character is not None:
                            character.fate_points = fate_points
                        enemy_stress -= 1
                        print(f"{Colors.BRIGHT_CYAN}   >> Three clashes running - {player_name} spends a "
                              f"Fate Point to force it! {enemy_name} MEAT: {enemy_stress}/3{Colors.RESET}")
                        print(f"{Colors.GREY}   ({player_name} has {fate_points} Fate Point(s) left){Colors.RESET}")
                    else:
                        player_stress.current = max(0, player_stress.current - 1)
                        print(f"{Colors.BRIGHT_AMBER}   >> Three clashes running - {player_name} is out of "
                              f"Fate Points and {enemy_name} forces it! "
                              f"{player_name} MEAT: {player_stress.current}/{player_stress.max}{Colors.RESET}")

            print()
            pause(1)

        self.ui.print_system_message("COMBAT RESOLVED")

        player_wins = player_stress.current > 0

        if player_wins:
            print(f"{Colors.BRIGHT_CYAN}   >> COMBAT SUCCESS{Colors.RESET}")
            print(f"{Colors.AMBER}   {player_name} prevails{Colors.RESET}")
        else:
            print(f"{Colors.BRIGHT_AMBER}   >> COMBAT FAILURE{Colors.RESET}")
            print(f"{Colors.AMBER}   {player_name} is overwhelmed{Colors.RESET}")

        print()
        pause(1.5)

        return player_wins


def roll_4df_dice() -> list:
    """
    Roll 4 Fate dice and return the individual results.
    Each die: -1, 0, or +1
    """
    return [random.choice([-1, 0, 1]) for _ in range(4)]


def roll_4df() -> int:
    """
    Roll 4 Fate dice (4dF).
    Each die: -1, 0, or +1
    Returns sum (-4 to +4)
    """
    return sum(roll_4df_dice())


def format_dice_result(dice_values: list) -> str:
    """
    Format 4dF dice for display.

    Example: [-1, 0, 1, 1] -> "[-] [ ] [+] [+] = +1"
    """
    symbols = {-1: "[-]", 0: "[ ]", 1: "[+]"}
    dice_str = " ".join(symbols[d] for d in dice_values)
    total = sum(dice_values)
    sign = "+" if total >= 0 else ""
    return f"{dice_str} = {sign}{total}"
