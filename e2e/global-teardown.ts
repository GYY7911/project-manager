import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n🧹 开始清理 E2E 测试环境...\n');

  // 1. 停止前端服务
  console.log('🛑 停止前端服务...');
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /FI "WINDOWTITLE eq *next dev*" 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "next dev" || true', { stdio: 'ignore' });
    }
    console.log('  ✓ 前端服务已停止');
  } catch {
    console.log('  ⚠ 前端服务停止失败');
  }

  // 2. 停止后端服务
  console.log('🛑 停止后端服务...');
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /FI "WINDOWTITLE eq *nest*" 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "nest start" || true', { stdio: 'ignore' });
    }
    console.log('  ✓ 后端服务已停止');
  } catch {
    console.log('  ⚠ 后端服务停止失败');
  }

  // 3. 清理 Redis 缓存
  console.log('📦 清理 Redis 缓存...');
  try {
    execSync('redis-cli FLUSHALL', { stdio: 'ignore' });
    console.log('  ✓ Redis 缓存已清理');
  } catch {
    console.log('  ⚠ Redis 未运行，跳过清理');
  }

  // 4. 重置数据库到初始状态
  console.log('🗃️  重置数据库...');
  try {
    // 使用 db push 同步 schema（项目没有迁移文件）
    execSync('npx prisma db push --force-reset --accept-data-loss', {
      stdio: 'inherit',
      cwd: process.cwd() + '/apps/server',
      env: { ...process.env, NODE_ENV: 'test', PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes' },
    });
    console.log('  ✓ 数据库已重置');
  } catch {
    console.log('  ⚠ 数据库重置失败');
  }

  console.log('\n✅ E2E 测试环境清理完成！\n');
}

export default globalTeardown;
