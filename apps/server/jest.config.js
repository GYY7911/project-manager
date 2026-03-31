/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.guard.ts',
    '!src/**/*.decorator.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // 允许 JS 文件
        allowJs: true,
        // 启用装饰器元数据
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    }],
  },
  // 测试前运行的设置文件
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // 测试超时时间
  testTimeout: 10000,
  // 详细输出
  verbose: true,
};
