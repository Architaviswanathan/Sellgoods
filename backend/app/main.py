from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.auctions import router as auctions_router
from app.config import settings
from app.database import Base, engine
from app.dependencies import get_current_user
from app.models import User
from app.notifications import router as notifications_router
from app.questions import router as questions_router
from app.schemas import UserResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sellgoods API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    # Vite picks another port when 5173 is busy, so allow any local port.
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(auctions_router)
app.include_router(questions_router)
app.include_router(notifications_router)

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)
