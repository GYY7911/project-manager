import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserRole } from '@prisma/client';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: jest.Mocked<AnalyticsService>;

  const mockUser = {
    sub: 'user-1',
    username: 'zhangsan',
    role: UserRole.PM,
  };

  const mockRequest = {
    user: mockUser,
  } as any;

  const mockVersionId = 'version-1';

  const mockTeamOverview = {
    highRiskCount: 2,
    delayedCount: 3,
    dueTodayCount: 1,
    totalWorkload: 10,
    highRiskMembers: ['张三', '李四'],
  };

  const mockWorkloadData = [
    {
      userId: 'user-1',
      userName: '张三',
      employeeNo: 'z00123123',
      role: 'PM',
      requirementCount: 3,
      issueCount: 2,
      highPriorityIssueCount: 1,
      delayedCount: 1,
      riskScore: 45,
      riskLevel: 'medium' as const,
    },
  ];

  const mockRequirementRisks = [
    {
      id: 'req-1',
      code: 'FE20260322001',
      title: '测试需求',
      assigneeId: 'user-1',
      assigneeName: '张三',
      riskScore: 30,
      riskLevel: 'medium' as const,
      delayedDays: 0,
      dueDate: new Date(),
      factors: ['临近截止'],
      status: 'IN_PROGRESS',
      currentStage: 'FEATURE_DEV',
    },
  ];

  const mockIssueRisks = [
    {
      id: 'issue-1',
      code: 'ISSUE20260322001',
      title: '测试问题单',
      assigneeId: 'user-1',
      assigneeName: '张三',
      severity: 'HIGH',
      riskScore: 25,
      riskLevel: 'medium' as const,
      delayedDays: 0,
      status: 'IN_PROGRESS',
      currentStage: 'ISSUE_FIX',
      factors: ['严重程度: 高'],
    },
  ];

  const mockGanttData = [
    {
      id: 'req-1',
      code: 'FE20260322001',
      title: '测试需求',
      type: 'requirement' as const,
      assigneeId: 'user-1',
      assigneeName: '张三',
      startDate: new Date(),
      endDate: new Date(),
      plannedStartDate: null,
      plannedEndDate: null,
      currentStage: 'FEATURE_DEV',
      status: 'IN_PROGRESS',
      delayedDays: 0,
      riskLevel: 'low' as const,
      changeLogs: [],
      stageHistory: [],
    },
  ];

  beforeEach(async () => {
    const mockAnalyticsService = {
      getTeamOverview: jest.fn(),
      getWorkload: jest.fn(),
      getRequirementRisks: jest.fn(),
      getIssueRisks: jest.fn(),
      getGanttData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeamOverview', () => {
    it('应该调用服务并返回团队总览数据', async () => {
      service.getTeamOverview.mockResolvedValue(mockTeamOverview);

      const result = await controller.getTeamOverview(mockVersionId, mockRequest);

      expect(service.getTeamOverview).toHaveBeenCalledWith(
        mockVersionId,
        mockUser.sub,
        mockUser.role,
      );
      expect(result).toEqual(mockTeamOverview);
    });

    it('应该正确传递用户信息', async () => {
      service.getTeamOverview.mockResolvedValue(mockTeamOverview);

      await controller.getTeamOverview(mockVersionId, mockRequest);

      expect(service.getTeamOverview).toHaveBeenCalledWith(
        mockVersionId,
        'user-1',
        'PM',
      );
    });
  });

  describe('getWorkload', () => {
    it('应该调用服务并返回员工负荷数据', async () => {
      service.getWorkload.mockResolvedValue(mockWorkloadData);

      const result = await controller.getWorkload(mockVersionId, mockRequest);

      expect(service.getWorkload).toHaveBeenCalledWith(
        mockVersionId,
        mockUser.sub,
        mockUser.role,
      );
      expect(result).toEqual(mockWorkloadData);
    });

    it('Member用户应该只能看到自己的负荷数据', async () => {
      const memberRequest = {
        user: {
          sub: 'user-2',
          username: 'lisi',
          role: UserRole.MEMBER,
        },
      } as any;

      service.getWorkload.mockResolvedValue([]);

      await controller.getWorkload(mockVersionId, memberRequest);

      expect(service.getWorkload).toHaveBeenCalledWith(
        mockVersionId,
        'user-2',
        'MEMBER',
      );
    });
  });

  describe('getRequirementRisks', () => {
    it('应该调用服务并返回需求风险数据', async () => {
      service.getRequirementRisks.mockResolvedValue(mockRequirementRisks);

      const result = await controller.getRequirementRisks(mockVersionId, mockRequest);

      expect(service.getRequirementRisks).toHaveBeenCalledWith(
        mockVersionId,
        mockUser.sub,
        mockUser.role,
      );
      expect(result).toEqual(mockRequirementRisks);
    });
  });

  describe('getIssueRisks', () => {
    it('应该调用服务并返回问题单风险数据', async () => {
      service.getIssueRisks.mockResolvedValue(mockIssueRisks);

      const result = await controller.getIssueRisks(mockVersionId, mockRequest);

      expect(service.getIssueRisks).toHaveBeenCalledWith(
        mockVersionId,
        mockUser.sub,
        mockUser.role,
      );
      expect(result).toEqual(mockIssueRisks);
    });
  });

  describe('getGanttData', () => {
    it('应该调用服务并返回甘特图数据', async () => {
      service.getGanttData.mockResolvedValue(mockGanttData);

      const result = await controller.getGanttData(mockVersionId, mockRequest);

      expect(service.getGanttData).toHaveBeenCalledWith(
        mockVersionId,
        mockUser.sub,
        mockUser.role,
      );
      expect(result).toEqual(mockGanttData);
    });
  });

  describe('权限测试', () => {
    it('PM用户应该能查看所有分析数据', async () => {
      const pmRequest = {
        user: { sub: 'pm-1', username: 'pm', role: UserRole.PM },
      } as any;

      service.getTeamOverview.mockResolvedValue(mockTeamOverview);
      service.getWorkload.mockResolvedValue(mockWorkloadData);

      await controller.getTeamOverview(mockVersionId, pmRequest);
      await controller.getWorkload(mockVersionId, pmRequest);

      // PM用户查询时不应该过滤 userId
      expect(service.getWorkload).toHaveBeenCalledWith(
        mockVersionId,
        'pm-1',
        'PM',
      );
    });

    it('Admin用户应该能查看所有分析数据', async () => {
      const adminRequest = {
        user: { sub: 'admin-1', username: 'admin', role: UserRole.ADMIN },
      } as any;

      service.getTeamOverview.mockResolvedValue(mockTeamOverview);
      service.getWorkload.mockResolvedValue(mockWorkloadData);

      await controller.getTeamOverview(mockVersionId, adminRequest);
      await controller.getWorkload(mockVersionId, adminRequest);

      expect(service.getWorkload).toHaveBeenCalledWith(
        mockVersionId,
        'admin-1',
        'ADMIN',
      );
    });

    it('Member用户应该只能查看自己的数据', async () => {
      const memberRequest = {
        user: { sub: 'member-1', username: 'member', role: UserRole.MEMBER },
      } as any;

      service.getWorkload.mockResolvedValue([]);
      service.getRequirementRisks.mockResolvedValue([]);
      service.getIssueRisks.mockResolvedValue([]);
      service.getGanttData.mockResolvedValue([]);

      await controller.getWorkload(mockVersionId, memberRequest);
      await controller.getRequirementRisks(mockVersionId, memberRequest);
      await controller.getIssueRisks(mockVersionId, memberRequest);
      await controller.getGanttData(mockVersionId, memberRequest);

      // 所有方法都应该收到 MEMBER 角色
      expect(service.getWorkload).toHaveBeenCalledWith(
        mockVersionId,
        'member-1',
        'MEMBER',
      );
      expect(service.getRequirementRisks).toHaveBeenCalledWith(
        mockVersionId,
        'member-1',
        'MEMBER',
      );
      expect(service.getIssueRisks).toHaveBeenCalledWith(
        mockVersionId,
        'member-1',
        'MEMBER',
      );
      expect(service.getGanttData).toHaveBeenCalledWith(
        mockVersionId,
        'member-1',
        'MEMBER',
      );
    });
  });
});
