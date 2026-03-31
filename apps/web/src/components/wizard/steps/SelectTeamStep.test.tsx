import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SelectTeamStep } from './SelectTeamStep';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    getUsers: vi.fn(),
  },
}));

// Mock router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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

describe('SelectTeamStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('加载状态', () => {
    it('应该显示加载提示', async () => {
      (api.getUsers as any).mockImplementation(() => new Promise(() => {}));

      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('加载用户列表...')).toBeInTheDocument();
    });
  });

  describe('无用户状态', () => {
    it('应该显示空状态提示', async () => {
      (api.getUsers as any).mockResolvedValue([]);

      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('还没有可分配的团队成员')).toBeInTheDocument();
      });
    });

    it('应该显示"前往用户管理"按钮', async () => {
      (api.getUsers as any).mockResolvedValue([]);

      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('前往用户管理')).toBeInTheDocument();
      });
    });
  });

  describe('有用户状态', () => {
    const mockUsers = [
      { id: 'user-1', name: '张三', employeeNo: 'E001', team: '开发组' },
      { id: 'user-2', name: '李四', employeeNo: 'E002', team: '测试组' },
      { id: 'user-3', name: '王五', employeeNo: 'E003', team: '产品组' },
    ];

    beforeEach(() => {
      (api.getUsers as any).mockResolvedValue(mockUsers);
    });

    it('应该显示所有用户', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
        expect(screen.getByText('李四')).toBeInTheDocument();
        expect(screen.getByText('王五')).toBeInTheDocument();
      });
    });

    it('点击用户应该选中/取消选中', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
      });

      // 点击选中
      fireEvent.click(screen.getByText('张三').closest('button')!);

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalledWith({ teamMemberIds: ['user-1'] });
      });
    });

    it('选中用户后应该显示已选择数量', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: ['user-1', 'user-2'], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('已选择 2 人')).toBeInTheDocument();
      });
    });

    it('未选择用户时应该显示选择建议', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('选择建议')).toBeInTheDocument();
      });
    });

    it('应该从 data 恢复已选中的用户', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: ['user-1'], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // 检查 user-1 对应的按钮是否有选中样式
        const userButton = screen.getByText('张三').closest('button');
        expect(userButton).toHaveClass('border-primary');
      });
    });
  });

  describe('用户信息显示', () => {
    const mockUsers = [
      { id: 'user-1', name: '张三', employeeNo: 'E001', team: '开发组' },
    ];

    beforeEach(() => {
      (api.getUsers as any).mockResolvedValue(mockUsers);
    });

    it('应该显示用户工号', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/E001/)).toBeInTheDocument();
      });
    });

    it('应该显示用户团队', async () => {
      render(
        <SelectTeamStep
          data={{ teamMemberIds: [], version: null, requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/开发组/)).toBeInTheDocument();
      });
    });
  });
});
