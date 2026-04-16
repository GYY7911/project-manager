// PM2 启动 Next.js 前端的包装脚本
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 在 pnpm store 中找到 next CLI
const pnpmDir = path.resolve(__dirname, '../node_modules/.pnpm');
const nextBin = fs.readdirSync(pnpmDir)
  .filter(d => d.startsWith('next@'))
  .map(d => path.join(pnpmDir, d, 'node_modules/next/dist/bin/next'))
  .find(p => fs.existsSync(p));

if (!nextBin) {
  console.error('Cannot find next binary in node_modules/.pnpm');
  process.exit(1);
}

const port = process.env.PORT || 4000;

try {
  execFileSync('node', [nextBin, 'start', '-p', String(port)], {
    cwd: path.resolve(__dirname, '../apps/web'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
} catch (e) {
  process.exit(e.status || 1);
}
