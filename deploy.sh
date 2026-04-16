#!/bin/bash
# ==========================================
#  Project Manager - 一键部署脚本
#  只需要 Docker，无需安装 Node.js/pnpm 等
#
#  用法: bash deploy.sh
# ==========================================
set -e

echo ""
echo "=========================================="
echo "   Project Manager - 一键部署"
echo "=========================================="
echo ""

# ---- 检查 Docker ----
if ! command -v docker &>/dev/null; then
    echo "[错误] 未检测到 Docker"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "[错误] Docker 未启动"
    echo "请先启动 Docker Desktop"
    exit 1
fi

echo "[1/3] 构建并启动所有服务..."
docker compose up --build -d

# ---- 等待数据库就绪 ----
echo "[2/3] 等待数据库就绪..."
for i in $(seq 1 30); do
    if docker exec pm-postgres pg_isready -U postgres &>/dev/null; then
        break
    fi
    if [ "$i" = "30" ]; then
        echo "[错误] PostgreSQL 启动超时"
        docker compose logs postgres
        exit 1
    fi
    sleep 1
done

# ---- 初始化数据库 ----
echo "[3/3] 初始化数据库..."
docker exec pm-server sh -c '
PRISMA=$(find /app/node_modules/.pnpm -path "*/prisma/build/index.js" -not -path "*/@prisma/*" | head -1)
node "$PRISMA" db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>/dev/null
' && echo "  数据库 Schema 已同步"

docker exec pm-server node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function seed() {
  if ((await prisma.user.count()) === 0) {
    await prisma.user.createMany({
      data: [
        { employeeNo: 'admin001', name: '系统管理员', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'ADMIN', team: '管理组' },
        { employeeNo: 'z00123123', name: '测试用户', username: 'z00123123', password: bcrypt.hashSync('123456', 10), role: 'MEMBER' },
      ]
    });
    console.log('  已创建测试账号');
  } else {
    console.log('  数据库已有数据，跳过初始化');
  }
  await prisma.\$disconnect();
}
seed().catch(()=>{});
" 2>&1

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
echo "   管理命令:"
echo "     停止: docker compose down"
echo "     日志: docker compose logs -f"
echo "     重启: docker compose restart"
echo ""
