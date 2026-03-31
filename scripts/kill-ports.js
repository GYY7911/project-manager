#!/usr/bin/env node

/**
 * 端口清理脚本
 * 用于清理 4000 和 4001 端口上的进程
 */

const { execSync } = require('child_process');

const PORTS = [4000, 4001];

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

function killPortWindows(port) {
  try {
    // 查找占用端口的进程
    const result = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (!result.trim()) {
      log(`  端口 ${port}: 空闲`, 'green');
      return true;
    }

    // 提取 PID
    const lines = result.trim().split('\n');
    const pids = new Set();

    for (const line of lines) {
      const match = line.match(/\s+(\d+)\s*$/);
      if (match && match[1] !== '0') {
        pids.add(match[1]);
      }
    }

    if (pids.size === 0) {
      log(`  端口 ${port}: 空闲`, 'green');
      return true;
    }

    // 杀死进程
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        log(`  端口 ${port}: 已杀死进程 PID ${pid}`, 'yellow');
      } catch {
        // 进程可能已经不存在
      }
    }

    return true;
  } catch (error) {
    // netstat 没有找到结果，端口空闲
    log(`  端口 ${port}: 空闲`, 'green');
    return true;
  }
}

function killPortUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
      stdio: 'ignore',
      shell: true
    });
    log(`  端口 ${port}: 已清理`, 'green');
    return true;
  } catch {
    log(`  端口 ${port}: 空闲`, 'green');
    return true;
  }
}

function main() {
  log('\n🔧 清理端口...', 'cyan');
  log('─'.repeat(30), 'cyan');

  const isWindows = process.platform === 'win32';
  const killFn = isWindows ? killPortWindows : killPortUnix;

  for (const port of PORTS) {
    killFn(port);
  }

  log('─'.repeat(30), 'green');
  log('✅ 端口清理完成！\n', 'green');
}

main();
