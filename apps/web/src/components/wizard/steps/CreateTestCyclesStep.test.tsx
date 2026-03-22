import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateTestCyclesStep } from './CreateTestCyclesStep';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    createTestCycle: vi.fn(),
    getAssignees: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockUpdateData = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CreateTestCyclesStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该显示转测说明和添加按钮', async () => {
      // Mock assignees API 返回空数组，这样组件不会停留在加载状态
      (api.getAssignees as any).mockResolvedValue([]);

      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      // 组件现在显示转测版本说明而不是独立标题
      expect(screen.getByText(/转测版本代表测试轮次/)).toBeInTheDocument();
      expect(screen.getByText('添加转测')).toBeInTheDocument();
    });

    it('应该显示"添加转测"按钮', () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('添加转测')).toBeInTheDocument();
    });

    it('无转测版本时应该显示空状态提示', () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      // 组件已更新，提示现在是 "暂无转测版本，点击上方按钮添加"
      expect(screen.getByText(/暂无转测版本/)).toBeInTheDocument();
    });
  });

  describe('添加转测版本', () => {
    it('点击"添加转测"应该添加新的转测版本', async () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText('添加转测'));

      await waitFor(() => {
        expect(screen.getByText('转测 1')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('例如：SIT1、UAT、灰度测试')).toBeInTheDocument();
      });
    });

    it('添加多个转测版本应该正确编号', async () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText('添加转测'));
      fireEvent.click(screen.getByText('添加转测'));

      await waitFor(() => {
        expect(screen.getByText('转测 1')).toBeInTheDocument();
        expect(screen.getByText('转测 2')).toBeInTheDocument();
      });
    });
  });

  describe('编辑转测版本', () => {
    it('应该能编辑转测版本名称', async () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText('添加转测'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('例如：SIT1、UAT、灰度测试')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('例如：SIT1、UAT、灰度测试');
      fireEvent.change(nameInput, { target: { value: 'SIT1' } });

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalled();
      });
    });

    it('应该能编辑转测版本描述', async () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText('添加转测'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('测试范围或注意事项...')).toBeInTheDocument();
      });

      const descInput = screen.getByPlaceholderText('测试范围或注意事项...');
      fireEvent.change(descInput, { target: { value: '第一轮集成测试' } });

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalled();
      });
    });
  });

  describe('删除转测版本', () => {
    it('点击删除按钮应该移除转测版本', async () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText('添加转测'));

      await waitFor(() => {
        expect(screen.getByText('转测 1')).toBeInTheDocument();
      });

      // 查找删除按钮（带有 Trash2 图标的按钮）
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find((btn) => btn.querySelector('svg.lucide-trash-2'));

      if (deleteButton) {
        fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(screen.queryByText('转测 1')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('从 data 恢复状态', () => {
    it('应该从 data 恢复已有的转测版本', () => {
      render(
        <CreateTestCyclesStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [],
            testCycles: [
              { name: 'SIT1', description: '第一轮' },
              { name: 'UAT', description: '用户验收' },
            ],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByDisplayValue('SIT1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('UAT')).toBeInTheDocument();
    });
  });

  describe('创建转测版本', () => {
    it('点击创建按钮应该调用 API', async () => {
      (api.createTestCycle as any).mockResolvedValue({});

      render(
        <CreateTestCyclesStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [],
            testCycles: [{ name: 'SIT1', description: '第一轮' }],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      const createButton = screen.getByRole('button', { name: /创建 1 个转测版本/ });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(api.createTestCycle).toHaveBeenCalledWith({
          versionId: 'version-123',
          name: 'SIT1',
        });
      });
    });

    it('创建中应该显示加载状态', async () => {
      (api.createTestCycle as any).mockImplementation(() => new Promise(() => {}));

      render(
        <CreateTestCyclesStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [],
            testCycles: [{ name: 'SIT1' }],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      const createButton = screen.getByRole('button', { name: /创建 1 个转测版本/ });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('创建中...')).toBeInTheDocument();
      });
    });
  });

  describe('创建按钮显示', () => {
    it('无转测版本时不应显示创建按钮', () => {
      render(
        <CreateTestCyclesStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByRole('button', { name: /创建.*个转测版本/ })).not.toBeInTheDocument();
    });

    it('有转测版本但无名称时应该显示创建 0 个', async () => {
      render(
        <CreateTestCyclesStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [],
            testCycles: [{ name: '', description: '' }],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('button', { name: /创建 0 个转测版本/ })).toBeInTheDocument();
    });
  });
});
