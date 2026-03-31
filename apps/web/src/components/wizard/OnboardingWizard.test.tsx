import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingWizard } from './OnboardingWizard';
import { ReactElement } from 'react';

// 创建测试用的 QueryClient
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

// 测试包装器
function renderWithProviders(ui: ReactElement) {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// Mock zustand store
const mockSetCurrentVersionId = vi.fn();
const mockSetOnboardingStatus = vi.fn();
const mockSetOnboardingData = vi.fn();
const mockSetOnboardingCurrentStep = vi.fn();
const mockSetOnboardingCreatedVersionId = vi.fn();

let mockStoreState = {
  currentVersionId: null,
  onboardingStatus: 'not_started' as const,
  onboardingData: null,
  onboardingCurrentStep: 0,
  onboardingCreatedVersionId: null,
  setCurrentVersionId: mockSetCurrentVersionId,
  setOnboardingStatus: mockSetOnboardingStatus,
  setOnboardingData: mockSetOnboardingData,
  setOnboardingCurrentStep: mockSetOnboardingCurrentStep,
  setOnboardingCreatedVersionId: mockSetOnboardingCreatedVersionId,
};

vi.mock('@/store', () => ({
  useAppStore: (selector?: (state: typeof mockStoreState) => unknown) => {
    if (selector) {
      return selector(mockStoreState);
    }
    return mockStoreState;
  },
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
    pathname: '/onboard',
    query: {},
  }),
}));

// Mock step components to simplify testing
vi.mock('./steps/CreateVersionStep', () => ({
  CreateVersionStep: ({ onNext, onCreatedVersion }: { onNext: () => void; onCreatedVersion: (id: string) => void }) => (
    <div data-testid="create-version-step">
      <h2>创建版本步骤</h2>
      <button onClick={() => { onCreatedVersion('version-123'); onNext(); }}>
        创建版本
      </button>
    </div>
  ),
}));

// SelectTeamStep 已被移除

vi.mock('./steps/CreateRequirementsStep', () => ({
  CreateRequirementsStep: () => (
    <div data-testid="create-requirements-step">
      <h2>创建需求步骤</h2>
    </div>
  ),
}));

vi.mock('./steps/CreateTestCyclesStep', () => ({
  CreateTestCyclesStep: () => (
    <div data-testid="create-test-cycles-step">
      <h2>创建转测版本步骤</h2>
    </div>
  ),
}));

vi.mock('./steps/CompleteStep', () => ({
  CompleteStep: () => (
    <div data-testid="complete-step">
      <h2>完成步骤</h2>
    </div>
  ),
}));

vi.mock('./WizardStepper', () => ({
  WizardStepper: ({ steps, currentStep }: { steps: Array<{ id: number; name: string }>; currentStep: number }) => (
    <div data-testid="wizard-stepper">
      {steps.map((step) => (
        <span key={step.id} data-active={step.id === currentStep}>
          {step.name}
        </span>
      ))}
    </div>
  ),
}));

// Mock API
const mockGenerateRequirementCode = vi.fn();
const mockCreateRequirement = vi.fn();
const mockGenerateIssueCode = vi.fn();
const mockCreateIssue = vi.fn();
const mockCreateTestCycle = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    generateRequirementCode: (...args: unknown[]) => mockGenerateRequirementCode(...args),
    createRequirement: (...args: unknown[]) => mockCreateRequirement(...args),
    generateIssueCode: (...args: unknown[]) => mockGenerateIssueCode(...args),
    createIssue: (...args: unknown[]) => mockCreateIssue(...args),
    createTestCycle: (...args: unknown[]) => mockCreateTestCycle(...args),
  },
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    mockStoreState = {
      currentVersionId: null,
      onboardingStatus: 'not_started',
      onboardingData: null,
      onboardingCurrentStep: 0,
      onboardingCreatedVersionId: null,
      setCurrentVersionId: mockSetCurrentVersionId,
      setOnboardingStatus: mockSetOnboardingStatus,
      setOnboardingData: mockSetOnboardingData,
      setOnboardingCurrentStep: mockSetOnboardingCurrentStep,
      setOnboardingCreatedVersionId: mockSetOnboardingCreatedVersionId,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该正确渲染标题', () => {
      renderWithProviders(<OnboardingWizard />);
      // 步骤 0 的标题是 "创建第一个版本"
      expect(screen.getByText('创建第一个版本')).toBeInTheDocument();
    });

    it('应该渲染步骤指示器', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByTestId('wizard-stepper')).toBeInTheDocument();
    });

    it('初始状态应该显示创建版本步骤', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByTestId('create-version-step')).toBeInTheDocument();
    });

    it('步骤指示器应该显示当前步骤', () => {
      renderWithProviders(<OnboardingWizard />);
      // 检查步骤 0（创建版本）是否被标记为 active
      const stepper = screen.getByTestId('wizard-stepper');
      const activeStep = stepper.querySelector('[data-active="true"]');
      expect(activeStep).toHaveTextContent('创建版本');
    });
  });

  describe('步骤 0（创建版本）导航测试', () => {
    it('应该显示"跳过引导"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      // 页面有两处"跳过引导"（右上角和左下角）
      const skipButtons = screen.getAllByText('跳过引导');
      expect(skipButtons.length).toBeGreaterThan(0);
    });

    it('步骤 0 不应该显示"上一步"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.queryByText('上一步')).not.toBeInTheDocument();
    });

    it('步骤 0 不应该显示"跳过此步"按钮（因为是必需步骤）', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.queryByText('跳过此步')).not.toBeInTheDocument();
    });

    it('点击"跳过引导"应该跳转到看板页面', async () => {
      renderWithProviders(<OnboardingWizard />);
      // 点击第一个"跳过引导"按钮（右上角）
      const skipButtons = screen.getAllByText('跳过引导');
      fireEvent.click(skipButtons[0]);

      await waitFor(() => {
        expect(mockSetOnboardingStatus).toHaveBeenCalledWith('skipped');
        expect(mockPush).toHaveBeenCalledWith('/board');
      });
    });

    it('完成创建版本后应该进入步骤 1（创建需求）', async () => {
      renderWithProviders(<OnboardingWizard />);

      // 点击"创建版本"按钮（mock 组件中提供）- 使用 button 选择器避免匹配 stepper
      const createButton = screen.getByRole('button', { name: '创建版本' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByTestId('create-requirements-step')).toBeInTheDocument();
      });
    });

    it('完成创建版本后应该调用 setOnboardingCreatedVersionId', async () => {
      renderWithProviders(<OnboardingWizard />);

      const createButton = screen.getByRole('button', { name: '创建版本' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockSetOnboardingCreatedVersionId).toHaveBeenCalledWith('version-123');
      });
    });
  });

  describe('步骤 1（创建需求）导航测试', () => {
    beforeEach(() => {
      mockStoreState.onboardingCurrentStep = 1;
    });

    it('应该显示"上一步"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('上一步')).toBeInTheDocument();
    });

    it('应该显示"跳过此步"按钮（非必需步骤）', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('跳过此步')).toBeInTheDocument();
    });

    it('应该显示"下一步"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('下一步')).toBeInTheDocument();
    });

    it('点击"上一步"应该返回步骤 0', async () => {
      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('上一步'));

      await waitFor(() => {
        expect(screen.getByTestId('create-version-step')).toBeInTheDocument();
      });
    });

    it('点击"下一步"应该进入步骤 2（创建转测版本）', async () => {
      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('下一步'));

      await waitFor(() => {
        expect(screen.getByTestId('create-test-cycles-step')).toBeInTheDocument();
      });
    });

    it('点击"跳过此步"应该跳到步骤 2（创建转测版本）', async () => {
      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('跳过此步'));

      await waitFor(() => {
        expect(screen.getByTestId('create-test-cycles-step')).toBeInTheDocument();
      });
    });
  });

  describe('步骤 2（创建转测版本）导航测试', () => {
    beforeEach(() => {
      mockStoreState.onboardingCurrentStep = 2;
    });

    it('应该显示"上一步"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('上一步')).toBeInTheDocument();
    });

    it('应该显示"跳过此步"按钮（非必需步骤）', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('跳过此步')).toBeInTheDocument();
    });

    it('应该显示"下一步"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('下一步')).toBeInTheDocument();
    });

    it('点击"下一步"应该进入步骤 3（完成）', async () => {
      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('下一步'));

      await waitFor(() => {
        expect(screen.getByTestId('complete-step')).toBeInTheDocument();
      });
    });
  });

  describe('步骤 3（完成）导航测试', () => {
    beforeEach(() => {
      mockStoreState.onboardingCurrentStep = 3;
    });

    it('应该显示"进入看板"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('进入看板')).toBeInTheDocument();
    });

    it('应该显示"跳过"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      expect(screen.getByText('跳过')).toBeInTheDocument();
    });

    it('应该显示"上一步"按钮', () => {
      renderWithProviders(<OnboardingWizard />);
      // 步骤 3 不是第一步，所以显示"上一步"按钮
      expect(screen.getByText('上一步')).toBeInTheDocument();
    });

    it('点击"进入看板"应该完成引导并跳转', async () => {
      mockStoreState.onboardingCreatedVersionId = 'version-123';
      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('进入看板'));

      await waitFor(() => {
        expect(mockSetOnboardingStatus).toHaveBeenCalledWith('completed');
        expect(mockSetCurrentVersionId).toHaveBeenCalledWith('version-123');
        expect(mockPush).toHaveBeenCalledWith('/board');
      });
    });

    it('点击"跳过"应该跳过引导', async () => {
      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('跳过'));

      await waitFor(() => {
        expect(mockSetOnboardingStatus).toHaveBeenCalledWith('skipped');
        expect(mockPush).toHaveBeenCalledWith('/board');
      });
    });
  });

  describe('状态持久化测试', () => {
    it('组件挂载时应该设置引导状态为 in_progress', async () => {
      renderWithProviders(<OnboardingWizard />);

      await waitFor(() => {
        expect(mockSetOnboardingStatus).toHaveBeenCalledWith('in_progress');
      });
    });

    it('已经是 in_progress 时不应该重复设置', async () => {
      mockStoreState.onboardingStatus = 'in_progress';
      renderWithProviders(<OnboardingWizard />);

      // 等待 useEffect 执行
      await waitFor(() => {
        expect(mockSetOnboardingStatus).not.toHaveBeenCalled();
      });
    });

    it('步骤变化时应该调用 setOnboardingCurrentStep', async () => {
      // 先设置步骤 1，然后再渲染
      mockStoreState.onboardingCurrentStep = 1;
      renderWithProviders(<OnboardingWizard />);

      // 有多个"下一步"按钮，选择第一个
      const nextButtons = screen.getAllByText('下一步');
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        expect(mockSetOnboardingCurrentStep).toHaveBeenCalledWith(2);
      });
    });
  });

  describe('从 store 恢复状态测试', () => {
    it('应该从 store 恢复当前步骤', () => {
      // 步骤1现在是"创建需求"
      mockStoreState.onboardingCurrentStep = 1;
      renderWithProviders(<OnboardingWizard />);

      expect(screen.getByTestId('create-requirements-step')).toBeInTheDocument();
    });

    it('应该从 store 恢复引导数据', () => {
      mockStoreState.onboardingData = {
        version: { name: 'V1.0', startDate: '2026-01-01', endDate: '2026-01-31' },
        teamMemberIds: ['user-1'],
        requirements: [],
        testCycles: [],
      };
      // 步骤2现在是"创建转测版本"
      mockStoreState.onboardingCurrentStep = 2;

      renderWithProviders(<OnboardingWizard />);

      // 组件应该正常渲染，不会因为数据而崩溃
      expect(screen.getByTestId('create-test-cycles-step')).toBeInTheDocument();
    });
  });

  describe('边界条件测试', () => {
    it('步骤 0 时点击"上一步"不应该崩溃', () => {
      renderWithProviders(<OnboardingWizard />);

      // 步骤 0 没有"上一步"按钮，所以无需测试
      expect(screen.queryByText('上一步')).not.toBeInTheDocument();
    });

    it('步骤 3 是最后一步，不应该超出范围', () => {
      // 步骤只有 0-3，步骤 3 是最后一步
      mockStoreState.onboardingCurrentStep = 3;
      renderWithProviders(<OnboardingWizard />);

      // 应该显示"进入看板"按钮
      expect(screen.getByText('进入看板')).toBeInTheDocument();
    });
  });

  describe('重新开始引导测试', () => {
    it('当 onboardingStatus 为 completed 时应该重置状态并从步骤 0 开始', async () => {
      // 模拟用户已完成引导，但版本被删除后重新进入引导页面
      mockStoreState.onboardingStatus = 'completed';
      mockStoreState.onboardingCurrentStep = 3; // 之前在完成步骤
      mockStoreState.onboardingData = {
        version: { name: 'V1.0', startDate: '2026-01-01', endDate: '2026-01-31' },
        teamMemberIds: ['user-1'],
        requirements: [{ code: 'FE001', title: '需求1', assigneeId: 'user-1' }],
        testCycles: [{ name: '转测1' }],
      };
      mockStoreState.onboardingCreatedVersionId = 'old-version-id';

      renderWithProviders(<OnboardingWizard />);

      // 应该显示创建版本步骤（步骤 0），而不是完成步骤（步骤 3）
      await waitFor(() => {
        expect(screen.getByTestId('create-version-step')).toBeInTheDocument();
      });

      // 应该设置状态为 in_progress
      expect(mockSetOnboardingStatus).toHaveBeenCalledWith('in_progress');
    });

    it('当 onboardingStatus 为 completed 时不应该恢复旧数据', async () => {
      mockStoreState.onboardingStatus = 'completed';
      mockStoreState.onboardingCurrentStep = 3;
      mockStoreState.onboardingCreatedVersionId = 'old-version-id';

      renderWithProviders(<OnboardingWizard />);

      // 组件应该从步骤 0 开始，忽略旧的步骤 3
      expect(screen.getByTestId('create-version-step')).toBeInTheDocument();
    });

    it('当 onboardingStatus 为 skipped 时应该恢复状态并设置为 in_progress', async () => {
      mockStoreState.onboardingStatus = 'skipped';
      mockStoreState.onboardingCurrentStep = 2;

      renderWithProviders(<OnboardingWizard />);

      // skipped 不是 'not_started' 或 'completed'，所以会恢复状态（步骤 2）
      expect(screen.getByTestId('create-test-cycles-step')).toBeInTheDocument();

      // skipped 状态进入引导页面时也应该设置为 in_progress
      await waitFor(() => {
        expect(mockSetOnboardingStatus).toHaveBeenCalledWith('in_progress');
      });
    });
  });

  describe('需求创建时的 code 生成测试（核心修复）', () => {
    it('点击"进入看板"时应该为每个需求重新生成唯一 code', async () => {
      mockStoreState.onboardingCurrentStep = 3;
      mockStoreState.onboardingCreatedVersionId = 'version-123';
      // 模拟用户添加了 3 个需求，它们可能有相同的 code（并发生成时的 bug）
      mockStoreState.onboardingData = {
        version: { name: 'V1.0', startDate: '2026-01-01', endDate: '2026-01-31' },
        teamMemberIds: [],
        requirements: [
          { code: 'REQ001', title: '需求1', assigneeId: 'user-1' },
          { code: 'REQ001', title: '需求2', assigneeId: 'user-2' }, // 相同的 code
          { code: 'REQ001', title: '需求3', assigneeId: 'user-3' }, // 相同的 code
        ],
        testCycles: [],
      };

      // 模拟 API 每次返回不同的 code
      mockGenerateRequirementCode
        .mockResolvedValueOnce({ code: 'REQ001' })
        .mockResolvedValueOnce({ code: 'REQ002' })
        .mockResolvedValueOnce({ code: 'REQ003' });
      mockCreateRequirement.mockResolvedValue({ id: 'req-id' });

      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('进入看板'));

      await waitFor(() => {
        // 应该为每个需求调用一次 generateRequirementCode
        expect(mockGenerateRequirementCode).toHaveBeenCalledTimes(3);
        expect(mockGenerateRequirementCode).toHaveBeenCalledWith('version-123');
      });

      // 应该创建 3 个需求，每个使用新生成的 code
      expect(mockCreateRequirement).toHaveBeenCalledTimes(3);
      expect(mockCreateRequirement).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'REQ001', title: '需求1' })
      );
      expect(mockCreateRequirement).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'REQ002', title: '需求2' })
      );
      expect(mockCreateRequirement).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'REQ003', title: '需求3' })
      );
    });

    it('创建需求时应该按顺序生成 code，避免并发重复', async () => {
      mockStoreState.onboardingCurrentStep = 3;
      mockStoreState.onboardingCreatedVersionId = 'version-456';
      mockStoreState.onboardingData = {
        version: null,
        teamMemberIds: [],
        requirements: [
          { code: 'DUP001', title: '需求A', assigneeId: 'user-1', workload: 2 },
          { code: 'DUP001', title: '需求B', assigneeId: 'user-2', workload: 3 },
        ],
        testCycles: [],
      };

      // 记录调用顺序 - 使用局部变量
      let callCount = 0;
      const callOrder: string[] = [];

      // 重置并设置 mock 实现
      mockGenerateRequirementCode.mockReset();
      mockCreateRequirement.mockReset();

      mockGenerateRequirementCode.mockImplementation(async () => {
        callOrder.push(`gen-${callCount}`);
        callCount++;
        return { code: `REQ-${callCount}` };
      });
      mockCreateRequirement.mockImplementation(async (data: { code: string }) => {
        callOrder.push(`create-${data.code}`);
        return { id: `req-${data.code}` };
      });

      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('进入看板'));

      await waitFor(() => {
        expect(mockCreateRequirement).toHaveBeenCalledTimes(2);
      });

      // 验证顺序：先为第一个需求生成 code 并创建，再为第二个需求生成 code 并创建
      expect(callOrder).toEqual([
        'gen-0', 'create-REQ-1',
        'gen-1', 'create-REQ-2',
      ]);
    });

    it('如果需求没有 title 或 assigneeId 应该跳过创建', async () => {
      mockStoreState.onboardingCurrentStep = 3;
      mockStoreState.onboardingCreatedVersionId = 'version-123';
      mockStoreState.onboardingData = {
        version: null,
        teamMemberIds: [],
        requirements: [
          { code: 'REQ001', title: '需求1', assigneeId: 'user-1' },
          { code: 'REQ002', title: '', assigneeId: 'user-2' }, // 空 title
          { code: 'REQ003', title: '需求3', assigneeId: '' }, // 空 assigneeId
          { code: 'REQ004', title: '需求4', assigneeId: 'user-4' },
        ],
        testCycles: [],
      };

      mockGenerateRequirementCode.mockResolvedValue({ code: 'NEW-CODE' });
      mockCreateRequirement.mockResolvedValue({ id: 'req-id' });

      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('进入看板'));

      await waitFor(() => {
        // 只应该创建 2 个有效需求
        expect(mockCreateRequirement).toHaveBeenCalledTimes(2);
      });
    });

    it('需求创建失败不应该阻止整个流程', async () => {
      mockStoreState.onboardingCurrentStep = 3;
      mockStoreState.onboardingCreatedVersionId = 'version-123';
      mockStoreState.onboardingData = {
        version: null,
        teamMemberIds: [],
        requirements: [
          { code: 'REQ001', title: '需求1', assigneeId: 'user-1' },
          { code: 'REQ002', title: '需求2', assigneeId: 'user-2' },
        ],
        testCycles: [],
      };

      // 重置并设置 mock 实现
      mockGenerateRequirementCode.mockReset();
      mockCreateRequirement.mockReset();

      mockGenerateRequirementCode.mockResolvedValue({ code: 'NEW-CODE' });
      // 第一个需求创建失败，第二个成功
      mockCreateRequirement
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'req-id-2' });

      renderWithProviders(<OnboardingWizard />);

      fireEvent.click(screen.getByText('进入看板'));

      // 即使有错误也应该完成流程
      await waitFor(() => {
        expect(mockSetOnboardingStatus).toHaveBeenCalledWith('completed');
        expect(mockPush).toHaveBeenCalledWith('/board');
      });

      // 应该尝试创建两个需求
      expect(mockCreateRequirement).toHaveBeenCalledTimes(2);
    });
  });
});
