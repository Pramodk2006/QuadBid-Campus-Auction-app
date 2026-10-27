"""
core/security.py — JWT creation, verification, and FastAPI auth dependency.

How JWT authentication works here:
  1. After successful OAuth + profile completion, we call create_access_token(user_id).
  2. The token is returned to the frontend (stored in localStorage or httpOnly cookie).
  3. On every protected request, the frontend sends: Authorization: Bearer <token>
  4. get_current_user() dependency reads that header, decodes the JWT, and returns
     the User ORM object — no database password check needed on every request.

Token structure (payload):
  { "sub": "42", "type": "access", "exp": <unix timestamp> }

Setup token (issued after OAuth, before profile completion):
  { "sub": "<google_id>", "email": "...", "name": "...", "avatar": "...",
    "type": "setup", "exp": <15 minutes> }
  This token only works with POST /api/auth/complete-profile.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import settings
from ..database import SessionLocal
from ..models import User

# FastAPI security scheme — looks for "Authorization: Bearer <token>" header
bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

def create_access_token(user_id: int) -> str:
    """
    Issue a signed JWT for a fully-registered user.
    Expires in ACCESS_TOKEN_EXPIRE_HOURS (default 24h).
    """
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.ACCESS_TOKEN_EXPIRE_HOURS
    )
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_setup_token(google_id: str, email: str, name: str, avatar: Optional[str]) -> str:
    """
    Short-lived token issued after Google OAuth for a NEW user who hasn't
    completed their profile (roll number, dept, year) yet.
    Expires in SETUP_TOKEN_EXPIRE_MINUTES (default 15 min).
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.SETUP_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": google_id,
        "email": email,
        "name": name,
        "avatar": avatar,
        "type": "setup",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ---------------------------------------------------------------------------
# Token decoding
# ---------------------------------------------------------------------------

def _decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises HTTPException on any failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_setup_token(token: str) -> dict:
    """
    Decode a setup token and return its payload.
    Validates that it is the 'setup' type (not an access token).
    """
    payload = _decode_token(token)
    if payload.get("type") != "setup":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — expected setup token",
        )
    return payload


# ---------------------------------------------------------------------------
# FastAPI dependency — use on any protected endpoint
# ---------------------------------------------------------------------------

def _get_db_for_auth():
    with SessionLocal() as session:
        yield session


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(_get_db_for_auth),
) -> User:
    """
    FastAPI dependency that:
      1. Reads the Bearer token from the Authorization header.
      2. Decodes and validates the JWT.
      3. Fetches the User from the database.
      4. Returns the User ORM object to the route handler.

    Usage in a route:
        @router.post("/bids")
        def place_bid(current_user: User = Depends(get_current_user)):
            ...  # current_user is the authenticated User

    Raises 401 if:
      - No token provided
      - Token is expired or invalid
      - User no longer exists in DB
      - Profile is incomplete (no roll number)
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.get(User, int(user_id_str))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    if not user.is_profile_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please complete your profile (roll number required) before proceeding",
        )

    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(_get_db_for_auth),
) -> Optional[User]:
    """
    Like get_current_user but returns None instead of raising 401.
    Use for endpoints that work for both guests and logged-in users
    (e.g. browsing listings — guests can view, only logged-in users can bid).
    """
    if credentials is None:
        return None
    try:
        return get_current_user.__wrapped__(credentials, db)
    except HTTPException:
        return None

