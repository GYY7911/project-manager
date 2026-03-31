import { UserRole, KanbanTemplateConfig } from '@pm/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

// 401 未授权回调类型
type UnauthorizedCallback = () => void;

class ApiClient {
  private token: string | null = null;
  private onUnauthorizedCallback: UnauthorizedCallback | null = null;

  setToken(token: string | null) {
    this.token = token;
    // 不再直接操作 localStorage，由 zustand persist 统一管理
  }

  getToken() {
    return this.token;
  }

  // 设置 401 回调（由 providers.tsx 调用）
  setOnUnauthorized(callback: UnauthorizedCallback) {
    this.onUnauthorizedCallback = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipUnauthorizedRedirect: boolean = false
  ): Promise<T> {
    // 优先使用内存中的 token，如果没有则尝试从 localStorage 读取
    let token = this.getToken();
    if (!token && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pm-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.state?.token || null;
        }
      } catch {
        // ignore
      }
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // 登录接口的 401 不触发重定向，因为用户本来就没登录
      if (response.status === 401 && !skipUnauthorizedRedirect) {
        // 触发回调清除状态
        this.onUnauthorizedCallback?.();
        this.setToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      const errorData = await response.json().catch(() => ({ message: '请求失败' }));

      // 创建增强的错误对象，包含响应数据
      const error = new Error(errorData.message || '请求失败') as any;
      error.response = { data: errorData };
      throw error;
    }

    return response.json();
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{
      user: { id: string; name: string; role: UserRole; employeeNo: string };
      access_token: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, true); // 登录接口 401 不触发重定向
  }

  async getMe() {
    return this.request<{
      id: string;
      name: string;
      role: UserRole;
      employeeNo: string;
      team?: string;
    }>('/auth/me');
  }

  // Versions
  async getVersions() {
    return this.request<any[]>('/versions');
  }

  async getVersionBoard(versionId: string) {
    return this.request<any>(`/versions/${versionId}/board`);
  }

  async createVersion(data: { name: string; startDate: string; endDate: string }) {
    return this.request<any>('/versions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 创建版本（支持使用已存在的版本）
   * 当版本已存在时，可以选择使用现有版本继续
   */
  async createOrUseVersion(data: {
    name: string;
    startDate: string;
    endDate: string;
    useExisting?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      isExisting: boolean;
      message: string;
    }>('/versions/create-or-use', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 检查版本名称是否已存在
   */
  async checkVersionName(name: string) {
    return this.request<{
      exists: boolean;
      version?: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
        status: string;
        testCyclesCount: number;
      };
    }>(`/versions/check-name?name=${encodeURIComponent(name)}`);
  }

  /**
   * 更新版本
   */
  async updateVersion(id: string, data: {
    name?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    return this.request<any>(`/versions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 删除版本
   * @param id 版本ID
   * @param force 是否强制删除（级联删除关联数据）
   */
  async deleteVersion(id: string, force: boolean = false) {
    const query = force ? '?force=true' : '';
    return this.request<{
      id: string;
      name: string;
      deleted: {
        requirements: number;
        issues: number;
        testCycles: number;
        creditRecords: number;
        workflowLogs: number;
      };
    } | void>(`/versions/${id}${query}`, {
      method: 'DELETE',
    });
  }

  // Requirements
  async getRequirements(versionId?: string) {
    const query = versionId ? `?versionId=${versionId}` : '';
    return this.request<any[]>(`/requirements${query}`);
  }

  async createRequirement(data: any) {
    return this.request<any>('/requirements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRequirementStage(id: string, stage: string, remark?: string) {
    return this.request<any>(`/requirements/${id}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage, remark }),
    });
  }

  async generateRequirementCode(versionId: string) {
    return this.request<{ code: string }>(
      `/requirements/generate-code?versionId=${versionId}`
    );
  }

  // Issues
  async getIssues(versionId?: string) {
    const query = versionId ? `?versionId=${versionId}` : '';
    return this.request<any[]>(`/issues${query}`);
  }

  async createIssue(data: any) {
    return this.request<any>('/issues', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIssueStage(id: string, stage: string, remark?: string, ccbApproved?: boolean) {
    return this.request<any>(`/issues/${id}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage, remark, ccbApproved }),
    });
  }

  async generateIssueCode(versionId: string) {
    return this.request<{ code: string }>(
      `/issues/generate-code?versionId=${versionId}`
    );
  }

  async duplicateRequirement(id: string) {
    return this.request<any>(`/requirements/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async duplicateIssue(id: string) {
    return this.request<any>(`/issues/${id}/duplicate`, {
      method: 'POST',
    });
  }

  // Test Cycles
  async getTestCycles(versionId: string) {
    return this.request<any[]>(`/test-cycles?versionId=${versionId}`);
  }

  async createTestCycle(data: { name: string; versionId: string }) {
    return this.request<any>('/test-cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteTestCycle(id: string) {
    return this.request<void>(`/test-cycles/${id}`, {
      method: 'DELETE',
    });
  }

  // Users
  async getAssignees() {
    return this.request<any[]>('/users/assignees');
  }

  async getUsers() {
    return this.request<any[]>('/users');
  }

  // Credits
  async getCreditSummaries(versionId: string) {
    return this.request<any[]>(`/credits/summaries?versionId=${versionId}`);
  }

  async getCreditRules() {
    return this.request<any[]>('/credits/rules');
  }

  async createCreditRule(data: any) {
    return this.request<any>('/credits/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async manualAdjustCredit(data: {
    userId: string;
    versionId: string;
    score: number;
    remark: string;
  }) {
    return this.request<any>('/credits/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Credit Detail & Correction (新增)
  async getCreditDetail(userId: string, versionId: string) {
    return this.request<{
      user: { id: string; name: string; employeeNo: string; team?: string };
      summary: {
        totalScore: number;
        requirementScore: number;
        issueScore: number;
        delayDeduction: number;
        manualAdjustment: number;
      };
      records: any[];
      stageStats: {
        stage: string;
        onTimeCount: number;
        delayedCount: number;
        totalDelayDays: number;
        totalScore: number;
      }[];
    }>(`/credits/detail/${userId}?versionId=${versionId}`);
  }

  async previewCorrection(data: {
    recordId: string;
    plannedDate?: string;
    actualDate?: string;
    overrideScore?: number;
  }) {
    return this.request<{
      originalScore: number;
      newScore: number;
      scoreDiff: number;
      newDelayDays: number;
      originalDelayDays: number;
    }>('/credits/preview-correction', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async correctCreditRecord(data: {
    recordId: string;
    plannedDate?: string;
    actualDate?: string;
    overrideScore?: number;
    reason: string;
  }) {
    return this.request<{
      correction: any;
      scoreDiff: number;
      message: string;
    }>('/credits/correct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async batchCorrectRecords(data: {
    corrections: {
      recordId: string;
      plannedDate?: string;
      actualDate?: string;
      overrideScore?: number;
      reason: string;
    }[];
  }) {
    return this.request<{
      success: number;
      failed: number;
      results: any[];
    }>('/credits/batch-correct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCorrectionHistory(recordId: string) {
    return this.request<any[]>(`/credits/corrections/${recordId}`);
  }

  // Kanban Templates (PM/Admin)
  async getKanbanTemplates() {
    return this.request<any[]>('/kanban-templates');
  }

  async getDefaultKanbanTemplate() {
    return this.request<any>('/kanban-templates/default');
  }

  async createKanbanTemplate(data: { name: string; config: KanbanTemplateConfig }) {
    return this.request<any>('/kanban-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateKanbanTemplate(id: string, data: { name?: string; config?: KanbanTemplateConfig }) {
    return this.request<any>(`/kanban-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async setDefaultKanbanTemplate(id: string) {
    return this.request<any>(`/kanban-templates/${id}/set-default`, {
      method: 'PUT',
    });
  }

  async deleteKanbanTemplate(id: string) {
    return this.request<void>(`/kanban-templates/${id}`, {
      method: 'DELETE',
    });
  }

  // User Kanban Config
  async getMyKanbanConfig() {
    return this.request<{ config: KanbanTemplateConfig } | null>('/kanban-config/my');
  }

  async updateMyKanbanConfig(config: KanbanTemplateConfig) {
    return this.request<any>('/kanban-config/my', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  }

  async deleteMyKanbanConfig() {
    return this.request<void>('/kanban-config/my', {
      method: 'DELETE',
    });
  }

  // Delay Config
  async getDelayConfigs(versionId: string) {
    return this.request<any[]>(`/delay-configs/${versionId}`);
  }

  async updateDelayConfig(data: {
    entityId: string;
    entityType: 'requirement' | 'issue';
    versionId: string;
    stageDeadlines: { stage: string; plannedDate: string }[];
  }) {
    return this.request<any>('/delay-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteDelayConfig(id: string) {
    return this.request<void>(`/delay-configs/${id}`, {
      method: 'DELETE',
    });
  }

  async batchImportDelayConfigs(versionId: string, items: {
    code: string;
    stageDeadlines: { stage: string; plannedDate: string }[];
  }[]) {
    return this.request<{
      success: number;
      failed: number;
      errors: { code: string; error: string }[];
    }>('/delay-configs/batch', {
      method: 'POST',
      body: JSON.stringify({ versionId, items }),
    });
  }

  // Analytics
  async getTeamOverview(versionId: string) {
    return this.request<{
      highRiskCount: number;
      delayedCount: number;
      dueTodayCount: number;
      totalWorkload: number;
      highRiskMembers: string[];
    }>(`/analytics/team-overview?versionId=${versionId}`);
  }

  async getWorkload(versionId: string) {
    return this.request<{
      userId: string;
      userName: string;
      employeeNo: string;
      role: string;
      requirementCount: number;
      issueCount: number;
      highPriorityIssueCount: number;
      delayedCount: number;
      riskScore: number;
      riskLevel: string;
    }[]>(`/analytics/workload?versionId=${versionId}`);
  }

  async getRequirementRisks(versionId: string) {
    return this.request<{
      id: string;
      code: string;
      title: string;
      assigneeId: string;
      assigneeName: string;
      riskScore: number;
      riskLevel: string;
      delayedDays: number;
      dueDate: string | null;
      factors: string[];
      status: string;
      currentStage: string;
    }[]>(`/analytics/requirement-risks?versionId=${versionId}`);
  }

  async getIssueRisks(versionId: string) {
    return this.request<{
      id: string;
      code: string;
      title: string;
      assigneeId: string;
      assigneeName: string;
      severity: string;
      riskScore: number;
      riskLevel: string;
      delayedDays: number;
      status: string;
      currentStage: string;
      factors: string[];
    }[]>(`/analytics/issue-risks?versionId=${versionId}`);
  }

  async getGanttData(versionId: string) {
    return this.request<{
      id: string;
      code: string;
      title: string;
      type: 'requirement' | 'issue';
      assigneeId: string;
      assigneeName: string;
      startDate: string | null;
      endDate: string | null;
      plannedStartDate: string | null;
      plannedEndDate: string | null;
      currentStage: string;
      status: string;
      delayedDays: number;
      riskLevel: string;
      changeLogs: {
        id: string;
        changeType: string;
        oldValue: string | null;
        newValue: string | null;
        reason: string;
        createdAt: string;
        operatorName: string;
      }[];
      stageHistory: {
        stage: string;
        enteredAt: string;
        leftAt: string | null;
      }[];
    }[]>(`/analytics/gantt?versionId=${versionId}`);
  }

  // ===== 信用延期率检查 =====
  async checkVersionDelayRate(versionId: string) {
    return this.request<{
      totalItems: number;
      delayedItems: number;
      delayRate: number;
      shouldPenalize: boolean;
      message?: string;
    }>(`/credits/delay-rate?versionId=${versionId}`);
  }
}

export const api = new ApiClient();
