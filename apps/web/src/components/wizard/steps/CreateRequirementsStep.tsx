'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OnboardingData } from '@/store';
import { api } from '@/lib/api';
import { FileText, Plus, List, Trash2, Upload, UserPlus, ArrowRight } from 'lucide-react';

interface CreateRequirementsStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  versionId: string | null;
}

interface RequirementForm {
  code: string;
  title: string;
  assigneeId: string;
  workload: string;
  dueDate: string;
}

type RequirementItem = RequirementForm & { id: string };

// 加载状态组件
function LoadingState() {
  return (
    <div className="py-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-4 animate-pulse">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">加载负责人列表...</p>
    </div>
  );
}

// 空状态组件
function EmptyAssigneesState({ onSkip, onGoToUsers }: { onSkip: () => void; onGoToUsers: () => void }) {
  return (
    <div className="py-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted/50 mb-4">
        <UserPlus className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">需要先有组员才能创建需求</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
        需求是分配给团队成员的任务。请先在用户管理中添加成员，或者跳过此步骤，稍后再创建需求。
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={onSkip}
          className="text-muted-foreground"
        >
          跳过此步
        </Button>
        <Button onClick={onGoToUsers}>
          <UserPlus className="h-4 w-4 mr-2" />
          前往用户管理
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// 需求表单组件
function RequirementFormItem({
  requirement,
  index,
  assignees,
  onUpdate,
  onRemove,
}: {
  requirement: RequirementItem;
  index: number;
  assignees: Array<{ id: string; name: string; employeeNo: string }>;
  onUpdate: (id: string, field: keyof RequirementForm, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-white/10 dark:border-white/10 border-slate-200 bg-white/5 dark:bg-white/5 bg-slate-50 space-y-3">
      <div className="flex items-center justify-between">
        <Input
          value={requirement.code}
          onChange={(e) => onUpdate(requirement.id, 'code', e.target.value)}
          placeholder={`需求 ${index + 1}`}
          className="w-40 h-8 text-sm font-mono"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(requirement.id)}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">标题 *</Label>
          <Input
            value={requirement.title}
            onChange={(e) => onUpdate(requirement.id, 'title', e.target.value)}
            placeholder="需求标题"
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">负责人 *</Label>
          <Select
            value={requirement.assigneeId}
            onValueChange={(v) => onUpdate(requirement.id, 'assigneeId', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="选择负责人" />
            </SelectTrigger>
            <SelectContent>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.employeeNo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">工作量 (人/天)</Label>
          <Input
            type="number"
            value={requirement.workload}
            onChange={(e) => onUpdate(requirement.id, 'workload', e.target.value)}
            placeholder="1"
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}

// 批量导入组件
function BatchImportPanel({
  batchText,
  onBatchTextChange,
  onImport,
  onCancel,
}: {
  batchText: string;
  onBatchTextChange: (text: string) => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 p-4 rounded-lg border border-white/10 bg-white/5">
      <Label className="text-sm">批量导入需求</Label>
      <Textarea
        value={batchText}
        onChange={(e) => onBatchTextChange(e.target.value)}
        placeholder={`每行一个需求，格式：标题 [负责人姓名] [工作量(人/天)]\n例如：\n用户登录功能 [张三] [2]\n数据导出功能 [李四] [3]`}
        rows={5}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onImport}>
          <Upload className="h-4 w-4 mr-2" />
          导入
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

// 主表单组件
function RequirementsForm({
  requirements,
  assignees,
  showBatchImport,
  batchText,
  isCreating,
  versionId,
  onAddRequirement,
  onRemoveRequirement,
  onUpdateRequirement,
  onToggleBatchImport,
  onBatchTextChange,
  onBatchImport,
  onCreateRequirements,
}: {
  requirements: RequirementItem[];
  assignees: Array<{ id: string; name: string; employeeNo: string }>;
  showBatchImport: boolean;
  batchText: string;
  isCreating: boolean;
  versionId: string | null;
  onAddRequirement: () => void;
  onRemoveRequirement: (id: string) => void;
  onUpdateRequirement: (id: string, field: keyof RequirementForm, value: string) => void;
  onToggleBatchImport: () => void;
  onBatchTextChange: (text: string) => void;
  onBatchImport: () => void;
  onCreateRequirements: () => void;
}) {
  const validCount = requirements.filter((r) => r.title && r.assigneeId).length;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleBatchImport}
          >
            <List className="h-4 w-4 mr-2" />
            批量导入
          </Button>
          <Button variant="outline" size="sm" onClick={onAddRequirement}>
            <Plus className="h-4 w-4 mr-2" />
            添加需求
          </Button>
        </div>
        {requirements.length > 0 && (
          <Button onClick={onCreateRequirements} disabled={isCreating || !versionId} size="sm">
            {isCreating ? '创建中...' : `创建 ${validCount} 个需求`}
          </Button>
        )}
      </div>

      {/* 批量导入 */}
      {showBatchImport && (
        <BatchImportPanel
          batchText={batchText}
          onBatchTextChange={onBatchTextChange}
          onImport={onBatchImport}
          onCancel={onToggleBatchImport}
        />
      )}

      {/* 需求列表 */}
      {requirements.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无需求，点击上方按钮添加</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {requirements.map((req, index) => (
            <RequirementFormItem
              key={req.id}
              requirement={req}
              index={index}
              assignees={assignees}
              onUpdate={onUpdateRequirement}
              onRemove={onRemoveRequirement}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CreateRequirementsStep({
  data,
  updateData,
  versionId,
}: CreateRequirementsStepProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 所有 hooks 必须在组件顶部，不能有条件返回在它们之前
  const [requirements, setRequirements] = useState<RequirementItem[]>(() =>
    data.requirements.map((r, i) => ({
      ...r,
      id: `req-${i}`,
      workload: r.workload?.toString() || '',
      dueDate: r.dueDate || '',
    }))
  );
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [initialCodeGenerated, setInitialCodeGenerated] = useState(false);

  // 双重数据源查询 - 智能检测组员
  const {
    data: assigneesData,
    isLoading: isAssigneesLoading,
    isError: isAssigneesError,
  } = useQuery({
    queryKey: ['assignees'],
    queryFn: api.getAssignees,
  });

  // 只有当 assignees 确实为空（或请求失败）时才启用 users 查询
  // 注意：必须等待 assignees 请求完成（无论成功还是失败）才能判断
  const assigneesRequestDone = !isAssigneesLoading;
  const assigneesIsEmpty = !assigneesData || assigneesData.length === 0;
  const shouldFetchUsers = assigneesRequestDone && assigneesIsEmpty;

  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
    enabled: shouldFetchUsers,
  });

  // 智能选择负责人列表
  const assignees = useMemo(() => {
    if (assigneesData && assigneesData.length > 0) {
      return assigneesData;
    }
    if (usersData && Array.isArray(usersData) && usersData.length > 0) {
      return usersData.map((u: any) => ({
        id: u.id,
        name: u.name,
        employeeNo: u.employeeNo,
      }));
    }
    return [];
  }, [assigneesData, usersData]);

  // 综合加载状态（关键修复）：
  // 1. assignees 正在加载
  // 2. 或者 assignees 完成后为空，需要等待 users 数据（包括正在加载或等待开始）
  // 关键：当 shouldFetchUsers 为 true 但 usersData 还没有时，必须继续显示加载状态
  // 避免在 users 请求启动的瞬间显示空状态
  // Bug 修复：当 users 请求失败时，不应该继续等待，而是显示空状态
  const isWaitingForUsers = shouldFetchUsers && (isUsersLoading || (!usersData && !isUsersError));
  const isLoading = isAssigneesLoading || isWaitingForUsers;

  // Generate requirement code
  const generateCode = useCallback(async () => {
    if (!versionId) return '';
    try {
      const result = await api.generateRequirementCode(versionId);
      return result.code;
    } catch (e) {
      console.error('Failed to generate code', e);
      return '';
    }
  }, [versionId]);

  // Add requirement
  const addRequirement = useCallback(async () => {
    const code = await generateCode();
    const newReq: RequirementItem = {
      id: `req-${Date.now()}`,
      code: code || '',
      title: '',
      assigneeId: '',
      workload: '',
      dueDate: '',
    };
    setRequirements((prev) => [...prev, newReq]);
  }, [generateCode]);

  // Update requirement
  const updateRequirement = useCallback((id: string, field: keyof RequirementForm, value: string) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  // Remove requirement
  const removeRequirement = useCallback((id: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Parse batch import
  const parseBatchImport = useCallback(async () => {
    const lines = batchText.split('\n').filter((line) => line.trim());
    const newReqs: RequirementItem[] = [];

    for (const line of lines) {
      const parts = line.split(/[\[\]()]/).map((p) => p.trim()).filter(Boolean);
      const title = parts[0] || line.trim();
      const assigneeName = parts[1] || '';
      const workload = parts[2] || '';

      const assignee = assignees.find(
        (a: any) => a.name === assigneeName || a.employeeNo === assigneeName
      );

      const code = await generateCode();
      newReqs.push({
        id: `req-${Date.now()}-${Math.random()}`,
        code: code || '',
        title,
        assigneeId: assignee?.id || '',
        workload: workload || '',
        dueDate: '',
      });
    }

    setRequirements((prev) => [...prev, ...newReqs]);
    setShowBatchImport(false);
    setBatchText('');
  }, [batchText, assignees, generateCode]);

  // Create requirements
  const createRequirements = useCallback(async () => {
    if (!versionId || requirements.length === 0) return;

    const validRequirements = requirements.filter((r) => r.title && r.assigneeId);
    if (validRequirements.length === 0) {
      toast.warning('请至少填写一个完整的需求');
      return;
    }

    setIsCreating(true);
    try {
      let createdCount = 0;
      for (const req of validRequirements) {
        await api.createRequirement({
          code: req.code,
          title: req.title,
          versionId,
          assigneeId: req.assigneeId,
          workload: req.workload ? Number(req.workload) : undefined,
          dueDate: req.dueDate || undefined,
        });
        createdCount++;
      }

      // 清除已保存的需求，避免完成时重复创建
      updateData({
        requirements: [],
      });

      queryClient.invalidateQueries({ queryKey: ['board', versionId] });
      toast.success(`成功创建 ${createdCount} 个需求`);
    } catch (e: any) {
      console.error('Failed to create requirements', e);
      toast.error(e.message || '创建需求失败');
    } finally {
      setIsCreating(false);
    }
  }, [versionId, requirements, queryClient, updateData]);

  // Sync requirements to parent
  useEffect(() => {
    updateData({
      requirements: requirements.map((r) => ({
        code: r.code,
        title: r.title,
        assigneeId: r.assigneeId,
        workload: r.workload ? Number(r.workload) : undefined,
        dueDate: r.dueDate || undefined,
      })),
    });
  }, [requirements, updateData]);

  // Generate initial requirement on mount
  useEffect(() => {
    if (requirements.length === 0 && versionId && !initialCodeGenerated && assignees.length > 0) {
      setInitialCodeGenerated(true);
      addRequirement();
    }
  }, [versionId, requirements.length, initialCodeGenerated, assignees.length, addRequirement]);

  // 条件渲染 - 在所有 hooks 之后
  if (isLoading) {
    return <LoadingState />;
  }

  if (assignees.length === 0) {
    return (
      <EmptyAssigneesState
        onSkip={() => router.push('/onboard')}
        onGoToUsers={() => router.push('/users')}
      />
    );
  }

  return (
    <RequirementsForm
      requirements={requirements}
      assignees={assignees}
      showBatchImport={showBatchImport}
      batchText={batchText}
      isCreating={isCreating}
      versionId={versionId}
      onAddRequirement={addRequirement}
      onRemoveRequirement={removeRequirement}
      onUpdateRequirement={updateRequirement}
      onToggleBatchImport={() => setShowBatchImport(!showBatchImport)}
      onBatchTextChange={setBatchText}
      onBatchImport={parseBatchImport}
      onCreateRequirements={createRequirements}
    />
  );
}
