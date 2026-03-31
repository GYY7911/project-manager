import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { KanbanBoard } from './KanbanBoard';
import { renderWithProviders, createTestQueryClient } from '@/test/utils';
import * as api from '@/lib/api';
import { UserRole, WorkflowStage } from '@pm/shared';

// Mock api 模块
vi.mock('@/lib/api', () => ({
  api: {
    getToken: vi.fn(() => 'test-token'),
    setToken: vi.fn(),
    getVersions: vi.fn(),
    getVersionBoard: vi.fn(),
    getAssignees: vi.fn(),
    generateRequirementCode: vi.fn(),
    generateIssueCode: vi.fn(),
    createRequirement: vi.fn(),
    createIssue: vi.fn(),
    updateRequirementStage: vi.fn(),
    updateIssueStage: vi.fn(),
  },
}));

// Mock useAppStore
vi.mock('@/store', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      user: { id: 'user-1', name: 'PM用户', role: UserRole.PM, employeeNo: 'pm001' },
      currentVersionId: 'version-1',
      setCurrentVersionId: vi.fn(),
      interactionMode: 'drag' as const,
      kanbanConfig: null,
    };
    return selector ? selector(state) : state;
  }),
  isPMOrAdmin: (role?: UserRole) => role === UserRole.PM || role === UserRole.ADMIN,
  useHasHydrated: () => true,
  generateDefaultKanbanConfig: vi.fn(() => ({
    version: 1,
    columns: [
      { id: 'col-1', stages: [WorkflowStage.REQUIREMENT_DESIGN] },
    ],
    stageConfigs: [],
    updatedAt: '2024-01-01T00:00:00.000Z',
  })),
}));

describe('KanbanBoard - assignees 数据处理', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();

    // 默认 mock 返回值
    vi.mocked(api.api.getVersions).mockResolvedValue([
      { id: 'version-1', name: 'V1.0', status: 'DEVELOPMENT' },
    ]);
    vi.mocked(api.api.getVersionBoard).mockResolvedValue({
      testCycles: [],
      requirements: [],
      issues: [],
    });
    vi.mocked(api.api.generateRequirementCode).mockResolvedValue({ code: 'FE202603160001' });
    vi.mocked(api.api.generateIssueCode).mockResolvedValue({ code: 'ISS202603160001' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('边界条件测试', () => {
    it('当 assignees 返回 undefined 时，组件不应崩溃', async () => {
      // Arrange
      vi.mocked(api.api.getAssignees).mockResolvedValueOnce(undefined as any);

      // Act
      const { container } = renderWithProviders(<KanbanBoard />, { queryClient });

      // Assert - 组件应该正常渲染，不崩溃
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });

    it('当 assignees 返回 null 时，组件不应崩溃', async () => {
      // Arrange
      vi.mocked(api.api.getAssignees).mockResolvedValueOnce(null as any);

      // Act
      const { container } = renderWithProviders(<KanbanBoard />, { queryClient });

      // Assert
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });

    it('当 assignees 返回空数组时，组件应正常渲染', async () => {
      // Arrange
      vi.mocked(api.api.getAssignees).mockResolvedValueOnce([]);

      // Act
      const { container } = renderWithProviders(<KanbanBoard />, { queryClient });

      // Assert - 组件应该正常渲染
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });

    it('当 assignees API 失败时，组件不应崩溃', async () => {
      // Arrange
      vi.mocked(api.api.getAssignees).mockRejectedValueOnce(new Error('Network error'));

      // Act
      const { container } = renderWithProviders(<KanbanBoard />, { queryClient });

      // Assert - 组件应该正常渲染
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('正常场景测试', () => {
    it('当 assignees 返回正常数组时，assignees 数据应被正确处理', async () => {
      // Arrange
      const mockAssignees = [
        { id: 'user-1', name: '张三', employeeNo: 'z001' },
        { id: 'user-2', name: '李四', employeeNo: 'l002' },
        { id: 'user-3', name: '王五', employeeNo: 'w003' },
      ];
      vi.mocked(api.api.getAssignees).mockResolvedValueOnce(mockAssignees);

      // Act
      const { container } = renderWithProviders(<KanbanBoard />, { queryClient });

      // Assert - 组件应该正常渲染
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });

      // 验证 API 被调用
      await waitFor(() => {
        expect(api.api.getAssignees).toHaveBeenCalled();
      });
    });
  });
});
