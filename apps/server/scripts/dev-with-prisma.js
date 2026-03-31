#!/usr/bin/env node

/**
 * 开发服务器启动脚本
 * 同时启动 NestJS 和 Prisma Schema 监听
 */

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('\n🚀 启动开发环境...\n');

// 启动 Prisma 监听
const prismaWatcher = spawn('node', ['scripts/watch-prisma.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

// 启动 NestJS 开发服务器
const nestServer = spawn('nest', ['start', '--watch'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

// 处理退出
process.on('SIGINT', () => {
  prismaWatcher.kill();
  nestServer.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  prismaWatcher.kill();
  nestServer.kill();
  process.exit(0);
});

// 处理子进程退出
nestServer.on('exit', (code) => {
  prismaWatcher.kill();
  process.exit(code || 0);
});
