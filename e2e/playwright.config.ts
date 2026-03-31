import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // 串行执行，确保环境隔离
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 单进程，避免数据库冲突
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 全局 Setup：启动服务、重置数据库
  globalSetup: require.resolve('./global-setup'),
  // 全局 Teardown：清理环境
  globalTeardown: require.resolve('./global-teardown'),
  // 单个测试的超时时间
  timeout: 30000,
  // 整个测试文件的超时时间
  testMatch: '**/*.e2e.ts',
});
