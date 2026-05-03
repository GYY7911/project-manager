# 📊 PM - 项目管理系统

一个现代化的敏捷项目管理系统，支持看板式任务管理、工作流追踪、团队协作和绩效评估。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 📖 目录

- [项目概述](#-项目概述)
- [技术架构](#-技术架构)
- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [开发指南](#-开发指南)
- [测试指南](#-测试指南)
- [项目结构](#-项目结构)
- [数据模型](#-数据模型)
- [API 文档](#-api-文档)
- [部署说明](#-部署说明)

---

## 🎯 项目概述

PM 是一个面向研发团队的项目管理工具，旨在提供：

- **可视化看板**：直观的拖拽式任务管理
- **灵活工作流**：可定制的研发流程阶段
- **信用系统**：基于贡献度的团队激励机制
- **数据分析**：团队绩效和项目健康度洞察

### 用户角色

| 角色 | 权限说明 |
|------|----------|
| **PM (项目经理)** | 创建版本、分配任务、查看工作量、管理信用规则 |
| **MEMBER (成员)** | 查看分配给自己的任务、更新任务状态 |
| **ADMIN (管理员)** | 用户管理、系统配置 |

---

## 🏗️ 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js 15 + React 19                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │  看板   │ │  版本   │ │  用户   │ │  信用   │        │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │   │
│  │              Zustand + React Query                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                              │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server Layer                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    NestJS 11                              │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │   │
│  │  │ Auth  │ │ User  │ │Version│ │Board  │ │Credit │     │   │
│  │  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘     │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐               │   │
│  │  │Issue  │ │Workflow│ │Delay │ │Analytic│              │   │
│  │  └───────┘ └───────┘ └───────┘ └───────┘               │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Prisma ORM
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
│  ┌─────────────────┐           ┌─────────────────┐             │
│  │   PostgreSQL    │                             │
│  │   (主数据库)     │                             │
│  └─────────────────┘           └─────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

#### 前端 (`apps/web`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.1.0 | React 全栈框架 |
| React | 19.0 | UI 库 |
| TypeScript | 5.7 | 类型安全 |
| Tailwind CSS | 4.0 | 原子化 CSS |
| TanStack Query | 5.63 | 服务端状态管理 |
| Zustand | 5.0 | 客户端状态管理 |
| dnd-kit | 6.3 | 拖拽功能 |
| ECharts | 6.0 | 图表可视化 |
| Radix UI | - | 无障碍组件库 |
| Framer Motion | 11.15 | 动画库 |

#### 后端 (`apps/server`)

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 11.0 | Node.js 框架 |
| Prisma | 6.4 | ORM |
| PostgreSQL | - | 主数据库 |
| Passport | 0.7 | 认证中间件 |
| JWT | - | Token 认证 |
| class-validator | 0.14 | 数据验证 |

#### 测试

| 技术 | 用途 |
|------|------|
| Vitest | 前端单元测试 |
| Jest | 后端单元测试 |
| Playwright | E2E 测试 |
| Supertest | API 测试 |

---

## ✨ 功能特性

### 1. 🎯 智能看板 (Kanban Board)

```
┌────────────┬────────────┬────────────┬────────────┬────────────┐
│  需求设计   │  功能开发   │  版本转测   │  问题单修复  │  版本发布   │
├────────────┼────────────┼────────────┼────────────┼────────────┤
│ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │
│ │FE-001  │ │ │FE-003  │ │ │FE-005  │ │ │ISS-001 │ │ │FE-008  │ │
│ │用户登录 │ │ │数据导出 │ │ │SIT1测试 │ │ │登录异常 │ │ │V1.0    │ │
│ │👤 张三  │ │ │👤 李四  │ │ │👤 王五  │ │ │👤 张三  │ │ │👤 李四  │ │
│ │📅 +3天  │ │ │📅 -2天  │ │ │📅 +1天  │ │ │🔴 HIGH │ │ │✅ 完成  │ │
│ └────────┘ │ └────────┘ │ └────────┘ │ └────────┘ │ └────────┘ │
│ ┌────────┐ │ ┌────────┐ │            │            │            │
│ │FE-002  │ │ │FE-004  │ │            │            │            │
│ │权限管理 │ │ │报表生成 │ │            │            │            │
│ └────────┘ │ └────────┘ │            │            │            │
└────────────┴────────────┴────────────┴────────────┴────────────┘
```

**核心功能**：

| 功能 | 说明 |
|------|------|
| 拖拽式任务流转 | 支持 dnd-kit 驱动的流畅拖拽体验 |
| 动态转测版本列 | 根据版本自动创建 SIT1、UAT 等动态列 |
| 延期状态显示 | 🟢 绿色 = 剩余天数 / 🔴 红色 = 已延期天数 |
| 工作量显示 | 仅 PM 角色可见工作量（人/天） |
| 问题单标识 | 红色左边框 + 严重程度标签 |
### 2. 📋 工作流管理

```
需求生命周期:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 需求设计  │───▶│Alpha测试 │───▶│ 文档会签  │───▶│ 功能开发  │
│          │    │  设计    │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                    │
                     ┌──────────────────────────────┘
                     ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 版本发布  │◀───│ 问题单   │◀───│  CCB评审  │◀───│ 升级SOP  │
│          │    │  修复    │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     ▲
                     │
              ┌──────┴──────┐
              │  版本转测    │ (动态列: SIT1, UAT...)
              └─────────────┘
```

**工作流阶段**：

| 阶段 | 枚举值 | 说明 |
|------|--------|------|
| 需求设计 | `REQUIREMENT_DESIGN` | 需求分析与设计 |
| Alpha测试设计 | `ALPHA_TEST_DESIGN` | Alpha 阶段测试用例设计 |
| 文档会签 | `DOCUMENT_SIGN` | 相关文档审核签署 |
| 功能开发 | `FEATURE_DEV` | 核心功能编码实现 |
| Alpha用例开发 | `ALPHA_CASE_DEV` | Alpha 测试用例开发 |
| 升级SOP | `SOP_UPGRADE` | 标准操作流程更新 |
| 版本转测 | `VERSION_TEST` | 提交测试（动态列） |
| 问题单修复 | `ISSUE_FIX` | Bug 修复阶段 |
| 问题单CCB | `CCB_REVIEW` | 变更控制委员会评审 |
| 版本发布 | `RELEASE` | 发布上线 |

### 3. 📊 信用系统

```
信用积分计算:
┌─────────────────────────────────────────────────────────────┐
│                     总信用分 = Σ(各维度分数)                  │
├─────────────────────────────────────────────────────────────┤
│  ✅ 需求完成  +10分/个                                      │
│  ✅ 问题单修复 +5分/个 (CRITICAL: +20, HIGH: +10)          │
│  ⏰ 按时完成   +5分                                          │
│  ⚠️ 延期扣分   -5分/天                                       │
│  📝 人工调整   ±N分                                          │
└─────────────────────────────────────────────────────────────┘
```

**信用规则类型**：

| 类型 | 枚举值 | 说明 |
|------|--------|------|
| 需求完成 | `REQUIREMENT_COMPLETE` | 完成需求获得积分 |
| 问题单完成 | `ISSUE_COMPLETE` | 修复问题单获得积分 |
| 延期 | `DELAY` | 超期扣分 |
| 评审延期 | `REVIEW_DELAY` | 评审超期扣分 |
| 人工调整 | `MANUAL` | PM 手动调整积分 |

**信用矫正**：
- 支持修改计划日期/实际完成日期
- 自动重新计算延期天数和扣分
- 保留完整的矫正历史记录

### 4. 📈 数据分析

- 团队成员贡献度排行
- 版本健康度统计
- 延期率分析
- 问题单严重程度分布
- 各阶段工作量统计

### 5. 🚀 新手引导 (Onboarding Wizard)

首次登录时提供向导式配置：

```
Step 1: 创建版本
    ↓
Step 2: 添加团队成员
    ↓
Step 3: 创建需求
    ↓
Step 4: 配置转测版本
    ↓
完成！
```

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.15.0 |
| PostgreSQL | >= 14 |

### 一键启动 (Windows)

```bash
# 启动所有服务（数据库+前端+后端）
start.bat

# 停止所有服务
stop.bat

# 清理缓存（node_modules、.next、dist等）
clean.bat

# 重置数据库（删除所有数据并重新初始化）
reset-db.bat
```

### 手动安装步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd project-manager

# 2. 安装依赖
pnpm install

# 3. 初始化数据库
pnpm db:generate  # 生成 Prisma Client
pnpm db:push      # 同步数据库结构
pnpm --filter=server db:seed  # 初始化种子数据

# 5. 启动开发服务器
pnpm start:dev
```

### 环境变量配置

在 `apps/server/.env` 中配置：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/pm?schema=public"

# JWT
JWT_SECRET="your-super-secret-key"

# 服务端口
PORT=3000
```

### 服务地址

| 服务 | 地址 |
|------|------|
| **前端** | http://localhost:4000 |
| **后端 API** | http://localhost:3000 |
| **API 文档** | http://localhost:3000/api |
| **Prisma Studio** | `pnpm db:studio` → http://localhost:5555 |

### 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 组员 | z00123123 | 123456 |

---

## 💻 开发指南

### 常用命令

```bash
# ========== 开发 ==========
pnpm start:dev      # 启动全部服务（自动清理端口）
pnpm dev            # 并行启动前后端
pnpm dev:web        # 仅启动前端 (端口 4000)
pnpm dev:server     # 仅启动后端 (端口 3000)

# ========== 构建 ==========
pnpm build          # 构建全部
pnpm build:web      # 仅构建前端
pnpm build:server   # 仅构建后端

# ========== 数据库 ==========
pnpm db:generate    # 生成 Prisma Client
pnpm db:push        # 同步数据库结构（开发用）
pnpm db:migrate     # 创建迁移（生产用）
pnpm db:studio      # 打开 Prisma Studio 可视化工具
pnpm db:reset       # 重置数据库（⚠️ 删除所有数据）
pnpm db:seed        # 执行种子数据

# ========== 代码质量 ==========
pnpm lint           # 运行 ESLint 检查

# ========== 环境管理 ==========
pnpm env:reset      # 重置开发环境
pnpm env:reset:full # 完整重置并启动
pnpm env:setup      # 设置开发环境
```

### 项目结构

```
project-manager/
├── apps/
│   ├── server/                 # NestJS 后端
│   │   ├── src/
│   │   │   ├── modules/        # 业务模块
│   │   │   │   ├── auth/       # 认证模块 (JWT + Passport)
│   │   │   │   ├── user/       # 用户管理模块
│   │   │   │   ├── version/    # 版本管理模块
│   │   │   │   ├── requirement/# 需求管理模块
│   │   │   │   ├── issue/      # 问题单管理模块
│   │   │   │   ├── test-cycle/ # 转测版本模块
│   │   │   │   ├── credit/     # 信用系统模块
│   │   │   │   ├── workflow/   # 工作流引擎模块
│   │   │   │   ├── delay-config/# 延期配置模块
│   │   │   │   └── analytics/  # 数据分析模块
│   │   │   ├── prisma/         # Prisma 服务封装
│   │   │   ├── app.module.ts   # 根模块
│   │   │   └── main.ts         # 应用入口
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # 数据模型定义
│   │   │   └── seed.ts         # 种子数据
│   │   └── test/               # E2E 测试
│   │
│   └── web/                    # Next.js 前端
│       └── src/
│           ├── app/            # App Router 页面
│           │   ├── (auth)/     # 认证相关页面
│           │   │   └── login/  # 登录页
│           │   └── (dashboard)/# 仪表盘页面
│           │       ├── board/  # 看板页面
│           │       ├── versions/# 版本管理页
│           │       ├── users/  # 用户管理页
│           │       ├── credits/# 信用系统页
│           │       └── onboard/# 新手引导页
│           ├── components/     # React 组件
│           │   ├── ui/         # 基础 UI 组件 (shadcn/ui)
│           │   ├── board/      # 看板相关组件
│           │   │   ├── KanbanBoard.tsx
│           │   │   ├── KanbanColumn.tsx
│           │   │   └── KanbanCard.tsx
│           │   └── wizard/     # 新手向导组件
│           │       └── steps/  # 向导步骤组件
│           ├── lib/            # 工具库
│           │   ├── api.ts      # API 客户端封装
│           │   └── utils.ts    # 通用工具函数
│           ├── store/          # Zustand 状态管理
│           │   └── index.ts    # 全局状态定义
│           └── hooks/          # 自定义 React Hooks
│
├── packages/
│   └── shared/                 # 前后端共享代码
│       └── src/
│           └── types.ts        # 共享类型定义和枚举
│
├── e2e/                        # Playwright E2E 测试
│   ├── playwright.config.ts
│   └── tests/
│
├── scripts/                    # 开发工具脚本
│   ├── kill-ports.js          # 端口清理脚本
│   ├── run-tests.js           # 测试运行器
│   └── env-reset.js           # 环境重置脚本
│
├── start.bat                   # Windows 一键启动
├── stop.bat                    # Windows 一键停止
├── clean.bat                   # Windows 清理缓存
├── reset-db.bat               # Windows 重置数据库
├── pnpm-workspace.yaml        # pnpm 工作区配置
├── turbo.json                 # Turborepo 配置
└── package.json               # 根 package.json
```

---

## 🧪 测试指南

### 运行测试

```bash
# ========== 全部单元测试 ==========
pnpm test              # 运行所有单元测试（前端+后端）
pnpm test:quick        # 快速测试（跳过部分检查）
pnpm test:unit         # 等同于 test

# ========== 单独测试 ==========
pnpm test:server       # 仅后端测试 (Jest) - 174 个测试
pnpm test:web          # 仅前端测试 (Vitest) - 476 个测试

# ========== 监听模式 ==========
pnpm --filter=server test:watch   # 后端监听模式
pnpm --filter=web test            # 前端监听模式

# ========== 覆盖率报告 ==========
pnpm --filter=server test:cov     # 后端覆盖率
pnpm --filter=web test:cov        # 前端覆盖率

# ========== E2E 测试 ==========
pnpm test:e2e          # 运行 Playwright E2E 测试
pnpm test:e2e:ui       # 带 UI 的 E2E 测试（推荐调试用）
pnpm test:e2e:debug    # 调试模式 E2E 测试

# ========== API 测试 ==========
pnpm test:api          # 后端 E2E API 测试
```

### 测试结构

```
apps/server/
├── src/**/*.spec.ts        # 单元测试（与源码同目录）
│   ├── auth/auth.service.spec.ts
│   ├── user/user.service.spec.ts
│   ├── version/version.service.spec.ts
│   ├── requirement/requirement.service.spec.ts
│   ├── issue/issue.service.spec.ts
│   ├── credit/credit.service.spec.ts
│   ├── workflow/workflow.service.spec.ts
│   └── analytics/analytics.service.spec.ts
│
└── test/
    └── *.e2e-spec.ts       # E2E API 测试

apps/web/
└── src/**/*.test.tsx       # React 组件测试
    ├── components/board/KanbanCard.test.tsx
    ├── components/board/KanbanBoard.test.tsx
    ├── components/wizard/steps/*.test.tsx
    └── ...

e2e/
└── tests/*.spec.ts         # Playwright E2E 测试
```

### 测试覆盖情况

| 模块 | 后端测试 | 前端测试 | 状态 |
|------|:-------:|:-------:|:----:|
| 认证 (Auth) | ✅ | ✅ | 通过 |
| 用户 (User) | ✅ | ✅ | 通过 |
| 版本 (Version) | ✅ | ✅ | 通过 |
| 需求 (Requirement) | ✅ | ✅ | 通过 |
| 问题单 (Issue) | ✅ | ✅ | 通过 |
| 工作流 (Workflow) | ✅ | ✅ | 通过 |
| 信用 (Credit) | ✅ | ✅ | 通过 |
| 看板 (Board) | - | ✅ | 通过 |
| 分析 (Analytics) | ✅ | - | 通过 |

**当前测试统计**：
- 后端：**174** 个测试通过
- 前端：**476** 个测试通过

---

## 📦 数据模型

### ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │   Version   │       │ Requirement │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │──┐    │ id          │──┐    │ id          │
│ employeeNo  │  │    │ name        │  │    │ code        │
│ name        │  │    │ startDate   │  │    │ title       │
│ username    │  │    │ endDate     │  │    │ status      │
│ password    │  │    │ status      │  └────▶ versionId   │
│ role        │  │    └─────────────┘       │ currentStage│
└─────────────┘  │                          │ assigneeId  │◀─┐
       │         │                          └─────────────┘  │
       │         │                                 │         │
       │         │                          ┌─────────────┐  │
       │         │                          │    Issue    │  │
       │         │                          ├─────────────┤  │
       │         │                          │ id          │  │
       │         └─────────────────────────▶ versionId   │  │
       │                                    │ assigneeId  │──┘
       │                                    │ severity    │
       │                                    │ testCycleId │
       │                                    └─────────────┘
       │                                          │
       │         ┌─────────────┐                  │
       │         │  TestCycle  │◀─────────────────┘
       │         ├─────────────┤
       │         │ id          │
       │         │ name        │
       │         │ versionId   │
       │         └─────────────┘
       │
       │         ┌─────────────┐       ┌─────────────┐
       └────────▶CreditRecord │       │CreditSummary│
                 ├─────────────┤       ├─────────────┤
                 │ userId      │       │ userId      │
                 │ score       │       │ totalScore  │
                 │ sourceType  │       │ versionId   │
                 │ versionId   │       └─────────────┘
                 └─────────────┘
```

### 核心实体

#### User (用户)

```typescript
interface User {
  id: string;
  employeeNo: string;        // 工号，如 z00123123
  name: string;              // 姓名，如 张三
  username: string;          // 登录名
  password: string;          // 加密密码
  role: UserRole;            // PM | MEMBER | ADMIN
  team?: string;             // 所属团队
  createdAt: Date;
  updatedAt: Date;
}
```

#### Version (版本)

```typescript
interface Version {
  id: string;
  name: string;              // 版本名称，如 V2026.Q1
  startDate: Date;           // 开始日期
  endDate: Date;             // 结束日期
  status: VersionStatus;     // PLANNING | DEVELOPMENT | TESTING | RELEASED
  createdAt: Date;
  updatedAt: Date;
}
```

#### Requirement (需求)

```typescript
interface Requirement {
  id: string;
  code: string;              // 需求编码，如 FE20260309001
  title: string;             // 需求标题
  description?: string;      // 需求描述
  status: RequirementStatus; // DRAFT | IN_PROGRESS | COMPLETED | BLOCKED
  currentStage: WorkflowStage;
  workload?: number;         // 工作量（人/天），仅 PM 可见
  dueDate?: Date;            // 截止日期
  versionId: string;
  assigneeId: string;
}
```

#### Issue (问题单)

```typescript
interface Issue {
  id: string;
  code: string;              // 问题单编码
  title: string;             // 问题标题
  description?: string;      // 问题描述
  severity: IssueSeverity;   // CRITICAL | HIGH | MEDIUM | LOW
  status: IssueStatus;       // OPEN | IN_PROGRESS | FIXED | VERIFIED | CLOSED
  currentStage: WorkflowStage;
  ccbApproved: boolean;      // CCB 是否通过
  testCycleId?: string;      // 关联的转测版本
  versionId: string;
  assigneeId: string;
  requirementId?: string;    // 关联的需求
}
```

#### TestCycle (转测版本)

```typescript
interface TestCycle {
  id: string;
  name: string;              // 名称，如 "SIT1"、"UAT"
  order: number;             // 排序
  versionId: string;
  createdById?: string;
  createdAt: Date;
}
```

---

## 🔌 API 文档

### 认证 API

#### 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应**：

```json
{
  "user": {
    "id": "clx...",
    "name": "管理员",
    "username": "admin",
    "role": "PM"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 看板 API

#### 获取看板数据

```http
GET /api/board/:versionId
Authorization: Bearer <token>
```

**响应**：

```json
{
  "columns": [
    { "id": "col-1", "stage": "REQUIREMENT_DESIGN", "title": "需求设计" }
  ],
  "items": [
    {
      "id": "req-1",
      "type": "requirement",
      "code": "FE001",
      "title": "用户登录功能",
      "currentStage": "FEATURE_DEV",
      "assignee": { "id": "user-1", "name": "张三", "employeeNo": "z001" },
      "workload": 5
    }
  ]
}
```

### 工作流 API

#### 移动任务

```http
POST /api/workflow/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "entityType": "requirement",
  "entityId": "req-1",
  "toStage": "VERSION_TEST",
  "testCycleId": "tc-1"
}
```

### 用户 API

#### 获取用户列表

```http
GET /api/users
Authorization: Bearer <token>
```

### 版本 API

#### 创建版本

```http
POST /api/versions
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "V2026.Q2",
  "startDate": "2026-04-01",
  "endDate": "2026-06-30"
}
```

---

## 🚢 部署说明

> 详细部署指南请参考 [OFFLINE-DEPLOY.md](OFFLINE-DEPLOY.md)

### PM2 部署（推荐，无需 Docker）

适合不允许使用 Docker 的企业环境。

```bash
# 1. 安装前提条件
npm install -g pnpm@9.15.0 pm2
bash scripts/install-services.sh    # 辅助安装 PostgreSQL

# 2. 一键部署
bash deploy-pm2.sh

# 3. 运维管理
bash scripts/pm2-ops.sh status      # 查看状态
bash scripts/pm2-ops.sh logs        # 查看日志
bash scripts/pm2-ops.sh restart     # 重启服务

# 4. 停止服务（优雅关闭）
pm2 stop all                        # 停止所有进程
pm2 delete all                      # 删除所有进程
pm2 save --force                    # 清空保存的进程列表
```

### 生产环境变量

配置在 `ecosystem.config.js`（PM2）中：

```env
NODE_ENV=production
DATABASE_URL="postgresql://prod_user:***@prod-db:5432/pm"
JWT_SECRET="your-very-secure-production-secret-key"
PORT=4001
```

---

## 🔒 权限矩阵

| 功能 | PM | MEMBER | ADMIN |
|------|:--:|:------:|:-----:|
| 查看所有需求/问题单 | ✅ | ✅ | ✅ |
| 创建/编辑需求 | ✅ | ❌ | ✅ |
| 拖拽/修改状态 | ✅ | ✅(仅自己) | ✅ |
| 查看工作量/负荷 | ✅ | ❌ | ✅ |
| 查看信用排名 | ✅ | ❌ | ✅ |
| 管理转测版本列 | ✅ | ❌ | ✅ |
| 用户管理 | ❌ | ❌ | ✅ |

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 编写代码并添加测试
4. 确保测试通过 (`pnpm test`)
5. 提交更改 (`git commit -m 'Add amazing feature'`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 创建 Pull Request

---

## 📝 更新日志

### v1.0.0 (2026-03)

- ✨ 初始版本发布
- 🎯 看板拖拽功能
- 📋 完整工作流支持
- 📊 信用系统上线
- 🚀 新手引导向导

---

## 📄 许可证

[MIT License](LICENSE)

---

## 📞 联系方式

如有问题或建议，请提交 [Issue](../../issues)。
