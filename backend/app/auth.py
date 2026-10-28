from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


def issue_token(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(str(user.id)), user=UserResponse.model_validate(user))


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, database: Session = Depends(get_db)) -> TokenResponse:
    email = normalize_email(str(payload.email))
    domain = settings.campus_email_domain
    if domain and not email.endswith(f"@{domain.lower().lstrip('@')}"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use your campus email address to sign up.")

    existing_user = database.scalar(select(User).where(User.email == email))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    database.add(user)
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from None
    database.refresh(user)
    return issue_token(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, database: Session = Depends(get_db)) -> TokenResponse:
    email = normalize_email(str(payload.email))
    user = database.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    return issue_token(user)
