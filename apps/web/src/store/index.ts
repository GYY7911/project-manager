import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserRole, KanbanTemplateConfig, WorkflowStage, StageLabels, DefaultStageOrder, ColumnConfig, StageConfig } from '@pm/shared';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  employeeNo: string;
  role: UserRole;
  team?: string;
}

// 引导状态类型
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

// 引导数据类型
export interface OnboardingData {
  version: {
    name: string;
    startDate: string;
    endDate: string;
    description?: string;
  } | null;
  teamMemberIds: string[];
  requirements: Array<{
    code: string;
    title: string;
    assigneeId: string;
    workload?: number;
    dueDate?: string;
  }>;
  testCycles: Array<{
    name: string;
    description?: string;
  }>;
}

export type Theme = 'dark' | 'light';

// 生成默认看板配置
export function generateDefaultKanbanConfig(): KanbanTemplateConfig {
  // 静态阶段 - 每个阶段一列
  const staticStages: WorkflowStage[] = [
    WorkflowStage.REQUIREMENT_DESIGN,
    WorkflowStage.ALPHA_TEST_DESIGN,
    WorkflowStage.DOCUMENT_SIGN,
    WorkflowStage.FEATURE_DEV,
    WorkflowStage.ALPHA_CASE_DEV,
    WorkflowStage.SOP_UPGRADE,
  ];

  const columns: ColumnConfig[] = staticStages.map((stage, index) => ({
    id: `col-${stage}-${index}`,
    stages: [stage],
  }));

  // 预留转测列位置（动态列会在运行时插入）
  columns.push({
    id: 'col-version-test-placeholder',
    title: '版本转测',
    stages: [WorkflowStage.VERSION_TEST],
  });

  // 后续阶段
  columns.push({
    id: 'col-issue-fix',
    stages: [WorkflowStage.ISSUE_FIX],
  });

  columns.push({
    id: 'col-ccb-review',
    stages: [WorkflowStage.CCB_REVIEW],
  });

  columns.push({
    id: 'col-release',
    stages: [WorkflowStage.RELEASE],
  });

  const stageConfigs: StageConfig[] = DefaultStageOrder.map(stage => ({
    stage,
    customTitle: undefined,
    visible: true,
  }));

  return {
    version: 1,
    columns,
    stageConfigs,
    updatedAt: new Date().toISOString(),
  };
}

interface AppState {
  user: User | null;
  token: string | null;
  currentVersionId: string | null;
  interactionMode: 'drag' | 'click';
  theme: Theme;
  hideWelcomeDialog: boolean;
  onboardingStatus: OnboardingStatus;
  // 引导数据持久化
  onboardingData: OnboardingData | null;
  onboardingCurrentStep: number;
  onboardingCreatedVersionId: string | null;
  // 看板模板配置
  kanbanConfig: KanbanTemplateConfig | null;
  _hasHydrated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCurrentVersionId: (id: string | null) => void;
  setInteractionMode: (mode: 'drag' | 'click') => void;
  setTheme: (theme: Theme) => void;
  setHideWelcomeDialog: (hide: boolean) => void;
  setOnboardingStatus: (status: OnboardingStatus) => void;
  setOnboardingData: (data: OnboardingData | null) => void;
  setOnboardingCurrentStep: (step: number) => void;
  setOnboardingCreatedVersionId: (id: string | null) => void;
  resetOnboarding: () => void;
  // 看板配置操作
  setKanbanConfig: (config: KanbanTemplateConfig | null) => void;
  updateKanbanConfig: (updates: Partial<KanbanTemplateConfig>) => void;
  resetKanbanConfig: () => void;
  setHasHydrated: (state: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentVersionId: null,
      interactionMode: 'drag',
      theme: 'dark',
      hideWelcomeDialog: false,
      onboardingStatus: 'not_started',
      onboardingData: null,
      onboardingCurrentStep: 0,
      onboardingCreatedVersionId: null,
      kanbanConfig: null,
      _hasHydrated: false,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setCurrentVersionId: (id) => set({ currentVersionId: id }),
      setInteractionMode: (mode) => set({ interactionMode: mode }),
      setTheme: (theme) => set({ theme }),
      setHideWelcomeDialog: (hide) => set({ hideWelcomeDialog: hide }),
      setOnboardingStatus: (status) => set({ onboardingStatus: status }),
      setOnboardingData: (data) => set({ onboardingData: data }),
      setOnboardingCurrentStep: (step) => set({ onboardingCurrentStep: step }),
      setOnboardingCreatedVersionId: (id) => set({ onboardingCreatedVersionId: id }),
      resetOnboarding: () => set({
        onboardingData: null,
        onboardingCurrentStep: 0,
        onboardingCreatedVersionId: null,
        onboardingStatus: 'not_started',
        hideWelcomeDialog: false, // 同时重置欢迎对话框设置
      }),
      setKanbanConfig: (config) => set({ kanbanConfig: config }),
      updateKanbanConfig: (updates) => set((state) => ({
        kanbanConfig: state.kanbanConfig
          ? { ...state.kanbanConfig, ...updates, updatedAt: new Date().toISOString() }
          : generateDefaultKanbanConfig(),
      })),
      resetKanbanConfig: () => set({ kanbanConfig: generateDefaultKanbanConfig() }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      logout: () => set({
        user: null,
        token: null,
        onboardingStatus: 'not_started',
        onboardingData: null,
        onboardingCurrentStep: 0,
        onboardingCreatedVersionId: null,
      }),
    }),
    {
      name: 'pm-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        currentVersionId: state.currentVersionId,
        interactionMode: state.interactionMode,
        theme: state.theme,
        hideWelcomeDialog: state.hideWelcomeDialog,
        onboardingStatus: state.onboardingStatus,
        onboardingData: state.onboardingData,
        onboardingCurrentStep: state.onboardingCurrentStep,
        onboardingCreatedVersionId: state.onboardingCreatedVersionId,
        kanbanConfig: state.kanbanConfig,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // 在 hydration 完成时同步 token 到 api 客户端
        if (state?.token) {
          api.setToken(state.token);
        }
      },
    }
  )
);

// Hook to check if store has hydrated from localStorage
// Returns the internal _hasHydrated state for safety
export const useHasHydrated = () => {
  return useAppStore((state) => state._hasHydrated);
};

export const isPMOrAdmin = (role?: UserRole) => role === UserRole.PM || role === UserRole.ADMIN;
