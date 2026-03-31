import { Test, TestingModule } from '@nestjs/testing';
import { CreditScheduler } from './credit.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from './credit.service';
import { CreditRuleService } from './credit-rule.service';
import { CreditSourceType, CreditRuleType, RequirementStatus, IssueStatus } from '@prisma/client';

describe('CreditScheduler', () => {
  let scheduler: CreditScheduler;
  let prisma: PrismaService;
  let creditService: CreditService;
  let ruleService: CreditRuleService;

  const mockPrismaService = {
    requirement: {
      findMany: jest.fn(),
    },
    issue: {
      findMany: jest.fn(),
    },
    creditRecord: {
      findFirst: jest.fn(),
    },
  };

  const mockCreditService = {
    createRecord: jest.fn(),
  };

  const mockRuleService = {
    findByDelayDays: jest.fn(),
  };

  const mockDelayRule = {
    id: 'rule-1',
    ruleType: CreditRuleType.DELAY,
    name: '延期1天',
    score: -2,
    delayDays: 1,
  };

  const mockDelayedRequirement = {
    id: 'req-1',
    code: 'FE001',
    title: '测试需求',
    assigneeId: 'user-1',
    versionId: 'version-1',
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    status: RequirementStatus.IN_PROGRESS,
  };

  const mockDelayedIssue = {
    id: 'issue-1',
    code: 'ISSUE001',
    title: '测试问题单',
    assigneeId: 'user-1',
    versionId: 'version-1',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    status: IssueStatus.IN_PROGRESS,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditScheduler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CreditService,
          useValue: mockCreditService,
        },
        {
          provide: CreditRuleService,
          useValue: mockRuleService,
        },
      ],
    }).compile();

    scheduler = module.get<CreditScheduler>(CreditScheduler);
    prisma = module.get<PrismaService>(PrismaService);
    creditService = module.get<CreditService>(CreditService);
    ruleService = module.get<CreditRuleService>(CreditRuleService);
  });

  describe('checkDelay', () => {
    it('应该为延期的需求创建信用记录', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([mockDelayedRequirement]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue(null);
      mockRuleService.findByDelayDays.mockResolvedValue(mockDelayRule);
      mockCreditService.createRecord.mockResolvedValue({});

      await scheduler.checkDelay();

      expect(mockCreditService.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          sourceType: CreditSourceType.REQUIREMENT,
          sourceId: 'req-1',
          remark: expect.stringContaining('需求延期'),
        })
      );
    });

    it('应该为延期的问题单创建信用记录', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([mockDelayedIssue]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue(null);
      mockRuleService.findByDelayDays.mockResolvedValue(mockDelayRule);
      mockCreditService.createRecord.mockResolvedValue({});

      await scheduler.checkDelay();

      expect(mockCreditService.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          sourceType: CreditSourceType.ISSUE,
          sourceId: 'issue-1',
          remark: expect.stringContaining('问题单延期'),
        })
      );
    });

    it('如果今天已记录过延期，不应该重复创建', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([mockDelayedRequirement]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue({ id: 'existing-record' });

      await scheduler.checkDelay();

      expect(mockCreditService.createRecord).not.toHaveBeenCalled();
    });

    it('没有延期规则时不应该创建记录', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([mockDelayedRequirement]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue(null);
      mockRuleService.findByDelayDays.mockResolvedValue(null);

      await scheduler.checkDelay();

      expect(mockCreditService.createRecord).not.toHaveBeenCalled();
    });

    it('延期问题单没有规则时不应该创建记录', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([mockDelayedIssue]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue(null);
      mockRuleService.findByDelayDays.mockResolvedValue(null);

      await scheduler.checkDelay();

      expect(mockCreditService.createRecord).not.toHaveBeenCalled();
    });

    it('没有延期需求时不应该创建记录', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockRuleService.findByDelayDays.mockResolvedValue(mockDelayRule);

      await scheduler.checkDelay();

      expect(mockCreditService.createRecord).not.toHaveBeenCalled();
    });

    it('应该查询延期的需求（dueDate < now 且 status 不是 COMPLETED）', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      await scheduler.checkDelay();

      expect(mockPrismaService.requirement.findMany).toHaveBeenCalledWith({
        where: {
          dueDate: { lt: expect.any(Date) },
          status: { not: 'COMPLETED' },
        },
      });
    });

    it('应该查询延期的问题单（dueDate < now 且 status 不是 CLOSED 或 VERIFIED）', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      await scheduler.checkDelay();

      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith({
        where: {
          dueDate: { lt: expect.any(Date) },
          status: { notIn: ['CLOSED', 'VERIFIED'] },
        },
      });
    });

    it('应该正确计算延期天数', async () => {
      const reqDue3DaysAgo = {
        ...mockDelayedRequirement,
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.requirement.findMany.mockResolvedValue([reqDue3DaysAgo]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue(null);
      mockRuleService.findByDelayDays.mockResolvedValue(mockDelayRule);
      mockCreditService.createRecord.mockResolvedValue({});

      await scheduler.checkDelay();

      // Check that the remark contains the correct delay days
      expect(mockCreditService.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          remark: expect.stringMatching(/延期第3天/),
        })
      );
    });

    it('应该同时处理多个延期的需求和问题单', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([
        mockDelayedRequirement,
        { ...mockDelayedRequirement, id: 'req-2' },
      ]);
      mockPrismaService.issue.findMany.mockResolvedValue([
        mockDelayedIssue,
        { ...mockDelayedIssue, id: 'issue-2' },
      ]);
      mockPrismaService.creditRecord.findFirst.mockResolvedValue(null);
      mockRuleService.findByDelayDays.mockResolvedValue(mockDelayRule);
      mockCreditService.createRecord.mockResolvedValue({});

      await scheduler.checkDelay();

      // 2 requirements + 2 issues = 4 records
      expect(mockCreditService.createRecord).toHaveBeenCalledTimes(4);
    });
  });
});
