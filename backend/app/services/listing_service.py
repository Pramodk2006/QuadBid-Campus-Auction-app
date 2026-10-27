"""
services/listing_service.py — Pure business logic for listing management.

Why a service layer separate from routes?
  - Routes handle HTTP (request parsing, status codes, response shaping).
  - Services handle business rules (what is allowed, how data changes).
  - This makes business logic unit-testable without spinning up HTTP.
  - Keeps routes thin and readable.

Money conversion:
  - rupees_to_paise(x) = round(x * 100)   → int
  - paise_to_rupees(x) = x / 100           → float
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ..models import Listing
from ..schemas import ListingCreate, ListingUpdate


# ---------------------------------------------------------------------------
# Money helpers
# ---------------------------------------------------------------------------

def rupees_to_paise(rupees: float) -> int:
    """Convert rupee float to integer paise. Rounds to nearest paisa."""
    return round(rupees * 100)


def paise_to_rupees(paise: int) -> float:
    """Convert integer paise to float rupees for API responses."""
    return paise / 100


# ---------------------------------------------------------------------------
# Reading helpers
# ---------------------------------------------------------------------------

def _enrich(listing: Listing) -> dict:
    """
    Convert a Listing ORM object to a dict with rupee prices.
    Used internally so routes can build response models cleanly.
    """
    return {
        "id": listing.id,
        "seller_id": listing.seller_id,
        "title": listing.title,
        "category": listing.category,
        "description": listing.description,
        "condition": listing.condition,
        "photos": listing.photos or [],
        "starting_price": paise_to_rupees(listing.starting_price_paise),
        "min_bid_increment": paise_to_rupees(listing.min_bid_increment_paise),
        "closes_at": listing.closes_at,
        "status": listing.status,
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
    }


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------

def create_listing(db: Session, payload: ListingCreate) -> dict:
    """
    Persist a new listing.
    Converts rupee inputs to paise before storage.
    """
    listing = Listing(
        seller_id=payload.seller_id,
        title=payload.title,
        category=payload.category,
        description=payload.description,
        condition=payload.condition,
        photos=payload.photos,
        starting_price_paise=rupees_to_paise(payload.starting_price),
        min_bid_increment_paise=rupees_to_paise(payload.min_bid_increment),
        closes_at=payload.closes_at,
        status="active",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _enrich(listing)


def get_listing(db: Session, listing_id: int) -> Optional[dict]:
    """
    Fetch a single listing by ID. Returns None if not found.
    """
    listing = db.get(Listing, listing_id)
    if listing is None:
        return None
    return _enrich(listing)


def list_listings(
    db: Session,
    *,
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,   # rupees
    max_price: Optional[float] = None,   # rupees
    closing_soon: bool = False,
    status: str = "active",
    skip: int = 0,
    limit: int = 50,
) -> list[dict]:
    """
    Browse listings with optional filters.

    closing_soon: items whose closes_at is within the next 24 hours.
    min/max_price: compared against starting_price_paise (converted to paise).
    """
    from sqlalchemy import select, or_
    from datetime import timedelta

    stmt = select(Listing).where(Listing.status == status)

    if keyword:
        kw = f"%{keyword.strip().lower()}%"
        stmt = stmt.where(
            or_(
                Listing.title.ilike(kw),
                Listing.description.ilike(kw),
            )
        )

    if category:
        stmt = stmt.where(Listing.category == category)

    if condition:
        stmt = stmt.where(Listing.condition == condition)

    if min_price is not None:
        stmt = stmt.where(Listing.starting_price_paise >= rupees_to_paise(min_price))

    if max_price is not None:
        stmt = stmt.where(Listing.starting_price_paise <= rupees_to_paise(max_price))

    if closing_soon:
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=24)
        stmt = stmt.where(Listing.closes_at >= now).where(Listing.closes_at <= cutoff)

    stmt = stmt.order_by(Listing.closes_at.asc()).offset(skip).limit(limit)

    listings = db.execute(stmt).scalars().all()
    return [_enrich(lst) for lst in listings]


def update_listing(
    db: Session, listing_id: int, seller_id: int, payload: ListingUpdate
) -> Optional[dict]:
    """
    Edit an active listing.
    Business rules:
      - Only the seller can edit their own listing (seller_id check).
      - Only 'active' listings can be edited (closed/cancelled are immutable).
      - Phase 1B will add: cannot edit starting_price if bids exist.

    Returns updated dict, or None if listing not found.
    Raises ValueError for authorization/state violations.
    """
    listing = db.get(Listing, listing_id)
    if listing is None:
        return None

    if listing.seller_id != seller_id:
        raise PermissionError("You can only edit your own listings")

    if listing.status != "active":
        raise ValueError(f"Cannot edit a listing with status '{listing.status}'")

    # Apply only the fields the client sent (partial update)
    update_data = payload.model_dump(exclude_none=True)

    if "starting_price" in update_data:
        listing.starting_price_paise = rupees_to_paise(update_data.pop("starting_price"))

    if "min_bid_increment" in update_data:
        listing.min_bid_increment_paise = rupees_to_paise(
            update_data.pop("min_bid_increment")
        )

    for field, value in update_data.items():
        setattr(listing, field, value)

    listing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(listing)
    return _enrich(listing)


def cancel_listing(db: Session, listing_id: int, seller_id: int) -> Optional[dict]:
    """
    Soft-cancel a listing (sets status='cancelled').
    Hard-delete is never used — preserves audit trail.

    Returns updated dict, or None if not found.
    Raises PermissionError or ValueError for invalid actions.
    """
    listing = db.get(Listing, listing_id)
    if listing is None:
        return None

    if listing.seller_id != seller_id:
        raise PermissionError("You can only cancel your own listings")

    if listing.status == "cancelled":
        raise ValueError("Listing is already cancelled")

    if listing.status == "closed":
        raise ValueError("Cannot cancel a listing that has already closed")

    listing.status = "cancelled"
    listing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(listing)
    return _enrich(listing)
