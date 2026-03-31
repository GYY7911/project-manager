// Jest 测试环境设置文件

// 设置测试超时
jest.setTimeout(10000);

// 模拟环境变量
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.REDIS_URL = 'redis://localhost:6379';

// 全局清理
afterAll(async () => {
  // 清理所有定时器
  jest.useRealTimers();
});
