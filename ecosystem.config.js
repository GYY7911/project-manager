module.exports = {
  apps: [
    {
      name: 'pm-server',
      script: 'dist/src/main.js',
      cwd: './apps/server',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres123@localhost:5432/project_manager?schema=public',
        JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',
        PORT: 4001,
        CORS_ORIGINS: 'http://localhost:4000',
      },
    },
    {
      name: 'pm-web',
      script: 'scripts/start-web.js',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        NEXT_PUBLIC_API_URL: 'http://localhost:4001/api',
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
