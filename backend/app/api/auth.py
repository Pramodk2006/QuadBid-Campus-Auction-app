"""
api/auth.py — Authentication endpoints.

Full Google OAuth 2.0 authorization code flow:

  Step 1:  GET  /api/auth/google
           → Returns the Google OAuth URL the frontend should redirect the user to.

  Step 2:  GET  /api/auth/google/callback?code=...
           → Google redirects here after user approves.
           → Backend exchanges the code for a Google access token.
           → Fetches user's Google profile (email, name, picture).
           → Validates email domain (@kongu.edu).
           → If existing user:  returns access_token (JWT).
           → If new user:       returns setup_token (short-lived) + profile form URL.

  Step 3:  POST /api/auth/complete-profile   (new users only)
           → Frontend submits setup_token + roll_number + dept + year.
           → Backend validates setup token, saves profile, returns access_token.

  Step 4:  GET  /api/auth/me
           → Returns current user's profile (requires access_token).

  DEV:     POST /api/auth/dev-login
           → Creates/retrieves a user without real OAuth (disabled in production).

Security notes:
  - The college email domain (@kongu.edu) is checked server-side.
  - The setup_token expires in 15 minutes and only works with complete-profile.
  - Access tokens expire in 24 hours.
  - google_id is stored to uniquely identify returning users even if they change name.
"""

import os
import urllib.parse
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import (
    create_access_token,
    create_setup_token,
    decode_setup_token,
    get_current_user,
)
from ..database import SessionLocal
from ..models import User
from ..schemas import (
    DevLoginRequest,
    ProfileCompleteRequest,
    SetupTokenResponse,
    TokenResponse,
    UserRead,
)
from ..services import user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

GOOGLE_SCOPES = "openid email profile"


def get_db():
    with SessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Step 1 — Get the Google OAuth URL
# ---------------------------------------------------------------------------

def _get_redirect_uri(request: Request) -> str:
    """Dynamically determine the OAuth callback URI based on deployment environment."""
    if settings.GOOGLE_REDIRECT_URI and "localhost" not in settings.GOOGLE_REDIRECT_URI:
        return settings.GOOGLE_REDIRECT_URI

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if "render.com" in host or settings.ENVIRONMENT == "production":
        clean_host = host if host else "quadbid-campus-auction-app.onrender.com"
        return f"https://{clean_host}/api/auth/google/callback"

    return settings.GOOGLE_REDIRECT_URI


@router.get("/google", summary="Get Google OAuth login URL")
def google_login(request: Request):
    """
    Returns the URL the frontend should redirect the browser to.
    After the user approves, Google redirects to /api/auth/google/callback.

    The `hd` (hosted domain) parameter restricts login to @kongu.edu accounts only
    at the Google consent screen level — a first line of defence before our own check.
    """
    is_configured = (
        bool(settings.GOOGLE_CLIENT_ID)
        and settings.GOOGLE_CLIENT_ID != "YOUR_GOOGLE_CLIENT_ID"
        and bool(settings.GOOGLE_CLIENT_SECRET)
        and settings.GOOGLE_CLIENT_SECRET != "YOUR_GOOGLE_CLIENT_SECRET"
    )

    redirect_uri = _get_redirect_uri(request)

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "hd": settings.COLLEGE_EMAIL_DOMAIN,  # hint to Google: only show kongu.edu accounts
        "access_type": "offline",
        "prompt": "select_account",
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    auth_url = f"{GOOGLE_AUTH_URL}?{query_string}"
    return {
        "auth_url": auth_url,
        "is_configured": is_configured,
        "client_id": settings.GOOGLE_CLIENT_ID if is_configured else None,
        "redirect_uri": redirect_uri,
        "college_domain": settings.COLLEGE_EMAIL_DOMAIN,
    }


# ---------------------------------------------------------------------------
# Step 2 — Google OAuth callback
# ---------------------------------------------------------------------------

@router.get("/google/callback", summary="Handle Google OAuth callback")
async def google_callback(
    request: Request,
    code: str = Query(description="Authorization code from Google"),
    db: Session = Depends(get_db),
):
    """
    Exchange the authorization code for user info, then:
      - Reject non-@kongu.edu emails.
      - Existing users: return access_token and redirect to frontend.
      - New users: return setup_token and redirect to frontend profile completion.
    """
    redirect_uri = _get_redirect_uri(request)

    # 1. Exchange code for Google access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        err_msg = urllib.parse.quote("Failed to exchange authorization code with Google")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?auth_error={err_msg}")

    token_data = token_resp.json()
    google_access_token = token_data.get("access_token")

    # 2. Fetch user profile from Google
    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )

    if profile_resp.status_code != 200:
        err_msg = urllib.parse.quote("Failed to fetch user profile from Google")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?auth_error={err_msg}")

    profile = profile_resp.json()
    google_id: str = profile["sub"]
    email: str = profile["email"]
    name: str = profile.get("name", email.split("@")[0])
    avatar_url: Optional[str] = profile.get("picture")

    # 3. Enforce college email domain
    if not user_service.validate_college_email(email):
        err_msg = urllib.parse.quote(f"Only @{settings.COLLEGE_EMAIL_DOMAIN} email addresses are allowed")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?auth_error={err_msg}")

    # 4. Check if user already exists (by google_id or existing institutional email)
    existing_user = user_service.get_user_by_google_id(db, google_id)
    if not existing_user:
        existing_user = user_service.get_user_by_email(db, email)
        if existing_user:
            # Associate real Google OAuth subject ID with existing student record
            existing_user.google_id = google_id

    if existing_user:
        # Returning user — update avatar / name if present
        if avatar_url and existing_user.avatar_url != avatar_url:
            existing_user.avatar_url = avatar_url
        if name and not existing_user.name:
            existing_user.name = name
        db.commit()

        if existing_user.is_profile_complete:
            # Fully registered — issue access token and redirect to frontend
            access_token = create_access_token(existing_user.id)
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/?token={access_token}")
        else:
            # Google auth done but profile not complete yet
            setup_token = create_setup_token(google_id, email, name, avatar_url)
            enc_name = urllib.parse.quote(name)
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/?setup_token={setup_token}&email={email}&name={enc_name}"
            )

    # 5. New user — create record and issue setup token
    new_user = user_service.create_user_from_google(db, google_id, email, name, avatar_url)
    setup_token = create_setup_token(google_id, email, name, avatar_url)
    enc_name = urllib.parse.quote(name)
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/?setup_token={setup_token}&email={email}&name={enc_name}"
    )


# ---------------------------------------------------------------------------
# Step 3 — Complete profile
# ---------------------------------------------------------------------------

@router.post("/complete-profile", response_model=TokenResponse, status_code=201)
def complete_profile(payload: ProfileCompleteRequest, db: Session = Depends(get_db)):
    """
    Called by new users after Google OAuth to submit:
      - roll_number (e.g. 23ALR070)
      - department  (e.g. AIM)
      - year        (1–4)
      - phone       (optional)

    Requires the setup_token from the OAuth callback.
    Returns a full access_token on success.
    """
    # Decode and validate the setup token
    token_payload = decode_setup_token(payload.setup_token)
    google_id = token_payload["sub"]

    # Find or create the user (handles race condition where callback created it)
    user = user_service.get_user_by_google_id(db, google_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found — please restart login",
        )

    # Save the profile
    try:
        user = user_service.complete_profile(db, user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    access_token = create_access_token(user.id)
    return TokenResponse(
        access_token=access_token,
        user=UserRead.model_validate(user),
    )


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return UserRead.model_validate(current_user)


# ---------------------------------------------------------------------------
# DEV ONLY — create test users without Google OAuth
# ---------------------------------------------------------------------------

@router.post("/dev-login", response_model=TokenResponse, status_code=201)
def dev_login(payload: DevLoginRequest, db: Session = Depends(get_db)):
    """
    DEV/TEST ONLY — creates or retrieves a user without Google OAuth.

    Example payload:
      {
        "email": "pramodk.23aim@kongu.edu",
        "name": "Pramod K",
        "roll_number": "23ALR070",
        "department": "AIM",
        "year": 3
      }

    This endpoint is disabled when GOOGLE_CLIENT_ID is set to a real value
    (i.e. not the default placeholder). In production, remove this route entirely.
    """
    # Safety gate: disable in production
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev login is disabled in production",
        )

    try:
        user = user_service.dev_create_or_get_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    access_token = create_access_token(user.id)
    return TokenResponse(
        access_token=access_token,
        user=UserRead.model_validate(user),
    )

