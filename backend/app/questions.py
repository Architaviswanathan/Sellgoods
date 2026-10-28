from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Auction, Notification, Question, User
from app.schemas import QuestionAnswer, QuestionCreate, QuestionResponse

router = APIRouter(prefix="/api/auctions", tags=["questions"])


def serialize_question(question: Question, database: Session) -> QuestionResponse:
    asker = database.get(User, question.asker_id)
    return QuestionResponse(
        id=question.id,
        asker_id=question.asker_id,
        asker=asker.name if asker else "Campus student",
        text=question.text,
        answer=question.answer,
        created_at=question.created_at,
        answered_at=question.answered_at,
    )


@router.post("/{auction_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def ask_question(
    auction_id: int,
    payload: QuestionCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionResponse:
    auction = database.get(Auction, auction_id)
    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")
    if auction.seller_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sellers cannot ask questions on their own listing.")
    if auction.status != "live" or auction.ends_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Questions are closed for this auction.")

    question = Question(auction_id=auction.id, asker_id=current_user.id, text=payload.text.strip())
    database.add(question)
    database.add(Notification(
        recipient_id=auction.seller_id,
        actor_id=current_user.id,
        auction_id=auction.id,
        kind="question",
        message=f"{current_user.name} asked a question about {auction.title}.",
    ))
    database.commit()
    database.refresh(question)
    return serialize_question(question, database)


@router.patch("/{auction_id}/questions/{question_id}", response_model=QuestionResponse)
def answer_question(
    auction_id: int,
    question_id: int,
    payload: QuestionAnswer,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionResponse:
    auction = database.get(Auction, auction_id)
    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")
    if auction.seller_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can answer questions.")
    question = database.scalar(
        select(Question).where(Question.id == question_id, Question.auction_id == auction_id)
    )
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
    if question.answer:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This question already has an answer.")

    question.answer = payload.answer.strip()
    question.answered_at = datetime.now(timezone.utc)
    database.add(Notification(
        recipient_id=question.asker_id,
        actor_id=current_user.id,
        auction_id=auction.id,
        kind="answer",
        message=f"{current_user.name} answered your question about {auction.title}.",
    ))
    database.commit()
    database.refresh(question)
    return serialize_question(question, database)
