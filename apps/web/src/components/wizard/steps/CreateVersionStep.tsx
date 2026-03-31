'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { OnboardingData } from '@/store';
import { api } from '@/lib/api';
import { formatLocalDate } from '@/lib/date';
import { Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ExistingVersionInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  testCyclesCount?: number;
  requirementsCount?: number;
  issuesCount?: number;
}

interface CreateVersionStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onCreatedVersion: (id: string) => void;
}

export function CreateVersionStep({
  data,
  updateData,
  onNext,
  onCreatedVersion,
}: CreateVersionStepProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: data.version?.name || '',
    startDate: data.version?.startDate || '',
    endDate: data.version?.endDate || '',
    description: data.version?.description || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 版本已存在对话框状态
  const [showExistingDialog, setShowExistingDialog] = useState(false);
  const [existingVersion, setExistingVersion] = useState<ExistingVersionInfo | null>(null);
  const [isUsingExisting, setIsUsingExisting] = useState(false);

  // 当外部 data 变化时，只更新 name 和 description，不覆盖用户正在编辑的日期
  useEffect(() => {
    if (data.version) {
      setFormData(prev => ({
        ...prev,
        name: data.version?.name || prev.name,
        description: data.version?.description || prev.description,
        // 只有当本地日期为空时才使用外部数据
        startDate: prev.startDate || data.version?.startDate || '',
        endDate: prev.endDate || data.version?.endDate || '',
      }));
    }
  }, [data.version]);

  // Parse date strings to Date objects for DateRangePicker
  const startDateObj = formData.startDate ? new Date(formData.startDate) : undefined;
  const endDateObj = formData.endDate ? new Date(formData.endDate) : undefined;

  const handleStartDateChange = (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      startDate: date ? formatLocalDate(date) : '',
    }));
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      endDate: date ? formatLocalDate(date) : '',
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      setError('请填写版本名称、开始日期和结束日期');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setError('开始日期不能晚于结束日期');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 使用新的 createOrUseVersion API
      const result = await api.createOrUseVersion({
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });

      console.log('[DEBUG CreateVersionStep] API result:', result);

      // 使版本缓存失效，确保其他页面获取到最新数据
      await queryClient.invalidateQueries({ queryKey: ['versions'] });

      updateData({
        version: formData,
      });

      console.log('[DEBUG CreateVersionStep] Calling onCreatedVersion with id:', result.id);
      onCreatedVersion(result.id);
      onNext();
    } catch (err: any) {
      // 检查是否是版本已存在的错误
      const errorData = err?.response?.data || err?.data;
      if (errorData?.existingVersion) {
        setExistingVersion(errorData.existingVersion);
        setShowExistingDialog(true);
      } else {
        setError(err instanceof Error ? err.message : '创建版本失败，请重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 使用现有版本继续
  const handleUseExisting = async () => {
    if (!existingVersion) return;

    setIsUsingExisting(true);
    try {
      const result = await api.createOrUseVersion({
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        useExisting: true,
      });

      // 使版本缓存失效，确保其他页面获取到最新数据
      await queryClient.invalidateQueries({ queryKey: ['versions'] });

      // 更新表单数据为现有版本的数据
      setFormData(prev => ({
        ...prev,
        startDate: existingVersion.startDate.split('T')[0],
        endDate: existingVersion.endDate.split('T')[0],
      }));

      updateData({
        version: {
          ...formData,
          startDate: existingVersion.startDate.split('T')[0],
          endDate: existingVersion.endDate.split('T')[0],
        },
      });

      setShowExistingDialog(false);
      onCreatedVersion(result.id);
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : '使用现有版本失败');
    } finally {
      setIsUsingExisting(false);
    }
  };

  // 关闭对话框，返回修改名称
  const handleCloseDialog = () => {
    setShowExistingDialog(false);
    setExistingVersion(null);
  };

  return (
    <>
      <div className="space-y-5">
        {/* 图标和说明 */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            创建你的第一个版本迭代，作为需求和问题单的容器
          </p>
        </div>

        {/* 表单字段 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">版本名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如：V1.0.0 或 2026Q1版本"
            />
          </div>

          <div className="space-y-2">
            <Label>日期范围 *</Label>
            <DateRangePicker
              startDate={startDateObj}
              endDate={endDateObj}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
            />
            <p className="text-xs text-muted-foreground">可以选择任意日期，包括过去的日期</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">版本描述（可选）</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="简单描述这个版本的目标和范围..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* 提交按钮 */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name || !formData.startDate || !formData.endDate}
          >
            {isSubmitting ? '创建中...' : '创建版本并继续'}
          </Button>
        </div>
      </div>

      {/* 版本已存在确认对话框 */}
      <Dialog open={showExistingDialog} onOpenChange={setShowExistingDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              版本名称已存在
            </DialogTitle>
            <DialogDescription className="pt-2">
              发现同名版本「<strong>{existingVersion?.name}</strong>」，请选择如何处理：
            </DialogDescription>
          </DialogHeader>

          {existingVersion && (
            <div className="py-4 space-y-4">
              {/* 现有版本信息 */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">现有版本信息</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>开始日期: {existingVersion.startDate?.split('T')[0]}</div>
                  <div>结束日期: {existingVersion.endDate?.split('T')[0]}</div>
                  <div>状态: {getStatusLabel(existingVersion.status)}</div>
                  {existingVersion.requirementsCount !== undefined && (
                    <div>需求数: {existingVersion.requirementsCount}</div>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleUseExisting}
                  disabled={isUsingExisting}
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isUsingExisting ? '处理中...' : '使用现有版本继续引导'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  className="w-full"
                >
                  修改版本名称
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                选择「使用现有版本」将保留该版本的所有数据，并继续完成引导流程
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// 获取状态的中文标签
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    PLANNING: '规划中',
    DEVELOPMENT: '开发中',
    TESTING: '测试中',
    RELEASED: '已发布',
  };
  return statusMap[status] || status;
}
