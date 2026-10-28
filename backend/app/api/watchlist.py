"""
api/watchlist.py — Endpoints for Watchlists and Saved-Search Alerts (Phase 7).
"""

from collections.abc import Generator
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..database import SessionLocal
from ..models import User, Listing, WatchlistItem, SavedSearch
from ..schemas import WatchlistRead, SavedSearchCreate, SavedSearchRead
from ..services.listing_service import _enrich, rupees_to_paise, paise_to_rupees

router = APIRouter(tags=["watchlist"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Watchlist Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/watchlist/{listing_id}", status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an auction lot to the student's watchlist."""
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    existing = db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.listing_id == listing_id,
        )
    ).scalar_one_or_none()

    if existing:
        return {"status": "ok", "message": "Already in watchlist"}

    item = WatchlistItem(user_id=current_user.id, listing_id=listing_id)
    db.add(item)
    db.commit()
    return {"status": "ok", "message": "Added to watchlist"}


@router.delete("/api/watchlist/{listing_id}", status_code=status.HTTP_200_OK)
def remove_from_watchlist(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an auction lot from the student's watchlist."""
    item = db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.listing_id == listing_id,
        )
    ).scalar_one_or_none()

    if item:
        db.delete(item)
        db.commit()

    return {"status": "ok", "message": "Removed from watchlist"}


@router.get("/api/watchlist", response_model=list[WatchlistRead])
def get_watchlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch all watched lots for the authenticated student."""
    items = db.execute(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == current_user.id)
        .order_by(WatchlistItem.created_at.desc())
    ).scalars().all()

    result = []
    for it in items:
        listing = db.get(Listing, it.listing_id)
        if listing and listing.status != "cancelled":
            enriched_listing = _enrich(listing, db)
            result.append({
                "id": it.id,
                "listing_id": it.listing_id,
                "listing": enriched_listing,
                "created_at": it.created_at,
            })
    return result


# ---------------------------------------------------------------------------
# Saved Search Alerts Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/saved-searches", response_model=SavedSearchRead, status_code=status.HTTP_201_CREATED)
def create_saved_search(
    payload: SavedSearchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a search query to receive automatic lot alerts."""
    paise = rupees_to_paise(payload.max_price) if payload.max_price is not None else None
    search = SavedSearch(
        user_id=current_user.id,
        query=payload.query.strip().lower(),
        category=payload.category,
        max_price_paise=paise,
    )
    db.add(search)
    db.commit()
    db.refresh(search)
    return {
        "id": search.id,
        "query": search.query,
        "category": search.category,
        "max_price": paise_to_rupees(search.max_price_paise) if search.max_price_paise else None,
        "created_at": search.created_at,
    }


@router.get("/api/saved-searches", response_model=list[SavedSearchRead])
def get_saved_searches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active saved search alerts for the authenticated student."""
    searches = db.execute(
        select(SavedSearch)
        .where(SavedSearch.user_id == current_user.id)
        .order_by(SavedSearch.created_at.desc())
    ).scalars().all()

    return [
        {
            "id": s.id,
            "query": s.query,
            "category": s.category,
            "max_price": paise_to_rupees(s.max_price_paise) if s.max_price_paise else None,
            "created_at": s.created_at,
        }
        for s in searches
    ]


@router.delete("/api/saved-searches/{search_id}", status_code=status.HTTP_200_OK)
def delete_saved_search(
    search_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved search alert."""
    search = db.get(SavedSearch, search_id)
    if search and search.user_id == current_user.id:
        db.delete(search)
        db.commit()
    return {"status": "ok", "message": "Alert deleted"}
