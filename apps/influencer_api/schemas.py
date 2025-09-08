from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class Persona(BaseModel):
    age_range: str
    gender_presentation: str
    skin_tone: str
    hair: Dict[str, Any] = Field(default_factory=dict)
    fashion_style_tags: List[str] = Field(default_factory=list)

class RunBody(BaseModel):
    persona: Persona
    scenePreset: Optional[str] = None
    posePreset: Optional[str] = None
    moodboard: Optional[Dict[str, Any]] = None
    counts: Optional[Dict[str, int]] = None
    video: Optional[Dict[str, Any]] = None
    knobs: Optional[Dict[str, Any]] = None
