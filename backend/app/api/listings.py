"""
api/listings.py — HTTP route handlers for listing management.

Route responsibilities:
  - Parse and validate incoming requests (Pydantic does this automatically).
  - Delegate business logic to listing_service.
  - Return correct HTTP status codes and response shapes.
  - Never contain raw SQL or business rules.

Dependency injection:
  - get_db() yields a SQLAlchemy session scoped to each request.
  - FastAPI closes the session automatically after the response is sent.

Temporary (Phase 1 only):
  - seller_id is taken from the request body / query param.
  - Phase 3 will replace this with JWT-based identity extraction.
"""

from collections.abc import Generator
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..schemas import ListingCreate, ListingListItem, ListingRead, ListingUpdate
from ..services import listing_service

router = APIRouter(prefix="/api/listings", tags=["listings"])


# ---------------------------------------------------------------------------
# DB session dependency
# ---------------------------------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """Provide a DB session for a single request, then close it."""
    with SessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ListingRead, status_code=201)
def create_listing(payload: ListingCreate, db: Session = Depends(get_db)):
    """
    Create a new auction listing.

    - Validates all fields via Pydantic before this function runs.
    - Converts rupee prices to paise internally.
    - Returns the persisted listing with its assigned ID.
    """
    result = listing_service.create_listing(db, payload)
    return result


@router.get("", response_model=list[ListingListItem])
def browse_listings(
    db: Session = Depends(get_db),
    keyword: Optional[str] = Query(default=None, description="Search in title/description"),
    category: Optional[str] = Query(default=None),
    condition: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0, description="Min price in ₹"),
    max_price: Optional[float] = Query(default=None, ge=0, description="Max price in ₹"),
    closing_soon: bool = Query(default=False, description="Show items closing in 24h"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """
    Browse active listings with optional filters.

    Returns compact card data (no full description) sorted by closing time ascending
    so the most urgent items appear first.
    """
    return listing_service.list_listings(
        db,
        keyword=keyword,
        category=category,
        condition=condition,
        min_price=min_price,
        max_price=max_price,
        closing_soon=closing_soon,
        skip=skip,
        limit=limit,
    )


@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    """
    Fetch full details for a single listing.
    Returns 404 if the listing does not exist.
    """
    result = listing_service.get_listing(db, listing_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return result


@router.patch("/{listing_id}", response_model=ListingRead)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    # Dev-only: seller_id from query param until auth is added
    seller_id: int = Query(description="Temporary: seller identity for dev testing"),
    db: Session = Depends(get_db),
):
    """
    Partially update an active listing (only the fields provided are changed).

    Rules enforced by the service:
      - Caller must be the seller.
      - Listing must be in 'active' status.
    """
    try:
        result = listing_service.update_listing(db, listing_id, seller_id, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return result


@router.delete("/{listing_id}", response_model=ListingRead)
def cancel_listing(
    listing_id: int,
    # Dev-only: seller_id from query param until auth is added
    seller_id: int = Query(description="Temporary: seller identity for dev testing"),
    db: Session = Depends(get_db),
):
    """
    Soft-cancel a listing (sets status to 'cancelled').
    The record is preserved in the database for audit purposes.
    Returns the cancelled listing with updated status.
    """
    try:
        result = listing_service.cancel_listing(db, listing_id, seller_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return result
