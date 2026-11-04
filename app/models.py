from typing import List, Optional
from pydantic import BaseModel, Field


class ProfilePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: Optional[str] = Field(default="", max_length=160)
    can_help: List[str] = Field(default_factory=list, description="Umiem / Potrafię pomóc z")
    need_help: List[str] = Field(default_factory=list, description="Potrzebuję / Szukam pomocy z")
    contact: Optional[str] = Field(default="", max_length=160)
    bio: Optional[str] = Field(default="", max_length=280)


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    can_help: List[str]
    need_help: List[str]
    contact: str
    bio: str
    created_at: str
    updated_at: str
