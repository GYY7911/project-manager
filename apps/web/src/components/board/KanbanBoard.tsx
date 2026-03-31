'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
import { useAppStore, isPMOrAdmin, useHasHydrated, generateDefaultKanbanConfig } from '@/store';
import { formatLocalDate } from '@/lib/date';
import { WorkflowStage, StageLabels, IssueSeverity, ColumnConfig } from '@pm/shared';
import { StageColumn } from './StageColumn';
import { KanbanCard } from './KanbanCard';
import { ItemDetailDialog } from './ItemDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, RefreshCw, FileText, AlertCircle, Settings2, Target } from 'lucide-react';
import { AutoWelcomeDialog } from '@/components/welcome';
import { KanbanConfigDialog } from '@/components/kanban-config';
import {
  ProgressGameDialog,
  GameStatusBar,
  useProgressGame,
} from '@/components/progress-game';

// 阶段顺序（用于游戏模式）
const STAGE_ORDER: WorkflowStage[] = [
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
}

export function KanbanBoard() {
  const { user, currentVersionId, setCurrentVersionId, interactionMode, kanbanConfig } = useAppStore();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isDropAllowed, setIsDropAllowed] = useState(true);

  // Dialog states
  const [isReqDialogOpen, setIsReqDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);

  // Detail dialog state
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const handleCardClick = (item: KanbanItem) => {
    setSelectedItem(item);
    setIsDetailDialogOpen(true);
  };

  // Ctrl+Click 复制功能
  const handleDuplicateItem = useCallback(async (item: KanbanItem) => {
    if (!currentVersionId) return;

    try {
      if (item.type === 'requirement') {
        await api.duplicateRequirement(item.id);
      } else {
        await api.duplicateIssue(item.id);
      }
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, [currentVersionId, queryClient]);

  // Progress Game
  const handleUpdateItemStage = async (id: string, newStage: WorkflowStage) => {
    const item = kanbanData.items.find((i) => i.id === id);
    if (!item) return;

    if (item.type === 'requirement') {
      await api.updateRequirementStage(id, newStage);
    } else {
      await api.updateIssueStage(id, newStage);
    }
    queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
  };

  // 滚动同步相关的 ref（用于消消乐模式）
  const scrollYRef = useRef(0);
  const scrollContainersRef = useRef<Set<HTMLDivElement>>(new Set());
  const isScrollingRef = useRef(false);

  const progressGame = useProgressGame({
    onUpdateStage: handleUpdateItemStage,
    onGameComplete: () => {
      // Game completed
    },
    onGameStartFailed: (reason) => {
      if (reason === 'all_checkpoints_passed') {
        alert('所有项目都已经通过了选中的卡点！\n\n请选择以下选项：\n1. 选择其他卡点（更靠后的阶段）\n2. 或者筛选出需要推进的项目');
      } else if (reason === 'no_items') {
        alert('没有可推进的项目');
      }
    },
  });

  // 注册滚动容器
  const registerScrollContainer = useCallback((element: HTMLDivElement) => {
    scrollContainersRef.current.add(element);
  }, []);

  // 注销滚动容器
  const unregisterScrollContainer = useCallback((element: HTMLDivElement) => {
    scrollContainersRef.current.delete(element);
  }, []);

  // 滚动同步处理函数
  const handleGameScroll = useCallback((y: number) => {
    if (!progressGame.gameState.isPlaying) return;

    scrollYRef.current = y;

    // 同步所有列的滚动位置
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      scrollContainersRef.current.forEach((container) => {
        if (container.scrollTop !== y) {
          container.scrollTop = y;
        }
      });
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  }, [progressGame.gameState.isPlaying]);

  // Form states
  const [reqForm, setReqForm] = useState({
    code: '',
    title: '',
    assigneeId: '',
    workload: '',
    dueDate: '',
  });
  const [issueForm, setIssueForm] = useState({
    code: '',
    title: '',
    assigneeId: '',
    severity: IssueSeverity.MEDIUM,
    testCycleId: '',
    dueDate: '',
  });

  // 获取版本列表
  const {
    data: versions = [],
    isLoading: isVersionsLoading,
    isError: isVersionsError,
    error: versionsError,
    refetch: refetchVersions,
  } = useQuery({
    queryKey: ['versions'],
    queryFn: () => api.getVersions(),
  });

  // 获取员工列表
  const { data: assigneesData } = useQuery({
    queryKey: ['assignees'],
    queryFn: () => api.getAssignees(),
  });
  const assignees = Array.isArray(assigneesData) ? assigneesData : [];

  // 获取看板数据
  const {
    data: boardData,
    isLoading: isBoardLoading,
    refetch,
  } = useQuery({
    queryKey: ['board', currentVersionId],
    queryFn: async () => {
      if (!currentVersionId) return null;
      return api.getVersionBoard(currentVersionId);
    },
    enabled: !!currentVersionId,
  });

  // 获取延期配置数据
  const { data: delayConfigs = [] } = useQuery({
    queryKey: ['delay-configs', currentVersionId],
    queryFn: async () => {
      if (!currentVersionId) return [];
      return api.getDelayConfigs(currentVersionId);
    },
    enabled: !!currentVersionId,
  });

  // 自动选择当前版本或清除无效的版本ID
  useEffect(() => {
    // 如果当前版本ID不存在于版本列表中，清除它
    if (currentVersionId && versions.length > 0) {
      const versionExists = versions.some((v: any) => v.id === currentVersionId);
      if (!versionExists) {
        setCurrentVersionId(null);
        return;
      }
    }

    // 自动选择版本
    if (versions.length > 0 && !currentVersionId) {
      const current = versions.find(
        (v: any) => v.status === 'DEVELOPMENT' || v.status === 'TESTING'
      );
      const selectedId = current?.id || versions[0].id;
      setCurrentVersionId(selectedId);
    }
  }, [versions, currentVersionId, setCurrentVersionId]);

  // 自动生成需求编码
  const generateReqCode = async () => {
    if (!currentVersionId) return;
    try {
      const result = await api.generateRequirementCode(currentVersionId);
      setReqForm((prev) => ({ ...prev, code: result.code }));
    } catch (e) {
      console.error('Failed to generate code', e);
    }
  };

  // 自动生成问题单编码
  const generateIssueCode = async () => {
    if (!currentVersionId) return;
    try {
      const result = await api.generateIssueCode(currentVersionId);
      setIssueForm((prev) => ({ ...prev, code: result.code }));
    } catch (e) {
      console.error('Failed to generate code', e);
    }
  };

  // 创建需求
  const createRequirement = useMutation({
    mutationFn: () =>
      api.createRequirement({
        code: reqForm.code,
        title: reqForm.title,
        versionId: currentVersionId!,
        assigneeId: reqForm.assigneeId,
        workload: reqForm.workload ? Number(reqForm.workload) : undefined,
        dueDate: reqForm.dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
      setIsReqDialogOpen(false);
      setReqForm({ code: '', title: '', assigneeId: '', workload: '', dueDate: '' });
    },
  });

  // 创建问题单
  const createIssue = useMutation({
    mutationFn: () =>
      api.createIssue({
        code: issueForm.code,
        title: issueForm.title,
        versionId: currentVersionId!,
        assigneeId: issueForm.assigneeId,
        severity: issueForm.severity as IssueSeverity,
        testCycleId: issueForm.testCycleId || undefined,
        dueDate: issueForm.dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
      setIsIssueDialogOpen(false);
      setIssueForm({
        code: '',
        title: '',
        assigneeId: '',
        severity: IssueSeverity.MEDIUM,
        testCycleId: '',
        dueDate: '',
      });
    },
  });

  // 更新需求阶段
  const updateRequirementStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.updateRequirementStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
    },
  });

  // 更新问题单阶段
  const updateIssueStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.updateIssueStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
    },
  });

  // 构建看板数据
  const kanbanData = useMemo(() => {
    if (!boardData) return { columns: [], items: [], testCycles: [], stageConfigs: [] };

    const testCycles = boardData.testCycles || [];
    const requirements = boardData.requirements || [];
    const issues = boardData.issues || [];

    // Use config if available, otherwise generate default
    const config = kanbanConfig || generateDefaultKanbanConfig();

    // Build columns based on config
    const columns: any[] = [];

    // Track VERSION_TEST occurrences for mapping to test cycles
    let versionTestIndex = 0;

    config.columns.forEach((colConfig: ColumnConfig) => {
      // Check if this column contains VERSION_TEST
      const hasVersionTest = colConfig.stages.includes(WorkflowStage.VERSION_TEST);

      // Handle VERSION_TEST expansion
      if (hasVersionTest) {
        // Each VERSION_TEST occurrence maps to one test cycle
        // If there are more VERSION_TEST columns than test cycles, we still create the column
        const testCycle = testCycles[versionTestIndex];
        versionTestIndex++;

        if (testCycle) {
          // Use column title if set, otherwise use test cycle name
          const columnTitle = colConfig.title || testCycle.name;
          columns.push({
            id: `test-${testCycle.id}`,
            title: columnTitle,
            stage: WorkflowStage.VERSION_TEST,
            testCycleId: testCycle.id,
            isDynamic: true,
            stages: [WorkflowStage.VERSION_TEST],
          });
        } else {
          // No matching test cycle, create a placeholder column
          columns.push({
            id: `${colConfig.id}-versiontest-${versionTestIndex}`,
            title: colConfig.title || `转测${versionTestIndex}`,
            stage: WorkflowStage.VERSION_TEST,
            testCycleId: null,
            isDynamic: true,
            stages: [WorkflowStage.VERSION_TEST],
          });
        }

        // If this column has other stages besides VERSION_TEST, create a regular column for them
        const stagesWithoutVersionTest = colConfig.stages.filter(s => s !== WorkflowStage.VERSION_TEST);
        if (stagesWithoutVersionTest.length > 0) {
          columns.push({
            id: colConfig.id,
            title: colConfig.title,
            stage: stagesWithoutVersionTest[0],
            stages: stagesWithoutVersionTest,
            isDynamic: false,
          });
        }
      } else {
        // Regular column (no VERSION_TEST)
        columns.push({
          id: colConfig.id,
          title: colConfig.title,
          stage: colConfig.stages[0],
          stages: colConfig.stages,
          isDynamic: false,
        });
      }
    });

    // 构建卡片
    const items: KanbanItem[] = [
      ...requirements.map((req: any) => ({
        id: req.id,
        type: 'requirement' as const,
        code: req.code,
        title: req.title,
        status: req.status,
        currentStage: req.currentStage,
        assignee: req.assignee,
        workload: req.workload,
      })),
      ...issues.map((issue: any) => ({
        id: issue.id,
        type: 'issue' as const,
        code: issue.code,
        title: issue.title,
        status: issue.status,
        currentStage: issue.currentStage || WorkflowStage.ISSUE_FIX, // 使用实际阶段，向后兼容
        assignee: issue.assignee,
        severity: issue.severity,
        testCycleId: issue.testCycleId,
      })),
    ];

    return { columns, items, testCycles, stageConfigs: config.stageConfigs };
  }, [boardData, kanbanConfig]);

  // DnD sensors - 始终保持相同的结构，通过 activationConstraint 控制是否启用
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: interactionMode === 'drag'
        ? { distance: 8 }
        : { distance: 999999 }, // 点击模式下设置一个很大的距离，实际上禁用拖拽
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(null);
    setIsDropAllowed(true);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setOverId(null);
      setIsDropAllowed(true);
      return;
    }

    setOverId(over.id as string);

    // 获取当前拖拽的 item
    const item = kanbanData.items.find((i) => i.id === active.id);
    if (!item) return;

    // 获取目标列
    const targetColumn = kanbanData.columns.find((col) => col.id === over.id);
    if (!targetColumn) return;

    // 检查问题单是否允许移动到此阶段
    if (item.type === 'issue') {
      const issueFixIndex = STAGE_ORDER.indexOf(WorkflowStage.ISSUE_FIX);
      const targetStageIndex = STAGE_ORDER.indexOf(targetColumn.stage);
      setIsDropAllowed(targetStageIndex >= issueFixIndex);
    } else {
      setIsDropAllowed(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const wasDropAllowed = isDropAllowed;

    setActiveId(null);
    setOverId(null);
    setIsDropAllowed(true);

    if (!over || !wasDropAllowed) return;

    const item = kanbanData.items.find((i) => i.id === active.id);
    if (!item) return;

    // 解析目标列
    const targetColumn = kanbanData.columns.find((col) => col.id === over.id);
    if (!targetColumn) return;

    // 更新阶段
    if (item.type === 'requirement') {
      updateRequirementStage.mutate({
        id: item.id,
        stage: targetColumn.stage,
      });
    } else {
      updateIssueStage.mutate({
        id: item.id,
        stage: targetColumn.stage,
      });
    }
  };

  const activeItem = activeId
    ? kanbanData.items.find((i) => i.id === activeId)
    : null;

  const isUserPM = isPMOrAdmin(user?.role);
  const hasHydrated = useHasHydrated();

  // Build delay configs map for efficient lookup
  const delayConfigsMap = useMemo(() => {
    const map = new Map<string, { stageDeadlines: { stage: WorkflowStage; plannedDate: string }[] }>();
    delayConfigs.forEach((config: any) => {
      map.set(config.entityId, {
        stageDeadlines: config.stageDeadlines,
      });
    });
    return map;
  }, [delayConfigs]);

  // 加载状态：仅在版本正在加载时显示
  // 版本加载完成后，即使没有版本也不应该显示加载状态
  if (isVersionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 错误状态
  if (isVersionsError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold mb-2">加载失败</h2>
          <p className="text-muted-foreground mb-2">无法获取版本数据</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {versionsError instanceof Error ? versionsError.message : '请检查网络连接'}
          </p>
          <Button onClick={() => refetchVersions()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 空状态判断 - 只有在数据加载完成后才显示引导
  const hasNoVersions = versions.length === 0 && isUserPM;
  const hasNoCards =
    currentVersionId && !isBoardLoading && kanbanData.items.length === 0 && isUserPM;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-white/10 dark:border-white/10 border-slate-200 glass flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Select value={currentVersionId || ''} onValueChange={setCurrentVersionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择版本" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 创建按钮 - 仅 PM 可见 */}
          {isUserPM && currentVersionId && (
            <div className="flex items-center gap-2">
              <Dialog open={isReqDialogOpen} onOpenChange={setIsReqDialogOpen} modal={false}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => {
                      generateReqCode();
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    新建需求
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建需求</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        编码
                        <span className="text-xs text-muted-foreground font-normal">
                          (自动生成)
                        </span>
                      </Label>
                      <Input
                        value={reqForm.code}
                        onChange={(e) =>
                          setReqForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                        placeholder="FE20260310001"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label>标题 *</Label>
                      <Input
                        value={reqForm.title}
                        onChange={(e) =>
                          setReqForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="需求标题"
                      />
                    </div>
                    <div>
                      <Label>负责人 *</Label>
                      <Select
                        value={reqForm.assigneeId}
                        onValueChange={(v) =>
                          setReqForm((prev) => ({ ...prev, assigneeId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择负责人" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignees.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} ({a.employeeNo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>工作量 (人/天)</Label>
                      <Input
                        type="number"
                        value={reqForm.workload}
                        onChange={(e) =>
                          setReqForm((prev) => ({ ...prev, workload: e.target.value }))
                        }
                        placeholder="预计工作量"
                      />
                    </div>
                    <div>
                      <Label>截止日期</Label>
                      <DatePicker
                        date={reqForm.dueDate ? new Date(reqForm.dueDate) : undefined}
                        onDateChange={(date) =>
                          setReqForm((prev) => ({ ...prev, dueDate: date ? formatLocalDate(date) : '' }))
                        }
                        placeholder="选择截止日期"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createRequirement.mutate()}
                      disabled={!reqForm.title || !reqForm.assigneeId || createRequirement.isPending}
                    >
                      {createRequirement.isPending ? '创建中...' : '创建'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen} modal={false}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      generateIssueCode();
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    新建问题单
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建问题单</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        编码
                        <span className="text-xs text-muted-foreground font-normal">
                          (自动生成)
                        </span>
                      </Label>
                      <Input
                        value={issueForm.code}
                        onChange={(e) =>
                          setIssueForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                        placeholder="ISS20260310001"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label>标题 *</Label>
                      <Input
                        value={issueForm.title}
                        onChange={(e) =>
                          setIssueForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="问题单标题"
                      />
                    </div>
                    <div>
                      <Label>负责人 *</Label>
                      <Select
                        value={issueForm.assigneeId}
                        onValueChange={(v) =>
                          setIssueForm((prev) => ({ ...prev, assigneeId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择负责人" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignees.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} ({a.employeeNo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>严重程度</Label>
                      <Select
                        value={issueForm.severity}
                        onValueChange={(v) =>
                          setIssueForm((prev) => ({ ...prev, severity: v as IssueSeverity }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IssueSeverity.CRITICAL}>
                            致命 - 系统崩溃/数据丢失
                          </SelectItem>
                          <SelectItem value={IssueSeverity.HIGH}>
                            严重 - 核心功能不可用
                          </SelectItem>
                          <SelectItem value={IssueSeverity.MEDIUM}>
                            一般 - 功能异常有替代方案
                          </SelectItem>
                          <SelectItem value={IssueSeverity.LOW}>
                            轻微 - 界面/提示问题
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>转测版本</Label>
                      <Select
                        value={issueForm.testCycleId}
                        onValueChange={(v) =>
                          setIssueForm((prev) => ({ ...prev, testCycleId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择转测版本（可选）" />
                        </SelectTrigger>
                        <SelectContent>
                          {(kanbanData.testCycles || []).map((tc: any) => (
                            <SelectItem key={tc.id} value={tc.id}>
                              {tc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>截止日期</Label>
                      <DatePicker
                        date={issueForm.dueDate ? new Date(issueForm.dueDate) : undefined}
                        onDateChange={(date) =>
                          setIssueForm((prev) => ({ ...prev, dueDate: date ? formatLocalDate(date) : '' }))
                        }
                        placeholder="选择截止日期"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createIssue.mutate()}
                      disabled={!issueForm.title || !issueForm.assigneeId || createIssue.isPending}
                    >
                      {createIssue.isPending ? '创建中...' : '创建'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isUserPM && currentVersionId && kanbanData.items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGameDialogOpen(true)}
              className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/50 hover:from-violet-500/30 hover:to-purple-500/30"
            >
              <Target className="h-4 w-4 mr-2 text-violet-400" />
              更新消消乐
            </Button>
          )}
          {isUserPM && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              模板配置
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
          {/* 有版本但无卡片引导 - 保留此部分，因为用户可能有版本但没有需求/问题单 */}
          {hasNoCards && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
              <div className="text-center p-8 rounded-xl glass border border-white/10 dark:border-white/10 border-slate-200 max-w-md">
                <div className="text-6xl mb-4">📋</div>
                <h2 className="text-xl font-bold mb-2">看板是空的</h2>
                <p className="text-muted-foreground mb-6">
                  作为 PM，你可以创建需求和问题单来跟踪版本的开发进度。
                  <br />
                  卡片会显示在对应的阶段列中。
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => {
                      setIsReqDialogOpen(true);
                      generateReqCode();
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    新建需求
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsIssueDialogOpen(true);
                      generateIssueCode();
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    新建问题单
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  提示：需求会从「需求设计」阶段开始，问题单会出现在「修改问题单」列
                </p>
              </div>
            </div>
          )}

          {/* Board loading overlay */}
          {isBoardLoading && currentVersionId && (
            <div className="absolute inset-0 flex items-center justify-center z-5 bg-background/50">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="flex h-full min-w-max">
            {kanbanData.columns.map((column) => {
              // Filter items for this column
              const columnItems = kanbanData.items.filter((item) => {
                // For merged columns, check if item's stage is in the column's stages
                if (column.stages && column.stages.length > 1) {
                  return column.stages.includes(item.currentStage);
                }

                // For dynamic test cycle columns
                if (column.isDynamic) {
                  // Issues show if they belong to this test cycle
                  if (item.type === 'issue') {
                    return item.testCycleId === column.testCycleId;
                  }
                  // Requirements with VERSION_TEST stage show in all test cycle columns
                  // (since they don't have a specific testCycleId)
                  if (item.type === 'requirement' && item.currentStage === WorkflowStage.VERSION_TEST) {
                    return true;
                  }
                  return false;
                }

                // For regular single-stage columns
                return item.currentStage === column.stage;
              });

              return (
                <StageColumn
                  key={column.id}
                  column={column}
                  items={columnItems}
                  interactionMode={interactionMode}
                  isPM={isPMOrAdmin(user?.role)}
                  stageConfigs={kanbanData.stageConfigs}
                  onCardClick={handleCardClick}
                  onDuplicate={handleDuplicateItem}
                  isOver={overId === column.id}
                  isDropAllowed={overId === column.id ? isDropAllowed : true}
                  gameMode={
                    // 游戏模式：活跃时显示按钮，非活跃时仍显示影子卡片
                    progressGame.gameState.items.length > 0
                      ? {
                          isActive: progressGame.gameState.isPlaying, // 只在游戏进行中显示按钮
                          checkpoints: progressGame.gameState.checkpoints,
                          totalRows: progressGame.gameState.totalRows || progressGame.gameState.items.length, // 甘特图总行数
                          gameItemStates: new Map(
                            progressGame.gameState.items.map(item => [
                              item.id,
                              {
                                currentStage: item.currentStage,
                                shadowStages: item.shadowStages,
                                isAdvancing: item.isAdvancing,
                                passedCheckpoints: item.passedCheckpoints,
                                isExploding: item.isExploding,
                                isReappearing: item.isReappearing, // 重新出现动画
                                rowIndex: item.rowIndex, // 甘特图行号
                              },
                            ])
                          ),
                          allItems: kanbanData.items,
                          onAdvanceItem: progressGame.advanceItem,
                          onPassCheckpoint: progressGame.passCheckpoint,
                          getShadowPosition: progressGame.getShadowPosition,
                          getPassedCheckpointLabels: progressGame.getPassedCheckpointLabels,
                          getNextCheckpointForItem: progressGame.getNextCheckpointForItem,
                          // 滚动同步
                          onScroll: handleGameScroll,
                          registerScrollContainer: registerScrollContainer,
                          unregisterScrollContainer: unregisterScrollContainer,
                        }
                      : undefined
                  }
                  delayConfigs={delayConfigsMap}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay
          dropAnimation={{
            keyframes: ({ transform }) => [
              { transform: CSS.Transform.toString(transform.initial) },
              { transform: CSS.Transform.toString(transform.final) },
            ],
            duration: 300,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          modifiers={[
            restrictToWindowEdges,
          ]}
        >
          {activeItem && (
            <div className="transform-gpu will-change-transform">
              <KanbanCard
                item={activeItem}
                interactionMode={interactionMode}
                isPM={isPMOrAdmin(user?.role)}
                isDragging
                isDropAllowed={isDropAllowed}
                delayConfig={delayConfigsMap.get(activeItem.id)}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Auto Welcome Dialog - triggered when no versions */}
      <AutoWelcomeDialog
        triggerCondition="empty_versions"
        shouldTrigger={hasNoVersions}
      />

      {/* Kanban Config Dialog */}
      <KanbanConfigDialog
        open={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
      />

      {/* Progress Game Dialog */}
      <ProgressGameDialog
        open={isGameDialogOpen}
        onOpenChange={setIsGameDialogOpen}
        availableStages={STAGE_ORDER.filter((stage) => stage !== WorkflowStage.RELEASE) as WorkflowStage[]}
        onStartGame={(checkpoints) => {
          const gameItems = kanbanData.items.map((item) => ({
            id: item.id,
            type: item.type,
            code: item.code,
            title: item.title,
            currentStage: item.currentStage,
            assignee: { id: item.assignee.id, name: item.assignee.name },
          }));
          // 传递 versionId 确保不同版本的游戏状态不会混淆
          progressGame.startGame(checkpoints, gameItems, currentVersionId || undefined);
        }}
      />

      {/* Item Detail Dialog */}
      <ItemDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        item={selectedItem}
        testCycles={kanbanData.testCycles}
        delayConfig={selectedItem ? delayConfigsMap.get(selectedItem.id) : undefined}
        versionId={currentVersionId || undefined}
        isPM={isUserPM}
      />

      {/* Game Status Bar */}
      {progressGame.gameState.isPlaying && (
        <GameStatusBar
          checkpoints={progressGame.gameState.checkpoints}
          completedCount={progressGame.stats.completed}
          totalCount={progressGame.stats.total}
          historySize={progressGame.historySize}
          wasSaved={progressGame.gameState.wasSaved || false}
          onExit={progressGame.exitGame}
          onSave={progressGame.saveGame}
          onUndo={progressGame.undo}
          onReset={progressGame.resetAll}
        />
      )}
    </div>
  );
}
