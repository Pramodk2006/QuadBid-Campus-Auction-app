"""
api/upload.py — Image upload endpoint for item inspection photos.

Enforces:
  - Authenticated student access.
  - Image MIME type validation (JPEG, PNG, WebP, GIF).
  - 10MB file size limit.
  - Unique UUID-based filenames to prevent overwriting.
"""

import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from ..core.security import get_current_user
from ..models import User

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Directory where uploaded images are saved
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/jpg",
}


@router.post("", status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an item photo from the student's device.
    Returns the accessible URL for the uploaded photo.
    """
    if not file.content_type or file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Only images (JPEG, PNG, WebP, GIF) are allowed.",
        )

    # Read content and enforce size limit
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds 10MB limit (size: {len(content) / (1024 * 1024):.1f}MB).",
        )

    # Determine safe extension
    original_ext = Path(file.filename or "").suffix.lower()
    if original_ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext_map = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        original_ext = ext_map.get(file.content_type.lower(), ".jpg")

    unique_filename = f"{uuid.uuid4().hex}{original_ext}"
    dest_path = UPLOAD_DIR / unique_filename

    with open(dest_path, "wb") as f:
        f.write(content)

    return {
        "url": f"/api/uploads/{unique_filename}",
        "filename": unique_filename,
        "size_bytes": len(content),
    }
