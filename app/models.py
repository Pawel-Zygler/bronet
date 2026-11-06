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


class ConfirmHelpPayload(BaseModel):
    other_profile_id: int
    password: Optional[str] = Field(default="", max_length=200)


class SimulatorConfigPayload(BaseModel):
    min_tps: Optional[int] = Field(default=None, ge=1, le=50)
    max_tps: Optional[int] = Field(default=None, ge=1, le=100)
    interval_seconds: Optional[float] = Field(default=None, ge=0.05, le=10.0)
    daily_pool_pct: Optional[int] = Field(default=None, ge=5, le=95)
    is_running: Optional[bool] = None


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
    chlopocoin_balance: Optional[int] = 0
    created_at: str
    updated_at: str
