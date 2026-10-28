"""
api/sales.py — HTTP route handlers for auction closing, seller approval,
and campus handover confirmation.
"""

from collections.abc import Generator
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..database import SessionLocal
from ..models import User
from ..schemas import (
    HandoverConfirmRequest,
    ReportIssueRequest,
    SaleOutcomeRead,
    SellerApprovalRequest,
    SellerRejectionRequest,
)
from ..services import sale_service

router = APIRouter(prefix="/api/listings/{listing_id}", tags=["sales"])


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


@router.get("/outcome", response_model=Optional[SaleOutcomeRead])
def get_sale_outcome(listing_id: int, db: Session = Depends(get_db)):
    """
    Get the sale resolution of an auction lot.
    Returns None if the auction is still active.
    """
    try:
        return sale_service.get_or_create_outcome(db, listing_id=listing_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/approve", response_model=SaleOutcomeRead)
def approve_sale(
    listing_id: int,
    payload: SellerApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Seller approves the provisional winning price.
    Reserves item for winner and generates the campus handshake verification code.
    """
    try:
        return sale_service.approve_sale(
            db,
            listing_id=listing_id,
            seller_id=current_user.id,
            handover_location=payload.handover_location,
            seller_notes=payload.seller_notes,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.post("/reject", response_model=SaleOutcomeRead)
def reject_sale(
    listing_id: int,
    payload: SellerRejectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Seller rejects the provisional winning price.
    """
    try:
        return sale_service.reject_sale(
            db,
            listing_id=listing_id,
            seller_id=current_user.id,
            reason=payload.reason,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.post("/handover", response_model=SaleOutcomeRead)
def confirm_handover(
    listing_id: int,
    payload: HandoverConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Confirm in-person campus handover using the handshake verification code.
    Authorized for seller or provisional winner.
    """
    try:
        return sale_service.confirm_handover(
            db,
            listing_id=listing_id,
            user_id=current_user.id,
            handover_code=payload.handover_code,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/report-issue", response_model=SaleOutcomeRead)
def report_issue(
    listing_id: int,
    payload: ReportIssueRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Record failed pickup or seller cancellation after initial approval.
    """
    try:
        return sale_service.report_issue(
            db,
            listing_id=listing_id,
            user_id=current_user.id,
            issue_type=payload.issue_type,
            reason=payload.reason,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
