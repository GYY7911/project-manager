import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditRuleService } from './credit-rule.service';
import { CreditSourceType, CreditRuleType } from '@prisma/client';
import { differenceInDays } from 'date-fns';

export interface CreateCreditRecordDto {
  userId: string;
  ruleId?: string;
  score: number;
  sourceType: CreditSourceType;
  sourceId?: string;
  remark?: string;
  versionId?: string;
  requirementId?: string;
  issueId?: string;
  // 新增字段
  workflowStage?: string;
  delayDays?: number;
  plannedDate?: Date;
  actualDate?: Date;
}

export interface CorrectRecordDto {
  recordId: string;
  plannedDate?: string;
  actualDate?: string;
  overrideScore?: number;
  reason: string;
}

export interface BatchCorrectDto {
  corrections: CorrectRecordDto[];
}

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

  // 创建信用记录
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

    // 更新汇总
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
      const updateData: any = {
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

  // 获取用户信用记录
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

  // 获取用户汇总
  async getUserSummary(userId: string, versionId: string) {
    return this.prisma.creditSummary.findUnique({
      where: {
        userId_versionId: { userId, versionId },
      },
    });
  }

  // 获取所有用户汇总（PM专用）
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

  // 获取用户在某版本的信用详情（含各阶段统计）
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

  // ===== 新增：矫正功能 =====

  // 预览矫正效果
  async previewCorrection(dto: CorrectRecordDto) {
    const record = await this.prisma.creditRecord.findUnique({
      where: { id: dto.recordId },
    });

    if (!record) {
      throw new Error('记录不存在');
    }

    // 如果有新的日期，重新计算延期天数和分数
    let newDelayDays = record.delayDays || 0;
    let newScore = record.score;

    if (dto.plannedDate && dto.actualDate) {
      const planned = new Date(dto.plannedDate);
      const actual = new Date(dto.actualDate);
      newDelayDays = Math.max(0, differenceInDays(actual, planned));

      // 重新计算分数
      newScore = await this.recalculateScore(
        record.sourceType,
        newDelayDays,
        record.ruleId,
      );
    } else if (dto.overrideScore !== undefined) {
      newScore = dto.overrideScore;
    }

    const scoreDiff = newScore - record.score;

    return {
      originalScore: record.score,
      newScore,
      scoreDiff,
      newDelayDays,
      originalDelayDays: record.delayDays || 0,
    };
  }

  // 矫正单条记录
  async correctRecord(dto: CorrectRecordDto, operatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. 获取原始记录
      const originalRecord = await tx.creditRecord.findUnique({
        where: { id: dto.recordId },
      });

      if (!originalRecord) {
        throw new Error('记录不存在');
      }

      // 2. 保存原始数据
      const originalScore = originalRecord.score;
      const originalDelayDays = originalRecord.delayDays || 0;
      const originalPlannedDate = originalRecord.plannedDate;
      const originalActualDate = originalRecord.actualDate;

      // 3. 重新计算分数
      let newScore = originalScore;
      let newDelayDays = originalDelayDays;
      let newPlannedDate = originalPlannedDate;
      let newActualDate = originalActualDate;
      let correctionType = 'time_correction';

      if (dto.plannedDate && dto.actualDate) {
        newPlannedDate = new Date(dto.plannedDate);
        newActualDate = new Date(dto.actualDate);
        newDelayDays = Math.max(0, differenceInDays(newActualDate, newPlannedDate));

        newScore = await this.recalculateScore(
          originalRecord.sourceType,
          newDelayDays,
          originalRecord.ruleId,
        );
      } else if (dto.overrideScore !== undefined) {
        newScore = dto.overrideScore;
        correctionType = 'score_override';
      }

      // 4. 计算分数差值
      const scoreDiff = newScore - originalScore;

      // 5. 创建矫正记录
      const correction = await tx.creditCorrection.create({
        data: {
          recordId: dto.recordId,
          correctionType,
          originalPlannedDate,
          originalActualDate,
          originalDelayDays,
          originalScore,
          correctedPlannedDate: newPlannedDate,
          correctedActualDate: newActualDate,
          correctedDelayDays: newDelayDays,
          correctedScore: newScore,
          scoreDiff,
          reason: dto.reason,
          operatedBy: operatorId,
        },
      });

      // 6. 更新信用记录
      await tx.creditRecord.update({
        where: { id: dto.recordId },
        data: {
          isCorrected: true,
          correctedAt: new Date(),
          correctedBy: operatorId,
          correctionRemark: dto.reason,
          score: newScore,
          delayDays: newDelayDays,
          plannedDate: newPlannedDate,
          actualDate: newActualDate,
        },
      });

      // 7. 更新汇总
      if (originalRecord.versionId && scoreDiff !== 0) {
        await this.updateSummaryAfterCorrection(
          originalRecord.userId,
          originalRecord.versionId,
          scoreDiff,
          originalRecord.sourceType,
          tx,
        );
      }

      return {
        correction,
        scoreDiff,
        message:
          scoreDiff > 0
            ? `已补回 ${scoreDiff} 分`
            : scoreDiff < 0
              ? `已扣除 ${Math.abs(scoreDiff)} 分`
              : '分数无变化',
      };
    });
  }

  // 矫正后更新汇总
  private async updateSummaryAfterCorrection(
    userId: string,
    versionId: string,
    scoreDiff: number,
    sourceType: CreditSourceType,
    tx: any,
  ) {
    const summary = await tx.creditSummary.findUnique({
      where: { userId_versionId: { userId, versionId } },
    });

    if (!summary) return;

    const updateData: any = {
      totalScore: summary.totalScore + scoreDiff,
    };

    // 根据来源类型更新对应字段
    if (sourceType === CreditSourceType.REQUIREMENT) {
      updateData.requirementScore = summary.requirementScore + scoreDiff;
    } else if (sourceType === CreditSourceType.ISSUE) {
      updateData.issueScore = summary.issueScore + scoreDiff;
    }

    // 更新延期扣分
    if (scoreDiff > 0 && summary.delayDeduction >= scoreDiff) {
      // 补分，减少延期扣分
      updateData.delayDeduction = summary.delayDeduction - scoreDiff;
    } else if (scoreDiff < 0) {
      // 额外扣分，增加延期扣分
      updateData.delayDeduction = summary.delayDeduction + Math.abs(scoreDiff);
    }

    await tx.creditSummary.update({
      where: { id: summary.id },
      data: updateData,
    });
  }

  // 重新计算分数
  private async recalculateScore(
    sourceType: CreditSourceType,
    delayDays: number,
    ruleId: string | null,
  ): Promise<number> {
    if (!ruleId) return 0;

    const baseRule = await this.prisma.creditRule.findUnique({
      where: { id: ruleId },
    });

    if (!baseRule) return 0;

    let score = baseRule.score;

    // 如果有延期，查找延期规则并扣分
    if (delayDays > 0) {
      const delayRule = await this.ruleService.findByDelayDays(delayDays);
      if (delayRule) {
        score += delayRule.score; // 延期扣分（负数）
      }
    }

    return score;
  }

  // 批量矫正
  async batchCorrectRecords(dto: BatchCorrectDto, operatorId: string) {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const correction of dto.corrections) {
      try {
        const result = await this.correctRecord(correction, operatorId);
        results.push({ recordId: correction.recordId, success: true, result });
        successCount++;
      } catch (error: any) {
        results.push({
          recordId: correction.recordId,
          success: false,
          error: error.message,
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  // 获取矫正历史
  async getCorrectionHistory(recordId: string) {
    return this.prisma.creditCorrection.findMany({
      where: { recordId },
      include: {
        operator: { select: { id: true, name: true, employeeNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
