#!/usr/bin/env node

/**
 * 开发环境设置脚本
 * 首次启动或新增依赖后运行
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
    shell: true,
  });
}

async function main() {
  log('\n' + '='.repeat(50), 'cyan');
  log('🔧 开发环境设置', 'cyan');
  log('='.repeat(50) + '\n', 'cyan');

  // 1. 安装依赖
  log('\n📦 安装依赖...', 'cyan');
  execCommand('pnpm install');

  // 2. 生成 Prisma Client
  log('\n🗄️  生成 Prisma Client...', 'cyan');
  execCommand('pnpm db:generate');

  // 3. 检查数据库连接并同步 schema
  log('\n📊 同步数据库 Schema...', 'cyan');
  try {
    execCommand('pnpm db:push');
  } catch {
    log('  ⚠ 数据库同步失败，请检查 DATABASE_URL 配置', 'yellow');
  }

  // 4. 运行种子数据
  log('\n🌱 加载种子数据...', 'cyan');
  try {
    execCommand('pnpm --filter=server db:seed');
  } catch {
    log('  ⚠ 种子数据加载失败', 'yellow');
  }

  // 5. 构建共享包
  log('\n🔨 构建共享包...', 'cyan');
  execCommand('pnpm --filter=@pm/shared build', { ignoreError: true });

  log('\n' + '='.repeat(50), 'green');
  log('✅ 开发环境设置完成！', 'green');
  log('='.repeat(50) + '\n', 'green');
  log('现在可以运行以下命令启动开发服务器:');
  log('  pnpm dev          # 同时启动前后端');
  log('  pnpm dev:server   # 只启动后端');
  log('  pnpm dev:web      # 只启动前端\n');
}

main().catch(console.error);
