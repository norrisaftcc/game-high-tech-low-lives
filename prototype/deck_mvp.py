#!/usr/bin/env python3
"""
DECK INTERFACE PROTOTYPE
High Tech, Low Lives - Game Jam MVP

You are the HANDLER - a netrunner remotely guiding an Enforcer through the field.
This terminal is your deck. The console aesthetic is diegetic.
"""

import time
import sys
import argparse


class DeckInterface:
    """BBS-style terminal interface for guiding the Enforcer."""

    def __init__(self, batch_mode=False):
        self.enforcer_name = "NOMAD-7"
        self.connection_status = "SECURE"
        self.stress_meat = 3
        self.stress_nerves = 3
        self.stress_systems = 3
        self.batch_mode = batch_mode

    def clear_screen(self):
        """Clear terminal (cross-platform)."""
        print("\n" * 50)

    def print_slow(self, text, delay=0.03):
        """Print text with typewriter effect."""
        for char in text:
            sys.stdout.write(char)
            sys.stdout.flush()
            time.sleep(delay)
        print()

    def print_border(self, char="═", length=60):
        """Print decorative border."""
        print(char * length)

    def print_header(self):
        """Print deck interface header."""
        self.print_border("═")
        print("╔══════════════════════════════════════════════════════════╗")
        print("║          D E C K   I N T E R F A C E   v2.4.1           ║")
        print("║          PELAGIC SOLUTIONS NEURAL BRIDGE SYSTEM          ║")
        print("╚══════════════════════════════════════════════════════════╝")
        self.print_border("═")
        print()

    def print_status(self):
        """Print connection status and enforcer vitals."""
        print(f"┌─ CONNECTION STATUS ────────────────────────────────────┐")
        print(f"│ ENFORCER:  {self.enforcer_name:<15} STATUS: {self.connection_status:<12} │")
        print(f"│ LINK:      NEURAL BRIDGE        LATENCY: 24ms         │")
        print(f"└────────────────────────────────────────────────────────┘")
        print()
        print(f"┌─ ENFORCER VITALS ──────────────────────────────────────┐")
        print(f"│ MEAT:     {'■' * self.stress_meat}{'□' * (3 - self.stress_meat)}  " +
              f"NERVES:   {'■' * self.stress_nerves}{'□' * (3 - self.stress_nerves)}  " +
              f"SYSTEMS:  {'■' * self.stress_systems}{'□' * (3 - self.stress_systems)}  │")
        print(f"└────────────────────────────────────────────────────────┘")
        print()

    def print_transmission(self, text, source="NOMAD-7"):
        """Print message from field agent."""
        print(f">> INCOMING TRANSMISSION [{source}]")
        self.print_border("─", 60)
        print(f"   {text}")
        self.print_border("─", 60)
        print()

    def print_system_message(self, text):
        """Print system status message."""
        print(f"[SYSTEM] {text}")
        print()

    def get_choice(self, choices, auto_select=0):
        """Get player choice from options.

        Args:
            choices: List of choice strings
            auto_select: Index to auto-select in batch mode (default 0)
        """
        print("┌─ AVAILABLE ACTIONS ────────────────────────────────────┐")
        for i, choice in enumerate(choices, 1):
            print(f"│ [{i}] {choice:<54} │")
        print("└────────────────────────────────────────────────────────┘")
        print()

        if self.batch_mode:
            # Auto-select in batch mode
            choice_num = auto_select + 1
            print(f"COMMAND > {choice_num} [BATCH MODE: AUTO-SELECTED]")
            print()
            time.sleep(1.5)  # Pause to show selection
            return auto_select

        while True:
            try:
                choice_input = input("COMMAND > ").strip()
                choice_num = int(choice_input)
                if 1 <= choice_num <= len(choices):
                    return choice_num - 1
                else:
                    print(f"[ERROR] Invalid selection. Choose 1-{len(choices)}")
            except ValueError:
                print("[ERROR] Invalid input. Enter a number.")
            except KeyboardInterrupt:
                print("\n[SYSTEM] Connection terminated by user.")
                sys.exit(0)


def prologue_scene(batch_mode=False):
    """Prologue: Establishing the handler/enforcer relationship."""
    deck = DeckInterface(batch_mode=batch_mode)

    # Opening
    deck.clear_screen()
    deck.print_header()

    deck.print_system_message("Initializing neural bridge...")
    time.sleep(1)
    deck.print_system_message("Establishing secure connection...")
    time.sleep(1)
    deck.print_system_message("Biometric verification: ACCEPTED")
    time.sleep(1)
    deck.print_system_message("CONNECTION ESTABLISHED")
    print()
    time.sleep(0.5)

    deck.print_status()

    # First contact
    deck.print_transmission(
        "Handler, this is Nomad-7. I'm in position outside the target.\n"
        "   Rain's coming down hard. Visibility is shit. I've got eyes on\n"
        "   three guards at the main entrance, two patrol boats circling.\n"
        "   Corporate IDs, recent chrome. They're expecting trouble.",
        "NOMAD-7"
    )

    time.sleep(0.5)

    # Player's first choice
    choices = [
        "\"Copy that. What's your approach preference?\"",
        "\"Scan their chrome. I need threat assessment.\"",
        "\"Hold position. I'm pulling building schematics.\""
    ]

    choice_idx = deck.get_choice(choices, auto_select=1)  # Default to scan chrome
    print()

    # Response based on choice
    if choice_idx == 0:
        deck.print_system_message("TRANSMITTING QUERY...")
        time.sleep(1)
        deck.print_transmission(
            "Depends on what you're seeing from your end, Handler.\n"
            "   I can go loud - my mantis blades are sharp and these corpo\n"
            "   types usually fold fast. Or I can try the maintenance access\n"
            "   on the east side. Slower, but quieter. Your call.",
            "NOMAD-7"
        )
    elif choice_idx == 1:
        deck.print_system_message("ACTIVATING REMOTE SCANNER...")
        time.sleep(2)
        deck.print_system_message("SCAN COMPLETE - THREAT ANALYSIS:")
        print("   >> GUARD-1: Subdermal armor (grade 2), shock baton")
        print("   >> GUARD-2: Reflex boosters (military), SMG")
        print("   >> GUARD-3: Pain editor, combat stims")
        print("   >> ASSESSMENT: High threat. Coordinated response likely.")
        print()
        time.sleep(1)
        deck.print_transmission(
            "Yeah, I'm reading those thermals too. Military-grade chrome.\n"
            "   Someone's paying top credit for security tonight. This isn't\n"
            "   your standard rent-a-cop setup. We walking into a trap?",
            "NOMAD-7"
        )
    else:
        deck.print_system_message("ACCESSING BUILDING DATABASE...")
        time.sleep(2)
        deck.print_system_message("SCHEMATICS RETRIEVED - ANALYZING...")
        print("   >> BUILDING: Tower 19-C, Corporate Sector")
        print("   >> ACCESS POINTS: Main entrance, maintenance shaft (east)")
        print("   >> SECURITY: Motion sensors (floors 1-3), camera grid")
        print("   >> WEAKNESS: Maintenance shaft bypasses sensors")
        print()
        time.sleep(1)
        deck.print_transmission(
            "Good catch, Handler. Maintenance shaft puts me behind their\n"
            "   line. Gonna be tight and probably full of water, but I'll\n"
            "   take wet and alive over loud and dead. Moving to position.",
            "NOMAD-7"
        )

    time.sleep(1)
    print()

    # Transition
    deck.print_system_message("Enforcer moving to secondary position...")
    time.sleep(2)
    deck.print_system_message("Connection stable. Awaiting field update...")
    print()
    time.sleep(1)

    deck.print_transmission(
        "Handler, I'm at the maintenance access. Hatch is rusted but\n"
        "   I can crack it. Before I go dark in there... why are we\n"
        "   doing this? You never said what we're extracting from Tower 19.",
        "NOMAD-7"
    )

    time.sleep(0.5)

    # Final choice - reveals the stakes
    choices = [
        "\"Information. Corporate secrets. You don't need to know more.\"",
        "\"A person. Someone who wants out of their contract.\"",
        "\"It's personal. I'll explain after you're clear.\""
    ]

    choice_idx = deck.get_choice(choices, auto_select=2)  # Default to personal
    print()

    if choice_idx == 0:
        deck.print_system_message("TRANSMITTING RESPONSE...")
        time.sleep(1)
        deck.print_transmission(
            "Right. Need-to-know basis. I get it. I'm just the muscle.\n"
            "   Fine. Going in now. If I don't check in within fifteen,\n"
            "   assume I'm compromised. Nomad-7 out.",
            "NOMAD-7"
        )
        deck.connection_status = "TENSE"
    elif choice_idx == 1:
        deck.print_system_message("TRANSMITTING RESPONSE...")
        time.sleep(1)
        deck.print_transmission(
            "An extraction. Okay. That I can work with. You know I've\n"
            "   pulled people out before - it never goes clean. They panic,\n"
            "   they freeze, they do stupid shit. But if you trust this\n"
            "   person... I'm in. Going dark. Nomad-7 out.",
            "NOMAD-7"
        )
        deck.connection_status = "FOCUSED"
    else:
        deck.print_system_message("TRANSMITTING RESPONSE...")
        time.sleep(1)
        deck.print_transmission(
            "Personal. Shit. Those are always the worst kind of jobs,\n"
            "   Handler. But you've kept me alive this long, so I trust you.\n"
            "   I just hope whatever's in there is worth bleeding for.\n"
            "   Going dark now. Nomad-7 out.",
            "NOMAD-7"
        )
        deck.connection_status = "LOYAL"

    time.sleep(1)
    print()

    # End of prologue
    deck.print_system_message("NEURAL BRIDGE SIGNAL DEGRADING...")
    deck.print_system_message("Enforcer entering shielded area...")
    deck.print_system_message("STANDBY...")
    print()
    time.sleep(2)

    deck.print_border("═")
    print()
    print("              E N D   O F   P R O L O G U E")
    print()
    print("       [ This is where Act 1: The Infiltration would begin ]")
    print()
    deck.print_border("═")
    print()
    print("PROTOTYPE MVP - Testing deck interface aesthetic")
    print("Next: Build full scene system with JSON data")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="DECK Interface Prototype - High Tech, Low Lives"
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Run in batch mode (auto-select choices for testing)"
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Alias for --batch"
    )

    args = parser.parse_args()
    batch_mode = args.batch or args.demo

    if batch_mode:
        print("[SYSTEM] Running in BATCH MODE - choices will be auto-selected")
        print()
        time.sleep(1)

    try:
        prologue_scene(batch_mode=batch_mode)
    except KeyboardInterrupt:
        print("\n\n[SYSTEM] Connection terminated.")
        sys.exit(0)
