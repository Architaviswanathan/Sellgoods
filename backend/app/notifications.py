from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Notification, User
from app.schemas import NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationResponse]:
    notifications = database.scalars(
        select(Notification)
        .where(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(50)
    ).all()
    return [NotificationResponse.model_validate(item) for item in notifications]


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = database.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notification.read_at = notification.read_at or datetime.now().astimezone()
    database.commit()
    database.refresh(notification)
    return NotificationResponse.model_validate(notification)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    notifications = database.scalars(
        select(Notification).where(
            Notification.recipient_id == current_user.id,
            Notification.read_at.is_(None),
        )
    ).all()
    for notification in notifications:
        notification.read_at = datetime.now().astimezone()
    database.commit()
