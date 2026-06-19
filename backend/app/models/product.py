import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Product(Base):
    """
    Represents stock acquisition only.

    Selling price is intentionally NOT stored here - it is highly dynamic
    (market fluctuation, negotiation, seasonal demand, promotions) and is
    captured at the moment of sale on ReceiptItem / InvoiceItem instead.
    """
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="pcs")
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="products")
    receipt_items: Mapped[list["ReceiptItem"]] = relationship("ReceiptItem", back_populates="product")
    invoice_items: Mapped[list["InvoiceItem"]] = relationship("InvoiceItem", back_populates="product")

    @property
    def stock_value(self) -> Decimal:
        """Value of current stock at cost price (acquisition value, not sales value)."""
        return self.cost_price * self.quantity

    @property
    def is_low_stock(self) -> bool:
        return self.quantity <= self.low_stock_threshold
