import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage } from '@prisma/client';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prisma: PrismaService;

  const mockPrismaService = {
    workflowLog: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getDefaultStages', () => {
    it('应该返回正确顺序的默认阶段', () => {
      const stages = service.getDefaultStages();

      expect(stages).toEqual([
        WorkflowStage.REQUIREMENT_DESIGN,
        WorkflowStage.ALPHA_TEST_DESIGN,
        WorkflowStage.DOCUMENT_SIGN,
        WorkflowStage.FEATURE_DEV,
        WorkflowStage.ALPHA_CASE_DEV,
        WorkflowStage.SOP_UPGRADE,
        WorkflowStage.VERSION_TEST,
        WorkflowStage.ISSUE_FIX,
        WorkflowStage.CCB_REVIEW,
        WorkflowStage.RELEASE,
      ]);
    });

    it('应该返回 10 个阶段', () => {
      const stages = service.getDefaultStages();
      expect(stages).toHaveLength(10);
    });

    it('第一个阶段应该是 REQUIREMENT_DESIGN', () => {
      const stages = service.getDefaultStages();
      expect(stages[0]).toBe(WorkflowStage.REQUIREMENT_DESIGN);
    });

    it('最后一个阶段应该是 RELEASE', () => {
      const stages = service.getDefaultStages();
      expect(stages[stages.length - 1]).toBe(WorkflowStage.RELEASE);
    });
  });

  describe('getStageLabel', () => {
    it('应该返回 REQUIREMENT_DESIGN 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.REQUIREMENT_DESIGN)).toBe('需求设计');
    });

    it('应该返回 ALPHA_TEST_DESIGN 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.ALPHA_TEST_DESIGN)).toBe('Alpha测试设计');
    });

    it('应该返回 DOCUMENT_SIGN 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.DOCUMENT_SIGN)).toBe('文档会签');
    });

    it('应该返回 FEATURE_DEV 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.FEATURE_DEV)).toBe('功能开发');
    });

    it('应该返回 ALPHA_CASE_DEV 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.ALPHA_CASE_DEV)).toBe('Alpha用例开发');
    });

    it('应该返回 SOP_UPGRADE 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.SOP_UPGRADE)).toBe('升级SOP');
    });

    it('应该返回 VERSION_TEST 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.VERSION_TEST)).toBe('版本转测');
    });

    it('应该返回 ISSUE_FIX 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.ISSUE_FIX)).toBe('修改问题单');
    });

    it('应该返回 CCB_REVIEW 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.CCB_REVIEW)).toBe('问题单CCB');
    });

    it('应该返回 RELEASE 的中文标签', () => {
      expect(service.getStageLabel(WorkflowStage.RELEASE)).toBe('版本发布');
    });
  });

  describe('canTransition', () => {
    describe('从 REQUIREMENT_DESIGN 开始的转换', () => {
      it('应该允许 REQUIREMENT_DESIGN -> DOCUMENT_SIGN', () => {
        expect(
          service.canTransition(WorkflowStage.REQUIREMENT_DESIGN, WorkflowStage.DOCUMENT_SIGN)
        ).toBe(true);
      });

      it('应该允许 REQUIREMENT_DESIGN -> ALPHA_TEST_DESIGN', () => {
        expect(
          service.canTransition(WorkflowStage.REQUIREMENT_DESIGN, WorkflowStage.ALPHA_TEST_DESIGN)
        ).toBe(true);
      });

      it('不应该允许 REQUIREMENT_DESIGN -> FEATURE_DEV', () => {
        expect(
          service.canTransition(WorkflowStage.REQUIREMENT_DESIGN, WorkflowStage.FEATURE_DEV)
        ).toBe(false);
      });
    });

    describe('从 ALPHA_TEST_DESIGN 开始的转换', () => {
      it('应该允许 ALPHA_TEST_DESIGN -> DOCUMENT_SIGN', () => {
        expect(
          service.canTransition(WorkflowStage.ALPHA_TEST_DESIGN, WorkflowStage.DOCUMENT_SIGN)
        ).toBe(true);
      });

      it('不应该允许 ALPHA_TEST_DESIGN -> FEATURE_DEV', () => {
        expect(
          service.canTransition(WorkflowStage.ALPHA_TEST_DESIGN, WorkflowStage.FEATURE_DEV)
        ).toBe(false);
      });
    });

    describe('从 DOCUMENT_SIGN 开始的转换', () => {
      it('应该允许 DOCUMENT_SIGN -> FEATURE_DEV', () => {
        expect(
          service.canTransition(WorkflowStage.DOCUMENT_SIGN, WorkflowStage.FEATURE_DEV)
        ).toBe(true);
      });

      it('应该允许 DOCUMENT_SIGN -> ALPHA_CASE_DEV', () => {
        expect(
          service.canTransition(WorkflowStage.DOCUMENT_SIGN, WorkflowStage.ALPHA_CASE_DEV)
        ).toBe(true);
      });

      it('应该允许 DOCUMENT_SIGN -> SOP_UPGRADE', () => {
        expect(
          service.canTransition(WorkflowStage.DOCUMENT_SIGN, WorkflowStage.SOP_UPGRADE)
        ).toBe(true);
      });
    });

    describe('从 FEATURE_DEV 开始的转换', () => {
      it('应该允许 FEATURE_DEV -> VERSION_TEST', () => {
        expect(
          service.canTransition(WorkflowStage.FEATURE_DEV, WorkflowStage.VERSION_TEST)
        ).toBe(true);
      });

      it('不应该允许 FEATURE_DEV -> RELEASE', () => {
        expect(
          service.canTransition(WorkflowStage.FEATURE_DEV, WorkflowStage.RELEASE)
        ).toBe(false);
      });
    });

    describe('从 VERSION_TEST 开始的转换', () => {
      it('应该允许 VERSION_TEST -> ISSUE_FIX', () => {
        expect(
          service.canTransition(WorkflowStage.VERSION_TEST, WorkflowStage.ISSUE_FIX)
        ).toBe(true);
      });
    });

    describe('从 ISSUE_FIX 开始的转换', () => {
      it('应该允许 ISSUE_FIX -> CCB_REVIEW', () => {
        expect(
          service.canTransition(WorkflowStage.ISSUE_FIX, WorkflowStage.CCB_REVIEW)
        ).toBe(true);
      });

      it('应该允许 ISSUE_FIX -> VERSION_TEST', () => {
        expect(
          service.canTransition(WorkflowStage.ISSUE_FIX, WorkflowStage.VERSION_TEST)
        ).toBe(true);
      });
    });

    describe('从 CCB_REVIEW 开始的转换', () => {
      it('应该允许 CCB_REVIEW -> RELEASE', () => {
        expect(
          service.canTransition(WorkflowStage.CCB_REVIEW, WorkflowStage.RELEASE)
        ).toBe(true);
      });

      it('应该允许 CCB_REVIEW -> ISSUE_FIX', () => {
        expect(
          service.canTransition(WorkflowStage.CCB_REVIEW, WorkflowStage.ISSUE_FIX)
        ).toBe(true);
      });
    });

    describe('从 RELEASE 开始的转换', () => {
      it('RELEASE 不应该能转换到任何阶段', () => {
        const stages = service.getDefaultStages();
        stages.forEach((stage) => {
          expect(service.canTransition(WorkflowStage.RELEASE, stage)).toBe(false);
        });
      });
    });
  });

  describe('getWorkflowLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        entityType: 'requirement',
        entityId: 'req-1',
        fromStage: WorkflowStage.REQUIREMENT_DESIGN,
        toStage: WorkflowStage.FEATURE_DEV,
        operator: { id: 'user-1', name: '张三', employeeNo: 'z001' },
        remark: '开始开发',
        createdAt: new Date(),
      },
    ];

    it('应该返回指定实体的工作流日志', async () => {
      mockPrismaService.workflowLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getWorkflowLogs('requirement', 'req-1');

      expect(result).toEqual(mockLogs);
    });

    it('应该包含操作人信息', async () => {
      mockPrismaService.workflowLog.findMany.mockResolvedValue(mockLogs);

      await service.getWorkflowLogs('requirement', 'req-1');

      expect(mockPrismaService.workflowLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            operator: {
              select: {
                id: true,
                name: true,
                employeeNo: true,
              },
            },
          },
        })
      );
    });

    it('应该按创建时间降序排序', async () => {
      mockPrismaService.workflowLog.findMany.mockResolvedValue(mockLogs);

      await service.getWorkflowLogs('requirement', 'req-1');

      expect(mockPrismaService.workflowLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('无日志时应该返回空数组', async () => {
      mockPrismaService.workflowLog.findMany.mockResolvedValue([]);

      const result = await service.getWorkflowLogs('requirement', 'req-1');

      expect(result).toEqual([]);
    });
  });
});

describe('WorkflowStage 枚举验证', () => {
  it('应该包含所有预期的阶段', () => {
    const expectedStages = [
      'REQUIREMENT_DESIGN',
      'ALPHA_TEST_DESIGN',
      'DOCUMENT_SIGN',
      'FEATURE_DEV',
      'ALPHA_CASE_DEV',
      'SOP_UPGRADE',
      'VERSION_TEST',
      'ISSUE_FIX',
      'CCB_REVIEW',
      'RELEASE',
    ];

    expectedStages.forEach((stage) => {
      expect(WorkflowStage).toHaveProperty(stage);
    });
  });
});
