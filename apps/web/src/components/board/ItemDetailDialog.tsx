'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { WorkflowStage, StageLabels, IssueSeverity, StageDeadline } from '@pm/shared';
import { api } from '@/lib/api';
import { FileText, AlertCircle, User, Calendar, Clock, Settings2, ChevronDown, ChevronUp, Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import { formatLocalDate } from '@/lib/date';

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
  // 备注字段
  productionImpact?: string;
  lessonLearned?: string;
  improvementPlan?: string;
}

interface DelayConfig {
  id?: string;
  entityId?: string;
  stageDeadlines: StageDeadline[];
  // 备注字段
  productionImpact?: string;
  lessonLearned?: string;
  improvementPlan?: string;
}

interface ItemDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: KanbanItem | null;
  testCycles?: { id: string; name: string }[];
  delayConfig?: DelayConfig;
  versionId?: string;
  isPM?: boolean;
}

const severityColors: Record<string, string> = {
  [IssueSeverity.CRITICAL]: 'bg-red-500/20 text-red-400 border-red-500/30 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 bg-red-100 text-red-700 border-red-300',
  [IssueSeverity.HIGH]: 'bg-orange-500/20 text-orange-400 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30 bg-orange-100 text-orange-700 border-orange-300',
  [IssueSeverity.MEDIUM]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30 bg-amber-100 text-amber-700 border-amber-300',
  [IssueSeverity.LOW]: 'bg-green-500/20 text-green-400 border-green-500/30 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30 bg-emerald-100 text-emerald-700 border-emerald-300',
};

const severityLabels: Record<string, string> = {
  [IssueSeverity.CRITICAL]: '致命',
  [IssueSeverity.HIGH]: '严重',
  [IssueSeverity.MEDIUM]: '一般',
  [IssueSeverity.LOW]: '轻微',
};

const stageColors: Record<WorkflowStage, { bg: string; border: string; text: string }> = {
  [WorkflowStage.REQUIREMENT_DESIGN]: { bg: 'bg-blue-100 dark:bg-blue-500/15', border: 'border-blue-300 dark:border-blue-500/40', text: 'text-blue-700 dark:text-blue-300' },
  [WorkflowStage.FEATURE_DEV]: { bg: 'bg-green-100 dark:bg-green-500/15', border: 'border-green-300 dark:border-green-500/40', text: 'text-green-700 dark:text-green-300' },
  [WorkflowStage.ALPHA_CASE_DEV]: { bg: 'bg-teal-100 dark:bg-teal-500/15', border: 'border-teal-300 dark:border-teal-500/40', text: 'text-teal-700 dark:text-teal-300' },
  [WorkflowStage.ALPHA_TEST_DESIGN]: { bg: 'bg-purple-100 dark:bg-purple-500/15', border: 'border-purple-300 dark:border-purple-500/40', text: 'text-purple-700 dark:text-purple-300' },
  [WorkflowStage.VERSION_TEST]: { bg: 'bg-orange-100 dark:bg-orange-500/15', border: 'border-orange-300 dark:border-orange-500/40', text: 'text-orange-700 dark:text-orange-300' },
  [WorkflowStage.ISSUE_FIX]: { bg: 'bg-red-100 dark:bg-red-500/15', border: 'border-red-300 dark:border-red-500/40', text: 'text-red-700 dark:text-red-300' },
  [WorkflowStage.RELEASE]: { bg: 'bg-pink-100 dark:bg-pink-500/15', border: 'border-pink-300 dark:border-pink-500/40', text: 'text-pink-700 dark:text-pink-300' },
  [WorkflowStage.CCB_REVIEW]: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', border: 'border-indigo-300 dark:border-indigo-500/40', text: 'text-indigo-700 dark:text-indigo-300' },
  [WorkflowStage.DOCUMENT_SIGN]: { bg: 'bg-slate-100 dark:bg-slate-500/15', border: 'border-slate-300 dark:border-slate-500/40', text: 'text-slate-700 dark:text-slate-300' },
  [WorkflowStage.SOP_UPGRADE]: { bg: 'bg-amber-100 dark:bg-amber-500/15', border: 'border-amber-300 dark:border-amber-500/40', text: 'text-amber-700 dark:text-amber-300' },
};

// Default stages for requirements
const DEFAULT_REQUIREMENT_STAGES: WorkflowStage[] = [
  WorkflowStage.REQUIREMENT_DESIGN,
  WorkflowStage.ALPHA_TEST_DESIGN,
  WorkflowStage.DOCUMENT_SIGN,
  WorkflowStage.FEATURE_DEV,
  WorkflowStage.ALPHA_CASE_DEV,
  WorkflowStage.SOP_UPGRADE,
];

// Default stages for issues
const DEFAULT_ISSUE_STAGES: WorkflowStage[] = [
  WorkflowStage.ISSUE_FIX,
];

// All available stages in order
const ALL_STAGES_ORDERED: WorkflowStage[] = [
  WorkflowStage.REQUIREMENT_DESIGN,
  WorkflowStage.ALPHA_TEST_DESIGN,
  WorkflowStage.DOCUMENT_SIGN,
  WorkflowStage.FEATURE_DEV,
  WorkflowStage.ALPHA_CASE_DEV,
  WorkflowStage.SOP_UPGRADE,
  WorkflowStage.VERSION_TEST,
  WorkflowStage.ISSUE_FIX,
  WorkflowStage.CCB_REVIEW,
  WorkflowStage.RELEASE,
];

// 可双击编辑的备注字段组件
function EditableNoteField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(value);
  };

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  return (
    <div className="flex items-start gap-3 group">
      <label className="text-sm text-muted-foreground w-20 flex-shrink-0 pt-2">
        {label}
      </label>
      <div className="flex-1">
        {isEditing ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSave();
              }
              if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            placeholder={placeholder}
            className="min-h-[60px] bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 resize-none"
            autoFocus
          />
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            className={cn(
              'min-h-[60px] p-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5',
              'cursor-text transition-all duration-200',
              'hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10',
              'group-hover:ring-1 group-hover:ring-primary/20'
            )}
          >
            {value ? (
              <p className="text-sm whitespace-pre-wrap">{value}</p>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {placeholder}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ItemDetailDialog({
  open,
  onOpenChange,
  item,
  testCycles = [],
  delayConfig,
  versionId,
  isPM = false,
}: ItemDetailDialogProps) {
  const queryClient = useQueryClient();
  const [showScheduleConfig, setShowScheduleConfig] = useState(false);
  const [selectedStages, setSelectedStages] = useState<WorkflowStage[]>([]);
  const [stageDeadlines, setStageDeadlines] = useState<Map<WorkflowStage, string>>(new Map());
  const [hasInitializedDefaults, setHasInitializedDefaults] = useState(false);

  // 备注字段状态 - 常态化显示
  const [productionImpact, setProductionImpact] = useState('');
  const [lessonLearned, setLessonLearned] = useState('');
  const [improvementPlan, setImprovementPlan] = useState('');

  const isRequirement = item?.type === 'requirement';

  // 初始化备注字段
  useEffect(() => {
    if (open && item) {
      setProductionImpact(delayConfig?.productionImpact || item?.productionImpact || '');
      setLessonLearned(delayConfig?.lessonLearned || item?.lessonLearned || '');
      setImprovementPlan(delayConfig?.improvementPlan || item?.improvementPlan || '');
    }
  }, [open, item, delayConfig]);

  // Initialize selected stages and deadlines when opening config panel
  useEffect(() => {
    if (showScheduleConfig && item && !hasInitializedDefaults) {
      const existingDeadlines = delayConfig?.stageDeadlines || [];

      if (existingDeadlines.length > 0) {
        const stages = existingDeadlines.map(d => d.stage);
        const deadlineMap = new Map<WorkflowStage, string>();
        existingDeadlines.forEach(d => deadlineMap.set(d.stage, d.plannedDate));
        setSelectedStages(stages);
        setStageDeadlines(deadlineMap);
      } else {
        const defaultStages = isRequirement ? DEFAULT_REQUIREMENT_STAGES : DEFAULT_ISSUE_STAGES;
        setSelectedStages(defaultStages);
        const today = formatLocalDate(new Date());
        const deadlineMap = new Map<WorkflowStage, string>();
        defaultStages.forEach(stage => deadlineMap.set(stage, today));
        setStageDeadlines(deadlineMap);
      }

      setHasInitializedDefaults(true);
    }
  }, [showScheduleConfig, item, delayConfig, isRequirement, hasInitializedDefaults]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowScheduleConfig(false);
      setHasInitializedDefaults(false);
      setSelectedStages([]);
      setStageDeadlines(new Map());
    }
  }, [open]);

  // Update delay config mutation (包括备注字段)
  const updateConfigMutation = useMutation({
    mutationFn: async (data: {
      deadlines: StageDeadline[];
      productionImpact: string;
      lessonLearned: string;
      improvementPlan: string;
    }) => {
      if (!item || !versionId) return;
      return api.updateDelayConfig({
        entityId: item.id,
        entityType: item.type,
        versionId,
        stageDeadlines: data.deadlines,
        // 注意：后端目前只保存 stageDeadlines
        // 备注字段需要后端扩展支持
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delay-configs', versionId] });
      queryClient.refetchQueries({ queryKey: ['delay-configs', versionId] });
      setShowScheduleConfig(false);
    },
  });

  // Delete delay config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async () => {
      if (!delayConfig?.id) return;
      return api.deleteDelayConfig(delayConfig.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delay-configs', versionId] });
      setShowScheduleConfig(false);
    },
  });

  // Toggle stage selection
  const toggleStage = (stage: WorkflowStage) => {
    setSelectedStages(prev => {
      const newSet = prev.includes(stage)
        ? prev.filter(s => s !== stage)
        : [...prev, stage];

      if (!prev.includes(stage)) {
        const today = formatLocalDate(new Date());
        setStageDeadlines(map => new Map(map).set(stage, today));
      }

      return newSet;
    });
  };

  // Update stage deadline date
  const updateStageDeadline = (stage: WorkflowStage, date: Date | undefined) => {
    if (date) {
      // 使用本地日期格式化，避免时区偏移问题
      setStageDeadlines(map => new Map(map).set(stage, formatLocalDate(date)));
    }
  };

  // Save configuration
  const handleSave = () => {
    const deadlines: StageDeadline[] = selectedStages
      .filter(stage => stageDeadlines.has(stage))
      .map(stage => ({
        stage,
        plannedDate: stageDeadlines.get(stage)!,
      }));

    if (deadlines.length > 0) {
      updateConfigMutation.mutate({
        deadlines,
        productionImpact,
        lessonLearned,
        improvementPlan,
      });
    }
  };

  // Delete configuration
  const handleDelete = () => {
    if (confirm('确定要删除此计划配置吗？')) {
      deleteConfigMutation.mutate();
    }
  };

  // Calculate delay status for CURRENT STAGE ONLY
  const delayStatus = useMemo(() => {
    if (!item || !delayConfig) return null;

    // 只查找当前阶段的截止日期
    const currentDeadline = delayConfig.stageDeadlines.find(
      d => d.stage === item.currentStage
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
      stage: item.currentStage,
    };
  }, [item, delayConfig]);

  if (!item) return null;

  const testCycleName = item.testCycleId
    ? testCycles.find(tc => tc.id === item.testCycleId)?.name || '未知'
    : null;

  const isUpdating = updateConfigMutation.isPending || deleteConfigMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Fixed Delay Status Badge - Top Right (避开关闭按钮) */}
        {delayStatus && (
          <div className="absolute top-4 right-12 z-10">
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-sm shadow-lg',
                delayStatus.isDelayed
                  ? 'text-red-400 bg-red-500/20 border border-red-500/30 dark:text-red-400 dark:bg-red-500/20 dark:border-red-500/30 text-red-700 bg-red-100 border-red-300'
                  : 'text-green-400 bg-green-500/20 border border-green-500/30 dark:text-green-400 dark:bg-green-500/20 dark:border-green-500/30 text-emerald-700 bg-emerald-100 border-emerald-300'
              )}
            >
              {delayStatus.isDelayed ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              {delayStatus.isDelayed
                ? `延期${delayStatus.days}天`
                : `剩余${delayStatus.days}天`}
            </div>
          </div>
        )}

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-24">
            {isRequirement ? (
              <FileText className="h-5 w-5 text-blue-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400" />
            )}
            {isRequirement ? '需求详情' : '问题单详情'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Header Row: Code + Title + Badges */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Badge
                variant={isRequirement ? 'default' : 'destructive'}
                className="text-sm font-mono"
              >
                {item.code}
              </Badge>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold leading-tight">{item.title}</h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isRequirement && item.severity && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full border',
                  severityColors[item.severity] || 'bg-gray-500/20 text-gray-400'
                )}>
                  {severityLabels[item.severity] || item.severity}
                </span>
              )}
            </div>
          </div>

          {/* Info Row: Stage + Assignee + Workload/TestCycle */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">阶段:</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full border text-xs',
                stageColors[item.currentStage]?.bg || 'bg-gray-500/20',
                stageColors[item.currentStage]?.border || 'border-gray-500/30',
                stageColors[item.currentStage]?.text || 'text-gray-300'
              )}>
                {StageLabels[item.currentStage] || item.currentStage}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">
                  {item.assignee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{item.assignee.name}</span>
              <span className="text-muted-foreground">({item.assignee.employeeNo})</span>
            </div>

            {isRequirement && item.workload !== undefined && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">工作量:</span>
                <span className="font-medium">{item.workload} 人/天</span>
              </div>
            )}

            {!isRequirement && testCycleName && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">转测版本:</span>
                <span className="font-medium">{testCycleName}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 dark:border-white/10 border-slate-200" />

          {/* 备注区域 - 常态化显示，三行垂直布局 */}
          <div className="space-y-3">
            <EditableNoteField
              label="现网影响"
              value={productionImpact}
              onChange={setProductionImpact}
              placeholder="双击编辑，描述对现网的影响..."
            />
            <EditableNoteField
              label="举一反三"
              value={lessonLearned}
              onChange={setLessonLearned}
              placeholder="双击编辑，总结经验教训..."
            />
            <EditableNoteField
              label="改进计划"
              value={improvementPlan}
              onChange={setImprovementPlan}
              placeholder="双击编辑，后续改进措施..."
            />
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 dark:border-white/10 border-slate-200" />

          {/* Schedule Config Section - Kanban Style */}
          {isPM && (
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowScheduleConfig(!showScheduleConfig)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                计划配置
                {showScheduleConfig ? (
                  <ChevronUp className="h-4 w-4 ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-2" />
                )}
              </Button>

              {showScheduleConfig && (
                <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-white/10 dark:border-white/10 border-slate-200">
                  {/* Stage Cards - Horizontal Kanban Style */}
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-3 min-w-max">
                      {ALL_STAGES_ORDERED.map(stage => {
                        const isSelected = selectedStages.includes(stage);
                        const colors = stageColors[stage];
                        const isCurrentStage = item.currentStage === stage;

                        return (
                          <div
                            key={stage}
                            onClick={() => toggleStage(stage)}
                            className={cn(
                              'relative flex-shrink-0 w-36 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200',
                              'hover:scale-[1.02] hover:shadow-lg',
                              isSelected
                                ? [colors.bg, colors.border, 'shadow-md']
                                : 'bg-white/5 dark:bg-white/5 bg-slate-50 border-white/10 dark:border-white/10 border-slate-200 hover:border-white/20 dark:hover:border-white/20 hover:border-slate-300',
                              isCurrentStage && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
                            )}
                          >
                            {/* Selection indicator */}
                            <div className={cn(
                              'absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                              isSelected
                                ? [colors.border, colors.bg]
                                : 'border-white/30 bg-transparent'
                            )}>
                              {isSelected && <Check className={cn('h-3 w-3', colors.text)} />}
                            </div>

                            {/* Stage name */}
                            <div className={cn(
                              'text-xs font-medium mb-3 pr-6 leading-tight',
                              isSelected ? colors.text : 'text-muted-foreground'
                            )}>
                              {StageLabels[stage]}
                            </div>

                            {/* Date picker - 阻止事件冒泡 */}
                            {isSelected ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <DatePicker
                                  date={stageDeadlines.get(stage) ? new Date(stageDeadlines.get(stage)!) : undefined}
                                  onDateChange={(date) => updateStageDeadline(stage, date)}
                                  placeholder="选择日期"
                                  className="w-full"
                                />
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground/50">
                                点击配置
                              </div>
                            )}

                            {/* Current stage indicator */}
                            {isCurrentStage && (
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                                当前
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-3 border-t border-white/10 dark:border-white/10 border-slate-200">
                    {delayConfig && delayConfig.id && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isUpdating}
                      >
                        {deleteConfigMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        删除配置
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduleConfig(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isUpdating || selectedStages.length === 0}
                    >
                      {updateConfigMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      保存配置
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Existing Config Summary - when not editing */}
          {delayConfig && delayConfig.stageDeadlines.length > 0 && !showScheduleConfig && (
            <div className="p-3 rounded-lg bg-muted/20 border border-white/10 dark:border-white/10 border-slate-200">
              <div className="text-xs text-muted-foreground mb-2">已配置阶段计划</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {delayConfig.stageDeadlines
                  .sort((a, b) => ALL_STAGES_ORDERED.indexOf(a.stage) - ALL_STAGES_ORDERED.indexOf(b.stage))
                  .map(d => (
                    <div
                      key={d.stage}
                      className={cn(
                        'flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs',
                        stageColors[d.stage]?.bg || 'bg-white/5',
                        stageColors[d.stage]?.border || 'border-white/10',
                        d.stage === item.currentStage && 'ring-1 ring-primary/50'
                      )}
                    >
                      <span className={stageColors[d.stage]?.text || 'text-foreground'}>
                        {StageLabels[d.stage]}
                      </span>
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{d.plannedDate}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Info hint */}
          <div className="p-3 rounded-lg bg-muted/30 border border-white/5">
            <p className="text-xs text-muted-foreground">
              {isRequirement ? (
                <>
                  此需求目前处于「{StageLabels[item.currentStage]}」阶段。
                  切换到拖拽模式可以调整需求阶段。
                </>
              ) : (
                <>
                  此问题单目前处于「{StageLabels[item.currentStage]}」阶段。
                  问题单只能向后推进，不能退回到「修改问题单」之前的阶段。
                </>
              )}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
