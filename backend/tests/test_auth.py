"""
test_auth.py — Tests for the authentication system.

Covers:
  1. Dev login (create user with @kongu.edu email)
  2. Profile returned correctly (display_name = "Name (RollNo)")
  3. Domain enforcement (non-kongu.edu email rejected)
  4. Duplicate roll number rejected
  5. /api/auth/me returns correct profile
  6. Protected routes reject unauthenticated requests
  7. Protected routes reject invalid/expired tokens
  8. Profile completion flow via setup_token
"""

import pytest
from .conftest import USER_1, USER_2


class TestDevLogin:

    def test_dev_login_creates_user(self, client):
        resp = client.post("/api/auth/dev-login", json=USER_1)
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_dev_login_returns_user_profile(self, client):
        resp = client.post("/api/auth/dev-login", json=USER_1)
        user = resp.json()["user"]
        assert user["name"] == "Pramod K"
        assert user["email"] == "pramodk.23aim@kongu.edu"
        assert user["roll_number"] == "23ALR070"
        assert user["department"] == "AIM"
        assert user["year"] == 3
        assert user["is_profile_complete"] is True

    def test_display_name_format(self, client):
        """display_name must follow 'Name (RollNumber)' format."""
        resp = client.post("/api/auth/dev-login", json=USER_1)
        assert resp.json()["user"]["display_name"] == "Pramod K (23ALR070)"

    def test_dev_login_roll_number_normalized_to_uppercase(self, client):
        payload = {**USER_1, "roll_number": "23alr070"}
        resp = client.post("/api/auth/dev-login", json=payload)
        assert resp.status_code == 201
        assert resp.json()["user"]["roll_number"] == "23ALR070"

    def test_dev_login_department_normalized_to_uppercase(self, client):
        payload = {**USER_1, "department": "aim"}
        resp = client.post("/api/auth/dev-login", json=payload)
        assert resp.status_code == 201
        assert resp.json()["user"]["department"] == "AIM"

    def test_dev_login_same_email_returns_existing_user(self, client):
        """Logging in twice with the same email should not create a duplicate."""
        resp1 = client.post("/api/auth/dev-login", json=USER_1)
        resp2 = client.post("/api/auth/dev-login", json=USER_1)
        assert resp1.json()["user"]["id"] == resp2.json()["user"]["id"]

    def test_dev_login_rejects_non_college_email(self, client):
        payload = {**USER_1, "email": "student@gmail.com"}
        assert client.post("/api/auth/dev-login", json=payload).status_code == 409

    def test_dev_login_rejects_different_domain(self, client):
        payload = {**USER_1, "email": "student@othercollege.edu"}
        assert client.post("/api/auth/dev-login", json=payload).status_code == 409

    def test_dev_login_duplicate_roll_number_rejected(self, client):
        """Two different users cannot share the same roll number."""
        client.post("/api/auth/dev-login", json=USER_1)
        payload = {
            **USER_2,
            "roll_number": USER_1["roll_number"],   # same roll number as USER_1
        }
        resp = client.post("/api/auth/dev-login", json=payload)
        assert resp.status_code == 409

    def test_two_different_users_can_register(self, client):
        r1 = client.post("/api/auth/dev-login", json=USER_1)
        r2 = client.post("/api/auth/dev-login", json=USER_2)
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["user"]["id"] != r2.json()["user"]["id"]


class TestGetMe:

    def test_me_returns_profile(self, auth_client):
        resp = auth_client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == "Pramod K (23ALR070)"
        assert data["email"] == "pramodk.23aim@kongu.edu"

    def test_me_requires_auth(self, client):
        assert client.get("/api/auth/me").status_code == 401

    def test_me_rejects_invalid_token(self, client):
        client.headers["Authorization"] = "Bearer invalid.token.here"
        assert client.get("/api/auth/me").status_code == 401


class TestProfileCompletion:

    def test_complete_profile_flow(self, client):
        """
        Simulate the profile completion flow:
        1. Get a setup_token (we fake this by calling the internal helper directly).
        2. POST /api/auth/complete-profile with setup_token + details.
        3. Receive a full access_token.
        """
        from app.models import User
        from app.core.security import create_setup_token
        from app.services.user_service import create_user_from_google
        from tests.conftest import TestingSession

        # Create an incomplete user directly in the test DB
        with TestingSession() as db:
            user = create_user_from_google(
                db,
                google_id="google_test_001",
                email="newstudent.23xyz@kongu.edu",
                name="New Student",
                avatar_url=None,
            )
            db.commit()

        # Generate a setup token for that user
        setup_token = create_setup_token(
            google_id="google_test_001",
            email="newstudent.23xyz@kongu.edu",
            name="New Student",
            avatar=None,
        )

        resp = client.post("/api/auth/complete-profile", json={
            "setup_token": setup_token,
            "roll_number": "23XYZ999",
            "department": "MECH",
            "year": 2,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["roll_number"] == "23XYZ999"
        assert data["user"]["display_name"] == "New Student (23XYZ999)"
        assert data["user"]["is_profile_complete"] is True

    def test_complete_profile_rejects_duplicate_roll_number(self, client):
        """Cannot claim a roll number that is already registered."""
        from app.models import User
        from app.core.security import create_setup_token
        from app.services.user_service import create_user_from_google
        from tests.conftest import TestingSession

        # Register USER_1 first
        client.post("/api/auth/dev-login", json=USER_1)

        # Create another incomplete user
        with TestingSession() as db:
            create_user_from_google(
                db,
                google_id="google_test_002",
                email="another.23abc@kongu.edu",
                name="Another Student",
                avatar_url=None,
            )
            db.commit()

        setup_token = create_setup_token(
            google_id="google_test_002",
            email="another.23abc@kongu.edu",
            name="Another Student",
            avatar=None,
        )

        # Try to claim USER_1's roll number
        resp = client.post("/api/auth/complete-profile", json={
            "setup_token": setup_token,
            "roll_number": USER_1["roll_number"],
            "department": "AIM",
            "year": 3,
        })
        assert resp.status_code == 409

    def test_invalid_setup_token_rejected(self, client):
        resp = client.post("/api/auth/complete-profile", json={
            "setup_token": "not.a.valid.token",
            "roll_number": "23ABC000",
            "department": "CSE",
            "year": 1,
        })
        assert resp.status_code == 401

    def test_access_token_rejected_as_setup_token(self, client):
        """An access_token must not be usable as a setup_token."""
        login_resp = client.post("/api/auth/dev-login", json=USER_1)
        access_token = login_resp.json()["access_token"]

        resp = client.post("/api/auth/complete-profile", json={
            "setup_token": access_token,
            "roll_number": "23NEW001",
            "department": "EEE",
            "year": 2,
        })
        assert resp.status_code == 401


class TestAuthProtection:

    def test_create_listing_requires_auth(self, client):
        from .conftest import VALID_LISTING
        assert client.post("/api/listings", json=VALID_LISTING).status_code == 401

    def test_update_listing_requires_auth(self, client, auth_client):
        from .conftest import VALID_LISTING
        lid = auth_client.post("/api/listings", json=VALID_LISTING).json()["id"]
        assert client.patch(f"/api/listings/{lid}", json={"title": "No auth"}).status_code == 401

    def test_delete_listing_requires_auth(self, client, auth_client):
        from .conftest import VALID_LISTING
        lid = auth_client.post("/api/listings", json=VALID_LISTING).json()["id"]
        assert client.delete(f"/api/listings/{lid}").status_code == 401

    def test_browse_listings_is_public(self, client):
        """Browse should work without any token — 200, not 401."""
        assert client.get("/api/listings").status_code == 200

    def test_get_listing_detail_is_public(self, client, auth_client):
        from .conftest import VALID_LISTING
        lid = auth_client.post("/api/listings", json=VALID_LISTING).json()["id"]
        assert client.get(f"/api/listings/{lid}").status_code == 200
