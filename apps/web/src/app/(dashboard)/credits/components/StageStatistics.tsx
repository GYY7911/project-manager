'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StageLabels } from '@pm/shared';

interface StageStat {
  stage: string;
  onTimeCount: number;
  delayedCount: number;
  totalDelayDays: number;
  totalScore: number;
}

interface StageStatisticsProps {
  stageStats: StageStat[];
}

export function StageStatistics({ stageStats }: StageStatisticsProps) {
  if (!stageStats || stageStats.length === 0) {
    return null;
  }

  // 按分数排序
  const sorted = [...stageStats].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">各阶段完成情况</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {sorted.map((stat) => {
            const stageLabel = StageLabels[stat.stage as keyof typeof StageLabels] || stat.stage;
            const total = stat.onTimeCount + stat.delayedCount;
            const onTimeRate = total > 0 ? Math.round((stat.onTimeCount / total) * 100) : 0;

            return (
              <div
                key={stat.stage}
                className="p-3 rounded-lg bg-white/5 border border-border/50"
              >
                <div className="text-xs text-muted-foreground mb-2 truncate" title={stageLabel}>
                  {stageLabel}
                </div>

                {/* 按时/延期统计 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    <span className="text-green-400 text-sm font-medium">{stat.onTimeCount}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">/</span>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span className="text-red-400 text-sm font-medium">{stat.delayedCount}</span>
                  </div>
                </div>

                {/* 按时率进度条 */}
                {total > 0 && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                      style={{ width: `${onTimeRate}%` }}
                    />
                  </div>
                )}

                {/* 延期天数和分数 */}
                <div className="flex items-center justify-between text-xs">
                  {stat.totalDelayDays > 0 && (
                    <span className="text-red-400">延期{stat.totalDelayDays}天</span>
                  )}
                  {stat.totalDelayDays === 0 && (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <span className={stat.totalScore >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {stat.totalScore > 0 ? '+' : ''}{stat.totalScore}分
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
