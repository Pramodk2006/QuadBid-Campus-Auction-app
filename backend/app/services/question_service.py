"""
services/question_service.py — Business logic for Buyer & Seller Q&A.

Business Rules:
  1. Only authenticated students with completed profiles (roll numbers) can ask questions.
  2. Questions are strictly public on the listing so all campus buyers benefit.
  3. Only the seller of the listing can post answers to questions (403 Forbidden otherwise).
  4. Listing must exist and not be cancelled.
  5. Both asker and seller identities are preserved with Name + Roll Number.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import Listing, Question, User
from ..schemas import AnswerCreate, QuestionCreate


def _enrich_question(q: Question) -> dict:
    return {
        "id": q.id,
        "listing_id": q.listing_id,
        "asker_id": q.asker_id,
        "asker_name": q.asker.name,
        "asker_display_name": q.asker.display_name,
        "asker_roll_number": q.asker.roll_number,
        "question_text": q.question_text,
        "answer_text": q.answer_text,
        "answered_by_id": q.answered_by_id,
        "answered_by_display_name": q.answered_by.display_name if q.answered_by else None,
        "answered_at": q.answered_at,
        "created_at": q.created_at,
    }


def create_question(
    db: Session,
    listing_id: int,
    asker: User,
    question_in: QuestionCreate,
) -> dict:
    """Submit a question on an auction listing."""
    if not asker.is_profile_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please complete your student profile with your roll number before asking questions.",
        )

    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing {listing_id} not found.",
        )

    if listing.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot ask questions on a cancelled listing.",
        )

    question = Question(
        listing_id=listing.id,
        asker_id=asker.id,
        question_text=question_in.question_text,
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    return _enrich_question(question)


def get_listing_questions(db: Session, listing_id: int) -> list[dict]:
    """Retrieve all public questions for an auction listing."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing {listing_id} not found.",
        )

    questions = (
        db.query(Question)
        .filter(Question.listing_id == listing_id)
        .order_by(Question.created_at.desc())
        .all()
    )

    return [_enrich_question(q) for q in questions]


def answer_question(
    db: Session,
    listing_id: int,
    question_id: int,
    user: User,
    answer_in: AnswerCreate,
) -> dict:
    """Seller provides an official public answer to a buyer question."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing {listing_id} not found.",
        )

    if listing.seller_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seller of this listing can post answers.",
        )

    question = (
        db.query(Question)
        .filter(Question.id == question_id, Question.listing_id == listing_id)
        .first()
    )
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question {question_id} not found on listing {listing_id}.",
        )

    question.answer_text = answer_in.answer_text
    question.answered_by_id = user.id
    question.answered_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(question)

    return _enrich_question(question)

