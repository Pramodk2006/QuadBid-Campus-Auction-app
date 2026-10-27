"""
models.py — SQLAlchemy ORM models.

User model design:
  - google_id: unique identifier from Google OAuth (never changes).
  - email: college email, must be @kongu.edu domain (enforced in service layer).
  - roll_number: unique campus identifier entered at first login.
    Examples: 23ALR070, 21CSE045
  - display_name property: "Pramod K (23ALR070)" — used in all public-facing bid/listing records.
  - is_profile_complete: False until roll_number, department, year are submitted.
    Users with incomplete profiles cannot bid or list.

Listing model changes from Phase 1A:
  - seller_id is now a ForeignKey → users.id (not just a raw integer).
  - seller relationship enables ORM joins (listing.seller.display_name).

Money:
  - All prices stored as integer PAISE (₹1 = 100 paise) — no floating-point bugs.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)

    # From Google OAuth — never changes, used to identify returning users
    google_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    # College email, e.g. pramodk.23aim@kongu.edu
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # Full name from Google profile (editable)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # Campus roll number e.g. "23ALR070" — unique, entered at profile completion
    roll_number: Mapped[Optional[str]] = mapped_column(
        String(20), unique=True, index=True, nullable=True
    )

    # Department e.g. "AIM", "CSE", "ECE"
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Current academic year: 1, 2, 3, or 4
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Optional phone number for campus handover coordination
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Profile photo URL from Google
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # False until roll_number + department + year are submitted
    is_profile_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Soft-disable without deleting the record
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships (defined here; back-populated in child models)
    listings: Mapped[list["Listing"]] = relationship("Listing", back_populates="seller")
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="bidder")

    # ── Computed property ──────────────────────────────────────────────────

    @property
    def display_name(self) -> str:
        """
        Human-readable identity string shown in bid history, listing cards,
        Q&A, and sale outcomes.
        Examples:
          "Pramod K (23ALR070)"   — profile complete
          "Pramod K"              — profile incomplete (fallback)
        """
        if self.roll_number:
            return f"{self.name} ({self.roll_number})"
        return self.name

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} roll={self.roll_number}>"


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------

class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)

    # FK → users.id (Phase 1A used a plain integer; now properly linked)
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    condition: Mapped[str] = mapped_column(String(30), nullable=False)

    # JSON array of photo URL strings
    photos: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Money in integer PAISE (₹1 = 100 paise)
    starting_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    min_bid_increment_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Lifecycle: active → closed → (approved/rejected) | cancelled
    status: Mapped[str] = mapped_column(
        String(20), default="active", index=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ORM relationship: listing.seller gives the full User object
    seller: Mapped["User"] = relationship("User", back_populates="listings")
    bids: Mapped[list["Bid"]] = relationship(
        "Bid", back_populates="listing", order_by="desc(Bid.created_at)"
    )


# ---------------------------------------------------------------------------
# Bid
# ---------------------------------------------------------------------------

class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)

    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    bidder_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    # Money stored in integer PAISE
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ORM relationships
    listing: Mapped["Listing"] = relationship("Listing", back_populates="bids")
    bidder: Mapped["User"] = relationship("User", back_populates="bids")

    def __repr__(self) -> str:
        return f"<Bid id={self.id} listing={self.listing_id} bidder={self.bidder_id} amount_paise={self.amount_paise}>"

