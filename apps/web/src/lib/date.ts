/**
 * 将 Date 对象格式化为本地日期字符串（YYYY-MM-DD）
 * 使用本地时间而非 UTC，避免时区偏移问题
 *
 * @param date - 要格式化的日期对象
 * @returns 格式化后的日期字符串，如 '2026-01-01'
 *
 * @example
 * const date = new Date(2026, 0, 1); // 2026年1月1日
 * formatLocalDate(date); // '2026-01-01'
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将本地日期字符串解析为 Date 对象
 * 使用本地时间而非 UTC，避免时区偏移问题
 *
 * @param dateStr - 日期字符串，格式为 'YYYY-MM-DD'
 * @returns Date 对象
 *
 * @example
 * parseLocalDate('2026-01-01'); // 2026年1月1日 00:00:00 本地时间
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 检查日期是否有效
 *
 * @param date - 要检查的日期
 * @returns 如果日期有效返回 true，否则返回 false
 */
export function isValidDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * 获取两个日期之间的天数差
 *
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 天数差（包含首尾两天）
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / oneDay) + 1;
}
