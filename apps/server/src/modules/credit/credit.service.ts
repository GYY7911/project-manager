import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditRuleService } from './credit-rule.service';
import { CreditSourceType, CreditRuleType } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { CreateCreditRecordDto } from './credit.dto';

export interface StageStat {
  stage: string;
  onTimeCount: number;
  delayedCount: number;
  totalDelayDays: number;
  totalScore: number;
}

@Injectable()
export class CreditService {
  constructor(
    private prisma: PrismaService,
    private ruleService: CreditRuleService,
  ) {}

  // Create a credit record
  async createRecord(dto: CreateCreditRecordDto) {
    const record = await this.prisma.creditRecord.create({
      data: {
        userId: dto.userId,
        ruleId: dto.ruleId,
        score: dto.score,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        remark: dto.remark,
        versionId: dto.versionId,
        requirementId: dto.requirementId,
        issueId: dto.issueId,
        // 新增字段
        workflowStage: dto.workflowStage,
        delayDays: dto.delayDays,
        plannedDate: dto.plannedDate,
        actualDate: dto.actualDate,
      },
    });

    // Update summary
    await this.updateSummary(dto.userId, dto.versionId, dto.score, dto.sourceType);

    return record;
  }

  // 需求完成时触发
  async onRequirementComplete(
    userId: string,
    requirementId: string,
    versionId: string,
    dueDate: Date | null,
    workflowStage?: string,
  ) {
    const rule = await this.ruleService.findByType(CreditRuleType.REQUIREMENT_COMPLETE);
    if (!rule) return;

    // 计算是否有延期
    const now = new Date();
    let score = rule.score;
    let remark = '按期完成需求';
    let delayDays = 0;

    if (dueDate && now > dueDate) {
      delayDays = differenceInDays(now, dueDate);
      remark = `完成需求（延期${delayDays}天）`;

      // 扣除延期分数
      const delayRule = await this.ruleService.findByDelayDays(delayDays);
      if (delayRule) {
        score += delayRule.score; // 延期扣分
      }
    }

    await this.createRecord({
      userId,
      ruleId: rule.id,
      score,
      sourceType: CreditSourceType.REQUIREMENT,
      sourceId: requirementId,
      remark,
      versionId,
      requirementId,
      workflowStage,
      delayDays,
      plannedDate: dueDate || undefined,
      actualDate: now,
    });
  }

  // 问题单完成时触发
  async onIssueComplete(
    userId: string,
    issueId: string,
    versionId: string,
    dueDate: Date | null,
    workflowStage?: string,
  ) {
    const rule = await this.ruleService.findByType(CreditRuleType.ISSUE_COMPLETE);
    if (!rule) return;

    const now = new Date();
    let score = rule.score;
    let remark = '按期完成问题单';
    let delayDays = 0;

    if (dueDate && now > dueDate) {
      delayDays = differenceInDays(now, dueDate);
      remark = `完成问题单（延期${delayDays}天）`;

      const delayRule = await this.ruleService.findByDelayDays(delayDays);
      if (delayRule) {
        score += delayRule.score;
      }
    }

    await this.createRecord({
      userId,
      ruleId: rule.id,
      score,
      sourceType: CreditSourceType.ISSUE,
      sourceId: issueId,
      remark,
      versionId,
      issueId,
      workflowStage,
      delayDays,
      plannedDate: dueDate || undefined,
      actualDate: now,
    });
  }

  // 手动调整
  async manualAdjust(
    userId: string,
    versionId: string,
    score: number,
    remark: string,
    operatedBy: string,
  ) {
    return this.createRecord({
      userId,
      score,
      sourceType: CreditSourceType.MANUAL_ADJUST,
      remark: `${remark} (操作人: ${operatedBy})`,
      versionId,
    });
  }

  // 更新汇总
  private async updateSummary(
    userId: string,
    versionId: string | undefined,
    score: number,
    sourceType: CreditSourceType,
  ) {
    if (!versionId) return;

    const existing = await this.prisma.creditSummary.findUnique({
      where: {
        userId_versionId: { userId, versionId },
      },
    });

    if (existing) {
      const updateData: Record<string, number> = {
        totalScore: existing.totalScore + score,
      };

      if (sourceType === CreditSourceType.REQUIREMENT) {
        updateData.requirementScore = existing.requirementScore + score;
      } else if (sourceType === CreditSourceType.ISSUE) {
        updateData.issueScore = existing.issueScore + score;
      } else if (sourceType === CreditSourceType.MANUAL_ADJUST) {
        updateData.manualAdjustment = existing.manualAdjustment + score;
      }

      if (score < 0) {
        updateData.delayDeduction = existing.delayDeduction + Math.abs(score);
      }

      await this.prisma.creditSummary.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      await this.prisma.creditSummary.create({
        data: {
          userId,
          versionId,
          totalScore: score,
          requirementScore: sourceType === CreditSourceType.REQUIREMENT ? score : 0,
          issueScore: sourceType === CreditSourceType.ISSUE ? score : 0,
          delayDeduction: score < 0 ? Math.abs(score) : 0,
          manualAdjustment: sourceType === CreditSourceType.MANUAL_ADJUST ? score : 0,
        },
      });
    }
  }

  // Get user credit records
  async getUserRecords(userId: string, versionId?: string) {
    return this.prisma.creditRecord.findMany({
      where: {
        userId,
        ...(versionId && { versionId }),
      },
      include: {
        rule: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get user credit summary
  async getUserSummary(userId: string, versionId: string) {
    return this.prisma.creditSummary.findUnique({
      where: {
        userId_versionId: { userId, versionId },
      },
    });
  }

  // Get all user summaries (PM only)
  // 返回所有非 admin 用户，无论是否有分配任务
  async getAllSummaries(versionId: string) {
    // 1. 获取所有非 admin 用户
    const allUsers = await this.prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        team: true,
        role: true,
      },
    });

    if (allUsers.length === 0) {
      return [];
    }

    const allUserIds = allUsers.map(u => u.id);

    // 2. 获取该版本所有信用汇总
    const summaries = await this.prisma.creditSummary.findMany({
      where: {
        versionId,
        userId: { in: allUserIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            team: true,
            role: true,
          },
        },
      },
    });

    // 3. 创建用户ID到汇总的映射
    const summaryMap = new Map(summaries.map(s => [s.userId, s]));

    // 4. 为没有汇总的用户创建虚拟汇总（分数为0）
    const result = [];

    for (const user of allUsers) {
      const existingSummary = summaryMap.get(user.id);

      if (existingSummary) {
        result.push(existingSummary);
      } else {
        // 为没有汇总的用户创建虚拟汇总
        result.push({
          id: `virtual-${user.id}`,
          userId: user.id,
          versionId,
          totalScore: 0,
          requirementScore: 0,
          issueScore: 0,
          delayDeduction: 0,
          manualAdjustment: 0,
          updatedAt: new Date(),
          user,
        } as any);
      }
    }

    // 按总分排序
    return result.sort((a, b) => b.totalScore - a.totalScore);
  }

  // 计算版本延期率并检查是否需要对版本经理扣分
  async checkVersionDelayPenalty(versionId: string) {
    // 1. 获取该版本所有需求
    const requirements = await this.prisma.requirement.findMany({
      where: { versionId },
      select: { id: true, status: true },
    });

    // 2. 获取该版本所有问题单
    const issues = await this.prisma.issue.findMany({
      where: { versionId },
      select: { id: true, status: true },
    });

    const totalItems = requirements.length + issues.length;

    if (totalItems === 0) {
      return { delayRate: 0, shouldPenalize: false };
    }

    // 3. 获取延期记录数
    const delayedRecords = await this.prisma.creditRecord.count({
      where: {
        versionId,
        delayDays: { gt: 0 },
      },
    });

    const delayRate = delayedRecords / totalItems;
    const shouldPenalize = delayRate > 0.5;

    return {
      totalItems,
      delayedItems: delayedRecords,
      delayRate: Math.round(delayRate * 100),
      shouldPenalize,
      message: shouldPenalize
        ? `该版本延期率 ${Math.round(delayRate * 100)}% 超过 50%`
        : undefined,
    };
  }

  // ===== 新增：信用详情查询 =====

  // Get user credit detail with per-stage statistics
  async getUserCreditDetail(userId: string, versionId: string) {
    // 1. 获取用户基本信息
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        team: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 2. 获取该版本下所有信用记录
    const records = await this.prisma.creditRecord.findMany({
      where: { userId, versionId },
      include: {
        requirement: {
          select: { code: true, title: true, currentStage: true },
        },
        issue: {
          select: { code: true, title: true, currentStage: true, severity: true },
        },
        rule: true,
        corrections: {
          include: {
            operator: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. 获取汇总
    const summary = await this.getUserSummary(userId, versionId);

    // 4. 按阶段分组统计
    const stageStats = this.groupByStage(records);

    return {
      user,
      summary: summary || {
        totalScore: 0,
        requirementScore: 0,
        issueScore: 0,
        delayDeduction: 0,
        manualAdjustment: 0,
      },
      records,
      stageStats,
    };
  }

  // 按阶段分组统计
  private groupByStage(records: any[]): StageStat[] {
    const stageMap = new Map<string, StageStat>();

    for (const record of records) {
      const stage = record.workflowStage || 'UNKNOWN';

      if (!stageMap.has(stage)) {
        stageMap.set(stage, {
          stage,
          onTimeCount: 0,
          delayedCount: 0,
          totalDelayDays: 0,
          totalScore: 0,
        });
      }

      const stat = stageMap.get(stage)!;
      stat.totalScore += record.score;

      if (record.delayDays !== null && record.delayDays !== undefined) {
        if (record.delayDays > 0) {
          stat.delayedCount++;
          stat.totalDelayDays += record.delayDays;
        } else {
          stat.onTimeCount++;
        }
      }
    }

    return Array.from(stageMap.values());
  }
}
