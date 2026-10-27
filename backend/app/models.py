"""
models.py — SQLAlchemy ORM models (database table definitions).

Design decisions:
  - starting_price_paise / min_bid_increment_paise stored as INTEGER (paise, not rupees)
    Reason: floating-point arithmetic is unreliable for money comparisons.
    ₹250.00 = 25000 paise.  All bid validation happens in integer paise.
  - status uses a string column with allowed values enforced by the service layer
    (not a DB enum) so we can add statuses without a migration.
  - photos stored as JSON array of URL strings (validated in Pydantic schema).
  - closes_at uses timezone=True so SQLAlchemy stores UTC and restores timezone info.
  - created_at / updated_at use server_default for DB-level timestamps.
"""

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)

    # Temporary development field — will be replaced by FK to users table in Phase 3
    seller_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    condition: Mapped[str] = mapped_column(String(30), nullable=False)

    # JSON array of photo URL strings, e.g. ["https://…/photo1.jpg"]
    photos: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Money stored in integer PAISE (1 ₹ = 100 paise) — avoids float rounding bugs
    starting_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    min_bid_increment_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    closes_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Lifecycle states:
    #   active   — accepting bids
    #   closed   — deadline passed, winner determination in progress
    #   cancelled — seller cancelled before closing
    status: Mapped[str] = mapped_column(
        String(20), default="active", index=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
