import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// 测试超时设置
jest.setTimeout(30000);

// 全局变量存储测试应用实例
let app: INestApplication;
let prisma: PrismaClient;

// 数据库清理函数
async function cleanupDatabase() {
  const client = new PrismaClient();

  try {
    // 按依赖顺序删除数据（只清理测试相关数据，保留种子用户）
    await client.workflowLog.deleteMany({});
    await client.creditRecord.deleteMany({});
    await client.creditSummary.deleteMany({});
    await client.issue.deleteMany({});
    await client.requirement.deleteMany({});
    await client.testCycle.deleteMany({});
    await client.creditRule.deleteMany({});
    await client.version.deleteMany({});
    // 只删除测试用户（通过 employeeNo 前缀识别），不影响种子数据
    await client.user.deleteMany({
      where: {
        OR: [
          { employeeNo: { startsWith: 'e2e_' } },
          { employeeNo: 'profile_test' },
        ],
      },
    });

    console.log('  ✓ 测试数据库已清理');
  } catch (error) {
    console.error('  ⚠ 数据库清理失败:', error);
  } finally {
    await client.$disconnect();
  }
}

// Redis 清理函数
async function cleanupRedis() {
  try {
    const response = await fetch('http://localhost:6379', {
      method: 'POST',
      body: 'FLUSHALL',
    });
    if (response.ok) {
      console.log('  ✓ Redis 缓存已清理');
    }
  } catch {
    console.log('  ⚠ Redis 未运行，跳过清理');
  }
}

// 全局 Setup - 只清理测试用户，保留种子数据
beforeAll(async () => {
  console.log('\n🔧 初始化 E2E 测试环境...\n');

  // 只清理测试数据，不影响开发种子数据
  await cleanupDatabase();
  await cleanupRedis();
});

// 全局 Teardown
afterAll(async () => {
  console.log('\n🧹 清理 E2E 测试环境...\n');

  // 清理环境
  await cleanupDatabase();
  await cleanupRedis();

  // 关闭应用
  if (app) {
    await app.close();
  }
});

// 导出辅助函数供测试使用
export async function createTestApp(moduleFixture: TestingModule): Promise<INestApplication> {
  app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
