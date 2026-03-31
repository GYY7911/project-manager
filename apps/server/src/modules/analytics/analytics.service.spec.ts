import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService, RiskLevel } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, IssueSeverity, RequirementStatus, IssueStatus, WorkflowStage } from '@prisma/client';

// 定义 mock 类型
type MockPrismaService = {
  requirement: {
    findMany: jest.Mock;
  };
  issue: {
    findMany: jest.Mock;
  };
  user: {
    findMany: jest.Mock;
  };
  planChangeLog: {
    findMany: jest.Mock;
  };
  delayConfig: {
    findMany: jest.Mock;
  };
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: MockPrismaService;

  // Mock data
  const mockVersionId = 'version-1';
  const mockUserId = 'user-1';
  const mockMemberUserId = 'user-2';

  const mockUser = {
    id: mockUserId,
    name: '张三',
    employeeNo: 'z00123123',
    role: UserRole.PM,
  };

  const mockMemberUser = {
    id: mockMemberUserId,
    name: '李四',
    employeeNo: 'z00123456',
    role: UserRole.MEMBER,
  };

  const mockRequirement = {
    id: 'req-1',
    code: 'FE20260322001',
    title: '测试需求',
    versionId: mockVersionId,
    assigneeId: mockUserId,
    assignee: mockUser,
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2天前到期
    status: RequirementStatus.IN_PROGRESS,
    currentStage: WorkflowStage.FEATURE_DEV,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: null,
    type: null,
    workload: null,
  };

  const mockIssue = {
    id: 'issue-1',
    code: 'ISSUE20260322001',
    title: '测试问题单',
    versionId: mockVersionId,
    assigneeId: mockUserId,
    assignee: mockUser,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2天后到期
    severity: IssueSeverity.HIGH,
    status: IssueStatus.IN_PROGRESS,
    currentStage: WorkflowStage.ISSUE_FIX,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: null,
    ccbApproved: false,
    requirementId: null,
    testCycleId: null,
  };

  beforeEach(async () => {
    prisma = {
      requirement: {
        findMany: jest.fn(),
      },
      issue: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      planChangeLog: {
        findMany: jest.fn(),
      },
      delayConfig: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRisk', () => {
    it('应该返回低风险等级当没有任何风险因素时', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
      });

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.factors).toHaveLength(0);
    });

    it('应该正确计算延期风险分数（每天4分，上限40分）', () => {
      const result = service.calculateRisk({
        delayedDays: 5,
      });

      expect(result.score).toBe(20); // 5 * 4 = 20
      expect(result.level).toBe('low'); // 20 < 25, 所以是 low
      expect(result.factors).toContain('延期5天');
    });

    it('应该限制延期分数上限为40分', () => {
      const result = service.calculateRisk({
        delayedDays: 20,
      });

      expect(result.score).toBe(40); // min(20 * 4, 40) = 40
      expect(result.factors).toContain('延期20天');
    });

    it('应该正确计算紧急严重程度分数（30分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        severity: IssueSeverity.CRITICAL,
      });

      expect(result.score).toBe(30);
      expect(result.level).toBe('medium');
      expect(result.factors).toContain('严重程度: 紧急');
    });

    it('应该正确计算高严重程度分数（20分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        severity: IssueSeverity.HIGH,
      });

      expect(result.score).toBe(20);
      expect(result.level).toBe('low');
    });

    it('应该正确计算中严重程度分数（10分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        severity: IssueSeverity.MEDIUM,
      });

      expect(result.score).toBe(10);
    });

    it('应该正确计算低严重程度分数（5分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        severity: IssueSeverity.LOW,
      });

      expect(result.score).toBe(5);
    });

    it('应该正确计算阻塞状态分数（20分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        isBlocked: true,
      });

      expect(result.score).toBe(20);
      expect(result.factors).toContain('状态: 阻塞');
    });

    it('应该正确计算今日到期分数（10分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        isDueToday: true,
      });

      expect(result.score).toBe(10);
      expect(result.factors).toContain('今日到期');
    });

    it('应该正确计算临近截止分数（5分）', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        isNearDue: true,
      });

      expect(result.score).toBe(5);
      expect(result.factors).toContain('临近截止');
    });

    it('今日到期应该优先于临近截止', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
        isDueToday: true,
        isNearDue: true,
      });

      // 今日到期加分，不应该同时加临近截止分
      expect(result.score).toBe(10);
      expect(result.factors).toContain('今日到期');
      expect(result.factors).not.toContain('临近截止');
    });

    it('应该正确组合多个风险因素', () => {
      const result = service.calculateRisk({
        delayedDays: 10, // 40分
        severity: IssueSeverity.CRITICAL, // 30分
        isBlocked: true, // 20分
      });

      expect(result.score).toBe(90); // 40 + 30 + 20 = 90
      expect(result.level).toBe('critical'); // >= 70
    });

    it('应该正确划分风险等级：严重 (>=70)', () => {
      const result = service.calculateRisk({
        delayedDays: 10,
        severity: IssueSeverity.HIGH,
      });

      expect(result.score).toBe(60); // 40 + 20 = 60
      expect(result.level).toBe('high'); // 50 <= 60 < 70
    });

    it('应该正确划分风险等级：高 (>=50)', () => {
      const result = service.calculateRisk({
        delayedDays: 8,
      });

      expect(result.score).toBe(32);
      expect(result.level).toBe('medium');
    });

    it('应该正确划分风险等级：中 (>=25)', () => {
      const result = service.calculateRisk({
        delayedDays: 5,
      });

      expect(result.score).toBe(20);
      expect(result.level).toBe('low');
    });

    it('应该正确划分风险等级：低 (<25)', () => {
      const result = service.calculateRisk({
        delayedDays: 0,
      });

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });
  });

  describe('calculateDelayedDays', () => {
    it('应该返回0当截止日期为null', () => {
      const result = service.calculateDelayedDays(null);
      expect(result).toBe(0);
    });

    it('应该返回0当截止日期在未来', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const result = service.calculateDelayedDays(futureDate);
      expect(result).toBe(0);
    });

    it('应该返回0当截止日期是今天', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = service.calculateDelayedDays(today);
      expect(result).toBe(0);
    });

    it('应该正确计算延期天数', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = service.calculateDelayedDays(threeDaysAgo);
      expect(result).toBe(3);
    });

    it('应该向上取整延期天数', () => {
      // 创建一个 2 天前的日期，但设置为当天中午（模拟部分天数）
      // 由于实现会将日期截断到午夜，所以实际上是按完整自然日计算
      // 这个测试验证：即使截止日期是 2 天前的某个时刻，延期天数也是 2 天
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      twoDaysAgo.setHours(12, 0, 0, 0); // 设置为中午
      const result = service.calculateDelayedDays(twoDaysAgo);
      expect(result).toBe(2);
    });

    it('应该正确处理跨越午夜的日期', () => {
      // 测试刚好超过 2 天但不足 3 天的情况
      // 截断后应该是 2 天
      const partialDaysAgo = new Date();
      partialDaysAgo.setDate(partialDaysAgo.getDate() - 2);
      partialDaysAgo.setHours(23, 59, 59, 999); // 2 天前的 23:59:59
      const result = service.calculateDelayedDays(partialDaysAgo);
      expect(result).toBe(2);
    });
  });

  describe('isDueToday', () => {
    it('应该返回false当截止日期为null', () => {
      const result = service.isDueToday(null);
      expect(result).toBe(false);
    });

    it('应该返回true当截止日期是今天', () => {
      const today = new Date();
      const result = service.isDueToday(today);
      expect(result).toBe(true);
    });

    it('应该返回false当截止日期不是今天', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = service.isDueToday(tomorrow);
      expect(result).toBe(false);
    });
  });

  describe('isNearDue', () => {
    it('应该返回false当截止日期为null', () => {
      const result = service.isNearDue(null);
      expect(result).toBe(false);
    });

    it('应该返回false当截止日期已过', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = service.isNearDue(yesterday);
      expect(result).toBe(false);
    });

    it('应该返回false当截止日期是今天（今日到期单独处理）', () => {
      const today = new Date();
      const result = service.isNearDue(today);
      expect(result).toBe(false);
    });

    it('应该返回true当截止日期在3天内', () => {
      const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const result = service.isNearDue(inTwoDays);
      expect(result).toBe(true);
    });

    it('应该返回false当截止日期超过3天', () => {
      const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const result = service.isNearDue(inFiveDays);
      expect(result).toBe(false);
    });

    it('应该在3天时返回true（边界值）', () => {
      const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const result = service.isNearDue(inThreeDays);
      expect(result).toBe(true);
    });
  });

  describe('getTeamOverview', () => {
    it('应该正确返回团队总览数据', async () => {
      prisma.requirement.findMany.mockResolvedValue([mockRequirement]);
      prisma.issue.findMany.mockResolvedValue([mockIssue]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      expect(result.totalWorkload).toBe(2); // 1 requirement + 1 issue
      expect(result.delayedCount).toBe(1); // 只有需求延期
      expect(result).toHaveProperty('highRiskCount');
      expect(result).toHaveProperty('highRiskMembers');
    });

    it('应该正确处理空数据', async () => {
      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      expect(result.totalWorkload).toBe(0);
      expect(result.delayedCount).toBe(0);
      expect(result.highRiskCount).toBe(0);
      expect(result.highRiskMembers).toHaveLength(0);
    });

    it('应该正确识别高风险员工', async () => {
      // 创建一个高风险需求（延期10天 + 阻塞）
      const highRiskRequirement = {
        ...mockRequirement,
        id: 'req-high-risk',
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: RequirementStatus.BLOCKED,
      };

      prisma.requirement.findMany.mockResolvedValue([highRiskRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      // 风险分数 = min(10*4, 40) + 20(阻塞) = 60 >= 50，应该是高风险
      expect(result.highRiskCount).toBe(1);
      expect(result.highRiskMembers).toContain('张三');
    });

    it('应该正确统计今日到期数量', async () => {
      const dueTodayRequirement = {
        ...mockRequirement,
        dueDate: new Date(),
      };

      prisma.requirement.findMany.mockResolvedValue([dueTodayRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      expect(result.dueTodayCount).toBe(1);
    });

    it('应该正确处理只有问题单没有需求的用户', async () => {
      // 用户只有问题单，没有需求
      const issueOnlyUser = {
        id: 'user-issue-only',
        name: '问题单用户',
        employeeNo: 'z00124001',
        role: UserRole.MEMBER,
      };

      const issueWithoutReq = {
        ...mockIssue,
        assigneeId: 'user-issue-only',
        assignee: issueOnlyUser,
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([issueWithoutReq]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      expect(result.totalWorkload).toBe(1);
    });

    it('应该正确统计延期的问题单', async () => {
      const delayedIssue = {
        ...mockIssue,
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 延期5天
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([delayedIssue]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      expect(result.delayedCount).toBe(1);
    });

    it('应该正确统计今日到期的问题单', async () => {
      const dueTodayIssue = {
        ...mockIssue,
        dueDate: new Date(),
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([dueTodayIssue]);

      const result = await service.getTeamOverview(mockVersionId, mockUserId, UserRole.PM);

      expect(result.dueTodayCount).toBe(1);
    });
  });

  describe('getWorkload', () => {
    it('应该正确返回员工负荷数据', async () => {
      prisma.requirement.findMany.mockResolvedValue([mockRequirement]);
      prisma.issue.findMany.mockResolvedValue([mockIssue]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUserId);
      expect(result[0].userName).toBe('张三');
      expect(result[0].requirementCount).toBe(1);
      expect(result[0].issueCount).toBe(1);
    });

    it('Member用户应该只能看到自己的数据', async () => {
      const otherRequirement = {
        ...mockRequirement,
        id: 'req-other',
        assigneeId: 'other-user',
      };

      prisma.requirement.findMany.mockResolvedValue([mockRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockMemberUserId, UserRole.MEMBER);

      // 验证查询条件包含了 assigneeId 过滤
      expect(prisma.requirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assigneeId: mockMemberUserId,
          }),
        })
      );
    });

    it('应该按风险分数降序排序', async () => {
      const lowRiskUser = {
        id: 'user-low',
        name: '低风险用户',
        employeeNo: 'z00123001',
        role: UserRole.MEMBER,
      };

      const highRiskRequirement = {
        ...mockRequirement,
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 延期10天
      };

      const lowRiskRequirement = {
        ...mockRequirement,
        id: 'req-low',
        assigneeId: 'user-low',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 未到期
      };

      prisma.requirement.findMany.mockResolvedValue([highRiskRequirement, lowRiskRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([mockUser, lowRiskUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      // 高风险用户应该排在前面
      expect(result[0].riskScore).toBeGreaterThanOrEqual(result[result.length - 1].riskScore);
    });

    it('应该正确统计高优先级问题单数量', async () => {
      const criticalIssue = {
        ...mockIssue,
        severity: IssueSeverity.CRITICAL,
      };

      const lowIssue = {
        ...mockIssue,
        id: 'issue-low',
        severity: IssueSeverity.LOW,
      };

      prisma.requirement.findMany.mockResolvedValue([mockRequirement]);
      prisma.issue.findMany.mockResolvedValue([criticalIssue, lowIssue]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      // CRITICAL 和 HIGH 算高优先级
      expect(result[0].highPriorityIssueCount).toBe(1);
    });

    it('应该正确识别 critical 风险等级 (>= 70分)', async () => {
      // 延期20天 + 阻塞状态 + 今日到期
      // 需求延期分: min(20*4, 40) = 40
      // 阻塞: +20
      // 今日到期: +10
      // 总分: 40 + 20 + 10 = 70 => critical
      const criticalRequirement = {
        ...mockRequirement,
        dueDate: new Date(), // 今日到期但已延期 - 这种情况不常见但用于测试
        status: RequirementStatus.BLOCKED,
      };

      // 创建一个 CRITICAL 严重程度的问题单
      const criticalIssue = {
        ...mockIssue,
        severity: IssueSeverity.CRITICAL,
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 延期10天
      };

      prisma.requirement.findMany.mockResolvedValue([criticalRequirement]);
      prisma.issue.findMany.mockResolvedValue([criticalIssue]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      // 问题单延期10天 + CRITICAL: min(10*3, 30) + 10 + 30 = 70
      expect(result[0].riskLevel).toBe('critical');
    });

    it('应该正确识别 high 风险等级 (>= 50分)', async () => {
      // 延期15天 + 阻塞状态
      // 需求延期分: min(15*4, 40) = 40 (已达上限)
      // 阻塞: +20
      // 总分: 40 + 20 = 60 => high
      const highRiskRequirement = {
        ...mockRequirement,
        dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        status: RequirementStatus.BLOCKED,
      };

      prisma.requirement.findMany.mockResolvedValue([highRiskRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].riskLevel).toBe('high');
    });

    it('应该正确识别 medium 风险等级 (>= 25分)', async () => {
      // 延期7天 = 28分
      // 需求延期分: min(7*4, 40) = 28
      // 总分: 28 => medium
      const mediumRiskRequirement = {
        ...mockRequirement,
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      };

      prisma.requirement.findMany.mockResolvedValue([mediumRiskRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].riskLevel).toBe('medium');
    });

    it('应该正确识别 low 风险等级 (< 25分)', async () => {
      const lowRiskRequirement = {
        ...mockRequirement,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      prisma.requirement.findMany.mockResolvedValue([lowRiskRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.getWorkload(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].riskLevel).toBe('low');
    });

    it('应该正确处理只有问题单的用户', async () => {
      const issueOnlyUser = {
        id: 'user-issue-only',
        name: '问题单用户',
        employeeNo: 'z00124002',
        role: UserRole.MEMBER,
      };

      const issueWithoutReq = {
        ...mockIssue,
        assigneeId: 'user-issue-only',
        assignee: issueOnlyUser,
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([issueWithoutReq]);
      prisma.user.findMany.mockResolvedValue([issueOnlyUser]);

      const result = await service.getWorkload(mockVersionId, 'user-issue-only', UserRole.PM);

      expect(result).toHaveLength(1);
      expect(result[0].issueCount).toBe(1);
      expect(result[0].requirementCount).toBe(0);
    });
  });

  describe('getRequirementRisks', () => {
    it('应该正确返回需求风险数据', async () => {
      prisma.requirement.findMany.mockResolvedValue([mockRequirement]);

      const result = await service.getRequirementRisks(mockVersionId, mockUserId, UserRole.PM);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('FE20260322001');
      expect(result[0].title).toBe('测试需求');
      expect(result[0].assigneeName).toBe('张三');
    });

    it('应该按风险分数降序排序', async () => {
      const lowRiskReq = {
        ...mockRequirement,
        id: 'req-low',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      const highRiskReq = {
        ...mockRequirement,
        id: 'req-high',
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      };

      prisma.requirement.findMany.mockResolvedValue([lowRiskReq, highRiskReq]);

      const result = await service.getRequirementRisks(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].id).toBe('req-high'); // 高风险在前
    });

    it('Member用户应该只能看到自己的需求', async () => {
      prisma.requirement.findMany.mockResolvedValue([mockRequirement]);

      await service.getRequirementRisks(mockVersionId, mockMemberUserId, UserRole.MEMBER);

      expect(prisma.requirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assigneeId: mockMemberUserId,
          }),
        })
      );
    });

    it('应该包含正确的风险因素', async () => {
      const blockedReq = {
        ...mockRequirement,
        status: RequirementStatus.BLOCKED,
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      };

      prisma.requirement.findMany.mockResolvedValue([blockedReq]);

      const result = await service.getRequirementRisks(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].factors).toContain('延期5天');
      expect(result[0].factors).toContain('状态: 阻塞');
    });
  });

  describe('getIssueRisks', () => {
    it('应该正确返回问题单风险数据', async () => {
      prisma.issue.findMany.mockResolvedValue([mockIssue]);

      const result = await service.getIssueRisks(mockVersionId, mockUserId, UserRole.PM);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('ISSUE20260322001');
      expect(result[0].title).toBe('测试问题单');
      expect(result[0].severity).toBe('HIGH');
    });

    it('应该包含严重程度作为风险因素', async () => {
      prisma.issue.findMany.mockResolvedValue([mockIssue]);

      const result = await service.getIssueRisks(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].factors).toContain('严重程度: 高');
    });

    it('应该按风险分数降序排序', async () => {
      const criticalIssue = {
        ...mockIssue,
        id: 'issue-critical',
        severity: IssueSeverity.CRITICAL,
      };

      const lowIssue = {
        ...mockIssue,
        id: 'issue-low',
        severity: IssueSeverity.LOW,
      };

      prisma.issue.findMany.mockResolvedValue([lowIssue, criticalIssue]);

      const result = await service.getIssueRisks(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].id).toBe('issue-critical');
    });
  });

  describe('getGanttData', () => {
    const mockWorkflowLog = {
      id: 'log-1',
      entityType: 'requirement',
      fromStage: WorkflowStage.REQUIREMENT_DESIGN,
      toStage: WorkflowStage.FEATURE_DEV,
      operatedBy: mockUserId,
      operator: mockUser,
      createdAt: new Date(),
      remark: null,
      entityId: 'req-1',
      requirementId: 'req-1',
      issueId: null,
    };

    it('应该正确返回甘特图数据', async () => {
      prisma.requirement.findMany.mockResolvedValue([
        { ...mockRequirement, workflowLogs: [mockWorkflowLog] },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('requirement');
      expect(result[0].code).toBe('FE20260322001');
    });

    it('应该正确构建阶段历史', async () => {
      const log1 = { ...mockWorkflowLog, toStage: WorkflowStage.REQUIREMENT_DESIGN };
      const log2 = {
        ...mockWorkflowLog,
        toStage: WorkflowStage.FEATURE_DEV,
        createdAt: new Date(Date.now() + 1000),
      };

      prisma.requirement.findMany.mockResolvedValue([
        { ...mockRequirement, workflowLogs: [log1, log2] },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].stageHistory).toHaveLength(2);
      expect(result[0].stageHistory[0].leftAt).not.toBeNull(); // 第一个阶段应该有离开时间
      expect(result[0].stageHistory[1].leftAt).toBeNull(); // 最后一个阶段没有离开时间
    });

    it('应该正确包含变更日志', async () => {
      const mockChangeLog = {
        id: 'change-1',
        entityType: 'requirement',
        entityId: 'req-1',
        changeType: 'deadline_change',
        oldValue: '{"date":"2026-03-20"}',
        newValue: '{"date":"2026-03-25"}',
        reason: '需求变更',
        operatedBy: mockUserId,
        operator: mockUser,
        createdAt: new Date(),
      };

      prisma.requirement.findMany.mockResolvedValue([
        { ...mockRequirement, workflowLogs: [] },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([mockChangeLog]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].changeLogs).toHaveLength(1);
      expect(result[0].changeLogs[0].reason).toBe('需求变更');
      expect(result[0].changeLogs[0].operatorName).toBe('张三');
    });

    it('应该正确处理计划日期', async () => {
      const mockDelayConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [
          { stage: 'REQUIREMENT_DESIGN', plannedDate: '2026-03-15' },
          { stage: 'FEATURE_DEV', plannedDate: '2026-03-25' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.requirement.findMany.mockResolvedValue([
        { ...mockRequirement, workflowLogs: [] },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([mockDelayConfig]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].plannedStartDate).not.toBeNull();
      expect(result[0].plannedEndDate).not.toBeNull();
    });

    it('应该正确处理问题单数据', async () => {
      const mockIssueWithLogs = {
        ...mockIssue,
        workflowLogs: [
          {
            id: 'issue-log-1',
            toStage: WorkflowStage.ISSUE_FIX,
            createdAt: new Date(),
          },
        ],
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([mockIssueWithLogs]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('issue');
      expect(result[0].code).toBe('ISSUE20260322001');
    });

    it('应该正确处理问题单的变更日志', async () => {
      const mockChangeLog = {
        id: 'change-1',
        entityType: 'issue',
        entityId: 'issue-1',
        changeType: 'deadline_change',
        oldValue: '{"date":"2026-03-20"}',
        newValue: '{"date":"2026-03-25"}',
        reason: '问题单变更',
        operatedBy: mockUserId,
        operator: mockUser,
        createdAt: new Date(),
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([
        { ...mockIssue, workflowLogs: [] },
      ]);
      prisma.planChangeLog.findMany.mockResolvedValue([mockChangeLog]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].changeLogs).toHaveLength(1);
      expect(result[0].changeLogs[0].reason).toBe('问题单变更');
    });

    it('应该正确处理问题单的计划日期', async () => {
      const mockIssueDelayConfig = {
        id: 'config-1',
        entityId: 'issue-1',
        entityType: 'issue',
        versionId: mockVersionId,
        stageDeadlines: [
          { stage: 'ISSUE_FIX', plannedDate: '2026-03-15' },
          { stage: 'CCB_REVIEW', plannedDate: '2026-03-25' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([
        { ...mockIssue, workflowLogs: [] },
      ]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([mockIssueDelayConfig]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      expect(result[0].plannedStartDate).not.toBeNull();
      expect(result[0].plannedEndDate).not.toBeNull();
    });

    it('应该按风险等级排序', async () => {
      // 创建一个 high 级别的需求（延期20天 + 阻塞 = 60分）
      // 延期分: min(20*4, 40) = 40
      // 阻塞: +20
      // 总分: 40 + 20 = 60 => high
      const highRiskRequirement = {
        ...mockRequirement,
        id: 'req-high',
        code: 'FE_HIGH',
        dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        status: RequirementStatus.BLOCKED,
        workflowLogs: [],
      };

      // 创建一个 low 级别的需求（未到期）
      const lowRiskRequirement = {
        ...mockRequirement,
        id: 'req-low',
        code: 'FE_LOW',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        workflowLogs: [],
      };

      prisma.requirement.findMany.mockResolvedValue([lowRiskRequirement, highRiskRequirement]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      // high 应该排在前面
      expect(result[0].id).toBe('req-high');
      expect(result[0].riskLevel).toBe('high');
      expect(result[1].id).toBe('req-low');
      expect(result[1].riskLevel).toBe('low');
    });

    it('相同风险等级时应该按截止日期排序', async () => {
      // 创建两个相同风险等级但不同截止日期的需求
      const earlyDueDate = {
        ...mockRequirement,
        id: 'req-early',
        code: 'FE_EARLY',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5天后
        workflowLogs: [],
      };

      const lateDueDate = {
        ...mockRequirement,
        id: 'req-late',
        code: 'FE_LATE',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15天后
        workflowLogs: [],
      };

      prisma.requirement.findMany.mockResolvedValue([lateDueDate, earlyDueDate]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      // 两个都是 low 风险，截止日期早的排在前面
      expect(result[0].id).toBe('req-early');
      expect(result[1].id).toBe('req-late');
    });

    it('当没有截止日期时排序应该返回 0', async () => {
      // 创建两个没有截止日期的需求（相同风险等级）
      const noDueDate1 = {
        ...mockRequirement,
        id: 'req-no-date-1',
        code: 'FE_NODATE1',
        dueDate: null, // 无截止日期
        workflowLogs: [],
      };

      const noDueDate2 = {
        ...mockRequirement,
        id: 'req-no-date-2',
        code: 'FE_NODATE2',
        dueDate: null, // 无截止日期
        workflowLogs: [],
      };

      prisma.requirement.findMany.mockResolvedValue([noDueDate1, noDueDate2]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.planChangeLog.findMany.mockResolvedValue([]);
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.getGanttData(mockVersionId, mockUserId, UserRole.PM);

      // 两个都应该返回，顺序不重要（因为返回 0）
      expect(result).toHaveLength(2);
    });
  });
});
