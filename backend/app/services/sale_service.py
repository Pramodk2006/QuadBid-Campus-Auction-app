"""
services/sale_service.py — Lifecycle management for auction close, seller decision,
and campus handover confirmation.

Rules:
  1. Once closing time passes, the auction closes.
  2. If 0 bids: marked 'unsold'.
  3. If bids exist: highest bid becomes 'pending_approval' with a provisional winner.
  4. Seller decision:
     - Approve: reserves item for winner, generates 4-digit campus handshake code.
     - Reject: records rejection outcome.
  5. Handover confirmation:
     - In-person verification: parties meet in quad/common room and exchange the handshake code.
     - Submitting the matching code transitions outcome to 'completed'.
  6. Exceptional cases:
     - 'seller_cancelled' or 'failed_pickup' recorded with clear audit trail.
"""

from datetime import datetime, timezone
import secrets
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Bid, Listing, SaleOutcome, User
from .listing_service import paise_to_rupees


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def enrich_outcome(outcome: SaleOutcome, db: Session) -> dict:
    """Format SaleOutcome with rupee prices and display names."""
    seller = db.get(User, outcome.seller_id)
    winner = db.get(User, outcome.winner_id) if outcome.winner_id else None

    seller_name = seller.display_name if seller else f"User #{outcome.seller_id}"
    winner_name = winner.display_name if winner else None

    return {
        "id": outcome.id,
        "listing_id": outcome.listing_id,
        "winning_bid_id": outcome.winning_bid_id,
        "winner_id": outcome.winner_id,
        "winner_display_name": winner_name,
        "seller_id": outcome.seller_id,
        "seller_display_name": seller_name,
        "final_price": paise_to_rupees(outcome.final_price_paise),
        "status": outcome.status,
        "handover_code": outcome.handover_code,
        "handover_location": outcome.handover_location,
        "seller_notes": outcome.seller_notes,
        "decided_at": outcome.decided_at,
        "completed_at": outcome.completed_at,
        "created_at": outcome.created_at,
    }


def get_or_create_outcome(db: Session, listing_id: int) -> Optional[dict]:
    """
    Check auction deadline and return or initialize the SaleOutcome.
    If the auction is still active and deadline hasn't elapsed, returns None.
    """
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise ValueError("Listing not found")

    now = datetime.now(timezone.utc)
    closes_at = _ensure_utc(listing.closes_at)

    # Check if existing outcome is already recorded
    existing_outcome = (
        db.execute(select(SaleOutcome).where(SaleOutcome.listing_id == listing_id))
        .scalars()
        .first()
    )
    if existing_outcome:
        return enrich_outcome(existing_outcome, db)

    # If auction is cancelled, outcome is cancelled
    if listing.status == "cancelled":
        outcome = SaleOutcome(
            listing_id=listing.id,
            seller_id=listing.seller_id,
            final_price_paise=0,
            status="seller_cancelled",
            seller_notes="Listing cancelled by seller prior to closing",
            decided_at=listing.updated_at or now,
        )
        db.add(outcome)
        db.commit()
        db.refresh(outcome)
        return enrich_outcome(outcome, db)

    # If auction is still active and deadline has not arrived, no outcome yet
    if listing.status == "active" and now < closes_at:
        return None

    # Auction has ended — mark listing status closed if not already
    if listing.status == "active":
        listing.status = "closed"
        listing.updated_at = now

    # Determine highest valid bid
    top_bid = (
        db.execute(
            select(Bid)
            .where(Bid.listing_id == listing_id)
            .order_by(Bid.amount_paise.desc(), Bid.created_at.asc())
            .limit(1)
        )
        .scalars()
        .first()
    )

    if top_bid is None:
        # Zero bids -> marked unsold
        outcome = SaleOutcome(
            listing_id=listing.id,
            seller_id=listing.seller_id,
            final_price_paise=0,
            status="unsold",
            decided_at=now,
        )
    else:
        # Valid leading bid -> awaiting seller approval
        outcome = SaleOutcome(
            listing_id=listing.id,
            winning_bid_id=top_bid.id,
            winner_id=top_bid.bidder_id,
            seller_id=listing.seller_id,
            final_price_paise=top_bid.amount_paise,
            status="pending_approval",
        )

    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return enrich_outcome(outcome, db)


def approve_sale(
    db: Session,
    listing_id: int,
    seller_id: int,
    handover_location: Optional[str] = None,
    seller_notes: Optional[str] = None,
) -> dict:
    """
    Seller approves the winning bid.
    Reserves item for provisional winner and generates campus handshake code.
    """
    outcome_dict = get_or_create_outcome(db, listing_id)
    if not outcome_dict:
        raise ValueError("Cannot decide on an active auction that has not closed yet")

    outcome = (
        db.execute(select(SaleOutcome).where(SaleOutcome.listing_id == listing_id))
        .scalars()
        .first()
    )

    if outcome.seller_id != seller_id:
        raise PermissionError("Only the seller can approve the auction sale")

    if outcome.status != "pending_approval":
        raise ValueError(f"Cannot approve sale with status '{outcome.status}'")

    now = datetime.now(timezone.utc)
    # Generate 4-digit campus handshake code e.g. "QUAD-4912"
    handshake_code = f"QUAD-{secrets.randbelow(9000) + 1000}"

    outcome.status = "approved"
    outcome.handover_code = handshake_code
    if handover_location:
        outcome.handover_location = handover_location
    if seller_notes:
        outcome.seller_notes = seller_notes
    outcome.decided_at = now
    outcome.updated_at = now

    db.commit()
    db.refresh(outcome)
    return enrich_outcome(outcome, db)


def reject_sale(
    db: Session,
    listing_id: int,
    seller_id: int,
    reason: Optional[str] = None,
) -> dict:
    """
    Seller rejects the provisional winning price.
    """
    outcome_dict = get_or_create_outcome(db, listing_id)
    if not outcome_dict:
        raise ValueError("Cannot decide on an auction that has not closed yet")

    outcome = (
        db.execute(select(SaleOutcome).where(SaleOutcome.listing_id == listing_id))
        .scalars()
        .first()
    )

    if outcome.seller_id != seller_id:
        raise PermissionError("Only the seller can reject the auction sale")

    if outcome.status != "pending_approval":
        raise ValueError(f"Cannot reject sale with status '{outcome.status}'")

    now = datetime.now(timezone.utc)
    outcome.status = "rejected"
    outcome.seller_notes = reason or "Winning price rejected by seller"
    outcome.decided_at = now
    outcome.updated_at = now

    db.commit()
    db.refresh(outcome)
    return enrich_outcome(outcome, db)


def confirm_handover(
    db: Session,
    listing_id: int,
    user_id: int,
    handover_code: str,
) -> dict:
    """
    Verify the in-person campus handshake code to complete the sale.
    Can be confirmed by either the seller or the provisional winner.
    """
    outcome = (
        db.execute(select(SaleOutcome).where(SaleOutcome.listing_id == listing_id))
        .scalars()
        .first()
    )
    if not outcome:
        raise ValueError("Sale outcome not found")

    if user_id not in (outcome.seller_id, outcome.winner_id):
        raise PermissionError("Only the seller or buyer can confirm campus handover")

    if outcome.status != "approved":
        raise ValueError(f"Cannot complete handover for auction with status '{outcome.status}'")

    submitted_code = handover_code.strip().upper()
    actual_code = (outcome.handover_code or "").strip().upper()

    if submitted_code != actual_code:
        raise ValueError("Invalid handshake verification code")

    now = datetime.now(timezone.utc)
    outcome.status = "completed"
    outcome.completed_at = now
    outcome.updated_at = now

    db.commit()
    db.refresh(outcome)
    return enrich_outcome(outcome, db)


def report_issue(
    db: Session,
    listing_id: int,
    user_id: int,
    issue_type: str,
    reason: Optional[str] = None,
) -> dict:
    """
    Report failed pickup or seller cancellation after initial approval.
    """
    outcome = (
        db.execute(select(SaleOutcome).where(SaleOutcome.listing_id == listing_id))
        .scalars()
        .first()
    )
    if not outcome:
        raise ValueError("Sale outcome not found")

    if user_id not in (outcome.seller_id, outcome.winner_id):
        raise PermissionError("Only the seller or buyer can report handover issues")

    if outcome.status not in ("approved", "pending_approval"):
        raise ValueError(f"Cannot report issue on status '{outcome.status}'")

    now = datetime.now(timezone.utc)
    outcome.status = issue_type # 'failed_pickup' or 'seller_cancelled'
    outcome.seller_notes = reason or f"Issue recorded: {issue_type}"
    outcome.updated_at = now

    db.commit()
    db.refresh(outcome)
    return enrich_outcome(outcome, db)
