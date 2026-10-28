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
    photos: list[str] = Field(min_length=1, max_length=6, description="At least 1 item photo is mandatory, up to 6")
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
            if v.endswith("Z"):
                v = v[:-1] + "+00:00"
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
            if v.endswith("Z"):
                v = v[:-1] + "+00:00"
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
    """Full listing detail — includes seller display name and live bidding status."""
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
    current_price: float        # in ₹ (starting_price or highest bid)
    min_next_bid: float         # in ₹ (starting_price if 0 bids, else current_price + increment)
    bid_count: int
    leading_bidder_display_name: Optional[str] = None
    closes_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime


class ListingListItem(BaseModel):
    """Compact card view for the marketplace grid."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    seller_id: int
    seller_display_name: str
    title: str
    category: str
    condition: str
    photos: list[str]
    starting_price: float
    min_bid_increment: float
    current_price: float
    bid_count: int
    closes_at: datetime
    status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Bid schemas
# ---------------------------------------------------------------------------

class BidCreate(BaseModel):
    """Payload for POST /api/listings/{id}/bids"""
    amount: float = Field(ge=1.0, le=10_000_000.0, description="Bid amount in ₹")


class BidRead(BaseModel):
    """Public bid history item."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    bidder_id: int
    bidder_display_name: str     # "Pramod K (23ALR070)"
    amount: float                # in ₹
    created_at: datetime


class AuctionLeader(BaseModel):
    """Current leading status of an auction."""
    listing_id: int
    status: str
    has_bids: bool
    current_price: float         # in ₹
    min_next_bid: float          # in ₹
    bid_count: int
    leading_bidder_id: Optional[int] = None
    leading_bidder_display_name: Optional[str] = None
    leading_bid_time: Optional[datetime] = None
    closes_at: datetime
    is_closed: bool


class BidPlacementResult(BaseModel):
    """Response returned when a bid is successfully placed."""
    bid: BidRead
    extended: bool
    new_closes_at: datetime
    message: str


# ---------------------------------------------------------------------------
# Sale Outcome schemas (Phase 4 — Closing & Sale Lifecycle)
# ---------------------------------------------------------------------------

SALE_OUTCOME_STATUSES = Literal[
    "unsold",
    "pending_approval",
    "approved",
    "rejected",
    "seller_cancelled",
    "failed_pickup",
    "completed",
]


class SaleOutcomeRead(BaseModel):
    """Details of an auction lot's resolution and handover."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    winning_bid_id: Optional[int] = None
    winner_id: Optional[int] = None
    winner_display_name: Optional[str] = None
    seller_id: int
    seller_display_name: str
    final_price: float           # in ₹
    status: str
    handover_code: Optional[str] = None
    handover_location: Optional[str] = None
    seller_notes: Optional[str] = None
    decided_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class SellerApprovalRequest(BaseModel):
    """Payload for POST /api/listings/{id}/approve"""
    handover_location: Optional[str] = Field(
        default="Hostel Quad / Common Room",
        max_length=150,
        description="Agreed physical meetup location on campus",
    )
    seller_notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Handover instructions for buyer (e.g. Call when outside H-4)",
    )


class SellerRejectionRequest(BaseModel):
    """Payload for POST /api/listings/{id}/reject"""
    reason: Optional[str] = Field(
        default="Reserve price not met by market demand",
        max_length=300,
    )


class HandoverConfirmRequest(BaseModel):
    """Payload for POST /api/listings/{id}/handover"""
    handover_code: str = Field(
        min_length=4,
        max_length=20,
        description="Physical verification code exchanged during handover",
    )


class ReportIssueRequest(BaseModel):
    """Payload for POST /api/listings/{id}/report-issue"""
    issue_type: Literal["failed_pickup", "seller_cancelled"]
    reason: Optional[str] = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# Question schemas (Buyer Q&A per listing)
# ---------------------------------------------------------------------------

class QuestionCreate(BaseModel):
    """Payload for POST /api/listings/{id}/questions"""
    question_text: str = Field(
        min_length=5,
        max_length=500,
        description="Public question about item condition, specs, or handover",
    )

    @field_validator("question_text")
    @classmethod
    def clean_text(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Question must be at least 5 characters long")
        return cleaned


class AnswerCreate(BaseModel):
    """Payload for POST /api/listings/{id}/questions/{qid}/answer"""
    answer_text: str = Field(
        min_length=2,
        max_length=1000,
        description="Seller's public reply to the question",
    )

    @field_validator("answer_text")
    @classmethod
    def clean_text(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Answer must be at least 2 characters long")
        return cleaned


class QuestionRead(BaseModel):
    """Public Q&A response item."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    asker_id: int
    asker_name: str
    asker_display_name: str
    asker_roll_number: Optional[str]
    question_text: str
    answer_text: Optional[str] = None
    answered_by_id: Optional[int] = None
    answered_by_display_name: Optional[str] = None
    answered_at: Optional[datetime] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Watchlist & Saved Search schemas (Phase 7)
# ---------------------------------------------------------------------------

class WatchlistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    listing: ListingListItem
    created_at: datetime


class SavedSearchCreate(BaseModel):
    query: str = Field(min_length=2, max_length=120)
    category: Optional[str] = None
    max_price: Optional[float] = Field(default=None, ge=1.0)


class SavedSearchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    query: str
    category: Optional[str] = None
    max_price: Optional[float] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# AutoBid schemas (Phase 8 — Proxy Auto-Bidding)
# ---------------------------------------------------------------------------

class AutoBidSet(BaseModel):
    max_ceiling: float = Field(ge=1.0, description="Maximum ceiling in ₹")


class AutoBidRead(BaseModel):
    listing_id: int
    max_ceiling: float
    is_active: bool



