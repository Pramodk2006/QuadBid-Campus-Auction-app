"""
services/bidding_service.py — Core bidding engine business logic.

Enforces all auction fairness rules:
  1. Authoritative server clock:
     - Deadlines are always evaluated against server-side UTC time.
     - Expired auctions reject bids immediately and transition status to 'closed'.
  2. Incremental validation:
     - First bid must be >= starting price.
     - Subsequent bids must be >= current_highest_bid + min_bid_increment.
  3. Shill bidding prevention:
     - A seller can never bid on their own listing (raises PermissionError).
  4. Anti-sniping dynamic extension:
     - If a valid bid arrives in the final 30 seconds of an auction,
       closes_at is automatically extended to now + 60 seconds.
  5. Immutable audit log:
     - Every accepted bid is recorded permanently.
     - Prices are computed and stored in integer paise.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Bid, Listing, User
from .listing_service import paise_to_rupees, rupees_to_paise


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure a datetime object is timezone-aware and set to UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def check_and_close_if_expired(db: Session, listing: Listing) -> bool:
    """
    Checks if an active listing's deadline has passed.
    If expired, marks status as 'closed' in the database.
    Returns True if the auction is now closed, False if still active.
    """
    now = datetime.now(timezone.utc)
    closes_at = _ensure_utc(listing.closes_at)

    if listing.status == "active" and now >= closes_at:
        listing.status = "closed"
        listing.updated_at = now
        db.commit()
        db.refresh(listing)
        return True

    return listing.status != "active"


def place_bid(
    db: Session,
    listing_id: int,
    bidder: User,
    amount_rupees: float,
) -> dict:
    """
    Submit and validate a bid on an auction.

    Executes inside a database transaction:
      1. Locks the listing row (with_for_update) to serialize concurrent bids.
      2. Validates seller != bidder.
      3. Validates auction is active and deadline hasn't elapsed.
      4. Fetches current highest bid and calculates min acceptable bid.
      5. Checks for anti-sniping extension (<= 30s remaining -> extends by 60s).
      6. Inserts immutable bid record.
    """
    # 1. Fetch listing with row lock
    stmt = select(Listing).where(Listing.id == listing_id).with_for_update()
    listing = db.execute(stmt).scalar_one_or_none()

    if listing is None:
        raise ValueError("Listing not found")

    # 2. Prevent seller from bidding on own item
    if listing.seller_id == bidder.id:
        raise PermissionError("Sellers are not permitted to bid on their own listings")

    # 3. Check auction lifecycle & deadline with authoritative server time
    now = datetime.now(timezone.utc)
    closes_at = _ensure_utc(listing.closes_at)

    if listing.status == "cancelled":
        raise ValueError("Cannot bid on a cancelled listing")

    if listing.status == "closed" or now >= closes_at:
        if listing.status == "active":
            listing.status = "closed"
            listing.updated_at = now
            db.commit()
        raise ValueError("This auction has already closed")

    if listing.status != "active":
        raise ValueError(f"Cannot bid on a listing with status '{listing.status}'")

    # 4. Fetch the current highest bid
    highest_bid_stmt = (
        select(Bid)
        .where(Bid.listing_id == listing_id)
        .order_by(Bid.amount_paise.desc(), Bid.created_at.asc())
        .limit(1)
    )
    current_highest = db.execute(highest_bid_stmt).scalar_one_or_none()

    # 5. Calculate required minimum bid
    if current_highest is None:
        min_required_paise = listing.starting_price_paise
    else:
        min_required_paise = current_highest.amount_paise + listing.min_bid_increment_paise

    proposed_paise = rupees_to_paise(amount_rupees)

    if proposed_paise < min_required_paise:
        min_req_rupees = paise_to_rupees(min_required_paise)
        if current_highest is None:
            raise ValueError(
                f"First bid must be at least the starting price of ₹{min_req_rupees:,.2f}"
            )
        else:
            raise ValueError(
                f"Bid must be at least ₹{min_req_rupees:,.2f} "
                f"(current leading bid ₹{paise_to_rupees(current_highest.amount_paise):,.2f} "
                f"+ increment ₹{paise_to_rupees(listing.min_bid_increment_paise):,.2f})"
            )

    # 6. Anti-sniping dynamic extension
    # If bid arrives in the last 30 seconds of the auction,
    # the closing time moves to 60 seconds after that bid.
    time_left_seconds = (closes_at - now).total_seconds()
    was_extended = False

    if 0 <= time_left_seconds <= 30.0:
        new_closing_time = now + timedelta(seconds=60)
        listing.closes_at = new_closing_time
        listing.updated_at = now
        was_extended = True

    # 7. Insert the accepted bid
    bid = Bid(
        listing_id=listing_id,
        bidder_id=bidder.id,
        amount_paise=proposed_paise,
        created_at=now,
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)
    db.refresh(listing)

    message = "Bid placed successfully"
    if was_extended:
        message = (
            "Bid placed in final 30 seconds! "
            f"Auction extended to {listing.closes_at.strftime('%H:%M:%S UTC')}."
        )

    return {
        "bid": {
            "id": bid.id,
            "listing_id": bid.listing_id,
            "bidder_id": bid.bidder_id,
            "bidder_display_name": bidder.display_name,
            "amount": paise_to_rupees(bid.amount_paise),
            "created_at": bid.created_at,
        },
        "extended": was_extended,
        "new_closes_at": listing.closes_at,
        "message": message,
    }


def get_bid_history(db: Session, listing_id: int) -> list[dict]:
    """
    Return the public bid history for an auction lot.
    Ordered by bid amount descending (or creation time descending).
    """
    stmt = (
        select(Bid)
        .where(Bid.listing_id == listing_id)
        .order_by(Bid.created_at.desc(), Bid.amount_paise.desc())
    )
    bids = db.execute(stmt).scalars().all()

    results = []
    for b in bids:
        bidder = db.get(User, b.bidder_id)
        bidder_display_name = bidder.display_name if bidder else f"User #{b.bidder_id}"
        results.append({
            "id": b.id,
            "listing_id": b.listing_id,
            "bidder_id": b.bidder_id,
            "bidder_display_name": bidder_display_name,
            "amount": paise_to_rupees(b.amount_paise),
            "created_at": b.created_at,
        })
    return results


def get_auction_leader(db: Session, listing_id: int) -> dict:
    """
    Return the current leading bid and status for an auction.
    """
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise ValueError("Listing not found")

    is_closed = check_and_close_if_expired(db, listing)

    # Fetch top bid
    top_bid_stmt = (
        select(Bid)
        .where(Bid.listing_id == listing_id)
        .order_by(Bid.amount_paise.desc(), Bid.created_at.asc())
        .limit(1)
    )
    top_bid = db.execute(top_bid_stmt).scalar_one_or_none()

    # Count bids
    count_stmt = select(func.count(Bid.id)).where(Bid.listing_id == listing_id)
    bid_count = db.execute(count_stmt).scalar_one()

    if top_bid is not None:
        leading_bidder = db.get(User, top_bid.bidder_id)
        leader_name = leading_bidder.display_name if leading_bidder else f"User #{top_bid.bidder_id}"
        current_price = paise_to_rupees(top_bid.amount_paise)
        min_next_bid = paise_to_rupees(top_bid.amount_paise + listing.min_bid_increment_paise)
        has_bids = True
        leading_bidder_id = top_bid.bidder_id
        leading_bid_time = top_bid.created_at
    else:
        current_price = paise_to_rupees(listing.starting_price_paise)
        min_next_bid = current_price
        has_bids = False
        leading_bidder_id = None
        leader_name = None
        leading_bid_time = None

    return {
        "listing_id": listing.id,
        "status": listing.status,
        "has_bids": has_bids,
        "current_price": current_price,
        "min_next_bid": min_next_bid,
        "bid_count": bid_count,
        "leading_bidder_id": leading_bidder_id,
        "leading_bidder_display_name": leader_name,
        "leading_bid_time": leading_bid_time,
        "closes_at": listing.closes_at,
        "is_closed": is_closed,
    }
