'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, TrendingDown, FileText, Bug, Clock, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StageStatistics } from './StageStatistics';
import { CreditRecordList } from './CreditRecordList';
import { CreditRecord } from './CreditRecordList';

interface CreditDetailData {
  user: {
    id: string;
    name: string;
    employeeNo: string;
    team?: string;
  };
  summary: {
    totalScore: number;
    requirementScore: number;
    issueScore: number;
    delayDeduction: number;
    manualAdjustment: number;
  };
  records: CreditRecord[];
  stageStats: {
    stage: string;
    onTimeCount: number;
    delayedCount: number;
    totalDelayDays: number;
    totalScore: number;
  }[];
}

interface CreditDetailPanelProps {
  data: CreditDetailData | undefined;
  isLoading: boolean;
  canManage: boolean;
  onCorrect: (record: CreditRecord) => void;
  onRefresh: () => void;
}

function StatItem({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon?: React.ElementType;
  color: 'green' | 'blue' | 'red' | 'purple' | 'primary';
}) {
  const colorClasses = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    primary: 'text-primary',
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={cn('text-lg font-bold', colorClasses[color])}>
        {value > 0 ? '+' : ''}{value}
      </div>
    </div>
  );
}

export function CreditDetailPanel({
  data,
  isLoading,
  canManage,
  onCorrect,
  onRefresh,
}: CreditDetailPanelProps) {
  if (isLoading) {
    return (
      <Card className="glass p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-white/10 rounded-lg"></div>
          <div className="h-24 bg-white/10 rounded-lg"></div>
          <div className="h-48 bg-white/10 rounded-lg"></div>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="glass p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-4xl">👈</div>
        <p className="text-muted-foreground text-center">
          请从左侧列表中选择一位员工
          <br />
          <span className="text-xs">查看其信用详情和记录</span>
        </p>
      </Card>
    );
  }

  const { user, summary, records, stageStats } = data;

  return (
    <div className="space-y-4">
      {/* 汇总统计卡片 */}
      <Card className="glass p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* 用户信息 */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground">
                {user.employeeNo}
                {user.team && ` - ${user.team}`}
              </p>
            </div>
          </div>

          {/* 统计数据 */}
          <div className="flex items-center gap-6">
            <StatItem
              label="需求得分"
              value={summary.requirementScore}
              icon={FileText}
              color="green"
            />
            <StatItem
              label="问题单得分"
              value={summary.issueScore}
              icon={Bug}
              color="blue"
            />
            <StatItem
              label="延期扣分"
              value={-summary.delayDeduction}
              icon={Clock}
              color="red"
            />
            <StatItem
              label="手动调整"
              value={summary.manualAdjustment}
              icon={Settings}
              color="purple"
            />
            <div className="pl-4 border-l border-border">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                {summary.totalScore >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                总分
              </div>
              <div
                className={cn(
                  'text-2xl font-bold',
                  summary.totalScore >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {summary.totalScore}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 各阶段统计 */}
      {stageStats && stageStats.length > 0 && (
        <StageStatistics stageStats={stageStats} />
      )}

      {/* 信用记录列表 */}
      <CreditRecordList
        records={records}
        canManage={canManage}
        onCorrect={onCorrect}
        onRefresh={onRefresh}
      />
    </div>
  );
}
