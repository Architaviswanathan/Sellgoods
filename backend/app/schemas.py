from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AuctionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=40)
    condition: str = Field(min_length=2, max_length=40)
    description: str = Field(min_length=5, max_length=2000)
    image_url: str | None = Field(default=None, max_length=2_000_000)
    starting_price: int = Field(gt=0)
    increment: int = Field(gt=0)
    ends_at: datetime


class AuctionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=40)
    condition: str | None = Field(default=None, min_length=2, max_length=40)
    description: str | None = Field(default=None, min_length=5, max_length=2000)
    starting_price: int | None = Field(default=None, gt=0)
    increment: int | None = Field(default=None, gt=0)


class BidCreate(BaseModel):
    amount: int = Field(gt=0)


class BidResponse(BaseModel):
    bidder_id: int
    bidder: str
    amount: int
    time: datetime


class AuctionResponse(BaseModel):
    id: int
    seller_id: int
    seller: str
    title: str
    category: str
    condition: str
    description: str
    image: str
    price: int
    starting_price: int
    increment: int
    ends_at: datetime
    status: str
    bids: list[BidResponse] = []
    watched: bool = False
    questions: list[dict] = []
