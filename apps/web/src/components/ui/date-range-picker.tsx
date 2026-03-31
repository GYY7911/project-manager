'use client';

import * as React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  startOfWeek,
  endOfWeek,
  min,
  max,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Calendar, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  startDate: propStartDate,
  endDate: propEndDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [startDate, setStartDate] = React.useState<Date | undefined>(propStartDate);
  const [endDate, setEndDate] = React.useState<Date | undefined>(propEndDate);
  const [leftMonth, setLeftMonth] = React.useState<Date>(propStartDate || new Date());
  const [hoverDate, setHoverDate] = React.useState<Date | undefined>();

  // 同步 props 变化到内部状态
  React.useEffect(() => {
    setStartDate(propStartDate);
    setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const rightMonth = addMonths(leftMonth, 1);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLeftMonth(startDate || new Date());
    }
    setIsOpen(open);
  };

  const getCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const handlePrevMonth = () => setLeftMonth(subMonths(leftMonth, 1));
  const handleNextMonth = () => setLeftMonth(addMonths(leftMonth, 1));

  // 核心交互逻辑：点击日期
  const handleDayClick = (day: Date) => {
    // 情况1：点击已选的开始日期 → 取消开始日期
    if (startDate && isSameDay(day, startDate)) {
      if (endDate) {
        // 结束日期变为开始日期
        setStartDate(endDate);
        setEndDate(undefined);
        onStartDateChange(endDate);
        onEndDateChange(undefined);
      } else {
        setStartDate(undefined);
        onStartDateChange(undefined);
      }
      return;
    }

    // 情况2：点击已选的结束日期 → 取消结束日期
    if (endDate && isSameDay(day, endDate)) {
      setEndDate(undefined);
      onEndDateChange(undefined);
      return;
    }

    // 情况3：没有开始日期 → 设置开始日期
    if (!startDate) {
      setStartDate(day);
      onStartDateChange(day);
      return;
    }

    // 情况4：有开始日期但没有结束日期 → 设置结束日期（自动排序）
    if (startDate && !endDate) {
      if (isBefore(day, startDate)) {
        // 新日期更早，交换
        setStartDate(day);
        setEndDate(startDate);
        onStartDateChange(day);
        onEndDateChange(startDate);
      } else {
        setEndDate(day);
        onEndDateChange(day);
      }
      return;
    }

    // 情况5：已有完整范围，点击范围外 → 重新开始选择
    if (startDate && endDate) {
      setStartDate(day);
      setEndDate(undefined);
      onStartDateChange(day);
      onEndDateChange(undefined);
    }
  };

  // 获取日期状态
  const getDayState = (day: Date) => {
    if (startDate && isSameDay(day, startDate) && !endDate) return 'start-only';
    if (startDate && isSameDay(day, startDate)) return 'start';
    if (endDate && isSameDay(day, endDate)) return 'end';
    if (startDate && endDate && isAfter(day, startDate) && isBefore(day, endDate)) return 'in-range';

    // 悬停预览
    if (startDate && !endDate && hoverDate) {
      const rangeStart = min([startDate, hoverDate]);
      const rangeEnd = max([startDate, hoverDate]);
      if (isAfter(day, rangeStart) && isBefore(day, rangeEnd)) return 'preview';
      if (isSameDay(day, hoverDate) && !isSameDay(day, startDate)) return 'preview-end';
    }

    return 'default';
  };

  // 获取选择阶段提示文字
  const getStatusText = () => {
    if (!startDate) return '请选择开始日期';
    if (!endDate) return `已选开始：${format(startDate, 'M月d日')}，请选择结束日期`;
    return `${format(startDate, 'M月d日')} → ${format(endDate, 'M月d日')} (${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1}天)`;
  };

  // 确认选择
  const handleConfirm = () => {
    setIsOpen(false);
  };

  // 清除所有选择
  const handleClear = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    onStartDateChange(undefined);
    onEndDateChange(undefined);
  };

  const renderCalendar = (month: Date) => {
    const days = getCalendarDays(month);

    return (
      <div className="flex-1">
        <div className="text-center mb-2">
          <span className="text-sm font-semibold text-gray-800">
            {format(month, 'yyyy年 M月', { locale: zhCN })}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
            <div key={d} className="h-5 flex items-center justify-center text-xs text-gray-400 font-medium">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, month);
            const state = getDayState(day);
            const isClickable = isCurrentMonth;

            return (
              <button
                key={idx}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && handleDayClick(day)}
                onMouseEnter={() => isClickable && setHoverDate(day)}
                onMouseLeave={() => setHoverDate(undefined)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center text-xs rounded-full transition-all duration-150',
                  !isCurrentMonth && 'text-gray-300 cursor-default',
                  isCurrentMonth && state === 'default' && 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer',
                  state === 'start-only' && 'bg-blue-500 text-white font-semibold ring-2 ring-blue-300 cursor-pointer',
                  state === 'start' && 'bg-blue-500 text-white font-semibold rounded-r-none cursor-pointer',
                  state === 'end' && 'bg-blue-500 text-white font-semibold rounded-l-none cursor-pointer',
                  state === 'in-range' && 'bg-blue-100 text-blue-700 rounded-none cursor-pointer',
                  state === 'preview' && 'bg-blue-50 text-blue-400 rounded-none cursor-pointer',
                  state === 'preview-end' && 'bg-blue-100 text-blue-500 rounded-l-none cursor-pointer',
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5',
            'rounded-lg bg-[#F9FAFB] border border-gray-200',
            'hover:border-blue-400 hover:bg-white',
            'focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20',
            'transition-all duration-200 cursor-pointer',
            className
          )}
        >
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
          <span className={cn('text-sm min-w-[80px] text-left', startDate ? 'text-gray-700 font-medium' : 'text-gray-400')}>
            {startDate ? format(startDate, 'yyyy/MM/dd') : '开始日期'}
          </span>
          <span className="text-gray-300">→</span>
          <span className={cn('text-sm min-w-[80px] text-left', endDate ? 'text-gray-700 font-medium' : 'text-gray-400')}>
            {endDate ? format(endDate, 'yyyy/MM/dd') : '结束日期'}
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={cn(
            'z-50 rounded-xl overflow-hidden',
            'bg-white border border-gray-200',
            'shadow-2xl shadow-gray-400/30',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            'w-[520px]'
          )}
          align="center"
          sideOffset={8}
        >
          {/* 状态提示栏 */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  !startDate ? 'bg-gray-300' : !endDate ? 'bg-amber-400 animate-pulse' : 'bg-green-500'
                )} />
                <span className={cn(
                  'text-sm',
                  !startDate ? 'text-gray-500' : !endDate ? 'text-amber-600' : 'text-green-600 font-medium'
                )}>
                  {getStatusText()}
                </span>
              </div>
              {startDate && endDate && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-full transition-colors"
                >
                  <Check className="h-3 w-3" />
                  确定
                </button>
              )}
            </div>
          </div>

          {/* 导航 */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 双日历 */}
          <div className="flex gap-3 p-3">
            {renderCalendar(leftMonth)}
            <div className="w-px bg-gray-100" />
            {renderCalendar(rightMonth)}
          </div>

          {/* 底部操作栏 */}
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <div className="flex gap-2">
              <QuickBtn onClick={() => {
                const today = new Date();
                const start = new Date(today);
                start.setDate(today.getDate() - today.getDay() + 1);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                setStartDate(start);
                setEndDate(end);
                onStartDateChange(start);
                onEndDateChange(end);
              }}>本周</QuickBtn>
              <QuickBtn onClick={() => {
                const today = new Date();
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                setStartDate(start);
                setEndDate(end);
                onStartDateChange(start);
                onEndDateChange(end);
              }}>本月</QuickBtn>
              <QuickBtn onClick={() => {
                const today = new Date();
                const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                setStartDate(start);
                setEndDate(end);
                onStartDateChange(start);
                onEndDateChange(end);
              }}>下月</QuickBtn>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="h-3 w-3" />
              清除
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function QuickBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 text-xs rounded-md text-gray-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-colors"
    >
      {children}
    </button>
  );
}
