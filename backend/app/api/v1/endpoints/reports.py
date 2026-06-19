from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime, timezone
from typing import Optional
import csv
import io

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.receipt import Receipt, ReceiptItem
from app.models.expense import Expense
from app.models.customer import Customer
from app.models.product import Product

router = APIRouter()


@router.get("/profit-loss")
async def profit_loss_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    business_id = current_user.business_id

    # Revenue from receipts
    revenue_result = await db.execute(
        select(func.sum(Receipt.total_amount), func.count(Receipt.id))
        .where(
            Receipt.business_id == business_id,
            func.date(Receipt.created_at) >= date_from,
            func.date(Receipt.created_at) <= date_to,
        )
    )
    revenue, transaction_count = revenue_result.one()

    # Cost of goods sold
    cogs_result = await db.execute(
        select(func.sum(ReceiptItem.cost_price_snapshot * ReceiptItem.quantity))
        .join(Receipt, Receipt.id == ReceiptItem.receipt_id)
        .where(
            Receipt.business_id == business_id,
            func.date(Receipt.created_at) >= date_from,
            func.date(Receipt.created_at) <= date_to,
        )
    )
    cogs = cogs_result.scalar() or 0

    # Expenses
    expense_result = await db.execute(
        select(func.sum(Expense.total_cost))
        .where(
            Expense.business_id == business_id,
            Expense.expense_date >= date_from,
            Expense.expense_date <= date_to,
        )
    )
    total_expenses = expense_result.scalar() or 0

    total_revenue = float(revenue or 0)
    gross_profit = total_revenue - float(cogs)
    net_profit = gross_profit - float(total_expenses)

    # Expense breakdown by category
    expense_categories_result = await db.execute(
        select(Expense.category, func.sum(Expense.total_cost).label("total"))
        .where(
            Expense.business_id == business_id,
            Expense.expense_date >= date_from,
            Expense.expense_date <= date_to,
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.total_cost).desc())
    )
    expense_categories = [
        {"category": r.category, "total": float(r.total)}
        for r in expense_categories_result.all()
    ]

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "revenue": total_revenue,
        "transaction_count": transaction_count or 0,
        "cogs": float(cogs),
        "gross_profit": gross_profit,
        "gross_margin": (gross_profit / total_revenue * 100) if total_revenue else 0,
        "total_expenses": float(total_expenses),
        "net_profit": net_profit,
        "net_margin": (net_profit / total_revenue * 100) if total_revenue else 0,
        "expense_categories": expense_categories,
    }


@router.get("/sales")
async def sales_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    group_by: str = Query("day", regex="^(day|week|month)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    business_id = current_user.business_id

    if group_by == "day":
        period_expr = func.date(Receipt.created_at)
    elif group_by == "week":
        period_expr = func.date_trunc("week", Receipt.created_at)
    else:
        period_expr = func.date_trunc("month", Receipt.created_at)

    result = await db.execute(
        select(
            period_expr.label("period"),
            func.sum(Receipt.total_amount).label("revenue"),
            func.count(Receipt.id).label("transactions"),
        )
        .where(
            Receipt.business_id == business_id,
            func.date(Receipt.created_at) >= date_from,
            func.date(Receipt.created_at) <= date_to,
        )
        .group_by(period_expr)
        .order_by(period_expr)
    )

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "group_by": group_by,
        "data": [
            {
                "period": r.period.isoformat() if hasattr(r.period, "isoformat") else str(r.period),
                "revenue": float(r.revenue),
                "transactions": r.transactions,
            }
            for r in result.all()
        ],
    }


@router.get("/inventory")
async def inventory_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(
            Product.business_id == current_user.business_id,
            Product.is_active == True,
        ).order_by(Product.category, Product.name)
    )
    products = result.scalars().all()

    by_category = {}
    for p in products:
        cat = p.category or "Uncategorized"
        if cat not in by_category:
            by_category[cat] = {"products": [], "stock_value": 0}
        by_category[cat]["products"].append({
            "id": str(p.id),
            "name": p.name,
            "quantity": p.quantity,
            "cost_price": float(p.cost_price),
            "stock_value": float(p.stock_value),
            "is_low_stock": p.is_low_stock,
        })
        by_category[cat]["stock_value"] += float(p.stock_value)

    return {
        "total_products": len(products),
        "total_stock_value": sum(float(p.stock_value) for p in products),
        "low_stock_count": sum(1 for p in products if p.is_low_stock),
        "out_of_stock_count": sum(1 for p in products if p.quantity == 0),
        "by_category": by_category,
    }


@router.get("/customers")
async def customers_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer)
        .where(Customer.business_id == current_user.business_id, Customer.is_active == True)
        .order_by(Customer.total_purchases.desc())
    )
    customers = result.scalars().all()

    return {
        "total_customers": len(customers),
        "customers_with_debt": sum(1 for c in customers if c.outstanding_balance > 0),
        "total_outstanding_debt": sum(float(c.outstanding_balance) for c in customers),
        "total_lifetime_purchases": sum(float(c.total_purchases) for c in customers),
        "top_customers": [
            {
                "id": str(c.id),
                "name": c.name,
                "phone": c.phone,
                "total_purchases": float(c.total_purchases),
                "outstanding_balance": float(c.outstanding_balance),
                "latitude": c.latitude,
                "longitude": c.longitude,
            }
            for c in customers[:20]
        ],
    }


@router.get("/export/sales-csv")
async def export_sales_csv(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items), selectinload(Receipt.customer))
        .where(
            Receipt.business_id == current_user.business_id,
            func.date(Receipt.created_at) >= date_from,
            func.date(Receipt.created_at) <= date_to,
        )
        .order_by(Receipt.created_at)
    )
    receipts = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Receipt No", "Date", "Customer", "Payment Method",
        "Subtotal", "Discount", "Total", "Amount Paid", "Change", "Gross Profit"
    ])
    for r in receipts:
        writer.writerow([
            r.receipt_number,
            r.created_at.strftime("%Y-%m-%d %H:%M"),
            r.customer.name if r.customer else "Walk-in",
            r.payment_method.value,
            float(r.subtotal),
            float(r.discount_amount),
            float(r.total_amount),
            float(r.amount_paid),
            float(r.change_amount),
            float(sum((i.profit for i in r.items), 0)),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sales_{date_from}_{date_to}.csv"},
    )
