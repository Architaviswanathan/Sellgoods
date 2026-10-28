from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Auction, User
from app.schemas import AuctionCreate, AuctionResponse, AuctionUpdate

router = APIRouter(prefix="/api/auctions", tags=["auctions"])


def serialize_auction(auction: Auction, database: Session) -> AuctionResponse:
    seller = database.get(User, auction.seller_id)
    actual_status = auction.status
    ends_at = auction.ends_at
    if actual_status == "live" and ends_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        actual_status = "unsold"
    return AuctionResponse(
        id=auction.id,
        seller_id=auction.seller_id,
        seller=seller.name if seller else "Campus student",
        title=auction.title,
        category=auction.category,
        condition=auction.condition,
        description=auction.description,
        image=auction.image_url or "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=960&q=85",
        price=auction.current_price,
        starting_price=auction.starting_price,
        increment=auction.increment,
        ends_at=ends_at,
        status=actual_status,
    )


@router.get("", response_model=list[AuctionResponse])
def list_auctions(
    database: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[AuctionResponse]:
    auctions = database.scalars(select(Auction).order_by(Auction.created_at.desc())).all()
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
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(auction, key, value)
    if "starting_price" in payload.model_fields_set:
        auction.current_price = payload.starting_price
    database.commit()
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
    database.commit()
    database.refresh(auction)
    return serialize_auction(auction, database)
