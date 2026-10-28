"""
tests/test_watchlist_and_proxy.py — Tests for Watchlists (Phase 7) & Auto-Proxy Bidding (Phase 8).
"""

import pytest
from .conftest import VALID_LISTING


def _create_listing(auth_client, **overrides):
    payload = {**VALID_LISTING, **overrides}
    resp = auth_client.post("/api/listings", json=payload)
    assert resp.status_code == 201
    return resp.json()["id"]


# =============================================================================
# Phase 7 — Watchlists & Saved Search Alerts
# =============================================================================

def test_add_and_get_watchlist(auth_client, auth_client_2):
    lid = _create_listing(auth_client_2, title="Hostel Gaming Mouse")

    # User 1 adds to watchlist
    res = auth_client.post(f"/api/watchlist/{lid}")
    assert res.status_code == 201

    # User 1 gets watchlist
    watched = auth_client.get("/api/watchlist").json()
    assert len(watched) == 1
    assert watched[0]["listing_id"] == lid
    assert watched[0]["listing"]["title"] == "Hostel Gaming Mouse"

    # User 1 removes from watchlist
    del_res = auth_client.delete(f"/api/watchlist/{lid}")
    assert del_res.status_code == 200

    watched_after = auth_client.get("/api/watchlist").json()
    assert len(watched_after) == 0


def test_saved_searches_flow(auth_client):
    # Save a search alert
    create_res = auth_client.post("/api/saved-searches", json={
        "query": "Casio",
        "category": "calculator",
        "max_price": 500.0,
    })
    assert create_res.status_code == 201
    sid = create_res.json()["id"]

    # List saved searches
    searches = auth_client.get("/api/saved-searches").json()
    assert len(searches) == 1
    assert searches[0]["query"] == "casio"

    # Delete saved search
    del_res = auth_client.delete(f"/api/saved-searches/{sid}")
    assert del_res.status_code == 200

    assert len(auth_client.get("/api/saved-searches").json()) == 0


# =============================================================================
# Phase 8 — Automatic Proxy Bidding Engine
# =============================================================================

def test_auto_proxy_bidding_flow(auth_client, auth_client_2, auth_client_3):
    # User 2 creates listing: starting ₹500, increment ₹50
    lid = _create_listing(auth_client_2, starting_price=500.0, min_bid_increment=50.0)

    # User 1 sets proxy ceiling of ₹800
    proxy_res = auth_client.post(f"/api/listings/{lid}/proxy-bid", json={"max_ceiling": 800.0})
    assert proxy_res.status_code == 201
    assert proxy_res.json()["max_ceiling"] == 800.0

    # User 1's proxy automatically places opening bid at starting price ₹500
    leader = auth_client.get(f"/api/listings/{lid}/leader").json()
    assert leader["current_price"] == 500.0
    assert "Pramod" in leader["leading_bidder_display_name"]

    # User 3 bids ₹550 manually
    bid_res = auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 550.0})
    assert bid_res.status_code == 201

    # User 1's proxy engine automatically counter-bids ₹600 (550 + 50)
    leader_after = auth_client.get(f"/api/listings/{lid}/leader").json()
    assert leader_after["current_price"] == 600.0
    assert "Pramod" in leader_after["leading_bidder_display_name"]

    # User 3 bids ₹900 (exceeding User 1's ceiling of ₹800)
    bid_outbid = auth_client_3.post(f"/api/listings/{lid}/bids", json={"amount": 900.0})
    assert bid_outbid.status_code == 201

    # Now User 3 leads at ₹900 because User 1's ceiling was exceeded
    leader_final = auth_client.get(f"/api/listings/{lid}/leader").json()
    assert leader_final["current_price"] == 900.0
    assert "Karthik" in leader_final["leading_bidder_display_name"]
