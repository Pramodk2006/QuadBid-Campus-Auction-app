"""
schemas.py — Pydantic v2 request/response models (validation layer).

Changes from Phase 1A:
  - ListingCreate: seller_id REMOVED (now derived from JWT token in the route).
  - ListingRead: seller_display_name added (shown in UI as "Pramod K (23ALR070)").
  - New: UserRead, ProfileCompleteRequest, TokenResponse, SetupTokenResponse.

Money:
  - API accepts/returns prices in RUPEES (float) for human readability.
  - Service layer converts to integer PAISE before the database.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Allowed vocabulary
# ---------------------------------------------------------------------------

CATEGORIES = Literal["cycle", "calculator", "books", "electronics", "other"]
CONDITIONS = Literal["new", "like_new", "good", "fair", "needs_repair"]


# ---------------------------------------------------------------------------
# Auth / User schemas
# ---------------------------------------------------------------------------

class ProfileCompleteRequest(BaseModel):
    """
    Submitted after Google OAuth for first-time users.
    Requires the short-lived setup_token received from the OAuth callback.
    """
    setup_token: str
    roll_number: str = Field(
        min_length=5,
        max_length=20,
        description="College roll number, e.g. 23ALR070",
    )
    department: str = Field(min_length=2, max_length=100, description="e.g. AIM, CSE, ECE")
    year: int = Field(ge=1, le=4, description="Current academic year (1–4)")
    phone: Optional[str] = Field(default=None, max_length=15, description="Optional contact number")

    @field_validator("roll_number", mode="before")
    @classmethod
    def normalise_roll_number(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("department", mode="before")
    @classmethod
    def normalise_department(cls, v: str) -> str:
        return v.strip().upper()


class UserRead(BaseModel):
    """Public user profile returned by /api/auth/me and embedded in listings/bids."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    roll_number: Optional[str]
    department: Optional[str]
    year: Optional[int]
    avatar_url: Optional[str]
    display_name: str           # "Pramod K (23ALR070)"
    is_profile_complete: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """Returned after successful login + profile completion."""
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class SetupTokenResponse(BaseModel):
    """
    Returned from OAuth callback when a NEW user has authenticated via Google
    but hasn't submitted their roll number yet.
    The frontend should redirect to a profile-completion form.
    """
    setup_token: str
    email: str
    name: str
    avatar_url: Optional[str]
    message: str = "Please complete your profile to continue"


class DevLoginRequest(BaseModel):
    """
    DEV/TEST ONLY — creates or retrieves a user without real OAuth.
    This endpoint is disabled in production.
    """
    email: str = Field(description="Must end with @kongu.edu")
    name: str
    roll_number: str
    department: str = "AIM"
    year: int = Field(ge=1, le=4, default=3)


# ---------------------------------------------------------------------------
# Listing schemas
# ---------------------------------------------------------------------------

class ListingCreate(BaseModel):
    """Payload for POST /api/listings — seller_id derived from JWT, NOT from request."""

    title: str = Field(min_length=3, max_length=120)
    category: CATEGORIES
    description: str = Field(min_length=10, max_length=3000)
    condition: CONDITIONS
    photos: list[str] = Field(default_factory=list, max_length=6)
    starting_price: float = Field(ge=1.0, le=1_000_000.0, description="Starting price in ₹")
    min_bid_increment: float = Field(gt=0.0, le=100_000.0, description="Minimum increment in ₹")
    closes_at: datetime = Field(description="Closing timestamp (timezone required)")

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank or whitespace only")
        return v

    @field_validator("closes_at", mode="before")
    @classmethod
    def parse_closes_at(cls, v):
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        return v

    @field_validator("closes_at", mode="after")
    @classmethod
    def closing_must_be_future(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("closes_at must include timezone info (e.g. +05:30 or Z)")
        if v <= datetime.now(timezone.utc):
            raise ValueError("closes_at must be in the future")
        return v

    @field_validator("photos")
    @classmethod
    def validate_photos(cls, v: list[str]) -> list[str]:
        for url in v:
            if not url.strip():
                raise ValueError("Photo URLs cannot be empty strings")
        return v


class ListingUpdate(BaseModel):
    """Payload for PATCH /api/listings/{id} — all fields optional."""

    title: Optional[str] = Field(default=None, min_length=3, max_length=120)
    category: Optional[CATEGORIES] = None
    description: Optional[str] = Field(default=None, min_length=10, max_length=3000)
    condition: Optional[CONDITIONS] = None
    photos: Optional[list[str]] = Field(default=None, max_length=6)
    starting_price: Optional[float] = Field(default=None, ge=1.0, le=1_000_000.0)
    min_bid_increment: Optional[float] = Field(default=None, gt=0.0, le=100_000.0)
    closes_at: Optional[datetime] = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Field cannot be blank or whitespace only")
        return v

    @field_validator("closes_at", mode="before")
    @classmethod
    def parse_optional_closes_at(cls, v):
        if v is not None and isinstance(v, str):
            v = datetime.fromisoformat(v)
        return v

    @field_validator("closes_at", mode="after")
    @classmethod
    def update_closing_must_be_future(cls, v):
        if v is not None:
            if v.tzinfo is None:
                raise ValueError("closes_at must include timezone info")
            if v <= datetime.now(timezone.utc):
                raise ValueError("closes_at must be in the future")
        return v

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ListingUpdate":
        if all(
            v is None
            for v in [
                self.title, self.category, self.description,
                self.condition, self.photos, self.starting_price,
                self.min_bid_increment, self.closes_at,
            ]
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class ListingRead(BaseModel):
    """Full listing detail — includes seller display name."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    seller_id: int
    seller_display_name: str    # "Pramod K (23ALR070)"
    title: str
    category: str
    description: str
    condition: str
    photos: list[str]
    starting_price: float       # in ₹
    min_bid_increment: float    # in ₹
    closes_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime


class ListingListItem(BaseModel):
    """Compact card view for the marketplace grid."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    seller_display_name: str
    title: str
    category: str
    condition: str
    photos: list[str]
    starting_price: float
    min_bid_increment: float
    closes_at: datetime
    status: str
    created_at: datetime
