import { Roles, ROLES_KEY } from './index';
import { UserRole } from '@prisma/client';

describe('Roles Decorator', () => {
  it('应该正确导出 ROLES_KEY', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('Roles 装饰器应该返回 SetMetadata 函数', () => {
    const decorator = Roles(UserRole.ADMIN);

    // SetMetadata 会被调用
    expect(decorator).toBeDefined();
  });

  it('应该支持多个角色', () => {
    const decorator = Roles(UserRole.PM, UserRole.ADMIN);

    expect(decorator).toBeDefined();
  });
});

describe('index.ts exports', () => {
  it('应该导出 roles decorator', () => {
    const exports = require('./index');

    expect(exports).toHaveProperty('Roles');
  });

  it('应该导出 ROLES_KEY', () => {
    const exports = require('./index');

    expect(exports).toHaveProperty('ROLES_KEY');
  });
});
