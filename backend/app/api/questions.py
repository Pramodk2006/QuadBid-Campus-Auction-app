"""
api/questions.py — Endpoints for Buyer Questions and Seller Answers.
"""

from collections.abc import Generator
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..core.websocket import manager
from ..database import SessionLocal
from ..models import User
from ..schemas import AnswerCreate, QuestionCreate, QuestionRead
from ..services import question_service

router = APIRouter(prefix="/api/listings", tags=["questions"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


@router.post(
    "/{listing_id}/questions",
    response_model=QuestionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ask a public question on an auction listing",
)
async def ask_question(
    listing_id: int,
    payload: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated students can post public questions regarding item condition,
    handover schedule, or accessories before placing bids.
    """
    result = question_service.create_question(
        db=db,
        listing_id=listing_id,
        asker=current_user,
        question_in=payload,
    )
    # Broadcast to room
    await manager.broadcast_listing(listing_id, {
        "type": "NEW_QUESTION",
        "listing_id": listing_id,
        "question": {
            "id": result["id"],
            "asker_display_name": result["asker_display_name"],
            "question_text": result["question_text"],
        },
    })
    return result


@router.get(
    "/{listing_id}/questions",
    response_model=List[QuestionRead],
    summary="Get all public questions and seller answers for a listing",
)
def get_questions(
    listing_id: int,
    db: Session = Depends(get_db),
):
    """
    Public transparent Q&A thread. Anyone (even unauthenticated visitors)
    can review answers to common questions to avoid redundant questions.
    """
    return question_service.get_listing_questions(db=db, listing_id=listing_id)


@router.post(
    "/{listing_id}/questions/{question_id}/answer",
    response_model=QuestionRead,
    summary="Seller answers a public question",
)
async def answer_question(
    listing_id: int,
    question_id: int,
    payload: AnswerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Only the listing's seller can post an answer. The answer is posted
    publicly with the seller's display name and timestamp.
    """
    result = question_service.answer_question(
        db=db,
        listing_id=listing_id,
        question_id=question_id,
        user=current_user,
        answer_in=payload,
    )
    # Broadcast to room
    await manager.broadcast_listing(listing_id, {
        "type": "NEW_ANSWER",
        "listing_id": listing_id,
        "question_id": question_id,
        "answer_text": result["answer_text"],
        "answered_by_display_name": result["answered_by_display_name"],
    })
    return result

