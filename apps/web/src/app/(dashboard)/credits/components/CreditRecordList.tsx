'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Settings2, Check, X, AlertCircle } from 'lucide-react';
import { StageLabels } from '@pm/shared';

export interface CreditRecord {
  id: string;
  score: number;
  sourceType: string;
  remark?: string;
  createdAt: string;
  workflowStage?: string;
  delayDays?: number | null;
  plannedDate?: string | Date | null;
  actualDate?: string | Date | null;
  isCorrected?: boolean;
  correctedAt?: string | Date | null;
  correctionRemark?: string;
  requirement?: { code: string; title: string; currentStage: string };
  issue?: { code: string; title: string; currentStage: string; severity: string };
  rule?: { name: string; score: number };
  corrections?: { id: string; reason: string; scoreDiff: number; createdAt: string; operator: { name: string } }[];
}

interface CreditRecordListProps {
  records: CreditRecord[];
  canManage: boolean;
  onCorrect: (record: CreditRecord) => void;
  onRefresh: () => void;
}

// 按需求/问题单分组
function groupRecordsByEntity(records: CreditRecord[]) {
  const groups = new Map<string, {
    entityCode: string;
    entityTitle: string;
    entityType: string;
    records: CreditRecord[];
  }>();

  for (const record of records) {
    const entity = record.requirement || record.issue;
    if (!entity) continue;

    const key = entity.code;
    if (!groups.has(key)) {
      groups.set(key, {
        entityCode: entity.code,
        entityTitle: entity.title,
        entityType: record.sourceType === 'REQUIREMENT' ? '需求' : '问题单',
        records: [],
      });
    }
    groups.get(key)!.records.push(record);
  }

  return Array.from(groups.values());
}

export function CreditRecordList({ records, canManage, onCorrect, onRefresh }: CreditRecordListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'ontime' | 'delayed'>('all');

  const groups = groupRecordsByEntity(records);

  // 过滤
  const filteredGroups = groups.map(group => ({
    ...group,
    records: group.records.filter(record => {
      if (filter === 'ontime') return !record.delayDays || record.delayDays === 0;
      if (filter === 'delayed') return record.delayDays && record.delayDays > 0;
      return true;
    }),
  })).filter(group => group.records.length > 0);

  const toggleGroup = (code: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedGroups(newExpanded);
  };

  if (records.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="p-6 text-center text-muted-foreground">
          暂无信用记录
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">信用记录明细</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              全部
            </Button>
            <Button
              variant={filter === 'ontime' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('ontime')}
            >
              按时
            </Button>
            <Button
              variant={filter === 'delayed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('delayed')}
            >
              延期
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filteredGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.entityCode);
          const groupScore = group.records.reduce((sum, r) => sum + r.score, 0);
          const hasDelay = group.records.some(r => r.delayDays && r.delayDays > 0);

          return (
            <div key={group.entityCode} className="border border-border/50 rounded-lg overflow-hidden">
              {/* 分组头部 */}
              <div
                className="flex items-center gap-3 p-3 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => toggleGroup(group.entityCode)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <Badge variant="outline" className="text-xs">
                  {group.entityType}
                </Badge>

                <span className="font-medium text-sm">{group.entityCode}</span>
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {group.entityTitle}
                </span>

                {hasDelay && (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}

                <span className={cn(
                  'font-bold text-sm',
                  groupScore >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {groupScore > 0 ? '+' : ''}{groupScore}
                </span>
              </div>

              {/* 展开的记录列表 */}
              {isExpanded && (
                <div className="border-t border-border/50">
                  {group.records.map((record) => {
                    const stageLabel = record.workflowStage
                      ? StageLabels[record.workflowStage as keyof typeof StageLabels] || record.workflowStage
                      : '-';

                    const isOnTime = !record.delayDays || record.delayDays === 0;
                    const isCorrected = record.isCorrected;

                    return (
                      <div
                        key={record.id}
                        className={cn(
                          'flex items-center gap-4 px-4 py-2 hover:bg-white/5',
                          'border-b border-border/30 last:border-b-0'
                        )}
                      >
                        {/* 状态图标 */}
                        {isOnTime ? (
                          <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-400 flex-shrink-0" />
                        )}

                        {/* 阶段 */}
                        <span className="text-sm text-muted-foreground w-24 truncate">
                          {stageLabel}
                        </span>

                        {/* 日期 */}
                        {record.plannedDate && record.actualDate && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(record.plannedDate), 'MM-dd')}
                            {' → '}
                            {format(new Date(record.actualDate), 'MM-dd')}
                          </span>
                        )}

                        {/* 延期天数 */}
                        {record.delayDays !== null && record.delayDays !== undefined && record.delayDays > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            延期{record.delayDays}天
                          </Badge>
                        )}

                        {/* 矫正标记 */}
                        {isCorrected && (
                          <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/50">
                            已矫正
                          </Badge>
                        )}

                        {/* 备注 */}
                        {record.remark && (
                          <span className="text-xs text-muted-foreground truncate flex-1">
                            {record.remark}
                          </span>
                        )}

                        {/* 分数 */}
                        <span
                          className={cn(
                            'font-medium text-sm w-16 text-right',
                            record.score >= 0 ? 'text-green-400' : 'text-red-400'
                          )}
                        >
                          {record.score > 0 ? '+' : ''}{record.score}
                        </span>

                        {/* 矫正按钮 */}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCorrect(record);
                            }}
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
