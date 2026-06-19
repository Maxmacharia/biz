import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db

TEST_DB_URL = "postgresql+asyncpg://bizcore:bizcore_secret@localhost:5432/bizcore_test"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_and_login(client):
    # Register
    res = await client.post("/api/v1/auth/register", json={
        "business_name": "Test Business",
        "full_name": "Test Owner",
        "email": "test@example.com",
        "password": "testpassword123",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "owner"

    # Login
    res = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "testpassword123",
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_product_crud(client):
    # Get token
    reg = await client.post("/api/v1/auth/register", json={
        "business_name": "Product Test Biz",
        "full_name": "Owner",
        "email": "products@test.com",
        "password": "testpass123",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create product - NOTE: no selling_price. Inventory only tracks
    # acquisition (cost_price), not sale price.
    res = await client.post("/api/v1/products/", headers=headers, json={
        "name": "Test Product",
        "cost_price": 100,
        "quantity": 50,
    })
    assert res.status_code == 201
    product = res.json()
    assert product["name"] == "Test Product"
    assert "selling_price" not in product
    assert product["stock_value"] == 5000.0  # cost_price * quantity

    # List products
    res = await client.get("/api/v1/products/", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] >= 1

    # Update product
    res = await client.patch(f"/api/v1/products/{product['id']}", headers=headers, json={"quantity": 100})
    assert res.status_code == 200
    assert res.json()["quantity"] == 100


@pytest.mark.asyncio
async def test_receipt_dynamic_pricing_and_profit(client):
    """
    Verifies the new dynamic-pricing sales workflow:
      1. Stock a product with only a cost_price (no selling_price).
      2. Sell it on a receipt with a selling_price chosen at sale time.
      3. Confirm line_total and profit are computed correctly and
         cost_price_snapshot is frozen from inventory.
    """
    reg = await client.post("/api/v1/auth/register", json={
        "business_name": "Pricing Test Biz",
        "full_name": "Owner",
        "email": "pricing@test.com",
        "password": "testpass123",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Stock inventory: cost price only
    res = await client.post("/api/v1/products/", headers=headers, json={
        "name": "Sugar 2kg",
        "cost_price": 180,
        "quantity": 50,
    })
    assert res.status_code == 201
    product = res.json()

    # Create a receipt, choosing selling price at the moment of sale
    res = await client.post("/api/v1/receipts/", headers=headers, json={
        "items": [{"product_id": product["id"], "quantity": 3, "selling_price": 220}],
        "amount_paid": 660,
    })
    assert res.status_code == 201
    receipt = res.json()
    item = receipt["items"][0]

    assert item["selling_price"] == 220.0
    assert item["cost_price_snapshot"] == 180.0
    assert item["line_total"] == 660.0          # 3 * 220
    assert item["profit"] == 120.0              # (220 - 180) * 3
    assert receipt["total_profit"] == 120.0

    # Confirm inventory was decremented
    res = await client.get(f"/api/v1/products/{product['id']}", headers=headers)
    assert res.json()["quantity"] == 47

    # Selling the same product again at a different price (market changed)
    # should NOT be blocked by any fixed inventory selling price.
    res = await client.post("/api/v1/receipts/", headers=headers, json={
        "items": [{"product_id": product["id"], "quantity": 2, "selling_price": 250}],
        "amount_paid": 500,
    })
    assert res.status_code == 201
    item2 = res.json()["items"][0]
    assert item2["selling_price"] == 250.0
    assert item2["profit"] == 140.0  # (250 - 180) * 2


@pytest.mark.asyncio
async def test_invoice_dynamic_pricing(client):
    reg = await client.post("/api/v1/auth/register", json={
        "business_name": "Invoice Pricing Biz",
        "full_name": "Owner",
        "email": "invoicepricing@test.com",
        "password": "testpass123",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Stock inventory: cost price only
    prod_res = await client.post("/api/v1/products/", headers=headers, json={
        "name": "Office Chair",
        "cost_price": 3000,
        "quantity": 10,
    })
    product = prod_res.json()

    # Create customer
    cust_res = await client.post("/api/v1/customers/", headers=headers, json={"name": "Acme Corp"})
    customer = cust_res.json()

    # Create invoice with selling price chosen at invoice time
    res = await client.post("/api/v1/invoices/", headers=headers, json={
        "customer_id": customer["id"],
        "issue_date": "2024-01-01",
        "due_date": "2024-01-15",
        "items": [{
            "product_id": product["id"],
            "description": "Office Chair",
            "quantity": 2,
            "selling_price": 4200,
        }],
    })
    assert res.status_code == 201
    invoice = res.json()
    item = invoice["items"][0]

    assert item["selling_price"] == 4200.0
    assert item["cost_price_snapshot"] == 3000.0
    assert item["line_total"] == 8400.0
    assert item["profit"] == 2400.0  # (4200 - 3000) * 2
    assert invoice["total_profit"] == 2400.0


@pytest.mark.asyncio
async def test_customer_crud(client):
    reg = await client.post("/api/v1/auth/register", json={
        "business_name": "Customer Test Biz",
        "full_name": "Owner",
        "email": "customers@test.com",
        "password": "testpass123",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post("/api/v1/customers/", headers=headers, json={
        "name": "John Kamau",
        "phone": "+254700000000",
        "latitude": -1.2921,
        "longitude": 36.8219,
    })
    assert res.status_code == 201
    customer = res.json()
    assert customer["name"] == "John Kamau"
    assert customer["latitude"] == -1.2921
