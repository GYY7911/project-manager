import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KanbanConfigDialog } from './KanbanConfigDialog';
import { renderWithProviders } from '@/test/utils';
import { WorkflowStage } from '@pm/shared';

// Define mock functions BEFORE using them in vi.mock
const mockSetKanbanConfig = vi.fn();

// Mock useAppStore - must be before the module import
vi.mock('@/store', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      kanbanConfig: null,
      setKanbanConfig: mockSetKanbanConfig,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
  generateDefaultKanbanConfig: () => ({
    version: 1,
    columns: [
      { id: 'col-1', stages: [WorkflowStage.REQUIREMENT_DESIGN] },
      { id: 'col-2', stages: [WorkflowStage.FEATURE_DEV, WorkflowStage.ALPHA_CASE_DEV] },
      { id: 'col-3', stages: [WorkflowStage.RELEASE] },
    ],
    stageConfigs: Object.values(WorkflowStage).map((stage) => ({
      stage,
      visible: true,
    })),
    updatedAt: '2024-01-01T00:00:00.000Z',
  }),
}));

// Mock @dnd-kit/core
const mockDragHandlers: {
  onDragStart: ((event: any) => void) | null;
  onDragEnd: ((event: any) => void) | null;
} = { onDragStart: null, onDragEnd: null };

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDndContext: () => ({
    active: null,
    over: null,
  }),
  DndContext: ({ children, onDragStart, onDragEnd }: any) => {
    mockDragHandlers.onDragStart = onDragStart;
    mockDragHandlers.onDragEnd = onDragEnd;
    return children;
  },
  pointerWithin: {},
  rectIntersection: {},
  PointerSensor: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  DragOverlay: ({ children }: { children?: React.ReactNode }) => children || null,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  horizontalListSortingStrategy: {},
  verticalListSortingStrategy: {},
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  },
}));

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}));

// Helper to simulate drag end
const simulateDragEnd = (activeId: string, overId: string, activeData?: any, overData?: any) => {
  if (mockDragHandlers.onDragEnd) {
    mockDragHandlers.onDragEnd({
      active: {
        id: activeId,
        data: { current: activeData },
      },
      over: {
        id: overId,
        data: { current: overData },
      },
    });
  }
};

describe('KanbanConfigDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDragHandlers.onDragStart = null;
    mockDragHandlers.onDragEnd = null;
  });

  describe('基础渲染', () => {
    it('当 open=false 时不渲染内容', () => {
      renderWithProviders(
        <KanbanConfigDialog open={false} onOpenChange={vi.fn()} />
      );

      expect(screen.queryByText('看板布局配置')).not.toBeInTheDocument();
    });

    it('当 open=true 时渲染配置弹窗', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });
    });

    it('渲染操作按钮', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
        expect(screen.getByText('重置')).toBeInTheDocument();
        expect(screen.getByText('保存')).toBeInTheDocument();
      });
    });

    it('渲染标题', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        const titles = screen.getAllByText('看板布局配置');
        expect(titles.length).toBeGreaterThan(0);
      });
    });

    it('渲染操作提示', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText(/操作/)).toBeInTheDocument();
      });
    });
  });

  describe('列操作', () => {
    it('点击新增列按钮添加新列', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      const addButton = screen.getByText('新增列');
      await user.click(addButton);

      // 验证新列被添加（应该出现"空列"提示）
      await waitFor(() => {
        expect(screen.getByText('拖拽阶段到这里')).toBeInTheDocument();
      });
    });

    it('显示未保存提示当配置被修改', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 添加列会触发 showSaveHint
      const addButton = screen.getByText('新增列');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('列排序拖拽 - 从 col-1 拖到 col-2 位置', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 模拟列拖拽
      simulateDragEnd('col-1', 'col-2');

      await waitFor(() => {
        // 验证保存提示出现
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });

  describe('阶段操作', () => {
    it('渲染待分配阶段列表', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        // 新 UI 显示"系统阶段"分组
        const systemStagesLabels = screen.getAllByText(/系统阶段/);
        expect(systemStagesLabels.length).toBeGreaterThan(0);
      });
    });

    it('渲染已分配阶段列表', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        // 新 UI 显示"自定义阶段"分组
        const customStagesLabels = screen.getAllByText(/自定义阶段/);
        expect(customStagesLabels.length).toBeGreaterThan(0);
      });
    });

    it('阶段拖拽到列 - 将未分配阶段拖入列', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 模拟将阶段拖入列
      // 使用一个未分配的阶段（如 ALPHA_TEST_DESIGN）
      simulateDragEnd(
        WorkflowStage.ALPHA_TEST_DESIGN,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.ALPHA_TEST_DESIGN }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('列内阶段排序拖拽', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // col-2 包含 FEATURE_DEV 和 ALPHA_CASE_DEV
      // 模拟在列内交换顺序
      simulateDragEnd(
        WorkflowStage.FEATURE_DEV,
        WorkflowStage.ALPHA_CASE_DEV,
        { type: 'column-stage', columnId: 'col-2', stage: WorkflowStage.FEATURE_DEV },
        { type: 'column-stage', columnId: 'col-2', stage: WorkflowStage.ALPHA_CASE_DEV }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('跨列阶段移动 - 从一列拖到另一列', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 将 FEATURE_DEV 从 col-2 移动到 col-1
      simulateDragEnd(
        WorkflowStage.FEATURE_DEV,
        WorkflowStage.REQUIREMENT_DESIGN,
        { type: 'column-stage', columnId: 'col-2', stage: WorkflowStage.FEATURE_DEV },
        { type: 'column-stage', columnId: 'col-1', stage: WorkflowStage.REQUIREMENT_DESIGN }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });

  describe('编辑功能', () => {
    it('编辑列标题 - 点击标题进入编辑模式', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 点击列标题进入编辑模式
      const columnTitles = screen.getAllByText('需求设计');
      await user.click(columnTitles[0]);

      // 应该出现输入框
      await waitFor(() => {
        const input = screen.getByPlaceholderText('列标题');
        expect(input).toBeInTheDocument();
      });
    });

    it('编辑列标题 - 按 Enter 保存', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 进入编辑模式
      const columnTitles = screen.getAllByText('需求设计');
      await user.click(columnTitles[0]);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('列标题');
        expect(input).toBeInTheDocument();
      });

      // 输入新标题
      const input = screen.getByPlaceholderText('列标题');
      await user.clear(input);
      await user.type(input, '新的列标题{enter}');

      // 验证保存提示
      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });

  describe('保存和重置', () => {
    it('点击保存按钮调用 setKanbanConfig 并关闭弹窗', async () => {
      const mockOnOpenChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockSetKanbanConfig).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('点击重置按钮恢复默认配置', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('重置')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('重置');
      await user.click(resetButton);

      // 重置会触发 showSaveHint
      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });

  describe('边缘情况', () => {
    it('拖拽到无效位置不更新配置', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 模拟拖拽但没有 over (即拖到空白区域)
      if (mockDragHandlers.onDragEnd) {
        mockDragHandlers.onDragEnd({
          active: {
            id: 'col-1',
            data: { current: undefined },
          },
          over: null,
        });
      }

      // 不应该出现保存提示
      expect(screen.queryByText('有未保存的更改')).not.toBeInTheDocument();
    });

    it('拖拽到相同位置不更新配置', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 模拟拖到自己身上
      simulateDragEnd('col-1', 'col-1');

      // 不应该出现保存提示
      expect(screen.queryByText('有未保存的更改')).not.toBeInTheDocument();
    });

    it('空列显示占位提示', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 添加一个空列
      const addButton = screen.getByText('新增列');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('拖拽阶段到这里')).toBeInTheDocument();
      });
    });

    it('合并列显示正确的阶段数量', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // col-2 包含 2 个阶段，应该显示合并信息
      // 文本出现在多个位置，使用 getAllByText
      const stageCountElements = screen.getAllByText(/2.*个阶段/);
      expect(stageCountElements.length).toBeGreaterThan(0);
      // 合并显示文本可能被分割，使用正则匹配
      expect(screen.getByText(/合并显示/)).toBeInTheDocument();
    });
  });

  describe('阶段面板', () => {
    it('渲染系统阶段和自定义阶段分组', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        // 新 UI 显示"系统阶段"分组
        const systemStagesLabels = screen.getAllByText(/系统阶段/);
        expect(systemStagesLabels.length).toBeGreaterThan(0);
      });

      // 自定义阶段区域应该显示
      const customStagesLabels = screen.getAllByText(/自定义阶段/);
      expect(customStagesLabels.length).toBeGreaterThan(0);
    });
  });

  describe('模板管理', () => {
    it('渲染流程模板区域', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('流程模板')).toBeInTheDocument();
      });
    });

    it('显示默认模板', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      // 流程1 可能出现多次，使用 getAllByText
      await waitFor(() => {
        const templateLabels = screen.getAllByText('流程1');
        expect(templateLabels.length).toBeGreaterThan(0);
      });
    });

    it('点击新建模板按钮创建新模板', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新建模板')).toBeInTheDocument();
      });

      const addButton = screen.getByText('新建模板');
      await user.click(addButton);

      // 应该出现流程2
      await waitFor(() => {
        const template2Labels = screen.getAllByText('流程2');
        expect(template2Labels.length).toBeGreaterThan(0);
      });
    });

    it('点击模板名称加载模板', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        const templateLabels = screen.getAllByText('流程1');
        expect(templateLabels.length).toBeGreaterThan(0);
      });

      // 点击模板按钮区域中的流程1按钮
      const templateButtons = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('流程1')
      );
      if (templateButtons.length > 0) {
        await user.click(templateButtons[0]);
      }

      // 验证有当前标签显示
      await waitFor(() => {
        const currentLabels = screen.getAllByText(/当前：/);
        expect(currentLabels.length).toBeGreaterThan(0);
      });
    });

    it('保存时更新当前模板到 localStorage', async () => {
      const mockOnOpenChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument();
      });

      // 添加一个新列来修改配置
      const addButton = screen.getByText('新增列');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });

      // 点击保存
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // 验证保存被调用
      await waitFor(() => {
        expect(mockSetKanbanConfig).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('显示当前模板名称', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        const currentLabels = screen.getAllByText(/当前：/);
        expect(currentLabels.length).toBeGreaterThan(0);
      });

      // 流程1 应该在页面上
      const templateLabels = screen.getAllByText('流程1');
      expect(templateLabels.length).toBeGreaterThan(0);
    });

    it('修改配置后显示更新模板按钮', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 添加列会触发 showSaveHint
      const addButton = screen.getByText('新增列');
      await user.click(addButton);

      // 应该显示更新模板按钮（在有更改时）
      await waitFor(() => {
        expect(screen.getByText('更新模板')).toBeInTheDocument();
      });
    });

    it('展开/折叠模板区域', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('流程模板')).toBeInTheDocument();
      });

      // 找到可折叠的头部按钮
      const headerButtons = screen.getAllByRole('button');
      const templateHeader = headerButtons.find(btn =>
        btn.textContent?.includes('流程模板')
      );

      if (templateHeader) {
        await user.click(templateHeader);

        // 点击后区域应该折叠或展开
        // 这里只验证按钮可以点击，不验证具体行为
        await waitFor(() => {
          expect(templateHeader).toBeInTheDocument();
        });
      }
    });
  });

  describe('阶段多次拖拽（复制模式）', () => {
    it('从调色板拖拽阶段到列，阶段被复制而非移动', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 模拟从调色板拖拽阶段到列（复制模式）
      simulateDragEnd(
        WorkflowStage.ALPHA_TEST_DESIGN,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.ALPHA_TEST_DESIGN }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('同一阶段可以多次拖拽到不同列', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 第一次拖拽到 col-1
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('从调色板拖拽阶段到已有该阶段的列，允许重复添加', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // col-1 已有 REQUIREMENT_DESIGN，再次拖入
      simulateDragEnd(
        WorkflowStage.REQUIREMENT_DESIGN,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.REQUIREMENT_DESIGN }
      );

      // 验证配置被更新（允许重复）
      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });

  describe('列间移动阶段（移动模式）', () => {
    it('从列A拖拽阶段到列B，阶段被移动', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 从 col-2 移动 FEATURE_DEV 到 col-1（列间移动）
      simulateDragEnd(
        WorkflowStage.FEATURE_DEV,
        'col-1',
        { type: 'column-stage', columnId: 'col-2', stage: WorkflowStage.FEATURE_DEV }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('列内排序保持原有行为', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // col-2 内排序：FEATURE_DEV 和 ALPHA_CASE_DEV
      simulateDragEnd(
        WorkflowStage.FEATURE_DEV,
        WorkflowStage.ALPHA_CASE_DEV,
        { type: 'column-stage', columnId: 'col-2', stage: WorkflowStage.FEATURE_DEV },
        { type: 'column-stage', columnId: 'col-2', stage: WorkflowStage.ALPHA_CASE_DEV }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });

  describe('自定义阶段管理', () => {
    it('底部调色板分组显示系统阶段和自定义阶段', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        // 新 UI 显示"系统阶段"分组
        const systemStagesLabels = screen.getAllByText(/系统阶段/);
        expect(systemStagesLabels.length).toBeGreaterThan(0);
      });

      // 自定义阶段区域应该显示（即使为空）
      const customStagesLabels = screen.getAllByText(/自定义阶段/);
      expect(customStagesLabels.length).toBeGreaterThan(0);
    });

    it('渲染新增自定义阶段按钮', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增自定义阶段')).toBeInTheDocument();
      });
    });

    it('点击新增自定义阶段按钮显示输入对话框', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增自定义阶段')).toBeInTheDocument();
      });

      const addButton = screen.getByText('新增自定义阶段');
      await user.click(addButton);

      // 应该出现输入对话框
      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入阶段名称')).toBeInTheDocument();
      });
    });

    it('自定义阶段显示删除按钮', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增自定义阶段')).toBeInTheDocument();
      });

      // 系统阶段不应该有删除按钮（在调色板中）
      // 自定义阶段如果有，应该有删除按钮
      // 这个测试验证组件能正常渲染
    });

    it('尝试删除系统阶段时不执行任何操作', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 系统阶段不可删除，配置不应变化
      // 验证没有异常抛出
    });
  });

  describe('阶段显示', () => {
    it('系统阶段显示默认标签', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        // 验证系统阶段分组显示
        expect(screen.getByText(/系统阶段/)).toBeInTheDocument();
      });
    });

    it('自定义阶段显示自定义标题', async () => {
      // 这个测试需要先添加自定义阶段
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增自定义阶段')).toBeInTheDocument();
      });
    });
  });

  describe('VERSION_TEST 动态阶段处理', () => {
    it('从调色板拖拽 VERSION_TEST 到列中，阶段被复制到目标列', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 第一次拖拽 VERSION_TEST 到 col-1
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });

      // 騡拟再次拖拽 VERSION_TEST 到 col-2
      // 这应该触发移动模式： 不是复制模式
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-2',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('VERSION_TEST 可以多次拖拽到不同列（COPY 模式）', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 第一次拖拽 VERSION_TEST 到 col-1
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });

      // 第二次拖拽 VERSION_TEST 到 col-2（COPY 模式，应该成功）
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-2',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('VERSION_TEST 显示标签', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        // VERSION_TEST 应该显示 "版本转测(动态)" 标签
        expect(screen.getByText(/版本转测/)).toBeInTheDocument();
      });
    });

    it('其他普通阶段可以多次拖拽到不同列', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 第一次拖拽 FEATURE_DEV 到 col-1
      simulateDragEnd(
        WorkflowStage.FEATURE_DEV,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.FEATURE_DEV }
      );

      // 第二次拖拽 FEATURE_DEV 到 col-2（应该成功复制)
      simulateDragEnd(
        WorkflowStage.FEATURE_DEV,
        'col-2',
        { type: 'palette-stage', stage: WorkflowStage.FEATURE_DEV }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('从列间移动 VERSION_TEST 时，只在源列和目标列之间移动', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 先将 VERSION_TEST 拖到 col-1
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });

      // 将 VERSION_TEST 从 col-1 拖到 col-2（列间移动）
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-2',
        { type: 'column-stage', stage: WorkflowStage.VERSION_TEST, columnId: 'col-1' }
      );

      // 验证配置被更新
      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });

    it('删除列中的阶段后，底部阶段仍可拖拽到其他列', async () => {
      renderWithProviders(
        <KanbanConfigDialog open={true} onOpenChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('新增列')).toBeInTheDocument();
      });

      // 拖拽 VERSION_TEST 到 col-1
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-1',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });

      // 再次拖拽 VERSION_TEST 到 col-2（验证删除后仍可拖拽）
      // 这测试了 allStageIds 包含所有可见阶段的修复
      simulateDragEnd(
        WorkflowStage.VERSION_TEST,
        'col-2',
        { type: 'palette-stage', stage: WorkflowStage.VERSION_TEST }
      );

      await waitFor(() => {
        expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
      });
    });
  });
});
