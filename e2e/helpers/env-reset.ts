/**
 * 环境重置工具
 * 用于在测试前后重置数据库、缓存等
 */

import { execSync } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export interface EnvResetOptions {
  resetDatabase?: boolean;
  clearRedis?: boolean;
  clearCache?: boolean;
  restartServices?: boolean;
  runSeed?: boolean;
}

/**
 * 完整的环境重置
 */
export async function resetEnvironment(options: EnvResetOptions = {}): Promise<void> {
  const {
    resetDatabase = true,
    clearRedis = true,
    clearCache = true,
    restartServices = false,
    runSeed = true,
  } = options;

  console.log('🔄 开始环境重置...\n');

  // 1. 清理构建缓存
  if (clearCache) {
    console.log('🧹 清理构建缓存...');
    try {
      execSync('rm -rf apps/web/.next apps/server/dist node_modules/.cache', {
        stdio: 'ignore',
        shell: true,
      });
      console.log('  ✓ 构建缓存已清理\n');
    } catch (error) {
      console.log('  ⚠ 清理缓存时出错\n');
    }
  }

  // 2. 清理 Redis
  if (clearRedis) {
    console.log('📦 清理 Redis 缓存...');
    try {
      execSync('redis-cli FLUSHALL', { stdio: 'ignore' });
      console.log('  ✓ Redis 缓存已清理\n');
    } catch {
      console.log('  ⚠ Redis 未运行，跳过\n');
    }
  }

  // 3. 重置数据库
  if (resetDatabase) {
    console.log('🗃️  重置数据库...');
    try {
      execSync('pnpm --filter=server db:reset --force', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' },
      });
      console.log('  ✓ 数据库已重置\n');
    } catch (error) {
      console.log('  ⚠ 数据库重置失败\n');
      throw error;
    }
  }

  // 4. 运行种子数据
  if (runSeed && resetDatabase) {
    console.log('🌱 运行种子数据...');
    try {
      execSync('pnpm --filter=server db:seed', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' },
      });
      console.log('  ✓ 种子数据已加载\n');
    } catch {
      console.log('  ⚠ 种子数据加载失败\n');
    }
  }

  // 5. 重启服务
  if (restartServices) {
    console.log('🔄 重启服务...');
    await restartAllServices();
  }

  console.log('✅ 环境重置完成！\n');
}

/**
 * 重启所有服务
 */
export async function restartAllServices(): Promise<void> {
  // 停止服务
  console.log('  停止现有服务...');
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "node.*nest|node.*next" || true', { stdio: 'ignore' });
    }
    await sleep(2000);
  } catch {
    // 忽略
  }

  // 启动后端
  console.log('  启动后端服务...');
  const serverProcess = Bun.spawn(['pnpm', '--filter=server', 'run', 'start'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '4001' },
    detached: true,
  });
  serverProcess.unref();

  // 等待后端启动
  await sleep(5000);

  // 启动前端
  console.log('  启动前端服务...');
  const webProcess = Bun.spawn(['pnpm', '--filter=web', 'run', 'dev'], {
    env: { ...process.env, NODE_ENV: 'test' },
    detached: true,
  });
  webProcess.unref();

  // 等待前端启动
  await sleep(10000);

  console.log('  ✓ 服务已重启\n');
}

/**
 * 快速重置（仅数据库）
 */
export async function quickReset(): Promise<void> {
  await resetEnvironment({
    resetDatabase: true,
    clearRedis: true,
    clearCache: false,
    restartServices: false,
    runSeed: true,
  });
}

/**
 * 完全重置（包含服务重启）
 */
export async function fullReset(): Promise<void> {
  await resetEnvironment({
    resetDatabase: true,
    clearRedis: true,
    clearCache: true,
    restartServices: true,
    runSeed: true,
  });
}

// CLI 入口
if (import.meta.main) {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const full = args.includes('--full');

  if (quick) {
    quickReset().catch(console.error);
  } else if (full) {
    fullReset().catch(console.error);
  } else {
    resetEnvironment().catch(console.error);
  }
}
