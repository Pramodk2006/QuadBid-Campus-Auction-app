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

DATABASE_URL = "sqlite:///./quadbid.db"

engine = create_engine(
    DATABASE_URL,
    # SQLite default blocks cross-thread access; we manage safety via sessions
    connect_args={"check_same_thread": False},
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
