from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional, List
from datetime import date
import uuid

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.receipt import Receipt, ReceiptItem, PaymentMethod
from app.models.product import Product
from app.models.customer import Customer

router = APIRouter()


class ReceiptItemCreate(BaseModel):
    """
    selling_price is REQUIRED here - it is entered at the moment of sale,
    not pulled from inventory. cost_price is looked up automatically from
    the product record and frozen as a snapshot for accurate profit tracking.
    """
    product_id: uuid.UUID
    quantity: int
    selling_price: Decimal


class ReceiptCreate(BaseModel):
    customer_id: Optional[uuid.UUID] = None
    items: List[ReceiptItemCreate]
    payment_method: PaymentMethod = PaymentMethod.CASH
    mpesa_reference: Optional[str] = None
    discount_amount: Decimal = Decimal("0")
    amount_paid: Decimal
    notes: Optional[str] = None


async def generate_receipt_number(business_id: uuid.UUID, db: AsyncSession) -> str:
    result = await db.execute(
        select(func.count(Receipt.id)).where(Receipt.business_id == business_id)
    )
    count = result.scalar() or 0
    return f"RCP-{str(business_id)[:8].upper()}-{count + 1:05d}"


def receipt_to_dict(r: Receipt) -> dict:
    return {
        "id": str(r.id),
        "receipt_number": r.receipt_number,
        "business_id": str(r.business_id),
        "customer_id": str(r.customer_id) if r.customer_id else None,
        "subtotal": float(r.subtotal),
        "tax_amount": float(r.tax_amount),
        "discount_amount": float(r.discount_amount),
        "total_amount": float(r.total_amount),
        "amount_paid": float(r.amount_paid),
        "change_amount": float(r.change_amount),
        "payment_method": r.payment_method,
        "mpesa_reference": r.mpesa_reference,
        "notes": r.notes,
        "created_at": r.created_at.isoformat(),
        "total_profit": float(sum((i.profit for i in (r.items or [])), Decimal("0"))),
        "items": [
            {
                "id": str(i.id),
                "product_id": str(i.product_id),
                "product_name": i.product_name,
                "quantity": i.quantity,
                "selling_price": float(i.selling_price),
                "cost_price_snapshot": float(i.cost_price_snapshot),
                "line_total": float(i.line_total),
                "profit": float(i.profit),
            }
            for i in (r.items or [])
        ],
    }


@router.post("/", status_code=201)
async def create_receipt(
    data: ReceiptCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sales workflow:
      1. Look up each product's current cost_price from inventory.
      2. Use the selling_price supplied on the request (entered at sale time).
      3. Compute line_total = quantity * selling_price.
      4. Compute profit = (selling_price - cost_price) * quantity.
      5. Deduct sold quantity from inventory.
    """
    receipt_items = []
    subtotal = Decimal("0")

    for item_data in data.items:
        product_result = await db.execute(
            select(Product).where(
                Product.id == item_data.product_id,
                Product.business_id == current_user.business_id,
                Product.is_active == True,
            )
        )
        product = product_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
        if product.quantity < item_data.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
        if item_data.selling_price <= 0:
            raise HTTPException(status_code=400, detail=f"Selling price must be greater than zero for {product.name}")

        cost_price_snapshot = product.cost_price
        line_total = item_data.selling_price * item_data.quantity
        profit = (item_data.selling_price - cost_price_snapshot) * item_data.quantity
        subtotal += line_total

        receipt_items.append((product, item_data.quantity, item_data.selling_price, cost_price_snapshot, line_total, profit))

    total_amount = subtotal - data.discount_amount
    change_amount = data.amount_paid - total_amount

    receipt_number = await generate_receipt_number(current_user.business_id, db)

    receipt = Receipt(
        business_id=current_user.business_id,
        customer_id=data.customer_id,
        created_by=current_user.id,
        receipt_number=receipt_number,
        subtotal=subtotal,
        discount_amount=data.discount_amount,
        total_amount=total_amount,
        amount_paid=data.amount_paid,
        change_amount=max(change_amount, Decimal("0")),
        payment_method=data.payment_method,
        mpesa_reference=data.mpesa_reference,
        notes=data.notes,
    )
    db.add(receipt)
    await db.flush()

    for product, quantity, selling_price, cost_price_snapshot, line_total, profit in receipt_items:
        item = ReceiptItem(
            receipt_id=receipt.id,
            product_id=product.id,
            product_name=product.name,
            quantity=quantity,
            selling_price=selling_price,
            cost_price_snapshot=cost_price_snapshot,
            line_total=line_total,
            profit=profit,
        )
        db.add(item)
        # Deduct inventory
        product.quantity -= quantity

    # Update customer total purchases
    if data.customer_id:
        cust_result = await db.execute(select(Customer).where(Customer.id == data.customer_id))
        customer = cust_result.scalar_one_or_none()
        if customer:
            customer.total_purchases += total_amount

    # 1. Commit your transaction to save receipt, items, and customer updates
    await db.commit()
    
    # 2. Fetch the fully-loaded receipt with its items to feed the dictionary serializer safely
    from sqlalchemy.orm import selectinload
    
    final_result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items))
        .where(Receipt.id == receipt.id)
    )
    receipt = final_result.scalar_one()

    # 3. Serialize and return safely without triggering lazy loading
    return receipt_to_dict(receipt)


@router.get("/")
async def list_receipts(
    customer_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    payment_method: Optional[PaymentMethod] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload

    query = select(Receipt).options(selectinload(Receipt.items)).where(
        Receipt.business_id == current_user.business_id
    )
    if customer_id:
        query = query.where(Receipt.customer_id == customer_id)
    if date_from:
        query = query.where(func.date(Receipt.created_at) >= date_from)
    if date_to:
        query = query.where(func.date(Receipt.created_at) <= date_to)
    if payment_method:
        query = query.where(Receipt.payment_method == payment_method)
    if search:
        query = query.where(Receipt.receipt_number.ilike(f"%{search}%"))

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(Receipt.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    receipts = result.scalars().all()

    return {
        "items": [receipt_to_dict(r) for r in receipts],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{receipt_id}")
async def get_receipt(
    receipt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Receipt).options(selectinload(Receipt.items)).where(
            Receipt.id == receipt_id,
            Receipt.business_id == current_user.business_id,
        )
    )
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt_to_dict(receipt)
