"""
tests/test_websocket.py — Tests for WebSocket real-time updates and anti-sniping broadcast.
"""

from datetime import datetime, timedelta, timezone
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


def _create_listing(db, seller_id, title="Casio fx-991EX Calculator", seconds_until_close=3600):
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
        closes_at=now + timedelta(seconds=seconds_until_close),
        status="active",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def test_ws_listing_connection_ping(client: TestClient):
    with client.websocket_connect("/ws/listings/1") as ws:
        ws.send_text("ping")
        resp = ws.receive_text()
        assert resp == "pong"


def test_ws_live_connection_ping(client: TestClient):
    with client.websocket_connect("/ws/live") as ws:
        ws.send_text("ping")
        resp = ws.receive_text()
        assert resp == "pong"


def test_ws_receives_new_bid_and_global_ticker(client: TestClient, db_session):
    seller = _create_user(db_session, "ws_seller@kongu.edu", "WS Seller", "21ALR091", "g_ws_s")
    buyer = _create_user(db_session, "ws_buyer@kongu.edu", "WS Buyer", "23ALR091", "g_ws_b")
    listing = _create_listing(db_session, seller.id)

    b_login = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    token = b_login.json()["access_token"]

    # Open WebSocket connections for both the lot room and the global ticker
    with client.websocket_connect(f"/ws/listings/{listing.id}") as lot_ws:
        with client.websocket_connect("/ws/live") as global_ws:
            # Place a bid
            bid_res = client.post(
                f"/api/listings/{listing.id}/bids",
                json={"amount": 500.0},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert bid_res.status_code == 201

            # Check message received on lot WebSocket
            lot_msg = lot_ws.receive_json()
            assert lot_msg["type"] == "NEW_BID"
            assert lot_msg["listing_id"] == listing.id
            assert lot_msg["bid"]["amount"] == 500.0
            assert "WS Buyer" in lot_msg["bid"]["bidder_display_name"]
            assert lot_msg["extended"] is False

            # Check message received on global live ticker WebSocket
            global_msg = global_ws.receive_json()
            assert global_msg["type"] == "GLOBAL_BID_TICKER"
            assert global_msg["listing_id"] == listing.id
            assert global_msg["amount"] == 500.0


def test_ws_receives_anti_sniping_extension(client: TestClient, db_session):
    seller = _create_user(db_session, "ws_snipe_seller@kongu.edu", "Snipe Seller", "21ALR092", "g_ws_s2")
    buyer = _create_user(db_session, "ws_snipe_buyer@kongu.edu", "Snipe Buyer", "23ALR092", "g_ws_b2")
    # Closing in 15 seconds! (Inside the <=30s anti-sniping window)
    listing = _create_listing(db_session, seller.id, seconds_until_close=15)

    b_login = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    token = b_login.json()["access_token"]

    with client.websocket_connect(f"/ws/listings/{listing.id}") as lot_ws:
        bid_res = client.post(
            f"/api/listings/{listing.id}/bids",
            json={"amount": 500.0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert bid_res.status_code == 201

        lot_msg = lot_ws.receive_json()
        assert lot_msg["type"] == "NEW_BID"
        assert lot_msg["extended"] is True
        assert "Auction extended" in lot_msg["message"]
        # closes_at is moved to future
        assert lot_msg["closes_at"] is not None


def test_ws_receives_qa_updates(client: TestClient, db_session):
    seller = _create_user(db_session, "ws_qa_seller@kongu.edu", "QA Seller", "21ALR093", "g_ws_s3")
    buyer = _create_user(db_session, "ws_qa_buyer@kongu.edu", "QA Buyer", "23ALR093", "g_ws_b3")
    listing = _create_listing(db_session, seller.id)

    b_login = client.post(
        "/api/auth/dev-login",
        json={"email": buyer.email, "name": buyer.name, "roll_number": buyer.roll_number},
    )
    b_token = b_login.json()["access_token"]

    s_login = client.post(
        "/api/auth/dev-login",
        json={"email": seller.email, "name": seller.name, "roll_number": seller.roll_number},
    )
    s_token = s_login.json()["access_token"]

    with client.websocket_connect(f"/ws/listings/{listing.id}") as lot_ws:
        # 1. Ask question
        q_res = client.post(
            f"/api/listings/{listing.id}/questions",
            json={"question_text": "Is the textbook unmarked?"},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert q_res.status_code == 201
        q_id = q_res.json()["id"]

        q_msg = lot_ws.receive_json()
        assert q_msg["type"] == "NEW_QUESTION"
        assert q_msg["question"]["id"] == q_id

        # 2. Answer question
        ans_res = client.post(
            f"/api/listings/{listing.id}/questions/{q_id}/answer",
            json={"answer_text": "Yes, zero pen marks."},
            headers={"Authorization": f"Bearer {s_token}"},
        )
        assert ans_res.status_code == 200

        ans_msg = lot_ws.receive_json()
        assert ans_msg["type"] == "NEW_ANSWER"
        assert ans_msg["question_id"] == q_id
        assert ans_msg["answer_text"] == "Yes, zero pen marks."
