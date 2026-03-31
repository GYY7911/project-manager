'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface EmployeeSummary {
  id: string;
  userId: string;
  totalScore: number;
  requirementScore: number;
  issueScore: number;
  delayDeduction: number;
  manualAdjustment: number;
  user: {
    id: string;
    name: string;
    employeeNo: string;
    team?: string;
  };
}

interface EmployeeListProps {
  summaries: EmployeeSummary[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
}

export function EmployeeList({ summaries, selectedUserId, onSelect }: EmployeeListProps) {
  // 按总分排序
  const sorted = [...summaries].sort((a, b) => b.totalScore - a.totalScore);

  if (sorted.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground space-y-2">
        <p>暂无员工数据</p>
        <p className="text-xs">请确保已选择版本，且该版本有分配给员工的需求或问题单</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((summary, index) => {
        const isSelected = selectedUserId === summary.userId;

        return (
          <div
            key={summary.userId}
            onClick={() => onSelect(summary.userId)}
            className={cn(
              'p-3 rounded-lg cursor-pointer transition-all border',
              isSelected
                ? 'bg-primary/10 border-primary/50'
                : 'bg-white/5 border-border/50 hover:border-primary/30 hover:bg-white/10'
            )}
          >
            <div className="flex items-center gap-3">
              {/* 排名 */}
              <span
                className={cn(
                  'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0',
                  index < 3
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-white/10 text-muted-foreground'
                )}
              >
                {index + 1}
              </span>

              {/* 头像 */}
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {summary.user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>

              {/* 用户信息 */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{summary.user.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {summary.user.employeeNo}
                </div>
              </div>

              {/* 总分 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {summary.totalScore >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span
                  className={cn(
                    'text-lg font-bold',
                    summary.totalScore >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {summary.totalScore}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
