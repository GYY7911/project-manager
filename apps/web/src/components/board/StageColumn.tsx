'use client';

import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { GameCard, COLUMN_COLORS } from '@/components/progress-game';
import { WorkflowStage, StageLabels, StageConfig } from '@pm/shared';
import { cn } from '@/lib/utils';

interface Column {
  id: string;
  title?: string;
  stage: WorkflowStage | string;
  stages?: (WorkflowStage | string)[]; // For merged columns (支持自定义阶段)
  isDynamic?: boolean;
  testCycleId?: string;
}

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

// 游戏模式相关的 props
interface GameModeProps {
  isActive: boolean;
  checkpoints: WorkflowStage[];
  totalRows: number; // 甘特图总行数
  // 游戏项状态
  gameItemStates: Map<string, {
    currentStage: WorkflowStage; // 主卡片当前位置
    shadowStages: WorkflowStage[]; // 影子所在的阶段列表（之前经过的阶段）
    isAdvancing: boolean;
    passedCheckpoints: WorkflowStage[];
    isExploding?: boolean; // 是否正在爆炸
    isReappearing?: boolean; // 是否正在重新出现（过卡点后在新位置出现）
    rowIndex: number; // 甘特图行号
  }>;
  // 所有卡片数据，用于显示影子卡片
  allItems: KanbanItem[];
  onAdvanceItem: (itemId: string) => void;
  onPassCheckpoint: (itemId: string) => void;
  // 辅助方法
  getShadowPosition?: (itemId: string, stage: WorkflowStage) => number;
  getPassedCheckpointLabels?: (itemId: string) => string[];
  getNextCheckpointForItem?: (itemId: string) => WorkflowStage | null;
  // 滚动同步
  onScroll?: (y: number) => void;
  registerScrollContainer?: (element: HTMLDivElement) => void;
  unregisterScrollContainer?: (element: HTMLDivElement) => void;
}

interface StageColumnProps {
  column: Column;
  items: KanbanItem[];
  interactionMode: 'drag' | 'click';
  isPM: boolean;
  stageConfigs?: StageConfig[];
  gameMode?: GameModeProps;
  onCardClick?: (item: KanbanItem) => void;
  onDuplicate?: (item: KanbanItem) => void;
  isOver?: boolean;
  isDropAllowed?: boolean;
  delayConfigs?: Map<string, { stageDeadlines: { stage: WorkflowStage; plannedDate: string }[] }>;
}

const stageColors: Record<WorkflowStage | string, string> = {
  [WorkflowStage.REQUIREMENT_DESIGN]: 'border-l-blue-500',
  [WorkflowStage.ALPHA_TEST_DESIGN]: 'border-l-cyan-500',
  [WorkflowStage.DOCUMENT_SIGN]: 'border-l-green-500',
  [WorkflowStage.FEATURE_DEV]: 'border-l-yellow-500',
  [WorkflowStage.ALPHA_CASE_DEV]: 'border-l-orange-500',
  [WorkflowStage.SOP_UPGRADE]: 'border-l-pink-500',
  [WorkflowStage.VERSION_TEST]: 'border-l-purple-500',
  [WorkflowStage.ISSUE_FIX]: 'border-l-red-500',
  [WorkflowStage.CCB_REVIEW]: 'border-l-amber-500',
  [WorkflowStage.RELEASE]: 'border-l-emerald-500',
};

// Get stage color (支持自定义阶段)
function getStageColor(stage: WorkflowStage | string, stageConfigs?: StageConfig[]): string {
  if (stageConfigs) {
    const config = stageConfigs.find(sc => sc.stage === stage);
    if (config?.color) {
      // 将 bg-xxx 转换为 border-l-xxx
      const colorClass = config.color.replace('bg-', 'border-l-');
      return colorClass;
    }
  }
  // 系统阶段使用预定义颜色
  if (stage in stageColors) {
    return stageColors[stage as WorkflowStage];
  }
  // 自定义阶段默认颜色
  return 'border-l-slate-500';
}

// Get display title for a stage (支持自定义阶段)
function getStageLabel(stage: WorkflowStage | string, stageConfigs?: StageConfig[]): string {
  if (stageConfigs) {
    const config = stageConfigs.find(sc => sc.stage === stage);
    if (config?.customTitle) return config.customTitle;
  }
  // 检查是否是系统阶段
  if (stage in StageLabels) {
    return StageLabels[stage as WorkflowStage];
  }
  // 自定义阶段直接返回 stage ID 作为显示名称
  return stage;
}

// 检查是否是卡点列
function isCheckpointColumn(
  column: Column,
  checkpoints: (WorkflowStage | string)[]
): boolean {
  const mergedStages = column.stages && column.stages.length > 0
    ? column.stages
    : [column.stage];
  return mergedStages.some(stage => checkpoints.includes(stage as WorkflowStage));
}

// 排序函数：问题单在上，需求在下
function sortItems(items: KanbanItem[]): KanbanItem[] {
  return [...items].sort((a, b) => {
    // 问题单排前面
    if (a.type === 'issue' && b.type !== 'issue') return -1;
    if (a.type !== 'issue' && b.type === 'issue') return 1;
    // 同类型按 code 排序
    return a.code.localeCompare(b.code);
  });
}

// 获取下一个阶段
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

function getNextStage(currentStage: WorkflowStage | string): WorkflowStage | null {
  // 自定义阶段没有下一个阶段的概念
  if (typeof currentStage === 'string' && !Object.values(WorkflowStage).includes(currentStage as WorkflowStage)) {
    return null;
  }
  const index = STAGE_ORDER.indexOf(currentStage as WorkflowStage);
  if (index < 0 || index >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[index + 1];
}

// Sub-region component for merged columns
function StageSubRegion({
  stage,
  items,
  interactionMode,
  isPM,
  stageConfigs,
  isLast,
  gameMode,
  isCheckpoint,
  column,
  onCardClick,
  onDuplicate,
  delayConfigs,
}: {
  stage: WorkflowStage; // 子区域只接受系统阶段（items只有系统阶段）
  items: KanbanItem[]; // 原始 items（非游戏模式使用）
  interactionMode: 'drag' | 'click';
  isPM: boolean;
  stageConfigs?: StageConfig[];
  isLast: boolean;
  gameMode?: GameModeProps;
  isCheckpoint: boolean;
  column: Column; // 列信息（用于动态列过滤）
  onCardClick?: (item: KanbanItem) => void;
  onDuplicate?: (item: KanbanItem) => void;
  delayConfigs?: Map<string, { stageDeadlines: { stage: WorkflowStage; plannedDate: string }[] }>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sub-${stage}`,
  });

  // 获取该阶段的颜色
  const stageColor = COLUMN_COLORS[stage] || '#64748b';
  const nextStage = getNextStage(stage);
  const targetColor = nextStage ? (COLUMN_COLORS[nextStage] || '#64748b') : stageColor;

  // 获取影子卡片 - 只要 gameMode 存在就使用游戏状态
  const getShadowItemsForStage = (s: WorkflowStage | string): KanbanItem[] => {
    if (!gameMode) return [];

    const shadowItems: KanbanItem[] = [];
    const allItemsList = gameMode.allItems;

    gameMode.gameItemStates.forEach((state, itemId) => {
      if (state.shadowStages.includes(s as WorkflowStage)) {
        const originalItem = allItemsList.find(i => i.id === itemId);
        if (originalItem) {
          // 动态列过滤
          if (column.isDynamic) {
            // Issues show if they belong to this test cycle
            if (originalItem.type === 'issue' && originalItem.testCycleId === column.testCycleId) {
              shadowItems.push(originalItem);
            }
            // Requirements with VERSION_TEST stage show in all test cycle columns
            if (originalItem.type === 'requirement' && originalItem.currentStage === WorkflowStage.VERSION_TEST) {
              shadowItems.push(originalItem);
            }
            return;
          }
          shadowItems.push(originalItem);
        }
      }
    });

    return shadowItems;
  };

  // 获取主卡片 - 只要 gameMode 存在就使用游戏状态
  const getMainItemsForStage = (s: WorkflowStage | string): KanbanItem[] => {
    if (!gameMode) {
      return items.filter(item => {
        // 首先检查阶段是否匹配
        if (item.currentStage !== s) return false;
        // 动态列过滤
        if (column.isDynamic) {
          // Issues show if they belong to this test cycle
          if (item.type === 'issue' && item.testCycleId === column.testCycleId) {
            return true;
          }
          // Requirements with VERSION_TEST stage show in all test cycle columns
          if (item.type === 'requirement' && item.currentStage === WorkflowStage.VERSION_TEST) {
            return true;
          }
          return false;
        }
        return true;
      });
    }

    const mainItems: KanbanItem[] = [];
    const allItemsList = gameMode.allItems;

    gameMode.gameItemStates.forEach((state, itemId) => {
      if (state.currentStage === s) {
        const originalItem = allItemsList.find(i => i.id === itemId);
        if (originalItem) {
          // 动态列过滤
          if (column.isDynamic) {
            // Issues show if they belong to this test cycle
            if (originalItem.type === 'issue' && originalItem.testCycleId === column.testCycleId) {
              mainItems.push(originalItem);
            }
            // Requirements with VERSION_TEST stage show in all test cycle columns
            if (originalItem.type === 'requirement' && originalItem.currentStage === WorkflowStage.VERSION_TEST) {
              mainItems.push(originalItem);
            }
            return;
          }
          mainItems.push(originalItem);
        }
      }
    });

    return mainItems;
  };

  const mainItems = getMainItemsForStage(stage);
  const shadowItems = getShadowItemsForStage(stage);
  const allItems = [...sortItems(mainItems), ...shadowItems];
  const sortedItems = allItems;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-h-0 flex flex-col relative',
        !isLast && 'border-b border-slate-200 dark:border-white/10',
        gameMode?.isActive && isCheckpoint && 'bg-violet-500/10'
      )}
    >
      {/* Sub-region header */}
      <div className={cn(
        "px-3 py-1.5 border-b border-slate-100 dark:border-white/5",
        gameMode?.isActive && isCheckpoint ? "bg-violet-500/30" : "bg-muted/30"
      )}>
        <span className={cn(
          "text-xs font-medium",
          gameMode?.isActive && isCheckpoint ? "text-violet-600 dark:text-violet-300" : "text-muted-foreground"
        )}>
          {getStageLabel(stage, stageConfigs)}
        </span>
        {gameMode?.isActive && isCheckpoint && (
          <span className="ml-1 text-xs text-violet-400">🎯</span>
        )}
        <span className="ml-2 text-xs text-muted-foreground/70">
          ({mainItems.length}{shadowItems.length > 0 && ` + ${shadowItems.length}影子`})
        </span>
      </div>

      {/* Sub-region content - Gantt-style layout during game mode */}
      <div
        className="flex-1 overflow-y-auto relative"
        style={gameMode?.isActive && gameMode.totalRows > 0 ? {
          display: 'grid',
          // 固定行高：确保所有列完美对齐（72px = 卡片高度60px + gap）
          gridTemplateRows: `repeat(${gameMode.totalRows}, 72px)`,
          gap: '8px',
          padding: '8px',
          alignContent: 'start',
        } : undefined}
      >
        {gameMode?.isActive ? (
          // Gantt-style layout: position cards at their rowIndex
          (() => {
            // Build a map of rowIndex -> item for this sub-region
            const rowItems = new Map<number, { item: KanbanItem; isShadow: boolean }>();

            mainItems.forEach((item) => {
              const state = gameMode.gameItemStates.get(item.id);
              if (state) {
                rowItems.set(state.rowIndex, { item, isShadow: false });
              }
            });

            shadowItems.forEach((item) => {
              const state = gameMode.gameItemStates.get(item.id);
              if (state) {
                if (!rowItems.has(state.rowIndex)) {
                  rowItems.set(state.rowIndex, { item, isShadow: true });
                }
              }
            });

            // Render cards at their grid positions
            return Array.from(rowItems.entries())
              .sort(([a], [b]) => a - b)
              .map(([rowIndex, { item, isShadow }]) => {
                const gameItemState = gameMode.gameItemStates.get(item.id);
                const gameCurrentStage = gameItemState?.currentStage || item.currentStage;
                const passedCheckpoints = gameItemState?.passedCheckpoints || [];

                // 直接从 gameMode.checkpoints 和 gameItemState 计算是否在卡点
                let nextCheckpoint: WorkflowStage | null = null;
                for (const checkpoint of gameMode.checkpoints) {
                  if (!passedCheckpoints.includes(checkpoint)) {
                    nextCheckpoint = checkpoint;
                    break;
                  }
                }

                // 判断是否在卡点：当前阶段等于下一个卡点
                const isAtCheckpoint = !!(nextCheckpoint && gameCurrentStage === nextCheckpoint);

                const shadowPosition = gameMode.getShadowPosition
                  ? gameMode.getShadowPosition(item.id, stage)
                  : (isShadow ? 1 : 0);
                const passedCheckpointLabels = gameMode.getPassedCheckpointLabels
                  ? gameMode.getPassedCheckpointLabels(item.id)
                  : [];

                return (
                  <div
                    key={`${item.id}-${isShadow ? 'shadow' : 'main'}`}
                    style={{ gridRow: rowIndex + 1 }}
                    className="h-[60px] overflow-hidden" // 固定卡片高度
                  >
                    <GameCard
                      id={item.id}
                      code={item.code}
                      title={item.title}
                      type={item.type}
                      currentStage={gameCurrentStage}
                      assignee={item.assignee}
                      targetColumnColor={targetColor}
                      isAtCheckpoint={isAtCheckpoint ?? false}
                      shadowStages={gameItemState?.shadowStages || []}
                      isAdvancing={gameItemState?.isAdvancing ?? false}
                      isExploding={gameItemState?.isExploding ?? false}
                      isReappearing={gameItemState?.isReappearing ?? false}
                      onAdvance={() => gameMode.onAdvanceItem(item.id)}
                      onPassCheckpoint={() => gameMode.onPassCheckpoint(item.id)}
                      isShadow={isShadow}
                      shadowPosition={shadowPosition}
                      passedCheckpointLabels={passedCheckpointLabels}
                      isGameActive={gameMode.isActive}
                    />
                  </div>
                );
              });
          })()
        ) : (
          // Normal mode (including game mode not active): use KanbanCard with delayConfigs
          sortedItems.map((item) => {
            const config = delayConfigs?.get(item.id);
            return (
              <KanbanCard
                key={item.id}
                item={item}
                interactionMode={interactionMode}
                isPM={isPM}
                onClick={() => onCardClick?.(item)}
                onDuplicate={() => onDuplicate?.(item)}
                delayConfig={config}
              />
            );
          })
        )}

        {/* Gradient fade at bottom - only in non-game mode */}
        {sortedItems.length > 3 && !gameMode?.isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export function StageColumn({ column, items, interactionMode, isPM, stageConfigs, gameMode, onCardClick, onDuplicate, isOver: isOverFromProps, isDropAllowed, delayConfigs }: StageColumnProps) {
  const { setNodeRef, isOver: isOverFromDroppable } = useDroppable({
    id: column.id,
  });

  // 使用外部传入的 isOver（如果有），否则使用内部 useDroppable 的 isOver
  const isOver = isOverFromProps ?? isOverFromDroppable;

  const mergedStages = column.stages && column.stages.length > 0
    ? column.stages
    : [column.stage];

  const isMerged = mergedStages.length > 1;

  // Get column title
  const columnTitle = column.title || (
    isMerged
      ? mergedStages.map(s => getStageLabel(s, stageConfigs)).join(' + ')
      : getStageLabel(column.stage, stageConfigs)
  );

  // Get the primary stage color (first stage for merged columns)
  const primaryStage = mergedStages[0];

  // 检查该列是否是卡点
  const isCheckpoint = gameMode?.isActive
    ? isCheckpointColumn(column, gameMode.checkpoints)
    : false;

  // 获取应该在当前列显示的影子卡片（来自之前阶段的推进）
  // 注意：只要 gameMode 存在就使用游戏状态，不要求 isActive（退出后仍显示影子）
  const getShadowItemsForStage = (stage: WorkflowStage | string): KanbanItem[] => {
    if (!gameMode) return [];

    const shadowItems: KanbanItem[] = [];
    const allItemsList = gameMode.allItems;

    gameMode.gameItemStates.forEach((state, itemId) => {
      // 影子显示在之前的阶段（shadowStages 中包含的阶段）
      if (state.shadowStages.includes(stage as WorkflowStage)) {
        const originalItem = allItemsList.find(i => i.id === itemId);
        if (originalItem) {
          // 动态列过滤
          if (column.isDynamic) {
            // Issues show if they belong to this test cycle
            if (originalItem.type === 'issue' && originalItem.testCycleId === column.testCycleId) {
              shadowItems.push(originalItem);
            }
            // Requirements with VERSION_TEST stage show in all test cycle columns
            if (originalItem.type === 'requirement' && originalItem.currentStage === WorkflowStage.VERSION_TEST) {
              shadowItems.push(originalItem);
            }
            return;
          }
          shadowItems.push(originalItem);
        }
      }
    });

    return shadowItems;
  };

  // 获取应该在当前列显示的主卡片（基于游戏中的 currentStage）
  // 注意：只要 gameMode 存在就使用游戏状态，不要求 isActive（退出后仍显示）
  const getMainItemsForStage = (stage: WorkflowStage | string): KanbanItem[] => {
    if (!gameMode) {
      // 非游戏模式，使用原始 items
      return items.filter(item => {
        // 首先检查阶段是否匹配
        if (item.currentStage !== stage) return false;
        // 动态列过滤
        if (column.isDynamic) {
          // Issues show if they belong to this test cycle
          if (item.type === 'issue' && item.testCycleId === column.testCycleId) {
            return true;
          }
          // Requirements with VERSION_TEST stage show in all test cycle columns
          if (item.type === 'requirement' && item.currentStage === WorkflowStage.VERSION_TEST) {
            return true;
          }
          return false;
        }
        return true;
      });
    }

    const mainItems: KanbanItem[] = [];
    const allItemsList = gameMode.allItems;

    gameMode.gameItemStates.forEach((state, itemId) => {
      // 主卡片显示在 currentStage 位置
      if (state.currentStage === stage) {
        const originalItem = allItemsList.find(i => i.id === itemId);
        if (originalItem) {
          // 动态列过滤
          if (column.isDynamic) {
            // Issues show if they belong to this test cycle
            if (originalItem.type === 'issue' && originalItem.testCycleId === column.testCycleId) {
              mainItems.push(originalItem);
            }
            // Requirements with VERSION_TEST stage show in all test cycle columns
            if (originalItem.type === 'requirement' && originalItem.currentStage === WorkflowStage.VERSION_TEST) {
              mainItems.push(originalItem);
            }
            return;
          }
          mainItems.push(originalItem);
        }
      }
    });

    return mainItems;
  };

  // 排序 items
  const sortedItems = sortItems(items);

  // For single-stage column
  if (!isMerged) {
    const stageColor = COLUMN_COLORS[primaryStage] || '#64748b';
    const nextStage = getNextStage(primaryStage);
    const targetColor = nextStage ? (COLUMN_COLORS[nextStage] || '#64748b') : stageColor;

    // 获取该列的主卡片和影子卡片
    const mainItems = getMainItemsForStage(primaryStage);
    const shadowItems = getShadowItemsForStage(primaryStage);
    const allItems = [...sortItems(mainItems), ...shadowItems];

    return (
      <div
        ref={setNodeRef}
        className={cn(
          'w-72 h-full flex-shrink-0 flex flex-col border-l-4 bg-background/50 transition-all duration-200 ease-out',
          getStageColor(primaryStage, stageConfigs),
          isOver && isDropAllowed && 'bg-primary/10 ring-2 ring-primary/30 ring-inset',
          isOver && !isDropAllowed && 'bg-red-500/10 ring-2 ring-red-500/50 ring-inset cursor-not-allowed',
          gameMode?.isActive && isCheckpoint && 'ring-2 ring-violet-500/50 ring-inset'
        )}
        style={!isDropAllowed && isOver ? { cursor: 'not-allowed' } : undefined}
      >
        {/* Column Header */}
        <div className={cn(
          "h-12 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 glass",
          gameMode?.isActive && isCheckpoint && "bg-violet-500/20"
        )}>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{columnTitle}</h3>
            {gameMode?.isActive && isCheckpoint && (
              <span className="text-violet-400">🎯</span>
            )}
          </div>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            gameMode?.isActive && isCheckpoint
              ? "bg-violet-500/30 text-violet-700 dark:text-violet-200"
              : "text-muted-foreground bg-slate-100 dark:bg-white/10"
          )}>
            {mainItems.length}{shadowItems.length > 0 && ` + ${shadowItems.length}`}
          </span>
        </div>

        {/* Column Content - Gantt-style layout during game mode */}
        <div
          ref={(el) => {
            if (el && gameMode?.registerScrollContainer) {
              gameMode.registerScrollContainer(el);
            }
          }}
          className="flex-1 overflow-y-auto relative"
          onScroll={(e) => {
            if (gameMode?.onScroll) {
              gameMode.onScroll(e.currentTarget.scrollTop);
            }
          }}
          style={gameMode?.isActive && gameMode.totalRows > 0 ? {
            display: 'grid',
            // 固定行高：确保所有列完美对齐（72px = 卡片高度60px + gap）
            gridTemplateRows: `repeat(${gameMode.totalRows}, 72px)`,
            gap: '8px',
            padding: '8px',
            alignContent: 'start',
          } : undefined}
        >
          {gameMode?.isActive ? (
            // Gantt-style layout: position cards at their rowIndex
            (() => {
              // Build a map of rowIndex -> item for this column
              const rowItems = new Map<number, { item: KanbanItem; isShadow: boolean }>();

              mainItems.forEach((item) => {
                const state = gameMode.gameItemStates.get(item.id);
                if (state) {
                  rowItems.set(state.rowIndex, { item, isShadow: false });
                }
              });

              shadowItems.forEach((item) => {
                const state = gameMode.gameItemStates.get(item.id);
                if (state) {
                  // Shadow appears at the same row as main card
                  if (!rowItems.has(state.rowIndex)) {
                    rowItems.set(state.rowIndex, { item, isShadow: true });
                  }
                }
              });

              // Render cards at their grid positions
              return Array.from(rowItems.entries())
                .sort(([a], [b]) => a - b)
                .map(([rowIndex, { item, isShadow }]) => {
                  const gameItemState = gameMode.gameItemStates.get(item.id);
                  const gameCurrentStage = gameItemState?.currentStage || item.currentStage;
                  const passedCheckpoints = gameItemState?.passedCheckpoints || [];

                  // 直接从 gameMode.checkpoints 和 gameItemState 计算是否在卡点
                  // 不依赖传入的 getNextCheckpointForItem 函数
                  let nextCheckpoint: WorkflowStage | null = null;
                  for (const checkpoint of gameMode.checkpoints) {
                    if (!passedCheckpoints.includes(checkpoint)) {
                      nextCheckpoint = checkpoint;
                      break;
                    }
                  }

                  // 判断是否在卡点：当前阶段等于下一个卡点
                  const isAtCheckpoint = !!(nextCheckpoint && gameCurrentStage === nextCheckpoint);

                  const shadowPosition = gameMode.getShadowPosition && Object.values(WorkflowStage).includes(primaryStage as WorkflowStage)
                    ? gameMode.getShadowPosition(item.id, primaryStage as WorkflowStage)
                    : (isShadow ? 1 : 0);
                  const passedCheckpointLabels = gameMode.getPassedCheckpointLabels
                    ? gameMode.getPassedCheckpointLabels(item.id)
                    : [];

                  return (
                    <div
                      key={`${item.id}-${isShadow ? 'shadow' : 'main'}`}
                      style={{ gridRow: rowIndex + 1 }}
                      className="h-[60px] overflow-hidden" // 固定卡片高度
                    >
                      <GameCard
                        id={item.id}
                        code={item.code}
                        title={item.title}
                        type={item.type}
                        currentStage={gameCurrentStage}
                        assignee={item.assignee}
                        targetColumnColor={targetColor}
                        isAtCheckpoint={isAtCheckpoint ?? false}
                        shadowStages={gameItemState?.shadowStages || []}
                        isAdvancing={gameItemState?.isAdvancing ?? false}
                        isExploding={gameItemState?.isExploding ?? false}
                      isReappearing={gameItemState?.isReappearing ?? false}
                        onAdvance={() => gameMode.onAdvanceItem(item.id)}
                        onPassCheckpoint={() => gameMode.onPassCheckpoint(item.id)}
                        isShadow={isShadow}
                        shadowPosition={shadowPosition}
                        passedCheckpointLabels={passedCheckpointLabels}
                        isGameActive={gameMode.isActive}
                      />
                    </div>
                  );
                });
            })()
          ) : gameMode ? (
            // Game mode but not active (after exit): only show main cards in normal layout
            allItems
              .filter((item) => !shadowItems.some(i => i.id === item.id))
              .map((item) => {
                const gameItemState = gameMode.gameItemStates.get(item.id);
                const gameCurrentStage = gameItemState?.currentStage || item.currentStage;

                return (
                  <GameCard
                    key={`${item.id}-main`}
                    id={item.id}
                    code={item.code}
                    title={item.title}
                    type={item.type}
                    currentStage={gameCurrentStage}
                    assignee={item.assignee}
                    targetColumnColor={targetColor}
                    isAtCheckpoint={false}
                    shadowStages={[]}
                    isAdvancing={false}
                    isExploding={false}
                  isReappearing={false}
                    onAdvance={() => {}}
                    onPassCheckpoint={() => {}}
                    isShadow={false}
                    shadowPosition={0}
                    passedCheckpointLabels={gameMode.getPassedCheckpointLabels?.(item.id) || []}
                    isGameActive={false}
                  />
                );
              })
          ) : (
            // Normal mode (including game mode not active): use KanbanCard with delayConfigs
            allItems.map((item) => {
              const config = delayConfigs?.get(item.id);
              return (
                <KanbanCard
                  key={item.id}
                  item={item}
                  interactionMode={interactionMode}
                  isPM={isPM}
                  onClick={() => onCardClick?.(item)}
                  onDuplicate={() => onDuplicate?.(item)}
                  delayConfig={config}
                />
              );
            })
          )}

          {/* Gradient fade at bottom */}
          {allItems.length > 3 && !gameMode?.isActive && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </div>
      </div>
    );
  }

  // For merged column with multiple stages
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-72 h-full flex-shrink-0 flex flex-col border-l-4 bg-background/50 transition-colors duration-150',
        stageColors[primaryStage],
        isOver && isDropAllowed && 'bg-primary/10 ring-2 ring-primary/30 ring-inset',
        isOver && !isDropAllowed && 'bg-red-500/10 ring-2 ring-red-500/50 ring-inset cursor-not-allowed',
        gameMode?.isActive && isCheckpoint && 'ring-2 ring-violet-500/50 ring-inset'
      )}
      style={!isDropAllowed && isOver ? { cursor: 'not-allowed' } : undefined}
    >
      {/* Column Header */}
      <div className={cn(
        "h-12 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 glass",
        gameMode?.isActive && isCheckpoint && "bg-violet-500/20"
      )}>
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm truncate">{columnTitle}</h3>
          {gameMode?.isActive && isCheckpoint && (
            <span className="text-violet-400">🎯</span>
          )}
        </div>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          gameMode?.isActive && isCheckpoint
            ? "bg-violet-500/30 text-violet-700 dark:text-violet-200"
            : "text-muted-foreground bg-slate-100 dark:bg-white/10"
        )}>
          {items.length}
        </span>
      </div>

      {/* Sub-regions for each stage */}
      <div className="flex-1 flex flex-col min-h-0">
        {mergedStages.map((stage, index) => {
          // Check if this is a system stage or custom stage
          const isSystemStage = Object.values(WorkflowStage).includes(stage as WorkflowStage);
          const systemStage = isSystemStage ? (stage as WorkflowStage) : null;

          // Filter items - only system stages can have items
          const stageItems = systemStage
            ? items.filter(item => item.currentStage === systemStage)
            : [];

          // Checkpoint check only applies to system stages
          const stageIsCheckpoint = gameMode?.isActive && systemStage
            ? gameMode.checkpoints.includes(systemStage)
            : false;

          // Get stage label for custom stages
          const stageLabel = !isSystemStage
            ? (stageConfigs?.find(sc => sc.stage === stage)?.customTitle || stage)
            : null;

          // For custom stages, render a simple header with the label
          if (!isSystemStage) {
            return (
              <div
                key={stage}
                className="flex-1 flex flex-col border-b border-white/5 dark:border-white/5 border-slate-100 last:border-b-0"
              >
                <div className="px-4 py-2 border-b border-white/5 dark:border-white/5 border-slate-100 bg-slate-500/10">
                  <span className="text-xs font-medium text-slate-400">
                    {stageLabel || stage}
                  </span>
                </div>
                <div className="flex-1 p-2">
                  <div className="text-xs text-muted-foreground text-center py-4">
                    自定义阶段
                  </div>
                </div>
              </div>
            );
          }

          return (
            <StageSubRegion
              key={stage}
              stage={systemStage!}
              items={stageItems}
              interactionMode={interactionMode}
              isPM={isPM}
              stageConfigs={stageConfigs}
              isLast={index === mergedStages.length - 1}
              gameMode={gameMode}
              isCheckpoint={stageIsCheckpoint}
              column={column}
              onCardClick={onCardClick}
              onDuplicate={onDuplicate}
              delayConfigs={delayConfigs}
            />
          );
        })}
      </div>
    </div>
  );
}
