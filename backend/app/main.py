"""
main.py — FastAPI application entry point.

Responsibilities:
  - Create database tables on startup (create_all is idempotent).
  - Mount all route routers.
  - Provide a health-check endpoint.
  - Configure CORS so the React frontend (port 5173) can talk to the API (port 8000).

CORS note:
  In development we allow localhost:5173 (Vite default).
  In production this list must be restricted to the actual deployed domain.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .database import Base, engine
from .api import listings as listings_router
from .api import auth as auth_router
from .api import bids as bids_router
from .api import sales as sales_router
from .api import questions as questions_router
from .api import ws as ws_router
from .api import upload as upload_router
from .api import watchlist as watchlist_router

# Create all tables on startup (no-op if they already exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="QuadBid API",
    description=(
        "A transparent campus auction marketplace. "
        "Every bid is public. Every item finds its next owner."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow the React dev server to call this API
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # fallback CRA port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(listings_router.router)
app.include_router(auth_router.router)
app.include_router(bids_router.router)
app.include_router(sales_router.router)
app.include_router(questions_router.router)
app.include_router(ws_router.router)
app.include_router(upload_router.router)
app.include_router(watchlist_router.router)

# ---------------------------------------------------------------------------
# Static Files — Serve uploaded inspection photos
# ---------------------------------------------------------------------------
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="api_uploads")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["system"])
def health():
    """Quick liveness check — returns 200 if the server is up."""
    return {"status": "ok", "service": "QuadBid API", "version": "0.1.0"}

