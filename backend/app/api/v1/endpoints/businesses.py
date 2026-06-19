from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.business import Business

router = APIRouter()


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None


@router.get("/me")
async def get_my_business(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Business).where(Business.id == current_user.business_id))
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return {
        "id": str(business.id),
        "name": business.name,
        "slug": business.slug,
        "description": business.description,
        "phone": business.phone,
        "email": business.email,
        "address": business.address,
        "logo_url": business.logo_url,
        "currency": business.currency,
        "created_at": business.created_at.isoformat(),
    }


@router.patch("/me")
async def update_my_business(
    data: BusinessUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Business).where(Business.id == current_user.business_id))
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(business, field, value)

    await db.commit()
    await db.refresh(business)
    return {"id": str(business.id), "name": business.name, "updated": True}
