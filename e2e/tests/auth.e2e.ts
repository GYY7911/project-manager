import { test, expect, createTestUser, cleanupTestData, disconnectPrisma } from '../fixtures';

test.describe('认证流程 E2E 测试', () => {
  test.afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  test('用户可以登录系统', async ({ page }) => {
    // 创建测试用户
    const user = await createTestUser({
      employeeNo: 'login_test',
      username: 'login_test',
      password: 'test123456',
      name: '登录测试用户',
    });

    // 访问登录页
    await page.goto('/login');

    // 填写登录表单
    await page.fill('input[placeholder*="用户名"]', user.username);
    await page.fill('input[placeholder*="密码"]', user.password);

    // 点击登录按钮
    await page.click('button[type="submit"]');

    // 等待跳转到首页
    await page.waitForURL('**/board', { timeout: 10000 });

    // 验证已登录
    await expect(page.locator('text=看板')).toBeVisible();
  });

  test('登录失败显示错误信息', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[placeholder*="用户名"]', 'nonexistent');
    await page.fill('input[placeholder*="密码"]', 'wrongpassword');

    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('text=用户名或密码错误')).toBeVisible({ timeout: 5000 });
  });

  test('已登录用户可以访问看板', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // 直接访问看板
    await page.goto('/board');

    // 验证看板加载成功
    await expect(page.locator('[data-testid="kanban-board"]')).toBeVisible({ timeout: 10000 });
  });
});
