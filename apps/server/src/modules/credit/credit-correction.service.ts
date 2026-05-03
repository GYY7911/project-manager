import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditRuleService } from './credit-rule.service';
import { CreditSourceType } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { CorrectRecordDto, BatchCorrectDto } from './credit.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreditCorrectionService {
  constructor(
    private prisma: PrismaService,
    private ruleService: CreditRuleService,
  ) {}

  async previewCorrection(dto: CorrectRecordDto) {
    const record = await this.prisma.creditRecord.findUnique({
      where: { id: dto.recordId },
    });

    if (!record) {
      throw new Error('记录不存在');
    }

    let newDelayDays = record.delayDays || 0;
    let newScore = record.score;

    if (dto.plannedDate && dto.actualDate) {
      const planned = new Date(dto.plannedDate);
      const actual = new Date(dto.actualDate);
      newDelayDays = Math.max(0, differenceInDays(actual, planned));
      newScore = await this.recalculateScore(record.sourceType, newDelayDays, record.ruleId);
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

  async correctRecord(dto: CorrectRecordDto, operatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      return this.correctRecordInternal(dto, operatorId, tx);
    });
  }

  async batchCorrectRecords(dto: BatchCorrectDto, operatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const results: { recordId: string; success: boolean; result?: unknown; error?: string }[] = [];
      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const item of dto.corrections) {
        try {
          const result = await this.correctRecordInternal(item, operatorId, tx);
          results.push({ recordId: item.recordId, success: true, result });
          successCount++;
        } catch (error) {
          const message = (error as Error).message;
          results.push({ recordId: item.recordId, success: false, error: message });
          errors.push(`${item.recordId}: ${message}`);
          failedCount++;
        }
      }

      if (errors.length > 0) {
        throw new Error(`Batch correction failed: ${errors.join('; ')}`);
      }

      return { success: successCount, failed: failedCount, results };
    });
  }

  async getCorrectionHistory(recordId: string) {
    return this.prisma.creditCorrection.findMany({
      where: { recordId },
      include: {
        operator: { select: { id: true, name: true, employeeNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async correctRecordInternal(
    dto: CorrectRecordDto,
    operatorId: string,
    tx: Prisma.TransactionClient,
  ) {
    const originalRecord = await tx.creditRecord.findUnique({
      where: { id: dto.recordId },
    });

    if (!originalRecord) {
      throw new Error('记录不存在');
    }

    const originalScore = originalRecord.score;
    const originalDelayDays = originalRecord.delayDays || 0;
    const originalPlannedDate = originalRecord.plannedDate;
    const originalActualDate = originalRecord.actualDate;

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

    const scoreDiff = newScore - originalScore;

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
  }

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

    if (delayDays > 0) {
      const delayRule = await this.ruleService.findByDelayDays(delayDays);
      if (delayRule) {
        score += delayRule.score;
      }
    }

    return score;
  }

  private async updateSummaryAfterCorrection(
    userId: string,
    versionId: string,
    scoreDiff: number,
    sourceType: CreditSourceType,
    tx: Prisma.TransactionClient,
  ) {
    const summary = await tx.creditSummary.findUnique({
      where: { userId_versionId: { userId, versionId } },
    });

    if (!summary) return;

    const updateData: Record<string, number> = {
      totalScore: summary.totalScore + scoreDiff,
    };

    if (sourceType === CreditSourceType.REQUIREMENT) {
      updateData.requirementScore = summary.requirementScore + scoreDiff;
    } else if (sourceType === CreditSourceType.ISSUE) {
      updateData.issueScore = summary.issueScore + scoreDiff;
    }

    if (scoreDiff > 0 && summary.delayDeduction >= scoreDiff) {
      updateData.delayDeduction = summary.delayDeduction - scoreDiff;
    } else if (scoreDiff < 0) {
      updateData.delayDeduction = summary.delayDeduction + Math.abs(scoreDiff);
    }

    await tx.creditSummary.update({
      where: { id: summary.id },
      data: updateData,
    });
  }
}
