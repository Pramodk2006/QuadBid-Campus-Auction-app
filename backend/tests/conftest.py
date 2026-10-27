"""
conftest.py — Shared pytest fixtures for the test suite.

Key design:
  - Uses a SEPARATE in-memory SQLite database for tests so production data is never touched.
  - Overrides the app's DB dependency so every test gets a clean database.
  - Each test function gets a fresh database (tables dropped and re-created).
  - TestClient from httpx wraps the FastAPI app for real HTTP-style testing without
    actually starting a server.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.main import app
from app.api.listings import get_db

# In-memory SQLite — isolated from the dev database (quadbid.db)
TEST_DATABASE_URL = "sqlite:///./test_quadbid.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def setup_test_db():
    """
    Create all tables before each test, drop them after.
    autouse=True means every test gets this automatically.
    """
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Yield a clean database session for a single test."""
    with TestingSession() as session:
        yield session


@pytest.fixture
def client():
    """
    FastAPI TestClient with the test database injected.
    Overrides the real get_db dependency so no production data is used.
    """
    def override_get_db():
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

FUTURE_DATE = "2030-12-31T18:00:00+05:30"

VALID_LISTING = {
    "seller_id": 1,
    "title": "Used scientific calculator",
    "category": "calculator",
    "description": "Working Casio fx-991ES with protective cover. Display is clear.",
    "condition": "good",
    "photos": [],
    "starting_price": 250.0,
    "min_bid_increment": 20.0,
    "closes_at": FUTURE_DATE,
}
