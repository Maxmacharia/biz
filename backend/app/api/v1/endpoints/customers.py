from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional
import uuid

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer

router = APIRouter()


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    business_type: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    business_type: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    outstanding_balance: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


def customer_to_dict(c: Customer) -> dict:
    return {
        "id": str(c.id),
        "business_id": str(c.business_id),
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "business_type": c.business_type,
        "address": c.address,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "outstanding_balance": float(c.outstanding_balance),
        "total_purchases": float(c.total_purchases),
        "is_active": c.is_active,
        "notes": c.notes,
        "created_at": c.created_at.isoformat(),
    }


@router.get("/")
async def list_customers(
    search: Optional[str] = None,
    has_debt: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer).where(
        Customer.business_id == current_user.business_id,
        Customer.is_active == True,
    )
    if search:
        query = query.where(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
            )
        )
    if has_debt:
        query = query.where(Customer.outstanding_balance > 0)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(Customer.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    customers = result.scalars().all()

    return {
        "items": [customer_to_dict(c) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/map")
async def customers_for_map(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all customers with coordinates for map display."""
    result = await db.execute(
        select(Customer).where(
            Customer.business_id == current_user.business_id,
            Customer.is_active == True,
            Customer.latitude.is_not(None),
            Customer.longitude.is_not(None),
        )
    )
    customers = result.scalars().all()
    return [customer_to_dict(c) for c in customers]


@router.post("/", status_code=201)
async def create_customer(
    data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    customer = Customer(**data.model_dump(), business_id=current_user.business_id)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer_to_dict(customer)


@router.get("/{customer_id}")
async def get_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.business_id == current_user.business_id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer_to_dict(customer)


@router.patch("/{customer_id}")
async def update_customer(
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.business_id == current_user.business_id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return customer_to_dict(customer)
