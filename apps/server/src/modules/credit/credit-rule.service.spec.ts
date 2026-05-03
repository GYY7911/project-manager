import { Test, TestingModule } from '@nestjs/testing';
import { CreditRuleService } from './credit-rule.service';
import { CreateCreditRuleDto } from './credit.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditRuleType } from '@prisma/client';

describe('CreditRuleService', () => {
  let service: CreditRuleService;
  let prisma: PrismaService;

  const mockPrismaService = {
    creditRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockRule = {
    id: 'rule-1',
    ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
    name: '需求完成',
    description: '按期完成需求',
    score: 10,
    delayDays: null,
    isCustom: false,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditRuleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CreditRuleService>(CreditRuleService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto: CreateCreditRuleDto = {
      ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
      name: '需求完成',
      description: '按期完成需求',
      score: 10,
    };

    it('应该成功创建信用规则', async () => {
      mockPrismaService.creditRule.create.mockResolvedValue(mockRule);

      const result = await service.create(createDto, 'user-1');

      expect(result).toEqual(mockRule);
      expect(mockPrismaService.creditRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...createDto,
          createdById: 'user-1',
        }),
      });
    });

    it('应该支持创建延期规则', async () => {
      const delayRule = {
        ...mockRule,
        ruleType: CreditRuleType.DELAY,
        name: '延期1天',
        score: -2,
        delayDays: 1,
      };

      mockPrismaService.creditRule.create.mockResolvedValue(delayRule);

      const result = await service.create(
        {
          ruleType: CreditRuleType.DELAY,
          name: '延期1天',
          score: -2,
          delayDays: 1,
        },
        'user-1'
      );

      expect(result.delayDays).toBe(1);
      expect(result.score).toBe(-2);
    });

    it('应该支持创建自定义规则', async () => {
      const customRule = {
        ...mockRule,
        isCustom: true,
      };

      mockPrismaService.creditRule.create.mockResolvedValue(customRule);

      const result = await service.create(
        {
          ...createDto,
          isCustom: true,
        },
        'user-1'
      );

      expect(result.isCustom).toBe(true);
    });
  });

  describe('findAll', () => {
    it('应该返回所有信用规则', async () => {
      const rules = [mockRule];
      mockPrismaService.creditRule.findMany.mockResolvedValue(rules);

      const result = await service.findAll();

      expect(result).toEqual(rules);
    });

    it('应该按 ruleType 和 createdAt 排序', async () => {
      mockPrismaService.creditRule.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(mockPrismaService.creditRule.findMany).toHaveBeenCalledWith({
        orderBy: [{ ruleType: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('无规则时应该返回空数组', async () => {
      mockPrismaService.creditRule.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('应该根据类型查找规则', async () => {
      mockPrismaService.creditRule.findFirst.mockResolvedValue(mockRule);

      const result = await service.findByType(CreditRuleType.REQUIREMENT_COMPLETE);

      expect(result).toEqual(mockRule);
      expect(mockPrismaService.creditRule.findFirst).toHaveBeenCalledWith({
        where: { ruleType: CreditRuleType.REQUIREMENT_COMPLETE },
      });
    });

    it('未找到规则时应该返回 null', async () => {
      mockPrismaService.creditRule.findFirst.mockResolvedValue(null);

      const result = await service.findByType(CreditRuleType.MANUAL);

      expect(result).toBeNull();
    });
  });

  describe('findByDelayDays', () => {
    it('应该找到适用于指定延期天数的规则', async () => {
      const delayRule = {
        ...mockRule,
        ruleType: CreditRuleType.DELAY,
        delayDays: 3,
      };

      mockPrismaService.creditRule.findFirst.mockResolvedValue(delayRule);

      const result = await service.findByDelayDays(5);

      expect(result).toEqual(delayRule);
      expect(mockPrismaService.creditRule.findFirst).toHaveBeenCalledWith({
        where: {
          ruleType: CreditRuleType.DELAY,
          delayDays: { lte: 5 },
        },
        orderBy: { delayDays: 'desc' },
      });
    });

    it('应该选择最接近但不超出的延期规则', async () => {
      // 如果延期5天，有1天、3天、7天的规则，应该选择3天的
      const delayRule = {
        ...mockRule,
        delayDays: 3,
      };

      mockPrismaService.creditRule.findFirst.mockResolvedValue(delayRule);

      await service.findByDelayDays(5);

      expect(mockPrismaService.creditRule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { delayDays: 'desc' },
        })
      );
    });

    it('延期天数为0时应该返回 null', async () => {
      mockPrismaService.creditRule.findFirst.mockResolvedValue(null);

      const result = await service.findByDelayDays(0);

      // delayDays: { lte: 0 } 可能不会匹配任何延期规则
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('应该成功更新规则', async () => {
      const updatedRule = {
        ...mockRule,
        score: 15,
      };

      mockPrismaService.creditRule.update.mockResolvedValue(updatedRule);

      const result = await service.update('rule-1', { score: 15 });

      expect(result.score).toBe(15);
    });

    it('应该支持更新部分字段', async () => {
      mockPrismaService.creditRule.update.mockResolvedValue(mockRule);

      await service.update('rule-1', { description: '新描述' });

      expect(mockPrismaService.creditRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { description: '新描述' },
      });
    });
  });

  describe('remove', () => {
    it('应该成功删除规则', async () => {
      mockPrismaService.creditRule.delete.mockResolvedValue(mockRule);

      const result = await service.remove('rule-1');

      expect(result).toEqual(mockRule);
      expect(mockPrismaService.creditRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });
  });

  describe('initDefaultRules', () => {
    it('应该初始化所有默认规则', async () => {
      mockPrismaService.creditRule.findFirst.mockResolvedValue(null);
      mockPrismaService.creditRule.create.mockResolvedValue(mockRule);

      await service.initDefaultRules('admin-1');

      // 应该为每个默认规则调用 create
      expect(mockPrismaService.creditRule.create).toHaveBeenCalled();
    });

    it('已存在的规则不应该重复创建', async () => {
      // 模拟所有规则都已存在
      mockPrismaService.creditRule.findFirst.mockResolvedValue(mockRule);

      await service.initDefaultRules('admin-1');

      expect(mockPrismaService.creditRule.create).not.toHaveBeenCalled();
    });

    it('应该检查规则类型和名称是否已存在', async () => {
      mockPrismaService.creditRule.findFirst.mockResolvedValue(null);
      mockPrismaService.creditRule.create.mockResolvedValue(mockRule);

      await service.initDefaultRules('admin-1');

      expect(mockPrismaService.creditRule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ruleType: expect.any(String),
            name: expect.any(String),
          }),
        })
      );
    });
  });
});

describe('CreditRuleType 枚举验证', () => {
  it('应该包含所有预期的规则类型', () => {
    expect(CreditRuleType.REQUIREMENT_COMPLETE).toBe('REQUIREMENT_COMPLETE');
    expect(CreditRuleType.ISSUE_COMPLETE).toBe('ISSUE_COMPLETE');
    expect(CreditRuleType.DELAY).toBe('DELAY');
    expect(CreditRuleType.REVIEW_DELAY).toBe('REVIEW_DELAY');
    expect(CreditRuleType.MANUAL).toBe('MANUAL');
  });
});
