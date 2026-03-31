import { describe, it, expect } from 'vitest';
import {
  formatLocalDate,
  parseLocalDate,
  isValidDate,
  getDaysBetween,
} from './date';

describe('formatLocalDate', () => {
  it('应该正确格式化 2026-01-01', () => {
    const date = new Date(2026, 0, 1); // 1月1日
    expect(formatLocalDate(date)).toBe('2026-01-01');
  });

  it('应该正确格式化日期为个位数的情况', () => {
    const date = new Date(2026, 2, 5); // 3月5日
    expect(formatLocalDate(date)).toBe('2026-03-05');
  });

  it('应该正确格式化月份为个位数的情况', () => {
    const date = new Date(2026, 8, 15); // 9月15日
    expect(formatLocalDate(date)).toBe('2026-09-15');
  });

  it('应该正确格式化年末日期', () => {
    const date = new Date(2026, 11, 31); // 12月31日
    expect(formatLocalDate(date)).toBe('2026-12-31');
  });

  it('应该在本地时间下保持日期不变', () => {
    // 测试在本地时间边界的情况
    const date = new Date(2026, 0, 1, 0, 0, 0);
    expect(formatLocalDate(date)).toBe('2026-01-01');
  });

  it('应该在当日末尾仍保持日期不变', () => {
    const date = new Date(2026, 0, 1, 23, 59, 59);
    expect(formatLocalDate(date)).toBe('2026-01-01');
  });
});

describe('parseLocalDate', () => {
  it('应该正确解析 2026-01-01', () => {
    const date = parseLocalDate('2026-01-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0); // January is 0
    expect(date.getDate()).toBe(1);
  });

  it('应该正确解析 2026-12-31', () => {
    const date = parseLocalDate('2026-12-31');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(11); // December is 11
    expect(date.getDate()).toBe(31);
  });

  it('解析后的日期格式化后应该相同', () => {
    const dateStr = '2026-03-15';
    const date = parseLocalDate(dateStr);
    expect(formatLocalDate(date)).toBe(dateStr);
  });

  it('应该设置时间为 00:00:00', () => {
    const date = parseLocalDate('2026-06-20');
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });
});

describe('isValidDate', () => {
  it('应该对有效日期返回 true', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date(2026, 0, 1))).toBe(true);
  });

  it('应该对无效日期返回 false', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false);
    expect(isValidDate(new Date('2026-13-45'))).toBe(false);
  });

  it('应该对 null 返回 false', () => {
    expect(isValidDate(null)).toBe(false);
  });

  it('应该对 undefined 返回 false', () => {
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('getDaysBetween', () => {
  it('应该计算同一天的天数差为 1', () => {
    const date = new Date(2026, 0, 1);
    expect(getDaysBetween(date, date)).toBe(1);
  });

  it('应该正确计算连续两天的天数差', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 2);
    expect(getDaysBetween(start, end)).toBe(2);
  });

  it('应该正确计算一周的天数差', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 7);
    expect(getDaysBetween(start, end)).toBe(7);
  });

  it('应该正确计算跨月的天数差', () => {
    const start = new Date(2026, 0, 30);
    const end = new Date(2026, 1, 2); // 2月2日
    expect(getDaysBetween(start, end)).toBe(4);
  });

  it('应该在开始日期晚于结束日期时仍返回正确结果', () => {
    const start = new Date(2026, 0, 5);
    const end = new Date(2026, 0, 1);
    expect(getDaysBetween(start, end)).toBe(5);
  });
});

describe('formatLocalDate 和 parseLocalDate 往返测试', () => {
  it('应该对所有月份进行正确的往返转换', () => {
    for (let month = 0; month < 12; month++) {
      const originalDate = new Date(2026, month, 15);
      const formatted = formatLocalDate(originalDate);
      const parsed = parseLocalDate(formatted);

      expect(parsed.getFullYear()).toBe(originalDate.getFullYear());
      expect(parsed.getMonth()).toBe(originalDate.getMonth());
      expect(parsed.getDate()).toBe(originalDate.getDate());
    }
  });

  it('应该正确处理闰年日期', () => {
    // 2024 是闰年
    const leapDate = new Date(2024, 1, 29); // 2月29日
    const formatted = formatLocalDate(leapDate);
    const parsed = parseLocalDate(formatted);

    expect(formatted).toBe('2024-02-29');
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(29);
  });

  it('应该修复时区偏移问题：选择的日期不应因为时区而改变', () => {
    // 模拟用户在东八区选择 3月4日的情况
    // 创建本地时间为 2026-03-04 00:00:00 的日期对象
    const localDate = new Date(2026, 2, 4, 0, 0, 0); // 月份是 0-indexed，所以 2 = 3月

    // 使用 formatLocalDate 格式化
    const formatted = formatLocalDate(localDate);

    // 应该返回 '2026-03-04'，不是 '2026-03-03'
    // 这验证了 toISOString() 在 UTC+8 时区会导致日期偏移的问题已被修复
    expect(formatted).toBe('2026-03-04');

    // 验证 toISOString 的问题（这个会失败，证明 bug 的存在）
    // const wrongResult = localDate.toISOString().split('T')[0];
    // 在 UTC+8 时区， wrongResult 会是 '2026-03-03' 而不是 '2026-03-04'
  });

  it('应该在接近午夜时分的日期也能正确格式化', () => {
    // 创建接近午夜的时间（23:59:59）
    const lateNightDate = new Date(2026, 2, 4, 23, 59, 59);

    const formatted = formatLocalDate(lateNightDate);

    // 应该仍然返回 '2026-03-04'
    expect(formatted).toBe('2026-03-04');
  });
});
