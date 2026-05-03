# 环境管理与测试指南

## 快速开始

### 开发环境

```bash
# 标准开发模式（已有热加载）
pnpm dev

# 增强开发模式（包含 Prisma Schema 变更监听）
pnpm dev:enhanced
```

### 测试

```bash
# 运行所有测试（单元 + E2E）
pnpm test

# 快速测试（跳过缓存清理）
pnpm test:quick

# 只运行单元测试
pnpm test:unit

# 只运行后端单元测试
pnpm test:server

# 只运行前端单元测试
pnpm test:web

# 只运行 API E2E 测试
pnpm test:api

# 运行完整 E2E 测试（Playwright）
pnpm test:e2e

# E2E 测试 UI 模式
pnpm test:e2e:ui
```

### 环境管理

```bash
# 环境重置（数据库）
pnpm env:reset

# 完全重置并重启服务
pnpm env:reset:full

# 首次安装/设置
pnpm env:setup
```

## 热加载机制

### 后端 (NestJS)

- **文件监听**: `src/**/*.ts` 变更自动重启
- **Prisma 监听**: `prisma/schema.prisma` 变更自动运行 `prisma generate`
- **增强模式**: `pnpm dev:enhanced` 同时监听代码和 Schema

### 前端 (Next.js)

- **Turbopack**: 已启用，支持快速热更新
- **HMR**: 组件变更即时更新

## E2E 测试流程

### 自动化流程

1. **全局 Setup** (`e2e/global-setup.ts`)
   - 清理旧进程
   - 重置数据库
   - 启动后端服务 (port 4001)
   - 启动前端服务 (port 4000)

2. **运行测试**
   - Playwright 测试 (浏览器自动化)
   - Jest API 测试 (后端 API)

3. **全局 Teardown** (`e2e/global-teardown.ts`)
   - 停止所有服务
   - 重置数据库

### 测试 Fixtures

```typescript
import { test, expect, createTestUser } from '../fixtures';

test('示例测试', async ({ authenticatedPage, testUser }) => {
  // authenticatedPage - 已登录的页面
  // testUser - 测试用户对象
  await authenticatedPage.goto('/board');
  await expect(authenticatedPage.locator('[data-testid="kanban-board"]')).toBeVisible();
});
```

### 可用 Fixtures

| Fixture | 描述 |
|---------|------|
| `authenticatedPage` | 已登录的普通用户页面 |
| `adminPage` | 已登录的管理员页面 |
| `testUser` | 测试用户对象 |
| `adminUser` | 管理员用户对象 |

### 辅助函数

```typescript
// 创建测试用户
const user = await createTestUser({
  username: 'custom',
  role: 'PM',
});

// 清理所有测试数据
await cleanupTestData();

// 清理特定用户
await cleanupUser(userId);

// 获取 Prisma 客户端
const db = getPrisma();
```

## 环境变量

### 后端 (apps/server/.env)

```env
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/project_manager?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=4001
```

### 前端 (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4001/api
```

## 常见问题

### Q: 测试运行失败怎么办？

```bash
# 1. 完全重置环境
pnpm env:reset:full

# 2. 重新运行测试
pnpm test
```

### Q: 如何只测试某个功能？

```bash
# 后端特定测试文件
pnpm --filter=server test -- auth.service.spec.ts

# 前端特定测试文件
pnpm --filter=web test -- date.test.ts

# E2E 特定测试
pnpm test:e2e -- --grep "登录"
```

### Q: 热加载不工作？

1. 检查文件是否在监听范围内
2. 尝试重启开发服务器
3. 使用增强模式: `pnpm dev:enhanced`

## 目录结构

```
├── apps/
│   ├── server/
│   │   ├── test/              # 后端测试
│   │   │   ├── setup.ts       # 单元测试设置
│   │   │   ├── setup-e2e.ts   # E2E 测试设置
│   │   │   └── *.e2e-spec.ts  # API E2E 测试
│   │   └── scripts/
│   │       ├── watch-prisma.js      # Prisma 监听
│   │       └── dev-with-prisma.js   # 增强开发模式
│   └── web/
│       └── src/
│           └── test/
│               └── setup.ts   # 前端测试设置
├── e2e/
│   ├── playwright.config.ts   # Playwright 配置
│   ├── global-setup.ts        # 全局启动脚本
│   ├── global-teardown.ts     # 全局清理脚本
│   ├── fixtures/              # 测试 Fixtures
│   │   └── index.ts
│   ├── helpers/               # 测试辅助工具
│   │   └── env-reset.ts
│   └── tests/                 # E2E 测试用例
│       ├── auth.e2e.ts
│       └── workflow.e2e.ts
└── scripts/
    ├── env-reset.js           # 环境重置脚本
    ├── env-setup.js           # 环境设置脚本
    └── run-tests.js           # 测试运行脚本
```
