"""
core/config.py — Application settings loaded from environment variables.

Why pydantic-settings?
  - Reads from .env file + real env vars automatically.
  - Type-validates every setting at startup (missing SECRET_KEY = crash early, not later).
  - Single source of truth; every module imports `settings` instead of os.getenv().

For dev: copy .env.example → .env and fill in Google OAuth credentials.
For prod: set env vars directly (no .env file on server).
"""

import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Google OAuth 2.0 ───────────────────────────────────────────────────
    # Get these from https://console.cloud.google.com → APIs & Services → Credentials
    GOOGLE_CLIENT_ID: str = "YOUR_GOOGLE_CLIENT_ID"
    GOOGLE_CLIENT_SECRET: str = "YOUR_GOOGLE_CLIENT_SECRET"

    # Google OAuth redirect URI — must match what you register in Google Console
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # ── JWT ───────────────────────────────────────────────────────────────
    # Generate a strong secret: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = secrets.token_hex(32)   # auto-generated if not in .env
    ALGORITHM: str = "HS256"

    # How long before the access token expires (hours)
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24

    # Short-lived token issued after OAuth but before profile is complete
    SETUP_TOKEN_EXPIRE_MINUTES: int = 15

    # ── College identity ───────────────────────────────────────────────────
    # Only emails ending with this domain are allowed to register
    COLLEGE_EMAIL_DOMAIN: str = "kongu.edu"

    # ── Frontend ──────────────────────────────────────────────────────────
    # Where the React app lives (for CORS and redirect after OAuth)
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./quadbid.db"


settings = Settings()
