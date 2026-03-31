import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowStage } from '@pm/shared';
import { StageColumn } from './StageColumn';

// Mock the dnd-kit hooks
vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...rest }: any) => <div {...rest}>{children}</div>),
  },
  AnimatePresence: vi.fn(({ children }: any) => children),
}));

// Mock KanbanCard component
vi.mock('./KanbanCard', () => ({
  KanbanCard: vi.fn(({ item }) => (
    <div data-testid={`kanban-card-${item.id}`} data-item-id={item.id}>
      {item.code} - {item.title}
    </div>
  )),
}));

// Mock GameCard component
vi.mock('@/components/progress-game', () => {
  const COLUMN_COLORS: Record<string, string> = {
    'REQUIREMENT_DESIGN': '#3b82f6',
    'ALPHA_TEST_DESIGN': '#8b5cf6',
    'DOCUMENT_SIGN': '#f59e0b',
    'FEATURE_DEV': '#10b981',
    'ALPHA_CASE_DEV': '#06b6d4',
    'SOP_UPGRADE': '#ec4899',
    'VERSION_TEST': '#6366f1',
    'ISSUE_FIX': '#ef4444',
    'CCB_REVIEW': '#f97316',
    'RELEASE': '#22c55e',
  };

  return {
    GameCard: vi.fn(({ id, code, title, isShadow, onAdvance, onPassCheckpoint }) => (
      <div
        data-testid={`game-card-${id}${isShadow ? '-shadow' : ''}`}
        data-item-id={id}
        data-is-shadow={isShadow}
      >
        {code} - {title}
        <button data-testid={`advance-${id}`} onClick={onAdvance}>Advance</button>
        <button data-testid={`checkpoint-${id}`} onClick={onPassCheckpoint}>Checkpoint</button>
      </div>
    )),
    COLUMN_COLORS,
  };
});

describe('StageColumn', () => {
  const mockColumn = {
    id: 'col-test',
    title: 'Test Column',
    stage: WorkflowStage.VERSION_TEST,
    stages: [WorkflowStage.VERSION_TEST],
    isDynamic: false,
  };

  const mockDynamicColumn = {
    id: 'col-test-cycle-1',
    title: '转测1',
    stage: WorkflowStage.VERSION_TEST,
    stages: [WorkflowStage.VERSION_TEST],
    isDynamic: true,
    testCycleId: 'test-cycle-1',
  };

  const mockMergedColumn = {
    id: 'col-merged',
    title: 'Merged Column',
    stage: WorkflowStage.FEATURE_DEV,
    stages: [WorkflowStage.FEATURE_DEV, WorkflowStage.ALPHA_CASE_DEV],
    isDynamic: false,
  };

  const createMockItem = (
    id: string,
    stage: WorkflowStage,
    type: 'requirement' | 'issue' = 'requirement',
    testCycleId?: string
  ) => ({
    id,
    type,
    code: `${type === 'requirement' ? 'FE' : 'ISS'}-${id}`,
    title: `Test Item ${id}`,
    status: 'IN_PROGRESS',
    currentStage: stage,
    assignee: { id: 'user-1', name: 'Test User', employeeNo: '001' },
    testCycleId,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Non-game mode filtering', () => {
    it('should filter items by currentStage in non-game mode', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST),
        createMockItem('2', WorkflowStage.FEATURE_DEV),
        createMockItem('3', WorkflowStage.VERSION_TEST),
      ];

      render(
        <StageColumn
          column={mockColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-3')).toBeInTheDocument();
      expect(screen.queryByTestId('kanban-card-2')).not.toBeInTheDocument();
    });

    it('should filter by testCycleId for dynamic columns in non-game mode', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
        createMockItem('3', WorkflowStage.VERSION_TEST, 'requirement'),
        createMockItem('4', WorkflowStage.FEATURE_DEV, 'issue', 'test-cycle-1'),
      ];

      render(
        <StageColumn
          column={mockDynamicColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      // Issue with matching testCycleId should show
      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      // Issue with different testCycleId should not show
      expect(screen.queryByTestId('kanban-card-2')).not.toBeInTheDocument();
      // Requirements with VERSION_TEST stage should show in dynamic columns (to prevent disappearing)
      expect(screen.getByTestId('kanban-card-3')).toBeInTheDocument();
      // Issue with different stage should not show
      expect(screen.queryByTestId('kanban-card-4')).not.toBeInTheDocument();
    });

    it('should render empty column without errors', () => {
      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByText('Test Column')).toBeInTheDocument();
      expect(screen.queryByTestId(/kanban-card-/)).not.toBeInTheDocument();
    });
  });

  describe('Merged column rendering', () => {
    it('should render merged column with multiple sub-regions', () => {
      const items = [
        createMockItem('1', WorkflowStage.FEATURE_DEV),
        createMockItem('2', WorkflowStage.ALPHA_CASE_DEV),
        createMockItem('3', WorkflowStage.FEATURE_DEV),
      ];

      render(
        <StageColumn
          column={mockMergedColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-3')).toBeInTheDocument();
    });

    it('should render merged column with only one stage having items', () => {
      const items = [
        createMockItem('1', WorkflowStage.FEATURE_DEV),
      ];

      render(
        <StageColumn
          column={mockMergedColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
    });
  });

  describe('Sorting behavior', () => {
    it('should sort items with issues before requirements', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST, 'requirement'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'issue'),
        createMockItem('3', WorkflowStage.VERSION_TEST, 'requirement'),
      ];

      render(
        <StageColumn
          column={mockColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      const cards = screen.getAllByTestId(/kanban-card-/);
      expect(cards[0]).toHaveTextContent('ISS-2');
      expect(cards[1]).toHaveTextContent('FE-1');
      expect(cards[2]).toHaveTextContent('FE-3');
    });

    it('should sort items by code within same type', () => {
      const items = [
        createMockItem('3', WorkflowStage.VERSION_TEST, 'requirement'),
        createMockItem('1', WorkflowStage.VERSION_TEST, 'requirement'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'requirement'),
      ];

      render(
        <StageColumn
          column={mockColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      const cards = screen.getAllByTestId(/kanban-card-/);
      expect(cards[0]).toHaveTextContent('FE-1');
      expect(cards[1]).toHaveTextContent('FE-2');
      expect(cards[2]).toHaveTextContent('FE-3');
    });
  });

  describe('Dynamic column edge cases', () => {
    it('should show requirements with VERSION_TEST stage in dynamic columns', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST, 'requirement'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'requirement'),
      ];

      render(
        <StageColumn
          column={mockDynamicColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      // Requirements with VERSION_TEST stage should show in dynamic columns
      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-2')).toBeInTheDocument();
    });

    it('should filter independently for multiple dynamic columns with different testCycleIds', () => {
      const mockColumn1 = {
        id: 'col-cycle-1',
        title: '转测1',
        stage: WorkflowStage.VERSION_TEST,
        stages: [WorkflowStage.VERSION_TEST],
        isDynamic: true,
        testCycleId: 'test-cycle-1',
      };

      const mockColumn2 = {
        id: 'col-cycle-2',
        title: '转测2',
        stage: WorkflowStage.VERSION_TEST,
        stages: [WorkflowStage.VERSION_TEST],
        isDynamic: true,
        testCycleId: 'test-cycle-2',
      };

      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
        createMockItem('3', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
      ];

      const { unmount } = render(
        <StageColumn
          column={mockColumn1}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-3')).toBeInTheDocument();
      expect(screen.queryByTestId('kanban-card-2')).not.toBeInTheDocument();

      unmount();

      render(
        <StageColumn
          column={mockColumn2}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByTestId('kanban-card-2')).toBeInTheDocument();
      expect(screen.queryByTestId('kanban-card-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('kanban-card-3')).not.toBeInTheDocument();
    });
  });

  describe('Game mode filtering', () => {
    const createMockGameMode = (isActive: boolean = true) => ({
      isActive,
      checkpoints: [WorkflowStage.VERSION_TEST],
      totalRows: 3,
      gameItemStates: new Map([
        ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ['2', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
        ['3', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 2, isAdvancing: false }],
      ]),
      allItems: [
        createMockItem('1', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
        createMockItem('3', WorkflowStage.VERSION_TEST, 'requirement'),
      ],
      onAdvanceItem: vi.fn(),
      onPassCheckpoint: vi.fn(),
    });

    it('should filter by testCycleId in game mode for dynamic columns', () => {
      const mockGameMode = createMockGameMode(true);

      render(
        <StageColumn
          column={mockDynamicColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Issue with matching testCycleId should show
      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      // Issue with different testCycleId should not show
      expect(screen.queryByTestId('game-card-2')).not.toBeInTheDocument();
      // Requirements with VERSION_TEST stage should show in dynamic columns
      expect(screen.getByTestId('game-card-3')).toBeInTheDocument();
    });

    it('should show all items in game mode for non-dynamic columns', () => {
      const mockGameMode = createMockGameMode(true);

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('game-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('game-card-3')).toBeInTheDocument();
    });

    it('should maintain consistent filtering when game mode becomes inactive', () => {
      const mockGameMode = createMockGameMode(true);

      const { rerender } = render(
        <StageColumn
          column={mockDynamicColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(screen.queryByTestId('game-card-2')).not.toBeInTheDocument();

      const inactiveGameMode = {
        ...mockGameMode,
        isActive: false,
      };

      rerender(
        <StageColumn
          column={mockDynamicColumn}
          items={[
            createMockItem('1', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
            createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
          ]}
          interactionMode="click"
          isPM={false}
          gameMode={inactiveGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(screen.queryByTestId('game-card-2')).not.toBeInTheDocument();
    });

    it('should fallback to KanbanCard when gameMode is completely removed', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
        createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
      ];

      const { rerender } = render(
        <StageColumn
          column={mockDynamicColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={{
            isActive: true,
            checkpoints: [WorkflowStage.VERSION_TEST],
            totalRows: 2,
            gameItemStates: new Map([
              ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
              ['2', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
            ]),
            allItems: items,
            onAdvanceItem: vi.fn(),
            onPassCheckpoint: vi.fn(),
          }}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(screen.queryByTestId('game-card-2')).not.toBeInTheDocument();

      rerender(
        <StageColumn
          column={mockDynamicColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      expect(screen.queryByTestId('kanban-card-2')).not.toBeInTheDocument();
    });
  });

  describe('Shadow cards filtering', () => {
    it('should filter shadow cards by testCycleId for dynamic columns', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 2,
        gameItemStates: new Map([
          ['1', {
            currentStage: WorkflowStage.ISSUE_FIX,
            shadowStages: [WorkflowStage.VERSION_TEST],
            passedCheckpoints: [],
            rowIndex: 0,
            isAdvancing: false
          }],
          ['2', {
            currentStage: WorkflowStage.ISSUE_FIX,
            shadowStages: [WorkflowStage.VERSION_TEST],
            passedCheckpoints: [],
            rowIndex: 1,
            isAdvancing: false
          }],
        ]),
        allItems: [
          createMockItem('1', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-1'),
          createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
        ],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockDynamicColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1-shadow')).toBeInTheDocument();
      expect(screen.queryByTestId('game-card-2-shadow')).not.toBeInTheDocument();
    });
  });

  describe('Checkpoint detection', () => {
    it('should detect checkpoint column in game mode', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST, WorkflowStage.CCB_REVIEW],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      const checkpointColumn = {
        id: 'col-checkpoint',
        title: 'Checkpoint Column',
        stage: WorkflowStage.VERSION_TEST,
        stages: [WorkflowStage.VERSION_TEST],
        isDynamic: false,
      };

      render(
        <StageColumn
          column={checkpointColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
    });
  });

  describe('Custom title from stageConfigs', () => {
    it('should use custom title from stageConfigs when column has no title', () => {
      // Column without custom title should use stageConfigs
      const columnWithoutTitle = {
        id: 'col-no-title',
        title: undefined, // No custom title
        stage: WorkflowStage.VERSION_TEST,
        stages: [WorkflowStage.VERSION_TEST],
        isDynamic: false,
      };

      const items = [createMockItem('1', WorkflowStage.VERSION_TEST)];

      const stageConfigs = [
        { stage: WorkflowStage.VERSION_TEST, customTitle: '自定义版本测试', visible: true }
      ];

      render(
        <StageColumn
          column={columnWithoutTitle}
          items={items}
          interactionMode="click"
          isPM={false}
          stageConfigs={stageConfigs}
        />
      );

      // When column has no title but stageConfigs has customTitle, it should use customTitle
      expect(screen.getByText('自定义版本测试')).toBeInTheDocument();
    });
  });

  describe('Game mode merged column', () => {
    it('should handle merged columns in game mode', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.FEATURE_DEV],
        totalRows: 2,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.FEATURE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
          ['2', { currentStage: WorkflowStage.ALPHA_CASE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
        ]),
        allItems: [
          createMockItem('1', WorkflowStage.FEATURE_DEV),
          createMockItem('2', WorkflowStage.ALPHA_CASE_DEV),
        ],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockMergedColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('game-card-2')).toBeInTheDocument();
    });

    it('should handle merged columns in game mode with shadow cards', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.FEATURE_DEV],
        totalRows: 2,
        gameItemStates: new Map([
          ['1', {
            currentStage: WorkflowStage.SOP_UPGRADE,
            shadowStages: [WorkflowStage.FEATURE_DEV],
            passedCheckpoints: [WorkflowStage.FEATURE_DEV],
            rowIndex: 0,
            isAdvancing: false
          }],
        ]),
        allItems: [
          createMockItem('1', WorkflowStage.FEATURE_DEV),
        ],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockMergedColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Shadow card should appear in FEATURE_DEV sub-region
      expect(screen.getByTestId('game-card-1-shadow')).toBeInTheDocument();
    });

    it('should handle merged columns in inactive game mode', () => {
      const mockGameMode = {
        isActive: false,
        checkpoints: [WorkflowStage.FEATURE_DEV],
        totalRows: 2,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.FEATURE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
          ['2', { currentStage: WorkflowStage.ALPHA_CASE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
        ]),
        allItems: [
          createMockItem('1', WorkflowStage.FEATURE_DEV),
          createMockItem('2', WorkflowStage.ALPHA_CASE_DEV),
        ],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockMergedColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // In inactive mode, should show KanbanCard (not GameCard) without grid layout
      expect(screen.getByTestId('kanban-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-card-2')).toBeInTheDocument();
    });

    it('should handle merged column with dynamic filtering in game mode', () => {
      const dynamicMergedColumn = {
        id: 'col-dynamic-merged',
        title: 'Dynamic Merged',
        stage: WorkflowStage.FEATURE_DEV,
        stages: [WorkflowStage.FEATURE_DEV, WorkflowStage.ALPHA_CASE_DEV],
        isDynamic: true,
        testCycleId: 'test-cycle-1',
      };

      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.FEATURE_DEV],
        totalRows: 3,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.FEATURE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
          ['2', { currentStage: WorkflowStage.FEATURE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
          ['3', { currentStage: WorkflowStage.ALPHA_CASE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 2, isAdvancing: false }],
        ]),
        allItems: [
          createMockItem('1', WorkflowStage.FEATURE_DEV, 'issue', 'test-cycle-1'),
          createMockItem('2', WorkflowStage.FEATURE_DEV, 'issue', 'test-cycle-2'),
          createMockItem('3', WorkflowStage.ALPHA_CASE_DEV, 'issue', 'test-cycle-1'),
        ],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={dynamicMergedColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Only items matching testCycleId should appear
      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('game-card-3')).toBeInTheDocument();
      expect(screen.queryByTestId('game-card-2')).not.toBeInTheDocument();
    });
  });

  describe('Scroll and grid layout', () => {
    it('should register scroll container in game mode', () => {
      const registerScrollContainer = vi.fn();
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
        registerScrollContainer,
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(registerScrollContainer).toHaveBeenCalled();
    });

    it('should handle onScroll callback', () => {
      const onScroll = vi.fn();
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
        onScroll,
        registerScrollContainer: vi.fn(),
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Find the scroll container and trigger scroll
      const scrollContainer = screen.getByTestId('game-card-1').parentElement?.parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = 100;
        scrollContainer.dispatchEvent(new Event('scroll'));
      }
    });
  });

  describe('Game card states', () => {
    it('should render card with isAdvancing state', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: true }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
    });

    it('should render card with isExploding state', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: true, isExploding: true }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
    });

    it('should render card with isReappearing state', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.ISSUE_FIX, shadowStages: [], passedCheckpoints: [WorkflowStage.VERSION_TEST], rowIndex: 0, isAdvancing: false, isReappearing: true }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.ISSUE_FIX)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      const issueFixColumn = {
        id: 'col-issue-fix',
        title: 'Issue Fix',
        stage: WorkflowStage.ISSUE_FIX,
        stages: [WorkflowStage.ISSUE_FIX],
        isDynamic: false,
      };

      render(
        <StageColumn
          column={issueFixColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
    });

    it('should call onAdvanceItem when advance button is clicked in game mode', () => {
      const onAdvanceItem = vi.fn();
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem,
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      screen.getByTestId('advance-1').click();
      expect(onAdvanceItem).toHaveBeenCalledWith('1');
    });

    it('should call onPassCheckpoint when checkpoint button is clicked in game mode', () => {
      const onPassCheckpoint = vi.fn();
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint,
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      screen.getByTestId('checkpoint-1').click();
      expect(onPassCheckpoint).toHaveBeenCalledWith('1');
    });
  });

  describe('Merged column title generation', () => {
    it('should generate title from merged stages when no custom title', () => {
      const mergedColumnNoTitle = {
        id: 'col-merged-no-title',
        stage: WorkflowStage.FEATURE_DEV,
        stages: [WorkflowStage.FEATURE_DEV, WorkflowStage.ALPHA_CASE_DEV],
        isDynamic: false,
      };

      const items = [
        createMockItem('1', WorkflowStage.FEATURE_DEV),
      ];

      render(
        <StageColumn
          column={mergedColumnNoTitle}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      // Should show merged title with + separator
      expect(screen.getByRole('heading', { name: /功能开发/ })).toBeInTheDocument();
    });
  });

  describe('Checkpoint column styling', () => {
    it('should apply checkpoint styling to merged column when game is active', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.FEATURE_DEV],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.FEATURE_DEV, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.FEATURE_DEV)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockMergedColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      // Checkpoint target emoji should appear in column header
      expect(screen.getAllByText('🎯').length).toBeGreaterThan(0);
    });
  });

  describe('Game mode helper functions', () => {
    it('should use getShadowPosition when provided', () => {
      const getShadowPosition = vi.fn().mockReturnValue(2);
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.ISSUE_FIX, shadowStages: [WorkflowStage.VERSION_TEST], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
        getShadowPosition,
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Shadow card should appear and getShadowPosition should be called
      expect(screen.getByTestId('game-card-1-shadow')).toBeInTheDocument();
    });

    it('should use getPassedCheckpointLabels when provided', () => {
      const getPassedCheckpointLabels = vi.fn().mockReturnValue(['卡点1✔']);
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 1,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [WorkflowStage.VERSION_TEST], rowIndex: 0, isAdvancing: false }],
        ]),
        allItems: [createMockItem('1', WorkflowStage.VERSION_TEST)],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
        getPassedCheckpointLabels,
      };

      render(
        <StageColumn
          column={mockColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      expect(getPassedCheckpointLabels).toHaveBeenCalledWith('1');
    });
  });

  describe('Dynamic column filtering edge cases', () => {
    it('should filter non-matching items in dynamic column during game mode', () => {
      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 2,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
          ['2', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
        ]),
        allItems: [
          createMockItem('1', WorkflowStage.VERSION_TEST, 'requirement'),
          createMockItem('2', WorkflowStage.VERSION_TEST, 'issue', 'test-cycle-2'),
        ],
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      render(
        <StageColumn
          column={mockDynamicColumn}
          items={[]}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Requirements with VERSION_TEST stage should show in dynamic columns
      expect(screen.getByTestId('game-card-1')).toBeInTheDocument();
      // Issue with different testCycleId should not appear
      expect(screen.queryByTestId('game-card-2')).not.toBeInTheDocument();
    });
  });

  describe('Gradient fade for long lists', () => {
    it('should show gradient fade when more than 3 items in non-game mode', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST),
        createMockItem('2', WorkflowStage.VERSION_TEST),
        createMockItem('3', WorkflowStage.VERSION_TEST),
        createMockItem('4', WorkflowStage.VERSION_TEST),
      ];

      const { container } = render(
        <StageColumn
          column={mockColumn}
          items={items}
          interactionMode="click"
          isPM={false}
        />
      );

      // Gradient fade element should be rendered
      const gradientElement = container.querySelector('.bg-gradient-to-t');
      expect(gradientElement).toBeInTheDocument();
    });

    it('should not show gradient fade in game mode', () => {
      const items = [
        createMockItem('1', WorkflowStage.VERSION_TEST),
        createMockItem('2', WorkflowStage.VERSION_TEST),
        createMockItem('3', WorkflowStage.VERSION_TEST),
        createMockItem('4', WorkflowStage.VERSION_TEST),
      ];

      const mockGameMode = {
        isActive: true,
        checkpoints: [WorkflowStage.VERSION_TEST],
        totalRows: 4,
        gameItemStates: new Map([
          ['1', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 0, isAdvancing: false }],
          ['2', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 1, isAdvancing: false }],
          ['3', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 2, isAdvancing: false }],
          ['4', { currentStage: WorkflowStage.VERSION_TEST, shadowStages: [], passedCheckpoints: [], rowIndex: 3, isAdvancing: false }],
        ]),
        allItems: items,
        onAdvanceItem: vi.fn(),
        onPassCheckpoint: vi.fn(),
      };

      const { container } = render(
        <StageColumn
          column={mockColumn}
          items={items}
          interactionMode="click"
          isPM={false}
          gameMode={mockGameMode}
        />
      );

      // Gradient fade should not be present in game mode
      const gradientElement = container.querySelector('.bg-gradient-to-t');
      expect(gradientElement).not.toBeInTheDocument();
    });
  });
});
