"""
test_bids.py — Comprehensive tests for Phase 1B: Bidding Engine.

Test categories:
  1. Happy path: valid bids, increment enforcement, leader tracking
  2. Rule enforcement:
     - Seller self-bidding prevention (403)
     - Below starting price rejection (400)
     - Below minimum increment rejection (400)
     - Expired deadline rejection (400)
     - Cancelled auction rejection (400)
  3. Anti-sniping:
     - Final 30-second bid triggers 60-second extension
     - Early bids do NOT trigger extension
  4. Public transparency & audit trail:
     - Public bid history contains Name (RollNo)
     - Immutability of accepted bids
  5. Listing protection:
     - Seller cannot modify price or increment once bids exist
"""

from datetime import datetime, timedelta, timezone
import pytest
from .conftest import VALID_LISTING


class TestPlaceBid:

    def test_valid_first_bid_at_starting_price(self, auth_client, auth_client_2):
        """User 1 lists item (₹250); User 2 places first bid of ₹250.00 -> 201."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 201
        data = resp.json()
        assert data["bid"]["amount"] == 250.0
        assert data["bid"]["bidder_display_name"] == "Ravi S (21CSE045)"
        assert data["extended"] is False

    def test_valid_first_bid_above_starting_price(self, auth_client, auth_client_2):
        """User 2 places first bid of ₹300 (above starting price ₹250) -> 201."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 300.0})
        assert resp.status_code == 201
        assert resp.json()["bid"]["amount"] == 300.0

    def test_first_bid_below_starting_price_rejected(self, auth_client, auth_client_2):
        """Starting price ₹250. Bid ₹240 -> rejected with 400."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 240.0})
        assert resp.status_code == 400
        assert "starting price" in resp.json()["detail"].lower()

    def test_valid_subsequent_bid_with_minimum_increment(
        self, auth_client, auth_client_2, auth_client_3
    ):
        """
        Starting price ₹250, increment ₹20.
        User 2 bids ₹250.
        User 3 bids ₹270 -> accepted.
        User 2 bids ₹310 -> accepted.
        """
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        r2 = auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 270.0})
        assert r2.status_code == 201
        assert r2.json()["bid"]["amount"] == 270.0
        assert r2.json()["bid"]["bidder_display_name"] == "Karthik M (22ITR012)"

        r3 = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 310.0})
        assert r3.status_code == 201
        assert r3.json()["bid"]["amount"] == 310.0

    def test_subsequent_bid_below_increment_rejected(self, auth_client, auth_client_2, auth_client_3):
        """
        User 2 bids ₹250. Increment is ₹20.
        User 3 bids ₹260 (only +₹10) -> rejected with 400.
        """
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        resp = auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 260.0})
        assert resp.status_code == 400
        assert "must be at least ₹270.00" in resp.json()["detail"]

    def test_seller_cannot_bid_on_own_listing(self, auth_client):
        """User 1 (seller) attempts to bid on User 1's listing -> 403 Forbidden."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = auth_client.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 403
        assert "own listings" in resp.json()["detail"].lower()

    def test_unauthenticated_bid_rejected(self, auth_client, client):
        """Unauthenticated client cannot bid -> 401."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = client.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 401

    def test_bidding_on_nonexistent_listing_returns_404(self, auth_client_2):
        resp = auth_client_2.post("/api/listings/99999/bids", json={"amount": 250.0})
        assert resp.status_code == 404

    def test_bidding_on_cancelled_listing_rejected(self, auth_client, auth_client_2):
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]
        auth_client.delete(f"/api/listings/{lid}")

        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 400
        assert "cancelled" in resp.json()["detail"].lower()


class TestAntiSnipingExtension:

    def test_last_30_seconds_bid_extends_closing_time(self, auth_client, auth_client_2, db_session):
        """
        Anti-sniping rule:
        If a bid arrives when remaining time <= 30 seconds,
        closes_at is moved to now + 60 seconds.
        """
        from app.models import Listing

        # Create listing with deadline 20 seconds from now
        now = datetime.now(timezone.utc)
        soon = (now + timedelta(seconds=20)).isoformat()
        payload = {**VALID_LISTING, "closes_at": soon}
        listing = auth_client.post("/api/listings", json=payload).json()
        lid = listing["id"]

        # Place bid inside the 20s window
        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 201
        data = resp.json()
        assert data["extended"] is True

        # Check DB closing time was extended
        db_listing = db_session.get(Listing, lid)
        extended_deadline = db_listing.closes_at
        if extended_deadline.tzinfo is None:
            extended_deadline = extended_deadline.replace(tzinfo=timezone.utc)

        # Extended deadline should be ~60 seconds in the future
        remaining_now = (extended_deadline - datetime.now(timezone.utc)).total_seconds()
        assert 50 <= remaining_now <= 65

    def test_bid_outside_last_30_seconds_does_not_extend(self, auth_client, auth_client_2):
        """Bidding with 2 hours remaining must NOT trigger extension."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 201
        assert resp.json()["extended"] is False


class TestExpiredAuctionBidding:

    def test_bidding_after_deadline_rejected_and_marks_closed(
        self, auth_client, auth_client_2, db_session
    ):
        """
        If server clock sees closes_at <= now, bid is rejected with 400
        and listing status transitions to 'closed'.
        """
        from app.models import Listing

        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        # Manually backdate the listing's closes_at in the DB
        past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        db_listing = db_session.get(Listing, lid)
        db_listing.closes_at = past_time
        db_session.commit()

        # Bid attempt
        resp = auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        assert resp.status_code == 400
        assert "closed" in resp.json()["detail"].lower()

        # Check status is now 'closed'
        db_session.refresh(db_listing)
        assert db_listing.status == "closed"


class TestBidHistoryAndLeader:

    def test_public_bid_history(self, auth_client, auth_client_2, auth_client_3, client):
        """Public endpoint returns full bid history with student roll number identity."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 280.0})

        resp = client.get(f"/api/listings/{lid}/bids")
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) == 2

        # Check most recent / highest is first
        assert history[0]["amount"] == 280.0
        assert history[0]["bidder_display_name"] == "Karthik M (22ITR012)"

        assert history[1]["amount"] == 250.0
        assert history[1]["bidder_display_name"] == "Ravi S (21CSE045)"

    def test_auction_leader_endpoint_with_bids(
        self, auth_client, auth_client_2, auth_client_3, client
    ):
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 275.0})

        leader_resp = client.get(f"/api/listings/{lid}/leader")
        assert leader_resp.status_code == 200
        data = leader_resp.json()
        assert data["has_bids"] is True
        assert data["current_price"] == 275.0
        assert data["min_next_bid"] == 295.0  # 275 + 20 increment
        assert data["bid_count"] == 2
        assert data["leading_bidder_display_name"] == "Karthik M (22ITR012)"
        assert data["is_closed"] is False

    def test_auction_leader_endpoint_no_bids(self, auth_client, client):
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        leader_resp = client.get(f"/api/listings/{lid}/leader")
        assert leader_resp.status_code == 200
        data = leader_resp.json()
        assert data["has_bids"] is False
        assert data["current_price"] == 250.0
        assert data["min_next_bid"] == 250.0
        assert data["bid_count"] == 0
        assert data["leading_bidder_display_name"] is None


class TestListingProtectionWhenBidsExist:

    def test_seller_cannot_change_price_terms_after_bids_exist(
        self, auth_client, auth_client_2
    ):
        """
        Fairness rule:
        Once any student has placed a bid, the seller cannot alter starting_price
        or min_bid_increment.
        """
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        # Place a valid bid
        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})

        # Seller attempts to increase starting price
        resp = auth_client.patch(f"/api/listings/{lid}", json={"starting_price": 500.0})
        assert resp.status_code == 409
        assert "after bidding has commenced" in resp.json()["detail"]

        # Seller attempts to change bid increment
        resp2 = auth_client.patch(f"/api/listings/{lid}", json={"min_bid_increment": 50.0})
        assert resp2.status_code == 409
        assert "after bidding has commenced" in resp2.json()["detail"]

    def test_seller_can_still_update_description_after_bids_exist(
        self, auth_client, auth_client_2
    ):
        """Seller can clarify description even after bids exist."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})

        resp = auth_client.patch(
            f"/api/listings/{lid}",
            json={"description": "Updated note: includes original charger as well!"},
        )
        assert resp.status_code == 200
        assert "original charger" in resp.json()["description"]

