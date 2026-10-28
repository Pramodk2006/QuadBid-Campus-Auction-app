"""
api/bids.py — HTTP route handlers for bidding and auction status.

Endpoints:
  POST /api/listings/{id}/bids   — Place a bid (Authenticated students only)
  GET  /api/listings/{id}/bids   — Show public bid history (Public)
  GET  /api/listings/{id}/leader — Current leading bidder and price (Public)
"""

from collections.abc import Generator

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..core.websocket import manager
from ..database import SessionLocal
from ..models import User, Bid
from ..schemas import AuctionLeader, BidCreate, BidPlacementResult, BidRead
from ..services import bidding_service

router = APIRouter(prefix="/api/listings/{listing_id}", tags=["bids"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


@router.post("/bids", response_model=BidPlacementResult, status_code=status.HTTP_201_CREATED)
async def place_bid(
    listing_id: int,
    payload: BidCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Place a valid bid on an active auction.

    Rules enforced:
      - Authenticated student with verified roll number only.
      - Seller cannot bid on their own item (403).
      - First bid >= starting price.
      - Subsequent bids >= current price + minimum increment.
      - Bids after deadline are rejected (400).
      - Anti-sniping: Bids in last 30s automatically extend auction by 60s.
    """
    try:
        result = bidding_service.place_bid(
            db, listing_id=listing_id, bidder=current_user, amount_rupees=payload.amount
        )

        closes_at_str = (
            result["new_closes_at"].isoformat()
            if hasattr(result["new_closes_at"], "isoformat")
            else str(result["new_closes_at"])
        )
        created_at_str = (
            result["bid"]["created_at"].isoformat()
            if hasattr(result["bid"]["created_at"], "isoformat")
            else str(result["bid"]["created_at"])
        )

        bid_count = db.query(Bid).filter(Bid.listing_id == listing_id).count()

        # Broadcast real-time update to lot room
        await manager.broadcast_listing(listing_id, {
            "type": "NEW_BID",
            "listing_id": listing_id,
            "bid": {
                "id": result["bid"]["id"],
                "amount": result["bid"]["amount"],
                "bidder_id": result["bid"]["bidder_id"],
                "bidder_display_name": result["bid"]["bidder_display_name"],
                "created_at": created_at_str,
            },
            "bid_count": bid_count,
            "closes_at": closes_at_str,
            "extended": result["extended"],
            "message": result["message"],
        })

        # Broadcast to global ticker stream
        await manager.broadcast_global({
            "type": "GLOBAL_BID_TICKER",
            "listing_id": listing_id,
            "amount": result["bid"]["amount"],
            "bidder_display_name": result["bid"]["bidder_display_name"],
            "created_at": created_at_str,
        })

        return result
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.get("/bids", response_model=list[BidRead])
def get_bid_history(listing_id: int, db: Session = Depends(get_db)):
    """
    Public audit trail: View all bids placed on this auction.
    Every bid displays bidder's verified identity 'Name (RollNumber)'.
    """
    return bidding_service.get_bid_history(db, listing_id=listing_id)


@router.get("/leader", response_model=AuctionLeader)
def get_auction_leader(listing_id: int, db: Session = Depends(get_db)):
    """
    Public leader endpoint: Current price, leading bidder, minimum next bid,
    and whether auction has concluded.
    """
    try:
        return bidding_service.get_auction_leader(db, listing_id=listing_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

