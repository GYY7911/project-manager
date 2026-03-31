import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, IssueSeverity, RequirementStatus, IssueStatus } from '@prisma/client';

// 风险等级类型
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

// 风险计算结果
export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: string[];
}

// 员工负荷数据
export interface WorkloadData {
  userId: string;
  userName: string;
  employeeNo: string;
  role: string;
  requirementCount: number;
  issueCount: number;
  highPriorityIssueCount: number;
  delayedCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
}

// 团队总览数据
export interface TeamOverview {
  highRiskCount: number;      // 高风险员工数
  delayedCount: number;        // 延期项目数
  dueTodayCount: number;       // 今日到期数
  totalWorkload: number;       // 总任务数
  highRiskMembers: string[];   // 高风险员工名单
}

// 需求风险数据
export interface RequirementRiskData {
  id: string;
  code: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  delayedDays: number;
  dueDate: Date | null;
  factors: string[];
  status: string;
  currentStage: string;
}

// 问题单风险数据
export interface IssueRiskData {
  id: string;
  code: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  severity: string;
  riskScore: number;
  riskLevel: RiskLevel;
  delayedDays: number;
  status: string;
  currentStage: string;
  factors: string[];
}

// 甘特图数据
export interface GanttData {
  id: string;
  code: string;
  title: string;
  type: 'requirement' | 'issue';
  assigneeId: string;
  assigneeName: string;
  startDate: Date | null;
  endDate: Date | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  currentStage: string;
  status: string;
  delayedDays: number;
  riskLevel: RiskLevel;
  changeLogs: ChangeLogItem[];
  stageHistory: StageHistoryItem[];
}

export interface ChangeLogItem {
  id: string;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: Date;
  operatorName: string;
}

export interface StageHistoryItem {
  stage: string;
  enteredAt: Date;
  leftAt: Date | null;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 计算风险分数和等级
   * 风险分数 = 延期天数*4(上限40) + 严重程度(30/20/10/5) + 阻塞(20) + 临近截止(10)
   * 等级: >=70 critical, >=50 high, >=25 medium, <25 low
   */
  calculateRisk(params: {
    delayedDays: number;
    severity?: IssueSeverity | null;
    isBlocked?: boolean;
    isDueToday?: boolean;
    isNearDue?: boolean;
  }): RiskResult {
    const factors: string[] = [];
    let score = 0;

    // 延期天数 (上限40分)
    const delayScore = Math.min(params.delayedDays * 4, 40);
    if (params.delayedDays > 0) {
      score += delayScore;
      factors.push(`延期${params.delayedDays}天`);
    }

    // 严重程度 (仅问题单)
    if (params.severity) {
      switch (params.severity) {
        case IssueSeverity.CRITICAL:
          score += 30;
          factors.push('严重程度: 紧急');
          break;
        case IssueSeverity.HIGH:
          score += 20;
          factors.push('严重程度: 高');
          break;
        case IssueSeverity.MEDIUM:
          score += 10;
          factors.push('严重程度: 中');
          break;
        case IssueSeverity.LOW:
          score += 5;
          factors.push('严重程度: 低');
          break;
      }
    }

    // 阻塞状态
    if (params.isBlocked) {
      score += 20;
      factors.push('状态: 阻塞');
    }

    // 临近截止 (3天内)
    if (params.isDueToday) {
      score += 10;
      factors.push('今日到期');
    } else if (params.isNearDue) {
      score += 5;
      factors.push('临近截止');
    }

    // 确定风险等级
    let level: RiskLevel;
    if (score >= 70) {
      level = 'critical';
    } else if (score >= 50) {
      level = 'high';
    } else if (score >= 25) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { score, level, factors };
  }

  /**
   * 计算延期天数
   */
  calculateDelayedDays(dueDate: Date | null): number {
    if (!dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * 检查是否今日到期
   */
  isDueToday(dueDate: Date | null): boolean {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return today.toDateString() === due.toDateString();
  }

  /**
   * 检查是否临近截止 (3天内)
   */
  isNearDue(dueDate: Date | null): boolean {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 3;
  }

  /**
   * 获取团队总览
   */
  async getTeamOverview(versionId: string, userId?: string, userRole?: UserRole): Promise<TeamOverview> {
    // 获取版本下所有需求
    const requirements = await this.prisma.requirement.findMany({
      where: { versionId },
      include: { assignee: true },
    });

    // 获取版本下所有问题单
    const issues = await this.prisma.issue.findMany({
      where: { versionId },
      include: { assignee: true },
    });

    // 按用户分组计算负荷和风险
    const userWorkloads = new Map<string, {
      user: { id: string; name: string };
      requirementCount: number;
      issueCount: number;
      highPriorityIssueCount: number;
      delayedCount: number;
      riskScore: number;
    }>();

    // 统计需求
    for (const req of requirements) {
      if (!userWorkloads.has(req.assigneeId)) {
        userWorkloads.set(req.assigneeId, {
          user: { id: req.assigneeId, name: req.assignee.name },
          requirementCount: 0,
          issueCount: 0,
          highPriorityIssueCount: 0,
          delayedCount: 0,
          riskScore: 0,
        });
      }
      const workload = userWorkloads.get(req.assigneeId)!;
      workload.requirementCount++;

      const delayedDays = this.calculateDelayedDays(req.dueDate);
      if (delayedDays > 0) {
        workload.delayedCount++;
      }

      const risk = this.calculateRisk({
        delayedDays,
        isBlocked: req.status === RequirementStatus.BLOCKED,
        isDueToday: this.isDueToday(req.dueDate),
        isNearDue: this.isNearDue(req.dueDate),
      });
      workload.riskScore = Math.max(workload.riskScore, risk.score);
    }

    // 统计问题单
    for (const issue of issues) {
      if (!userWorkloads.has(issue.assigneeId)) {
        userWorkloads.set(issue.assigneeId, {
          user: { id: issue.assigneeId, name: issue.assignee.name },
          requirementCount: 0,
          issueCount: 0,
          highPriorityIssueCount: 0,
          delayedCount: 0,
          riskScore: 0,
        });
      }
      const workload = userWorkloads.get(issue.assigneeId)!;
      workload.issueCount++;

      if (issue.severity === IssueSeverity.CRITICAL || issue.severity === IssueSeverity.HIGH) {
        workload.highPriorityIssueCount++;
      }

      const delayedDays = this.calculateDelayedDays(issue.dueDate);
      if (delayedDays > 0) {
        workload.delayedCount++;
      }

      const risk = this.calculateRisk({
        delayedDays,
        severity: issue.severity,
        isDueToday: this.isDueToday(issue.dueDate),
        isNearDue: this.isNearDue(issue.dueDate),
      });
      workload.riskScore = Math.max(workload.riskScore, risk.score);
    }

    // 统计今日到期
    let dueTodayCount = 0;
    for (const req of requirements) {
      if (this.isDueToday(req.dueDate)) dueTodayCount++;
    }
    for (const issue of issues) {
      if (this.isDueToday(issue.dueDate)) dueTodayCount++;
    }

    // 统计高风险员工
    const highRiskMembers: string[] = [];
    for (const [, workload] of userWorkloads) {
      if (workload.riskScore >= 50) {
        highRiskMembers.push(workload.user.name);
      }
    }

    return {
      highRiskCount: highRiskMembers.length,
      delayedCount: [...requirements, ...issues].filter(item =>
        this.calculateDelayedDays(item.dueDate) > 0
      ).length,
      dueTodayCount,
      totalWorkload: requirements.length + issues.length,
      highRiskMembers,
    };
  }

  /**
   * 获取员工负荷数据
   */
  async getWorkload(versionId: string, userId?: string, userRole?: UserRole): Promise<WorkloadData[]> {
    // Member 只能看自己的数据
    const filterUserId = userRole === UserRole.MEMBER ? userId : undefined;

    // 获取版本下所有需求
    const requirements = await this.prisma.requirement.findMany({
      where: {
        versionId,
        ...(filterUserId ? { assigneeId: filterUserId } : {}),
      },
      include: { assignee: true },
    });

    // 获取版本下所有问题单
    const issues = await this.prisma.issue.findMany({
      where: {
        versionId,
        ...(filterUserId ? { assigneeId: filterUserId } : {}),
      },
      include: { assignee: true },
    });

    // 按用户分组
    const userMap = new Map<string, WorkloadData>();

    // 初始化用户数据
    const allUsers = new Set([
      ...requirements.map(r => r.assigneeId),
      ...issues.map(i => i.assigneeId),
    ]);

    for (const req of requirements) {
      allUsers.add(req.assigneeId);
    }

    // 获取用户信息
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...allUsers] } },
    });

    for (const user of users) {
      userMap.set(user.id, {
        userId: user.id,
        userName: user.name,
        employeeNo: user.employeeNo,
        role: user.role,
        requirementCount: 0,
        issueCount: 0,
        highPriorityIssueCount: 0,
        delayedCount: 0,
        riskScore: 0,
        riskLevel: 'low',
      });
    }

    // 统计需求
    for (const req of requirements) {
      const data = userMap.get(req.assigneeId);
      if (data) {
        data.requirementCount++;
        const delayedDays = this.calculateDelayedDays(req.dueDate);
        if (delayedDays > 0) data.delayedCount++;

        const risk = this.calculateRisk({
          delayedDays,
          isBlocked: req.status === RequirementStatus.BLOCKED,
          isDueToday: this.isDueToday(req.dueDate),
          isNearDue: this.isNearDue(req.dueDate),
        });
        data.riskScore = Math.max(data.riskScore, risk.score);
      }
    }

    // 统计问题单
    for (const issue of issues) {
      const data = userMap.get(issue.assigneeId);
      if (data) {
        data.issueCount++;
        if (issue.severity === IssueSeverity.CRITICAL || issue.severity === IssueSeverity.HIGH) {
          data.highPriorityIssueCount++;
        }
        const delayedDays = this.calculateDelayedDays(issue.dueDate);
        if (delayedDays > 0) data.delayedCount++;

        const risk = this.calculateRisk({
          delayedDays,
          severity: issue.severity,
          isDueToday: this.isDueToday(issue.dueDate),
          isNearDue: this.isNearDue(issue.dueDate),
        });
        data.riskScore = Math.max(data.riskScore, risk.score);
      }
    }

    // 设置风险等级
    for (const [, data] of userMap) {
      if (data.riskScore >= 70) {
        data.riskLevel = 'critical';
      } else if (data.riskScore >= 50) {
        data.riskLevel = 'high';
      } else if (data.riskScore >= 25) {
        data.riskLevel = 'medium';
      } else {
        data.riskLevel = 'low';
      }
    }

    // 按风险分数排序
    return [...userMap.values()].sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * 获取需求风险数据
   */
  async getRequirementRisks(versionId: string, userId?: string, userRole?: UserRole): Promise<RequirementRiskData[]> {
    // Member 只能看自己的数据
    const filterUserId = userRole === UserRole.MEMBER ? userId : undefined;

    const requirements = await this.prisma.requirement.findMany({
      where: {
        versionId,
        ...(filterUserId ? { assigneeId: filterUserId } : {}),
      },
      include: { assignee: true },
    });

    const results: RequirementRiskData[] = [];

    for (const req of requirements) {
      const delayedDays = this.calculateDelayedDays(req.dueDate);
      const risk = this.calculateRisk({
        delayedDays,
        isBlocked: req.status === RequirementStatus.BLOCKED,
        isDueToday: this.isDueToday(req.dueDate),
        isNearDue: this.isNearDue(req.dueDate),
      });

      results.push({
        id: req.id,
        code: req.code,
        title: req.title,
        assigneeId: req.assigneeId,
        assigneeName: req.assignee.name,
        riskScore: risk.score,
        riskLevel: risk.level,
        delayedDays,
        dueDate: req.dueDate,
        factors: risk.factors,
        status: req.status,
        currentStage: req.currentStage,
      });
    }

    // 按风险分数排序
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * 获取问题单风险数据
   */
  async getIssueRisks(versionId: string, userId?: string, userRole?: UserRole): Promise<IssueRiskData[]> {
    // Member 只能看自己的数据
    const filterUserId = userRole === UserRole.MEMBER ? userId : undefined;

    const issues = await this.prisma.issue.findMany({
      where: {
        versionId,
        ...(filterUserId ? { assigneeId: filterUserId } : {}),
      },
      include: { assignee: true },
    });

    const results: IssueRiskData[] = [];

    for (const issue of issues) {
      const delayedDays = this.calculateDelayedDays(issue.dueDate);
      const risk = this.calculateRisk({
        delayedDays,
        severity: issue.severity,
        isDueToday: this.isDueToday(issue.dueDate),
        isNearDue: this.isNearDue(issue.dueDate),
      });

      results.push({
        id: issue.id,
        code: issue.code,
        title: issue.title,
        assigneeId: issue.assigneeId,
        assigneeName: issue.assignee.name,
        severity: issue.severity,
        riskScore: risk.score,
        riskLevel: risk.level,
        delayedDays,
        status: issue.status,
        currentStage: issue.currentStage,
        factors: risk.factors,
      });
    }

    // 按风险分数排序
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * 获取甘特图数据
   */
  async getGanttData(versionId: string, userId?: string, userRole?: UserRole): Promise<GanttData[]> {
    // Member 只能看自己的数据
    const filterUserId = userRole === UserRole.MEMBER ? userId : undefined;

    const results: GanttData[] = [];

    // 获取需求
    const requirements = await this.prisma.requirement.findMany({
      where: {
        versionId,
        ...(filterUserId ? { assigneeId: filterUserId } : {}),
      },
      include: {
        assignee: true,
        workflowLogs: {
          include: { operator: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // 获取需求变更日志
    const requirementIds = requirements.map(r => r.id);
    const changeLogs = await this.prisma.planChangeLog.findMany({
      where: {
        entityType: 'requirement',
        entityId: { in: requirementIds },
      },
      include: { operator: true },
      orderBy: { createdAt: 'desc' },
    });

    const changeLogMap = new Map<string, typeof changeLogs>();
    for (const log of changeLogs) {
      if (!changeLogMap.has(log.entityId)) {
        changeLogMap.set(log.entityId, []);
      }
      changeLogMap.get(log.entityId)!.push(log);
    }

    // 获取延期配置
    const delayConfigs = await this.prisma.delayConfig.findMany({
      where: {
        versionId,
        entityType: 'requirement',
      },
    });
    const delayConfigMap = new Map<string, typeof delayConfigs[0]>();
    for (const config of delayConfigs) {
      delayConfigMap.set(config.entityId, config);
    }

    for (const req of requirements) {
      const logs = changeLogMap.get(req.id) || [];
      const delayedDays = this.calculateDelayedDays(req.dueDate);
      const risk = this.calculateRisk({
        delayedDays,
        isBlocked: req.status === RequirementStatus.BLOCKED,
        isDueToday: this.isDueToday(req.dueDate),
        isNearDue: this.isNearDue(req.dueDate),
      });

      // 构建阶段历史
      const stageHistory: StageHistoryItem[] = [];
      for (let i = 0; i < req.workflowLogs.length; i++) {
        const log = req.workflowLogs[i];
        stageHistory.push({
          stage: log.toStage,
          enteredAt: log.createdAt,
          leftAt: i < req.workflowLogs.length - 1 ? req.workflowLogs[i + 1].createdAt : null,
        });
      }

      // 获取计划日期
      const config = delayConfigMap.get(req.id);
      let plannedStartDate: Date | null = null;
      let plannedEndDate: Date | null = null;

      if (config) {
        const stageDeadlines = config.stageDeadlines as { stage: string; plannedDate: string }[];
        if (stageDeadlines && stageDeadlines.length > 0) {
          const sorted = [...stageDeadlines].sort((a, b) =>
            new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime()
          );
          plannedStartDate = new Date(sorted[0].plannedDate);
          plannedEndDate = new Date(sorted[sorted.length - 1].plannedDate);
        }
      }

      results.push({
        id: req.id,
        code: req.code,
        title: req.title,
        type: 'requirement',
        assigneeId: req.assigneeId,
        assigneeName: req.assignee.name,
        startDate: req.createdAt,
        endDate: req.dueDate,
        plannedStartDate,
        plannedEndDate,
        currentStage: req.currentStage,
        status: req.status,
        delayedDays,
        riskLevel: risk.level,
        changeLogs: logs.map(log => ({
          id: log.id,
          changeType: log.changeType,
          oldValue: log.oldValue,
          newValue: log.newValue,
          reason: log.reason,
          createdAt: log.createdAt,
          operatorName: log.operator.name,
        })),
        stageHistory,
      });
    }

    // 获取问题单
    const issues = await this.prisma.issue.findMany({
      where: {
        versionId,
        ...(filterUserId ? { assigneeId: filterUserId } : {}),
      },
      include: {
        assignee: true,
        workflowLogs: {
          include: { operator: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // 获取问题单变更日志
    const issueIds = issues.map(i => i.id);
    const issueChangeLogs = await this.prisma.planChangeLog.findMany({
      where: {
        entityType: 'issue',
        entityId: { in: issueIds },
      },
      include: { operator: true },
      orderBy: { createdAt: 'desc' },
    });

    const issueChangeLogMap = new Map<string, typeof issueChangeLogs>();
    for (const log of issueChangeLogs) {
      if (!issueChangeLogMap.has(log.entityId)) {
        issueChangeLogMap.set(log.entityId, []);
      }
      issueChangeLogMap.get(log.entityId)!.push(log);
    }

    // 获取问题单延期配置
    const issueDelayConfigs = await this.prisma.delayConfig.findMany({
      where: {
        versionId,
        entityType: 'issue',
      },
    });
    const issueDelayConfigMap = new Map<string, typeof issueDelayConfigs[0]>();
    for (const config of issueDelayConfigs) {
      issueDelayConfigMap.set(config.entityId, config);
    }

    for (const issue of issues) {
      const logs = issueChangeLogMap.get(issue.id) || [];
      const delayedDays = this.calculateDelayedDays(issue.dueDate);
      const risk = this.calculateRisk({
        delayedDays,
        severity: issue.severity,
        isDueToday: this.isDueToday(issue.dueDate),
        isNearDue: this.isNearDue(issue.dueDate),
      });

      // 构建阶段历史
      const stageHistory: StageHistoryItem[] = [];
      for (let i = 0; i < issue.workflowLogs.length; i++) {
        const log = issue.workflowLogs[i];
        stageHistory.push({
          stage: log.toStage,
          enteredAt: log.createdAt,
          leftAt: i < issue.workflowLogs.length - 1 ? issue.workflowLogs[i + 1].createdAt : null,
        });
      }

      // 获取计划日期
      const config = issueDelayConfigMap.get(issue.id);
      let plannedStartDate: Date | null = null;
      let plannedEndDate: Date | null = null;

      if (config) {
        const stageDeadlines = config.stageDeadlines as { stage: string; plannedDate: string }[];
        if (stageDeadlines && stageDeadlines.length > 0) {
          const sorted = [...stageDeadlines].sort((a, b) =>
            new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime()
          );
          plannedStartDate = new Date(sorted[0].plannedDate);
          plannedEndDate = new Date(sorted[sorted.length - 1].plannedDate);
        }
      }

      results.push({
        id: issue.id,
        code: issue.code,
        title: issue.title,
        type: 'issue',
        assigneeId: issue.assigneeId,
        assigneeName: issue.assignee.name,
        startDate: issue.createdAt,
        endDate: issue.dueDate,
        plannedStartDate,
        plannedEndDate,
        currentStage: issue.currentStage,
        status: issue.status,
        delayedDays,
        riskLevel: risk.level,
        changeLogs: logs.map(log => ({
          id: log.id,
          changeType: log.changeType,
          oldValue: log.oldValue,
          newValue: log.newValue,
          reason: log.reason,
          createdAt: log.createdAt,
          operatorName: log.operator.name,
        })),
        stageHistory,
      });
    }

    // 按风险等级和截止日期排序
    return results.sort((a, b) => {
      const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (levelOrder[a.riskLevel] !== levelOrder[b.riskLevel]) {
        return levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
      }
      if (a.endDate && b.endDate) {
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      return 0;
    });
  }
}
