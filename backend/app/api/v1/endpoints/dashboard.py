from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, date, timedelta, timezone
from typing import Optional

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.receipt import Receipt, ReceiptItem
from app.models.expense import Expense
from app.models.product import Product
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceStatus

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    period: str = Query("today", regex="^(today|week|month|year)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=now.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:  # year
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    business_id = current_user.business_id

    # Total sales
    sales_result = await db.execute(
        select(func.sum(Receipt.total_amount), func.count(Receipt.id))
        .where(Receipt.business_id == business_id, Receipt.created_at >= start)
    )
    sales_sum, sales_count = sales_result.one()

    # Total expenses
    expense_result = await db.execute(
        select(func.sum(Expense.total_cost))
        .where(Expense.business_id == business_id, Expense.expense_date >= start.date())
    )
    expense_sum = expense_result.scalar()

    # Gross profit - read directly from the stored, pre-computed profit
    # column on each receipt item (profit = (selling_price - cost_price_snapshot) * quantity,
    # captured at the moment of sale).
    profit_result = await db.execute(
        select(func.sum(ReceiptItem.profit))
        .join(Receipt, Receipt.id == ReceiptItem.receipt_id)
        .where(Receipt.business_id == business_id, Receipt.created_at >= start)
    )
    gross_profit = profit_result.scalar() or 0

    total_sales = float(sales_sum or 0)
    total_expenses = float(expense_sum or 0)
    net_profit = float(gross_profit) - total_expenses

    # Inventory stats
    inv_result = await db.execute(
        select(func.count(Product.id))
        .where(
            Product.business_id == business_id,
            Product.is_active == True,
            Product.quantity <= Product.low_stock_threshold,
        )
    )
    low_stock_count = inv_result.scalar() or 0

    # Customer count
    cust_result = await db.execute(
        select(func.count(Customer.id)).where(
            Customer.business_id == business_id, Customer.is_active == True
        )
    )
    customer_count = cust_result.scalar() or 0

    # Pending invoices
    inv_pending_result = await db.execute(
        select(func.sum(Invoice.total_amount - Invoice.amount_paid))
        .where(
            Invoice.business_id == business_id,
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE]),
        )
    )
    pending_invoices = float(inv_pending_result.scalar() or 0)

    # Sales trend (last 7 days)
    trend_data = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
        day_result = await db.execute(
            select(func.sum(Receipt.total_amount), func.count(Receipt.id))
            .where(
                Receipt.business_id == business_id,
                Receipt.created_at >= day_start,
                Receipt.created_at <= day_end,
            )
        )
        day_sum, day_count = day_result.one()
        trend_data.append({
            "date": day.strftime("%Y-%m-%d"),
            "label": day.strftime("%a"),
            "sales": float(day_sum or 0),
            "transactions": day_count or 0,
        })

    # Top products
    top_products_result = await db.execute(
        select(
            ReceiptItem.product_name,
            func.sum(ReceiptItem.quantity).label("qty_sold"),
            func.sum(ReceiptItem.line_total).label("revenue"),
        )
        .join(Receipt, Receipt.id == ReceiptItem.receipt_id)
        .where(Receipt.business_id == business_id, Receipt.created_at >= start)
        .group_by(ReceiptItem.product_name)
        .order_by(func.sum(ReceiptItem.line_total).desc())
        .limit(5)
    )
    top_products = [
        {"name": r.product_name, "qty_sold": r.qty_sold, "revenue": float(r.revenue)}
        for r in top_products_result.all()
    ]

    # Top customers
    top_customers_result = await db.execute(
        select(Customer.name, Customer.total_purchases, Customer.outstanding_balance)
        .where(Customer.business_id == business_id, Customer.is_active == True)
        .order_by(Customer.total_purchases.desc())
        .limit(5)
    )
    top_customers = [
        {
            "name": r.name,
            "total_purchases": float(r.total_purchases),
            "outstanding_balance": float(r.outstanding_balance),
        }
        for r in top_customers_result.all()
    ]

    return {
        "period": period,
        "total_sales": total_sales,
        "sales_count": sales_count or 0,
        "total_expenses": total_expenses,
        "gross_profit": float(gross_profit),
        "net_profit": net_profit,
        "low_stock_count": low_stock_count,
        "customer_count": customer_count,
        "pending_invoices": pending_invoices,
        "sales_trend": trend_data,
        "top_products": top_products,
        "top_customers": top_customers,
    }
