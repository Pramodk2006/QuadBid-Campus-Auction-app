"""
api/ai.py — HTTP route handlers for AI Concierge semantic assistant.
"""

from collections.abc import Generator
from typing import List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..services import listing_service, ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


class AiConciergeRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500, description="Natural language search or semantic inquiry")


class AiConciergeResponse(BaseModel):
    reply: str
    recommended_listing_ids: List[int]
    is_available: bool


@router.post("/concierge", response_model=AiConciergeResponse)
async def ask_concierge(
    payload: AiConciergeRequest,
    db: Session = Depends(get_db),
):
    """
    Semantic Campus Concierge powered by Gemini LLM with collegiate domain ontology fallback.
    Maintains strict anti-hallucination guardrails: returns is_available=False if no active
    inventory matches the user's intent or budget.
    """
    # Fetch active listings for catalog context
    active_listings = listing_service.list_listings(db, status="active", limit=100)
    
    result = await ai_service.process_concierge_query(payload.query, active_listings)
    return result
