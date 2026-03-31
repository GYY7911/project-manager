'use client';

import { Card, CardContent } from '@/components/ui/card';

interface TeamOverviewProps {
  data: {
    highRiskCount: number;
    delayedCount: number;
    dueTodayCount: number;
    totalWorkload: number;
    highRiskMembers: string[];
  } | null;
  isLoading: boolean;
}

export function TeamOverviewChart({ data, isLoading }: TeamOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass animate-pulse">
            <CardContent className="pt-4">
              <div className="h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const stats = [
    {
      label: '高风险员工',
      value: data.highRiskCount,
      subLabel: '高分员工',
      icon: '⚠️',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      label: '已延期',
      value: data.delayedCount,
      subLabel: '延期数',
      icon: '🔴',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: '今日到期',
      value: data.dueTodayCount,
      subLabel: '今日到期',
      icon: '📅',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: '总负荷',
      value: data.totalWorkload,
      subLabel: '总任务',
      icon: '📈',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className={`glass ${stat.bgColor}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.subLabel}</p>
                </div>
                <span className="text-3xl">{stat.icon}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.highRiskMembers.length > 0 && (
        <Card className="glass bg-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="text-sm text-muted-foreground">
                高风险员工：
                <span className="text-red-400 font-medium">
                  {' '}{data.highRiskMembers.join('、')}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
