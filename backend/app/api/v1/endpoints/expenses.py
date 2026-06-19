from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional
from datetime import date
import uuid

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.expense import Expense

router = APIRouter()


class ExpenseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    quantity: int = 1
    unit_cost: Decimal
    expense_date: date
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit_cost: Optional[Decimal] = None
    expense_date: Optional[date] = None
    notes: Optional[str] = None


def expense_to_dict(e: Expense) -> dict:
    return {
        "id": str(e.id),
        "business_id": str(e.business_id),
        "name": e.name,
        "description": e.description,
        "category": e.category,
        "quantity": e.quantity,
        "unit_cost": float(e.unit_cost),
        "total_cost": float(e.total_cost),
        "expense_date": e.expense_date.isoformat(),
        "notes": e.notes,
        "created_at": e.created_at.isoformat(),
    }


@router.get("/")
async def list_expenses(
    category: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Expense).where(Expense.business_id == current_user.business_id)

    if category:
        query = query.where(Expense.category == category)
    if date_from:
        query = query.where(Expense.expense_date >= date_from)
    if date_to:
        query = query.where(Expense.expense_date <= date_to)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(Expense.expense_date.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    expenses = result.scalars().all()

    return {
        "items": [expense_to_dict(e) for e in expenses],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/", status_code=201)
async def create_expense(
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_cost = data.unit_cost * data.quantity
    expense = Expense(
        **data.model_dump(),
        total_cost=total_cost,
        business_id=current_user.business_id,
        created_by=current_user.id,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense_to_dict(expense)


@router.get("/categories")
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Expense.category, func.sum(Expense.total_cost).label("total"))
        .where(Expense.business_id == current_user.business_id)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.total_cost).desc())
    )
    rows = result.all()
    return [{"category": r.category, "total": float(r.total)} for r in rows]


@router.get("/{expense_id}")
async def get_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.business_id == current_user.business_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense_to_dict(expense)


@router.patch("/{expense_id}")
async def update_expense(
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.business_id == current_user.business_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(expense, field, value)

    # Recalculate total
    expense.total_cost = expense.unit_cost * expense.quantity
    await db.commit()
    await db.refresh(expense)
    return expense_to_dict(expense)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.business_id == current_user.business_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.delete(expense)
    await db.commit()
