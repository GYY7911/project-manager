import { Test, TestingModule } from '@nestjs/testing';
import { RequirementController } from './requirement.controller';
import { RequirementService } from './requirement.service';
import { CreateRequirementDto, UpdateRequirementDto, UpdateStageDto } from './requirement.dto';
import { WorkflowStage, RequirementStatus, UserRole } from '@prisma/client';

describe('RequirementController', () => {
  let controller: RequirementController;
  let service: RequirementService;

  const mockRequirementService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    generateCode: jest.fn(),
    update: jest.fn(),
    updateStage: jest.fn(),
    remove: jest.fn(),
    duplicate: jest.fn(),
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

  const mockRequest = {
    user: {
      id: 'user-1',
      username: 'testuser',
      role: UserRole.PM,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequirementController],
      providers: [
        {
          provide: RequirementService,
          useValue: mockRequirementService,
        },
      ],
    }).compile();

    controller = module.get<RequirementController>(RequirementController);
    service = module.get<RequirementService>(RequirementService);
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
      mockRequirementService.create.mockResolvedValue(mockRequirement);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockRequirement);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('创建失败时应该抛出异常', async () => {
      const error = new Error('创建失败') as Error & { code: string };
      error.code = 'P2003';
      mockRequirementService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toThrow('创建失败');
    });
  });

  describe('findAll', () => {
    it('应该返回所有需求', async () => {
      mockRequirementService.findAll.mockResolvedValue([mockRequirement]);

      const result = await controller.findAll(undefined, mockRequest);

      expect(result).toEqual([mockRequirement]);
      expect(service.findAll).toHaveBeenCalledWith(undefined, UserRole.PM);
    });

    it('应该根据 versionId 过滤需求', async () => {
      mockRequirementService.findAll.mockResolvedValue([mockRequirement]);

      await controller.findAll('version-1', mockRequest);

      expect(service.findAll).toHaveBeenCalledWith('version-1', UserRole.PM);
    });

    it('应该传递用户角色给服务', async () => {
      mockRequirementService.findAll.mockResolvedValue([mockRequirement]);

      const memberRequest = {
        user: { id: 'user-1', role: UserRole.MEMBER },
      };

      await controller.findAll('version-1', memberRequest);

      expect(service.findAll).toHaveBeenCalledWith('version-1', UserRole.MEMBER);
    });
  });

  describe('generateCode', () => {
    it('应该生成需求编码', async () => {
      mockRequirementService.generateCode.mockResolvedValue('FE20260322001');

      const result = await controller.generateCode('version-1');

      expect(result.code).toBe('FE20260322001');
      expect(service.generateCode).toHaveBeenCalledWith('version-1');
    });
  });

  describe('findOne', () => {
    it('应该返回指定需求', async () => {
      mockRequirementService.findOne.mockResolvedValue(mockRequirement);

      const result = await controller.findOne('req-1', mockRequest);

      expect(result).toEqual(mockRequirement);
      expect(service.findOne).toHaveBeenCalledWith('req-1', UserRole.PM);
    });

    it('应该传递用户角色给服务', async () => {
      mockRequirementService.findOne.mockResolvedValue(mockRequirement);

      const memberRequest = {
        user: { id: 'user-1', role: UserRole.MEMBER },
      };

      await controller.findOne('req-1', memberRequest);

      expect(service.findOne).toHaveBeenCalledWith('req-1', UserRole.MEMBER);
    });
  });

  describe('update', () => {
    const updateDto: UpdateRequirementDto = {
      title: '更新后的标题',
    };

    it('应该成功更新需求', async () => {
      mockRequirementService.update.mockResolvedValue({
        ...mockRequirement,
        title: '更新后的标题',
      });

      const result = await controller.update('req-1', updateDto);

      expect(result.title).toBe('更新后的标题');
      expect(service.update).toHaveBeenCalledWith('req-1', updateDto);
    });
  });

  describe('updateStage', () => {
    const updateStageDto: UpdateStageDto = {
      stage: WorkflowStage.FEATURE_DEV,
      remark: '开始开发',
    };

    it('应该成功更新需求阶段', async () => {
      mockRequirementService.updateStage.mockResolvedValue({
        ...mockRequirement,
        currentStage: WorkflowStage.FEATURE_DEV,
      });

      const result = await controller.updateStage('req-1', updateStageDto, mockRequest);

      expect(result.currentStage).toBe(WorkflowStage.FEATURE_DEV);
      expect(service.updateStage).toHaveBeenCalledWith(
        'req-1',
        updateStageDto,
        'user-1',
        UserRole.PM
      );
    });

    it('应该传递操作人 ID 和角色给服务', async () => {
      mockRequirementService.updateStage.mockResolvedValue(mockRequirement);

      const memberRequest = {
        user: { id: 'user-2', role: UserRole.MEMBER },
      };

      await controller.updateStage('req-1', updateStageDto, memberRequest);

      expect(service.updateStage).toHaveBeenCalledWith(
        'req-1',
        updateStageDto,
        'user-2',
        UserRole.MEMBER
      );
    });
  });

  describe('remove', () => {
    it('应该成功删除需求', async () => {
      mockRequirementService.remove.mockResolvedValue(mockRequirement);

      const result = await controller.remove('req-1');

      expect(result).toEqual(mockRequirement);
      expect(service.remove).toHaveBeenCalledWith('req-1');
    });
  });

  describe('duplicate', () => {
    it('应该成功复制需求', async () => {
      mockRequirementService.duplicate.mockResolvedValue({
        ...mockRequirement,
        id: 'req-2',
        title: '用户登录功能 - 副本',
      });

      const result = await controller.duplicate('req-1');

      expect(result.title).toBe('用户登录功能 - 副本');
      expect(service.duplicate).toHaveBeenCalledWith('req-1');
    });
  });
});

describe('Requirement Controller DTO 验证', () => {
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
