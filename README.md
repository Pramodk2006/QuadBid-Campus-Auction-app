# QuadBid — Campus Auction Marketplace

> **A transparent, real-time auction platform where campus items find their next owner.**

## Overview

QuadBid lets university students list used items (cycles, calculators, books, electronics) for time-limited auctions. Every bid is public, every item gets a fair shot, and the seller has the final say on approval.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI (Python) |
| ORM | SQLAlchemy 2.0 |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Validation | Pydantic v2 |
| Frontend | React + Vite + Tailwind CSS |
| Real-time | WebSocket (Phase 5) |

---

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs  
Health check: http://localhost:8000/api/health

### Frontend *(Phase 2)*

```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints (Phase 1A)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server liveness check |
| POST | `/api/listings` | Create a listing |
| GET | `/api/listings` | Browse & filter listings |
| GET | `/api/listings/{id}` | Listing detail |
| PATCH | `/api/listings/{id}` | Edit a listing |
| DELETE | `/api/listings/{id}` | Cancel a listing |

---

## Running Tests

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v
```

---

## Project Structure

```
quadbid/
├── backend/
│   ├── app/
│   │   ├── api/            # HTTP route handlers
│   │   ├── services/       # Business logic
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── database.py     # DB engine & session
│   │   └── main.py         # FastAPI app entry point
│   ├── tests/              # pytest test suite
│   └── requirements.txt
├── frontend/               # React app (Phase 2)
├── DESIGN.md               # Design system specification
└── README.md
```

---

## Build Progress

- [x] Phase 1A — Listing CRUD backend
- [ ] Phase 1B — Bidding engine
- [ ] Phase 2 — React frontend
- [ ] Phase 3 — Authentication
- [ ] Phase 4 — Closing & sale lifecycle
- [ ] Phase 5 — Real-time updates
- [ ] Phase 6 — Q&A, watchlists, auto-bidding, AI assistant
