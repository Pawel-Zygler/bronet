from typing import List, Optional
from pydantic import BaseModel, Field


class ProfilePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: Optional[str] = Field(default="", max_length=160)
    password: Optional[str] = Field(default="", max_length=200)
    new_password: Optional[str] = Field(default="", max_length=200)
    can_help: List[str] = Field(default_factory=list, description="Umiem / Potrafię pomóc z")
    need_help: List[str] = Field(default_factory=list, description="Potrzebuję / Szukam pomocy z")
    contact: Optional[str] = Field(default="", max_length=160)
    bio: Optional[str] = Field(default="", max_length=280)
    location_name: Optional[str] = Field(default="", max_length=120)
    lat: Optional[float] = Field(default=None)
    lng: Optional[float] = Field(default=None)
    share_location: Optional[bool] = Field(default=False)


class LoginPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=160)
    password: Optional[str] = Field(default="", max_length=200)


class DeletePayload(BaseModel):
    password: Optional[str] = Field(default="", max_length=200)


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    has_password: bool = False
    can_help: List[str]
    need_help: List[str]
    contact: str
    bio: str
    location_name: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    share_location: Optional[bool] = False
    created_at: str
    updated_at: str
