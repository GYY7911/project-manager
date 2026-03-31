'use client';

import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { differenceInDays } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { WorkflowStage, IssueSeverity } from '@pm/shared';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Copy } from 'lucide-react';

interface KanbanItem {
  id: string;
  type: 'requirement' | 'issue';
  code: string;
  title: string;
  status: string;
  currentStage: WorkflowStage;
  assignee: { id: string; name: string; employeeNo: string };
  severity?: string;
  workload?: number;
  testCycleId?: string;
}

interface KanbanCardProps {
  item: KanbanItem;
  interactionMode: 'drag' | 'click';
  isPM: boolean;
  isDragging?: boolean;
  isDropAllowed?: boolean;
  onClick?: () => void;
  onDuplicate?: (item: KanbanItem) => void;
  delayConfig?: { stageDeadlines: { stage: WorkflowStage; plannedDate: string }[] };
}

const severityColors: Record<string, string> = {
  [IssueSeverity.CRITICAL]: 'bg-red-500/20 text-red-400 dark:bg-red-500/20 dark:text-red-400 bg-red-100 text-red-700',
  [IssueSeverity.HIGH]: 'bg-orange-500/20 text-orange-400 dark:bg-orange-500/20 dark:text-orange-400 bg-orange-100 text-orange-700',
  [IssueSeverity.MEDIUM]: 'bg-yellow-500/20 text-yellow-400 dark:bg-yellow-500/20 dark:text-yellow-400 bg-amber-100 text-amber-700',
  [IssueSeverity.LOW]: 'bg-green-500/20 text-green-400 dark:bg-green-500/20 dark:text-green-400 bg-emerald-100 text-emerald-700',
};

export function KanbanCard({
  item,
  interactionMode,
  isPM,
  isDragging,
  isDropAllowed = true,
  onClick,
  onDuplicate,
  delayConfig
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    disabled: interactionMode === 'click',
  });

  const [isCopying, setIsCopying] = useState(false);

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Calculate delay status for current stage
  const delayStatus = useMemo(() => {
    if (!delayConfig) return null;

    const currentDeadline = delayConfig.stageDeadlines.find(
      (d) => d.stage === item.currentStage
    );
    if (!currentDeadline) return null;

    const plannedDate = new Date(currentDeadline.plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    plannedDate.setHours(0, 0, 0, 0);

    const days = differenceInDays(plannedDate, today);
    return {
      isDelayed: days < 0,
      days: Math.abs(days),
    };
  }, [delayConfig, item.currentStage]);

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl + Click: 复制功能
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (onDuplicate && !isCopying) {
        setIsCopying(true);
        onDuplicate(item);
        // 动画效果持续一段时间后重置
        setTimeout(() => setIsCopying(false), 600);
      }
      return;
    }

    // 普通点击
    if (interactionMode === 'click' && onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        // 当正在拖拽且不允许放置时，显示禁止光标
        cursor: isDragging && !isDropAllowed ? 'not-allowed' : undefined,
      }}
      {...(interactionMode === 'drag' ? listeners : {})}
      {...attributes}
      onClick={handleClick}
      className={cn(
        'p-3 rounded-lg glass cursor-pointer relative overflow-hidden',
        'transition-all duration-200 ease-out',
        'hover:bg-white/10 active:scale-[0.98] dark:hover:bg-white/10 hover:bg-slate-100',
        // 拖拽时的样式 - 更加丝滑
        isDragging && [
          'opacity-90',
          'shadow-2xl',
          'scale-105',
          'rotate-2',
          'ring-2 ring-primary/50',
          'backdrop-blur-xl',
          'bg-background/95',
          'translate-y-0.5',
        ],
        isDragging && !isDropAllowed && 'ring-red-500 ring-offset-2 ring-offset-background',
        item.type === 'issue' && 'border-l-2 border-l-red-500',
        interactionMode === 'click' && 'hover:ring-1 hover:ring-primary/50',
        // 复制动画
        isCopying && [
          'scale-95',
          'ring-2 ring-blue-500/50',
          'bg-blue-500/10',
        ]
      )}
      title="Ctrl+点击可快速复制"
    >
      {/* 复制动画指示器 */}
      {isCopying && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm z-10 animate-pulse">
          <div className="flex items-center gap-1.5 text-blue-400 text-sm font-medium">
            <Copy className="h-4 w-4" />
            复制中...
          </div>
        </div>
      )}
      {/* Header with Delay Badge in Top Right */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge
            variant={item.type === 'requirement' ? 'default' : 'destructive'}
            className="text-xs flex-shrink-0"
          >
            {item.code}
          </Badge>
          {item.severity && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded flex-shrink-0', severityColors[item.severity])}>
              {item.severity}
            </span>
          )}
        </div>
        {/* Delay Status Badge - Top Right Corner */}
        {delayStatus && (
          <div
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium text-xs flex-shrink-0',
              delayStatus.isDelayed
                ? 'text-red-400 bg-red-500/20 ring-1 ring-red-500/30 dark:text-red-400 dark:bg-red-500/20 dark:ring-red-500/30 text-red-700 bg-red-100 ring-red-300'
                : 'text-green-400 bg-green-500/20 ring-1 ring-green-500/30 dark:text-green-400 dark:bg-green-500/20 dark:ring-green-500/30 text-emerald-700 bg-emerald-100 ring-emerald-300'
            )}
          >
            {delayStatus.isDelayed ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            <span>
              {delayStatus.isDelayed
                ? `-${delayStatus.days}`
                : `+${delayStatus.days}`}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium line-clamp-2 mb-2">{item.title}</h4>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-xs">
              {item.assignee.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {item.assignee.name} ({item.assignee.employeeNo})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPM && item.workload !== undefined && (
            <span className="text-xs text-muted-foreground">
              {item.workload}人/天
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
