"""
database.py — Database engine, session factory, and declarative base.

Why SQLAlchemy?
  - Database-agnostic ORM: swap SQLite → PostgreSQL without rewriting app code.
  - SessionLocal gives us a per-request DB session (dependency-injected into routes).
  - Base is the common parent for all ORM models, enabling create_all() to build
    every table from model definitions alone.

Why SQLite for dev?
  - Zero configuration, file-based, ships with Python.
  - check_same_thread=False is required because FastAPI can serve requests from
    multiple threads; SQLAlchemy still ensures thread safety via session scoping.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool
from .core.config import settings

# In production with Supabase, DATABASE_URL is injected via environment variables.
# Supabase URLs often start with postgres://, which SQLAlchemy 2.0 requires as postgresql://
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Supabase Pooler Guardrail:
# Port 5432 is Session Mode (limited to 15 concurrent clients, fails with EMAXCONNSESSION).
# Port 6543 is Transaction Mode (supports high-throughput pool multiplexing).
is_supabase_pooler = "pooler.supabase.com" in database_url
if is_supabase_pooler and ":5432" in database_url:
    database_url = database_url.replace(":5432", ":6543", 1)

connect_args = {}
engine_kwargs = {
    "pool_pre_ping": True,
}

if database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
elif is_supabase_pooler or ":6543" in database_url:
    # Use NullPool when connected to Supabase transaction pooler (port 6543)
    # so connections are released back to PgBouncer immediately without client-side pooling conflicts
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 0
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(
    database_url,
    connect_args=connect_args,
    **engine_kwargs,
)

# expire_on_commit=False: keep attributes accessible after session.commit()
# autoflush=False:        we flush manually for precise transaction control
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """All SQLAlchemy models inherit from this base class."""
    pass

