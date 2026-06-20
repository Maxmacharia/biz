from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from passlib.context import CryptContext
import uuid

# Initialize password hashing utility to match FastAPI auth security standards
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def import_demo_data(session: AsyncSession):
    # Check if data already exists so we don't duplicate it on every restart
    result = await session.execute(text("SELECT COUNT(*) FROM businesses;"))
    if result.scalar() > 0:
        return # Database already seeded

    # 1. Insert a demo business
    business_id = str(uuid.uuid4())
    await session.execute(text(f"""
        INSERT INTO businesses (id, name, slug, currency, is_active, created_at, updated_at)
        VALUES ('{business_id}', 'Demo Corp', 'demo-corp', 'KES', true, NOW(), NOW());
    """))
    
    # 2. Hash your demo password securely before saving
    raw_password = "DemoPassword123!"
    hashed_password = pwd_context.hash(raw_password)

    # 3. Insert the demo administrator user attached to the business
    user_id = str(uuid.uuid4())
    await session.execute(text(f"""
        INSERT INTO users (id, business_id, email, full_name, hashed_password, role, is_active, is_verified, created_at, updated_at)
        VALUES ('{user_id}', '{business_id}', 'demo@bizcore.com', 'Demo Admin', '{hashed_password}', 'ADMIN', true, true, NOW(), NOW());
    """))
    
    # 4. Insert a demo customer with spatial data points
    customer_id = str(uuid.uuid4())
    await session.execute(text(f"""
        INSERT INTO customers (id, business_id, name, phone, email, outstanding_balance, total_purchases, is_active, created_at, updated_at, latitude, longitude, location)
        VALUES ('{customer_id}', '{business_id}', 'Jane Doe', '+254700000000', 'jane@example.com', 0.00, 150.00, true, NOW(), NOW(), -1.2921, 36.8219, ST_SetSRID(ST_MakePoint(36.8219, -1.2921), 4326));
    """))
    
    await session.commit()
