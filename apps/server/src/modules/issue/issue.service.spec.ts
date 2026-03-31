import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { IssueService, CreateIssueDto, UpdateIssueDto, UpdateIssueStageDto } from './issue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage, IssueStatus, IssueSeverity, UserRole } from '@prisma/client';

describe('IssueService', () => {
  let service: IssueService;
  let prisma: PrismaService;

  const mockPrismaService = {
    issue: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    workflowLog: {
      create: jest.fn(),
    },
  };

  const mockIssue = {
    id: 'issue-1',
    code: 'ISSUE20260322001',
    title: '登录页面无法显示',
    description: '用户反馈登录页面白屏',
    severity: IssueSeverity.HIGH,
    status: IssueStatus.OPEN,
    currentStage: WorkflowStage.ISSUE_FIX,
    ccbApproved: false,
    versionId: 'version-1',
    assigneeId: 'user-1',
    requirementId: null,
    testCycleId: 'tc-1',
    dueDate: new Date('2026-03-25'),
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: {
      id: 'user-1',
      name: '张三',
      employeeNo: 'z001',
    },
    testCycle: {
      id: 'tc-1',
      name: 'SIT1',
    },
  };

  const mockIssueWithDetails = {
    ...mockIssue,
    version: {
      id: 'version-1',
      name: 'V2026.Q1',
    },
    requirement: null,
    workflowLogs: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IssueService>(IssueService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto: CreateIssueDto = {
      code: 'ISSUE20260322001',
      title: '登录页面无法显示',
      description: '用户反馈登录页面白屏',
      severity: IssueSeverity.HIGH,
      versionId: 'version-1',
      assigneeId: 'user-1',
      testCycleId: 'tc-1',
      dueDate: '2026-03-25',
    };

    it('应该成功创建问题单', async () => {
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      const result = await service.create(createDto);

      expect(result).toEqual(mockIssue);
      expect(mockPrismaService.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'ISSUE20260322001',
          title: '登录页面无法显示',
          severity: IssueSeverity.HIGH,
          status: IssueStatus.OPEN,
          ccbApproved: false,
        }),
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
            },
          },
          testCycle: true,
        },
      });
    });

    it('创建时应该设置默认严重程度为 MEDIUM', async () => {
      const dtoWithoutSeverity: CreateIssueDto = {
        code: 'ISSUE20260322002',
        title: '测试问题',
        versionId: 'version-1',
        assigneeId: 'user-1',
      };

      mockPrismaService.issue.create.mockResolvedValue({
        ...mockIssue,
        severity: IssueSeverity.MEDIUM,
      });

      await service.create(dtoWithoutSeverity);

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: IssueSeverity.MEDIUM,
          }),
        })
      );
    });

    it('创建时应该设置默认状态为 OPEN', async () => {
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      await service.create(createDto);

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IssueStatus.OPEN,
          }),
        })
      );
    });

    it('创建时应该设置 ccbApproved 为 false', async () => {
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      await service.create(createDto);

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ccbApproved: false,
          }),
        })
      );
    });

    it('应该正确处理 dueDate', async () => {
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      await service.create(createDto);

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: new Date('2026-03-25'),
          }),
        })
      );
    });

    it('没有 dueDate 时应该设置为 null', async () => {
      const dtoWithoutDueDate: CreateIssueDto = {
        code: 'ISSUE20260322003',
        title: '测试问题',
        versionId: 'version-1',
        assigneeId: 'user-1',
      };

      mockPrismaService.issue.create.mockResolvedValue({
        ...mockIssue,
        dueDate: null,
      });

      await service.create(dtoWithoutDueDate);

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: null,
          }),
        })
      );
    });

    it('应该支持关联需求', async () => {
      const dtoWithRequirement: CreateIssueDto = {
        ...createDto,
        requirementId: 'req-1',
      };

      mockPrismaService.issue.create.mockResolvedValue({
        ...mockIssue,
        requirementId: 'req-1',
      });

      await service.create(dtoWithRequirement);

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requirementId: 'req-1',
          }),
        })
      );
    });
  });

  describe('findAll', () => {
    const mockIssues = [mockIssue];

    it('应该返回所有问题单', async () => {
      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);

      const result = await service.findAll();

      expect(result).toEqual(mockIssues);
      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
            },
          },
          testCycle: true,
          requirement: {
            select: {
              id: true,
              code: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('应该根据 versionId 过滤', async () => {
      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);

      await service.findAll('version-1');

      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { versionId: 'version-1' },
        })
      );
    });

    it('应该根据 testCycleId 过滤', async () => {
      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);

      await service.findAll(undefined, 'tc-1');

      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { testCycleId: 'tc-1' },
        })
      );
    });

    it('应该同时根据 versionId 和 testCycleId 过滤', async () => {
      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);

      await service.findAll('version-1', 'tc-1');

      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { versionId: 'version-1', testCycleId: 'tc-1' },
        })
      );
    });

    it('无问题单时应该返回空数组', async () => {
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('应该返回指定问题单', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);

      const result = await service.findOne('issue-1');

      expect(result).toEqual(mockIssueWithDetails);
      expect(mockPrismaService.issue.findUnique).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
            },
          },
          testCycle: true,
          version: true,
          requirement: {
            select: {
              id: true,
              code: true,
              title: true,
            },
          },
          workflowLogs: {
            include: {
              operator: {
                select: {
                  id: true,
                  name: true,
                  employeeNo: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    it('问题单不存在时应该抛出 NotFoundException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent')).rejects.toThrow('问题单不存在');
    });

    it('应该包含工作流日志', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);

      const result = await service.findOne('issue-1');

      expect(result).toHaveProperty('workflowLogs');
    });

    it('应该包含版本信息', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);

      const result = await service.findOne('issue-1');

      expect(result).toHaveProperty('version');
    });
  });

  describe('update', () => {
    const updateDto: UpdateIssueDto = {
      title: '更新后的问题标题',
      severity: IssueSeverity.CRITICAL,
    };

    it('应该成功更新问题单', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        ...updateDto,
      });

      const result = await service.update('issue-1', updateDto);

      expect(result.title).toBe('更新后的问题标题');
      expect(result.severity).toBe(IssueSeverity.CRITICAL);
    });

    it('更新不存在的问题单时应该抛出 NotFoundException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('应该正确处理 dueDate 更新', async () => {
      const dtoWithDate: UpdateIssueDto = {
        dueDate: '2026-04-01',
      };

      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.update.mockResolvedValue(mockIssue);

      await service.update('issue-1', dtoWithDate);

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: new Date('2026-04-01'),
          }),
        })
      );
    });

    it('应该支持更新负责人', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        assigneeId: 'user-2',
      });

      const result = await service.update('issue-1', { assigneeId: 'user-2' });

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assigneeId: 'user-2',
          }),
        })
      );
    });
  });

  describe('updateStage', () => {
    const updateStageDto: UpdateIssueStageDto = {
      stage: WorkflowStage.CCB_REVIEW,
      remark: '修复完成',
    };

    it('应该成功更新问题单阶段（PM 角色）', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        currentStage: WorkflowStage.CCB_REVIEW,
      });

      const result = await service.updateStage('issue-1', updateStageDto, 'user-2', UserRole.PM);

      expect(result.currentStage).toBe(WorkflowStage.CCB_REVIEW);
    });

    it('应该记录工作流日志', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue(mockIssue);

      await service.updateStage('issue-1', updateStageDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.workflowLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'issue',
          entityId: 'issue-1',
          fromStage: WorkflowStage.ISSUE_FIX,
          toStage: WorkflowStage.CCB_REVIEW,
          operatedBy: 'user-1',
          remark: '修复完成',
          issueId: 'issue-1',
        }),
      });
    });

    it('MEMBER 只能更新自己负责的问题单', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue(mockIssue);

      // 负责人是 user-1，所以 user-1 可以更新
      await service.updateStage('issue-1', updateStageDto, 'user-1', UserRole.MEMBER);

      expect(mockPrismaService.issue.update).toHaveBeenCalled();
    });

    it('MEMBER 更新他人问题单时应该抛出 ForbiddenException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);

      // 负责人是 user-1，user-2 尝试更新
      await expect(
        service.updateStage('issue-1', updateStageDto, 'user-2', UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateStage('issue-1', updateStageDto, 'user-2', UserRole.MEMBER)
      ).rejects.toThrow('您只能修改自己负责的问题单');
    });

    it('PM 可以更新任何问题单', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue(mockIssue);

      // PM user-2 更新 user-1 负责的问题单
      await service.updateStage('issue-1', updateStageDto, 'user-2', UserRole.PM);

      expect(mockPrismaService.issue.update).toHaveBeenCalled();
    });

    it('更新到 RELEASE 阶段时应该设置状态为 CLOSED', async () => {
      const releaseDto: UpdateIssueStageDto = {
        stage: WorkflowStage.RELEASE,
      };

      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        currentStage: WorkflowStage.RELEASE,
        status: IssueStatus.CLOSED,
      });

      await service.updateStage('issue-1', releaseDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IssueStatus.CLOSED,
          }),
        })
      );
    });

    it('更新到 ISSUE_FIX 阶段时应该设置状态为 IN_PROGRESS', async () => {
      const fixDto: UpdateIssueStageDto = {
        stage: WorkflowStage.ISSUE_FIX,
      };

      mockPrismaService.issue.findUnique.mockResolvedValue({
        ...mockIssueWithDetails,
        currentStage: WorkflowStage.VERSION_TEST,
      });
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        status: IssueStatus.IN_PROGRESS,
      });

      await service.updateStage('issue-1', fixDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IssueStatus.IN_PROGRESS,
          }),
        })
      );
    });

    it('更新到 CCB_REVIEW 阶段时应该更新 ccbApproved', async () => {
      const ccbDto: UpdateIssueStageDto = {
        stage: WorkflowStage.CCB_REVIEW,
        ccbApproved: true,
      };

      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        ccbApproved: true,
      });

      await service.updateStage('issue-1', ccbDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ccbApproved: true,
          }),
        })
      );
    });

    it('问题单不存在时应该抛出 NotFoundException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStage('non-existent', updateStageDto, 'user-1', UserRole.PM)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCcbStatus', () => {
    it('应该成功更新 CCB 状态', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockIssue,
        ccbApproved: true,
      });

      const result = await service.updateCcbStatus('issue-1', true);

      expect(result.ccbApproved).toBe(true);
      expect(mockPrismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        data: { ccbApproved: true },
      });
    });

    it('更新不存在的问题单时应该抛出 NotFoundException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(service.updateCcbStatus('non-existent', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('应该成功删除问题单', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.delete.mockResolvedValue(mockIssue);

      const result = await service.remove('issue-1');

      expect(result).toEqual(mockIssue);
      expect(mockPrismaService.issue.delete).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
      });
    });

    it('删除不存在的问题单时应该抛出 NotFoundException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateCode', () => {
    it('应该生成正确格式的问题单编码', async () => {
      mockPrismaService.issue.count.mockResolvedValue(0);

      const result = await service.generateCode('version-1');

      // 格式应该是 ISSUExxxxyyyymmddnnn
      expect(result).toMatch(/^ISSUE\d{11}$/);
    });

    it('应该根据已有数量递增编码', async () => {
      mockPrismaService.issue.count.mockResolvedValue(5);

      const result = await service.generateCode('version-1');

      expect(result).toMatch(/006$/);
    });

    it('应该使用日期前缀进行计数', async () => {
      mockPrismaService.issue.count.mockResolvedValue(0);

      await service.generateCode('version-1');

      expect(mockPrismaService.issue.count).toHaveBeenCalledWith({
        where: {
          code: {
            startsWith: expect.stringMatching(/^ISSUE\d{8}$/),
          },
        },
      });
    });
  });

  describe('duplicate', () => {
    it('应该成功复制问题单', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.issue.create.mockResolvedValue({
        ...mockIssue,
        id: 'issue-2',
        code: 'ISSUE20260322002',
        title: '登录页面无法显示 - 副本',
      });

      const result = await service.duplicate('issue-1');

      expect(result.title).toBe('登录页面无法显示 - 副本');
      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: '登录页面无法显示 - 副本',
            status: IssueStatus.OPEN,
            ccbApproved: false,
          }),
        })
      );
    });

    it('复制问题单应该生成新的编码', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.count.mockResolvedValue(10);
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      await service.duplicate('issue-1');

      expect(mockPrismaService.issue.count).toHaveBeenCalled();
    });

    it('复制后的问题单状态应该为 OPEN', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      await service.duplicate('issue-1');

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IssueStatus.OPEN,
          }),
        })
      );
    });

    it('复制后的问题单 ccbApproved 应该为 false', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(mockIssueWithDetails);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.issue.create.mockResolvedValue(mockIssue);

      await service.duplicate('issue-1');

      expect(mockPrismaService.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ccbApproved: false,
          }),
        })
      );
    });

    it('复制问题单不存在时应该抛出 NotFoundException', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(service.duplicate('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('Issue DTO 验证', () => {
  it('CreateIssueDto 应该包含所有必要字段', () => {
    const dto: CreateIssueDto = {
      code: 'ISSUE001',
      title: '问题标题',
      description: '问题描述',
      severity: IssueSeverity.HIGH,
      versionId: 'version-1',
      assigneeId: 'user-1',
      requirementId: 'req-1',
      testCycleId: 'tc-1',
      dueDate: '2026-03-25',
    };

    expect(dto.code).toBe('ISSUE001');
    expect(dto.title).toBe('问题标题');
    expect(dto.versionId).toBe('version-1');
    expect(dto.assigneeId).toBe('user-1');
  });

  it('UpdateIssueDto 所有字段都应该是可选的', () => {
    const dto: UpdateIssueDto = {
      title: '新标题',
    };

    expect(dto.title).toBe('新标题');
    expect(dto.description).toBeUndefined();
  });

  it('UpdateIssueStageDto 应该包含 stage 和可选的 remark', () => {
    const dto: UpdateIssueStageDto = {
      stage: WorkflowStage.ISSUE_FIX,
      remark: '备注',
      ccbApproved: true,
    };

    expect(dto.stage).toBe(WorkflowStage.ISSUE_FIX);
    expect(dto.remark).toBe('备注');
    expect(dto.ccbApproved).toBe(true);
  });
});

describe('IssueSeverity 枚举验证', () => {
  it('应该包含所有预期的严重程度', () => {
    expect(IssueSeverity.LOW).toBe('LOW');
    expect(IssueSeverity.MEDIUM).toBe('MEDIUM');
    expect(IssueSeverity.HIGH).toBe('HIGH');
    expect(IssueSeverity.CRITICAL).toBe('CRITICAL');
  });
});

describe('IssueStatus 枚举验证', () => {
  it('应该包含所有预期的状态', () => {
    expect(IssueStatus.OPEN).toBe('OPEN');
    expect(IssueStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(IssueStatus.CLOSED).toBe('CLOSED');
  });
});
