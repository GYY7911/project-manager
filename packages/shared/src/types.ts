// 用户角色枚举（与后端 Prisma 保持一致，使用大写）
export enum UserRole {
  PM = 'PM',
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN'
}

// 工作流阶段枚举（与后端 Prisma 保持一致，使用大写）
export enum WorkflowStage {
  REQUIREMENT_DESIGN = 'REQUIREMENT_DESIGN',
  ALPHA_TEST_DESIGN = 'ALPHA_TEST_DESIGN',
  DOCUMENT_SIGN = 'DOCUMENT_SIGN',
  FEATURE_DEV = 'FEATURE_DEV',
  ALPHA_CASE_DEV = 'ALPHA_CASE_DEV',
  SOP_UPGRADE = 'SOP_UPGRADE',
  VERSION_TEST = 'VERSION_TEST', // 动态对应TestCycle
  ISSUE_FIX = 'ISSUE_FIX',
  CCB_REVIEW = 'CCB_REVIEW',
  RELEASE = 'RELEASE',
}

// 版本状态枚举（与后端 Prisma 保持一致，使用大写）
export enum VersionStatus {
  PLANNING = 'PLANNING',
  DEVELOPMENT = 'DEVELOPMENT',
  TESTING = 'TESTING',
  RELEASED = 'RELEASED',
}

// 需求状态枚举（与后端 Prisma 保持一致，使用大写）
export enum RequirementStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

// 问题单严重程度（与后端 Prisma 保持一致，使用大写）
export enum IssueSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

// 问题单状态（与后端 Prisma 保持一致，使用大写）
export enum IssueStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  FIXED = 'FIXED',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
}

// 信用规则类型（与后端 Prisma 保持一致，使用大写）
export enum CreditRuleType {
  REQUIREMENT_COMPLETE = 'REQUIREMENT_COMPLETE',
  ISSUE_COMPLETE = 'ISSUE_COMPLETE',
  DELAY = 'DELAY',
  REVIEW_DELAY = 'REVIEW_DELAY',
  MANUAL = 'MANUAL',
}

// 信用记录来源类型（与后端 Prisma 保持一致，使用大写）
export enum CreditSourceType {
  REQUIREMENT = 'REQUIREMENT',
  ISSUE = 'ISSUE',
  MANUAL_ADJUST = 'MANUAL_ADJUST',
}

// ============ 实体类型 ============

export interface User {
  id: string;
  employeeNo: string; // 工号，如 z00123123
  name: string; // 姓名，如 张三
  username: string;
  role: UserRole;
  team?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Version {
  id: string;
  name: string; // 如 V2026.Q1
  startDate: Date;
  endDate: Date;
  status: VersionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Requirement {
  id: string;
  code: string; // 如 FE2026030912345
  title: string;
  description?: string;
  type?: string;
  status: RequirementStatus;
  currentStage: WorkflowStage;
  versionId: string;
  assigneeId: string;
  workload?: number; // 工作量，仅PM可见
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  description?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  ccbApproved: boolean;
  requirementId?: string;
  versionId: string;
  assigneeId: string;
  testCycleId?: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCycle {
  id: string;
  name: string; // 如 "转测1"
  order: number;
  versionId: string;
  createdAt: Date;
}

export interface CreditRule {
  id: string;
  ruleType: CreditRuleType;
  name: string;
  description?: string;
  score: number; // 正数加分，负数扣分
  delayDays?: number; // 延期天数，仅DELAY类型
  isCustom: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditRecord {
  id: string;
  userId: string;
  ruleId?: string;
  score: number;
  sourceType: CreditSourceType;
  sourceId?: string;
  remark?: string;
  versionId?: string;
  createdAt: Date;
}

export interface CreditSummary {
  id: string;
  userId: string;
  versionId: string;
  totalScore: number;
  requirementScore: number;
  issueScore: number;
  delayDeduction: number;
  manualAdjustment: number;
  updatedAt: Date;
}

export interface WorkflowLog {
  id: string;
  entityType: 'requirement' | 'issue';
  entityId: string;
  fromStage?: WorkflowStage;
  toStage: WorkflowStage;
  operatedBy: string;
  remark?: string;
  createdAt: Date;
}

// ============ API 类型 ============

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 看板卡片类型
export interface KanbanCard {
  id: string;
  type: 'requirement' | 'issue';
  code: string;
  title: string;
  status: RequirementStatus | IssueStatus;
  currentStage: WorkflowStage;
  assignee: Pick<User, 'id' | 'name' | 'employeeNo'>;
  severity?: IssueSeverity; // 仅问题单有
  workload?: number; // 仅PM可见
  dueDate?: Date;
  testCycleId?: string; // 动态转测列
}

// 看板列定义
export interface KanbanColumn {
  id: string;
  stage: WorkflowStage;
  title: string;
  isDynamic?: boolean; // 动态列（转测版本）
  testCycleId?: string;
}

// 权限检查
export function isPM(role: UserRole): boolean {
  return role === UserRole.PM;
}

// 阶段显示名称
export const StageLabels: Record<WorkflowStage, string> = {
  [WorkflowStage.REQUIREMENT_DESIGN]: '需求设计',
  [WorkflowStage.ALPHA_TEST_DESIGN]: 'Alpha测试设计',
  [WorkflowStage.DOCUMENT_SIGN]: '文档会签',
  [WorkflowStage.FEATURE_DEV]: '功能开发',
  [WorkflowStage.ALPHA_CASE_DEV]: 'Alpha用例开发',
  [WorkflowStage.SOP_UPGRADE]: '升级SOP',
  [WorkflowStage.VERSION_TEST]: '版本转测',
  [WorkflowStage.ISSUE_FIX]: '修改问题单',
  [WorkflowStage.CCB_REVIEW]: '问题单CCB',
  [WorkflowStage.RELEASE]: '版本发布',
};

// 默认阶段顺序
export const DefaultStageOrder: WorkflowStage[] = [
  WorkflowStage.REQUIREMENT_DESIGN,
  WorkflowStage.ALPHA_TEST_DESIGN,
  WorkflowStage.DOCUMENT_SIGN,
  WorkflowStage.FEATURE_DEV,
  WorkflowStage.ALPHA_CASE_DEV,
  WorkflowStage.SOP_UPGRADE,
  WorkflowStage.VERSION_TEST,
  WorkflowStage.ISSUE_FIX,
  WorkflowStage.CCB_REVIEW,
  WorkflowStage.RELEASE,
];

// ============ 看板模板配置类型 ============

// 阶段配置
export interface StageConfig {
  stage: WorkflowStage | string;  // 支持自定义阶段 ID
  customTitle?: string;  // 自定义标题
  visible: boolean;       // 是否显示
  isCustom?: boolean;     // true = 自定义阶段，可删除
  color?: string;         // 自定义阶段的颜色
}

// 列配置
export interface ColumnConfig {
  id: string;              // 列唯一ID
  title?: string;          // 列标题（合并时可自定义）
  stages: (WorkflowStage | string)[]; // 包含的阶段（支持合并和自定义阶段）
}

// 看板模板配置
export interface KanbanTemplateConfig {
  version: number;
  columns: ColumnConfig[];
  stageConfigs: StageConfig[];
  updatedAt: string;
}

// 后端模板类型
export interface KanbanTemplate {
  id: string;
  name: string;
  config: KanbanTemplateConfig;
  isDefault: boolean;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 用户看板配置
export interface UserKanbanConfig {
  id: string;
  userId: string;
  config: KanbanTemplateConfig;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============ API DTOs ============

export interface CreateRequirementDto {
  code: string;
  title: string;
  versionId: string;
  assigneeId: string;
  workload?: number;
  dueDate?: string;
}

export interface CreateIssueDto {
  code: string;
  title: string;
  versionId: string;
  assigneeId: string;
  severity: IssueSeverity;
  testCycleId?: string;
  dueDate?: string;
}

export interface CreateCreditRuleDto {
  name: string;
  ruleType: CreditRuleType;
  score: number;
  description?: string;
  delayDays?: number;
}

export interface ManualAdjustCreditDto {
  userId: string;
  versionId: string;
  score: number;
  remark: string;
}

export interface ApiError extends Error {
  response: { data: Record<string, unknown> };
}

export interface CreditDetailResponse {
  user: Pick<User, 'id' | 'name' | 'employeeNo' | 'team'>;
  summary: {
    totalScore: number;
    requirementScore: number;
    issueScore: number;
    delayDeduction: number;
    manualAdjustment: number;
  };
  records: CreditRecord[];
  stageStats: { stage: string; onTimeCount: number; delayedCount: number; totalDelayDays: number; totalScore: number }[];
}

export interface CreditCorrectionResult {
  correction: { id: string; recordId: string; originalScore: number; newScore: number; reason: string; createdAt: string };
  scoreDiff: number;
  message: string;
}

export interface BatchCorrectResult {
  success: number;
  failed: number;
  results: CreditCorrectionResult[];
}

export interface VersionBoardData {
  requirements: (Requirement & { assignee: Pick<User, 'id' | 'name' | 'employeeNo'> })[];
  issues: (Issue & { assignee: Pick<User, 'id' | 'name' | 'employeeNo'> })[];
  testCycles: TestCycle[];
}

// ============ 延期配置类型 ============

// 单个阶段的截止日期配置
export interface StageDeadline {
  stage: WorkflowStage;
  plannedDate: string;  // ISO 日期 (YYYY-MM-DD)
}

// 单个项目的延期配置（后端实体）
export interface ItemDelayConfig {
  id: string;
  entityId: string;  // 需求ID 或 问题单ID
  entityType: 'requirement' | 'issue';
  versionId: string;
  stageDeadlines: StageDeadline[];
  createdAt: string;
  updatedAt: string;
}

// 批量导入数据格式
export interface DelayConfigImportItem {
  code: string;        // 需求/问题单编码
  stageDeadlines: {
    stage: string;     // 阶段名称或枚举值
    plannedDate: string;
  }[];
}
