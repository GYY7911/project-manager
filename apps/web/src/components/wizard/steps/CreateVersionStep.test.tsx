import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateVersionStep } from './CreateVersionStep';

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    createOrUseVersion: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockUpdateData = vi.fn();
const mockOnNext = vi.fn();
const mockOnCreatedVersion = vi.fn();

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

describe('CreateVersionStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该显示标题', () => {
      render(
        <CreateVersionStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      // 组件标题已更新为 "创建你的第一个版本迭代"
      // 使用 getAllByText 来处理多个匹配的情况
      const matchingElements = screen.getAllByText(/创建.*版本/);
      expect(matchingElements.length).toBeGreaterThan(0);
    });

    it('应该显示版本名称输入框', () => {
      render(
        <CreateVersionStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText(/版本名称/)).toBeInTheDocument();
    });

    it('应该显示版本描述输入框', () => {
      render(
        <CreateVersionStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText(/版本描述/)).toBeInTheDocument();
    });

    it('创建按钮初始应该禁用', () => {
      render(
        <CreateVersionStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', { name: /创建版本并继续/ });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('表单验证', () => {
    it('填写版本名称后应该更新输入值', async () => {
      render(
        <CreateVersionStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      // 填写版本名称
      fireEvent.change(screen.getByLabelText(/版本名称/), {
        target: { value: 'V1.0.0' },
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/版本名称/) as HTMLInputElement;
        expect(nameInput.value).toBe('V1.0.0');
      });
    });
  });

  describe('从 data 恢复状态', () => {
    it('应该从 data 恢复版本名称', () => {
      render(
        <CreateVersionStep
          data={{
            version: { name: 'V2.0.0', startDate: '2026-02-01', endDate: '2026-02-28', description: '测试描述' },
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      const nameInput = screen.getByLabelText(/版本名称/) as HTMLInputElement;
      expect(nameInput.value).toBe('V2.0.0');
    });

    it('应该从 data 恢复版本描述', () => {
      render(
        <CreateVersionStep
          data={{
            version: { name: 'V2.0.0', startDate: '2026-02-01', endDate: '2026-02-28', description: '测试描述' },
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      const descInput = screen.getByLabelText(/版本描述/) as HTMLTextAreaElement;
      expect(descInput.value).toBe('测试描述');
    });
  });

  describe('创建版本成功', () => {
    it('成功创建应该调用回调函数', async () => {
      (api.createOrUseVersion as any).mockResolvedValue({ id: 'version-123' });

      render(
        <CreateVersionStep
          data={{
            version: { name: 'V1.0.0', startDate: '2026-01-01', endDate: '2026-01-31' },
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', { name: /创建版本并继续/ });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.createOrUseVersion).toHaveBeenCalledWith({
          name: 'V1.0.0',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        });
        expect(mockOnCreatedVersion).toHaveBeenCalledWith('version-123');
        expect(mockOnNext).toHaveBeenCalled();
      });
    });
  });

  describe('版本已存在处理', () => {
    it('版本已存在时应该显示对话框', async () => {
      const existingVersion = {
        id: 'existing-123',
        name: 'V1.0.0',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        status: 'PLANNING',
        requirementsCount: 5,
      };

      const error = {
        response: { data: { existingVersion } },
      };
      (api.createOrUseVersion as any).mockRejectedValue(error);

      render(
        <CreateVersionStep
          data={{
            version: { name: 'V1.0.0', startDate: '2026-01-01', endDate: '2026-01-31' },
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', { name: /创建版本并继续/ });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('版本名称已存在')).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('其他错误应该显示错误消息', async () => {
      const error = new Error('网络错误');
      (api.createOrUseVersion as any).mockRejectedValue(error);

      render(
        <CreateVersionStep
          data={{
            version: { name: 'V1.0.0', startDate: '2026-01-01', endDate: '2026-01-31' },
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          updateData={mockUpdateData}
          onNext={mockOnNext}
          onCreatedVersion={mockOnCreatedVersion}
        />,
        { wrapper: createWrapper() }
      );

      const submitButton = screen.getByRole('button', { name: /创建版本并继续/ });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('网络错误')).toBeInTheDocument();
      });
    });
  });
});
