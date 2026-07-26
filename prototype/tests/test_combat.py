"""
Tests for the 4dF combat + stress engine.

Covers:
- roll_4df() / roll_4df_dice() always stay within the valid Fate dice range.
- format_dice_result() formatting for known inputs.
- Stress application (engine.apply_effects) decrements the correct track
  and clamps at 0 / at max.
- Combat's "taken out" determination triggers correctly when a side's
  stress track hits 0.
- CombatEngine.run_combat() terminates and returns a bool, driven by a
  monkeypatched dice roller so the outcome is deterministic (not flaky).
"""

import itertools

import pytest

import combat
from combat import CombatEngine, format_dice_result, roll_4df, roll_4df_dice
from deck_mvp import DeckInterface
from engine import NarrativeEngine
from models import CharacterState, CharacterStats, Effects, GameState, StressTrack


# ---------------------------------------------------------------------------
# roll_4df / roll_4df_dice
# ---------------------------------------------------------------------------


class TestRollFourDF:
    def test_roll_4df_dice_returns_four_values_each_in_valid_set(self):
        import random

        random.seed(1234)
        for _ in range(200):
            dice = roll_4df_dice()
            assert len(dice) == 4
            assert all(d in (-1, 0, 1) for d in dice)

    def test_roll_4df_always_within_bounds(self):
        import random

        random.seed(5678)
        for _ in range(500):
            total = roll_4df()
            assert -4 <= total <= 4

    def test_roll_4df_returns_sum_of_underlying_dice(self, monkeypatch):
        monkeypatch.setattr(combat, "roll_4df_dice", lambda: [1, 1, -1, 0])
        assert roll_4df() == 1

    def test_roll_4df_extremes(self, monkeypatch):
        monkeypatch.setattr(combat, "roll_4df_dice", lambda: [1, 1, 1, 1])
        assert roll_4df() == 4

        monkeypatch.setattr(combat, "roll_4df_dice", lambda: [-1, -1, -1, -1])
        assert roll_4df() == -4


# ---------------------------------------------------------------------------
# format_dice_result
# ---------------------------------------------------------------------------


class TestFormatDiceResult:
    @pytest.mark.parametrize(
        "dice_values, expected",
        [
            ([-1, 0, 1, 1], "[-] [ ] [+] [+] = +1"),
            ([0, 0, 0, 0], "[ ] [ ] [ ] [ ] = +0"),
            ([-1, -1, -1, -1], "[-] [-] [-] [-] = -4"),
            ([1, 1, 1, 1], "[+] [+] [+] [+] = +4"),
            ([1, -1, 0, -1], "[+] [-] [ ] [-] = -1"),
        ],
    )
    def test_format_dice_result_known_inputs(self, dice_values, expected):
        assert format_dice_result(dice_values) == expected


# ---------------------------------------------------------------------------
# Stress application (engine.apply_effects -> StressTrack)
# ---------------------------------------------------------------------------


def _make_engine_with_character(**stress_kwargs) -> tuple:
    """Build a NarrativeEngine bound to a real CharacterState, without
    going through __init__ (which requires a story JSON file on disk).
    apply_effects() only touches self.state, so this is sufficient."""
    character = CharacterState(
        name="Test Runner",
        stats=CharacterStats(body=1, reflexes=1, cool=1, code=1, tech=1),
        **stress_kwargs,
    )
    eng = NarrativeEngine.__new__(NarrativeEngine)
    eng.state = GameState(current_scene="test_scene", character=character)
    return eng, character


class TestStressApplication:
    def test_apply_effects_stress_decrements_target_track(self):
        eng, character = _make_engine_with_character(
            stress_meat=StressTrack(max=3, current=3)
        )

        eng.apply_effects(Effects(stress={"meat": -1}))

        assert character.stress_meat.current == 2

    def test_apply_effects_stress_only_touches_named_track(self):
        eng, character = _make_engine_with_character(
            stress_meat=StressTrack(max=3, current=3),
            stress_nerves=StressTrack(max=3, current=3),
            stress_systems=StressTrack(max=3, current=3),
        )

        eng.apply_effects(Effects(stress={"nerves": -2}))

        assert character.stress_nerves.current == 1
        assert character.stress_meat.current == 3
        assert character.stress_systems.current == 3

    def test_apply_effects_stress_clamps_at_zero_never_negative(self):
        eng, character = _make_engine_with_character(
            stress_meat=StressTrack(max=3, current=1)
        )

        eng.apply_effects(Effects(stress={"meat": -5}))

        assert character.stress_meat.current == 0

    def test_apply_effects_stress_clamps_at_max_on_recovery(self):
        eng, character = _make_engine_with_character(
            stress_meat=StressTrack(max=3, current=2)
        )

        eng.apply_effects(Effects(stress={"meat": 5}))

        assert character.stress_meat.current == 3

    def test_apply_effects_unknown_stress_track_does_not_raise(self):
        eng, character = _make_engine_with_character(
            stress_meat=StressTrack(max=3, current=3)
        )

        # Should warn and skip rather than raising, leaving state untouched.
        eng.apply_effects(Effects(stress={"cyberpsychosis": -1}))

        assert character.stress_meat.current == 3


# ---------------------------------------------------------------------------
# CombatEngine.run_combat: taken-out determination + loop termination
# ---------------------------------------------------------------------------


def _combat_engine():
    ui = DeckInterface(batch_mode=True)
    return CombatEngine(ui)


class TestRunCombat:
    def test_run_combat_returns_bool(self, monkeypatch):
        # Alternate player/enemy rolls so every round has a clear winner -
        # an identical roll on both sides would clash forever and never
        # terminate, since a tie doesn't decrement either stress track.
        dice_sequence = itertools.cycle([[1, 1, 1, 1], [-1, -1, -1, -1]])
        monkeypatch.setattr(combat, "roll_4df_dice", lambda: next(dice_sequence))

        result = _combat_engine().run_combat(
            enemy_name="Test Drone",
            player_name="Runner",
            player_stat_mod=0,
            enemy_stat_mod=0,
        )

        assert isinstance(result, bool)

    def test_run_combat_player_wins_when_player_always_rolls_higher(self, monkeypatch):
        # Player call always gets a max roll, enemy call always gets a min
        # roll (run_combat calls player then enemy each round).
        dice_sequence = itertools.cycle([[1, 1, 1, 1], [-1, -1, -1, -1]])
        monkeypatch.setattr(combat, "roll_4df_dice", lambda: next(dice_sequence))

        player_track = StressTrack(max=3, current=3)

        result = _combat_engine().run_combat(
            enemy_name="Test Drone",
            player_name="Runner",
            player_stress_track=player_track,
            player_stat_mod=0,
            enemy_stat_mod=0,
        )

        assert result is True
        # Player never took a hit; only the enemy's 3-box counter emptied.
        assert player_track.current == 3

    def test_run_combat_player_taken_out_at_zero_stress_returns_false(self, monkeypatch):
        # Enemy call always gets a max roll, player call always gets a min
        # roll, so the player loses every round.
        dice_sequence = itertools.cycle([[-1, -1, -1, -1], [1, 1, 1, 1]])
        monkeypatch.setattr(combat, "roll_4df_dice", lambda: next(dice_sequence))

        player_track = StressTrack(max=3, current=3)

        result = _combat_engine().run_combat(
            enemy_name="Test Drone",
            player_name="Runner",
            player_stress_track=player_track,
            player_stat_mod=0,
            enemy_stat_mod=0,
        )

        assert result is False
        # Taken out exactly at 0, never negative.
        assert player_track.current == 0

    def test_run_combat_stops_immediately_when_player_starts_at_zero_stress(self, monkeypatch):
        # A dice roller that would raise if ever called - proves the loop
        # condition is checked before any round is played.
        def _unexpected_roll():
            raise AssertionError("roll_4df_dice should not be called")

        monkeypatch.setattr(combat, "roll_4df_dice", _unexpected_roll)

        player_track = StressTrack(max=3, current=0)

        result = _combat_engine().run_combat(
            enemy_name="Test Drone",
            player_name="Runner",
            player_stress_track=player_track,
        )

        assert result is False

    def test_run_combat_uses_default_fresh_stress_track_when_none_supplied(self, monkeypatch):
        # No player_stress_track passed - run_combat should fall back to a
        # local 3-box track rather than raising.
        dice_sequence = itertools.cycle([[1, 1, 1, 1], [-1, -1, -1, -1]])
        monkeypatch.setattr(combat, "roll_4df_dice", lambda: next(dice_sequence))

        result = _combat_engine().run_combat(
            enemy_name="Test Drone",
            player_name="Runner",
            player_stat_mod=0,
            enemy_stat_mod=0,
        )

        assert result is True
