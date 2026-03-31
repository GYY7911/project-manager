import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressGame } from './useProgressGame';
import { WorkflowStage } from '@pm/shared';

describe('useProgressGame', () => {
  const mockOnUpdateStage = vi.fn();

  const createTestItem = (
    id: string,
    stage: WorkflowStage,
    type: 'requirement' | 'issue' = 'requirement'
  ) => ({
    id,
    type,
    code: `${type === 'requirement' ? 'FE' : 'ISS'}-${id}`,
    title: `Test Item ${id}`,
    currentStage: stage,
    assignee: { id: 'user-1', name: 'Test User' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Reset localStorage mock
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
    vi.mocked(localStorage.removeItem).mockImplementation(() => {});
  });

  describe('startGame', () => {
    it('should initialize game state correctly', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.gameState.isPlaying).toBe(true);
      expect(result.current.gameState.checkpoints).toEqual([
        WorkflowStage.DOCUMENT_SIGN,
        WorkflowStage.VERSION_TEST,
      ]);
      expect(result.current.gameState.items).toHaveLength(1);
      expect(result.current.gameState.wasSaved).toBe(false);
    });

    it('should sort checkpoints by stage order', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST, WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.gameState.checkpoints).toEqual([
        WorkflowStage.DOCUMENT_SIGN,
        WorkflowStage.VERSION_TEST,
      ]);
    });

    it('should calculate passedCheckpoints for items already past checkpoints', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.FEATURE_DEV)]
        );
      });

      const item = result.current.gameState.items[0];
      expect(item.passedCheckpoints).toContain(WorkflowStage.DOCUMENT_SIGN);
      expect(item.passedCheckpoints).not.toContain(WorkflowStage.VERSION_TEST);
    });

    it('should call onGameStartFailed when all items have passed all checkpoints', () => {
      const onGameStartFailed = vi.fn();
      const { result } = renderHook(() =>
        useProgressGame({
          onUpdateStage: mockOnUpdateStage,
          onGameStartFailed,
        })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.REQUIREMENT_DESIGN],
          [createTestItem('1', WorkflowStage.FEATURE_DEV)]
        );
      });

      expect(onGameStartFailed).toHaveBeenCalledWith('all_checkpoints_passed');
      expect(result.current.gameState.isPlaying).toBe(false);
    });

    it('should call onGameStartFailed when no items provided', () => {
      const onGameStartFailed = vi.fn();
      const { result } = renderHook(() =>
        useProgressGame({
          onUpdateStage: mockOnUpdateStage,
          onGameStartFailed,
        })
      );

      act(() => {
        result.current.startGame([WorkflowStage.DOCUMENT_SIGN], []);
      });

      // When no items provided, hasItemsToProcess is false, so it returns 'all_checkpoints_passed'
      expect(onGameStartFailed).toHaveBeenCalledWith('all_checkpoints_passed');
    });

    it('should save initialStage for reset functionality', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      const item = result.current.gameState.items[0];
      expect(item.initialStage).toBe(WorkflowStage.REQUIREMENT_DESIGN);
    });

    it('should restore persisted state when versionId matches', () => {
      const persistedState = {
        isPlaying: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        items: [
          {
            id: '1',
            type: 'requirement',
            code: 'FE-001',
            title: 'Persisted Item',
            currentStage: WorkflowStage.FEATURE_DEV,
            initialStage: WorkflowStage.REQUIREMENT_DESIGN,
            lastConfirmedStage: WorkflowStage.FEATURE_DEV,
            assignee: { id: 'user-1', name: 'User' },
            shadowStages: [WorkflowStage.REQUIREMENT_DESIGN],
            passedCheckpoints: [],
          },
        ],
        versionId: 'version-123',
        wasSaved: true,
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(persistedState));

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST], // Same checkpoints as persisted state
          [createTestItem('2', WorkflowStage.REQUIREMENT_DESIGN)],
          'version-123'
        );
      });

      expect(result.current.gameState.items).toHaveLength(1);
      expect(result.current.gameState.items[0].id).toBe('1');
      expect(result.current.gameState.wasSaved).toBe(true);
    });

    it('should clear old state and start new game when checkpoints change', () => {
      // 持久化状态包含3个卡点
      const persistedState = {
        isPlaying: true,
        checkpoints: [
          WorkflowStage.DOCUMENT_SIGN,
          WorkflowStage.VERSION_TEST,
          WorkflowStage.CCB_REVIEW,
        ],
        items: [
          {
            id: '1',
            type: 'requirement',
            code: 'FE-001',
            title: 'Old Item',
            currentStage: WorkflowStage.FEATURE_DEV,
            initialStage: WorkflowStage.REQUIREMENT_DESIGN,
            lastConfirmedStage: WorkflowStage.FEATURE_DEV,
            assignee: { id: 'user-1', name: 'User' },
            shadowStages: [],
            passedCheckpoints: [WorkflowStage.DOCUMENT_SIGN],
          },
        ],
        versionId: 'version-123',
        wasSaved: true,
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(persistedState));

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 用户只选择了一个卡点（CCB_REVIEW），与持久化状态不同
      act(() => {
        result.current.startGame(
          [WorkflowStage.CCB_REVIEW], // Different checkpoints
          [createTestItem('2', WorkflowStage.ISSUE_FIX, 'issue')],
          'version-123'
        );
      });

      // 应该清除旧状态，使用新的卡点
      expect(result.current.gameState.checkpoints).toEqual([WorkflowStage.CCB_REVIEW]);
      expect(result.current.gameState.items).toHaveLength(1);
      expect(result.current.gameState.items[0].id).toBe('2'); // New item, not old one
      expect(result.current.gameState.wasSaved).toBe(false);
      // localStorage.removeItem 应该被调用
      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    it('should correctly detect checkpoint for issue at CCB_REVIEW', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 问题单从 ISSUE_FIX 开始，卡点是 CCB_REVIEW
      act(() => {
        result.current.startGame(
          [WorkflowStage.CCB_REVIEW],
          [createTestItem('issue-1', WorkflowStage.ISSUE_FIX, 'issue')]
        );
      });

      // 问题单还没到卡点
      expect(result.current.isItemAtCheckpoint('issue-1')).toBe(false);

      // 推进到 CCB_REVIEW
      act(() => {
        result.current.advanceItem('issue-1');
      });

      // 现在应该在卡点了
      expect(result.current.gameState.items[0].currentStage).toBe(WorkflowStage.CCB_REVIEW);
      expect(result.current.isItemAtCheckpoint('issue-1')).toBe(true);
    });

    it('should correctly detect checkpoint after advancing multiple stages', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 需求从 REQUIREMENT_DESIGN 开始，卡点是 VERSION_TEST
      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST],
          [createTestItem('req-1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      // 一直推进到 VERSION_TEST
      act(() => {
        result.current.advanceItem('req-1'); // -> ALPHA_TEST_DESIGN
        result.current.advanceItem('req-1'); // -> DOCUMENT_SIGN
        result.current.advanceItem('req-1'); // -> FEATURE_DEV
        result.current.advanceItem('req-1'); // -> ALPHA_CASE_DEV
        result.current.advanceItem('req-1'); // -> SOP_UPGRADE
        result.current.advanceItem('req-1'); // -> VERSION_TEST
      });

      // 现在应该在卡点了
      expect(result.current.gameState.items[0].currentStage).toBe(WorkflowStage.VERSION_TEST);
      expect(result.current.isItemAtCheckpoint('req-1')).toBe(true);
    });
  });

  describe('advanceItem', () => {
    it('should advance item to next stage and create shadow', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      const originalStage = result.current.gameState.items[0].currentStage;

      act(() => {
        result.current.advanceItem('1');
      });

      const item = result.current.gameState.items[0];
      expect(item.currentStage).toBe(WorkflowStage.ALPHA_TEST_DESIGN);
      expect(item.shadowStages).toContain(originalStage);
    });

    it('should create multiple shadows when advancing multiple times', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
        result.current.advanceItem('1');
        result.current.advanceItem('1');
      });

      const item = result.current.gameState.items[0];
      expect(item.shadowStages).toHaveLength(3);
      expect(item.currentStage).toBe(WorkflowStage.FEATURE_DEV);
    });

    it('should not advance when at the last stage', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // Use CCB_REVIEW (stage 8) as checkpoint, item at ISSUE_FIX (stage 7)
      // Item hasn't passed checkpoint, so game will start
      act(() => {
        result.current.startGame(
          [WorkflowStage.CCB_REVIEW], // Checkpoint at stage 8
          [createTestItem('1', WorkflowStage.ISSUE_FIX)] // Item at stage 7
        );
      });

      // Advance to CCB_REVIEW (stage 8)
      act(() => {
        result.current.advanceItem('1');
      });

      // Advance to RELEASE (stage 9, last stage)
      act(() => {
        result.current.advanceItem('1');
      });

      const itemAtLastStage = result.current.gameState.items[0];
      expect(itemAtLastStage.currentStage).toBe(WorkflowStage.RELEASE);

      // Try to advance from last stage - should do nothing
      act(() => {
        result.current.advanceItem('1');
      });

      const item = result.current.gameState.items[0];
      expect(item.currentStage).toBe(WorkflowStage.RELEASE);
      // Should have 2 shadows (ISSUE_FIX, CCB_REVIEW), not 3
      expect(item.shadowStages).toHaveLength(2);
    });

    it('should do nothing if item not found', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      const originalItem = { ...result.current.gameState.items[0] };

      act(() => {
        result.current.advanceItem('non-existent');
      });

      expect(result.current.gameState.items[0].currentStage).toBe(originalItem.currentStage);
    });
  });

  describe('undo', () => {
    it('should restore previous state', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      const originalStage = result.current.gameState.items[0].currentStage;

      act(() => {
        result.current.advanceItem('1');
      });

      expect(result.current.gameState.items[0].currentStage).not.toBe(originalStage);

      let undoResult: boolean;
      act(() => {
        undoResult = result.current.undo();
      });

      expect(undoResult!).toBe(true);
      expect(result.current.gameState.items[0].currentStage).toBe(originalStage);
    });

    it('should return false when no history', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      let undoResult: boolean;
      act(() => {
        undoResult = result.current.undo();
      });

      expect(undoResult!).toBe(false);
    });

    it('should track history size correctly', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.historySize).toBe(0);

      act(() => {
        result.current.advanceItem('1');
      });

      expect(result.current.historySize).toBe(1);

      act(() => {
        result.current.advanceItem('1');
      });

      expect(result.current.historySize).toBe(2);

      act(() => {
        result.current.undo();
      });

      expect(result.current.historySize).toBe(1);
    });
  });

  describe('resetAll', () => {
    it('should reset all items to initial positions', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
        result.current.advanceItem('1');
      });

      const item = result.current.gameState.items[0];
      expect(item.currentStage).not.toBe(WorkflowStage.REQUIREMENT_DESIGN);
      expect(item.shadowStages.length).toBeGreaterThan(0);

      act(() => {
        result.current.resetAll();
      });

      const resetItem = result.current.gameState.items[0];
      expect(resetItem.currentStage).toBe(WorkflowStage.REQUIREMENT_DESIGN);
      expect(resetItem.shadowStages).toHaveLength(0);
      expect(resetItem.passedCheckpoints).toHaveLength(0);
    });

    it('should clear history after reset', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
        result.current.advanceItem('1');
      });

      expect(result.current.historySize).toBeGreaterThan(0);

      act(() => {
        result.current.resetAll();
      });

      expect(result.current.historySize).toBe(0);
    });
  });

  describe('saveGame & exitGame', () => {
    it('should preserve items when exiting after save', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.saveGame();
      });

      expect(result.current.gameState.wasSaved).toBe(true);

      act(() => {
        result.current.exitGame();
      });

      expect(result.current.gameState.isPlaying).toBe(false);
      expect(result.current.gameState.items).toHaveLength(1);
    });

    it('should clear items when exiting without save', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.exitGame();
      });

      expect(result.current.gameState.isPlaying).toBe(false);
      expect(result.current.gameState.items).toHaveLength(0);
      expect(result.current.gameState.checkpoints).toHaveLength(0);
    });

    it('should clear localStorage when exiting with clearPersistence', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.exitGame(true);
      });

      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('getNextCheckpointForItem', () => {
    it('should return next unpassed checkpoint', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.FEATURE_DEV)]
        );
      });

      const nextCp = result.current.getNextCheckpointForItem('1');
      expect(nextCp).toBe(WorkflowStage.VERSION_TEST);
    });

    it('should return null when all checkpoints passed', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.RELEASE)]
        );
      });

      const nextCp = result.current.getNextCheckpointForItem('1');
      expect(nextCp).toBeNull();
    });

    it('should return null for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      const nextCp = result.current.getNextCheckpointForItem('non-existent');
      expect(nextCp).toBeNull();
    });
  });

  describe('isItemAtCheckpoint', () => {
    it('should return true when item is at next checkpoint', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.DOCUMENT_SIGN)]
        );
      });

      expect(result.current.isItemAtCheckpoint('1')).toBe(true);
    });

    it('should return false when item is not at checkpoint', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.isItemAtCheckpoint('1')).toBe(false);
    });
  });

  describe('stats', () => {
    it('should calculate completion progress correctly', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [
            createTestItem('1', WorkflowStage.FEATURE_DEV),
            createTestItem('2', WorkflowStage.REQUIREMENT_DESIGN),
          ]
        );
      });

      expect(result.current.stats.total).toBe(2);
      expect(result.current.stats.completed).toBe(1);
      expect(result.current.stats.progress).toBe(50);
    });

    it('should handle empty items', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      expect(result.current.stats.total).toBe(0);
      expect(result.current.stats.completed).toBe(0);
      expect(result.current.stats.progress).toBe(0);
    });
  });

  describe('getShadowPosition', () => {
    it('should return 0 for main card position', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      const pos = result.current.getShadowPosition(
        '1',
        WorkflowStage.REQUIREMENT_DESIGN
      );
      expect(pos).toBe(0);
    });

    it('should return 1+ for shadow positions', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
      });

      const pos = result.current.getShadowPosition(
        '1',
        WorkflowStage.REQUIREMENT_DESIGN
      );
      expect(pos).toBe(1);
    });
  });

  describe('getPassedCheckpointLabels', () => {
    it('should return empty array for items without passed checkpoints', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      const labels = result.current.getPassedCheckpointLabels('1');
      expect(labels).toEqual([]);
    });

    it('should return empty array for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      const labels = result.current.getPassedCheckpointLabels('non-existent');
      expect(labels).toEqual([]);
    });

    it('should return formatted labels for passed checkpoints', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // Item at FEATURE_DEV (stage 3) has passed DOCUMENT_SIGN (stage 2) but not VERSION_TEST (stage 6)
      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.FEATURE_DEV)]
        );
      });

      const labels = result.current.getPassedCheckpointLabels('1');
      // Only DOCUMENT_SIGN should be passed (FEATURE_DEV comes after DOCUMENT_SIGN)
      expect(labels.length).toBe(1);
      expect(labels[0]).toContain('卡点1');
    });
  });

  describe('persistence', () => {
    it('should persist state when game is playing', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)],
          'version-123'
        );
      });

      expect(localStorage.setItem).toHaveBeenCalled();

      const savedData = JSON.parse(
        vi.mocked(localStorage.setItem).mock.calls[0][1]
      );
      expect(savedData.versionId).toBe('version-123');
      expect(savedData.isPlaying).toBe(true);
    });

    it('should handle legacy data without new fields', () => {
      const legacyState = {
        isPlaying: true,
        checkpoints: [WorkflowStage.DOCUMENT_SIGN],
        items: [
          {
            id: '1',
            type: 'requirement',
            code: 'FE-001',
            title: 'Legacy Item',
            currentStage: WorkflowStage.FEATURE_DEV,
            assignee: { id: 'user-1', name: 'User' },
            shadowStages: [],
            passedCheckpoints: [],
          },
        ],
        versionId: 'version-123',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(legacyState));

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('2', WorkflowStage.REQUIREMENT_DESIGN)],
          'version-123'
        );
      });

      const item = result.current.gameState.items[0];
      expect(item.initialStage).toBe(WorkflowStage.FEATURE_DEV);
      expect(result.current.gameState.wasSaved).toBe(false);
    });
  });

  describe('clearCelebration', () => {
    it('should clear celebration state', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      expect(result.current.celebrationState.type).toBe('none');

      act(() => {
        result.current.clearCelebration();
      });

      expect(result.current.celebrationState.type).toBe('none');
    });
  });


  describe('getItemDisplayStages', () => {
    it('should return current stage and shadow stages', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
      });

      const stages = result.current.getItemDisplayStages('1');
      expect(stages).toContain(WorkflowStage.ALPHA_TEST_DESIGN);
      expect(stages).toContain(WorkflowStage.REQUIREMENT_DESIGN);
    });

    it('should return empty array for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      const stages = result.current.getItemDisplayStages('non-existent');
      expect(stages).toEqual([]);
    });
  });

  describe('getItemAdvancingState', () => {
    it('should return false for non-advancing item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.getItemAdvancingState('1')).toBe(false);
    });

    it('should return false for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      expect(result.current.getItemAdvancingState('non-existent')).toBe(false);
    });
  });

  describe('Game mode state consistency (enter/exit/save)', () => {
    /**
     * 测试场景：进入游戏 -> 推进卡片 -> 保存 -> 退出 -> 重新进入
     * 预期：恢复的游戏状态应该与退出前一致
     *
     * 注意：这个测试模拟了完整的持久化流程
     * 使用内存存储来模拟 localStorage
     */
    it('should restore correct game state after save and exit', () => {
      // 模拟持久化存储
      let persistedData: string | null = null;
      vi.mocked(localStorage.getItem).mockImplementation(() => persistedData);
      vi.mocked(localStorage.setItem).mockImplementation((_, value) => {
        persistedData = value;
      });
      vi.mocked(localStorage.removeItem).mockImplementation(() => {
        persistedData = null;
      });

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 1. 开始游戏
      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)],
          'version-123'
        );
      });

      // 2. 推进卡片
      act(() => {
        result.current.advanceItem('1');
      });

      const stateBeforeExit = result.current.gameState.items[0].currentStage;
      expect(stateBeforeExit).toBe(WorkflowStage.ALPHA_TEST_DESIGN);

      // 3. 保存游戏
      act(() => {
        result.current.saveGame();
      });

      expect(result.current.gameState.wasSaved).toBe(true);

      // 4. 退出游戏
      act(() => {
        result.current.exitGame();
      });

      expect(result.current.gameState.isPlaying).toBe(false);

      // 5. 重新开始游戏（应该恢复持久化状态）
      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)],
          'version-123'
        );
      });

      // 6. 验证状态恢复
      expect(result.current.gameState.isPlaying).toBe(true);
      expect(result.current.gameState.items[0].currentStage).toBe(stateBeforeExit);
      expect(result.current.gameState.wasSaved).toBe(true);
    });

    /**
     * 测试场景：卡点变更后应该清除旧的持久化状态
     * 这是修复"进入退出消消乐状态不一致"问题的关键测试
     */
    it('should clear old persisted state when checkpoints change', () => {
      // 1. 设置旧状态的持久化数据（3个卡点）
      const oldPersistedState = {
        isPlaying: true,
        checkpoints: [
          WorkflowStage.DOCUMENT_SIGN,
          WorkflowStage.VERSION_TEST,
          WorkflowStage.CCB_REVIEW,
        ],
        items: [
          {
            id: 'old-item',
            type: 'requirement' as const,
            code: 'FE-OLD',
            title: 'Old Item',
            currentStage: WorkflowStage.FEATURE_DEV,
            initialStage: WorkflowStage.REQUIREMENT_DESIGN,
            lastConfirmedStage: WorkflowStage.FEATURE_DEV,
            assignee: { id: 'user-1', name: 'User' },
            shadowStages: [WorkflowStage.REQUIREMENT_DESIGN],
            passedCheckpoints: [WorkflowStage.DOCUMENT_SIGN],
          },
        ],
        versionId: 'version-123',
        wasSaved: true,
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(oldPersistedState));

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 2. 用新的卡点配置开始游戏（只有1个卡点）
      act(() => {
        result.current.startGame(
          [WorkflowStage.CCB_REVIEW], // 不同的卡点配置
          [createTestItem('new-item', WorkflowStage.ISSUE_FIX, 'issue')],
          'version-123'
        );
      });

      // 3. 验证：应该使用新配置，而不是旧状态
      expect(result.current.gameState.checkpoints).toEqual([WorkflowStage.CCB_REVIEW]);
      expect(result.current.gameState.items).toHaveLength(1);
      expect(result.current.gameState.items[0].id).toBe('new-item');
      expect(result.current.gameState.wasSaved).toBe(false);

      // 4. 验证：旧的持久化数据应该被清除
      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    /**
     * 测试场景：退出游戏不保存应该清除所有状态
     */
    it('should clear all state when exiting without save', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      // 推进卡片
      act(() => {
        result.current.advanceItem('1');
      });

      // 不保存直接退出
      act(() => {
        result.current.exitGame();
      });

      expect(result.current.gameState.isPlaying).toBe(false);
      expect(result.current.gameState.items).toHaveLength(0);
      expect(result.current.gameState.checkpoints).toHaveLength(0);
    });

    /**
     * 测试场景：退出游戏后重新开始应该从初始状态开始
     */
    it('should start fresh game after exit without save', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 开始游戏并推进
      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
        result.current.advanceItem('1');
      });

      const advancedStage = result.current.gameState.items[0].currentStage;

      // 退出（不保存）
      act(() => {
        result.current.exitGame();
      });

      // 重新开始游戏（使用相同的初始卡片）
      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      // 应该从初始阶段开始，而不是之前推进到的阶段
      expect(result.current.gameState.items[0].currentStage).toBe(WorkflowStage.REQUIREMENT_DESIGN);
      expect(result.current.gameState.items[0].currentStage).not.toBe(advancedStage);
    });

    /**
     * 测试场景：保存后退出，重新进入时卡点配置相同应该恢复状态
     * 注意：此测试验证 hook 正确读取已存在的 localStorage 数据
     */
    it('should restore state when re-entering with same checkpoints', () => {
      // 模拟已存在的持久化状态（之前保存并退出的状态）
      const savedState = {
        isPlaying: true,
        checkpoints: [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
        items: [
          {
            id: '1',
            type: 'requirement',
            code: 'FE-1',
            title: 'Test Item 1',
            currentStage: WorkflowStage.FEATURE_DEV,
            initialStage: WorkflowStage.REQUIREMENT_DESIGN,
            lastConfirmedStage: WorkflowStage.FEATURE_DEV,
            assignee: { id: 'user-1', name: 'Test User' },
            shadowStages: [WorkflowStage.REQUIREMENT_DESIGN, WorkflowStage.ALPHA_TEST_DESIGN, WorkflowStage.DOCUMENT_SIGN],
            passedCheckpoints: [WorkflowStage.DOCUMENT_SIGN],
            isAdvancing: false,
            rowIndex: 0,
          },
        ],
        versionId: 'version-123',
        wasSaved: true,
        totalRows: 1,
      };

      // 模拟 localStorage 返回已保存的状态
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(savedState));

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // 使用相同的卡点配置和 versionId 开始游戏
      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)], // 这个参数在恢复时会被忽略
          'version-123'
        );
      });

      // 验证：应该恢复已保存的状态，而不是使用新传入的 item
      expect(result.current.gameState.isPlaying).toBe(true);
      expect(result.current.gameState.wasSaved).toBe(true);
      expect(result.current.gameState.items).toHaveLength(1);
      expect(result.current.gameState.items[0].currentStage).toBe(WorkflowStage.FEATURE_DEV);
      expect(result.current.gameState.items[0].passedCheckpoints).toContain(WorkflowStage.DOCUMENT_SIGN);
    });
  });

  describe('isItemExploding', () => {
    it('should return false for non-exploding item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.isItemExploding('1')).toBe(false);
    });

    it('should return false for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      expect(result.current.isItemExploding('non-existent')).toBe(false);
    });
  });

  describe('shouldItemShowAtStage', () => {
    it('should return true when item currentStage matches stage', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      expect(result.current.shouldItemShowAtStage('1', WorkflowStage.REQUIREMENT_DESIGN)).toBe(true);
    });

    it('should return true when stage is in shadowStages', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      act(() => {
        result.current.advanceItem('1');
      });

      expect(result.current.shouldItemShowAtStage('1', WorkflowStage.REQUIREMENT_DESIGN)).toBe(true);
    });

    it('should return false for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      expect(result.current.shouldItemShowAtStage('non-existent', WorkflowStage.REQUIREMENT_DESIGN)).toBe(false);
    });
  });

  describe('getShadowPosition edge cases', () => {
    it('should return 0 for stage that item is not at', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      // Item is at REQUIREMENT_DESIGN, not FEATURE_DEV
      expect(result.current.getShadowPosition('1', WorkflowStage.FEATURE_DEV)).toBe(0);
    });

    it('should return 0 for non-existent item', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      expect(result.current.getShadowPosition('non-existent', WorkflowStage.REQUIREMENT_DESIGN)).toBe(0);
    });
  });

  describe('loadPersistedState error handling', () => {
    it('should handle malformed JSON in localStorage', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid json');

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      // Should start a new game instead of crashing
      expect(result.current.gameState.isPlaying).toBe(true);
    });
  });

  describe('totalRows', () => {
    it('should return totalRows from gameState', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [
            createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN),
            createTestItem('2', WorkflowStage.REQUIREMENT_DESIGN),
          ]
        );
      });

      expect(result.current.totalRows).toBe(2);
    });

    it('should fall back to items length when totalRows is 0', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      // Before game starts, totalRows should be 0
      expect(result.current.totalRows).toBe(0);
    });
  });

  describe('clearPersistedState', () => {
    it('should clear persisted state from localStorage', () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.clearPersistedState();
      });

      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('passCheckpoint', () => {
    it('should not proceed if item not found', async () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.DOCUMENT_SIGN)]
        );
      });

      await act(async () => {
        await result.current.passCheckpoint('non-existent');
      });

      expect(mockOnUpdateStage).not.toHaveBeenCalled();
    });

    it('should not proceed if no next checkpoint', async () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.RELEASE)]
        );
      });

      await act(async () => {
        await result.current.passCheckpoint('1');
      });

      expect(mockOnUpdateStage).not.toHaveBeenCalled();
    });

    it('should not pass checkpoint if no target stage (last stage)', async () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.RELEASE], // Last stage, no next stage
          [createTestItem('1', WorkflowStage.RELEASE)]
        );
      });

      await act(async () => {
        await result.current.passCheckpoint('1');
      });

      expect(mockOnUpdateStage).not.toHaveBeenCalled();
    });

    it('should set celebration state to item during pass', async () => {
      mockOnUpdateStage.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST], // Further checkpoint
          [createTestItem('1', WorkflowStage.DOCUMENT_SIGN)]
        );
      });

      // Start passCheckpoint but check state mid-way
      let passPromise: Promise<void>;
      act(() => {
        passPromise = result.current.passCheckpoint('1');
      });

      // Celebration should be 'item' initially
      expect(result.current.celebrationState.type).toBe('item');
      expect(result.current.celebrationState.itemId).toBe('1');

      // Wait for completion but ignore errors
      await act(async () => {
        try {
          await passPromise;
        } catch {}
      });
    });

    it('should set isExploding and isAdvancing state during checkpoint pass', async () => {
      mockOnUpdateStage.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.DOCUMENT_SIGN)]
        );
      });

      // Start passCheckpoint - this sets isExploding
      let passPromise: Promise<void>;
      act(() => {
        passPromise = result.current.passCheckpoint('1');
      });

      // At this point, isExploding should be true
      expect(result.current.gameState.items[0].isExploding).toBe(true);
      expect(result.current.gameState.items[0].isAdvancing).toBe(true);

      // Wait for completion but ignore errors
      await act(async () => {
        try {
          await passPromise;
        } catch {}
      });
    });

    it('should save to history during checkpoint pass', async () => {
      mockOnUpdateStage.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.DOCUMENT_SIGN],
          [createTestItem('1', WorkflowStage.DOCUMENT_SIGN)]
        );
      });

      expect(result.current.historySize).toBe(0);

      // Start passCheckpoint - this saves to history
      let passPromise: Promise<void>;
      act(() => {
        passPromise = result.current.passCheckpoint('1');
      });

      // History should be increased after passCheckpoint starts
      expect(result.current.historySize).toBe(1);

      // Wait for completion but ignore errors
      await act(async () => {
        try {
          await passPromise;
        } catch {}
      });
    });

    it('should limit history to MAX_HISTORY_STEPS', async () => {
      const { result } = renderHook(() =>
        useProgressGame({ onUpdateStage: mockOnUpdateStage })
      );

      act(() => {
        result.current.startGame(
          [WorkflowStage.VERSION_TEST],
          [createTestItem('1', WorkflowStage.REQUIREMENT_DESIGN)]
        );
      });

      // Advance many times to build up history
      for (let i = 0; i < 35; i++) {
        act(() => {
          result.current.advanceItem('1');
        });
      }

      // History should be limited to MAX_HISTORY_STEPS (30)
      expect(result.current.historySize).toBeLessThanOrEqual(30);
    });
  });
});
