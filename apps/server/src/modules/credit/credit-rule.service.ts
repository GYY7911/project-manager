import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditRuleType } from '@prisma/client';

export interface CreateCreditRuleDto {
  ruleType: CreditRuleType;
  name: string;
  description?: string;
  score: number;
  delayDays?: number;
  isCustom?: boolean;
}

@Injectable()
export class CreditRuleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCreditRuleDto, userId: string) {
    return this.prisma.creditRule.create({
      data: {
        ...dto,
        createdById: userId,
      },
    });
  }

  async findAll() {
    return this.prisma.creditRule.findMany({
      orderBy: [{ ruleType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findByType(ruleType: CreditRuleType) {
    return this.prisma.creditRule.findFirst({
      where: { ruleType },
    });
  }

  async findByDelayDays(days: number) {
    return this.prisma.creditRule.findFirst({
      where: {
        ruleType: CreditRuleType.DELAY,
        delayDays: { lte: days },
      },
      orderBy: { delayDays: 'desc' },
    });
  }

  async update(id: string, data: Partial<CreateCreditRuleDto>) {
    return this.prisma.creditRule.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.creditRule.delete({
      where: { id },
    });
  }

  // 初始化默认规则
  async initDefaultRules(userId: string) {
    const defaults = [
      {
        ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
        name: '需求完成',
        description: '按期完成需求',
        score: 10,
      },
      {
        ruleType: CreditRuleType.ISSUE_COMPLETE,
        name: '问题单完成',
        description: '按期完成问题单',
        score: 5,
      },
      {
        ruleType: CreditRuleType.DELAY,
        name: '延期1天',
        description: '延期1天扣分',
        score: -2,
        delayDays: 1,
      },
      {
        ruleType: CreditRuleType.DELAY,
        name: '延期2天',
        description: '延期2天扣分',
        score: -4,
        delayDays: 2,
      },
      {
        ruleType: CreditRuleType.REVIEW_DELAY,
        name: '评审延期',
        description: '架构师评审延期',
        score: -2,
      },
    ];

    for (const rule of defaults) {
      const existing = await this.prisma.creditRule.findFirst({
        where: { ruleType: rule.ruleType, name: rule.name },
      });

      if (!existing) {
        await this.prisma.creditRule.create({
          data: {
            ...rule,
            createdById: userId,
          },
        });
      }
    }
  }
}
