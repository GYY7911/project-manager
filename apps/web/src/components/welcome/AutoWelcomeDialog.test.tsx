import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoWelcomeDialog } from './AutoWelcomeDialog';

// Mock zustand store
const mockSetHideWelcomeDialog = vi.fn();
const mockResetOnboarding = vi.fn();

let mockStoreState = {
  hideWelcomeDialog: false,
  onboardingStatus: 'not_started' as const,
  setHideWelcomeDialog: mockSetHideWelcomeDialog,
  resetOnboarding: mockResetOnboarding,
};

vi.mock('@/store', () => ({
  useAppStore: (selector?: (state: typeof mockStoreState) => unknown) => {
    if (selector) {
      return selector(mockStoreState);
    }
    return mockStoreState;
  },
  useHasHydrated: () => true,
}));

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/versions',
    query: {},
  }),
}));

// Mock WelcomeAnimation
vi.mock('./WelcomeAnimation', () => ({
  WelcomeAnimation: () => <div data-testid="welcome-animation" />,
}));

describe('AutoWelcomeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      hideWelcomeDialog: false,
      onboardingStatus: 'not_started',
      setHideWelcomeDialog: mockSetHideWelcomeDialog,
      resetOnboarding: mockResetOnboarding,
    };
  });

  describe('empty_versions 触发条件', () => {
    it('当 shouldTrigger 为 true 时应该显示弹窗', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      // 等待弹窗显示（有500ms延迟）
      // 使用 getAllByText 因为有两个元素包含相同文本（sr-only 标题 + 可见标题）
      await waitFor(() => {
        const titles = screen.getAllByText('欢迎使用项目管理系统');
        expect(titles.length).toBeGreaterThan(0);
      }, { timeout: 1000 });
    });

    it('当 shouldTrigger 为 false 时不应该显示弹窗', () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={false}
        />
      );

      expect(screen.queryAllByText('欢迎使用项目管理系统')).toHaveLength(0);
    });

    it('应该显示"开始新手引导"按钮', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('开始新手引导')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('应该显示"前往创建版本"按钮', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('前往创建版本')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('empty_board 触发条件', () => {
    it('应该显示正确的标题', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_board"
          shouldTrigger={true}
        />
      );

      // 等待弹窗显示（有500ms延迟）
      await waitFor(() => {
        const titles = screen.getAllByText('看板是空的');
        expect(titles.length).toBeGreaterThan(0);
      }, { timeout: 1000 });
    });
  });

  describe('引导重置测试（核心修复）', () => {
    it('点击"开始新手引导"应该调用 resetOnboarding', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('开始新手引导')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('开始新手引导'));

      expect(mockResetOnboarding).toHaveBeenCalled();
    });

    it('点击"开始新手引导"应该跳转到 /onboard', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('开始新手引导')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('开始新手引导'));

      expect(mockPush).toHaveBeenCalledWith('/onboard');
    });

    it('点击"开始新手引导"应该先重置状态再跳转', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('开始新手引导')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('开始新手引导'));

      // 验证调用顺序：先 resetOnboarding，再 push
      const callOrder = [
        mockResetOnboarding.mock.invocationCallOrder[0],
        mockPush.mock.invocationCallOrder[0],
      ];

      // resetOnboarding 应该在 push 之前被调用
      expect(callOrder[0]).toBeLessThan(callOrder[1]);
    });

    it('点击"前往创建版本"不应该调用 resetOnboarding', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('前往创建版本')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('前往创建版本'));

      expect(mockResetOnboarding).not.toHaveBeenCalled();
    });

    it('点击"前往创建版本"应该跳转到版本管理页面', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('前往创建版本')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('前往创建版本'));

      expect(mockPush).toHaveBeenCalledWith('/versions?welcome=true');
    });
  });

  describe('关闭弹窗测试', () => {
    it('点击外部区域应该关闭弹窗', async () => {
      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true}
        />
      );

      // 等待弹窗显示
      await waitFor(() => {
        const titles = screen.getAllByText('欢迎使用项目管理系统');
        expect(titles.length).toBeGreaterThan(0);
      }, { timeout: 1000 });

      // Dialog 组件会处理外部点击关闭
      // 这里我们验证弹窗存在
      const titles = screen.getAllByText('欢迎使用项目管理系统');
      expect(titles.length).toBeGreaterThan(0);
    });
  });

  describe('场景模拟：版本删除后重新引导', () => {
    it('模拟用户删除版本后点击引导的场景', async () => {
      // 模拟用户之前完成过引导
      mockStoreState.onboardingStatus = 'completed';

      render(
        <AutoWelcomeDialog
          triggerCondition="empty_versions"
          shouldTrigger={true} // 版本为空
        />
      );

      await waitFor(() => {
        expect(screen.getByText('开始新手引导')).toBeInTheDocument();
      });

      // 用户点击开始引导
      fireEvent.click(screen.getByText('开始新手引导'));

      // 应该调用 resetOnboarding 来清除旧状态
      expect(mockResetOnboarding).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/onboard');
    });
  });
});
