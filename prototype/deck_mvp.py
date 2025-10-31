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


# ANSI Color Codes - Cyan and Amber Terminal Aesthetic
class Colors:
    """Classic BBS terminal color palette."""
    CYAN = '\033[36m'           # System UI, borders
    BRIGHT_CYAN = '\033[96m'    # Headers, important system
    AMBER = '\033[33m'          # Transmissions, field comms
    BRIGHT_AMBER = '\033[93m'   # Warnings, alerts
    WHITE = '\033[97m'          # Normal text
    GREY = '\033[90m'           # Secondary info
    BOLD = '\033[1m'            # Emphasis
    DIM = '\033[2m'             # De-emphasis
    RESET = '\033[0m'           # Reset to default

    @staticmethod
    def strip_colors():
        """Disable colors (for batch mode or no-color terminals)."""
        Colors.CYAN = ''
        Colors.BRIGHT_CYAN = ''
        Colors.AMBER = ''
        Colors.BRIGHT_AMBER = ''
        Colors.WHITE = ''
        Colors.GREY = ''
        Colors.BOLD = ''
        Colors.DIM = ''
        Colors.RESET = ''


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
        print(f"{Colors.CYAN}{char * length}{Colors.RESET}")

    def print_header(self):
        """Print deck interface header."""
        self.print_border("═")
        print(f"{Colors.BRIGHT_CYAN}╔══════════════════════════════════════════════════════════╗{Colors.RESET}")
        print(f"{Colors.BRIGHT_CYAN}║{Colors.BOLD}          D E C K   I N T E R F A C E   v2.4.1           {Colors.RESET}{Colors.BRIGHT_CYAN}║{Colors.RESET}")
        print(f"{Colors.BRIGHT_CYAN}║{Colors.GREY}          PELAGIC SOLUTIONS NEURAL BRIDGE SYSTEM          {Colors.RESET}{Colors.BRIGHT_CYAN}║{Colors.RESET}")
        print(f"{Colors.BRIGHT_CYAN}╚══════════════════════════════════════════════════════════╝{Colors.RESET}")
        self.print_border("═")
        print()

    def print_status(self):
        """Print connection status and enforcer vitals."""
        print(f"{Colors.CYAN}┌─ CONNECTION STATUS ────────────────────────────────────┐{Colors.RESET}")
        print(f"{Colors.CYAN}│{Colors.RESET} ENFORCER:  {Colors.AMBER}{self.enforcer_name:<15}{Colors.RESET} STATUS: {Colors.WHITE}{self.connection_status:<12}{Colors.RESET} {Colors.CYAN}│{Colors.RESET}")
        print(f"{Colors.CYAN}│{Colors.RESET} LINK:      {Colors.GREY}NEURAL BRIDGE{Colors.RESET}        LATENCY: {Colors.GREY}24ms{Colors.RESET}         {Colors.CYAN}│{Colors.RESET}")
        print(f"{Colors.CYAN}└────────────────────────────────────────────────────────┘{Colors.RESET}")
        print()
        print(f"{Colors.CYAN}┌─ ENFORCER VITALS ──────────────────────────────────────┐{Colors.RESET}")
        meat_filled = f"{Colors.AMBER}{'■' * self.stress_meat}{Colors.RESET}"
        meat_empty = f"{Colors.GREY}{'□' * (3 - self.stress_meat)}{Colors.RESET}"
        nerves_filled = f"{Colors.AMBER}{'■' * self.stress_nerves}{Colors.RESET}"
        nerves_empty = f"{Colors.GREY}{'□' * (3 - self.stress_nerves)}{Colors.RESET}"
        systems_filled = f"{Colors.CYAN}{'■' * self.stress_systems}{Colors.RESET}"
        systems_empty = f"{Colors.GREY}{'□' * (3 - self.stress_systems)}{Colors.RESET}"
        print(f"{Colors.CYAN}│{Colors.RESET} MEAT:     {meat_filled}{meat_empty}  " +
              f"NERVES:   {nerves_filled}{nerves_empty}  " +
              f"SYSTEMS:  {systems_filled}{systems_empty}  {Colors.CYAN}│{Colors.RESET}")
        print(f"{Colors.CYAN}└────────────────────────────────────────────────────────┘{Colors.RESET}")
        print()

    def print_transmission(self, text, source="NOMAD-7"):
        """Print message from field agent."""
        print(f"{Colors.AMBER}>> INCOMING TRANSMISSION [{Colors.BOLD}{source}{Colors.RESET}{Colors.AMBER}]{Colors.RESET}")
        print(f"{Colors.GREY}{'─' * 60}{Colors.RESET}")
        print(f"{Colors.AMBER}   {text}{Colors.RESET}")
        print(f"{Colors.GREY}{'─' * 60}{Colors.RESET}")
        print()

    def print_system_message(self, text):
        """Print system status message."""
        print(f"{Colors.BRIGHT_CYAN}[SYSTEM]{Colors.RESET} {Colors.WHITE}{text}{Colors.RESET}")
        print()

    def get_choice(self, choices, auto_select=0):
        """Get player choice from options.

        Args:
            choices: List of choice strings
            auto_select: Index to auto-select in batch mode (default 0)
        """
        print(f"{Colors.CYAN}┌─ AVAILABLE ACTIONS ────────────────────────────────────┐{Colors.RESET}")
        for i, choice in enumerate(choices, 1):
            print(f"{Colors.CYAN}│{Colors.RESET} {Colors.AMBER}[{i}]{Colors.RESET} {Colors.WHITE}{choice:<54}{Colors.RESET} {Colors.CYAN}│{Colors.RESET}")
        print(f"{Colors.CYAN}└────────────────────────────────────────────────────────┘{Colors.RESET}")
        print()

        if self.batch_mode:
            # Auto-select in batch mode
            choice_num = auto_select + 1
            print(f"{Colors.BRIGHT_CYAN}COMMAND >{Colors.RESET} {Colors.AMBER}{choice_num}{Colors.RESET} {Colors.GREY}[BATCH MODE: AUTO-SELECTED]{Colors.RESET}")
            print()
            time.sleep(1.5)  # Pause to show selection
            return auto_select

        while True:
            try:
                choice_input = input(f"{Colors.BRIGHT_CYAN}COMMAND >{Colors.RESET} ").strip()
                choice_num = int(choice_input)
                if 1 <= choice_num <= len(choices):
                    return choice_num - 1
                else:
                    print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} Invalid selection. Choose 1-{len(choices)}")
            except ValueError:
                print(f"{Colors.BRIGHT_AMBER}[ERROR]{Colors.RESET} Invalid input. Enter a number.")
            except KeyboardInterrupt:
                print(f"\n{Colors.BRIGHT_CYAN}[SYSTEM]{Colors.RESET} Connection terminated by user.")
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
        print(f"   {Colors.CYAN}>>{Colors.RESET} GUARD-1: {Colors.AMBER}Subdermal armor (grade 2), shock baton{Colors.RESET}")
        print(f"   {Colors.CYAN}>>{Colors.RESET} GUARD-2: {Colors.BRIGHT_AMBER}Reflex boosters (military), SMG{Colors.RESET}")
        print(f"   {Colors.CYAN}>>{Colors.RESET} GUARD-3: {Colors.BRIGHT_AMBER}Pain editor, combat stims{Colors.RESET}")
        print(f"   {Colors.CYAN}>>{Colors.RESET} ASSESSMENT: {Colors.BRIGHT_AMBER}{Colors.BOLD}High threat. Coordinated response likely.{Colors.RESET}")
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
        print(f"   {Colors.CYAN}>>{Colors.RESET} BUILDING: {Colors.WHITE}Tower 19-C, Corporate Sector{Colors.RESET}")
        print(f"   {Colors.CYAN}>>{Colors.RESET} ACCESS POINTS: {Colors.AMBER}Main entrance, maintenance shaft (east){Colors.RESET}")
        print(f"   {Colors.CYAN}>>{Colors.RESET} SECURITY: {Colors.BRIGHT_AMBER}Motion sensors (floors 1-3), camera grid{Colors.RESET}")
        print(f"   {Colors.CYAN}>>{Colors.RESET} WEAKNESS: {Colors.BRIGHT_CYAN}Maintenance shaft bypasses sensors{Colors.RESET}")
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
    print(f"{Colors.BRIGHT_CYAN}{Colors.BOLD}              E N D   O F   P R O L O G U E{Colors.RESET}")
    print()
    print(f"{Colors.GREY}       [ This is where Act 1: The Infiltration would begin ]{Colors.RESET}")
    print()
    deck.print_border("═")
    print()
    print(f"{Colors.AMBER}PROTOTYPE MVP - Testing deck interface aesthetic{Colors.RESET}")
    print(f"{Colors.GREY}Next: Build full scene system with JSON data{Colors.RESET}")
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
        print(f"{Colors.BRIGHT_CYAN}[SYSTEM]{Colors.RESET} Running in {Colors.AMBER}BATCH MODE{Colors.RESET} - choices will be auto-selected")
        print()
        time.sleep(1)

    try:
        prologue_scene(batch_mode=batch_mode)
    except KeyboardInterrupt:
        print("\n\n[SYSTEM] Connection terminated.")
        sys.exit(0)
