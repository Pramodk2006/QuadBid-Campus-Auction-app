"""
test_sales.py — Comprehensive tests for Phase 4: Closing & Sale Lifecycle.

Test categories:
  1. Automatic close & provisional winner determination:
     - 0 bids -> 'unsold'
     - Valid bids -> 'pending_approval' with correct winner
  2. Seller decision:
     - Approval: generates handshake code, reserves lot
     - Rejection: terminal state 'rejected'
     - Permission check: only seller can approve/reject (403)
  3. Campus handover confirmation:
     - In-person verification code exchange -> 'completed'
     - Code mismatch rejection (400)
     - Non-participant authorization rejection (403)
  4. Exceptional outcomes:
     - Failed pickup
     - Seller cancellation after approval
"""

from datetime import datetime, timedelta, timezone
import pytest
from .conftest import VALID_LISTING


def _create_expired_listing(auth_client, db_session, **overrides):
    """Helper to create a listing whose closing deadline has already passed."""
    from app.models import Listing

    listing = auth_client.post("/api/listings", json={**VALID_LISTING, **overrides}).json()
    lid = listing["id"]

    # Backdate closes_at in the database
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    db_listing = db_session.get(Listing, lid)
    db_listing.closes_at = past
    db_session.commit()
    return lid


class TestAuctionResolution:

    def test_outcome_none_while_auction_active(self, auth_client, client):
        """Active lot before deadline returns None (no outcome yet)."""
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        resp = client.get(f"/api/listings/{lid}/outcome")
        assert resp.status_code == 200
        assert resp.json() is None

    def test_outcome_unsold_when_zero_bids(self, auth_client, db_session, client):
        """Auction passes deadline with 0 bids -> status: 'unsold'."""
        lid = _create_expired_listing(auth_client, db_session)

        resp = client.get(f"/api/listings/{lid}/outcome")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "unsold"
        assert data["winner_id"] is None
        assert data["final_price"] == 0.0

    def test_outcome_pending_approval_with_bids(
        self, auth_client, auth_client_2, auth_client_3, db_session, client
    ):
        """Auction passes deadline with bids -> provisional winner determined."""
        # 1. Create active listing
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]

        # 2. Place bids: User 2 bids ₹250, User 3 bids ₹290
        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})
        auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 290.0})

        # 3. Fast-forward past deadline
        from app.models import Listing
        past = datetime.now(timezone.utc) - timedelta(minutes=5)
        db_listing = db_session.get(Listing, lid)
        db_listing.closes_at = past
        db_session.commit()

        # 4. Check outcome
        resp = client.get(f"/api/listings/{lid}/outcome")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending_approval"
        assert data["final_price"] == 290.0
        assert data["winner_display_name"] == "Karthik M (22ITR012)"


class TestSellerApprovalAndRejection:

    def _setup_pending_auction(self, auth_client, auth_client_2, db_session):
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]
        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})

        from app.models import Listing
        db_listing = db_session.get(Listing, lid)
        db_listing.closes_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db_session.commit()
        return lid

    def test_seller_approves_sale(self, auth_client, auth_client_2, db_session):
        """Seller approves winning price -> status becomes 'approved', handshake code generated."""
        lid = self._setup_pending_auction(auth_client, auth_client_2, db_session)

        resp = auth_client.post(
            f"/api/listings/{lid}/approve",
            json={
                "handover_location": "Hostel 4 Ground Floor Common Room",
                "seller_notes": "Call me upon arrival",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"
        assert data["handover_code"].startswith("QUAD-")
        assert data["handover_location"] == "Hostel 4 Ground Floor Common Room"
        assert data["decided_at"] is not None

    def test_non_seller_cannot_approve(self, auth_client, auth_client_2, auth_client_3, db_session):
        """Buyer or other student cannot approve the sale (403)."""
        lid = self._setup_pending_auction(auth_client, auth_client_2, db_session)

        resp = auth_client_2.post(f"/api/listings/{lid}/approve", json={})
        assert resp.status_code == 403

    def test_seller_rejects_sale(self, auth_client, auth_client_2, db_session):
        """Seller rejects winning price -> status becomes 'rejected'."""
        lid = self._setup_pending_auction(auth_client, auth_client_2, db_session)

        resp = auth_client.post(
            f"/api/listings/{lid}/reject",
            json={"reason": "Below acceptable personal reserve price"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert "Below acceptable" in data["seller_notes"]


class TestHandoverConfirmation:

    def _setup_approved_sale(self, auth_client, auth_client_2, db_session):
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]
        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})

        from app.models import Listing
        db_listing = db_session.get(Listing, lid)
        db_listing.closes_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db_session.commit()

        approval = auth_client.post(f"/api/listings/{lid}/approve", json={}).json()
        return lid, approval["handover_code"]

    def test_winner_confirms_handover_with_matching_code(
        self, auth_client, auth_client_2, db_session
    ):
        """Buyer meets seller, enters the handshake code -> status becomes 'completed'."""
        lid, code = self._setup_approved_sale(auth_client, auth_client_2, db_session)

        resp = auth_client_2.post(f"/api/listings/{lid}/handover", json={"handover_code": code})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["completed_at"] is not None

    def test_handover_code_mismatch_rejected(self, auth_client, auth_client_2, db_session):
        """Wrong code is rejected with 400."""
        lid, _ = self._setup_approved_sale(auth_client, auth_client_2, db_session)

        resp = auth_client_2.post(
            f"/api/listings/{lid}/handover", json={"handover_code": "QUAD-0000"}
        )
        assert resp.status_code == 400
        assert "Invalid handshake verification code" in resp.json()["detail"]

    def test_unrelated_student_cannot_confirm_handover(
        self, auth_client, auth_client_2, auth_client_3, db_session
    ):
        """Student 3 (neither buyer nor seller) cannot submit handover confirmation (403)."""
        lid, code = self._setup_approved_sale(auth_client, auth_client_2, db_session)

        resp = auth_client_3.post(f"/api/listings/{lid}/handover", json={"handover_code": code})
        assert resp.status_code == 403


class TestReportIssue:

    def test_report_failed_pickup(self, auth_client, auth_client_2, db_session):
        listing = auth_client.post("/api/listings", json=VALID_LISTING).json()
        lid = listing["id"]
        auth_client_2.post(f"/api/listings/{lid}/bids", json={"amount": 250.0})

        from app.models import Listing
        db_listing = db_session.get(Listing, lid)
        db_listing.closes_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db_session.commit()
        auth_client.post(f"/api/listings/{lid}/approve", json={})

        resp = auth_client.post(
            f"/api/listings/{lid}/report-issue",
            json={"issue_type": "failed_pickup", "reason": "Buyer did not show up in quad"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "failed_pickup"
