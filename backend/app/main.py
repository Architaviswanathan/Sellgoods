from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.auctions import router as auctions_router
from app.config import settings
from app.database import Base, engine
from app.dependencies import get_current_user
from app.models import User
from app.schemas import UserResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sellgoods API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(auctions_router)

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)
