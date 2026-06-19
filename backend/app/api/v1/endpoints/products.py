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
from app.models.product import Product

router = APIRouter()


class ProductCreate(BaseModel):
    """
    Inventory stocking record. Selling price is NOT part of this model -
    it is captured later, at the moment of sale, on a receipt or invoice.
    """
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: int = 0
    low_stock_threshold: int = 10
    cost_price: Decimal
    unit: str = "pcs"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    cost_price: Optional[Decimal] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None


def product_to_dict(p: Product) -> dict:
    return {
        "id": str(p.id),
        "business_id": str(p.business_id),
        "name": p.name,
        "sku": p.sku,
        "description": p.description,
        "category": p.category,
        "quantity": p.quantity,
        "low_stock_threshold": p.low_stock_threshold,
        "cost_price": float(p.cost_price),
        "unit": p.unit,
        "image_url": p.image_url,
        "is_active": p.is_active,
        "stock_value": float(p.stock_value),
        "is_low_stock": p.is_low_stock,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


@router.get("/")
async def list_products(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).where(
        Product.business_id == current_user.business_id,
        Product.is_active == True,
    )
    if search:
        query = query.where(
            or_(Product.name.ilike(f"%{search}%"), Product.sku.ilike(f"%{search}%"))
        )
    if category:
        query = query.where(Product.category == category)
    if low_stock:
        query = query.where(Product.quantity <= Product.low_stock_threshold)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Product.name)
    result = await db.execute(query)
    products = result.scalars().all()

    return {
        "items": [product_to_dict(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post("/", status_code=201)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stock new inventory. No selling price is recorded here."""
    product = Product(**data.model_dump(), business_id=current_user.business_id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product_to_dict(product)


@router.get("/{product_id}")
async def get_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.business_id == current_user.business_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_dict(product)


@router.patch("/{product_id}")
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.business_id == current_user.business_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product_to_dict(product)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.business_id == current_user.business_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    await db.commit()


@router.get("/stats/summary")
async def inventory_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Inventory summary now reports stock value at COST only.
    Expected profit is no longer shown here because selling price is not
    known until the moment of sale - see /reports/profit-loss for realized profit.
    """
    result = await db.execute(
        select(Product).where(
            Product.business_id == current_user.business_id,
            Product.is_active == True,
        )
    )
    products = result.scalars().all()

    total_stock_value = sum(float(p.stock_value) for p in products)
    low_stock_items = [p for p in products if p.is_low_stock]
    out_of_stock = [p for p in products if p.quantity == 0]

    return {
        "total_products": len(products),
        "total_stock_value": total_stock_value,
        "low_stock_count": len(low_stock_items),
        "out_of_stock_count": len(out_of_stock),
        "low_stock_items": [product_to_dict(p) for p in low_stock_items[:5]],
    }
