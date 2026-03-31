import { test, expect, createTestUser, getPrisma, cleanupTestData, disconnectPrisma } from '../fixtures';
import { PrismaClient, VersionStatus } from '@prisma/client';

test.describe('工作流 E2E 测试', () => {
  test.beforeAll(async () => {
    // 确保有测试版本
    const db = getPrisma();
    await db.version.upsert({
      where: { name: 'E2E_TEST_VERSION' },
      create: {
        name: 'E2E_TEST_VERSION',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: VersionStatus.DEVELOPMENT,
      },
      update: {},
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  test('管理员可以创建新需求', async ({ adminPage, adminUser }) => {
    const page = adminPage;

    // 访看板页面
    await page.goto('/board');

    // 点击新建需求按钮
    await page.click('button:has-text("新建需求")');

    // 填写需求表单
    await page.fill('input[name="title"]', 'E2E测试需求');
    await page.fill('textarea[name="description"]', '这是一个E2E测试创建的需求');

    // 提交表单
    await page.click('button[type="submit"]');

    // 验证需求创建成功
    await expect(page.locator('text=E2E测试需求')).toBeVisible({ timeout: 5000 });
  });

  test('需求可以拖拽到不同阶段', async ({ authenticatedPage, testUser }) => {
    const page = authenticatedPage;
    const db = getPrisma();

    // 先获取版本
    const version = await db.version.findFirst({
      where: { name: 'E2E_TEST_VERSION' },
    });

    // 创建测试需求
    const requirement = await db.requirement.create({
      data: {
        code: `REQ_E2E_${Date.now()}`,
        title: '拖拽测试需求',
        versionId: version!.id,
        assigneeId: testUser.id,
        currentStage: 'REQUIREMENT_DESIGN',
      },
    });

    // 访问看板
    await page.goto('/board');

    // 等待看板加载
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 10000 });

    // 找到需求卡片
    const card = page.locator(`text=${requirement.title}`);
    await expect(card).toBeVisible();

    // 拖拽到下一阶段（这里需要根据实际的看板实现调整）
    const targetColumn = page.locator('[data-testid="column-alpha-test-design"]');
    await card.dragTo(targetColumn);

    // 验证移动成功
    await expect(targetColumn.locator(`text=${requirement.title}`)).toBeVisible({ timeout: 5000 });
  });
});
