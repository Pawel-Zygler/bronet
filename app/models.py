from typing import List, Optional
from pydantic import BaseModel, Field, validator


class ProfilePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    can_help: List[str] = Field(default_factory=list, description="Umiem / Potrafię pomóc z")
    need_help: List[str] = Field(default_factory=list, description="Potrzebuję / Szukam pomocy z")
    contact: Optional[str] = Field(default="", max_length=160)
    bio: Optional[str] = Field(default="", max_length=280)

    @validator("name")
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Imię nie może być puste.")
        return cleaned

    @validator("contact", "bio", pre=True, always=True)
    def clean_optional_str(cls, v: Optional[str]) -> str:
        if v is None:
            return ""
        return str(v).strip()


class ProfileResponse(BaseModel):
    id: int
    name: str
    can_help: List[str]
    need_help: List[str]
    contact: str
    bio: str
    created_at: str
    updated_at: str
