"""
test_listings.py — Comprehensive tests for Phase 1A: Listing CRUD.

Test categories:
  1. Happy path    — valid inputs succeed with correct responses
  2. Invalid input — bad data returns 422 Unprocessable Entity
  3. Edge cases    — permission, state, persistence, 404

Coverage targets:
  POST /api/listings
  GET  /api/listings
  GET  /api/listings/{id}
  PATCH /api/listings/{id}
  DELETE /api/listings/{id}
"""

import pytest
from .conftest import FUTURE_DATE, VALID_LISTING


# =============================================================================
# 1. CREATE (POST /api/listings)
# =============================================================================

class TestCreateListing:

    def test_create_valid_listing_returns_201(self, client):
        """Happy path: all valid fields → 201 with assigned ID."""
        response = client.post("/api/listings", json=VALID_LISTING)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 1
        assert data["title"] == "Used scientific calculator"
        assert data["status"] == "active"
        # Prices should come back as rupees (float)
        assert data["starting_price"] == 250.0
        assert data["min_bid_increment"] == 20.0

    def test_create_stores_money_correctly(self, client):
        """Prices should survive a round-trip without floating-point errors."""
        payload = {**VALID_LISTING, "starting_price": 1499.99, "min_bid_increment": 50.5}
        response = client.post("/api/listings", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["starting_price"] == 1499.99
        assert data["min_bid_increment"] == 50.5

    def test_create_all_categories(self, client):
        """Each allowed category must be accepted."""
        for cat in ["cycle", "calculator", "books", "electronics", "other"]:
            payload = {**VALID_LISTING, "category": cat, "title": f"Item {cat}"}
            resp = client.post("/api/listings", json=payload)
            assert resp.status_code == 201, f"Category '{cat}' was rejected"

    def test_create_all_conditions(self, client):
        """Each allowed condition must be accepted."""
        for cond in ["new", "like_new", "good", "fair", "needs_repair"]:
            payload = {**VALID_LISTING, "condition": cond}
            resp = client.post("/api/listings", json=payload)
            assert resp.status_code == 201, f"Condition '{cond}' was rejected"

    # ---- Invalid inputs ----

    def test_negative_price_rejected(self, client):
        payload = {**VALID_LISTING, "starting_price": -100}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_zero_price_rejected(self, client):
        payload = {**VALID_LISTING, "starting_price": 0}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_zero_increment_rejected(self, client):
        payload = {**VALID_LISTING, "min_bid_increment": 0}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_blank_title_rejected(self, client):
        payload = {**VALID_LISTING, "title": "   "}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_short_title_rejected(self, client):
        payload = {**VALID_LISTING, "title": "ab"}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_blank_description_rejected(self, client):
        payload = {**VALID_LISTING, "description": "   "}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_short_description_rejected(self, client):
        payload = {**VALID_LISTING, "description": "too short"}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_invalid_category_rejected(self, client):
        payload = {**VALID_LISTING, "category": "furniture"}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_invalid_condition_rejected(self, client):
        payload = {**VALID_LISTING, "condition": "broken"}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_past_closing_time_rejected(self, client):
        payload = {**VALID_LISTING, "closes_at": "2020-01-01T10:00:00+05:30"}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_closing_time_without_timezone_rejected(self, client):
        payload = {**VALID_LISTING, "closes_at": "2030-12-31T18:00:00"}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_too_many_photos_rejected(self, client):
        payload = {**VALID_LISTING, "photos": [f"https://img/{i}.jpg" for i in range(7)]}
        assert client.post("/api/listings", json=payload).status_code == 422

    def test_invalid_seller_id_rejected(self, client):
        payload = {**VALID_LISTING, "seller_id": 0}
        assert client.post("/api/listings", json=payload).status_code == 422


# =============================================================================
# 2. READ — Detail (GET /api/listings/{id})
# =============================================================================

class TestGetListing:

    def test_get_existing_listing(self, client):
        """A listing just created must be retrievable by its ID."""
        create_resp = client.post("/api/listings", json=VALID_LISTING)
        listing_id = create_resp.json()["id"]

        resp = client.get(f"/api/listings/{listing_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == listing_id
        assert data["description"] == VALID_LISTING["description"]

    def test_get_nonexistent_listing_returns_404(self, client):
        resp = client.get("/api/listings/99999")
        assert resp.status_code == 404

    def test_get_cancelled_listing_still_accessible(self, client):
        """
        Cancelled listings are never hard-deleted.
        They remain accessible by ID for audit purposes.
        """
        create_resp = client.post("/api/listings", json=VALID_LISTING)
        lid = create_resp.json()["id"]
        client.delete(f"/api/listings/{lid}?seller_id=1")

        resp = client.get(f"/api/listings/{lid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


# =============================================================================
# 3. READ — Browse (GET /api/listings)
# =============================================================================

class TestBrowseListings:

    def _make_listing(self, client, **overrides):
        payload = {**VALID_LISTING, **overrides}
        return client.post("/api/listings", json=payload).json()

    def test_browse_returns_active_listings(self, client):
        self._make_listing(client)
        resp = client.get("/api/listings")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_cancelled_listing_not_in_browse(self, client):
        lid = self._make_listing(client)["id"]
        client.delete(f"/api/listings/{lid}?seller_id=1")
        resp = client.get("/api/listings")
        assert len(resp.json()) == 0

    def test_filter_by_category(self, client):
        self._make_listing(client, category="cycle", title="Old cycle")
        self._make_listing(client, category="books", title="Physics book")
        resp = client.get("/api/listings?category=cycle")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["category"] == "cycle"

    def test_filter_by_condition(self, client):
        self._make_listing(client, condition="new", title="New item")
        self._make_listing(client, condition="fair", title="Fair item")
        resp = client.get("/api/listings?condition=new")
        assert len(resp.json()) == 1

    def test_filter_by_keyword_title(self, client):
        self._make_listing(
            client,
            title="Casio calculator fx-991",
            description="Scientific calculator with clear display, great for exams.",
        )
        self._make_listing(
            client,
            title="Mountain bicycle",
            description="Strong frame, good brakes, used for one semester only.",
        )
        resp = client.get("/api/listings?keyword=casio")
        assert len(resp.json()) == 1
        assert resp.json()[0]["title"] == "Casio calculator fx-991"

    def test_filter_by_keyword_description(self, client):
        self._make_listing(client, description="This has a solar panel for power.")
        self._make_listing(client, description="Completely different item here.")
        resp = client.get("/api/listings?keyword=solar")
        assert len(resp.json()) == 1

    def test_filter_by_min_price(self, client):
        self._make_listing(client, starting_price=100, title="Cheap item")
        self._make_listing(client, starting_price=500, title="Expensive item")
        resp = client.get("/api/listings?min_price=200")
        assert len(resp.json()) == 1
        assert resp.json()[0]["starting_price"] == 500.0

    def test_filter_by_max_price(self, client):
        self._make_listing(client, starting_price=100, title="Cheap item")
        self._make_listing(client, starting_price=500, title="Expensive item")
        resp = client.get("/api/listings?max_price=200")
        assert len(resp.json()) == 1
        assert resp.json()[0]["starting_price"] == 100.0

    def test_pagination(self, client):
        for i in range(5):
            self._make_listing(client, title=f"Item number {i+1}")
        resp = client.get("/api/listings?skip=2&limit=2")
        assert len(resp.json()) == 2

    def test_empty_browse_returns_empty_list(self, client):
        resp = client.get("/api/listings")
        assert resp.status_code == 200
        assert resp.json() == []


# =============================================================================
# 4. UPDATE (PATCH /api/listings/{id})
# =============================================================================

class TestUpdateListing:

    def _create(self, client, **overrides):
        return client.post("/api/listings", json={**VALID_LISTING, **overrides}).json()

    def test_update_title(self, client):
        lid = self._create(client)["id"]
        resp = client.patch(
            f"/api/listings/{lid}?seller_id=1",
            json={"title": "Updated calculator title"}
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated calculator title"

    def test_update_price(self, client):
        lid = self._create(client)["id"]
        resp = client.patch(
            f"/api/listings/{lid}?seller_id=1",
            json={"starting_price": 300.0}
        )
        assert resp.status_code == 200
        assert resp.json()["starting_price"] == 300.0

    def test_partial_update_only_changes_specified_fields(self, client):
        listing = self._create(client)
        lid = listing["id"]
        resp = client.patch(
            f"/api/listings/{lid}?seller_id=1",
            json={"title": "New title only"}
        )
        data = resp.json()
        # Other fields must remain unchanged
        assert data["category"] == listing["category"]
        assert data["starting_price"] == listing["starting_price"]

    def test_wrong_seller_cannot_update(self, client):
        lid = self._create(client)["id"]  # seller_id=1
        resp = client.patch(
            f"/api/listings/{lid}?seller_id=99",
            json={"title": "Hacked title change"}
        )
        assert resp.status_code == 403

    def test_update_nonexistent_listing_returns_404(self, client):
        resp = client.patch(
            "/api/listings/99999?seller_id=1",
            json={"title": "Does not matter"}
        )
        assert resp.status_code == 404

    def test_update_cancelled_listing_returns_409(self, client):
        lid = self._create(client)["id"]
        client.delete(f"/api/listings/{lid}?seller_id=1")
        resp = client.patch(
            f"/api/listings/{lid}?seller_id=1",
            json={"title": "Too late to update"}
        )
        assert resp.status_code == 409

    def test_empty_update_body_rejected(self, client):
        """PATCH with no fields provided must be rejected (Pydantic model_validator)."""
        lid = self._create(client)["id"]
        resp = client.patch(f"/api/listings/{lid}?seller_id=1", json={})
        assert resp.status_code == 422


# =============================================================================
# 5. CANCEL (DELETE /api/listings/{id})
# =============================================================================

class TestCancelListing:

    def _create(self, client, seller_id=1, **overrides):
        payload = {**VALID_LISTING, "seller_id": seller_id, **overrides}
        return client.post("/api/listings", json=payload).json()

    def test_cancel_own_listing(self, client):
        lid = self._create(client)["id"]
        resp = client.delete(f"/api/listings/{lid}?seller_id=1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_cancel_wrong_seller_forbidden(self, client):
        lid = self._create(client, seller_id=1)["id"]
        resp = client.delete(f"/api/listings/{lid}?seller_id=2")
        assert resp.status_code == 403

    def test_cancel_already_cancelled_returns_409(self, client):
        lid = self._create(client)["id"]
        client.delete(f"/api/listings/{lid}?seller_id=1")
        resp = client.delete(f"/api/listings/{lid}?seller_id=1")
        assert resp.status_code == 409

    def test_cancel_nonexistent_returns_404(self, client):
        resp = client.delete("/api/listings/99999?seller_id=1")
        assert resp.status_code == 404

    def test_cancelled_listing_not_in_active_browse(self, client):
        lid = self._create(client)["id"]
        client.delete(f"/api/listings/{lid}?seller_id=1")
        browse = client.get("/api/listings").json()
        assert not any(item["id"] == lid for item in browse)

    def test_cancelled_listing_still_accessible_by_id(self, client):
        """Soft-delete: record preserved for audit."""
        lid = self._create(client)["id"]
        client.delete(f"/api/listings/{lid}?seller_id=1")
        resp = client.get(f"/api/listings/{lid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


# =============================================================================
# 6. Persistence
# =============================================================================

class TestPersistence:

    def test_listing_persists_in_db(self, client, db_session):
        """
        Listing created via the API must be retrievable directly from the DB session.
        This proves data actually reached the database, not just an in-memory cache.
        """
        from app.models import Listing

        resp = client.post("/api/listings", json=VALID_LISTING)
        assert resp.status_code == 201
        listing_id = resp.json()["id"]

        db_record = db_session.get(Listing, listing_id)
        assert db_record is not None
        assert db_record.title == VALID_LISTING["title"]
        # Paise stored in DB, not rupees
        assert db_record.starting_price_paise == 25000  # ₹250 × 100

    def test_multiple_listings_have_unique_ids(self, client):
        id1 = client.post("/api/listings", json=VALID_LISTING).json()["id"]
        id2 = client.post("/api/listings", json=VALID_LISTING).json()["id"]
        assert id1 != id2
