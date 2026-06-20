from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

async def import_demo_data(session: AsyncSession):
    # Check if data already exists so we don't duplicate it on every restart
    result = await session.execute(text("SELECT COUNT(*) FROM businesses;"))
    if result.scalar() > 0:
        return # Database already seeded

    # Insert a demo business
    business_id = str(uuid.uuid4())
    await session.execute(text(f"""
        INSERT INTO businesses (id, name, slug, currency, is_active, created_at, updated_at)
        VALUES ('{business_id}', 'Demo Corp', 'demo-corp', 'USD', true, NOW(), NOW());
    """))
    
    # Insert a demo customer with spatial data points
    customer_id = str(uuid.uuid4())
    await session.execute(text(f"""
        INSERT INTO customers (id, business_id, name, phone, email, outstanding_balance, total_purchases, is_active, created_at, updated_at, latitude, longitude, location)
        VALUES ('{customer_id}', '{business_id}', 'Jane Doe', '+123456789', 'jane@example.com', 0.00, 150.00, true, NOW(), NOW(), -1.2921, 36.8219, ST_SetSRID(ST_MakePoint(36.8219, -1.2921), 4326));
    """))
    
    await session.commit()
