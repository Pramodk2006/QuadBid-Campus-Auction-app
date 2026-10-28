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
from .core.config import settings

# In production with Supabase, DATABASE_URL is injected via environment variables.
# Supabase URLs often start with postgres://, which SQLAlchemy 2.0 requires as postgresql://
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
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

