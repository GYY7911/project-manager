import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ProgressGameDialog,
  GameStatusBar,
} from './ProgressGame';
import { WorkflowStage, StageLabels } from '@pm/shared';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, onClick, ...props }: any) => (
      <div className={className} style={style} onClick={onClick} data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, onClick, whileHover, whileTap, ...props }: any) => (
      <button className={className} onClick={onClick} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Select component
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
}));

describe('ProgressGameDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnStartGame = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    availableStages: [
      WorkflowStage.REQUIREMENT_DESIGN,
      WorkflowStage.ALPHA_TEST_DESIGN,
      WorkflowStage.DOCUMENT_SIGN,
      WorkflowStage.FEATURE_DEV,
      WorkflowStage.VERSION_TEST,
      WorkflowStage.CCB_REVIEW,
    ],
    onStartGame: mockOnStartGame,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('should render dialog when open', () => {
      render(<ProgressGameDialog {...defaultProps} />);

      expect(screen.getByText('更新消消乐')).toBeInTheDocument();
      expect(
        screen.getByText('设置卡点，游戏化推进需求进度')
      ).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      render(<ProgressGameDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('更新消消乐')).not.toBeInTheDocument();
    });

    it('should render favorite stages section', () => {
      render(<ProgressGameDialog {...defaultProps} />);

      expect(screen.getByText('常用阶段')).toBeInTheDocument();
    });

    it('should render other stages section', () => {
      render(<ProgressGameDialog {...defaultProps} />);

      expect(screen.getByText('其他阶段')).toBeInTheDocument();
    });
  });

  describe('checkpoint selection', () => {
    it('should start with favorite checkpoints auto-selected', async () => {
      render(<ProgressGameDialog {...defaultProps} />);

      // Default favorites: DOCUMENT_SIGN, VERSION_TEST, CCB_REVIEW
      // These are all in availableStages now
      // Wait for the auto-selection to happen
      await waitFor(() => {
        // Should see preview section when checkpoints are selected
        expect(screen.getByText(/卡点顺序:/)).toBeInTheDocument();
      });
    });

    it('should allow deselecting checkpoint by clicking stage card', async () => {
      render(<ProgressGameDialog {...defaultProps} />);

      // Wait for auto-selection
      await waitFor(() => {
        expect(screen.getByText(/卡点顺序:/)).toBeInTheDocument();
      });

      // Click to deselect all favorites one by one
      // Use getAllByText since the stage name appears in both the card and preview
      const stageElements = screen.getAllByText(StageLabels[WorkflowStage.DOCUMENT_SIGN]);
      // The first one should be the stage card (in "常用阶段" section)
      fireEvent.click(stageElements[0]);

      // Should still show preview since other favorites are selected
      // Start button should still be enabled
      const startButton = screen.getByText('开始游戏').closest('button');
      expect(startButton).not.toBeDisabled();
    });

    it('should allow removing checkpoint from preview via X button', async () => {
      render(<ProgressGameDialog {...defaultProps} />);

      // Wait for auto-selection
      await waitFor(() => {
        expect(screen.getByText(/卡点顺序:/)).toBeInTheDocument();
      });

      // Find all X buttons in the preview
      const xButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('svg.lucide-x') || btn.closest('[title*="取消"]')
      );

      // There should be X buttons for each selected checkpoint
      expect(xButtons.length).toBeGreaterThan(0);

      // Click the first X button to remove a checkpoint
      const firstXButton = xButtons[0];
      fireEvent.click(firstXButton);

      // Preview should still exist since there are other checkpoints
      expect(screen.getByText(/卡点顺序:/)).toBeInTheDocument();
    });

    it('should enable start button when checkpoint is selected', async () => {
      render(<ProgressGameDialog {...defaultProps} />);

      // Wait for auto-selection
      await waitFor(() => {
        const startButton = screen.getByText('开始游戏').closest('button');
        expect(startButton).not.toBeDisabled();
      });
    });
  });

  describe('starting game', () => {
    it('should call onStartGame with selected checkpoints', async () => {
      render(<ProgressGameDialog {...defaultProps} />);

      // Wait for auto-selection of favorites
      await waitFor(() => {
        expect(screen.getByText(/卡点顺序:/)).toBeInTheDocument();
      });

      // Default favorites are auto-selected: DOCUMENT_SIGN, VERSION_TEST, CCB_REVIEW
      // Click to deselect all but DOCUMENT_SIGN
      const versionTestElements = screen.getAllByText(StageLabels[WorkflowStage.VERSION_TEST]);
      fireEvent.click(versionTestElements[0]); // Deselect VERSION_TEST

      const ccbReviewElements = screen.getAllByText(StageLabels[WorkflowStage.CCB_REVIEW]);
      fireEvent.click(ccbReviewElements[0]); // Deselect CCB_REVIEW

      fireEvent.click(screen.getByText('开始游戏'));

      // Only DOCUMENT_SIGN should remain selected
      expect(mockOnStartGame).toHaveBeenCalledWith([WorkflowStage.DOCUMENT_SIGN]);
    });

    it('should close dialog after starting game', async () => {
      render(<ProgressGameDialog {...defaultProps} />);

      // Wait for auto-selection
      await waitFor(() => {
        expect(screen.getByText(/卡点顺序:/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('开始游戏'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('canceling', () => {
    it('should close dialog when clicking cancel button', () => {
      render(<ProgressGameDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('取消'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should close dialog when clicking overlay', () => {
      const { container } = render(<ProgressGameDialog {...defaultProps} />);

      const overlay = container.querySelector('.fixed.inset-0');
      fireEvent.click(overlay!);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe('GameStatusBar', () => {
  const mockOnExit = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnUndo = vi.fn(() => true);
  const mockOnReset = vi.fn();

  const defaultProps = {
    checkpoints: [WorkflowStage.DOCUMENT_SIGN, WorkflowStage.VERSION_TEST],
    completedCount: 1,
    totalCount: 2,
    historySize: 3,
    wasSaved: false,
    onExit: mockOnExit,
    onSave: mockOnSave,
    onUndo: mockOnUndo,
    onReset: mockOnReset,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render game title', () => {
      render(<GameStatusBar {...defaultProps} />);

      expect(screen.getByText('更新消消乐')).toBeInTheDocument();
    });

    it('should render progress percentage', () => {
      render(<GameStatusBar {...defaultProps} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should render completion stats', () => {
      render(<GameStatusBar {...defaultProps} />);

      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      render(<GameStatusBar {...defaultProps} />);

      expect(screen.getByText('撤销')).toBeInTheDocument();
      expect(screen.getByText('重置')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
      expect(screen.getByText('退出游戏')).toBeInTheDocument();
    });
  });

  describe('progress display', () => {
    it('should show 0% when no items completed', () => {
      render(<GameStatusBar {...defaultProps} completedCount={0} totalCount={0} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should show 100% when all completed', () => {
      render(<GameStatusBar {...defaultProps} completedCount={5} totalCount={5} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should show correct stats', () => {
      render(<GameStatusBar {...defaultProps} completedCount={3} totalCount={4} />);

      expect(screen.getByText('3/4')).toBeInTheDocument();
    });
  });

  describe('save button', () => {
    it('should show "保存" when not saved', () => {
      render(<GameStatusBar {...defaultProps} wasSaved={false} />);

      expect(screen.getByText('保存')).toBeInTheDocument();
    });

    it('should show "已保存" when saved', () => {
      render(<GameStatusBar {...defaultProps} wasSaved={true} />);

      expect(screen.getByText('已保存')).toBeInTheDocument();
    });

    it('should call onSave when clicked', () => {
      render(<GameStatusBar {...defaultProps} />);

      fireEvent.click(screen.getByText('保存'));

      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  describe('undo button', () => {
    it('should show history count', () => {
      render(<GameStatusBar {...defaultProps} historySize={5} />);

      expect(screen.getByText('(5)')).toBeInTheDocument();
    });

    it('should be disabled when no history', () => {
      render(<GameStatusBar {...defaultProps} historySize={0} />);

      const undoButton = screen.getByText('撤销').closest('button');
      expect(undoButton).toBeDisabled();
    });

    it('should be enabled when has history', () => {
      render(<GameStatusBar {...defaultProps} historySize={1} />);

      const undoButton = screen.getByText('撤销').closest('button');
      expect(undoButton).not.toBeDisabled();
    });

    it('should call onUndo when clicked', () => {
      render(<GameStatusBar {...defaultProps} />);

      fireEvent.click(screen.getByText('撤销'));

      expect(mockOnUndo).toHaveBeenCalled();
    });
  });

  describe('reset dialog', () => {
    it('should show reset confirmation dialog', () => {
      render(<GameStatusBar {...defaultProps} />);

      fireEvent.click(screen.getByText('重置'));

      expect(screen.getByText('重置进度')).toBeInTheDocument();
    });

    it('should call onReset when confirmed', () => {
      render(<GameStatusBar {...defaultProps} />);

      fireEvent.click(screen.getByText('重置'));
      fireEvent.click(screen.getByText('确认重置'));

      expect(mockOnReset).toHaveBeenCalled();
    });

    it('should not call onReset when canceled', () => {
      render(<GameStatusBar {...defaultProps} />);

      fireEvent.click(screen.getByText('重置'));
      fireEvent.click(screen.getByText('取消'));

      expect(mockOnReset).not.toHaveBeenCalled();
    });
  });

  describe('exit dialog', () => {
    it('should show exit confirmation dialog', () => {
      render(<GameStatusBar {...defaultProps} />);

      fireEvent.click(screen.getByText('退出游戏'));

      const titles = screen.getAllByText('退出游戏');
      expect(titles.length).toBeGreaterThan(0);
    });

    it('should show unsaved warning when not saved', () => {
      render(<GameStatusBar {...defaultProps} wasSaved={false} />);

      fireEvent.click(screen.getByText('退出游戏'));

      expect(
        screen.getByText(/尚未保存，退出后卡片将从看板上消失/)
      ).toBeInTheDocument();
    });

    it('should show saved message when saved', () => {
      render(<GameStatusBar {...defaultProps} wasSaved={true} />);

      fireEvent.click(screen.getByText('退出游戏'));

      expect(
        screen.getByText(/已保存的卡片位置将保留在看板上/)
      ).toBeInTheDocument();
    });

    it('should call onExit when confirmed', () => {
      render(<GameStatusBar {...defaultProps} />);

      const exitButtons = screen.getAllByText('退出游戏');
      fireEvent.click(exitButtons[0]);

      fireEvent.click(screen.getByText('确认退出'));

      expect(mockOnExit).toHaveBeenCalled();
    });

    it('should not call onExit when canceled', () => {
      render(<GameStatusBar {...defaultProps} />);

      const exitButtons = screen.getAllByText('退出游戏');
      fireEvent.click(exitButtons[0]);

      fireEvent.click(screen.getByText('继续游戏'));

      expect(mockOnExit).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle zero completion', () => {
      render(<GameStatusBar {...defaultProps} completedCount={0} totalCount={10} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('0/10')).toBeInTheDocument();
    });

    it('should handle single checkpoint', () => {
      render(
        <GameStatusBar {...defaultProps} checkpoints={[WorkflowStage.DOCUMENT_SIGN]} />
      );

      expect(screen.getByText(StageLabels[WorkflowStage.DOCUMENT_SIGN])).toBeInTheDocument();
    });
  });
});
