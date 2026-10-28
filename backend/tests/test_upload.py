"""
tests/test_upload.py — Tests for image uploads and mandatory photo validation.
"""

import io
import pytest
from .conftest import VALID_LISTING


def test_unauthenticated_upload_rejected(client):
    """Uploading without auth token must return 401."""
    files = {"file": ("test.png", io.BytesIO(b"fake image data"), "image/png")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 401


def test_authenticated_image_upload_success(auth_client):
    """Uploading valid image returns 201 and public file URL."""
    img_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    files = {"file": ("cycle.png", io.BytesIO(img_content), "image/png")}
    response = auth_client.post("/api/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert data["url"].startswith("/api/uploads/")
    assert data["filename"].endswith(".png")
    assert data["size_bytes"] == len(img_content)


def test_non_image_upload_rejected(auth_client):
    """Uploading PDFs, executables, or text files must return 400."""
    files = {"file": ("notes.pdf", io.BytesIO(b"%PDF-1.4..."), "application/pdf")}
    response = auth_client.post("/api/upload", files=files)
    assert response.status_code == 400
    assert "only images" in response.json()["detail"].lower()


def test_empty_image_upload_rejected(auth_client):
    """Empty files must be rejected with 400."""
    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    response = auth_client.post("/api/upload", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_listing_without_photos_rejected(auth_client):
    """Creating a listing with photos=[] must be rejected with 422 (photos mandatory)."""
    payload = {**VALID_LISTING, "photos": []}
    response = auth_client.post("/api/listings", json=payload)
    assert response.status_code == 422
    assert "photos" in response.text

