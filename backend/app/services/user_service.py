"""
services/user_service.py — Business logic for user management.

Responsibilities:
  - Look up users by google_id, email, or id.
  - Create new users from Google OAuth profile.
  - Complete a user's profile (roll number, dept, year).
  - Validate college email domain.
  - Dev-login: create test users without real OAuth.

No HTTP or JWT knowledge here — that lives in api/auth.py and core/security.py.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from ..models import User
from ..schemas import DevLoginRequest, ProfileCompleteRequest
from ..core.config import settings


# ---------------------------------------------------------------------------
# Domain validation
# ---------------------------------------------------------------------------

def validate_college_email(email: str) -> bool:
    """Return True only if email ends with the configured college domain."""
    return email.lower().endswith(f"@{settings.COLLEGE_EMAIL_DOMAIN}")


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------

def get_user_by_google_id(db: Session, google_id: str) -> Optional[User]:
    stmt = select(User).where(User.google_id == google_id)
    return db.execute(stmt).scalar_one_or_none()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    stmt = select(User).where(User.email == email.lower())
    return db.execute(stmt).scalar_one_or_none()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_user_by_roll_number(db: Session, roll_number: str) -> Optional[User]:
    stmt = select(User).where(User.roll_number == roll_number.upper())
    return db.execute(stmt).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------

def create_user_from_google(
    db: Session,
    google_id: str,
    email: str,
    name: str,
    avatar_url: Optional[str] = None,
) -> User:
    """
    Called after Google OAuth for a brand-new user.
    Creates the record with is_profile_complete=False.
    The user must call complete_profile() before they can bid or list.
    """
    user = User(
        google_id=google_id,
        email=email.lower(),
        name=name,
        avatar_url=avatar_url,
        is_profile_complete=False,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def complete_profile(db: Session, user: User, payload: ProfileCompleteRequest) -> User:
    """
    Finalize a user's campus identity after OAuth.
    Validates:
      - Roll number is not already taken by another user.
    Sets is_profile_complete=True so the user can start bidding/listing.
    """
    # Check roll number uniqueness
    existing = get_user_by_roll_number(db, payload.roll_number)
    if existing and existing.id != user.id:
        raise ValueError(f"Roll number '{payload.roll_number}' is already registered")

    user.roll_number = payload.roll_number.upper()
    user.department = payload.department.upper()
    user.year = payload.year
    user.phone = payload.phone
    user.is_profile_complete = True
    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Dev / test helpers
# ---------------------------------------------------------------------------

def dev_create_or_get_user(db: Session, payload: DevLoginRequest) -> User:
    """
    DEV ONLY — creates or retrieves a user by email without real OAuth.
    Useful for local testing without Google credentials.
    This function should NEVER be called in production.
    """
    email = payload.email.lower()
    if not validate_college_email(email):
        raise ValueError(
            f"Email must end with @{settings.COLLEGE_EMAIL_DOMAIN}"
        )

    # Return existing user if found
    user = get_user_by_email(db, email)
    if user:
        return user

    # Check roll number not taken
    if get_user_by_roll_number(db, payload.roll_number):
        raise ValueError(f"Roll number '{payload.roll_number}' is already taken")

    user = User(
        google_id=f"dev_{email}",          # fake google_id for dev
        email=email,
        name=payload.name,
        roll_number=payload.roll_number.upper(),
        department=payload.department.upper(),
        year=payload.year,
        is_profile_complete=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
