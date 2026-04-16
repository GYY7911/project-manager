#!/bin/bash
# ==========================================
#  Project Manager - PostgreSQL 安装辅助脚本
#
#  用法: bash scripts/install-services.sh
# ==========================================

echo ""
echo "=========================================="
echo "   PostgreSQL 安装辅助"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ---- 检查是否已安装 ----
if command -v psql &>/dev/null; then
  echo -e "${GREEN}[OK]${NC} PostgreSQL 已安装: $(psql --version | head -1)"
  echo ""
  echo "检查数据库连接..."
  if psql -h localhost -U postgres -c "SELECT version();" &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} 数据库连接正常"
  else
    echo -e "${YELLOW}[!]${NC} 无法连接，可能需要配置认证或启动服务"
  fi
  exit 0
fi

echo -e "${YELLOW}[!]${NC} 未检测到 PostgreSQL"
echo ""

# ---- 检测操作系统 ----
if grep -qi microsoft /proc/version 2>/dev/null; then
  PLATFORM="wsl"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLATFORM="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  PLATFORM="mac"
else
  PLATFORM="unknown"
fi

echo "检测到平台: $PLATFORM"
echo ""

case "$PLATFORM" in
  wsl|linux)
    echo "安装方法（Ubuntu/Debian）："
    echo ""
    echo "  # 添加 PostgreSQL 官方源"
    echo "  sudo apt update"
    echo "  sudo apt install -y curl ca-certificates"
    echo "  sudo install -d /usr/share/postgresql-common/pgdg"
    echo "  sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc"
    echo "  sudo sh -c 'echo \"deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt \$(lsb_release -cs)-pgdg main\" > /etc/apt/sources.list.d/pgdg.list'"
    echo ""
    echo "  # 安装 PostgreSQL 16"
    echo "  sudo apt update"
    echo "  sudo apt install -y postgresql-16"
    echo ""
    echo "  # 启动服务"
    echo "  sudo service postgresql start   # WSL"
    echo "  # 或"
    echo "  sudo systemctl enable postgresql && sudo systemctl start postgresql   # Linux"
    echo ""
    echo "  # 创建数据库"
    echo "  sudo -u postgres psql -c \"CREATE DATABASE project_manager;\""
    echo "  sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'postgres123';\""
    echo ""
    echo "是否自动执行安装？[y/N]"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      echo "安装 PostgreSQL 16..."
      sudo apt update
      sudo apt install -y postgresql-16

      echo "启动 PostgreSQL..."
      if command -v service &>/dev/null; then
        sudo service postgresql start
      else
        sudo systemctl enable postgresql && sudo systemctl start postgresql
      fi

      echo "配置数据库..."
      sudo -u postgres psql -c "CREATE DATABASE project_manager;" 2>/dev/null || true
      sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres123';"

      echo -e "${GREEN}[OK]${NC} PostgreSQL 安装完成"
    fi
    ;;

  mac)
    echo "安装方法（macOS）："
    echo ""
    echo "  brew install postgresql@16"
    echo "  brew services start postgresql@16"
    echo "  createdb project_manager"
    echo ""
    echo "是否自动执行安装？[y/N]"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      brew install postgresql@16
      brew services start postgresql@16
      createdb project_manager 2>/dev/null || true
      echo -e "${GREEN}[OK]${NC} PostgreSQL 安装完成"
    fi
    ;;

  *)
    echo "请手动安装 PostgreSQL："
    echo ""
    echo "  Windows: 下载 https://www.postgresql.org/download/windows/"
    echo "  或运行:  winget install PostgreSQL.PostgreSQL"
    echo ""
    echo "  安装时设置:"
    echo "    - 密码: postgres123"
    echo "    - 端口: 5432"
    echo "    - 勾选 pgAdmin（可选）"
    echo ""
    echo "  安装后打开 pgAdmin 或 psql，创建数据库:"
    echo "    CREATE DATABASE project_manager;"
    ;;
esac

echo ""
echo "完成后运行: bash deploy-pm2.sh"
