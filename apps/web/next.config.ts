import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PM2 模式用 `next start`，不需要 standalone
  // Docker 模式需要 standalone，部署时通过环境变量控制
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
  experimental: {
    turbo: {
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
  },
};

export default nextConfig;
