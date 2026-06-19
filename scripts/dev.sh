#!/usr/bin/env bash
# BizCore — Development Helper Script
# Usage: ./scripts/dev.sh [command]

set -e

COMPOSE="docker compose"
BACKEND="$COMPOSE exec backend"
FRONTEND="$COMPOSE exec frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[bizcore]${NC} $1"; }
warn() { echo -e "${YELLOW}[bizcore]${NC} $1"; }
err()  { echo -e "${RED}[bizcore]${NC} $1"; }
info() { echo -e "${BLUE}[bizcore]${NC} $1"; }

banner() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     BizCore — Dev Helper             ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
  echo ""
}

cmd_setup() {
  banner
  log "Setting up BizCore for the first time..."

  if [ ! -f ".env" ]; then
    cp .env.example .env
    warn ".env created from .env.example — review and update SECRET_KEY before production!"
  else
    log ".env already exists, skipping copy"
  fi

  log "Building and starting all services..."
  $COMPOSE up --build -d

  log "Waiting for database to be healthy..."
  sleep 8

  log "Running database migrations..."
  $BACKEND alembic upgrade head

  log ""
  log "✅ BizCore is ready!"
  info "  Frontend:  http://localhost:5173"
  info "  API:       http://localhost:8000"
  info "  API Docs:  http://localhost:8000/api/docs"
  info ""
  info "  Register at: http://localhost:5173/register"
}

cmd_start() {
  log "Starting BizCore services..."
  $COMPOSE up -d
  log "Services started. Logs: ./scripts/dev.sh logs"
}

cmd_stop() {
  log "Stopping all services..."
  $COMPOSE down
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_logs() {
  SERVICE=${2:-""}
  if [ -n "$SERVICE" ]; then
    $COMPOSE logs -f "$SERVICE"
  else
    $COMPOSE logs -f
  fi
}

cmd_migrate() {
  log "Running database migrations..."
  $BACKEND alembic upgrade head
  log "Migrations applied."
}

cmd_migration_new() {
  MSG=${2:-"auto_migration"}
  log "Creating new migration: $MSG"
  $BACKEND alembic revision --autogenerate -m "$MSG"
}

cmd_test() {
  log "Running backend tests..."
  $BACKEND pytest tests/ -v --tb=short
}

cmd_shell_backend() {
  log "Opening backend Python shell..."
  $BACKEND python
}

cmd_shell_db() {
  log "Opening PostgreSQL shell..."
  $COMPOSE exec db psql -U bizcore -d bizcore_db
}

cmd_reset_db() {
  warn "⚠️  This will destroy ALL data in the database!"
  read -p "Are you sure? Type 'yes' to confirm: " CONFIRM
  if [ "$CONFIRM" = "yes" ]; then
    log "Dropping and recreating database..."
    $COMPOSE exec db psql -U bizcore -c "DROP DATABASE IF EXISTS bizcore_db;"
    $COMPOSE exec db psql -U bizcore -c "CREATE DATABASE bizcore_db;"
    $COMPOSE exec db psql -U bizcore -d bizcore_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
    $COMPOSE exec db psql -U bizcore -d bizcore_db -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    cmd_migrate
    log "Database reset complete."
  else
    warn "Reset cancelled."
  fi
}

cmd_status() {
  log "Service status:"
  $COMPOSE ps
}

cmd_build() {
  log "Rebuilding all images..."
  $COMPOSE build --no-cache
}

cmd_clean() {
  warn "Removing containers and volumes..."
  $COMPOSE down -v --remove-orphans
  log "Cleaned up."
}

cmd_seed() {
  log "Seeding database with demo data..."
  $BACKEND python -c "
import asyncio
from app.core.database import AsyncSessionLocal
from app.models.business import Business
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.customer import Customer
from app.core.security import get_password_hash
import uuid

async def seed():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        from sqlalchemy import select
        result = await db.execute(select(Business).where(Business.name == 'Demo Business'))
        if result.scalar_one_or_none():
            print('Already seeded.')
            return

        biz = Business(name='Demo Business', slug='demo-' + str(uuid.uuid4())[:8])
        db.add(biz)
        await db.flush()

        owner = User(
            business_id=biz.id,
            email='demo@bizcore.co.ke',
            full_name='Demo Owner',
            hashed_password=get_password_hash('demo1234'),
            role=UserRole.OWNER,
            is_verified=True,
        )
        db.add(owner)

        products = [
            Product(business_id=biz.id, name='Unga Jogoo 2kg', category='Food', quantity=150, cost_price=130, unit='bag'),
            Product(business_id=biz.id, name='Cooking Oil 1L', category='Food', quantity=80, cost_price=190, unit='bottle'),
            Product(business_id=biz.id, name='Sugar 1kg', category='Food', quantity=200, cost_price=110, unit='bag'),
            Product(business_id=biz.id, name='Milk Brookside 500ml', category='Dairy', quantity=40, cost_price=55, unit='pack'),
            Product(business_id=biz.id, name='Airtime Safaricom', category='Airtime', quantity=500, cost_price=9.5, unit='unit'),
        ]
        for p in products: db.add(p)

        customers = [
            Customer(business_id=biz.id, name='Jane Wanjiku', phone='+254712345678', business_type='Retail', latitude=-1.2864, longitude=36.8172, total_purchases=45000),
            Customer(business_id=biz.id, name='Peter Otieno', phone='+254723456789', business_type='Wholesale', latitude=-1.2921, longitude=36.8219, total_purchases=120000),
            Customer(business_id=biz.id, name='Mary Njeri', phone='+254734567890', business_type='Retail', latitude=-1.3000, longitude=36.8100, total_purchases=8500, outstanding_balance=2000),
        ]
        for c in customers: db.add(c)

        await db.commit()
        print('Seed complete! Login: demo@bizcore.co.ke / demo1234')

asyncio.run(seed())
"
}

cmd_help() {
  banner
  echo "Usage: ./scripts/dev.sh <command>"
  echo ""
  echo "Commands:"
  printf "  %-20s %s\n" "setup"        "First-time setup: build, start, migrate"
  printf "  %-20s %s\n" "start"        "Start all services"
  printf "  %-20s %s\n" "stop"         "Stop all services"
  printf "  %-20s %s\n" "restart"      "Restart all services"
  printf "  %-20s %s\n" "logs [svc]"   "Tail logs (optionally for a single service)"
  printf "  %-20s %s\n" "migrate"      "Run pending Alembic migrations"
  printf "  %-20s %s\n" "migrate:new"  "Create new autogenerated migration"
  printf "  %-20s %s\n" "test"         "Run backend test suite"
  printf "  %-20s %s\n" "seed"         "Seed database with demo data"
  printf "  %-20s %s\n" "shell:db"     "Open PostgreSQL interactive shell"
  printf "  %-20s %s\n" "shell:be"     "Open backend Python shell"
  printf "  %-20s %s\n" "status"       "Show Docker service status"
  printf "  %-20s %s\n" "build"        "Rebuild all Docker images (no cache)"
  printf "  %-20s %s\n" "reset:db"     "⚠️  Destroy and recreate database"
  printf "  %-20s %s\n" "clean"        "Remove containers and volumes"
  echo ""
}

COMMAND=${1:-help}
case "$COMMAND" in
  setup)         cmd_setup "$@" ;;
  start)         cmd_start ;;
  stop)          cmd_stop ;;
  restart)       cmd_restart ;;
  logs)          cmd_logs "$@" ;;
  migrate)       cmd_migrate ;;
  migrate:new)   cmd_migration_new "$@" ;;
  test)          cmd_test ;;
  seed)          cmd_seed ;;
  shell:db)      cmd_shell_db ;;
  shell:be)      cmd_shell_backend ;;
  status)        cmd_status ;;
  build)         cmd_build ;;
  reset:db)      cmd_reset_db ;;
  clean)         cmd_clean ;;
  help|--help|-h) cmd_help ;;
  *) err "Unknown command: $COMMAND"; cmd_help; exit 1 ;;
esac
