#!/usr/bin/env node

/**
 * Prisma Schema 变更监听器
 * 当 schema.prisma 变更时自动运行 prisma generate
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const clientPath = path.resolve(__dirname, '../node_modules/.prisma/client');

let lastModified = 0;
let isGenerating = false;

function generateClient() {
  if (isGenerating) return;

  isGenerating = true;
  console.log('\n🔄 检测到 Prisma Schema 变更，重新生成 Client...\n');

  try {
    execSync('npx prisma generate', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('\n✅ Prisma Client 已更新\n');
  } catch (error) {
    console.error('\n❌ Prisma Client 生成失败\n');
  }

  isGenerating = false;
}

function checkSchema() {
  try {
    const stat = fs.statSync(schemaPath);
    if (stat.mtimeMs > lastModified) {
      lastModified = stat.mtimeMs;
      generateClient();
    }
  } catch (error) {
    // 忽略错误
  }
}

// 初始检查
if (fs.existsSync(schemaPath)) {
  lastModified = fs.statSync(schemaPath).mtimeMs;
}

// 开始监听
console.log('👁️  开始监听 Prisma Schema 变更...');
setInterval(checkSchema, 2000);
