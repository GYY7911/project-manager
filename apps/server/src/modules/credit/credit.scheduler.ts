import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from './credit.service';
import { CreditRuleService } from './credit-rule.service';
import { differenceInDays } from 'date-fns';

@Injectable()
export class CreditScheduler {
  private readonly logger = new Logger(CreditScheduler.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
    private ruleService: CreditRuleService,
  ) {}

  // 每天凌晨1点检测延期
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkDelay() {
    this.logger.log('开始检测延期任务...');

    const now = new Date();

    // Check delayed requirements
    const delayedRequirements = await this.prisma.requirement.findMany({
      where: {
        dueDate: { lt: now },
        status: { not: 'COMPLETED' },
      },
    });

    for (const req of delayedRequirements) {
      const delayDays = differenceInDays(now, req.dueDate!);

      // Check if already recorded today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const existingRecord = await this.prisma.creditRecord.findFirst({
        where: {
          userId: req.assigneeId,
          sourceType: 'REQUIREMENT',
          sourceId: req.id,
          remark: { contains: `延期第${delayDays}天` },
          createdAt: { gte: todayStart },
        },
      });

      if (!existingRecord) {
        const delayRule = await this.ruleService.findByDelayDays(1);
        if (delayRule) {
          await this.creditService.createRecord({
            userId: req.assigneeId,
            ruleId: delayRule.id,
            score: delayRule.score,
            sourceType: 'REQUIREMENT',
            sourceId: req.id,
            remark: `需求延期第${delayDays}天`,
            versionId: req.versionId,
            requirementId: req.id,
          });

          this.logger.log(
            `需求 ${req.code} 延期第${delayDays}天，扣分 ${delayRule.score}`,
          );
        }
      }
    }

    // Check delayed issues
    const delayedIssues = await this.prisma.issue.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['CLOSED', 'VERIFIED'] },
      },
    });

    for (const issue of delayedIssues) {
      const delayDays = differenceInDays(now, issue.dueDate!);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const existingRecord = await this.prisma.creditRecord.findFirst({
        where: {
          userId: issue.assigneeId,
          sourceType: 'ISSUE',
          sourceId: issue.id,
          remark: { contains: `延期第${delayDays}天` },
          createdAt: { gte: todayStart },
        },
      });

      if (!existingRecord) {
        const delayRule = await this.ruleService.findByDelayDays(1);
        if (delayRule) {
          await this.creditService.createRecord({
            userId: issue.assigneeId,
            ruleId: delayRule.id,
            score: delayRule.score,
            sourceType: 'ISSUE',
            sourceId: issue.id,
            remark: `问题单延期第${delayDays}天`,
            versionId: issue.versionId,
            issueId: issue.id,
          });

          this.logger.log(
            `问题单 ${issue.code} 延期第${delayDays}天，扣分 ${delayRule.score}`,
          );
        }
      }
    }

    this.logger.log('延期检测完成');
  }
}
