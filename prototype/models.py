"""
Data models for narrative engine.
Using Pydantic for validation and type safety.
"""

from enum import Enum
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


class SpeakerType(str, Enum):
    """Who is speaking - determines color and formatting."""
    SYSTEM = "system"       # Deck interface messages (bright cyan)
    ENFORCER = "enforcer"   # Field agent transmissions (amber)
    PLAYER = "player"       # Handler responses (white/cyan)
    DATA = "data"           # System readouts (cyan bullets + context colors)


class SceneType(str, Enum):
    """Type of scene - affects available actions."""
    NARRATIVE = "narrative"  # Story beats, dialogue
    COMBAT = "combat"        # Combat encounters
    DECISION = "decision"    # Major choices with consequences


class Message(BaseModel):
    """A single message in a scene."""
    speaker: SpeakerType
    text: str
    source: Optional[str] = None  # e.g., "NOMAD-7" for enforcer
    delay: float = 0.5  # Seconds to pause after message

    class Config:
        use_enum_values = True


class ThreatScanData(BaseModel):
    """Enemy threat assessment data."""
    name: str
    chrome: str
    threat_level: Literal["low", "medium", "high"]


class ThreatScan(BaseModel):
    """Full threat scan display."""
    type: Literal["threat_scan"] = "threat_scan"
    enemies: List[ThreatScanData]
    assessment: str


class BuildingIntel(BaseModel):
    """Building intelligence data."""
    type: Literal["building_intel"] = "building_intel"
    building: str
    access_points: List[str]
    security: List[str]
    weakness: Optional[str] = None


class EnforcerStatus(BaseModel):
    """Enforcer vitals and status."""
    type: Literal["enforcer_status"] = "enforcer_status"
    name: str
    stress_meat: int
    stress_nerves: int
    stress_systems: int
    effects: List[str] = Field(default_factory=list)


DataDisplay = ThreatScan | BuildingIntel | EnforcerStatus


class Conditions(BaseModel):
    """Conditions for choice availability."""
    flags_set: List[str] = Field(default_factory=list)
    flags_not_set: List[str] = Field(default_factory=list)
    items: List[str] = Field(default_factory=list)
    stress_meat_max: Optional[int] = None
    stress_nerves_max: Optional[int] = None
    stress_systems_max: Optional[int] = None
    stat_body_min: Optional[int] = None
    stat_cool_min: Optional[int] = None


class Effects(BaseModel):
    """Effects of making a choice."""
    next: Optional[str] = None  # Next scene ID
    flags_set: List[str] = Field(default_factory=list)
    flags_unset: List[str] = Field(default_factory=list)
    items_add: List[str] = Field(default_factory=list)
    items_remove: List[str] = Field(default_factory=list)
    consume_item: Optional[str] = None
    stress: Dict[str, int] = Field(default_factory=dict)
    apply_effect: Optional[str] = None
    show_data: Optional[Dict[str, Any]] = None
    return_to_choices: bool = False
    combat: Optional[Dict[str, Any]] = None  # Trigger combat encounter


class Choice(BaseModel):
    """A choice the player can make."""
    id: str
    text: str
    speaker: SpeakerType = SpeakerType.PLAYER
    conditions: Optional[Conditions] = None
    effects: Optional[Effects] = None
    next: Optional[str] = None  # Shortcut for effects.next
    style: Optional[Literal["normal", "warning", "success"]] = "normal"

    class Config:
        use_enum_values = True


class Submenu(BaseModel):
    """Submenu with additional actions."""
    label: str = "More actions..."
    choices: List[Choice]


class Scene(BaseModel):
    """A complete scene in the narrative."""
    id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    messages: List[Message] = Field(default_factory=list)
    choices: List[Choice] = Field(default_factory=list)
    submenu: Optional[Submenu] = None


class StoryMetadata(BaseModel):
    """Story-level metadata."""
    title: str
    author: str = "Game Jam 2025"
    version: str = "1.0.0"
    playbook: Optional[str] = None


class CharacterStats(BaseModel):
    """Character statistics."""
    body: int = 0
    reflexes: int = 0
    cool: int = 0
    code: int = 0
    tech: int = 0


class StressTrack(BaseModel):
    """A single stress track."""
    max: int = 3
    current: int = 3


class CharacterState(BaseModel):
    """Complete character state."""
    name: str
    stats: CharacterStats
    stress_meat: StressTrack = Field(default_factory=StressTrack)
    stress_nerves: StressTrack = Field(default_factory=StressTrack)
    stress_systems: StressTrack = Field(default_factory=StressTrack)
    chrome: List[str] = Field(default_factory=list)
    aspects: Dict[str, str] = Field(default_factory=dict)


class Story(BaseModel):
    """Complete story data."""
    metadata: StoryMetadata
    start_scene: str
    character: CharacterState
    scenes: Dict[str, Scene]


class GameState(BaseModel):
    """Current game state."""
    current_scene: str
    flags: List[str] = Field(default_factory=list)
    items: List[str] = Field(default_factory=list)
    character: CharacterState
    active_effects: List[str] = Field(default_factory=list)
