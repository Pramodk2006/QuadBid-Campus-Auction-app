"""
migrate_supabase.py — Test and initialize remote Supabase PostgreSQL database.
Usage:
  python -m app.migrate_supabase "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
"""

import sys
from sqlalchemy import create_engine, text
from .database import Base
from .models import User, Listing, Bid, Question, WatchlistItem, SavedSearch, AutoBidLimit
from .seed_hundreds import seed_hundreds

def main():
    if len(sys.argv) > 1:
        db_url = sys.argv[1]
    else:
        from .core.config import settings
        db_url = settings.DATABASE_URL

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print(f"Connecting to database...")
    engine = create_engine(db_url, pool_pre_ping=True)

    with engine.connect() as conn:
        if "sqlite" in db_url:
            res = conn.execute(text("SELECT sqlite_version();")).scalar()
            print(f"Connected successfully! SQLite version: {res}")
        else:
            res = conn.execute(text("SELECT version();")).scalar()
            print(f"Connected successfully! PostgreSQL version: {res}")

    print("Creating all tables from declarative models...")
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully in Supabase PostgreSQL!")

if __name__ == "__main__":
    main()
