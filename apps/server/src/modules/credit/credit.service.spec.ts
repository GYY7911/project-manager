import { Test, TestingModule } from '@nestjs/testing';
import { CreditService, CreateCreditRecordDto, CorrectRecordDto, BatchCorrectDto } from './credit.service';
import { CreditRuleService } from './credit-rule.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditSourceType, CreditRuleType } from '@prisma/client';

describe('CreditService', () => {
  let service: CreditService;
  let prisma: PrismaService;
  let ruleService: CreditRuleService;

  const mockPrismaService: any = {
    creditRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    creditSummary: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    creditCorrection: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    requirement: {
      findMany: jest.fn(),
    },
    issue: {
      findMany: jest.fn(),
    },
    creditRule: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Setup $transaction mock to call the callback with mockPrismaService
  beforeAll(() => {
    mockPrismaService.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(mockPrismaService));
  });

  const mockRuleService = {
    findByType: jest.fn(),
    findByDelayDays: jest.fn(),
  };

  const mockCreditRecord = {
    id: 'record-1',
    userId: 'user-1',
    ruleId: 'rule-1',
    score: 10,
    sourceType: CreditSourceType.REQUIREMENT,
    sourceId: 'req-1',
    remark: '按期完成需求',
    versionId: 'version-1',
    requirementId: 'req-1',
    issueId: null,
    workflowStage: 'FEATURE_DEV',
    delayDays: 0,
    plannedDate: new Date('2026-03-20'),
    actualDate: new Date('2026-03-20'),
    isCorrected: false,
    createdAt: new Date(),
  };

  const mockCreditSummary = {
    id: 'summary-1',
    userId: 'user-1',
    versionId: 'version-1',
    totalScore: 100,
    requirementScore: 80,
    issueScore: 20,
    delayDeduction: 10,
    manualAdjustment: 0,
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      name: '张三',
      employeeNo: 'z001',
      team: '开发组',
      role: 'MEMBER',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CreditRuleService,
          useValue: mockRuleService,
        },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
    prisma = module.get<PrismaService>(PrismaService);
    ruleService = module.get<CreditRuleService>(CreditRuleService);
  });

  describe('createRecord', () => {
    const createDto: CreateCreditRecordDto = {
      userId: 'user-1',
      ruleId: 'rule-1',
      score: 10,
      sourceType: CreditSourceType.REQUIREMENT,
      sourceId: 'req-1',
      remark: '按期完成需求',
      versionId: 'version-1',
      requirementId: 'req-1',
    };

    it('应该成功创建信用记录', async () => {
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      const result = await service.createRecord(createDto);

      expect(result).toEqual(mockCreditRecord);
      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          score: 10,
          sourceType: CreditSourceType.REQUIREMENT,
        }),
      });
    });

    it('创建记录后应该更新汇总', async () => {
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      await service.createRecord(createDto);

      expect(mockPrismaService.creditSummary.create).toHaveBeenCalled();
    });

    it('如果汇总已存在，应该更新而非创建', async () => {
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue({
        ...mockCreditSummary,
        totalScore: 110,
      });

      await service.createRecord(createDto);

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalled();
    });

    it('应该支持可选字段', async () => {
      const minimalDto: CreateCreditRecordDto = {
        userId: 'user-1',
        score: 5,
        sourceType: CreditSourceType.MANUAL_ADJUST,
      };

      mockPrismaService.creditRecord.create.mockResolvedValue({
        ...mockCreditRecord,
        ...minimalDto,
      });

      await service.createRecord(minimalDto);

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowStage: undefined,
          delayDays: undefined,
        }),
      });
    });

    it('问题单来源应该更新 issueScore', async () => {
      const issueDto: CreateCreditRecordDto = {
        ...createDto,
        sourceType: CreditSourceType.ISSUE,
        issueId: 'issue-1',
      };

      mockPrismaService.creditRecord.create.mockResolvedValue({
        ...mockCreditRecord,
        sourceType: CreditSourceType.ISSUE,
      });
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      await service.createRecord(issueDto);

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            issueScore: expect.any(Number),
          }),
        })
      );
    });

    it('负分应该更新 delayDeduction', async () => {
      const negativeDto: CreateCreditRecordDto = {
        ...createDto,
        score: -5,
      };

      mockPrismaService.creditRecord.create.mockResolvedValue({
        ...mockCreditRecord,
        score: -5,
      });
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      await service.createRecord(negativeDto);

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delayDeduction: expect.any(Number),
          }),
        })
      );
    });

    it('手动调整来源应该更新 manualAdjustment', async () => {
      const manualDto: CreateCreditRecordDto = {
        userId: 'user-1',
        score: 15,
        sourceType: CreditSourceType.MANUAL_ADJUST,
        remark: '手动奖励',
        versionId: 'version-1',
      };

      mockPrismaService.creditRecord.create.mockResolvedValue({
        ...mockCreditRecord,
        sourceType: CreditSourceType.MANUAL_ADJUST,
        score: 15,
      });
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      await service.createRecord(manualDto);

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manualAdjustment: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('onRequirementComplete', () => {
    it('应该为按期完成的需求加分', async () => {
      const rule = { id: 'rule-1', score: 10, ruleType: CreditRuleType.REQUIREMENT_COMPLETE };
      mockRuleService.findByType.mockResolvedValue(rule);
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      await service.onRequirementComplete(
        'user-1',
        'req-1',
        'version-1',
        new Date('2026-03-25'), // dueDate in future
        'FEATURE_DEV'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 10,
            remark: '按期完成需求',
            delayDays: 0,
          }),
        })
      );
    });

    it('应该为延期完成的需求扣分', async () => {
      const rule = { id: 'rule-1', score: 10, ruleType: CreditRuleType.REQUIREMENT_COMPLETE };
      const delayRule = { id: 'rule-2', score: -5, delayDays: 3 };

      mockRuleService.findByType.mockResolvedValue(rule);
      mockRuleService.findByDelayDays.mockResolvedValue(delayRule);
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      // dueDate in past (5 days ago)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 5);

      await service.onRequirementComplete(
        'user-1',
        'req-1',
        'version-1',
        dueDate,
        'FEATURE_DEV'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 5, // 10 + (-5)
            delayDays: expect.any(Number),
          }),
        })
      );
    });

    it('应该使用延期规则计算扣分', async () => {
      const rule = { id: 'rule-1', score: 10, ruleType: CreditRuleType.REQUIREMENT_COMPLETE };
      const delayRule = { id: 'rule-2', score: -8, delayDays: 1 };

      mockRuleService.findByType.mockResolvedValue(rule);
      mockRuleService.findByDelayDays.mockResolvedValue(delayRule);
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 3);

      await service.onRequirementComplete(
        'user-1',
        'req-1',
        'version-1',
        dueDate,
        'FEATURE_DEV'
      );

      // 验证延期规则被查找并应用
      expect(mockRuleService.findByDelayDays).toHaveBeenCalled();
      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 2, // 10 + (-8)
          }),
        })
      );
    });

    it('没有规则时应该不创建记录', async () => {
      mockRuleService.findByType.mockResolvedValue(null);

      await service.onRequirementComplete(
        'user-1',
        'req-1',
        'version-1',
        new Date('2026-03-25'),
        'FEATURE_DEV'
      );

      expect(mockPrismaService.creditRecord.create).not.toHaveBeenCalled();
    });

    it('没有 dueDate 时应该视为按期完成', async () => {
      const rule = { id: 'rule-1', score: 10, ruleType: CreditRuleType.REQUIREMENT_COMPLETE };
      mockRuleService.findByType.mockResolvedValue(rule);
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      await service.onRequirementComplete(
        'user-1',
        'req-1',
        'version-1',
        null,
        'FEATURE_DEV'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            remark: '按期完成需求',
            delayDays: 0,
          }),
        })
      );
    });
  });

  describe('onIssueComplete', () => {
    it('应该为按期完成的问题单加分', async () => {
      const rule = { id: 'rule-1', score: 5, ruleType: CreditRuleType.ISSUE_COMPLETE };
      mockRuleService.findByType.mockResolvedValue(rule);
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      await service.onIssueComplete(
        'user-1',
        'issue-1',
        'version-1',
        new Date('2026-03-25'),
        'ISSUE_FIX'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 5,
            sourceType: CreditSourceType.ISSUE,
            remark: '按期完成问题单',
          }),
        })
      );
    });

    it('应该为延期完成的问题单扣分', async () => {
      const rule = { id: 'rule-1', score: 5, ruleType: CreditRuleType.ISSUE_COMPLETE };
      const delayRule = { id: 'rule-2', score: -3, delayDays: 2 };

      mockRuleService.findByType.mockResolvedValue(rule);
      mockRuleService.findByDelayDays.mockResolvedValue(delayRule);
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 3);

      await service.onIssueComplete(
        'user-1',
        'issue-1',
        'version-1',
        dueDate,
        'ISSUE_FIX'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 2, // 5 + (-3)
            delayDays: expect.any(Number),
          }),
        })
      );
    });

    it('没有规则时应该不创建记录', async () => {
      mockRuleService.findByType.mockResolvedValue(null);

      await service.onIssueComplete(
        'user-1',
        'issue-1',
        'version-1',
        new Date('2026-03-25'),
        'ISSUE_FIX'
      );

      expect(mockPrismaService.creditRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('manualAdjust', () => {
    it('应该成功创建手动调整记录', async () => {
      mockPrismaService.creditRecord.create.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      const result = await service.manualAdjust(
        'user-1',
        'version-1',
        5,
        '表现优秀',
        'admin-1'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            score: 5,
            sourceType: CreditSourceType.MANUAL_ADJUST,
            remark: '表现优秀 (操作人: admin-1)',
            versionId: 'version-1',
          }),
        })
      );
    });

    it('应该支持负分调整', async () => {
      mockPrismaService.creditRecord.create.mockResolvedValue({
        ...mockCreditRecord,
        score: -10,
      });
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);
      mockPrismaService.creditSummary.create.mockResolvedValue(mockCreditSummary);

      await service.manualAdjust(
        'user-1',
        'version-1',
        -10,
        '惩罚扣分',
        'admin-1'
      );

      expect(mockPrismaService.creditRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: -10,
          }),
        })
      );
    });
  });

  describe('getUserRecords', () => {
    it('应该返回用户的所有信用记录', async () => {
      const records = [mockCreditRecord];
      mockPrismaService.creditRecord.findMany.mockResolvedValue(records);

      const result = await service.getUserRecords('user-1');

      expect(result).toEqual(records);
      expect(mockPrismaService.creditRecord.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { rule: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('应该支持按版本过滤', async () => {
      mockPrismaService.creditRecord.findMany.mockResolvedValue([]);

      await service.getUserRecords('user-1', 'version-1');

      expect(mockPrismaService.creditRecord.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', versionId: 'version-1' },
        include: { rule: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('无记录时应该返回空数组', async () => {
      mockPrismaService.creditRecord.findMany.mockResolvedValue([]);

      const result = await service.getUserRecords('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserSummary', () => {
    it('应该返回用户的信用汇总', async () => {
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);

      const result = await service.getUserSummary('user-1', 'version-1');

      expect(result).toEqual(mockCreditSummary);
      expect(mockPrismaService.creditSummary.findUnique).toHaveBeenCalledWith({
        where: { userId_versionId: { userId: 'user-1', versionId: 'version-1' } },
      });
    });

    it('无汇总时应该返回 null', async () => {
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);

      const result = await service.getUserSummary('user-1', 'version-1');

      expect(result).toBeNull();
    });
  });

  describe('getAllSummaries', () => {
    const mockUsers = [
      { id: 'user-1', name: '张三', employeeNo: 'z001', team: '开发组', role: 'MEMBER' },
      { id: 'user-2', name: '李四', employeeNo: 'z002', team: '开发组', role: 'PM' },
    ];

    it('应该返回所有非 admin 用户的汇总', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.creditSummary.findMany.mockResolvedValue([
        { ...mockCreditSummary, userId: 'user-1' },
      ]);

      const result = await service.getAllSummaries('version-1');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: { not: 'ADMIN' } },
        select: expect.any(Object),
      });
    });

    it('没有汇总的用户应该显示为 0 分', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.creditSummary.findMany.mockResolvedValue([
        { ...mockCreditSummary, userId: 'user-1', totalScore: 100 },
      ]);

      const result = await service.getAllSummaries('version-1');

      // user-2 没有汇总，应该显示 0 分
      const user2Summary = result.find((s: any) => s.userId === 'user-2');
      expect(user2Summary.totalScore).toBe(0);
    });

    it('应该按总分降序排序', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.creditSummary.findMany.mockResolvedValue([
        { ...mockCreditSummary, userId: 'user-1', totalScore: 50 },
        { ...mockCreditSummary, userId: 'user-2', totalScore: 100 },
      ]);

      const result = await service.getAllSummaries('version-1');

      expect(result[0].totalScore).toBeGreaterThanOrEqual(result[1].totalScore);
    });

    it('没有用户时应该返回空数组', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.getAllSummaries('version-1');

      expect(result).toEqual([]);
    });
  });

  describe('checkVersionDelayPenalty', () => {
    it('应该计算版本延期率', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([
        { id: 'req-1', status: 'COMPLETED' },
        { id: 'req-2', status: 'COMPLETED' },
      ]);
      mockPrismaService.issue.findMany.mockResolvedValue([
        { id: 'issue-1', status: 'COMPLETED' },
      ]);
      mockPrismaService.creditRecord.count.mockResolvedValue(1);

      const result = await service.checkVersionDelayPenalty('version-1');

      expect(result.totalItems).toBe(3);
      expect(result.delayedItems).toBe(1);
      expect(result.delayRate).toBe(33);
    });

    it('延期率超过 50% 时应该惩罚', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([
        { id: 'req-1' },
        { id: 'req-2' },
      ]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.creditRecord.count.mockResolvedValue(2);

      const result = await service.checkVersionDelayPenalty('version-1');

      expect(result.shouldPenalize).toBe(true);
      expect(result.message).toContain('超过 50%');
    });

    it('延期率不超过 50% 时不应惩罚', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([
        { id: 'req-1' },
        { id: 'req-2' },
      ]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.creditRecord.count.mockResolvedValue(1);

      const result = await service.checkVersionDelayPenalty('version-1');

      expect(result.shouldPenalize).toBe(false);
    });

    it('无需求和问题单时应该返回 0 延期率', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      const result = await service.checkVersionDelayPenalty('version-1');

      expect(result.delayRate).toBe(0);
      expect(result.shouldPenalize).toBe(false);
    });
  });

  describe('getUserCreditDetail', () => {
    const mockUser = {
      id: 'user-1',
      name: '张三',
      employeeNo: 'z001',
      team: '开发组',
    };

    it('应该返回用户信用详情', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.creditRecord.findMany.mockResolvedValue([mockCreditRecord]);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);

      const result = await service.getUserCreditDetail('user-1', 'version-1');

      expect(result.user).toEqual(mockUser);
      expect(result.records).toHaveLength(1);
      expect(result.stageStats).toBeDefined();
    });

    it('应该按阶段分组统计', async () => {
      const records = [
        { ...mockCreditRecord, workflowStage: 'FEATURE_DEV', score: 10, delayDays: 0 },
        { ...mockCreditRecord, workflowStage: 'FEATURE_DEV', score: 5, delayDays: 2 },
        { ...mockCreditRecord, workflowStage: 'ISSUE_FIX', score: -3, delayDays: 1 },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.creditRecord.findMany.mockResolvedValue(records);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);

      const result = await service.getUserCreditDetail('user-1', 'version-1');

      expect(result.stageStats).toHaveLength(2);
    });

    it('用户不存在时应该抛出错误', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserCreditDetail('non-existent', 'version-1')).rejects.toThrow(
        '用户不存在'
      );
    });

    it('无汇总时应该返回默认值', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.creditRecord.findMany.mockResolvedValue([]);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(null);

      const result = await service.getUserCreditDetail('user-1', 'version-1');

      expect(result.summary.totalScore).toBe(0);
    });
  });

  describe('previewCorrection', () => {
    it('应该预览矫正效果', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        score: 10,
      });
      mockRuleService.findByDelayDays.mockResolvedValue(null);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        plannedDate: '2026-03-20',
        actualDate: '2026-03-22',
        reason: '日期修正',
      };

      const result = await service.previewCorrection(dto);

      expect(result).toHaveProperty('originalScore');
      expect(result).toHaveProperty('newScore');
      expect(result).toHaveProperty('scoreDiff');
      expect(result).toHaveProperty('newDelayDays');
    });

    it('记录不存在时应该抛出错误', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(null);

      const dto: CorrectRecordDto = {
        recordId: 'non-existent',
        reason: '测试',
      };

      await expect(service.previewCorrection(dto)).rejects.toThrow('记录不存在');
    });

    it('应该支持直接覆盖分数', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 15,
        reason: '分数调整',
      };

      const result = await service.previewCorrection(dto);

      expect(result.newScore).toBe(15);
    });
  });

  describe('correctRecord', () => {
    it('应该成功矫正记录', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        score: 10,
      });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({
        id: 'correction-1',
        recordId: 'record-1',
      });
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        plannedDate: '2026-03-20',
        actualDate: '2026-03-20',
        reason: '日期修正',
      };

      const result = await service.correctRecord(dto, 'admin-1');

      expect(result).toHaveProperty('correction');
      expect(result).toHaveProperty('scoreDiff');
      expect(mockPrismaService.creditCorrection.create).toHaveBeenCalled();
    });

    it('记录不存在时应该抛出错误', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(null);

      const dto: CorrectRecordDto = {
        recordId: 'non-existent',
        reason: '测试',
      };

      await expect(service.correctRecord(dto, 'admin-1')).rejects.toThrow('记录不存在');
    });

    it('应该更新信用记录的矫正状态', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 15,
        reason: '分数调整',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isCorrected: true,
            score: 15,
          }),
        })
      );
    });

    it('分数变化时应该更新汇总', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 15,
        reason: '分数调整',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalled();
    });

    it('问题单来源矫正应该更新 issueScore', async () => {
      const issueRecord = {
        ...mockCreditRecord,
        sourceType: CreditSourceType.ISSUE,
        issueId: 'issue-1',
      };

      mockPrismaService.creditRecord.findUnique.mockResolvedValue(issueRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(issueRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 15,
        reason: '分数调整',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            issueScore: expect.any(Number),
          }),
        })
      );
    });

    it('负分差矫正应该增加 delayDeduction', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 5, // 分数从 10 降到 5，差值为 -5
        reason: '分数扣减',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditSummary.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delayDeduction: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('batchCorrectRecords', () => {
    it('应该批量矫正记录', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: BatchCorrectDto = {
        corrections: [
          { recordId: 'record-1', reason: '修正1' },
          { recordId: 'record-2', reason: '修正2' },
        ],
      };

      const result = await service.batchCorrectRecords(dto, 'admin-1');

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('部分失败时应该返回失败信息', async () => {
      mockPrismaService.creditRecord.findUnique
        .mockResolvedValueOnce(mockCreditRecord)
        .mockResolvedValueOnce(null);

      const dto: BatchCorrectDto = {
        corrections: [
          { recordId: 'record-1', reason: '修正1' },
          { recordId: 'record-2', reason: '修正2' },
        ],
      };

      const result = await service.batchCorrectRecords(dto, 'admin-1');

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('空数组时应该返回 0 成功', async () => {
      const dto: BatchCorrectDto = {
        corrections: [],
      };

      const result = await service.batchCorrectRecords(dto, 'admin-1');

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('getCorrectionHistory', () => {
    it('应该返回矫正历史', async () => {
      const mockHistory = [
        {
          id: 'correction-1',
          recordId: 'record-1',
          originalScore: 5,
          correctedScore: 10,
          operator: { id: 'admin-1', name: '管理员', employeeNo: 'admin' },
        },
      ];

      mockPrismaService.creditCorrection.findMany.mockResolvedValue(mockHistory);

      const result = await service.getCorrectionHistory('record-1');

      expect(result).toEqual(mockHistory);
      expect(mockPrismaService.creditCorrection.findMany).toHaveBeenCalledWith({
        where: { recordId: 'record-1' },
        include: {
          operator: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('无历史时应该返回空数组', async () => {
      mockPrismaService.creditCorrection.findMany.mockResolvedValue([]);

      const result = await service.getCorrectionHistory('record-1');

      expect(result).toEqual([]);
    });
  });
});

describe('Credit DTO 验证', () => {
  it('CreateCreditRecordDto 应该包含所有必要字段', () => {
    const dto: CreateCreditRecordDto = {
      userId: 'user-1',
      ruleId: 'rule-1',
      score: 10,
      sourceType: CreditSourceType.REQUIREMENT,
      sourceId: 'req-1',
      remark: '测试',
      versionId: 'version-1',
      requirementId: 'req-1',
      workflowStage: 'FEATURE_DEV',
      delayDays: 0,
    };

    expect(dto.userId).toBe('user-1');
    expect(dto.score).toBe(10);
    expect(dto.sourceType).toBe(CreditSourceType.REQUIREMENT);
  });

  it('CorrectRecordDto 应该包含必要字段', () => {
    const dto: CorrectRecordDto = {
      recordId: 'record-1',
      plannedDate: '2026-03-20',
      actualDate: '2026-03-22',
      reason: '日期修正',
    };

    expect(dto.recordId).toBe('record-1');
    expect(dto.reason).toBe('日期修正');
  });

  it('BatchCorrectDto 应该包含 corrections 数组', () => {
    const dto: BatchCorrectDto = {
      corrections: [
        { recordId: 'record-1', reason: '修正1' },
        { recordId: 'record-2', reason: '修正2' },
      ],
    };

    expect(dto.corrections).toHaveLength(2);
  });
});

describe('CreditSourceType 枚举验证', () => {
  it('应该包含所有预期的来源类型', () => {
    expect(CreditSourceType.REQUIREMENT).toBe('REQUIREMENT');
    expect(CreditSourceType.ISSUE).toBe('ISSUE');
    expect(CreditSourceType.MANUAL_ADJUST).toBe('MANUAL_ADJUST');
  });
});
