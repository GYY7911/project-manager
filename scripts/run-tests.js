#!/usr/bin/env node

/**
 * 完整测试运行脚本
 * 依次运行：环境重置 → 单元测试 → E2E测试 → 环境恢复
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  const args = process.argv.slice(2);
  const skipUnit = args.includes('--skip-unit');
  const skipE2e = args.includes('--skip-e2e');
  const quick = args.includes('--quick');

  log('\n' + '='.repeat(60), 'magenta');
  log('🧪 项目管理器测试套件', 'magenta');
  log('='.repeat(60) + '\n', 'magenta');

  const startTime = Date.now();
  let failed = false;

  // 1. 环境重置
  log('\n' + '─'.repeat(60), 'cyan');
  log('📋 步骤 1: 环境重置', 'cyan');
  log('─'.repeat(60), 'cyan');

  try {
    execCommand('node scripts/env-reset.js' + (quick ? ' --quick' : ''), { ignoreError: true });
  } catch {
    log('  ⚠ 环境重置失败，继续测试...', 'yellow');
  }

  // 2. 单元测试
  if (!skipUnit) {
    log('\n' + '─'.repeat(60), 'cyan');
    log('🔬 步骤 2: 单元测试', 'cyan');
    log('─'.repeat(60), 'cyan');

    try {
      log('\n  📦 后端单元测试...', 'reset');
      execCommand('pnpm --filter=server test');

      log('\n  📦 前端单元测试...', 'reset');
      execCommand('pnpm --filter=web test:run');
    } catch (error) {
      log('  ❌ 单元测试失败！', 'red');
      failed = true;
    }
  }

  // 3. E2E 测试
  if (!skipE2e && !failed) {
    log('\n' + '─'.repeat(60), 'cyan');
    log('🌐 步骤 3: E2E 测试', 'cyan');
    log('─'.repeat(60), 'cyan');

    try {
      log('\n  📦 后端 API E2E 测试...', 'reset');
      execCommand('pnpm --filter=server test:e2e');

      log('\n  📦 前端 E2E 测试...', 'reset');
      execCommand('pnpm test:e2e');
    } catch (error) {
      log('  ❌ E2E 测试失败！', 'red');
      failed = true;
    }
  }

  // 4. 环境恢复
  log('\n' + '─'.repeat(60), 'cyan');
  log('🔄 步骤 4: 环境恢复', 'cyan');
  log('─'.repeat(60), 'cyan');

  try {
    execCommand('node scripts/env-reset.js --quick --db', { ignoreError: true });
  } catch {
    log('  ⚠ 环境恢复失败', 'yellow');
  }

  // 5. 输出结果
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  log('\n' + '='.repeat(60), failed ? 'red' : 'green');
  if (failed) {
    log(`❌ 测试失败！耗时: ${duration}s`, 'red');
  } else {
    log(`✅ 所有测试通过！耗时: ${duration}s`, 'green');
  }
  log('='.repeat(60) + '\n', failed ? 'red' : 'green');

  process.exit(failed ? 1 : 0);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
