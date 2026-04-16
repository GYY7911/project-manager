#!/bin/bash
set -e

# ==========================================
#  打包 npm 依赖（联网环境运行一次）
#
#  产出: deps/pnpm-store.tar.gz (~256MB)
#  拷贝此文件 + 项目源码到离线机器即可部署
# ==========================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPS_DIR="$PROJECT_DIR/deps"

echo ""
echo "=========================================="
echo "   打包 npm 依赖"
echo "=========================================="
echo ""

# 1) 确保 node_modules 最新
echo "[1/3] 安装依赖..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile

# 2) 打包 pnpm store
echo "[2/3] 打包 pnpm store..."
mkdir -p "$DEPS_DIR"
rm -f "$DEPS_DIR/pnpm-store.tar.gz"

# 使用 pnpm store 目录
STORE_PATH=$(pnpm store path 2>/dev/null | tr -d '\r')
STORE_DIRNAME=$(basename "$STORE_PATH")
STORE_PARENT=$(dirname "$STORE_PATH")

echo "  Store: $STORE_PATH"
echo "  压缩中（可能需要几分钟）..."

tar -czf "$DEPS_DIR/pnpm-store.tar.gz" -C "$STORE_PARENT" "$STORE_DIRNAME"

# 3) 汇总
SIZE=$(du -sh "$DEPS_DIR/pnpm-store.tar.gz" | cut -f1)

echo ""
echo "[3/3] 完成！"
echo ""
echo "  产物: deps/pnpm-store.tar.gz ($SIZE)"
echo ""
echo "  离线部署时需要的文件:"
echo "    1. 整个项目源码"
echo "    2. deps/pnpm-store.tar.gz"
echo ""
echo "  部署命令: bash deploy.sh"
echo ""
