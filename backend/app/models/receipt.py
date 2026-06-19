import uuid
import enum
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Numeric, Integer, Text, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    MPESA = "mpesa"
    BANK = "bank"
    CREDIT = "credit"


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    change_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="paymentmethod", values_callable=lambda x: [e.value for e in x]), 
        default=PaymentMethod.CASH
    )
    mpesa_reference: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="receipts")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="receipts")
    items: Mapped[list["ReceiptItem"]] = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

    @property
    def total_profit(self) -> Decimal:
        return sum((i.profit for i in self.items), Decimal("0"))


class ReceiptItem(Base):
    """
    Represents a single line in a sale.

    selling_price is captured at the moment of sale (dynamic, negotiable).
    cost_price_snapshot freezes the product's cost price at sale time so
    historical profit calculations remain accurate even if inventory cost
    changes later.
    profit is computed and stored at creation time: (selling_price - cost_price_snapshot) * quantity
    """
    __tablename__ = "receipt_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("receipts.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)  # snapshot
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)       # entered at sale time
    cost_price_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # frozen from inventory at sale time
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)           # quantity * selling_price
    profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)               # (selling_price - cost_price_snapshot) * quantity

    # Relationships
    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="receipt_items")
