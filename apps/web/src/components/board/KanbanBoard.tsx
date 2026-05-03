'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
import { useAppStore, isPMOrAdmin, generateDefaultKanbanConfig } from '@/store';
import { formatLocalDate } from '@/lib/date';
import { WorkflowStage, IssueSeverity, ColumnConfig, DefaultStageOrder, Version, ItemDelayConfig } from '@pm/shared';
import { StageColumn } from './StageColumn';
import { KanbanCard } from './KanbanCard';
import { ItemDetailDialog } from './ItemDetailDialog';
import { BoardHeader } from './BoardHeader';
import { CreateRequirementDialog } from './CreateRequirementDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import { useKanbanDrag } from '@/hooks/useKanbanDrag';
import { Button } from '@/components/ui/button';
import { AutoWelcomeDialog } from '@/components/welcome';
import { KanbanConfigDialog } from '@/components/kanban-config';
import { ProgressGameDialog, GameStatusBar, useProgressGame } from '@/components/progress-game';
import { RefreshCw, AlertCircle, FileText } from 'lucide-react';

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

interface BoardRequirement {
  id: string;
  code: string;
  title: string;
  status: string;
  currentStage: WorkflowStage;
  assignee: { id: string; name: string; employeeNo: string };
  workload?: number;
}

interface BoardIssue {
  id: string;
  code: string;
  title: string;
  status: string;
  currentStage: WorkflowStage;
  assignee: { id: string; name: string; employeeNo: string };
  severity?: string;
  testCycleId?: string;
}

interface BoardColumn {
  id: string;
  title?: string;
  stage: WorkflowStage | string;
  stages?: (WorkflowStage | string)[];
  isDynamic?: boolean;
  testCycleId?: string;
}

export function KanbanBoard() {
  const { user, currentVersionId, setCurrentVersionId, interactionMode, kanbanConfig } = useAppStore();
  const queryClient = useQueryClient();

  const [isReqDialogOpen, setIsReqDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const [reqForm, setReqForm] = useState({ code: '', title: '', assigneeId: '', workload: '', dueDate: '' });
  const [issueForm, setIssueForm] = useState({
    code: '', title: '', assigneeId: '', severity: IssueSeverity.MEDIUM, testCycleId: '', dueDate: '',
  });

  const handleCardClick = (item: KanbanItem) => {
    setSelectedItem(item);
    setIsDetailDialogOpen(true);
  };

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

  const scrollYRef = useRef(0);
  const scrollContainersRef = useRef<Set<HTMLDivElement>>(new Set());
  const isScrollingRef = useRef(false);

  const progressGame = useProgressGame({
    onUpdateStage: handleUpdateItemStage,
    onGameComplete: () => {},
    onGameStartFailed: (reason) => {
      if (reason === 'all_checkpoints_passed') {
        alert('所有项目都已经通过了选中的卡点！\n\n请选择以下选项：\n1. 选择其他卡点（更靠后的阶段）\n2. 或者筛选出需要推进的项目');
      } else if (reason === 'no_items') {
        alert('没有可推进的项目');
      }
    },
  });

  const registerScrollContainer = useCallback((element: HTMLDivElement) => {
    scrollContainersRef.current.add(element);
  }, []);

  const unregisterScrollContainer = useCallback((element: HTMLDivElement) => {
    scrollContainersRef.current.delete(element);
  }, []);

  const handleGameScroll = useCallback((y: number) => {
    if (!progressGame.gameState.isPlaying) return;
    scrollYRef.current = y;
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      scrollContainersRef.current.forEach((container) => {
        if (container.scrollTop !== y) {
          container.scrollTop = y;
        }
      });
      requestAnimationFrame(() => { isScrollingRef.current = false; });
    }
  }, [progressGame.gameState.isPlaying]);

  const { data: versions = [], isLoading: isVersionsLoading, isError: isVersionsError, error: versionsError, refetch: refetchVersions } = useQuery({
    queryKey: ['versions'], queryFn: () => api.getVersions(),
  });

  const { data: assigneesData } = useQuery({
    queryKey: ['assignees'], queryFn: () => api.getAssignees(),
  });
  const assignees = Array.isArray(assigneesData) ? assigneesData : [];

  const { data: boardData, isLoading: isBoardLoading, refetch } = useQuery({
    queryKey: ['board', currentVersionId],
    queryFn: async () => {
      if (!currentVersionId) return null;
      return api.getVersionBoard(currentVersionId);
    },
    enabled: !!currentVersionId,
  });

  const { data: delayConfigs = [] } = useQuery({
    queryKey: ['delay-configs', currentVersionId],
    queryFn: async () => {
      if (!currentVersionId) return [];
      return api.getDelayConfigs(currentVersionId);
    },
    enabled: !!currentVersionId,
  });

  useEffect(() => {
    if (currentVersionId && versions.length > 0) {
      const versionExists = versions.some((v: Version) => v.id === currentVersionId);
      if (!versionExists) {
        setCurrentVersionId(null);
        return;
      }
    }
    if (versions.length > 0 && !currentVersionId) {
      const current = versions.find((v: Version) => v.status === 'DEVELOPMENT' || v.status === 'TESTING');
      const selectedId = current?.id || versions[0].id;
      setCurrentVersionId(selectedId);
    }
  }, [versions, currentVersionId, setCurrentVersionId]);

  const generateReqCode = async () => {
    if (!currentVersionId) return;
    try {
      const result = await api.generateRequirementCode(currentVersionId);
      setReqForm((prev) => ({ ...prev, code: result.code }));
    } catch (e) {
      console.error('Failed to generate code', e);
    }
  };

  const generateIssueCode = async () => {
    if (!currentVersionId) return;
    try {
      const result = await api.generateIssueCode(currentVersionId);
      setIssueForm((prev) => ({ ...prev, code: result.code }));
    } catch (e) {
      console.error('Failed to generate code', e);
    }
  };

  const createRequirement = useMutation({
    mutationFn: () => api.createRequirement({
      code: reqForm.code, title: reqForm.title, versionId: currentVersionId!,
      assigneeId: reqForm.assigneeId, workload: reqForm.workload ? Number(reqForm.workload) : undefined,
      dueDate: reqForm.dueDate || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
      setIsReqDialogOpen(false);
      setReqForm({ code: '', title: '', assigneeId: '', workload: '', dueDate: '' });
    },
  });

  const createIssue = useMutation({
    mutationFn: () => api.createIssue({
      code: issueForm.code, title: issueForm.title, versionId: currentVersionId!,
      assigneeId: issueForm.assigneeId, severity: issueForm.severity as IssueSeverity,
      testCycleId: issueForm.testCycleId || undefined, dueDate: issueForm.dueDate || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] });
      setIsIssueDialogOpen(false);
      setIssueForm({ code: '', title: '', assigneeId: '', severity: IssueSeverity.MEDIUM, testCycleId: '', dueDate: '' });
    },
  });

  const updateRequirementStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.updateRequirementStage(id, stage),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] }); },
  });

  const updateIssueStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.updateIssueStage(id, stage),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['board', currentVersionId] }); },
  });

  const kanbanData = useMemo(() => {
    if (!boardData) return { columns: [], items: [], testCycles: [], stageConfigs: [] };
    const testCycles = boardData.testCycles || [];
    const requirements = boardData.requirements || [];
    const issues = boardData.issues || [];
    const config = kanbanConfig || generateDefaultKanbanConfig();

    const columns: BoardColumn[] = [];
    let versionTestIndex = 0;

    config.columns.forEach((colConfig: ColumnConfig) => {
      const hasVersionTest = colConfig.stages.includes(WorkflowStage.VERSION_TEST);
      if (hasVersionTest) {
        const testCycle = testCycles[versionTestIndex];
        versionTestIndex++;
        if (testCycle) {
          const columnTitle = colConfig.title || testCycle.name;
          columns.push({
            id: `test-${testCycle.id}`, title: columnTitle, stage: WorkflowStage.VERSION_TEST,
            testCycleId: testCycle.id, isDynamic: true, stages: [WorkflowStage.VERSION_TEST],
          });
        } else {
          columns.push({
            id: `${colConfig.id}-versiontest-${versionTestIndex}`, title: colConfig.title || `转测${versionTestIndex}`,
            stage: WorkflowStage.VERSION_TEST, isDynamic: true, stages: [WorkflowStage.VERSION_TEST],
          });
        }
        const stagesWithoutVersionTest = colConfig.stages.filter(s => s !== WorkflowStage.VERSION_TEST);
        if (stagesWithoutVersionTest.length > 0) {
          columns.push({
            id: colConfig.id, title: colConfig.title, stage: stagesWithoutVersionTest[0],
            stages: stagesWithoutVersionTest, isDynamic: false,
          });
        }
      } else {
        columns.push({
          id: colConfig.id, title: colConfig.title, stage: colConfig.stages[0],
          stages: colConfig.stages, isDynamic: false,
        });
      }
    });

    const items: KanbanItem[] = [
      ...requirements.map((req: BoardRequirement) => ({
        id: req.id, type: 'requirement' as const, code: req.code, title: req.title,
        status: req.status, currentStage: req.currentStage, assignee: req.assignee, workload: req.workload,
      })),
      ...issues.map((issue: BoardIssue) => ({
        id: issue.id, type: 'issue' as const, code: issue.code, title: issue.title,
        status: issue.status, currentStage: issue.currentStage || WorkflowStage.ISSUE_FIX,
        assignee: issue.assignee, severity: issue.severity, testCycleId: issue.testCycleId,
      })),
    ];

    return { columns, items, testCycles, stageConfigs: config.stageConfigs };
  }, [boardData, kanbanConfig]);

  const { sensors, overId, isDropAllowed, activeItem, handleDragStart, handleDragOver, handleDragEnd } = useKanbanDrag({
    kanbanData,
    interactionMode,
    onUpdateRequirementStage: (data) => updateRequirementStage.mutate(data),
    onUpdateIssueStage: (data) => updateIssueStage.mutate(data),
  });

  const isUserPM = isPMOrAdmin(user?.role);

  const delayConfigsMap = useMemo(() => {
    const map = new Map<string, { stageDeadlines: { stage: WorkflowStage; plannedDate: string }[] }>();
    delayConfigs.forEach((config: ItemDelayConfig) => { map.set(config.entityId, { stageDeadlines: config.stageDeadlines }); });
    return map;
  }, [delayConfigs]);

  if (isVersionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <RefreshCw className="h-4 w-4 mr-2" />重试
          </Button>
        </div>
      </div>
    );
  }

  const hasNoVersions = versions.length === 0 && isUserPM;
  const hasNoCards = currentVersionId && !isBoardLoading && kanbanData.items.length === 0 && isUserPM;

  const handleOpenRequirementDialog = () => {
    generateReqCode();
    setIsReqDialogOpen(true);
  };

  const handleOpenIssueDialog = () => {
    generateIssueCode();
    setIsIssueDialogOpen(true);
  };

  const reqDueDate = reqForm.dueDate ? new Date(reqForm.dueDate) : undefined;
  const issueDueDate = issueForm.dueDate ? new Date(issueForm.dueDate) : undefined;

  return (
    <div className="h-screen flex flex-col">
      <BoardHeader
        versions={versions}
        currentVersionId={currentVersionId}
        onVersionChange={setCurrentVersionId}
        isPM={isUserPM}
        hasVersion={!!currentVersionId}
        hasItems={kanbanData.items.length > 0}
        onOpenRequirementDialog={handleOpenRequirementDialog}
        onOpenIssueDialog={handleOpenIssueDialog}
        onOpenConfigDialog={() => setIsConfigDialogOpen(true)}
        onOpenGameDialog={() => setIsGameDialogOpen(true)}
        onRefetch={() => refetch()}
      />

      <CreateRequirementDialog
        open={isReqDialogOpen}
        onOpenChange={setIsReqDialogOpen}
        code={reqForm.code}
        title={reqForm.title}
        assigneeId={reqForm.assigneeId}
        workload={reqForm.workload}
        dueDate={reqDueDate}
        onCodeChange={(v) => setReqForm((p) => ({ ...p, code: v }))}
        onTitleChange={(v) => setReqForm((p) => ({ ...p, title: v }))}
        onAssigneeChange={(v) => setReqForm((p) => ({ ...p, assigneeId: v }))}
        onWorkloadChange={(v) => setReqForm((p) => ({ ...p, workload: v }))}
        onDueDateChange={(d) => setReqForm((p) => ({ ...p, dueDate: d ? formatLocalDate(d) : '' }))}
        assignees={assignees}
        isPending={createRequirement.isPending}
        onSubmit={() => createRequirement.mutate()}
        canSubmit={!!reqForm.title && !!reqForm.assigneeId}
      />

      <CreateIssueDialog
        open={isIssueDialogOpen}
        onOpenChange={setIsIssueDialogOpen}
        code={issueForm.code}
        title={issueForm.title}
        assigneeId={issueForm.assigneeId}
        severity={issueForm.severity}
        testCycleId={issueForm.testCycleId}
        dueDate={issueDueDate}
        onCodeChange={(v) => setIssueForm((p) => ({ ...p, code: v }))}
        onTitleChange={(v) => setIssueForm((p) => ({ ...p, title: v }))}
        onAssigneeChange={(v) => setIssueForm((p) => ({ ...p, assigneeId: v }))}
        onSeverityChange={(v) => setIssueForm((p) => ({ ...p, severity: v }))}
        onTestCycleChange={(v) => setIssueForm((p) => ({ ...p, testCycleId: v }))}
        onDueDateChange={(d) => setIssueForm((p) => ({ ...p, dueDate: d ? formatLocalDate(d) : '' }))}
        assignees={assignees}
        testCycles={kanbanData.testCycles}
        isPending={createIssue.isPending}
        onSubmit={() => createIssue.mutate()}
        canSubmit={!!issueForm.title && !!issueForm.assigneeId}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
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
                  <Button onClick={handleOpenRequirementDialog}>
                    <FileText className="h-4 w-4 mr-2" />新建需求
                  </Button>
                  <Button variant="destructive" onClick={handleOpenIssueDialog}>
                    <AlertCircle className="h-4 w-4 mr-2" />新建问题单
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  提示：需求会从「需求设计」阶段开始，问题单会出现在「修改问题单」列
                </p>
              </div>
            </div>
          )}

          {isBoardLoading && currentVersionId && (
            <div className="absolute inset-0 flex items-center justify-center z-5 bg-background/50">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="flex h-full min-w-max">
            {kanbanData.columns.map((column) => {
              const columnItems = kanbanData.items.filter((item) => {
                if (column.stages && column.stages.length > 1) {
                  return column.stages.includes(item.currentStage);
                }
                if (column.isDynamic) {
                  if (item.type === 'issue') return item.testCycleId === column.testCycleId;
                  if (item.type === 'requirement' && item.currentStage === WorkflowStage.VERSION_TEST) return true;
                  return false;
                }
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
                    progressGame.gameState.items.length > 0
                      ? {
                          isActive: progressGame.gameState.isPlaying,
                          checkpoints: progressGame.gameState.checkpoints,
                          totalRows: progressGame.gameState.totalRows || progressGame.gameState.items.length,
                          gameItemStates: new Map(
                            progressGame.gameState.items.map(item => [
                              item.id,
                              {
                                currentStage: item.currentStage,
                                shadowStages: item.shadowStages,
                                isAdvancing: item.isAdvancing,
                                passedCheckpoints: item.passedCheckpoints,
                                isExploding: item.isExploding,
                                isReappearing: item.isReappearing,
                                rowIndex: item.rowIndex,
                              },
                            ])
                          ),
                          allItems: kanbanData.items,
                          onAdvanceItem: progressGame.advanceItem,
                          onPassCheckpoint: progressGame.passCheckpoint,
                          getShadowPosition: progressGame.getShadowPosition,
                          getPassedCheckpointLabels: progressGame.getPassedCheckpointLabels,
                          getNextCheckpointForItem: progressGame.getNextCheckpointForItem,
                          onScroll: handleGameScroll,
                          registerScrollContainer,
                          unregisterScrollContainer,
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
          modifiers={[restrictToWindowEdges]}
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

      <AutoWelcomeDialog triggerCondition="empty_versions" shouldTrigger={hasNoVersions} />
      <KanbanConfigDialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen} />

      <ProgressGameDialog
        open={isGameDialogOpen}
        onOpenChange={setIsGameDialogOpen}
        availableStages={DefaultStageOrder.filter((s) => s !== WorkflowStage.RELEASE) as WorkflowStage[]}
        onStartGame={(checkpoints) => {
          const gameItems = kanbanData.items.map((item) => ({
            id: item.id, type: item.type, code: item.code, title: item.title,
            currentStage: item.currentStage, assignee: { id: item.assignee.id, name: item.assignee.name },
          }));
          progressGame.startGame(checkpoints, gameItems, currentVersionId || undefined);
        }}
      />

      <ItemDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        item={selectedItem}
        testCycles={kanbanData.testCycles}
        delayConfig={selectedItem ? delayConfigsMap.get(selectedItem.id) : undefined}
        versionId={currentVersionId || undefined}
        isPM={isUserPM}
      />

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
