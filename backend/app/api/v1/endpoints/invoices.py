from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional, List
from datetime import date
import uuid

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.models.product import Product

router = APIRouter()


class InvoiceItemCreate(BaseModel):
    """
    selling_price is entered at invoice creation time - not pulled from
    inventory. If product_id is supplied, cost_price is looked up
    automatically from inventory and frozen as a snapshot so profit can be
    computed even if inventory cost changes later. If product_id is omitted
    (a free-text / service line item), cost_price_snapshot defaults to 0.
    """
    product_id: Optional[uuid.UUID] = None
    description: str
    quantity: int
    selling_price: Decimal


class InvoiceCreate(BaseModel):
    customer_id: uuid.UUID
    items: List[InvoiceItemCreate]
    issue_date: date
    due_date: date
    discount_amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    notes: Optional[str] = None
    terms: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount_paid: Decimal


def invoice_to_dict(inv: Invoice) -> dict:
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "business_id": str(inv.business_id),
        "customer_id": str(inv.customer_id),
        "status": inv.status,
        "issue_date": inv.issue_date.isoformat(),
        "due_date": inv.due_date.isoformat(),
        "subtotal": float(inv.subtotal),
        "tax_amount": float(inv.tax_amount),
        "discount_amount": float(inv.discount_amount),
        "total_amount": float(inv.total_amount),
        "amount_paid": float(inv.amount_paid),
        "amount_due": float(inv.amount_due),
        "notes": inv.notes,
        "terms": inv.terms,
        "created_at": inv.created_at.isoformat(),
        "total_profit": float(sum((i.profit for i in (inv.items or [])), Decimal("0"))),
        "items": [
            {
                "id": str(i.id),
                "product_id": str(i.product_id) if i.product_id else None,
                "description": i.description,
                "quantity": i.quantity,
                "selling_price": float(i.selling_price),
                "cost_price_snapshot": float(i.cost_price_snapshot),
                "line_total": float(i.line_total),
                "profit": float(i.profit),
            }
            for i in (inv.items or [])
        ],
    }


async def generate_invoice_number(business_id: uuid.UUID, db: AsyncSession) -> str:
    result = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.business_id == business_id)
    )
    count = result.scalar() or 0
    return f"INV-{str(business_id)[:8].upper()}-{count + 1:05d}"


@router.post("/", status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    line_items = []
    subtotal = Decimal("0")

    for item_data in data.items:
        if item_data.selling_price <= 0:
            raise HTTPException(status_code=400, detail=f"Selling price must be greater than zero for '{item_data.description}'")

        cost_price_snapshot = Decimal("0")
        if item_data.product_id:
            product_result = await db.execute(
                select(Product).where(
                    Product.id == item_data.product_id,
                    Product.business_id == current_user.business_id,
                )
            )
            product = product_result.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
            cost_price_snapshot = product.cost_price

        line_total = item_data.selling_price * item_data.quantity
        profit = (item_data.selling_price - cost_price_snapshot) * item_data.quantity
        subtotal += line_total

        line_items.append((item_data, cost_price_snapshot, line_total, profit))

    total_amount = subtotal + data.tax_amount - data.discount_amount
    invoice_number = await generate_invoice_number(current_user.business_id, db)

    invoice = Invoice(
        business_id=current_user.business_id,
        customer_id=data.customer_id,
        created_by=current_user.id,
        invoice_number=invoice_number,
        issue_date=data.issue_date,
        due_date=data.due_date,
        subtotal=subtotal,
        tax_amount=data.tax_amount,
        discount_amount=data.discount_amount,
        total_amount=total_amount,
        notes=data.notes,
        terms=data.terms,
    )
    db.add(invoice)
    await db.flush()

    for item_data, cost_price_snapshot, line_total, profit in line_items:
        item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item_data.product_id,
            description=item_data.description,
            quantity=item_data.quantity,
            selling_price=item_data.selling_price,
            cost_price_snapshot=cost_price_snapshot,
            line_total=line_total,
            profit=profit,
        )
        db.add(item)

    await db.commit()
    await db.refresh(invoice)
    return invoice_to_dict(invoice)


@router.get("/")
async def list_invoices(
    status: Optional[InvoiceStatus] = None,
    customer_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice).options(selectinload(Invoice.items)).where(
        Invoice.business_id == current_user.business_id
    )
    if status:
        query = query.where(Invoice.status == status)
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)
    if date_from:
        query = query.where(Invoice.issue_date >= date_from)
    if date_to:
        query = query.where(Invoice.issue_date <= date_to)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    invoices = result.scalars().all()

    return {
        "items": [invoice_to_dict(i) for i in invoices],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_to_dict(invoice)


@router.patch("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: uuid.UUID,
    status: InvoiceStatus,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = status
    await db.commit()
    return {"status": status}


@router.patch("/{invoice_id}/payment")
async def record_payment(
    invoice_id: uuid.UUID,
    data: PaymentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.amount_paid = data.amount_paid
    if invoice.amount_paid >= invoice.total_amount:
        invoice.status = InvoiceStatus.PAID
    elif invoice.amount_paid > 0:
        invoice.status = InvoiceStatus.PARTIAL

    await db.commit()
    return {"amount_paid": float(invoice.amount_paid), "status": invoice.status}
