#!/usr/bin/env node

/**
 * 环境重置脚本
 * 用于在测试前后重置数据库、清理缓存、重启服务
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: options.silent ? 'ignore' : 'inherit',
      env: { ...process.env, ...options.env },
      shell: true,
    });
    return true;
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 清理旧进程
async function killOldProcesses() {
  log('\n📋 清理旧进程...', 'cyan');

  if (process.platform === 'win32') {
    execCommand('taskkill /F /FI "WINDOWTITLE eq *nest*" 2>nul', { silent: true, ignoreError: true });
    execCommand('taskkill /F /FI "WINDOWTITLE eq *next*" 2>nul', { silent: true, ignoreError: true });
  } else {
    execCommand('pkill -f "nest start" || true', { silent: true, ignoreError: true });
    execCommand('pkill -f "next dev" || true', { silent: true, ignoreError: true });
  }

  await sleep(1000);
  log('  ✓ 旧进程已清理', 'green');
}

// 重置数据库
async function resetDatabase() {
  log('\n🗃️  重置数据库...', 'cyan');

  try {
    execCommand('pnpm --filter=server db:reset --force', {
      env: { NODE_ENV: 'test' },
    });
    log('  ✓ 数据库已重置', 'green');
    return true;
  } catch (error) {
    log('  ⚠ 数据库重置失败', 'yellow');
    return false;
  }
}

// 清理 Redis
async function clearRedis() {
  log('\n📦 清理 Redis 缓存...', 'cyan');

  try {
    execCommand('redis-cli FLUSHALL', { silent: true });
    log('  ✓ Redis 缓存已清理', 'green');
  } catch {
    log('  ⚠ Redis 未运行，跳过', 'yellow');
  }
}

// 清理构建缓存
async function clearBuildCache() {
  log('\n🧹 清理构建缓存...', 'cyan');

  const cacheDirs = [
    'apps/web/.next',
    'apps/server/dist',
    'node_modules/.cache',
  ];

  for (const dir of cacheDirs) {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  log('  ✓ 构建缓存已清理', 'green');
}

// 启动后端服务
async function startServer() {
  log('\n🚀 启动后端服务...', 'cyan');

  const serverProcess = spawn('pnpm', ['--filter=server', 'run', 'dev'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'development', PORT: '4001' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: true,
  });

  serverProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Nest application successfully started')) {
      log('  ✓ 后端服务已启动 (PID: ' + serverProcess.pid + ')', 'green');
    }
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });

  serverProcess.unref();

  // 等待服务启动
  await sleep(5000);

  return serverProcess.pid;
}

// 启动前端服务
async function startWeb() {
  log('\n🌐 启动前端服务...', 'cyan');

  const webProcess = spawn('pnpm', ['--filter=web', 'run', 'dev'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: true,
  });

  webProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready') || output.includes('Local:')) {
      log('  ✓ 前端服务已启动 (PID: ' + webProcess.pid + ')', 'green');
    }
  });

  webProcess.unref();

  // 等待服务启动
  await sleep(10000);

  return webProcess.pid;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const quickMode = args.includes('--quick');
  const fullMode = args.includes('--full');
  const noStart = args.includes('--no-start');

  log('\n' + '='.repeat(50), 'cyan');
  log('🔄 项目管理器环境重置工具', 'cyan');
  log('='.repeat(50) + '\n', 'cyan');

  try {
    // 清理旧进程
    await killOldProcesses();

    // 清理构建缓存
    if (!quickMode) {
      await clearBuildCache();
    }

    // 清理 Redis
    await clearRedis();

    // 重置数据库
    if (!quickMode || args.includes('--db')) {
      await resetDatabase();
    }

    // 启动服务
    if (!noStart && (fullMode || args.includes('--start'))) {
      const serverPid = await startServer();
      const webPid = await startWeb();

      log('\n' + '='.repeat(50), 'green');
      log('✅ 环境重置完成，服务已启动！', 'green');
      log('='.repeat(50) + '\n', 'green');
      log(`后端服务 PID: ${serverPid}`);
      log(`前端服务 PID: ${webPid}`);
      log('\n访问地址:');
      log('  前端: http://localhost:4000');
      log('  后端: http://localhost:4001/api\n');
    } else {
      log('\n' + '='.repeat(50), 'green');
      log('✅ 环境重置完成！', 'green');
      log('='.repeat(50) + '\n', 'green');
    }
  } catch (error) {
    log('\n❌ 环境重置失败！', 'red');
    console.error(error);
    process.exit(1);
  }
}

main();
