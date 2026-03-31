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
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  date: propDate,
  onDateChange,
  placeholder = '选择日期',
  className,
  disabled = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(propDate);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(propDate || new Date());

  // 同步 props 变化到内部状态
  React.useEffect(() => {
    setDate(propDate);
  }, [propDate]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setCurrentMonth(date || new Date());
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

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // 点击日期
  const handleDayClick = (day: Date) => {
    if (date && isSameDay(day, date)) {
      // 点击已选日期 → 取消选择
      setDate(undefined);
      onDateChange(undefined);
    } else {
      setDate(day);
      onDateChange(day);
      setIsOpen(false);
    }
  };

  // 清除选择
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    onDateChange(undefined);
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
            const isSelected = date && isSameDay(day, date);
            const isClickable = isCurrentMonth;

            return (
              <button
                key={idx}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && handleDayClick(day)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center text-xs rounded-full transition-all duration-150',
                  !isCurrentMonth && 'text-gray-300 cursor-default',
                  isCurrentMonth && !isSelected && 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer',
                  isSelected && 'bg-blue-500 text-white font-semibold ring-2 ring-blue-300 cursor-pointer',
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
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2',
            'rounded-lg bg-[#F9FAFB] border border-gray-200',
            'hover:border-blue-400 hover:bg-white',
            'focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20',
            'transition-all duration-200 cursor-pointer',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
        >
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
          <span className={cn('text-sm text-left', date ? 'text-gray-700 font-medium' : 'text-gray-400')}>
            {date ? format(date, 'yyyy/MM/dd') : placeholder}
          </span>
          {date && (
            <X
              className="h-3 w-3 text-gray-400 hover:text-red-500 transition-colors ml-auto"
              onClick={handleClear}
            />
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={cn(
            'z-50 rounded-xl overflow-hidden',
            'bg-white border border-gray-200',
            'shadow-2xl shadow-gray-400/30',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            'w-[280px]'
          )}
          align="start"
          sideOffset={8}
        >
          {/* 状态提示栏 */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                !date ? 'bg-gray-300' : 'bg-green-500'
              )} />
              <span className={cn(
                'text-sm',
                !date ? 'text-gray-500' : 'text-green-600 font-medium'
              )}>
                {date ? `已选择：${format(date, 'M月d日')}` : '请选择日期'}
              </span>
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

          {/* 日历 */}
          <div className="p-3">
            {renderCalendar(currentMonth)}
          </div>

          {/* 底部操作栏 */}
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end">
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
