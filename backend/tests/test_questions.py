"""
tests/test_questions.py — Comprehensive tests for Buyer Q&A functionality.
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.models import Listing, User


def _create_user(db, email, name, roll_number, google_id):
    user = User(
        email=email,
        name=name,
        roll_number=roll_number,
        google_id=google_id,
        is_profile_complete=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_listing(db, seller_id, title="Casio fx-991EX Calculator"):
    now = datetime.now(timezone.utc)
    listing = Listing(
        seller_id=seller_id,
        title=title,
        category="calculator",
        description="Works perfectly for semester exams",
        condition="like_new",
        photos=["https://example.com/casio.jpg"],
        starting_price_paise=50000,
        min_bid_increment_paise=5000,
        closes_at=now + timedelta(hours=2),
        status="active",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def test_ask_question_success(client: TestClient, db_session):
    seller = _create_user(db_session, "seller@kongu.edu", "Seller Student", "21ALR001", "g_seller")
    buyer = _create_user(db_session, "buyer@kongu.edu", "Buyer Student", "23ALR070", "g_buyer")
    listing = _create_listing(db_session, seller.id)

    # Dev-login as buyer
    login_res = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    token = login_res.json()["access_token"]

    res = client.post(
        f"/api/listings/{listing.id}/questions",
        json={"question_text": "Does it have all solar functions working?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["question_text"] == "Does it have all solar functions working?"
    assert data["asker_display_name"] == "Buyer Student (23ALR070)"
    assert data["answer_text"] is None


def test_ask_question_unauthenticated_fails(client: TestClient, db_session):
    seller = _create_user(db_session, "seller2@kongu.edu", "Seller Two", "21ALR002", "g_seller2")
    listing = _create_listing(db_session, seller.id)

    res = client.post(
        f"/api/listings/{listing.id}/questions",
        json={"question_text": "Is this still available?"},
    )
    assert res.status_code == 401


def test_ask_question_short_length_rejected(client: TestClient, db_session):
    buyer = _create_user(db_session, "buyer3@kongu.edu", "Buyer Three", "23ALR073", "g_buyer3")
    seller = _create_user(db_session, "seller3@kongu.edu", "Seller Three", "21ALR003", "g_seller3")
    listing = _create_listing(db_session, seller.id)

    login_res = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    token = login_res.json()["access_token"]

    res = client.post(
        f"/api/listings/{listing.id}/questions",
        json={"question_text": "Hi"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


def test_seller_can_answer_question(client: TestClient, db_session):
    seller = _create_user(db_session, "seller4@kongu.edu", "Rohit Sharma", "21CSE044", "g_seller4")
    buyer = _create_user(db_session, "buyer4@kongu.edu", "Ananya M", "23ALR044", "g_buyer4")
    listing = _create_listing(db_session, seller.id)

    # Buyer logs in and asks question
    b_login = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    b_token = b_login.json()["access_token"]

    q_res = client.post(
        f"/api/listings/{listing.id}/questions",
        json={"question_text": "Does the calculator include original slide cover?"},
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert q_res.status_code == 201
    question_id = q_res.json()["id"]

    # Seller logs in and answers
    s_login = client.post(
        "/api/auth/dev-login",
        json={"email": seller.email, "name": seller.name, "roll_number": seller.roll_number},
    )
    s_token = s_login.json()["access_token"]

    ans_res = client.post(
        f"/api/listings/{listing.id}/questions/{question_id}/answer",
        json={"answer_text": "Yes, original hard cover with formula sheet intact."},
        headers={"Authorization": f"Bearer {s_token}"},
    )
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert ans_data["answer_text"] == "Yes, original hard cover with formula sheet intact."
    assert ans_data["answered_by_display_name"] == "Rohit Sharma (21CSE044)"
    assert ans_data["answered_at"] is not None


def test_non_seller_cannot_answer(client: TestClient, db_session):
    seller = _create_user(db_session, "seller5@kongu.edu", "Real Seller", "21CSE005", "g_seller5")
    buyer = _create_user(db_session, "buyer5@kongu.edu", "Real Buyer", "23CSE005", "g_buyer5")
    imposter = _create_user(db_session, "imposter@kongu.edu", "Imposter Student", "22CSE099", "g_imposter")
    listing = _create_listing(db_session, seller.id)

    b_login = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    q_res = client.post(
        f"/api/listings/{listing.id}/questions",
        json={"question_text": "Can you handover today at Hostel 3?"},
        headers={"Authorization": f"Bearer {b_login.json()['access_token']}"},
    )
    question_id = q_res.json()["id"]

    # Imposter tries to answer
    i_login = client.post(
        "/api/auth/dev-login",
        json={"email": imposter.email, "name": imposter.name, "roll_number": imposter.roll_number},
    )
    i_token = i_login.json()["access_token"]

    ans_res = client.post(
        f"/api/listings/{listing.id}/questions/{question_id}/answer",
        json={"answer_text": "Sure, I can meet at 5pm."},
        headers={"Authorization": f"Bearer {i_token}"},
    )
    assert ans_res.status_code == 403
    assert "Only the seller" in ans_res.json()["detail"]


def test_public_get_questions_unauthenticated(client: TestClient, db_session):
    seller = _create_user(db_session, "seller6@kongu.edu", "Seller Six", "21ALR006", "g_seller6")
    buyer = _create_user(db_session, "buyer6@kongu.edu", "Buyer Six", "23ALR006", "g_buyer6")
    listing = _create_listing(db_session, seller.id)

    b_login = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    client.post(
        f"/api/listings/{listing.id}/questions",
        json={"question_text": "Is battery recently replaced?"},
        headers={"Authorization": f"Bearer {b_login.json()['access_token']}"},
    )

    # Public GET without token
    res = client.get(f"/api/listings/{listing.id}/questions")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["question_text"] == "Is battery recently replaced?"
    assert items[0]["asker_name"] == "Buyer Six"
