"""
api/listings.py — HTTP route handlers for listing management.

Changes from Phase 1A:
  - seller_id is NO LONGER accepted in request body or query params.
  - Seller identity is derived from the JWT token via get_current_user().
  - ListingRead now includes seller_display_name ("Pramod K (23ALR070)").
  - Edit and cancel endpoints use the authenticated user, not a raw seller_id param.
  - Browse (GET /api/listings) is PUBLIC — no auth required.
  - Create, edit, cancel require authentication.
"""

from collections.abc import Generator
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..database import SessionLocal
from ..models import User
from ..schemas import ListingCreate, ListingListItem, ListingRead, ListingUpdate
from ..services import listing_service

router = APIRouter(prefix="/api/listings", tags=["listings"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ListingRead, status_code=201)
def create_listing(
    payload: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new auction listing.
    Seller identity comes from the JWT token — NOT from the request body.
    The authenticated user automatically becomes the seller.
    """
    result = listing_service.create_listing(db, payload, seller_id=current_user.id)
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
    status: Optional[str] = Query(default="all", description="Filter by status: 'active', 'closed', 'all'"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """
    Browse listings — PUBLIC endpoint (no auth required).
    Returns active and closed lots (excluding cancelled lots) by default.
    Results sorted by closing time ascending.
    """
    return listing_service.list_listings(
        db,
        keyword=keyword,
        category=category,
        condition=condition,
        min_price=min_price,
        max_price=max_price,
        closing_soon=closing_soon,
        status=status,
        skip=skip,
        limit=limit,
    )


@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    """
    Fetch full details for a single listing — PUBLIC endpoint.
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Partially update an active listing.
    The authenticated user must be the seller of this listing.
    """
    try:
        result = listing_service.update_listing(
            db, listing_id, seller_id=current_user.id, payload=payload
        )
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-cancel a listing.
    The authenticated user must be the seller of this listing.
    """
    try:
        result = listing_service.cancel_listing(
            db, listing_id, seller_id=current_user.id
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return result
