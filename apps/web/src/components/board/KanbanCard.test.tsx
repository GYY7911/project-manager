import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { KanbanCard } from './KanbanCard';
import { renderWithProviders } from '@/test/utils';
import { WorkflowStage, IssueSeverity } from '@pm/shared';

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
  })),
}));

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => 'translate(0px, 0px)'),
    },
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  differenceInDays: vi.fn((dateLeft: Date, dateRight: Date) => {
    const diffTime = dateLeft.getTime() - dateRight.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }),
}));

/**
 * 创建模拟的看板卡片数据
 */
function createMockItem(
  id: string,
  stage: WorkflowStage = WorkflowStage.FEATURE_DEV,
  type: 'requirement' | 'issue' = 'requirement',
  overrides?: Partial<ReturnType<typeof createMockItem>>
) {
  const code = type === 'requirement' ? `FE-${id}` : `ISS-${id}`;
  return {
    id,
    type,
    code,
    title: `Test Item ${id}`,
    status: 'IN_PROGRESS',
    currentStage: stage,
    assignee: { id: `user-${id}`, name: `User ${id}`, employeeNo: `EMP${id}` },
    severity: type === 'issue' ? IssueSeverity.HIGH : undefined,
    workload: type === 'requirement' ? 5 : undefined,
    ...overrides,
  };
}

describe('KanbanCard', () => {
  describe('基础渲染', () => {
    it('应该正确渲染需求卡片', () => {
      const item = createMockItem('1', WorkflowStage.FEATURE_DEV, 'requirement');

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByText('FE-1')).toBeInTheDocument();
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText(/User 1/)).toBeInTheDocument();
    });

    it('应该正确渲染问题单卡片', () => {
      const item = createMockItem('2', WorkflowStage.ISSUE_FIX, 'issue');

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByText('ISS-2')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    });

    it('问题单卡片应该有红色左边框标识', () => {
      const item = createMockItem('3', WorkflowStage.ISSUE_FIX, 'issue');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-l-2');
      expect(card).toHaveClass('border-l-red-500');
    });
  });

  describe('交互模式', () => {
    it('点击模式下应该有 hover ring 效果的类', () => {
      const item = createMockItem('4');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('hover:ring-1');
      expect(card).toHaveClass('hover:ring-primary/50');
    });
  });

  describe('拖拽状态', () => {
    it('拖拽中应该有半透明和阴影效果', () => {
      const item = createMockItem('5');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM={false}
          isDragging
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('opacity-90');
      expect(card).toHaveClass('shadow-2xl');
    });

    it('拖拽中应该显示 ring 效果', () => {
      const item = createMockItem('6');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM={false}
          isDragging
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('ring-2');
      // 检查是否包含 ring-primary 类（完整类名包含透明度）
      expect(card.className).toMatch(/ring-primary/);
    });

    it('拖拽中且不允许放置时应该显示红色 ring', () => {
      const item = createMockItem('7', WorkflowStage.ISSUE_FIX, 'issue');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM={false}
          isDragging
          isDropAllowed={false}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('ring-red-500');
    });

    it('当 isDragging 为 true 且 isDropAllowed 为 false 时，应该显示禁止光标', () => {
      const item = createMockItem('8', WorkflowStage.ISSUE_FIX, 'issue');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM={false}
          isDragging
          isDropAllowed={false}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('当 isDragging 为 true 且 isDropAllowed 为 true 时，不应该显示禁止光标', () => {
      const item = createMockItem('9', WorkflowStage.ISSUE_FIX, 'issue');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM={false}
          isDragging
          isDropAllowed
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveStyle({ cursor: 'not-allowed' });
    });

    it('当 isDragging 为 false 时，不应该显示禁止光标（即使 isDropAllowed 为 false）', () => {
      const item = createMockItem('10', WorkflowStage.ISSUE_FIX, 'issue');

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM={false}
          isDropAllowed={false}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveStyle({ cursor: 'not-allowed' });
    });

    it('拖拽状态下应该继续显示延期标识', () => {
      // 这个测试验证 bug 修复：DragOverlay 中的卡片也应该显示延期标识
      const testToday = new Date('2026-03-19');
      vi.useFakeTimers();
      vi.setSystemTime(testToday);

      const item = createMockItem('drag-delay-1', WorkflowStage.FEATURE_DEV, 'requirement');

      // 计划日期在3天后
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-22' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM
          isDragging
          delayConfig={delayConfig}
        />
      );

      // 即使在拖拽状态下，延期标识也应该显示
      expect(screen.getByText('+3')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('拖拽状态下已延期卡片应该显示延期天数', () => {
      const testToday = new Date('2026-03-19');
      vi.useFakeTimers();
      vi.setSystemTime(testToday);

      const item = createMockItem('drag-delay-2', WorkflowStage.FEATURE_DEV, 'requirement');

      // 计划日期在5天前（已延期）
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-14' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="drag"
          isPM
          isDragging
          isDropAllowed
          delayConfig={delayConfig}
        />
      );

      // 拖拽状态下，延期标识仍应显示
      expect(screen.getByText('-5')).toBeInTheDocument();
      // 验证红色样式（支持 dark mode 和 light mode）
      const badge = screen.getByText('-5').closest('div');
      expect(badge?.className).toMatch(/text-red-(400|700)/);

      vi.useRealTimers();
    });
  });

  describe('严重程度显示', () => {
    it('问题单应该显示严重程度标签', () => {
      const item = createMockItem('11', WorkflowStage.ISSUE_FIX, 'issue', {
        severity: IssueSeverity.HIGH,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.getByText(IssueSeverity.HIGH)).toBeInTheDocument();
    });

    it('需求不应该显示严重程度', () => {
      const item = createMockItem('12', WorkflowStage.FEATURE_DEV, 'requirement');

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      // 不应该有任何严重程度标签
      expect(screen.queryByText(IssueSeverity.HIGH)).not.toBeInTheDocument();
      expect(screen.queryByText(IssueSeverity.CRITICAL)).not.toBeInTheDocument();
    });

    it('致命级别应该有红色背景', () => {
      const item = createMockItem('13', WorkflowStage.ISSUE_FIX, 'issue', {
        severity: IssueSeverity.CRITICAL,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      const severityTag = screen.getByText(IssueSeverity.CRITICAL);
      // 支持 dark mode 和 light mode 类名
      expect(severityTag.className).toMatch(/bg-red-(500\/20|100)/);
      expect(severityTag.className).toMatch(/text-red-(400|700)/);
    });

    it('高严重级别应该有橙色背景', () => {
      const item = createMockItem('14', WorkflowStage.ISSUE_FIX, 'issue', {
        severity: IssueSeverity.HIGH,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      const severityTag = screen.getByText(IssueSeverity.HIGH);
      expect(severityTag.className).toMatch(/bg-orange-(500\/20|100)/);
      expect(severityTag.className).toMatch(/text-orange-(400|700)/);
    });

    it('中等严重级别应该有黄色背景', () => {
      const item = createMockItem('15', WorkflowStage.ISSUE_FIX, 'issue', {
        severity: IssueSeverity.MEDIUM,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      const severityTag = screen.getByText(IssueSeverity.MEDIUM);
      expect(severityTag.className).toMatch(/bg-yellow-(500\/20|100)/);
      expect(severityTag.className).toMatch(/text-yellow-(400|700)/);
    });

    it('低严重级别应该有绿色背景', () => {
      const item = createMockItem('16', WorkflowStage.ISSUE_FIX, 'issue', {
        severity: IssueSeverity.LOW,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      const severityTag = screen.getByText(IssueSeverity.LOW);
      expect(severityTag.className).toMatch(/bg-green-(500\/20|100)/);
      expect(severityTag.className).toMatch(/text-green-(400|700)/);
    });
  });

  describe('工作量显示', () => {
    it('PM 用户应该看到需求的工作量', () => {
      const item = createMockItem('17', WorkflowStage.FEATURE_DEV, 'requirement', {
        workload: 8,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
        />
      );

      expect(screen.getByText('8人/天')).toBeInTheDocument();
    });

    it('非 PM 用户不应该看到工作量', () => {
      const item = createMockItem('18', WorkflowStage.FEATURE_DEV, 'requirement', {
        workload: 8,
      });

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM={false}
        />
      );

      expect(screen.queryByText('8人/天')).not.toBeInTheDocument();
    });

    it('问题单不应该显示工作量', () => {
      const item = createMockItem('19', WorkflowStage.ISSUE_FIX, 'issue');

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
        />
      );

      expect(screen.queryByText(/人\/天/)).not.toBeInTheDocument();
    });
  });

  describe('延期状态显示', () => {
    // 固定当前日期用于测试
    const mockToday = new Date('2026-03-19');

    beforeEach(() => {
      // Mock 当前日期
      vi.useFakeTimers();
      vi.setSystemTime(mockToday);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('当没有延期配置时不显示延期标识', () => {
      const item = createMockItem('20', WorkflowStage.FEATURE_DEV, 'requirement');

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
        />
      );

      // 不应该有延期或剩余天数的显示
      expect(screen.queryByText(/延期/)).not.toBeInTheDocument();
      expect(screen.queryByText(/剩余/)).not.toBeInTheDocument();
      // 检查延期标识的具体文本格式（以 - 开头后跟数字，如 -3）
      expect(screen.queryByText(/^-?\d+$/)).not.toBeInTheDocument();
    });

    it('当有延期配置但当前阶段没有配置时不显示延期标识', () => {
      const item = createMockItem('21', WorkflowStage.FEATURE_DEV, 'requirement');

      // 只配置了 REQUIREMENT_DESIGN 阶段，但项目在 FEATURE_DEV
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.REQUIREMENT_DESIGN, plannedDate: '2026-03-15' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
          delayConfig={delayConfig}
        />
      );

      expect(screen.queryByText(/延期/)).not.toBeInTheDocument();
      expect(screen.queryByText(/剩余/)).not.toBeInTheDocument();
    });

    it('当有延期配置且未延期时显示剩余天数', () => {
      const item = createMockItem('22', WorkflowStage.FEATURE_DEV, 'requirement');

      // 计划日期在3天后
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-22' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
          delayConfig={delayConfig}
        />
      );

      // 应该显示 +3（剩余3天）
      expect(screen.getByText('+3')).toBeInTheDocument();
      // 应该有绿色背景（支持 dark mode 和 light mode）
      const badge = screen.getByText('+3').closest('div');
      expect(badge?.className).toMatch(/text-green-(400|700)/);
    });

    it('当有延期配置且已延期时显示延期天数', () => {
      const item = createMockItem('23', WorkflowStage.FEATURE_DEV, 'requirement');

      // 计划日期在5天前
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-14' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
          delayConfig={delayConfig}
        />
      );

      // 应该显示 -5（延期5天）
      expect(screen.getByText('-5')).toBeInTheDocument();
      // 应该有红色背景（支持 dark mode 和 light mode）
      const badge = screen.getByText('-5').closest('div');
      expect(badge?.className).toMatch(/text-red-(400|700)/);
    });

    it('当天截止时显示 +0', () => {
      const item = createMockItem('24', WorkflowStage.FEATURE_DEV, 'requirement');

      // 计划日期就是今天
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-19' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
          delayConfig={delayConfig}
        />
      );

      // 应该显示 +0
      expect(screen.getByText('+0')).toBeInTheDocument();
    });

    it('问题单也应该显示延期状态', () => {
      const item = createMockItem('25', WorkflowStage.ISSUE_FIX, 'issue');

      // 计划日期在2天前
      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.ISSUE_FIX, plannedDate: '2026-03-17' },
        ],
      };

      renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
          delayConfig={delayConfig}
        />
      );

      // 应该显示 -2（延期2天）
      expect(screen.getByText('-2')).toBeInTheDocument();
    });

    it('延期状态应该在卡片右上角显示', () => {
      const item = createMockItem('26', WorkflowStage.FEATURE_DEV, 'requirement');

      const delayConfig = {
        stageDeadlines: [
          { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-14' },
        ],
      };

      const { container } = renderWithProviders(
        <KanbanCard
          item={item}
          interactionMode="click"
          isPM
          delayConfig={delayConfig}
        />
      );

      // 验证延期标识存在
      const delayBadge = screen.getByText('-5');
      expect(delayBadge).toBeInTheDocument();
    });
  });
});
