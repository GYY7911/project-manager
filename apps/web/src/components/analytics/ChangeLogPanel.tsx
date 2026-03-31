'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge, RiskLevel } from './RiskBadge';

interface ChangeLogPanelProps {
  item: {
    id: string;
    code: string;
    title: string;
    type: 'requirement' | 'issue';
    assigneeName: string;
    currentStage: string;
    status: string;
    riskLevel: string;
    delayedDays: number;
    changeLogs: {
      id: string;
      changeType: string;
      oldValue: string | null;
      newValue: string | null;
      reason: string;
      createdAt: string;
      operatorName: string;
    }[];
    stageHistory: {
      stage: string;
      enteredAt: string;
      leftAt: string | null;
    }[];
  };
  onClose: () => void;
}

const stageLabels: Record<string, string> = {
  REQUIREMENT_DESIGN: '需求设计',
  ALPHA_TEST_DESIGN: 'Alpha测试设计',
  DOCUMENT_SIGN: '文档会签',
  FEATURE_DEV: '功能开发',
  ALPHA_CASE_DEV: 'Alpha用例开发',
  SOP_UPGRADE: '升级SOP',
  VERSION_TEST: '版本转测',
  ISSUE_FIX: '修改问题单',
  CCB_REVIEW: 'CCB评审',
  RELEASE: '版本发布',
};

const changeTypeLabels: Record<string, string> = {
  stage_change: '阶段变更',
  deadline_change: '截止日期变更',
};

export function ChangeLogPanel({ item, onClose }: ChangeLogPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="glass w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-mono text-sm ${item.type === 'requirement' ? 'text-blue-400' : 'text-red-400'}`}>
                {item.code}
              </span>
              <RiskBadge level={item.riskLevel as any} />
              {item.delayedDays > 0 && (
                <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                  延期{item.delayedDays}天
                </span>
              )}
            </div>
            <CardTitle className="text-lg">{item.title}</CardTitle>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            ✕
          </button>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto space-y-4">
          {/* 基本信息 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>负责人: {item.assigneeName}</span>
            <span>阶段: {stageLabels[item.currentStage] || item.currentStage}</span>
          </div>

          {/* 阶段历史 */}
          {item.stageHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                📅 阶段历史
              </h4>
              <div className="space-y-2">
                {item.stageHistory.map((stage, index) => (
                  <div
                    key={index}
                    className="bg-muted/30 rounded p-2 text-sm"
                  >
                    <div className="font-medium">
                      {stageLabels[stage.stage] || stage.stage}
                      {!stage.leftAt && (
                        <span className="text-green-400 ml-2">(当前)</span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs mt-1">
                      进入: {new Date(stage.enteredAt).toLocaleString()}
                      {stage.leftAt && (
                        <span className="ml-2">
                          离开: {new Date(stage.leftAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 变更日志 */}
          {item.changeLogs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                📝 变更日志
              </h4>
              <div className="space-y-2">
                {item.changeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-muted/30 rounded p-3 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                        {changeTypeLabels[log.changeType] || log.changeType}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs mb-1">
                      操作人: {log.operatorName}
                    </div>
                    {log.oldValue && log.newValue && (
                      <div className="text-xs mb-1">
                        <span className="text-red-400">- {log.oldValue}</span>
                        {' → '}
                        <span className="text-green-400">{log.newValue}</span>
                      </div>
                    )}
                    <div className="text-xs bg-muted p-2 rounded mt-1">
                      原因: {log.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.changeLogs.length === 0 && item.stageHistory.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              暂无变更记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
