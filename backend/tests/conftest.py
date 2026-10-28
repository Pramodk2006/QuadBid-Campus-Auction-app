"""
conftest.py — Shared pytest fixtures for the test suite.

Changes from Phase 1A:
  - Tests now use a proper User record created in the DB.
  - `auth_client` fixture: TestClient with a valid JWT access token in headers.
  - `auth_client_2` fixture: a second user (for testing cross-user permission failures).
  - `dev_login_and_get_token()` helper: calls /api/auth/dev-login to get a real JWT.
  - The test DB is still a separate file (test_quadbid.db), isolated from dev data.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.main import app
from app.api.listings import get_db
from app.api.auth import get_db as auth_get_db
from app.api.bids import get_db as bids_get_db
from app.api.sales import get_db as sales_get_db
from app.core.security import _get_db_for_auth

# Separate test database — never touches the dev DB
TEST_DATABASE_URL = "sqlite:///./test_quadbid.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create all tables before each test, drop after. Applies to every test automatically."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    with TestingSession() as session:
        yield session


@pytest.fixture
def client():
    """
    Unauthenticated TestClient — for public endpoints (browse, detail).
    """
    def override_get_db():
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[auth_get_db] = override_get_db
    app.dependency_overrides[bids_get_db] = override_get_db
    app.dependency_overrides[sales_get_db] = override_get_db
    app.dependency_overrides[_get_db_for_auth] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def _make_client_with_overrides():
    """Return a TestClient with all DB dependencies overridden."""
    def override_get_db():
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[auth_get_db] = override_get_db
    app.dependency_overrides[bids_get_db] = override_get_db
    app.dependency_overrides[sales_get_db] = override_get_db
    app.dependency_overrides[_get_db_for_auth] = override_get_db
    return TestClient(app)


@pytest.fixture
def auth_client():
    """
    TestClient with a valid JWT token for User 1 (Pramod K, 23ALR070).
    Uses /api/auth/dev-login to create the user + get a real JWT.
    """
    tc = _make_client_with_overrides()
    resp = tc.post("/api/auth/dev-login", json=USER_1)
    assert resp.status_code == 201, f"dev-login failed: {resp.text}"
    token = resp.json()["access_token"]
    tc.headers["Authorization"] = f"Bearer {token}"
    yield tc
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client_2():
    """
    TestClient with a valid JWT token for User 2 (Ravi S, 21CSE045).
    Used to test cross-user permission failures.
    """
    tc = _make_client_with_overrides()
    resp = tc.post("/api/auth/dev-login", json=USER_2)
    assert resp.status_code == 201, f"dev-login failed: {resp.text}"
    token = resp.json()["access_token"]
    tc.headers["Authorization"] = f"Bearer {token}"
    yield tc
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client_3():
    """
    TestClient with a valid JWT token for User 3 (Karthik M, 22ITR012).
    """
    tc = _make_client_with_overrides()
    resp = tc.post("/api/auth/dev-login", json=USER_3)
    assert resp.status_code == 201, f"dev-login failed: {resp.text}"
    token = resp.json()["access_token"]
    tc.headers["Authorization"] = f"Bearer {token}"
    yield tc
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------

FUTURE_DATE = "2030-12-31T18:00:00+05:30"

USER_1 = {
    "email": "pramodk.23aim@kongu.edu",
    "name": "Pramod K",
    "roll_number": "23ALR070",
    "department": "AIM",
    "year": 3,
}

USER_2 = {
    "email": "ravis.21cse@kongu.edu",
    "name": "Ravi S",
    "roll_number": "21CSE045",
    "department": "CSE",
    "year": 4,
}

USER_3 = {
    "email": "karthikm.22itr@kongu.edu",
    "name": "Karthik M",
    "roll_number": "22ITR012",
    "department": "IT",
    "year": 3,
}

VALID_LISTING = {
    # seller_id is NOT here — it comes from the JWT token
    "title": "Used scientific calculator",
    "category": "calculator",
    "description": "Working Casio fx-991ES with protective cover. Display is clear.",
    "condition": "good",
    "photos": [],
    "starting_price": 250.0,
    "min_bid_increment": 20.0,
    "closes_at": FUTURE_DATE,
}
