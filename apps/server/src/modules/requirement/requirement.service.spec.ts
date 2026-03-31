import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RequirementService, CreateRequirementDto, UpdateRequirementDto, UpdateStageDto } from './requirement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage, RequirementStatus, UserRole } from '@prisma/client';

describe('RequirementService', () => {
  let service: RequirementService;
  let prisma: PrismaService;

  const mockPrismaService = {
    requirement: {
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

  const mockRequirement = {
    id: 'req-1',
    code: 'FE20260322001',
    title: '用户登录功能',
    description: '实现用户登录功能',
    type: '功能',
    status: RequirementStatus.DRAFT,
    currentStage: WorkflowStage.REQUIREMENT_DESIGN,
    versionId: 'version-1',
    assigneeId: 'user-1',
    workload: 5,
    dueDate: new Date('2026-03-25'),
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: {
      id: 'user-1',
      name: '张三',
      employeeNo: 'z001',
    },
  };

  const mockRequirementWithVersion = {
    ...mockRequirement,
    version: {
      id: 'version-1',
      name: 'V2026.Q1',
      status: 'DEVELOPMENT',
    },
    workflowLogs: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequirementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RequirementService>(RequirementService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto: CreateRequirementDto = {
      code: 'FE20260322001',
      title: '用户登录功能',
      description: '实现用户登录功能',
      type: '功能',
      versionId: 'version-1',
      assigneeId: 'user-1',
      workload: 5,
      dueDate: '2026-03-25',
    };

    it('应该成功创建需求', async () => {
      mockPrismaService.requirement.create.mockResolvedValue(mockRequirement);

      const result = await service.create(createDto);

      expect(result).toEqual(mockRequirement);
      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'FE20260322001',
          title: '用户登录功能',
          description: '实现用户登录功能',
          type: '功能',
          versionId: 'version-1',
          assigneeId: 'user-1',
          workload: 5,
          currentStage: WorkflowStage.REQUIREMENT_DESIGN,
          status: RequirementStatus.DRAFT,
        }),
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
            },
          },
        },
      });
    });

    it('创建时应该设置默认状态为 DRAFT', async () => {
      mockPrismaService.requirement.create.mockResolvedValue(mockRequirement);

      await service.create(createDto);

      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RequirementStatus.DRAFT,
          }),
        })
      );
    });

    it('创建时应该设置默认阶段为 REQUIREMENT_DESIGN', async () => {
      mockPrismaService.requirement.create.mockResolvedValue(mockRequirement);

      await service.create(createDto);

      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStage: WorkflowStage.REQUIREMENT_DESIGN,
          }),
        })
      );
    });

    it('应该正确处理可选字段', async () => {
      const minimalDto: CreateRequirementDto = {
        code: 'FE20260322002',
        title: '简单需求',
        versionId: 'version-1',
        assigneeId: 'user-1',
      };

      mockPrismaService.requirement.create.mockResolvedValue({
        ...mockRequirement,
        ...minimalDto,
      });

      await service.create(minimalDto);

      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: undefined,
            type: undefined,
            workload: undefined,
          }),
        })
      );
    });

    it('创建失败时应该抛出异常', async () => {
      const error = new Error('数据库错误') as Error & { code: string };
      error.code = 'P2003';
      mockPrismaService.requirement.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow('数据库错误');
    });
  });

  describe('findAll', () => {
    const mockRequirements = [mockRequirement];

    it('应该返回所有需求（PM 角色）', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue(mockRequirements);

      const result = await service.findAll(undefined, UserRole.PM);

      expect(result).toEqual(mockRequirements);
      expect(mockPrismaService.requirement.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('应该根据 versionId 过滤需求', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue(mockRequirements);

      await service.findAll('version-1', UserRole.PM);

      expect(mockPrismaService.requirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { versionId: 'version-1' },
        })
      );
    });

    it('MEMBER 角色不应该看到 workload', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue(mockRequirements);

      const result = await service.findAll('version-1', UserRole.MEMBER);

      expect(result[0]).not.toHaveProperty('workload');
    });

    it('PM 角色应该看到 workload', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue(mockRequirements);

      const result = await service.findAll('version-1', UserRole.PM);

      expect(result[0]).toHaveProperty('workload');
    });

    it('ADMIN 角色应该看到 workload', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue(mockRequirements);

      const result = await service.findAll('version-1', UserRole.ADMIN);

      expect(result[0]).toHaveProperty('workload');
    });

    it('无需求时应该返回空数组', async () => {
      mockPrismaService.requirement.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('应该返回指定需求（PM 角色）', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);

      const result = await service.findOne('req-1', UserRole.PM);

      expect(result).toEqual(mockRequirementWithVersion);
    });

    it('MEMBER 角色不应该看到 workload', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);

      const result = await service.findOne('req-1', UserRole.MEMBER);

      expect(result).not.toHaveProperty('workload');
    });

    it('需求不存在时应该抛出 NotFoundException', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent')).rejects.toThrow('需求不存在');
    });

    it('应该包含版本信息', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);

      const result = await service.findOne('req-1');

      expect(result).toHaveProperty('version');
    });

    it('应该包含工作流日志', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);

      const result = await service.findOne('req-1');

      expect(result).toHaveProperty('workflowLogs');
    });
  });

  describe('update', () => {
    const updateDto: UpdateRequirementDto = {
      title: '更新后的标题',
      workload: 8,
    };

    it('应该成功更新需求', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.update.mockResolvedValue({
        ...mockRequirement,
        ...updateDto,
      });

      const result = await service.update('req-1', updateDto);

      expect(result.title).toBe('更新后的标题');
      expect(result.workload).toBe(8);
    });

    it('更新不存在的需求时应该抛出 NotFoundException', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('应该正确处理 dueDate 更新', async () => {
      const dtoWithDate: UpdateRequirementDto = {
        dueDate: '2026-04-01',
      };

      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.update.mockResolvedValue(mockRequirement);

      await service.update('req-1', dtoWithDate);

      expect(mockPrismaService.requirement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: new Date('2026-04-01'),
          }),
        })
      );
    });
  });

  describe('updateStage', () => {
    const updateStageDto: UpdateStageDto = {
      stage: WorkflowStage.FEATURE_DEV,
      remark: '开始开发',
    };

    it('应该成功更新需求阶段（PM 角色）', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.requirement.update.mockResolvedValue({
        ...mockRequirement,
        currentStage: WorkflowStage.FEATURE_DEV,
        status: RequirementStatus.IN_PROGRESS,
      });

      const result = await service.updateStage('req-1', updateStageDto, 'user-2', UserRole.PM);

      expect(result.currentStage).toBe(WorkflowStage.FEATURE_DEV);
    });

    it('应该记录工作流日志', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.requirement.update.mockResolvedValue(mockRequirement);

      await service.updateStage('req-1', updateStageDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.workflowLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'requirement',
          entityId: 'req-1',
          fromStage: WorkflowStage.REQUIREMENT_DESIGN,
          toStage: WorkflowStage.FEATURE_DEV,
          operatedBy: 'user-1',
          remark: '开始开发',
          requirementId: 'req-1',
        }),
      });
    });

    it('MEMBER 只能更新自己负责的需求', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.requirement.update.mockResolvedValue(mockRequirement);

      // 负责人是 user-1，所以 user-1 可以更新
      await service.updateStage('req-1', updateStageDto, 'user-1', UserRole.MEMBER);

      expect(mockPrismaService.requirement.update).toHaveBeenCalled();
    });

    it('MEMBER 更新他人需求时应该抛出 ForbiddenException', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);

      // 负责人是 user-1，user-2 尝试更新
      await expect(
        service.updateStage('req-1', updateStageDto, 'user-2', UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateStage('req-1', updateStageDto, 'user-2', UserRole.MEMBER)
      ).rejects.toThrow('您只能修改自己负责的需求');
    });

    it('PM 可以更新任何需求', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.requirement.update.mockResolvedValue(mockRequirement);

      // PM user-2 更新 user-1 负责的需求
      await service.updateStage('req-1', updateStageDto, 'user-2', UserRole.PM);

      expect(mockPrismaService.requirement.update).toHaveBeenCalled();
    });

    it('更新到 RELEASE 阶段时应该设置状态为 COMPLETED', async () => {
      const releaseDto: UpdateStageDto = {
        stage: WorkflowStage.RELEASE,
      };

      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.requirement.update.mockResolvedValue({
        ...mockRequirement,
        currentStage: WorkflowStage.RELEASE,
        status: RequirementStatus.COMPLETED,
      });

      const result = await service.updateStage('req-1', releaseDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.requirement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RequirementStatus.COMPLETED,
          }),
        })
      );
    });

    it('更新到 DOCUMENT_SIGN 阶段时应该设置状态为 IN_PROGRESS', async () => {
      const docSignDto: UpdateStageDto = {
        stage: WorkflowStage.DOCUMENT_SIGN,
      };

      mockPrismaService.requirement.findUnique.mockResolvedValue({
        ...mockRequirementWithVersion,
        currentStage: WorkflowStage.REQUIREMENT_DESIGN,
      });
      mockPrismaService.workflowLog.create.mockResolvedValue({});
      mockPrismaService.requirement.update.mockResolvedValue({
        ...mockRequirement,
        currentStage: WorkflowStage.DOCUMENT_SIGN,
        status: RequirementStatus.IN_PROGRESS,
      });

      const result = await service.updateStage('req-1', docSignDto, 'user-1', UserRole.PM);

      expect(mockPrismaService.requirement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RequirementStatus.IN_PROGRESS,
          }),
        })
      );
    });
  });

  describe('remove', () => {
    it('应该成功删除需求', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.delete.mockResolvedValue(mockRequirement);

      const result = await service.remove('req-1');

      expect(result).toEqual(mockRequirement);
      expect(mockPrismaService.requirement.delete).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      });
    });

    it('删除不存在的需求时应该抛出 NotFoundException', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateCode', () => {
    it('应该生成正确格式的需求编码', async () => {
      mockPrismaService.requirement.count.mockResolvedValue(0);

      const result = await service.generateCode('version-1');

      // 格式应该是 FExxxxyyyymmddnnnn
      expect(result).toMatch(/^FE\d{12}$/);
    });

    it('应该根据已有数量递增编码', async () => {
      mockPrismaService.requirement.count.mockResolvedValue(5);

      const result = await service.generateCode('version-1');

      expect(result).toMatch(/0006$/);
    });

    it('应该使用日期前缀进行计数', async () => {
      mockPrismaService.requirement.count.mockResolvedValue(0);

      await service.generateCode('version-1');

      expect(mockPrismaService.requirement.count).toHaveBeenCalledWith({
        where: {
          code: {
            startsWith: expect.stringMatching(/^FE\d{8}$/),
          },
        },
      });
    });
  });

  describe('duplicate', () => {
    it('应该成功复制需求', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.requirement.create.mockResolvedValue({
        ...mockRequirement,
        id: 'req-2',
        code: 'FE20260322002',
        title: '用户登录功能 - 副本',
      });

      const result = await service.duplicate('req-1');

      expect(result.title).toBe('用户登录功能 - 副本');
      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: '用户登录功能 - 副本',
            currentStage: WorkflowStage.REQUIREMENT_DESIGN,
            status: RequirementStatus.DRAFT,
          }),
        })
      );
    });

    it('复制需求应该生成新的编码', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.count.mockResolvedValue(10);
      mockPrismaService.requirement.create.mockResolvedValue(mockRequirement);

      await service.duplicate('req-1');

      expect(mockPrismaService.requirement.count).toHaveBeenCalled();
    });

    it('复制后的需求状态应该为 DRAFT', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.requirement.create.mockResolvedValue(mockRequirement);

      await service.duplicate('req-1');

      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RequirementStatus.DRAFT,
          }),
        })
      );
    });

    it('复制后的需求阶段应该为 REQUIREMENT_DESIGN', async () => {
      mockPrismaService.requirement.findUnique.mockResolvedValue(mockRequirementWithVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.requirement.create.mockResolvedValue(mockRequirement);

      await service.duplicate('req-1');

      expect(mockPrismaService.requirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStage: WorkflowStage.REQUIREMENT_DESIGN,
          }),
        })
      );
    });
  });
});

describe('Requirement DTO 验证', () => {
  it('CreateRequirementDto 应该包含所有必要字段', () => {
    const dto: CreateRequirementDto = {
      code: 'FE001',
      title: '需求标题',
      description: '需求描述',
      type: '功能',
      versionId: 'version-1',
      assigneeId: 'user-1',
      workload: 5,
      dueDate: '2026-03-25',
    };

    expect(dto.code).toBe('FE001');
    expect(dto.title).toBe('需求标题');
    expect(dto.versionId).toBe('version-1');
    expect(dto.assigneeId).toBe('user-1');
  });

  it('UpdateRequirementDto 所有字段都应该是可选的', () => {
    const dto: UpdateRequirementDto = {
      title: '新标题',
    };

    expect(dto.title).toBe('新标题');
    expect(dto.description).toBeUndefined();
  });

  it('UpdateStageDto 应该包含 stage 和可选的 remark', () => {
    const dto: UpdateStageDto = {
      stage: WorkflowStage.FEATURE_DEV,
      remark: '备注',
    };

    expect(dto.stage).toBe(WorkflowStage.FEATURE_DEV);
    expect(dto.remark).toBe('备注');
  });
});
