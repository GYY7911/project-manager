'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { WorkflowStage } from '@pm/shared';

// localStorage key for game persistence
const GAME_STORAGE_KEY = 'pm-progress-game-state';
const MAX_HISTORY_STEPS = 30;

export interface GameItem {
  id: string;
  type: 'requirement' | 'issue';
  code: string;
  title: string;
  currentStage: WorkflowStage; // 主卡片当前位置
  initialStage: WorkflowStage; // 游戏开始时的初始位置（用于重置）
  lastConfirmedStage: WorkflowStage; // 上一个确认的位置（通过卡点后更新）
  assignee: { id: string; name: string };
  // 游戏状态
  shadowStages: WorkflowStage[]; // 影子所在的阶段列表（之前经过的阶段）
  isAdvancing: boolean; // 是否正在推进
  passedCheckpoints: WorkflowStage[]; // 已通过的卡点
  isExploding?: boolean; // 是否正在播放爆炸动画
  isReappearing?: boolean; // 是否正在播放重新出现动画（过卡点后在新位置出现）
  rowIndex: number; // 甘特图行号（固定，用于跨列水平对齐）
}

export interface GameState {
  isPlaying: boolean;
  checkpoints: WorkflowStage[];
  items: GameItem[];
  totalRows: number; // 甘特图总行数（用于布局计算）
  versionId?: string; // 用于区分不同版本的游戏状态
  wasSaved?: boolean; // 是否已保存（用于区分退出时是否保留卡片）
}

export interface UseProgressGameOptions {
  onUpdateStage: (id: string, newStage: WorkflowStage) => Promise<void>;
  onGameComplete?: (stats: { completed: number; total: number }) => void;
  onGameStartFailed?: (reason: 'all_checkpoints_passed' | 'no_items') => void;
}

// 获取阶段的顺序
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

function getStageIndex(stage: WorkflowStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function getNextStage(currentStage: WorkflowStage): WorkflowStage | null {
  const index = getStageIndex(currentStage);
  if (index < 0 || index >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[index + 1];
}

// 获取阶段在卡点之后的第一个阶段
function getStageAfterCheckpoint(checkpoint: WorkflowStage): WorkflowStage | null {
  return getNextStage(checkpoint);
}

// 深拷贝游戏状态
function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    checkpoints: [...state.checkpoints],
    items: state.items.map(item => ({
      ...item,
      shadowStages: [...item.shadowStages],
      passedCheckpoints: [...item.passedCheckpoints],
    })),
  };
}

export function useProgressGame({ onUpdateStage, onGameComplete, onGameStartFailed }: UseProgressGameOptions) {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    checkpoints: [],
    items: [],
    totalRows: 0,
  });

  const [celebrationState, setCelebrationState] = useState<{
    type: 'none' | 'item' | 'checkpoint' | 'complete';
    itemId?: string;
    checkpointIndex?: number;
  }>({ type: 'none' });

  // 操作历史栈（用于撤销）
  const historyRef = useRef<GameState[]>([]);

  // 保存当前状态到历史栈
  const saveToHistory = useCallback(() => {
    setGameState(prev => {
      const snapshot = cloneGameState(prev);
      historyRef.current.push(snapshot);
      // 限制历史栈大小
      if (historyRef.current.length > MAX_HISTORY_STEPS) {
        historyRef.current.shift();
      }
      return prev; // 不改变状态
    });
  }, []);

  // 持久化游戏状态到 localStorage
  const persistGameState = useCallback((state: GameState) => {
    try {
      const dataToSave = {
        ...state,
        items: state.items.map(item => ({
          id: item.id,
          type: item.type,
          code: item.code,
          title: item.title,
          currentStage: item.currentStage,
          initialStage: item.initialStage,
          lastConfirmedStage: item.lastConfirmedStage,
          assignee: item.assignee,
          shadowStages: item.shadowStages,
          passedCheckpoints: item.passedCheckpoints,
          rowIndex: item.rowIndex, // 甘特图行号
        })),
      };
      localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(dataToSave));
      console.log('[persistGameState] State saved');
    } catch (e) {
      console.error('[persistGameState] Failed to save:', e);
    }
  }, []);

  // 从 localStorage 加载游戏状态
  const loadPersistedState = useCallback((): GameState | null => {
    try {
      const saved = localStorage.getItem(GAME_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[loadPersistedState] State loaded:', parsed);
        return {
          ...parsed,
          wasSaved: parsed.wasSaved ?? false, // 兼容旧数据
          totalRows: parsed.totalRows || parsed.items?.length || 0, // 兼容旧数据
          items: parsed.items.map((item: any, index: number) => ({
            ...item,
            // 兼容旧数据：如果没有新字段，使用旧字段或当前阶段
            initialStage: item.initialStage || item.originalStage || item.currentStage,
            lastConfirmedStage: item.lastConfirmedStage || item.originalStage || item.currentStage,
            rowIndex: item.rowIndex ?? index, // 兼容旧数据：使用索引作为行号
            isAdvancing: false,
            isExploding: false,
          })),
        };
      }
    } catch (e) {
      console.error('[loadPersistedState] Failed to load:', e);
    }
    return null;
  }, []);

  // 清除持久化的游戏状态
  const clearPersistedState = useCallback(() => {
    try {
      localStorage.removeItem(GAME_STORAGE_KEY);
      console.log('[clearPersistedState] State cleared');
    } catch (e) {
      console.error('[clearPersistedState] Failed to clear:', e);
    }
  }, []);

  // 当游戏状态变化时自动持久化
  useEffect(() => {
    if (gameState.isPlaying && gameState.items.length > 0) {
      persistGameState(gameState);
    }
  }, [gameState, persistGameState]);

  // 获取卡片需要通过的下一个卡点
  const getNextCheckpointForItem = useCallback((itemId: string, items?: GameItem[], checkpoints?: WorkflowStage[]): WorkflowStage | null => {
    const itemList = items || gameState.items;
    const checkpointList = checkpoints || gameState.checkpoints;
    const item = itemList.find((i) => i.id === itemId);
    if (!item) {
      console.log('[getNextCheckpointForItem] Item not found:', itemId);
      return null;
    }

    // 找到该卡片尚未通过的第一个卡点
    for (const checkpoint of checkpointList) {
      if (!item.passedCheckpoints.includes(checkpoint)) {
        console.log('[getNextCheckpointForItem] Found next checkpoint:', {
          itemId,
          itemCode: item.code,
          itemType: item.type,
          currentStage: item.currentStage,
          nextCheckpoint: checkpoint,
          passedCheckpoints: item.passedCheckpoints,
        });
        return checkpoint;
      }
    }
    console.log('[getNextCheckpointForItem] All checkpoints passed:', {
      itemId,
      itemCode: item.code,
      passedCheckpoints: item.passedCheckpoints,
      allCheckpoints: checkpointList,
    });
    return null; // 所有卡点都已通过
  }, [gameState.items, gameState.checkpoints]);

  // 开始游戏
  const startGame = useCallback((
    checkpoints: WorkflowStage[],
    rawItems: Array<{
      id: string;
      type: 'requirement' | 'issue';
      code: string;
      title: string;
      currentStage: WorkflowStage;
      assignee: { id: string; name: string };
    }>,
    versionId?: string
  ) => {
    // 排序卡点按阶段顺序
    const sortedCheckpoints = [...checkpoints].sort(
      (a, b) => getStageIndex(a) - getStageIndex(b)
    );

    // 尝试加载持久化的状态
    const persistedState = loadPersistedState();

    // 检查卡点是否相同（用于决定是否恢复持久化状态）
    const checkpointsMatch = persistedState &&
      persistedState.checkpoints.length === sortedCheckpoints.length &&
      persistedState.checkpoints.every(cp => sortedCheckpoints.includes(cp));

    // 如果有持久化状态且版本ID匹配且卡点相同，恢复状态
    if (persistedState && persistedState.isPlaying && persistedState.versionId === versionId && checkpointsMatch) {
      console.log('[startGame] Found persisted state with matching checkpoints, restoring...');
      console.log('[startGame] Persisted state items:', persistedState.items.map(i => ({ id: i.id, code: i.code, type: i.type, currentStage: i.currentStage })));
      setGameState({
        ...persistedState,
        checkpoints: persistedState.checkpoints,
      });
      historyRef.current = [];
      return;
    }

    // 如果卡点不同，清除旧状态并开始新游戏
    if (persistedState && !checkpointsMatch) {
      console.log('[startGame] Checkpoints changed, clearing old state and starting new game');
      console.log('[startGame] Old checkpoints:', persistedState.checkpoints);
      console.log('[startGame] New checkpoints:', sortedCheckpoints);
      clearPersistedState();
    }

    console.log('[startGame] Starting new game with checkpoints:', sortedCheckpoints);

    // 转换为游戏项，并分配行号（用于甘特图水平对齐）
    const gameItems: GameItem[] = rawItems.map((item, index) => {
      console.log('[startGame] Processing item:', {
        code: item.code,
        type: item.type,
        currentStage: item.currentStage,
        stageIndex: getStageIndex(item.currentStage),
      });
      const passedCheckpoints = sortedCheckpoints.filter(
        (checkpoint) => getStageIndex(item.currentStage) > getStageIndex(checkpoint)
      );

      return {
        ...item,
        initialStage: item.currentStage, // 保存游戏开始时的位置（用于重置）
        lastConfirmedStage: item.currentStage, // 上一个确认位置
        shadowStages: [],
        isAdvancing: false,
        passedCheckpoints,
        isExploding: false,
        rowIndex: index, // 按初始顺序分配行号
      };
    });

    // 检查是否有项目需要推进
    const hasItemsToProcess = gameItems.some((item) =>
      sortedCheckpoints.some((cp) => !item.passedCheckpoints.includes(cp))
    );

    if (!hasItemsToProcess) {
      console.log('[startGame] All checkpoints already passed');
      onGameStartFailed?.('all_checkpoints_passed');
      return;
    }

    if (gameItems.length === 0) {
      console.log('[startGame] No items');
      onGameStartFailed?.('no_items');
      return;
    }

    console.log('[startGame] Starting new game:', {
      checkpoints: sortedCheckpoints,
      itemCount: gameItems.length,
      totalRows: gameItems.length,
    });

    // 清空历史栈
    historyRef.current = [];

    setGameState({
      isPlaying: true,
      checkpoints: sortedCheckpoints,
      items: gameItems,
      versionId,
      wasSaved: false, // 新游戏默认未保存
      totalRows: gameItems.length, // 甘特图总行数
    });
  }, [onGameStartFailed, loadPersistedState]);

  // 保存游戏状态 - 标记为已保存，卡片位置将被保留
  const saveGame = useCallback(() => {
    setGameState(prev => {
      console.log('[saveGame] Game state saved, cards will persist on board');
      return {
        ...prev,
        wasSaved: true,
      };
    });
  }, []);

  // 退出游戏 - 根据是否保存决定是否保留卡片
  const exitGame = useCallback((clearPersistence = false) => {
    if (clearPersistence) {
      clearPersistedState();
    }

    setGameState(prev => {
      if (prev.wasSaved) {
        // 已保存：保留 items 和 checkpoints 在看板上显示
        console.log('[exitGame] Game exited with save, cards preserved on board');
        return {
          ...prev,
          isPlaying: false,
        };
      } else {
        // 未保存：清除所有游戏状态，卡片从看板消失
        console.log('[exitGame] Game exited without save, clearing all game state');
        return {
          isPlaying: false,
          checkpoints: [],
          items: [],
          totalRows: 0,
          versionId: undefined,
          wasSaved: false,
        };
      }
    });
    setCelebrationState({ type: 'none' });
    historyRef.current = [];
  }, [clearPersistedState]);

  // 撤销上一步
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) {
      console.log('[undo] No history to undo');
      return false;
    }

    const previousState = historyRef.current.pop()!;
    console.log('[undo] Restoring previous state, remaining history:', historyRef.current.length);
    setGameState(previousState);
    return true;
  }, []);

  // 全部重置 - 重置所有卡片到游戏开始时的状态
  const resetAll = useCallback(() => {
    setGameState(prev => {
      // 重置所有卡片到游戏开始时的初始位置，清除所有推进
      const resetItems = prev.items.map(item => ({
        ...item,
        currentStage: item.initialStage, // 重置到游戏开始时的位置
        lastConfirmedStage: item.initialStage, // 重置确认位置
        shadowStages: [], // 清除所有影子
        passedCheckpoints: [], // 清除所有已通过的卡点
        isAdvancing: false,
        isExploding: false,
      }));

      console.log('[resetAll] All items reset to initial positions (game start)');
      return {
        ...prev,
        items: resetItems,
      };
    });
    // 清空历史栈
    historyRef.current = [];
  }, []);

  // 推进卡片 - 当前位置变成影子，卡片推进到新位置
  const advanceItem = useCallback((itemId: string) => {
    // 保存当前状态到历史
    saveToHistory();

    setGameState((prev) => {
      const item = prev.items.find((i) => i.id === itemId);
      if (!item) {
        console.warn('[advanceItem] Item not found:', itemId);
        return prev;
      }

      // 计算下一个阶段
      const nextStage = getNextStage(item.currentStage);

      if (!nextStage) {
        console.log('[advanceItem] No next stage, item is at end');
        return prev;
      }

      console.log('[advanceItem] Advancing:', {
        itemId,
        itemCode: item.code,
        itemType: item.type,
        from: item.currentStage,
        to: nextStage,
        newShadow: item.currentStage,
      });

      // 新逻辑：当前位置变成影子，卡片推进到新位置
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                currentStage: nextStage, // 主卡片移动到新位置
                shadowStages: [...i.shadowStages, item.currentStage], // 之前的位置变成影子
              }
            : i
        ),
      };
    });
  }, [saveToHistory]);

  // 通过卡点 - 确认推进，清除影子，调用后端API更新
  const passCheckpoint = useCallback(async (itemId: string) => {
    console.log('[passCheckpoint] Called with itemId:', itemId);

    // 获取该卡片的下一个卡点（独立判断）
    let nextCheckpoint: WorkflowStage | null = null;
    let targetStage: WorkflowStage | null = null;
    let currentStageSnapshot: WorkflowStage | null = null;

    setGameState((prev) => {
      const item = prev.items.find((i) => i.id === itemId);
      if (!item) {
        console.log('[passCheckpoint] Item not found:', itemId);
        return prev;
      }

      // 获取该卡片需要通过的下一个卡点
      nextCheckpoint = getNextCheckpointForItem(itemId, prev.items, prev.checkpoints);
      if (!nextCheckpoint) {
        console.log('[passCheckpoint] No next checkpoint for item');
        return prev;
      }

      // 目标阶段是卡点后的阶段
      targetStage = getStageAfterCheckpoint(nextCheckpoint);
      if (!targetStage) {
        console.log('[passCheckpoint] No target stage for checkpoint:', nextCheckpoint);
        return prev;
      }

      // 保存当前阶段快照
      currentStageSnapshot = item.currentStage;

      console.log('[passCheckpoint] Setting exploding state:', {
        itemId,
        nextCheckpoint,
        targetStage,
        currentStage: item.currentStage,
      });

      // 保存到历史（通过卡点前保存）
      const snapshot = cloneGameState(prev);
      historyRef.current.push(snapshot);
      if (historyRef.current.length > MAX_HISTORY_STEPS) {
        historyRef.current.shift();
      }

      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, isAdvancing: true, isExploding: true } : i
        ),
      };
    });

    setCelebrationState({ type: 'item', itemId });

    try {
      if (!targetStage || !nextCheckpoint || !currentStageSnapshot) return;

      // 调用后端API更新阶段 - 使用目标阶段（卡点后的阶段），与前端状态保持一致
      console.log('[passCheckpoint] Calling onUpdateStage:', { itemId, targetStage });
      await onUpdateStage(itemId, targetStage);
      console.log('[passCheckpoint] onUpdateStage completed');

      // 等待爆炸动画完成（0.8秒）
      await new Promise(resolve => setTimeout(resolve, 800));

      // 更新状态 - 清除影子，标记卡点已通过，主卡片移动到目标位置
      // 同时设置 isReappearing: true 让卡片在新位置以"出现"动画显示
      setGameState((prev) => {
        const updatedItems = prev.items.map((i) => {
          if (i.id !== itemId) return i;

          console.log('[passCheckpoint] Updating item:', {
            itemId,
            fromStage: i.currentStage,
            toStage: targetStage,
            clearedShadows: i.shadowStages,
          });

          return {
            ...i,
            currentStage: targetStage!, // 主卡片移动到目标位置（卡点后的阶段）
            isAdvancing: false,
            isExploding: false,
            isReappearing: true, // 设置重新出现状态，触发"出现"动画
            shadowStages: [], // 清除所有影子
            passedCheckpoints: [...i.passedCheckpoints, nextCheckpoint!],
            lastConfirmedStage: targetStage!, // 更新最后确认位置为目标位置
          };
        });

        console.log('[passCheckpoint] Item updated:', {
          itemId,
          currentStage: currentStageSnapshot,
          passedCheckpoint: nextCheckpoint,
        });

        // 检查游戏是否完成
        const allItemsCompleted = updatedItems.every((i) =>
          prev.checkpoints.every((cp) => i.passedCheckpoints.includes(cp))
        );

        if (allItemsCompleted) {
          setCelebrationState({ type: 'complete' });
          onGameComplete?.({
            completed: updatedItems.length,
            total: updatedItems.length,
          });
        }

        return {
          ...prev,
          items: updatedItems,
        };
      });

      // 500ms 后清除 isReappearing 状态（出现动画完成）
      setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId ? { ...i, isReappearing: false } : i
          ),
        }));
      }, 500);
    } catch (error) {
      console.error('[passCheckpoint] Error:', error);
      setGameState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, isAdvancing: false, isExploding: false } : i
        ),
      }));
    }
  }, [onUpdateStage, onGameComplete, getNextCheckpointForItem]);

  // 清除庆祝状态
  const clearCelebration = useCallback(() => {
    setCelebrationState({ type: 'none' });
  }, []);

  // 计算统计数据
  const stats = useMemo(() => {
    const total = gameState.items.length;
    const completed = gameState.items.filter(
      (item) => gameState.checkpoints.every((cp) => item.passedCheckpoints.includes(cp))
    ).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, progress };
  }, [gameState.items, gameState.checkpoints]);

  // 获取历史栈大小
  const historySize = historyRef.current.length;

  // 获取卡片是否在任何卡点 - 判断主卡片当前位置是否是卡点
  const isItemAtCheckpoint = useCallback((itemId: string) => {
    const item = gameState.items.find((i) => i.id === itemId);
    if (!item) return false;

    const nextCheckpoint = getNextCheckpointForItem(itemId);
    if (!nextCheckpoint) return false;

    // 主卡片当前位置是否等于下一个需要通过的卡点
    return item.currentStage === nextCheckpoint && !item.passedCheckpoints.includes(nextCheckpoint);
  }, [gameState.items, getNextCheckpointForItem]);

  // 其他辅助方法
  const getItemDisplayStages = useCallback((itemId: string): WorkflowStage[] => {
    const item = gameState.items.find((i) => i.id === itemId);
    if (!item) return [];
    return [item.currentStage, ...item.shadowStages];
  }, [gameState.items]);

  const getItemAdvancingState = useCallback((itemId: string) => {
    const item = gameState.items.find((i) => i.id === itemId);
    return item?.isAdvancing ?? false;
  }, [gameState.items]);

  const shouldItemShowAtStage = useCallback((itemId: string, stage: WorkflowStage): boolean => {
    const item = gameState.items.find((i) => i.id === itemId);
    if (!item) return false;
    return item.currentStage === stage || item.shadowStages.includes(stage);
  }, [gameState.items]);

  const isItemExploding = useCallback((itemId: string) => {
    const item = gameState.items.find((i) => i.id === itemId);
    return item?.isExploding ?? false;
  }, [gameState.items]);

  const getPassedCheckpointLabels = useCallback((itemId: string): string[] => {
    const item = gameState.items.find((i) => i.id === itemId);
    if (!item) return [];
    return item.passedCheckpoints.map((cp) => {
      const cpIndex = gameState.checkpoints.indexOf(cp);
      return `卡点${cpIndex + 1}✔`;
    });
  }, [gameState.items, gameState.checkpoints]);

  // 获取影子位置 - 0=主卡片在当前列，1+=影子在该列
  const getShadowPosition = useCallback((itemId: string, stage: WorkflowStage): number => {
    const item = gameState.items.find((i) => i.id === itemId);
    if (!item) return 0;

    // 如果是主卡片所在列
    if (item.currentStage === stage) return 0;

    // 如果是影子所在列，返回位置（1-based）
    const shadowIndex = item.shadowStages.indexOf(stage);
    if (shadowIndex >= 0) return shadowIndex + 1;

    return 0;
  }, [gameState.items]);

  return {
    // 状态
    gameState,
    celebrationState,
    stats,
    historySize,
    totalRows: gameState.totalRows || gameState.items.length, // 甘特图总行数

    // 方法
    startGame,
    exitGame,
    saveGame,
    advanceItem,
    passCheckpoint,
    clearCelebration,
    undo,
    resetAll,
    clearPersistedState,

    // 辅助
    isItemAtCheckpoint,
    getNextCheckpointForItem,
    getItemDisplayStages,
    getItemAdvancingState,
    shouldItemShowAtStage,
    isItemExploding,
    getPassedCheckpointLabels,
    getShadowPosition,
  };
}
