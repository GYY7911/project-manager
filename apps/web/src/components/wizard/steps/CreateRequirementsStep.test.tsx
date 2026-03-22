import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateRequirementsStep } from './CreateRequirementsStep';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    getAssignees: vi.fn(),
    getUsers: vi.fn(),
    generateRequirementCode: vi.fn(),
    createRequirement: vi.fn(),
  },
}));

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
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

describe('CreateRequirementsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('加载状态', () => {
    it('应该显示加载提示', async () => {
      (api.getAssignees as any).mockImplementation(() => new Promise(() => {}));

      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('加载负责人列表...')).toBeInTheDocument();
    });
  });

  describe('无负责人状态（assignees 和 users 都为空）', () => {
    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue([]);
      (api.getUsers as any).mockResolvedValue([]);
    });

    it('应该显示空状态提示', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('需要先有组员才能创建需求')).toBeInTheDocument();
      });
    });

    it('应该显示"前往用户管理"按钮', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('前往用户管理')).toBeInTheDocument();
      });
    });

    it('点击"跳过此步"应该跳转', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('跳过此步')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('跳过此步'));

      expect(mockPush).toHaveBeenCalledWith('/onboard');
    });

    it('点击"前往用户管理"应该跳转', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('前往用户管理')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('前往用户管理'));

      expect(mockPush).toHaveBeenCalledWith('/users');
    });
  });

  describe('Fallback 逻辑 - assignees 为空但 users 有数据', () => {
    const mockUsers = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
      { id: 'user-2', name: '李四', employeeNo: 'E002' },
    ];

    beforeEach(() => {
      // assignees 返回空，但 users 有数据
      (api.getAssignees as any).mockResolvedValue([]);
      (api.getUsers as any).mockResolvedValue(mockUsers);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });
    });

    it('应该正常显示需求表单（不显示空状态）', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // 应该显示需求表单元素，而不是空状态提示
        expect(screen.getByText('批量导入')).toBeInTheDocument();
        expect(screen.getByText('添加需求')).toBeInTheDocument();
        expect(screen.queryByText('需要先有组员才能创建需求')).not.toBeInTheDocument();
      });
    });

    it('应该使用 users 数据作为负责人选项', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('批量导入')).toBeInTheDocument();
      });

      // 验证下拉框中有从 users 获取的负责人选项
      const selectTrigger = screen.getByText('选择负责人');
      fireEvent.click(selectTrigger);

      await waitFor(() => {
        expect(screen.getByText('张三 (E001)')).toBeInTheDocument();
        expect(screen.getByText('李四 (E002)')).toBeInTheDocument();
      });
    });

    it('在 assignees 请求完成后等待 users 请求时，不应该短暂显示空状态（竞态条件修复验证）', async () => {
      // 使用延迟的 users 请求来模拟竞态条件
      let resolveUsers: (value: any) => void;
      const usersPromise = new Promise((resolve) => {
        resolveUsers = resolve;
      });

      (api.getAssignees as any).mockResolvedValue([]);
      (api.getUsers as any).mockImplementation(() => usersPromise);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });

      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      // 等待 assignees 请求完成
      await waitFor(() => {
        expect(api.getAssignees).toHaveBeenCalled();
      });

      // 在 users 请求完成前，应该显示加载状态，而不是空状态
      // 此时 isLoading 应该为 true（因为 shouldFetchUsers && isUsersLoading）
      expect(screen.queryByText('需要先有组员才能创建需求')).not.toBeInTheDocument();

      // 完成 users 请求
      resolveUsers!([
        { id: 'user-1', name: '张三', employeeNo: 'E001' },
      ]);

      // 现在应该显示需求表单
      await waitFor(() => {
        expect(screen.getByText('批量导入')).toBeInTheDocument();
        expect(screen.queryByText('需要先有组员才能创建需求')).not.toBeInTheDocument();
      });
    });
  });

  describe('有负责人状态', () => {
    const mockAssignees = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
      { id: 'user-2', name: '李四', employeeNo: 'E002' },
    ];

    const mockUsers = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
      { id: 'user-2', name: '李四', employeeNo: 'E002' },
    ];

    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue(mockAssignees);
      (api.getUsers as any).mockResolvedValue(mockUsers);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });
    });

    it('应该显示标题和操作按钮', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('批量导入')).toBeInTheDocument();
        expect(screen.getByText('添加需求')).toBeInTheDocument();
      });
    });

    it('有 versionId 时应该自动添加一个空需求', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(api.generateRequirementCode).toHaveBeenCalledWith('version-123');
      });
    });

    it('应该显示批量导入区域', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('批量导入')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('批量导入'));

      await waitFor(() => {
        expect(screen.getByText('批量导入需求')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/每行一个需求/)).toBeInTheDocument();
      });
    });

    it('点击"添加需求"应该添加新需求', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('添加需求')).toBeInTheDocument();
      });

      // 初始会自动添加一个，点击添加另一个
      fireEvent.click(screen.getByText('添加需求'));

      await waitFor(() => {
        // generateCode 应该被调用两次（初始 + 点击）
        expect(api.generateRequirementCode).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('需求表单操作', () => {
    const mockAssignees = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
    ];

    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue(mockAssignees);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });
      (api.createRequirement as any).mockResolvedValue({});
    });

    it('应该能填写需求标题', async () => {
      render(
        <CreateRequirementsStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [{ code: 'REQ-001', title: '', assigneeId: '' }],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('需求标题')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('需求标题'), {
        target: { value: '用户登录功能' },
      });

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalled();
      });
    });

    it('创建按钮应该显示可创建数量', async () => {
      render(
        <CreateRequirementsStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [
              { code: 'REQ-001', title: '需求1', assigneeId: 'user-1' },
              { code: 'REQ-002', title: '', assigneeId: '' },
            ],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /创建 1 个需求/ })).toBeInTheDocument();
      });
    });
  });

  describe('从 data 恢复状态', () => {
    const mockAssignees = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
    ];

    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue(mockAssignees);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-002' });
    });

    it('应该从 data 恢复已创建的需求', async () => {
      render(
        <CreateRequirementsStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [
              { code: 'REQ-001', title: '已保存的需求', assigneeId: 'user-1', workload: 8 },
            ],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('已保存的需求');
        expect(titleInput).toBeInTheDocument();
      });
    });
  });

  describe('创建需求', () => {
    const mockAssignees = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
    ];

    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue(mockAssignees);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });
      (api.createRequirement as any).mockResolvedValue({});
    });

    it('点击创建应该调用 API', async () => {
      render(
        <CreateRequirementsStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [
              { code: 'REQ-001', title: '需求1', assigneeId: 'user-1' },
            ],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /创建 1 个需求/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /创建 1 个需求/ }));

      await waitFor(() => {
        expect(api.createRequirement).toHaveBeenCalledWith({
          code: 'REQ-001',
          title: '需求1',
          versionId: 'version-123',
          assigneeId: 'user-1',
          workload: undefined,
          dueDate: undefined,
        });
      });
    });

    it('无 versionId 时创建按钮应该禁用', async () => {
      render(
        <CreateRequirementsStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [
              { code: 'REQ-001', title: '需求1', assigneeId: 'user-1' },
            ],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          versionId={null}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /创建 1 个需求/ })).toBeDisabled();
      });
    });
  });

  describe('API 异常处理', () => {
    it('当 assignees API 失败但 users 成功时，应该使用 users 作为负责人列表', async () => {
      const mockUsers = [
        { id: 'user-1', name: '张三', employeeNo: 'E001' },
      ];

      // assignees 失败，users 成功
      (api.getAssignees as any).mockRejectedValue(new Error('Network error'));
      (api.getUsers as any).mockResolvedValue(mockUsers);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });

      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // 应该显示需求表单，而不是空状态
        expect(screen.getByText('批量导入')).toBeInTheDocument();
        expect(screen.queryByText('需要先有组员才能创建需求')).not.toBeInTheDocument();
      });
    });

    it('当两个 API 都失败时，应该显示空状态', async () => {
      // 两个 API 都失败
      const networkError = new Error('Network error');
      const authError = new Error('Unauthorized');
      (api.getAssignees as any).mockRejectedValue(networkError);
      (api.getUsers as any).mockRejectedValue(authError);

      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('需要先有组员才能创建需求')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('当 assignees 返回空数组且 users 也返回空数组时，应该显示空状态', async () => {
      // 两个 API 都返回空数组
      (api.getAssignees as any).mockResolvedValue([]);
      (api.getUsers as any).mockResolvedValue([]);

      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('需要先有组员才能创建需求')).toBeInTheDocument();
      });
    });

  });

  describe('批量导入', () => {
    const mockAssignees = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
    ];

    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue(mockAssignees);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-NEW' });
    });

    it('应该能批量导入需求', async () => {
      render(
        <CreateRequirementsStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('批量导入')).toBeInTheDocument();
      });

      // 打开批量导入面板
      fireEvent.click(screen.getByText('批量导入'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/每行一个需求/)).toBeInTheDocument();
      });

      // 输入批量数据
      const textarea = screen.getByPlaceholderText(/每行一个需求/);
      fireEvent.change(textarea, {
        target: { value: '用户登录功能 [张三] [8]' },
      });

      // 点击导入
      fireEvent.click(screen.getByRole('button', { name: '导入' }));

      await waitFor(() => {
        expect(api.generateRequirementCode).toHaveBeenCalled();
      });
    });
  });

  describe('删除需求', () => {
    const mockAssignees = [
      { id: 'user-1', name: '张三', employeeNo: 'E001' },
    ];

    beforeEach(() => {
      (api.getAssignees as any).mockResolvedValue(mockAssignees);
      (api.generateRequirementCode as any).mockResolvedValue({ code: 'REQ-001' });
    });

    it('点击删除按钮应该移除需求', async () => {
      render(
        <CreateRequirementsStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [
              { code: 'REQ-001', title: '需求1', assigneeId: 'user-1' },
            ],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          versionId="version-123"
        />,
        { wrapper: createWrapper() }
      );

      // 等待表单渲染并查找标题输入框
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('需求1');
        expect(titleInput).toBeInTheDocument();
      });

      // 查找并点击删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find((btn) => {
        const svg = btn.querySelector('svg.lucide-trash-2');
        return svg !== null;
      });

      if (deleteButton) {
        fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText('暂无需求')).toBeInTheDocument();
        });
      }
    });
  });
});
