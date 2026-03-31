import { test as base, Page, BrowserContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// 数据库客户端
let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/project_manager?schema=public',
        },
      },
    });
  }
  return prisma;
}

// 测试用户类型
export interface TestUser {
  id: string;
  employeeNo: string;
  username: string;
  password: string; // 明文密码，用于登录
  name: string;
  role: string;
  team: string;
}

// 认证状态
export interface AuthState {
  token: string;
  user: TestUser;
}

// Fixtures 扩展
type MyFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
  testUser: TestUser;
  adminUser: TestUser;
};

// 用户工厂
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const db = getPrisma();
  const employeeNo = overrides.employeeNo || `test_${Date.now()}`;
  const password = overrides.password || 'test123456';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      employeeNo,
      username: overrides.username || employeeNo,
      name: overrides.name || '测试用户',
      password: hashedPassword,
      role: overrides.role || 'MEMBER',
      team: overrides.team || '测试组',
    },
  });

  return {
    id: user.id,
    employeeNo: user.employeeNo,
    username: user.username,
    password, // 返回明文密码，方便登录
    name: user.name,
    role: user.role,
    team: user.team || '',
  };
}

// 创建管理员用户
export async function createAdminUser(): Promise<TestUser> {
  return createTestUser({
    employeeNo: 'admin_e2e',
    username: 'admin_e2e',
    name: 'E2E管理员',
    role: 'PM',
    team: '管理组',
    password: 'admin123',
  });
}

// 登录并获取 token
export async function loginUser(page: Page, user: TestUser): Promise<string> {
  const response = await page.request.post('http://localhost:4001/api/auth/login', {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`登录失败: ${response.status()}`);
  }

  const data = await response.json();
  return data.access_token;
}

// 设置认证状态
export async function setAuthState(page: Page, token: string): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    },
  ]);

  // 也设置到 localStorage
  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, token);
}

// 清理测试数据
export async function cleanupTestData(): Promise<void> {
  const db = getPrisma();

  // 按依赖顺序删除
  await db.workflowLog.deleteMany({});
  await db.creditRecord.deleteMany({});
  await db.creditSummary.deleteMany({});
  await db.issue.deleteMany({});
  await db.requirement.deleteMany({});
  await db.testCycle.deleteMany({});
  await db.creditRule.deleteMany({});
  await db.version.deleteMany({});
  await db.user.deleteMany({});
}

// 清理特定用户
export async function cleanupUser(userId: string): Promise<void> {
  const db = getPrisma();
  await db.user.delete({ where: { id: userId } }).catch(() => {});
}

// 断开数据库连接
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// 扩展的 test fixture
export const test = base.extend<MyFixtures>({
  // 普通认证页面
  authenticatedPage: async ({ page }, use) => {
    const user = await createTestUser();
    const token = await loginUser(page, user);

    // 设置认证 cookie
    await setAuthState(page, token);

    // 使用页面
    await use(page);

    // 清理
    await cleanupUser(user.id);
  },

  // 管理员页面
  adminPage: async ({ page }, use) => {
    const admin = await createAdminUser();
    const token = await loginUser(page, admin);

    await setAuthState(page, token);

    await use(page);

    await cleanupUser(admin.id);
  },

  // 测试用户 fixture
  testUser: async ({}, use) => {
    const user = await createTestUser();
    await use(user);
    await cleanupUser(user.id);
  },

  // 管理员用户 fixture
  adminUser: async ({}, use) => {
    const admin = await createAdminUser();
    await use(admin);
    await cleanupUser(admin.id);
  },
});

export { expect } from '@playwright/test';
