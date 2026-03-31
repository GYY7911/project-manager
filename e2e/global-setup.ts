import { FullConfig } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

interface GlobalSetupResult {
  serverProcess: any;
  webProcess: any;
}

let serverProcess: ReturnType<typeof spawn> | null = null;
let webProcess: ReturnType<typeof spawn> | null = null;

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n🔧 开始 E2E 测试环境初始化...\n');

  // 1. 清理旧进程
  console.log('📋 清理旧进程...');
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *nest*" 2>nul', { stdio: 'ignore' });
      execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *next*" 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "nest start" || true', { stdio: 'ignore' });
      execSync('pkill -f "next dev" || true', { stdio: 'ignore' });
    }
  } catch {
    // 忽略错误
  }
  await sleep(1000);

  // 2. 重置数据库
  console.log('🗃️  重置数据库...');
  // 使用 db push 同步 schema（项目没有迁移文件）
  execSync('npx prisma db push --force-reset --accept-data-loss', {
    stdio: 'inherit',
    cwd: process.cwd() + '/apps/server',
    env: { ...process.env, NODE_ENV: 'test', PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes' },
  });

  // 3. 清理 Redis 缓存
  console.log('📦 清理 Redis 缓存...');
  try {
    execSync('redis-cli FLUSHALL', { stdio: 'ignore' });
    console.log('  ✓ Redis 缓存已清理');
  } catch {
    console.log('  ⚠ Redis 未运行，跳过清理');
  }

  // 4. 清理构建缓存
  console.log('🧹 清理构建缓存...');
  execSync('rm -rf apps/web/.next apps/server/dist', { stdio: 'ignore', shell: true });

  // 4.1 重新构建后端
  console.log('🔨 构建后端服务...');
  execSync('pnpm build:server', { stdio: 'inherit', cwd: process.cwd() });

  // 5. 启动后端服务
  console.log('🚀 启动后端服务...');
  serverProcess = spawn('pnpm', ['--filter=server', 'run', 'start'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', PORT: '4001' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: true,
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });

  // 等待后端启动
  console.log('  等待后端服务就绪...');
  await waitForServer('http://localhost:4001/api', 30000);
  console.log('  ✓ 后端服务已启动');

  // 6. 启动前端服务
  console.log('🌐 启动前端服务...');
  webProcess = spawn('pnpm', ['--filter=web', 'run', 'dev'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: true,
  });

  // 等待前端启动
  console.log('  等待前端服务就绪...');
  await waitForServer('http://localhost:4000', 120000);
  console.log('  ✓ 前端服务已启动');

  // 保存进程信息供 teardown 使用
  process.env.E2E_SERVER_PID = serverProcess.pid?.toString() || '';
  process.env.E2E_WEB_PID = webProcess.pid?.toString() || '';

  console.log('\n✅ E2E 测试环境初始化完成！\n');
}

async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // 忽略错误，继续等待
    }
    await sleep(500);
  }
  throw new Error(`服务启动超时: ${url}`);
}

export default globalSetup;
