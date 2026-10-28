"""
test_listings.py — Phase 1A + auth-aware listing CRUD tests.

Changes from Phase 1A:
  - All write operations (create, update, cancel) use auth_client (JWT token).
  - Cross-user permission tests use auth_client_2 (a different user).
  - seller_id is no longer in request body — it comes from the JWT.
  - Responses now include seller_display_name ("Pramod K (23ALR070)").
  - Public endpoints (browse, detail) still use the unauthenticated client.
"""

import pytest
from .conftest import FUTURE_DATE, VALID_LISTING


# =============================================================================
# 1. CREATE (POST /api/listings)
# =============================================================================

class TestCreateListing:

    def test_create_valid_listing_returns_201(self, auth_client):
        response = auth_client.post("/api/listings", json=VALID_LISTING)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 1
        assert data["title"] == "Used scientific calculator"
        assert data["status"] == "active"
        assert data["starting_price"] == 250.0
        assert data["min_bid_increment"] == 20.0

    def test_response_contains_seller_display_name(self, auth_client):
        """Seller is identified as 'Pramod K (23ALR070)' — not a raw ID."""
        response = auth_client.post("/api/listings", json=VALID_LISTING)
        assert response.status_code == 201
        assert response.json()["seller_display_name"] == "Pramod K (23ALR070)"

    def test_create_requires_authentication(self, client):
        """Unauthenticated request must be rejected with 401."""
        response = client.post("/api/listings", json=VALID_LISTING)
        assert response.status_code == 401

    def test_create_stores_money_correctly(self, auth_client):
        payload = {**VALID_LISTING, "starting_price": 1499.99, "min_bid_increment": 50.5}
        response = auth_client.post("/api/listings", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["starting_price"] == 1499.99
        assert data["min_bid_increment"] == 50.5

    def test_create_listing_with_iso_z_timestamp(self, auth_client):
        """JavaScript's toISOString() ends with 'Z' (e.g. 2026-12-31T18:00:00.000Z). Must be accepted."""
        payload = {**VALID_LISTING, "closes_at": "2026-12-31T18:00:00.000Z"}
        response = auth_client.post("/api/listings", json=payload)
        assert response.status_code == 201
        assert response.json()["status"] == "active"

    def test_create_all_categories(self, auth_client):
        for cat in ["cycle", "calculator", "books", "electronics", "other"]:
            payload = {**VALID_LISTING, "category": cat, "title": f"Item for {cat}"}
            resp = auth_client.post("/api/listings", json=payload)
            assert resp.status_code == 201, f"Category '{cat}' was rejected"

    def test_create_all_conditions(self, auth_client):
        for cond in ["new", "like_new", "good", "fair", "needs_repair"]:
            payload = {**VALID_LISTING, "condition": cond}
            resp = auth_client.post("/api/listings", json=payload)
            assert resp.status_code == 201, f"Condition '{cond}' was rejected"

    # ---- Invalid inputs ----

    def test_negative_price_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "starting_price": -100}).status_code == 422

    def test_zero_price_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "starting_price": 0}).status_code == 422

    def test_zero_increment_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "min_bid_increment": 0}).status_code == 422

    def test_blank_title_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "title": "   "}).status_code == 422

    def test_short_title_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "title": "ab"}).status_code == 422

    def test_blank_description_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "description": "   "}).status_code == 422

    def test_short_description_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "description": "too short"}).status_code == 422

    def test_invalid_category_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "category": "furniture"}).status_code == 422

    def test_invalid_condition_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "condition": "broken"}).status_code == 422

    def test_past_closing_time_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "closes_at": "2020-01-01T10:00:00+05:30"}).status_code == 422

    def test_closing_time_without_timezone_rejected(self, auth_client):
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "closes_at": "2030-12-31T18:00:00"}).status_code == 422

    def test_too_many_photos_rejected(self, auth_client):
        photos = [f"https://img/{i}.jpg" for i in range(7)]
        assert auth_client.post("/api/listings", json={**VALID_LISTING, "photos": photos}).status_code == 422


# =============================================================================
# 2. READ — Detail (GET /api/listings/{id}) — PUBLIC
# =============================================================================

class TestGetListing:

    def test_get_existing_listing(self, auth_client, client):
        create_resp = auth_client.post("/api/listings", json=VALID_LISTING)
        listing_id = create_resp.json()["id"]

        # Public client can also read
        resp = client.get(f"/api/listings/{listing_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == listing_id
        assert data["seller_display_name"] == "Pramod K (23ALR070)"

    def test_get_nonexistent_listing_returns_404(self, client):
        assert client.get("/api/listings/99999").status_code == 404

    def test_get_cancelled_listing_still_accessible(self, auth_client, client):
        lid = auth_client.post("/api/listings", json=VALID_LISTING).json()["id"]
        auth_client.delete(f"/api/listings/{lid}")
        resp = client.get(f"/api/listings/{lid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


# =============================================================================
# 3. READ — Browse (GET /api/listings) — PUBLIC
# =============================================================================

class TestBrowseListings:

    def _make_listing(self, auth_client, **overrides):
        payload = {**VALID_LISTING, **overrides}
        return auth_client.post("/api/listings", json=payload).json()

    def test_browse_returns_active_listings(self, auth_client, client):
        self._make_listing(auth_client)
        resp = client.get("/api/listings")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_cancelled_listing_not_in_browse(self, auth_client, client):
        lid = self._make_listing(auth_client)["id"]
        auth_client.delete(f"/api/listings/{lid}")
        assert len(client.get("/api/listings").json()) == 0

    def test_filter_by_category(self, auth_client, client):
        self._make_listing(auth_client, category="cycle", title="Old campus cycle")
        self._make_listing(auth_client, category="books", title="Physics textbook here")
        resp = client.get("/api/listings?category=cycle")
        assert len(resp.json()) == 1
        assert resp.json()[0]["category"] == "cycle"

    def test_filter_by_condition(self, auth_client, client):
        self._make_listing(auth_client, condition="new", title="Brand new item available")
        self._make_listing(auth_client, condition="fair", title="Fair condition item sale")
        assert len(client.get("/api/listings?condition=new").json()) == 1

    def test_filter_by_keyword_title(self, auth_client, client):
        self._make_listing(
            auth_client,
            title="Casio calculator fx-991",
            description="Scientific calculator with clear display, great for exams.",
        )
        self._make_listing(
            auth_client,
            title="Mountain bicycle",
            description="Strong frame, good brakes, used for one semester only.",
        )
        resp = client.get("/api/listings?keyword=casio")
        assert len(resp.json()) == 1
        assert resp.json()[0]["title"] == "Casio calculator fx-991"

    def test_filter_by_keyword_description(self, auth_client, client):
        self._make_listing(
            auth_client,
            title="Item with solar power",
            description="This has a solar panel for power.",
        )
        self._make_listing(
            auth_client,
            title="Regular item for sale",
            description="Completely different thing for sale here.",
        )
        assert len(client.get("/api/listings?keyword=solar").json()) == 1

    def test_filter_by_min_price(self, auth_client, client):
        self._make_listing(auth_client, starting_price=100, title="Cheap item for sale")
        self._make_listing(auth_client, starting_price=500, title="Expensive item for sale")
        resp = client.get("/api/listings?min_price=200")
        assert len(resp.json()) == 1
        assert resp.json()[0]["starting_price"] == 500.0

    def test_filter_by_max_price(self, auth_client, client):
        self._make_listing(auth_client, starting_price=100, title="Cheap item here")
        self._make_listing(auth_client, starting_price=500, title="Costly item here")
        resp = client.get("/api/listings?max_price=200")
        assert len(resp.json()) == 1
        assert resp.json()[0]["starting_price"] == 100.0

    def test_pagination(self, auth_client, client):
        for i in range(5):
            self._make_listing(auth_client, title=f"Item number {i+1} for test")
        assert len(client.get("/api/listings?skip=2&limit=2").json()) == 2

    def test_empty_browse_returns_empty_list(self, client):
        assert client.get("/api/listings").json() == []

    def test_browse_includes_seller_display_name(self, auth_client, client):
        """Every listing card shows seller identity."""
        self._make_listing(auth_client)
        data = client.get("/api/listings").json()
        assert data[0]["seller_display_name"] == "Pramod K (23ALR070)"


# =============================================================================
# 4. UPDATE (PATCH /api/listings/{id})
# =============================================================================

class TestUpdateListing:

    def _create(self, auth_client, **overrides):
        return auth_client.post("/api/listings", json={**VALID_LISTING, **overrides}).json()

    def test_update_title(self, auth_client):
        lid = self._create(auth_client)["id"]
        resp = auth_client.patch(f"/api/listings/{lid}", json={"title": "Updated calculator title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated calculator title"

    def test_update_price(self, auth_client):
        lid = self._create(auth_client)["id"]
        resp = auth_client.patch(f"/api/listings/{lid}", json={"starting_price": 300.0})
        assert resp.status_code == 200
        assert resp.json()["starting_price"] == 300.0

    def test_partial_update_only_changes_specified_fields(self, auth_client):
        listing = self._create(auth_client)
        lid = listing["id"]
        resp = auth_client.patch(f"/api/listings/{lid}", json={"title": "New title only"})
        data = resp.json()
        assert data["category"] == listing["category"]
        assert data["starting_price"] == listing["starting_price"]

    def test_other_user_cannot_update(self, auth_client, auth_client_2):
        """User 2 cannot edit User 1's listing."""
        lid = self._create(auth_client)["id"]
        resp = auth_client_2.patch(f"/api/listings/{lid}", json={"title": "Unauthorized change"})
        assert resp.status_code == 403

    def test_unauthenticated_cannot_update(self, auth_client, client):
        lid = self._create(auth_client)["id"]
        resp = client.patch(f"/api/listings/{lid}", json={"title": "No auth"})
        assert resp.status_code == 401

    def test_update_nonexistent_listing_returns_404(self, auth_client):
        resp = auth_client.patch("/api/listings/99999", json={"title": "Does not matter"})
        assert resp.status_code == 404

    def test_update_cancelled_listing_returns_409(self, auth_client):
        lid = self._create(auth_client)["id"]
        auth_client.delete(f"/api/listings/{lid}")
        resp = auth_client.patch(f"/api/listings/{lid}", json={"title": "Too late to update"})
        assert resp.status_code == 409

    def test_empty_update_body_rejected(self, auth_client):
        lid = self._create(auth_client)["id"]
        assert auth_client.patch(f"/api/listings/{lid}", json={}).status_code == 422


# =============================================================================
# 5. CANCEL (DELETE /api/listings/{id})
# =============================================================================

class TestCancelListing:

    def _create(self, auth_client, **overrides):
        return auth_client.post("/api/listings", json={**VALID_LISTING, **overrides}).json()

    def test_cancel_own_listing(self, auth_client):
        lid = self._create(auth_client)["id"]
        resp = auth_client.delete(f"/api/listings/{lid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_other_user_cannot_cancel(self, auth_client, auth_client_2):
        """User 2 cannot cancel User 1's listing."""
        lid = self._create(auth_client)["id"]
        assert auth_client_2.delete(f"/api/listings/{lid}").status_code == 403

    def test_unauthenticated_cannot_cancel(self, auth_client, client):
        lid = self._create(auth_client)["id"]
        assert client.delete(f"/api/listings/{lid}").status_code == 401

    def test_cancel_already_cancelled_returns_409(self, auth_client):
        lid = self._create(auth_client)["id"]
        auth_client.delete(f"/api/listings/{lid}")
        assert auth_client.delete(f"/api/listings/{lid}").status_code == 409

    def test_cancel_nonexistent_returns_404(self, auth_client):
        assert auth_client.delete("/api/listings/99999").status_code == 404

    def test_cancelled_listing_not_in_active_browse(self, auth_client, client):
        lid = self._create(auth_client)["id"]
        auth_client.delete(f"/api/listings/{lid}")
        browse = client.get("/api/listings").json()
        assert not any(item["id"] == lid for item in browse)

    def test_cancelled_listing_still_accessible_by_id(self, auth_client, client):
        """Soft-delete: record preserved for audit."""
        lid = self._create(auth_client)["id"]
        auth_client.delete(f"/api/listings/{lid}")
        resp = client.get(f"/api/listings/{lid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


# =============================================================================
# 6. Persistence
# =============================================================================

class TestPersistence:

    def test_listing_persists_in_db(self, auth_client, db_session):
        from app.models import Listing
        resp = auth_client.post("/api/listings", json=VALID_LISTING)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        db_record = db_session.get(Listing, lid)
        assert db_record is not None
        assert db_record.title == VALID_LISTING["title"]
        assert db_record.starting_price_paise == 25000   # ₹250 × 100

    def test_multiple_listings_have_unique_ids(self, auth_client):
        id1 = auth_client.post("/api/listings", json=VALID_LISTING).json()["id"]
        id2 = auth_client.post("/api/listings", json=VALID_LISTING).json()["id"]
        assert id1 != id2
