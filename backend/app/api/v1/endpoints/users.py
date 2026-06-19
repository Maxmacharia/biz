from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.api.v1.deps import get_current_user, get_current_active_owner
from app.models.user import User, UserRole
from app.core.security import get_password_hash

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.SALESPERSON


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


def user_to_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "avatar_url": u.avatar_url,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat(),
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return user_to_dict(current_user)


@router.get("/")
async def list_users(
    current_user: User = Depends(get_current_active_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.business_id == current_user.business_id)
    )
    users = result.scalars().all()
    return [user_to_dict(u) for u in users]


@router.post("/", status_code=201)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(get_current_active_owner),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        business_id=current_user.business_id,
        email=data.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user)


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: User = Depends(get_current_active_owner),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    result = await db.execute(
        select(User).where(
            User.id == uuid.UUID(user_id),
            User.business_id == current_user.business_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    return user_to_dict(user)
