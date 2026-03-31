'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface CreditRecord {
  id: string;
  score: number;
  sourceType: string;
  remark?: string;
  workflowStage?: string;
  delayDays?: number | null;
  plannedDate?: string | Date | null;
  actualDate?: string | Date | null;
  requirement?: { code: string; title: string };
  issue?: { code: string; title: string };
  rule?: { name: string; score: number };
}

interface CorrectRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CreditRecord | null;
  onSuccess: () => void;
}

export function CorrectRecordDialog({
  open,
  onOpenChange,
  record,
  onSuccess,
}: CorrectRecordDialogProps) {
  const [form, setForm] = useState({
    plannedDate: '',
    actualDate: '',
    overrideScore: '',
    reason: '',
  });

  const [preview, setPreview] = useState<{
    originalScore: number;
    newScore: number;
    scoreDiff: number;
    newDelayDays: number;
    originalDelayDays: number;
  } | null>(null);

  // 当记录改变时，重置表单
  useEffect(() => {
    if (record) {
      setForm({
        plannedDate: record.plannedDate
          ? format(new Date(record.plannedDate), 'yyyy-MM-dd')
          : '',
        actualDate: record.actualDate
          ? format(new Date(record.actualDate), 'yyyy-MM-dd')
          : '',
        overrideScore: '',
        reason: '',
      });
      setPreview(null);
    }
  }, [record]);

  // 预览矫正效果
  const previewMutation = useMutation({
    mutationFn: () =>
      api.previewCorrection({
        recordId: record!.id,
        plannedDate: form.plannedDate || undefined,
        actualDate: form.actualDate || undefined,
        overrideScore: form.overrideScore ? Number(form.overrideScore) : undefined,
      }),
    onSuccess: setPreview,
  });

  // 当日期改变时，自动预览
  useEffect(() => {
    if (form.plannedDate && form.actualDate && record) {
      previewMutation.mutate();
    }
  }, [form.plannedDate, form.actualDate, record?.id]);

  // 执行矫正
  const correctMutation = useMutation({
    mutationFn: () =>
      api.correctCreditRecord({
        recordId: record!.id,
        plannedDate: form.plannedDate || undefined,
        actualDate: form.actualDate || undefined,
        overrideScore: form.overrideScore ? Number(form.overrideScore) : undefined,
        reason: form.reason,
      }),
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
  });

  if (!record) return null;

  const entityInfo = record.requirement || record.issue;
  const entityType = record.sourceType === 'REQUIREMENT' ? '需求' : '问题单';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>矫正信用记录</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* 实体信息 */}
          <div className="p-3 rounded-lg bg-muted/30 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">类型:</span>
              <span>{entityType}</span>
            </div>
            {entityInfo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">编号:</span>
                <span>{entityInfo.code}</span>
              </div>
            )}
          </div>

          {/* 原始记录 */}
          <div className="p-3 rounded-lg bg-muted/30 text-sm">
            <div className="text-muted-foreground mb-2">原始记录</div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">分数:</span>
              <span className={cn(record.score >= 0 ? 'text-green-400' : 'text-red-400')}>
                {record.score > 0 ? '+' : ''}{record.score}
              </span>
            </div>
            {record.delayDays !== null && record.delayDays !== undefined && (
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">延期天数:</span>
                <span>{record.delayDays}天</span>
              </div>
            )}
            {record.remark && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">备注:</span>
                <span>{record.remark}</span>
              </div>
            )}
          </div>

          {/* 日期修正 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>计划日期</Label>
              <Input
                type="date"
                value={form.plannedDate}
                onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>实际日期</Label>
              <Input
                type="date"
                value={form.actualDate}
                onChange={(e) => setForm({ ...form, actualDate: e.target.value })}
              />
            </div>
          </div>

          {/* 强制覆盖分数 */}
          <div className="space-y-2">
            <Label>强制覆盖分数（可选）</Label>
            <Input
              type="number"
              value={form.overrideScore}
              onChange={(e) => setForm({ ...form, overrideScore: e.target.value })}
              placeholder="留空则自动计算"
            />
          </div>

          {/* 预览结果 */}
          {preview && (
            <div
              className={cn(
                'p-3 rounded-lg text-sm',
                preview.scoreDiff > 0
                  ? 'bg-green-500/20 text-green-400'
                  : preview.scoreDiff < 0
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-muted/30'
              )}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between">
                  <span>原始分数:</span>
                  <span>{preview.originalScore}</span>
                </div>
                <div className="flex justify-between">
                  <span>新分数:</span>
                  <span>{preview.newScore}</span>
                </div>
                <div className="flex justify-between">
                  <span>原延期天数:</span>
                  <span>{preview.originalDelayDays}天</span>
                </div>
                <div className="flex justify-between">
                  <span>新延期天数:</span>
                  <span>{preview.newDelayDays}天</span>
                </div>
              </div>
              <div className="border-t border-current/20 mt-2 pt-2">
                <div className="flex justify-between font-medium">
                  <span>分数变化:</span>
                  <span>
                    {preview.scoreDiff > 0 ? '+' : ''}{preview.scoreDiff}分
                    {preview.scoreDiff > 0 && '（将补回）'}
                    {preview.scoreDiff < 0 && '（将扣除）'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 矫正原因 */}
          <div className="space-y-2">
            <Label>矫正原因 *</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请说明矫正原因..."
            />
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={() => correctMutation.mutate()}
              disabled={!form.reason || correctMutation.isPending}
            >
              {correctMutation.isPending ? '处理中...' : '确认矫正'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
