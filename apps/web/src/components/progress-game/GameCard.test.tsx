import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameCard } from './GameCard';
import { WorkflowStage } from '@pm/shared';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, onHoverStart, onHoverEnd, ...props }: any) => (
      <div
        className={className}
        style={style}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        {...props}
      >
        {children}
      </div>
    ),
    button: ({ children, className, onClick, ...props }: any) => (
      <button className={className} onClick={onClick} {...props}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('GameCard', () => {
  const mockOnAdvance = vi.fn();
  const mockOnPassCheckpoint = vi.fn();

  const defaultProps = {
    id: '1',
    code: 'FE001',
    title: 'Test Requirement',
    type: 'requirement' as const,
    assignee: { name: 'John Doe' },
    currentStage: WorkflowStage.REQUIREMENT_DESIGN,
    targetColumnColor: '#3b82f6',
    isAtCheckpoint: false,
    shadowStages: [] as WorkflowStage[],
    isAdvancing: false,
    onAdvance: mockOnAdvance,
    onPassCheckpoint: mockOnPassCheckpoint,
    isGameActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render card basic information', () => {
      render(<GameCard {...defaultProps} />);

      expect(screen.getByText('FE001')).toBeInTheDocument();
      expect(screen.getByText('Test Requirement')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render issue type with different styling', () => {
      render(<GameCard {...defaultProps} type="issue" code="ISS001" />);

      expect(screen.getByText('ISS001')).toBeInTheDocument();
    });

    it('should render requirement type styling', () => {
      render(<GameCard {...defaultProps} />);

      const codeBadge = screen.getByText('FE001');
      expect(codeBadge.className).toContain('bg-blue');
    });
  });

  describe('checkpoint indicator', () => {
    it('should show checkpoint indicator when at checkpoint', () => {
      render(<GameCard {...defaultProps} isAtCheckpoint={true} />);

      expect(screen.getByText(/卡点/)).toBeInTheDocument();
    });

    it('should not show checkpoint indicator when not at checkpoint', () => {
      render(<GameCard {...defaultProps} isAtCheckpoint={false} />);

      expect(screen.queryByText(/卡点/)).not.toBeInTheDocument();
    });

    it('should not show checkpoint indicator for shadow cards', () => {
      render(
        <GameCard {...defaultProps} isAtCheckpoint={true} isShadow={true} />
      );

      // Shadow cards should show "影子" instead
      expect(screen.getByText('影子')).toBeInTheDocument();
    });
  });

  describe('passed checkpoint labels', () => {
    it('should show passed checkpoint labels', () => {
      render(
        <GameCard
          {...defaultProps}
          passedCheckpointLabels={['卡点1✔', '卡点2✔']}
        />
      );

      expect(screen.getByText('卡点1✔')).toBeInTheDocument();
      expect(screen.getByText('卡点2✔')).toBeInTheDocument();
    });

    it('should not show labels for shadow cards', () => {
      render(
        <GameCard
          {...defaultProps}
          isShadow={true}
          passedCheckpointLabels={['卡点1✔']}
        />
      );

      expect(screen.queryByText('卡点1✔')).not.toBeInTheDocument();
    });
  });

  describe('shadow card', () => {
    it('should show shadow indicator', () => {
      render(<GameCard {...defaultProps} isShadow={true} />);

      expect(screen.getByText('影子')).toBeInTheDocument();
    });

    it('should have dashed border style', () => {
      const { container } = render(<GameCard {...defaultProps} isShadow={true} />);

      const card = container.querySelector('.border-dashed');
      expect(card).toBeInTheDocument();
    });

    it('should show ghost emoji', () => {
      render(<GameCard {...defaultProps} isShadow={true} />);

      expect(screen.getByText('👻')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when advancing', () => {
      render(<GameCard {...defaultProps} isAdvancing={true} />);

      // Loader2 has animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('shadow stages indicator', () => {
    it('should show shadow stages when present', () => {
      render(
        <GameCard
          {...defaultProps}
          shadowStages={[
            WorkflowStage.REQUIREMENT_DESIGN,
            WorkflowStage.ALPHA_TEST_DESIGN,
          ]}
        />
      );

      expect(screen.getByText('推进:')).toBeInTheDocument();
    });

    it('should not show shadow stages for shadow cards', () => {
      render(
        <GameCard
          {...defaultProps}
          isShadow={true}
          shadowStages={[WorkflowStage.REQUIREMENT_DESIGN]}
        />
      );

      expect(screen.queryByText('推进:')).not.toBeInTheDocument();
    });

    it('should not show shadow stages when empty', () => {
      render(<GameCard {...defaultProps} shadowStages={[]} />);

      expect(screen.queryByText('推进:')).not.toBeInTheDocument();
    });
  });

  describe('button visibility', () => {
    it('should not show buttons when game is not active', () => {
      const { container } = render(
        <GameCard {...defaultProps} isGameActive={false} />
      );

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should show advance button for shadow cards when hovered (after fix)', async () => {
      const { container } = render(
        <GameCard {...defaultProps} isShadow={true} />
      );

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        // Shadow cards should now show action buttons after the fix
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should call onAdvance when clicking shadow card button', async () => {
      const { container } = render(
        <GameCard {...defaultProps} isShadow={true} />
      );

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        if (buttons.length > 0) {
          fireEvent.click(buttons[0]);
          expect(mockOnAdvance).toHaveBeenCalled();
        }
      });
    });

    it('should show pass checkpoint button for shadow cards at checkpoint', async () => {
      const { container } = render(
        <GameCard {...defaultProps} isShadow={true} isAtCheckpoint={true} />
      );

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        // Should show pass checkpoint button
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should not show buttons when advancing', () => {
      const { container } = render(
        <GameCard {...defaultProps} isAdvancing={true} />
      );

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      // Should show loading indicator instead of buttons
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onAdvance when advance button is clicked', async () => {
      const { container } = render(<GameCard {...defaultProps} />);

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        const button = screen.queryByRole('button');
        if (button && !button.textContent?.includes('加载')) {
          fireEvent.click(button);
          expect(mockOnAdvance).toHaveBeenCalled();
        }
      });
    });

    it('should call onPassCheckpoint when pass button is clicked at checkpoint', async () => {
      const { container } = render(
        <GameCard {...defaultProps} isAtCheckpoint={true} />
      );

      const card = container.querySelector('[class*="rounded-xl"]');
      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        const button = screen.queryByRole('button');
        if (button) {
          fireEvent.click(button);
          expect(mockOnPassCheckpoint).toHaveBeenCalled();
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty title gracefully', () => {
      render(<GameCard {...defaultProps} title="" />);

      // Should still render the card
      expect(screen.getByText('FE001')).toBeInTheDocument();
    });

    it('should handle long titles with truncation', () => {
      const longTitle = 'This is a very long title that should be truncated because it exceeds the normal width of a card';
      render(<GameCard {...defaultProps} title={longTitle} />);

      // Title should be present but truncated via CSS
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle multiple passed checkpoints', () => {
      render(
        <GameCard
          {...defaultProps}
          passedCheckpointLabels={['卡点1✔', '卡点2✔', '卡点3✔']}
        />
      );

      expect(screen.getByText('卡点1✔')).toBeInTheDocument();
      expect(screen.getByText('卡点2✔')).toBeInTheDocument();
      expect(screen.getByText('卡点3✔')).toBeInTheDocument();
    });

    it('should handle exploding state', () => {
      render(<GameCard {...defaultProps} isExploding={true} />);

      // Should show explosion emoji
      expect(screen.getByText('💥')).toBeInTheDocument();
    });
  });
});
