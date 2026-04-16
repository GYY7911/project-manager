#!/bin/bash
set -e

# ==========================================
#  Offline Deployment Script
#  在断网环境运行，加载镜像并启动服务
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================"
echo "  Project Manager - Offline Deployment"
echo "========================================"
echo ""

# Step 0: Check Docker
echo "[0/6] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "  [ERROR] Docker is not running!"
    echo "  Please start Docker first."
    exit 1
fi
echo "  Docker is running"

# Step 1: Load images
echo "[1/6] Loading Docker images..."
for tar_file in "$SCRIPT_DIR/images/"*.tar; do
    if [ -f "$tar_file" ]; then
        filename=$(basename "$tar_file")
        size=$(du -h "$tar_file" | cut -f1)
        echo "  Loading $filename ($size)..."
        docker load -i "$tar_file"
    fi
done

# Step 2: Start infrastructure
echo "[2/6] Starting database services..."
docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d postgres redis

echo "  Waiting for databases..."
sleep 3

# Wait for postgres
for i in $(seq 1 30); do
    if docker exec pm-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "  PostgreSQL is ready"
        break
    fi
    if [ "$i" = "30" ]; then
        echo "  [ERROR] PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

# Wait for redis
for i in $(seq 1 15); do
    if docker exec pm-redis redis-cli ping > /dev/null 2>&1; then
        echo "  Redis is ready"
        break
    fi
    if [ "$i" = "15" ]; then
        echo "  [ERROR] Redis failed to start"
        exit 1
    fi
    sleep 1
done

# Step 3: Start server
echo "[3/6] Starting server..."
docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d server
sleep 3

# Step 4: Initialize database schema
echo "[4/6] Initializing database schema..."
docker exec pm-server sh -c '
PRISMA=$(find /app/node_modules/.pnpm -path "*/prisma/build/index.js" -not -path "*/@prisma/*" | head -1)
node "$PRISMA" db push --schema=prisma/schema.prisma --skip-generate 2>/dev/null
' && echo "  Schema pushed" || echo "  Schema push skipped (may already exist)"

# Step 5: Seed test data
echo "[5/6] Seeding test data..."
docker exec pm-server node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function seed() {
  const count = await prisma.user.count();
  if (count === 0) {
    await prisma.user.createMany({
      data: [
        { employeeNo: 'admin001', name: 'Admin', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'ADMIN' },
        { employeeNo: 'z00123123', name: 'TestUser', username: 'z00123123', password: bcrypt.hashSync('123456', 10), role: 'MEMBER' },
      ]
    });
    console.log('  Seeded test accounts');
  } else {
    console.log('  Already has ' + count + ' users, skip seed');
  }
  await prisma.\$disconnect();
}
seed().catch(() => {});
" 2>&1

# Step 6: Start web & verify
echo "[6/6] Starting web frontend..."
docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d web
sleep 2

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "  Frontend:  http://localhost:4000"
echo "  Backend:   http://localhost:4001/api"
echo ""
echo "  Test accounts:"
echo "    Admin:  admin / admin123"
echo "    Member: z00123123 / 123456"
echo ""
echo "  Commands:"
echo "    Stop:      docker compose -f docker-compose.prod.yml down"
echo "    Logs:      docker compose -f docker-compose.prod.yml logs -f"
echo "    Status:    docker compose -f docker-compose.prod.yml ps"
echo "    Restart:   docker compose -f docker-compose.prod.yml restart"
echo ""
