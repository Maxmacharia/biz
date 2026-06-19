# BizCore — Multi-Business Financial & Inventory Management Platform

A production-ready, full-stack web application for small and medium businesses in Kenya to digitize inventory, receipts, invoices, expenses, customer management, and financial reporting — with GIS customer mapping.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| State | Zustand + TanStack Query |
| Maps | React-Leaflet + OpenStreetMap |
| Charts | Recharts |
| Backend | Python 3.11 + FastAPI |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 15 + PostGIS |
| Cache/Queue | Redis + RQ |
| Auth | JWT (access + refresh tokens) |
| Migrations | Alembic |
| PWA | Vite PWA Plugin + Workbox |
| DevOps | Docker + Docker Compose + Nginx |
| CI/CD | GitHub Actions |

---

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose installed
- Git

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd bizcore
cp .env.example .env
# Edit .env with your values (especially SECRET_KEY)
```

### 2. Start all services

```bash
docker compose up --build
```

### 3. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 4. Access the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| API Docs (ReDoc) | http://localhost:8000/api/redoc |

### 5. Register your first business

Open http://localhost:5173/register and create your business account.

---

## Project Structure

```
bizcore/
├── backend/                        # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── api/v1/
│   │   │   ├── router.py           # Central API router
│   │   │   ├── deps.py             # Auth dependencies
│   │   │   └── endpoints/
│   │   │       ├── auth.py         # Register / Login / Refresh
│   │   │       ├── businesses.py   # Business profile
│   │   │       ├── users.py        # Team management
│   │   │       ├── products.py     # Inventory CRUD
│   │   │       ├── customers.py    # Customer CRUD + GIS map
│   │   │       ├── receipts.py     # POS / receipts
│   │   │       ├── invoices.py     # Invoice management
│   │   │       ├── expenses.py     # Expense tracking
│   │   │       ├── dashboard.py    # KPI analytics
│   │   │       ├── reports.py      # P&L / CSV exports
│   │   │       └── websocket.py    # Real-time WS endpoint
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings
│   │   │   ├── database.py         # Async SQLAlchemy engine
│   │   │   └── security.py         # JWT + password hashing
│   │   └── models/
│   │       ├── business.py
│   │       ├── user.py
│   │       ├── product.py
│   │       ├── customer.py         # PostGIS geometry field
│   │       ├── receipt.py
│   │       ├── invoice.py
│   │       ├── expense.py
│   │       ├── transaction.py
│   │       └── audit.py
│   ├── alembic/                    # DB migrations
│   │   ├── env.py
│   │   └── versions/0001_initial.py
│   ├── tests/
│   │   └── test_api.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic.ini
│
├── frontend/                       # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx                 # Router setup
│   │   ├── main.tsx                # Entry point
│   │   ├── index.css               # Tailwind + design tokens
│   │   ├── api/
│   │   │   ├── client.ts           # Axios + token refresh interceptor
│   │   │   └── hooks.ts            # TanStack Query hooks (all modules)
│   │   ├── stores/
│   │   │   └── authStore.ts        # Zustand auth store (persisted)
│   │   ├── hooks/
│   │   │   ├── useOfflineSync.ts   # IndexedDB offline queue + sync
│   │   │   └── useWebSocket.ts     # Real-time dashboard WS
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── AppLayout.tsx   # Sidebar + top bar layout
│   │   │   └── ui/
│   │   │       └── index.tsx       # Shared UI components
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       ├── RegisterPage.tsx
│   │       ├── DashboardPage.tsx   # KPIs, charts, trends
│   │       ├── InventoryPage.tsx   # Product CRUD + stats
│   │       ├── ReceiptsPage.tsx    # Receipt list + CSV export
│   │       ├── NewReceiptPage.tsx  # POS interface
│   │       ├── InvoicesPage.tsx    # Invoice list + status
│   │       ├── NewInvoicePage.tsx  # Invoice builder
│   │       ├── ExpensesPage.tsx    # Expense tracker + pie chart
│   │       ├── CustomersPage.tsx   # Customer CRUD
│   │       ├── CustomerMapPage.tsx # OpenStreetMap + ranking
│   │       ├── ReportsPage.tsx     # P&L / Sales / Inventory / Customers
│   │       └── SettingsPage.tsx    # Business / Team / Security
│   ├── public/
│   │   └── sw.js                   # Service Worker (offline + sync)
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── package.json
│
├── nginx/
│   └── nginx.conf                  # Reverse proxy (production)
├── scripts/
│   └── init_db.sql                 # PostGIS extension setup
├── .github/
│   └── workflows/ci.yml            # GitHub Actions CI/CD
├── docker-compose.yml
└── .env.example
```

---

## Core Features

### 📦 Inventory Management
- Add / edit / delete products with SKU, category, unit
- **Stock acquisition only** — records `cost_price`, not a selling price. Selling price is chosen at the moment of sale because market prices, negotiation, and promotions make a fixed price impractical
- Real-time stock level tracking — automatically decrements on sale
- Low stock alerts (configurable threshold)
- Stock value at cost (acquisition value)
- Bulk category filtering

### 🧾 Receipt / POS
- Point-of-sale interface with product search
- **Selling price entered per line item at the moment of sale** — never pre-filled from inventory
- Live profit preview per line (`selling_price − cost_price`) and for the whole cart, before the sale is completed
- Cash and M-Pesa payment methods with M-Pesa reference field
- Auto-generated receipt numbers
- Customer assignment (walk-in or registered)
- Change calculation
- Discount support
- `cost_price_snapshot` is frozen on each receipt item at sale time, so historical profit stays accurate even if inventory cost later changes

### 📄 Invoice Management
- Create line-item invoices, optionally linked to inventory products or as free-text lines
- **Selling price entered per line at invoice creation** — independent of inventory
- Live profit preview per line for inventory-linked items
- Track status: Draft → Sent → Partial → Paid → Overdue
- Record partial payments
- Due date tracking

### 💸 Expense Tracking
- Categorized expenses (Rent, Utilities, Salaries, etc.)
- Expense trend visualization (pie chart by category)
- Date range filtering

### 👥 Customer Management
- Full CRUD with GPS coordinates
- Outstanding balance and debt tracking
- Lifetime purchase history

### 🗺️ Customer Map (GIS)
- OpenStreetMap base layer via React-Leaflet
- Color-coded markers by purchase tier (green/blue/amber/red)
- Purchase radius visualization (heatmap circles)
- Click-to-get-coordinates for registering new customers
- Ranked customer sidebar

### 📊 Dashboard
- Period selector: Today / Week / Month / Year
- KPI cards: Sales, Expenses, Gross Profit, Net Profit, Low Stock, Pending Invoices
- 7-day area chart trend
- Top products & customers
- Revenue vs Expenses bar chart
- Real-time WebSocket updates

### 📈 Reports
- **Profit & Loss**: Revenue, COGS, Gross Profit, Expenses, Net Profit with margin %
- **Sales Trend**: Day/Week/Month grouping with dual-axis chart
- **Inventory Report**: Per-category breakdown with stock status
- **Customer Report**: Ranking, debt analysis, lifetime value
- **CSV Export**: Sales receipts for any date range

### 🔐 Security
- JWT access tokens (60 min) + refresh tokens (30 days)
- Automatic token refresh via Axios interceptor
- Role-based access: Owner, Manager, Salesperson, Accountant
- bcrypt password hashing
- Multi-tenant data isolation (business_id on every query)

### 📱 PWA / Offline
- Installable as mobile app
- Service Worker caches static assets
- IndexedDB offline queue for mutations
- Automatic background sync when connectivity returns
- Workbox runtime caching for API responses

---

## API Reference

Full interactive docs at: `http://localhost:8000/api/docs`

### Auth
```
POST /api/v1/auth/register    # Create business + owner account
POST /api/v1/auth/login       # Get access + refresh tokens
POST /api/v1/auth/refresh     # Rotate tokens
```

### Core Resources
```
GET|POST        /api/v1/products/
GET|PATCH|DELETE /api/v1/products/{id}
GET             /api/v1/products/stats/summary

GET|POST        /api/v1/customers/
GET             /api/v1/customers/map          # GIS data
GET|PATCH       /api/v1/customers/{id}

GET|POST        /api/v1/receipts/
GET             /api/v1/receipts/{id}

GET|POST        /api/v1/invoices/
PATCH           /api/v1/invoices/{id}/status
PATCH           /api/v1/invoices/{id}/payment

GET|POST        /api/v1/expenses/
GET             /api/v1/expenses/categories
GET|PATCH|DELETE /api/v1/expenses/{id}
```

### Analytics
```
GET /api/v1/dashboard/summary?period=today|week|month|year
GET /api/v1/reports/profit-loss?date_from=&date_to=
GET /api/v1/reports/sales?date_from=&date_to=&group_by=day|week|month
GET /api/v1/reports/inventory
GET /api/v1/reports/customers
GET /api/v1/reports/export/sales-csv?date_from=&date_to=
```

### WebSocket
```
WS /ws/dashboard/{business_id}?token={access_token}
```

Events received:
- `new_sale` — triggers dashboard + inventory refresh
- `low_stock_alert` — toast notification + product refresh
- `ping` — keepalive (client replies with `pong`)

---

## Pricing Model — Important Design Decision

Inventory tracks **stock acquisition** (cost price) only. Selling price is **never stored on the product** — it is captured fresh at the moment of sale, on each receipt or invoice line item, because real-world prices fluctuate constantly (negotiation, seasonal demand, promotions, wholesale variation).

```
Product (inventory)
  └── cost_price            ← fixed at stocking time

ReceiptItem / InvoiceItem (sales transaction)
  └── selling_price         ← entered fresh at the moment of sale
  └── cost_price_snapshot   ← copied from Product.cost_price at sale time, frozen forever
  └── line_total            = quantity × selling_price
  └── profit                = (selling_price − cost_price_snapshot) × quantity
```

Freezing `cost_price_snapshot` on every sale means historical profit reports stay accurate even if you later restock the same product at a different cost.

All P&L, dashboard, and report calculations read `profit` / `line_total` directly from receipt and invoice items — never from a fixed inventory price.

## Database Schema

```
businesses          ← root tenant
  └── users         ← team members with roles
  └── products      ← inventory items
  └── customers     ← with PostGIS geometry point
  └── receipts
        └── receipt_items   ← snapshot of sold products
  └── invoices
        └── invoice_items
  └── expenses
  └── transactions  ← ledger of all money movements
  └── audit_logs    ← JSONB change tracking
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async URL | Required |
| `REDIS_URL` | Redis URL | `redis://redis:6379/0` |
| `SECRET_KEY` | JWT signing key (change in prod!) | Required |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) | — |
| `FRONTEND_URL` | CORS allowed origin | `http://localhost:5173` |
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |
| `VITE_WS_URL` | WebSocket base URL | `ws://localhost:8000` |

---

## Development Commands

```bash
# Start dev environment
docker compose up

# Run migrations
docker compose exec backend alembic upgrade head

# Create a new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Run backend tests
docker compose exec backend pytest tests/ -v

# Access PostgreSQL
docker compose exec db psql -U bizcore -d bizcore_db

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Production Deployment

```bash
# Build production images
docker compose --profile production up --build -d

# Or build individually
docker build -t bizcore-backend ./backend
docker build -t bizcore-frontend ./frontend --target production
```

For cloud deployment (AWS/GCP/DigitalOcean):
1. Push images to container registry
2. Set all env vars as secrets
3. Use managed PostgreSQL with PostGIS extension
4. Use managed Redis
5. Point Nginx to your domain with SSL (Let's Encrypt)

---

## User Roles

| Role | Permissions |
|------|------------|
| **Owner** | Full access — all modules, team management, settings |
| **Manager** | All modules except team management |
| **Salesperson** | Create receipts, view inventory and customers |
| **Accountant** | View all reports, manage expenses and invoices |

---

## Currency

All monetary values are in **Kenya Shillings (KES / KSh)**.

---

## Roadmap (Future)

- [ ] Google OAuth login
- [ ] PDF receipt/invoice generation (ReportLab)
- [ ] M-Pesa Daraja API integration
- [ ] SMS notifications (Africa's Talking)
- [ ] Route optimization for deliveries
- [ ] Advanced GIS territory analysis
- [ ] Mobile app (React Native)
- [ ] Automated scheduled backups
- [ ] Multi-currency support
- [ ] Barcode scanner integration

---

## License

MIT — free to use and modify.
