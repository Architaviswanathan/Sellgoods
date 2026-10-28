from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Auction, Bid, Notification, Question, User
from app.schemas import AuctionCreate, AuctionResponse, AuctionUpdate, BidCreate, BidResponse, QuestionResponse

router = APIRouter(prefix="/api/auctions", tags=["auctions"])


def broadcast_alert(
    database: Session,
    actor: User,
    auction: Auction,
    kind: str,
    message: str,
) -> None:
    """Send one inbox alert to every student except the person who acted."""
    recipient_ids = database.scalars(select(User.id).where(User.id != actor.id)).all()
    for recipient_id in recipient_ids:
        database.add(Notification(
            recipient_id=recipient_id,
            actor_id=actor.id,
            auction_id=auction.id,
            kind=kind,
            message=message[:240],
        ))
    database.commit()


def serialize_auction(auction: Auction, database: Session) -> AuctionResponse:
    seller = database.get(User, auction.seller_id)
    actual_status = auction.status
    ends_at = auction.ends_at
    if actual_status == "live" and ends_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        bids = database.scalars(select(Bid).where(Bid.auction_id == auction.id).order_by(Bid.created_at, Bid.id)).all()
        actual_status = "closed" if bids else "unsold"
        if auction.status == "live" and actual_status in ("closed", "unsold"):
            auction.status = actual_status
            database.add(Notification(
                recipient_id=auction.seller_id,
                actor_id=auction.seller_id,
                auction_id=auction.id,
                kind="ended",
                message=f"Auction for {auction.title} ended." if actual_status == "closed" else f"Auction for {auction.title} ended (unsold).",
            ))
            database.commit()
    bids = database.scalars(select(Bid).where(Bid.auction_id == auction.id).order_by(Bid.created_at, Bid.id)).all()
    public_bids = []
    for bid in bids:
        bidder = database.get(User, bid.bidder_id)
        public_bids.append(BidResponse(
            bidder_id=bid.bidder_id,
            bidder=bidder.name if bidder else "Campus student",
            amount=bid.amount,
            time=bid.created_at,
        ))
    questions = database.scalars(
        select(Question).where(Question.auction_id == auction.id).order_by(Question.created_at, Question.id)
    ).all()
    public_questions = []
    for question in questions:
        asker = database.get(User, question.asker_id)
        public_questions.append(QuestionResponse(
            id=question.id,
            asker_id=question.asker_id,
            asker=asker.name if asker else "Campus student",
            text=question.text,
            answer=question.answer,
            created_at=question.created_at,
            answered_at=question.answered_at,
        ))
    return AuctionResponse(
        id=auction.id,
        seller_id=auction.seller_id,
        seller=seller.name if seller else "Campus student",
        title=auction.title,
        category=auction.category,
        condition=auction.condition,
        description=auction.description,
        # No stock photo: the client draws a label card from the item's own
        # title and category when the seller has not uploaded a photo.
        image=auction.image_url or "",
        price=auction.current_price,
        starting_price=auction.starting_price,
        increment=auction.increment,
        ends_at=ends_at,
        status=actual_status,
        bids=public_bids,
        questions=public_questions,
    )


@router.get("", response_model=list[AuctionResponse])
def list_auctions(
    database: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[AuctionResponse]:
    auctions = database.scalars(select(Auction).order_by(Auction.created_at.desc())).all()
    return [serialize_auction(auction, database) for auction in auctions]


@router.get("/mine", response_model=list[AuctionResponse])
def list_my_auctions(
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AuctionResponse]:
    auctions = database.scalars(
        select(Auction)
        .where(Auction.seller_id == current_user.id)
        .order_by(Auction.created_at.desc())
    ).all()
    return [serialize_auction(auction, database) for auction in auctions]


@router.post("", response_model=AuctionResponse, status_code=status.HTTP_201_CREATED)
def create_auction(
    payload: AuctionCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuctionResponse:
    ends_at = payload.ends_at
    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    if ends_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Auction close time must be in the future.")
    auction = Auction(
        seller_id=current_user.id,
        title=payload.title.strip(),
        category=payload.category,
        condition=payload.condition,
        description=payload.description.strip(),
        image_url=payload.image_url,
        starting_price=payload.starting_price,
        current_price=payload.starting_price,
        increment=payload.increment,
        ends_at=ends_at,
        status="live",
    )
    database.add(auction)
    database.commit()
    database.refresh(auction)
    broadcast_alert(
        database,
        actor=current_user,
        auction=auction,
        kind="listing",
        message=f"New listing: {auction.title} ({auction.category}) from {current_user.name}.",
    )
    database.refresh(auction)
    return serialize_auction(auction, database)


@router.patch("/{auction_id}", response_model=AuctionResponse)
def update_auction(
    auction_id: int,
    payload: AuctionUpdate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuctionResponse:
    auction = database.get(Auction, auction_id)
    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")
    if auction.seller_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can edit this listing.")
    if auction.status != "live":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This auction is no longer live.")
    if auction.ends_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This auction has closed.")
    has_bids = database.scalar(select(Bid.id).where(Bid.auction_id == auction.id).limit(1)) is not None
    if has_bids:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Listings cannot be edited after bidding starts.")
    price_changed = "starting_price" in payload.model_fields_set
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(auction, key, value)
    if price_changed:
        auction.current_price = payload.starting_price or auction.current_price
    database.commit()
    database.refresh(auction)
    if price_changed:
        broadcast_alert(
            database,
            actor=current_user,
            auction=auction,
            kind="update",
            message=f"{auction.title} now starts at ₹{auction.starting_price}.",
        )
        database.refresh(auction)
    return serialize_auction(auction, database)


@router.post("/{auction_id}/cancel", response_model=AuctionResponse)
def cancel_auction(
    auction_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuctionResponse:
    auction = database.get(Auction, auction_id)
    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")
    if auction.seller_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can cancel this listing.")
    if auction.status != "live":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This auction is no longer live.")
    auction.status = "cancelled"
    database.add(Notification(
        recipient_id=auction.seller_id,
        actor_id=current_user.id,
        auction_id=auction.id,
        kind="outcome",
        message=f"You cancelled {auction.title}.",
    ))
    database.commit()
    database.refresh(auction)
    return serialize_auction(auction, database)


@router.post("/{auction_id}/bids", response_model=AuctionResponse, status_code=status.HTTP_201_CREATED)
def place_bid(
    auction_id: int,
    payload: BidCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuctionResponse:
    auction = database.scalar(select(Auction).where(Auction.id == auction_id).with_for_update())
    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")
    ends_at = auction.ends_at.replace(tzinfo=timezone.utc)
    if auction.status != "live" or ends_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This auction has closed.")
    if auction.seller_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot bid on your own listing.")
    previous_bid = database.scalar(
        select(Bid).where(Bid.auction_id == auction.id).order_by(Bid.amount.desc(), Bid.created_at.desc()).limit(1)
    )
    minimum_bid = auction.current_price + auction.increment if previous_bid else auction.starting_price
    if payload.amount < minimum_bid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"The minimum next bid is ₹{minimum_bid}.")

    bid = Bid(auction_id=auction.id, bidder_id=current_user.id, amount=payload.amount)
    auction.current_price = payload.amount
    if ends_at - datetime.now(timezone.utc) <= timedelta(seconds=30):
        auction.ends_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    database.add(bid)
    database.add(Notification(
        recipient_id=auction.seller_id,
        actor_id=current_user.id,
        auction_id=auction.id,
        kind="bid",
        message=f"{current_user.name} bid ₹{payload.amount} on {auction.title}.",
    ))
    database.commit()
    database.refresh(auction)
    return serialize_auction(auction, database)
