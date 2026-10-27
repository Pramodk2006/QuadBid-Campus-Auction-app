"""
services/listing_service.py — Pure business logic for listing management.

Changes from Phase 1A:
  - create_listing() now takes explicit seller_id (set by the route from JWT).
  - _enrich() now queries the seller's User record to include seller_display_name
    ("Pramod K (23ALR070)") in every response dict.
  - No HTTP or auth logic here — that stays in api/listings.py.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import Listing, User
from ..schemas import ListingCreate, ListingUpdate


# ---------------------------------------------------------------------------
# Money helpers
# ---------------------------------------------------------------------------

def rupees_to_paise(rupees: float) -> int:
    return round(rupees * 100)


def paise_to_rupees(paise: int) -> float:
    return paise / 100


# ---------------------------------------------------------------------------
# Response helper — converts ORM → dict with rupees + seller display name
# ---------------------------------------------------------------------------

def _enrich(listing: Listing, db: Session) -> dict:
    """
    Build a response dict from a Listing ORM object.

    Why fetch the seller here instead of using listing.seller directly?
    SQLAlchemy lazy-loads relationships by default. If the session that loaded
    the listing is already closed, accessing listing.seller raises DetachedInstanceError.
    Fetching explicitly by ID is safe regardless of session state.
    """
    seller = db.get(User, listing.seller_id)
    seller_display_name = seller.display_name if seller else f"User #{listing.seller_id}"

    return {
        "id": listing.id,
        "seller_id": listing.seller_id,
        "seller_display_name": seller_display_name,
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

def create_listing(db: Session, payload: ListingCreate, seller_id: int) -> dict:
    """
    Persist a new listing.
    seller_id is provided by the route handler (extracted from JWT token).
    """
    listing = Listing(
        seller_id=seller_id,
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
    return _enrich(listing, db)


def get_listing(db: Session, listing_id: int) -> Optional[dict]:
    listing = db.get(Listing, listing_id)
    if listing is None:
        return None
    return _enrich(listing, db)


def list_listings(
    db: Session,
    *,
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    closing_soon: bool = False,
    status: str = "active",
    skip: int = 0,
    limit: int = 50,
) -> list[dict]:
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
    return [_enrich(lst, db) for lst in listings]


def update_listing(
    db: Session, listing_id: int, seller_id: int, payload: ListingUpdate
) -> Optional[dict]:
    """
    Edit an active listing. Only the owning seller can edit.
    """
    listing = db.get(Listing, listing_id)
    if listing is None:
        return None

    if listing.seller_id != seller_id:
        raise PermissionError("You can only edit your own listings")

    if listing.status != "active":
        raise ValueError(f"Cannot edit a listing with status '{listing.status}'")

    update_data = payload.model_dump(exclude_none=True)

    if "starting_price" in update_data:
        listing.starting_price_paise = rupees_to_paise(update_data.pop("starting_price"))

    if "min_bid_increment" in update_data:
        listing.min_bid_increment_paise = rupees_to_paise(update_data.pop("min_bid_increment"))

    for field, value in update_data.items():
        setattr(listing, field, value)

    listing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(listing)
    return _enrich(listing, db)


def cancel_listing(db: Session, listing_id: int, seller_id: int) -> Optional[dict]:
    """
    Soft-cancel a listing. Only the owning seller can cancel.
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
    return _enrich(listing, db)
