#!/bin/bash
# ==========================================
#  Project Manager - PM2 一键部署脚本
#  无需 Docker，直接用 PM2 管理 Node.js 进程
#
#  用法: bash deploy-pm2.sh
# ==========================================
set -e

echo ""
echo "=========================================="
echo "   Project Manager - PM2 部署"
echo "=========================================="
echo ""

# ---- 颜色定义 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
fail()    { echo -e "${RED}[X]${NC} $1"; exit 1; }

# ---- Step 0: 环境检查 ----
echo "[0/7] 检查运行环境..."

command -v node &>/dev/null  || fail "未检测到 Node.js，请安装 Node.js >= 20"
NODE_VER=$(node -v)
[[ "$NODE_VER" < "v20" ]]   && fail "Node.js 版本过低 ($NODE_VER)，需要 >= 20"
success "Node.js $NODE_VER"

command -v pnpm &>/dev/null  || fail "未检测到 pnpm，请运行: npm install -g pnpm"
success "pnpm $(pnpm -v)"

command -v pm2 &>/dev/null   || fail "未检测到 PM2，请运行: npm install -g pm2"
success "PM2 $(pm2 -v)"

# PostgreSQL 检测：检查 psql 命令或端口连通性
PG_OK=false
if command -v psql &>/dev/null; then
  success "PostgreSQL $(psql --version | head -1 | awk '{print $3}')"
  PG_OK=true
elif node -e "const net=require('net');const s=net.createConnection(5432,'localhost',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)" 2>/dev/null; then
  success "PostgreSQL 端口 5432 可达"
  PG_OK=true
elif docker exec pm-postgres pg_isready -U postgres &>/dev/null; then
  success "PostgreSQL (Docker: pm-postgres) 运行中"
  PG_OK=true
fi
if [ "$PG_OK" = false ]; then
  fail "未检测到 PostgreSQL，请先安装或启动 PostgreSQL"
fi

# ---- Step 1: 检查数据库（延后到依赖安装后用 pg 模块检测）----

# ---- Step 2: 安装依赖 ----
echo ""
echo "[2/7] 安装依赖..."
pnpm install --frozen-lockfile
success "依赖安装完成"

# ---- Step 1b: 检查数据库连接（依赖安装后，可用 pg 模块） ----
echo ""
echo "[1/7] 检查数据库连接..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres123@localhost:5432/project_manager?schema=public}"
# 用 node 脚本文件检测，避免 bash 多行转义问题
cat > /tmp/db-check.js << 'DBEOF'
const { Client } = require(process.argv[1]);
async function main() {
  const url = process.argv[2];
  const c = new Client({ connectionString: url });
  try {
    await c.connect();
    await c.query('SELECT 1');
    console.log('OK');
    await c.end();
  } catch (e) {
    if (e.message && e.message.includes('does not exist')) {
      console.log('NO_DB');
    } else {
      console.log('FAIL:' + e.message);
    }
    try { await c.end(); } catch(_) {}
  }
}
main();
DBEOF

# 找到 pg 模块路径
PG_MOD=$(find node_modules/.pnpm -path "*/pg/lib/index.js" -not -path "*/pg-pool/*" 2>/dev/null | head -1 | sed 's|/lib/index.js||')
if [ -z "$PG_MOD" ]; then
  # 没有 pg 模块，用端口检测跳过
  warn "跳过数据库深度检测（pg 模块未找到）"
else
  DB_RESULT=$(node /tmp/db-check.js "$PG_MOD" "$DB_URL" 2>&1 || true)
  if echo "$DB_RESULT" | grep -q "^OK"; then
    success "数据库连接正常"
  elif echo "$DB_RESULT" | grep -q "NO_DB"; then
    warn "数据库不存在，尝试创建..."
    BASE_URL="postgresql://postgres:postgres123@localhost:5432/postgres"
    CREATE_RESULT=$(node /tmp/db-check.js "$PG_MOD" "$BASE_URL" 2>&1 || true)
    # 用 psql 或 docker exec 创建
    if command -v psql &>/dev/null; then
      psql -h localhost -U postgres -c "CREATE DATABASE project_manager;" 2>/dev/null
    elif docker exec pm-postgres psql -U postgres -c "CREATE DATABASE project_manager;" 2>/dev/null; then
      true
    else
      fail "无法创建数据库，请手动创建: CREATE DATABASE project_manager;"
    fi
    success "数据库创建成功"
  elif echo "$DB_RESULT" | grep -q "FAIL"; then
    fail "数据库连接失败: $DB_RESULT"
  fi
fi
rm -f /tmp/db-check.js

# ---- Step 3: 构建 shared 包 ----
echo ""
echo "[3/7] 构建 shared 包..."
cd packages/shared
TSC=$(find ../../node_modules/.pnpm -path "*/typescript/bin/tsc" 2>/dev/null | head -1)
if [ -n "$TSC" ]; then
  node "$TSC"
else
  npx tsc
fi
# 修正 package.json 的 main 字段
sed -i 's|"main": "./src/index.ts"|"main": "./dist/index.js"|' package.json 2>/dev/null || \
sed -i '' 's|"main": "./src/index.ts"|"main": "./dist/index.js"|' package.json 2>/dev/null || true
cd ../..
success "shared 包构建完成"

# ---- Step 4: 构建后端和前端 ----
echo ""
echo "[4/7] 构建项目..."

echo "  构建 NestJS 后端..."
cd apps/server
PRISMA=$(find ../../node_modules/.pnpm -path "*/prisma/build/index.js" -not -path "*/@prisma/*" 2>/dev/null | head -1)
if [ -n "$PRISMA" ]; then
  node "$PRISMA" generate --schema=prisma/schema.prisma
else
  npx prisma generate --schema=prisma/schema.prisma
fi
cd ../..
cd apps/server
NEST=$(find ../../node_modules/.pnpm -path "*/@nestjs/cli/bin/nest.js" 2>/dev/null | head -1)
if [ -n "$NEST" ]; then
  node "$NEST" build
else
  npx nest build
fi
cd ../..
success "后端构建完成"

echo "  构建 Next.js 前端..."
cd apps/web
NEXT=$(find ../../node_modules/.pnpm -path "*/next/dist/bin/next" 2>/dev/null | head -1)
if [ -n "$NEXT" ]; then
  node "$NEXT" build
else
  npx next build
fi
cd ../..
success "前端构建完成"

# ---- Step 5: 数据库迁移 ----
echo ""
echo "[5/7] 初始化数据库..."
cd apps/server
if [ -n "$PRISMA" ]; then
  node "$PRISMA" db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>/dev/null
else
  npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>/dev/null
fi
cd ../..
success "数据库 Schema 同步完成"

# ---- Step 6: Seed 数据 ----
echo ""
echo "[6/7] 初始化测试数据..."
cd apps/server
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function seed() {
  const count = await prisma.user.count();
  if (count === 0) {
    await prisma.user.createMany({
      data: [
        { employeeNo: 'admin001', name: '系统管理员', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'ADMIN', team: '管理组' },
        { employeeNo: 'z00123123', name: '测试用户', username: 'z00123123', password: bcrypt.hashSync('123456', 10), role: 'MEMBER' },
      ]
    });
    console.log('  已创建测试账号');
  } else {
    console.log('  数据库已有 ' + count + ' 条用户数据，跳过初始化');
  }
  await prisma.\$disconnect();
}
seed().catch(()=>{});
" 2>&1
cd ../..
success "数据初始化完成"

# ---- Step 7: PM2 启动 ----
echo ""
echo "[7/7] 启动 PM2 服务..."

# 停止已有的（如有）
pm2 delete ecosystem.config.js 2>/dev/null || true

pm2 start ecosystem.config.js
pm2 save
success "服务已启动"

# ---- 完成 ----
echo ""
echo "=========================================="
echo "   部署完成！"
echo "=========================================="
echo ""
echo "   前端: http://localhost:4000"
echo "   后端: http://localhost:4001/api"
echo ""
echo "   测试账号:"
echo "     管理员  admin / admin123"
echo "     普通用户 z00123123 / 123456"
echo ""
echo "   PM2 管理命令:"
echo "     状态:  pm2 status"
echo "     日志:  pm2 logs"
echo "     停止:  pm2 stop all"
echo "     重启:  pm2 restart all"
echo "     详情:  pm2 show pm-server"
echo ""
