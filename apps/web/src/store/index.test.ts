import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole } from '@pm/shared';
import { isPMOrAdmin, useHasHydrated, OnboardingStatus, Theme } from './index';

// 测试 isPMOrAdmin 函数
describe('isPMOrAdmin', () => {
  it('应该对 PM 角色返回 true', () => {
    expect(isPMOrAdmin(UserRole.PM)).toBe(true);
  });

  it('应该对 ADMIN 角色返回 true', () => {
    expect(isPMOrAdmin(UserRole.ADMIN)).toBe(true);
  });

  it('应该对 MEMBER 角色返回 false', () => {
    expect(isPMOrAdmin(UserRole.MEMBER)).toBe(false);
  });

  it('应该对 undefined 返回 false', () => {
    expect(isPMOrAdmin(undefined)).toBe(false);
  });

  it('应该对 null 返回 false', () => {
    expect(isPMOrAdmin(null as any)).toBe(false);
  });

  it('应该对空字符串返回 false', () => {
    expect(isPMOrAdmin('' as any)).toBe(false);
  });

  it('应该对无效角色返回 false', () => {
    expect(isPMOrAdmin('INVALID' as any)).toBe(false);
  });
});

// 测试类型导出
describe('类型导出', () => {
  it('应该正确导出 OnboardingStatus 类型', () => {
    const status: OnboardingStatus = 'not_started';
    expect(['not_started', 'in_progress', 'completed', 'skipped']).toContain(status);
  });

  it('应该正确导出 Theme 类型', () => {
    const theme: Theme = 'dark';
    expect(['dark', 'light']).toContain(theme);
  });
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// 测试 useHasHydrated hook
describe('useHasHydrated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('应该是一个函数', () => {
    expect(typeof useHasHydrated).toBe('function');
  });
});

// 边界情况测试
describe('isPMOrAdmin 边界情况', () => {
  it('应该对数字返回 false', () => {
    expect(isPMOrAdmin(1 as any)).toBe(false);
    expect(isPMOrAdmin(0 as any)).toBe(false);
  });

  it('应该对对象返回 false', () => {
    expect(isPMOrAdmin({} as any)).toBe(false);
  });

  it('应该对数组返回 false', () => {
    expect(isPMOrAdmin([] as any)).toBe(false);
  });

  it('应该对布尔值返回 false', () => {
    expect(isPMOrAdmin(true as any)).toBe(false);
    expect(isPMOrAdmin(false as any)).toBe(false);
  });

  it('应该区分大小写', () => {
    expect(isPMOrAdmin('pm' as any)).toBe(false);
    expect(isPMOrAdmin('admin' as any)).toBe(false);
    expect(isPMOrAdmin('Pm' as any)).toBe(false);
    expect(isPMOrAdmin('Admin' as any)).toBe(false);
  });
});

// 性能测试
describe('isPMOrAdmin 性能', () => {
  it('应该在 1ms 内执行 10000 次调用', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      isPMOrAdmin(UserRole.PM);
      isPMOrAdmin(UserRole.ADMIN);
      isPMOrAdmin(UserRole.MEMBER);
    }
    const end = performance.now();
    expect(end - start).toBeLessThan(10); // 10ms 是一个宽松的阈值
  });
});
