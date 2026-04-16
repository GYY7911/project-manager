# 部署指南

本指南提供两种部署方式：

| 方式 | 适用场景 | 依赖 |
|------|----------|------|
| **PM2 部署（推荐）** | 不允许使用 Docker 的环境 | Node.js + PM2 + PostgreSQL |
| **Docker 部署** | 允许使用 Docker 的环境 | Docker + Docker Compose |

---

## 方式一：PM2 部署（推荐，无需 Docker）

### 架构

```
PostgreSQL（系统原生服务）
PM2 进程管理器
  ├── pm-server（NestJS 后端，端口 4001）
  └── pm-web  （Next.js 前端，端口 4000）
```

### 前提条件

目标机器需要安装：

| 软件 | 版本 | 安装命令 |
|------|------|----------|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org/) |
| pnpm | 9.x | `npm install -g pnpm@9.15.0` |
| PM2 | 最新 | `npm install -g pm2` |
| PostgreSQL | 16 | 见下方安装说明 |

### PostgreSQL 安装

提供辅助脚本，自动检测平台并引导安装：

```bash
bash scripts/install-services.sh
```

或手动安装：

**Windows：**
```bash
# 方式一：winget
winget install PostgreSQL.PostgreSQL

# 方式二：下载安装包
# https://www.postgresql.org/download/windows/
# 安装时设置密码: postgres123, 端口: 5432

# 创建数据库（安装完成后在 psql 或 pgAdmin 中执行）
psql -U postgres -c "CREATE DATABASE project_manager;"
```

**WSL / Ubuntu / Debian：**
```bash
sudo apt update && sudo apt install -y postgresql-16
sudo service postgresql start
sudo -u postgres psql -c "CREATE DATABASE project_manager;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres123';"
```

**macOS：**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb project_manager
```

### 一键部署

```bash
bash deploy-pm2.sh
```

脚本会自动完成：环境检查 → 安装依赖 → 构建 → 数据库初始化 → 启动服务

### 验证

```bash
pm2 status
# 应显示 pm-server 和 pm-web 都是 online 状态
```

- 前端：http://localhost:4000
- 后端 API：http://localhost:4001/api
- 默认管理员账号：`admin` / `admin123`

### 运维命令

```bash
# 快捷运维（推荐）
bash scripts/pm2-ops.sh status     # 查看状态
bash scripts/pm2-ops.sh logs       # 查看日志
bash scripts/pm2-ops.sh restart    # 重启服务
bash scripts/pm2-ops.sh db-backup  # 备份数据库
bash scripts/pm2-ops.sh rebuild    # 重新构建并重启

# 直接使用 PM2
pm2 status                         # 查看所有进程
pm2 logs                           # 查看日志
pm2 logs pm-server                 # 只看后端日志
pm2 restart all                    # 重启所有
pm2 stop all                       # 停止所有
pm2 monit                          # 实时监控面板
```

### 离线 PM2 部署

适用于完全断网的环境。

**步骤 1：联网环境 — 打包依赖**

```bash
bash scripts/package-deps.sh
```

产物：`deps/pnpm-store.tar.gz`（约 256MB）

**步骤 2：传输文件到离线机器**

将以下文件复制到目标机器：
- 整个项目源码
- `deps/pnpm-store.tar.gz`

**步骤 3：离线环境 — 安装依赖**

```bash
# 解压 pnpm store
mkdir -p ~/.local/share/pnpm/store
tar -xzf deps/pnpm-store.tar.gz -C ~/.local/share/pnpm/store

# 配置使用本地 store
echo "store-dir=$HOME/.local/share/pnpm/store/v3" >> .npmrc

# 离线安装
pnpm install --frozen-lockfile --offline
```

**步骤 4：离线环境 — 构建并启动**

```bash
bash deploy-pm2.sh
```

> **注意**：离线环境需要预先安装好 Node.js、pnpm、PM2 和 PostgreSQL。
> 可提前将安装包一并拷贝。

---

## 方式二：Docker 部署

### 前提条件

目标机器需要安装：
- **Docker** (>= 20.10)
- **Docker Compose** (>= 2.0)

```bash
docker --version
docker compose version
```

### 一键部署

```bash
bash deploy.sh
```

### 离线 Docker 部署

#### 步骤 1：联网环境 — 构建镜像

```bash
bash scripts/build-offline.sh
```

产物目录结构：
```
offline-bundle/
├── images/
│   ├── postgres.tar
│   ├── redis.tar
│   ├── pm-server.tar
│   └── pm-web.tar
├── docker-compose.prod.yml
├── load-and-start.sh
└── .env
```

#### 步骤 2：传输到离线环境

将整个 `offline-bundle/` 目录复制到目标机器。

#### 步骤 3：离线启动

```bash
cd offline-bundle/
bash load-and-start.sh
```

### Docker 运维命令

```bash
docker compose ps                    # 查看状态
docker compose logs -f server        # 后端日志
docker compose logs -f web           # 前端日志
docker compose down                  # 停止服务
docker compose down -v               # 停止并清除数据
docker compose restart server        # 重启单个服务
```

---

## 环境变量配置

PM2 方式的环境变量在 `ecosystem.config.js` 中配置。
Docker 方式的环境变量在 `docker-compose.yml` 中配置。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://postgres:postgres123@localhost:5432/project_manager` | 数据库连接 |
| `JWT_SECRET` | `your-super-secret-jwt-key-change-in-production` | JWT 签名密钥 |
| `PORT`（server） | `4001` | 后端端口 |
| `PORT`（web） | `4000` | 前端端口 |
| `CORS_ORIGINS` | `http://localhost:4000` | 允许的跨域来源 |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4001/api` | 前端 API 地址 |

> **生产环境**请务必修改 `JWT_SECRET` 和数据库密码。
