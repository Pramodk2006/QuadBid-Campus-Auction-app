"""
schemas.py — Pydantic v2 request/response models (validation layer).

Why a separate schema layer?
  - Keeps HTTP concerns (what the client sends/receives) separate from DB models.
  - Pydantic rejects invalid data BEFORE it reaches the service or database.
  - Different schemas for Create / Update / Read let us expose only safe fields.

Money handling:
  - API accepts/returns prices in RUPEES (float, e.g. 250.50) for human readability.
  - Service layer converts to integer PAISE before touching the database.
  - Conversion: rupees * 100, rounded to nearest integer.

Temporary note:
  - seller_id is accepted in ListingCreate for dev/testing only.
  - Phase 3 (auth) will derive seller identity from JWT token instead.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Allowed vocabulary (single source of truth shared by schema + service)
# ---------------------------------------------------------------------------

CATEGORIES = Literal["cycle", "calculator", "books", "electronics", "other"]
CONDITIONS = Literal["new", "like_new", "good", "fair", "needs_repair"]
STATUSES = Literal["active", "closed", "cancelled"]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ListingCreate(BaseModel):
    """Payload for POST /api/listings"""

    # Dev-only: will be removed when auth is added in Phase 3
    seller_id: int = Field(gt=0, description="Temporary: seller ID for dev testing")

    title: str = Field(min_length=3, max_length=120)
    category: CATEGORIES
    description: str = Field(min_length=10, max_length=3000)
    condition: CONDITIONS

    # Up to 6 photo URLs; validated as non-empty strings
    photos: list[str] = Field(default_factory=list, max_length=6)

    # Rupees (float) accepted from client — converted to paise inside service layer
    starting_price: float = Field(ge=1.0, le=1_000_000.0,
                                   description="Starting price in ₹")
    min_bid_increment: float = Field(gt=0.0, le=100_000.0,
                                      description="Minimum increment in ₹")

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
        """Accept both string and datetime; ensure timezone info is present."""
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        return v

    @field_validator("closes_at", mode="after")
    @classmethod
    def closing_must_be_future(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("closes_at must include timezone info (e.g. +05:30 or Z)")
        now = datetime.now(timezone.utc)
        if v <= now:
            raise ValueError("closes_at must be in the future")
        return v

    @field_validator("photos")
    @classmethod
    def validate_photos(cls, v: list[str]) -> list[str]:
        for url in v:
            url = url.strip()
            if not url:
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


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class ListingRead(BaseModel):
    """Shape of listing data returned by the API (prices in ₹ for readability)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    seller_id: int
    title: str
    category: str
    description: str
    condition: str
    photos: list[str]

    # Returned in rupees (converted from paise by the service layer)
    starting_price: float
    min_bid_increment: float

    closes_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime


class ListingListItem(BaseModel):
    """Compact card view for the marketplace grid (no full description)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    condition: str
    photos: list[str]
    starting_price: float       # in ₹
    min_bid_increment: float    # in ₹
    closes_at: datetime
    status: str
    created_at: datetime
