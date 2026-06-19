"""Inventory pricing correction - remove selling_price from products,
add selling_price/cost_price_snapshot/line_total/profit to receipt_items
and invoice_items.

Revision ID: 0002_dynamic_pricing
Revises: 0001_initial
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_dynamic_pricing'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── products: drop selling_price (no longer attached to inventory) ──────
    op.drop_column('products', 'selling_price')

    # ── receipt_items: rename unit_price -> selling_price, total_price -> line_total ──
    op.alter_column('receipt_items', 'unit_price', new_column_name='selling_price')
    op.alter_column('receipt_items', 'total_price', new_column_name='line_total')
    op.alter_column('receipt_items', 'cost_price', new_column_name='cost_price_snapshot')

    # Add computed profit column, backfill, then enforce NOT NULL
    op.add_column('receipt_items', sa.Column('profit', sa.Numeric(12, 2), nullable=True))
    op.execute("""
        UPDATE receipt_items
        SET profit = (selling_price - cost_price_snapshot) * quantity
    """)
    op.alter_column('receipt_items', 'profit', nullable=False)

    # ── invoice_items: add selling_price, cost_price_snapshot, line_total, profit ──
    op.alter_column('invoice_items', 'unit_price', new_column_name='selling_price')
    op.alter_column('invoice_items', 'total_price', new_column_name='line_total')

    op.add_column('invoice_items', sa.Column('cost_price_snapshot', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.add_column('invoice_items', sa.Column('profit', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.execute("""
        UPDATE invoice_items
        SET cost_price_snapshot = 0, profit = 0
        WHERE cost_price_snapshot IS NULL
    """)
    op.alter_column('invoice_items', 'cost_price_snapshot', nullable=False, server_default=None)
    op.alter_column('invoice_items', 'profit', nullable=False, server_default=None)


def downgrade() -> None:
    # ── invoice_items: revert ────────────────────────────────────────────────
    op.drop_column('invoice_items', 'profit')
    op.drop_column('invoice_items', 'cost_price_snapshot')
    op.alter_column('invoice_items', 'line_total', new_column_name='total_price')
    op.alter_column('invoice_items', 'selling_price', new_column_name='unit_price')

    # ── receipt_items: revert ────────────────────────────────────────────────
    op.drop_column('receipt_items', 'profit')
    op.alter_column('receipt_items', 'cost_price_snapshot', new_column_name='cost_price')
    op.alter_column('receipt_items', 'line_total', new_column_name='total_price')
    op.alter_column('receipt_items', 'selling_price', new_column_name='unit_price')

    # ── products: restore selling_price ──────────────────────────────────────
    op.add_column('products', sa.Column('selling_price', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.execute("UPDATE products SET selling_price = cost_price WHERE selling_price IS NULL")
    op.alter_column('products', 'selling_price', nullable=False, server_default=None)
