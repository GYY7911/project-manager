import { Test, TestingModule } from '@nestjs/testing';
import { DelayConfigController } from './delay-config.controller';
import { DelayConfigService, CreateDelayConfigDto, BatchImportDto } from './delay-config.service';
import { WorkflowStage } from '@prisma/client';

describe('DelayConfigController', () => {
  let controller: DelayConfigController;
  let service: DelayConfigService;

  const mockDelayConfigService = {
    findByVersion: jest.fn(),
    createOrUpdate: jest.fn(),
    remove: jest.fn(),
    batchImport: jest.fn(),
  };

  const mockDelayConfig = {
    id: 'dc-1',
    entityId: 'req-1',
    entityType: 'requirement',
    versionId: 'version-1',
    stageDeadlines: [
      { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-20' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = {
    user: {
      sub: 'user-1',
      username: 'testuser',
      role: 'PM',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelayConfigController],
      providers: [
        {
          provide: DelayConfigService,
          useValue: mockDelayConfigService,
        },
      ],
    }).compile();

    controller = module.get<DelayConfigController>(DelayConfigController);
    service = module.get<DelayConfigService>(DelayConfigService);
  });

  describe('getByVersion', () => {
    it('应该返回指定版本的延期配置', async () => {
      mockDelayConfigService.findByVersion.mockResolvedValue([mockDelayConfig]);

      const result = await controller.getByVersion('version-1');

      expect(result).toEqual([mockDelayConfig]);
      expect(service.findByVersion).toHaveBeenCalledWith('version-1');
    });

    it('无配置时应该返回空数组', async () => {
      mockDelayConfigService.findByVersion.mockResolvedValue([]);

      const result = await controller.getByVersion('version-1');

      expect(result).toEqual([]);
    });
  });

  describe('createOrUpdate', () => {
    const createDto: CreateDelayConfigDto = {
      entityId: 'req-1',
      entityType: 'requirement',
      versionId: 'version-1',
      stageDeadlines: [
        { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-20' },
      ],
    };

    it('应该成功创建或更新延期配置', async () => {
      mockDelayConfigService.createOrUpdate.mockResolvedValue(mockDelayConfig);

      const result = await controller.createOrUpdate(createDto, mockRequest as any);

      expect(result).toEqual(mockDelayConfig);
      expect(service.createOrUpdate).toHaveBeenCalledWith({
        ...createDto,
        operatedBy: 'user-1',
      });
    });

    it('应该使用请求中的用户 ID', async () => {
      mockDelayConfigService.createOrUpdate.mockResolvedValue(mockDelayConfig);

      const customRequest = {
        user: { sub: 'user-2', role: 'ADMIN' },
      };

      await controller.createOrUpdate(createDto, customRequest as any);

      expect(service.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          operatedBy: 'user-2',
        })
      );
    });

    it('应该支持问题单类型', async () => {
      const issueDto: CreateDelayConfigDto = {
        ...createDto,
        entityId: 'issue-1',
        entityType: 'issue',
      };

      mockDelayConfigService.createOrUpdate.mockResolvedValue({
        ...mockDelayConfig,
        entityId: 'issue-1',
        entityType: 'issue',
      });

      await controller.createOrUpdate(issueDto, mockRequest as any);

      expect(service.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'issue',
        })
      );
    });

    it('应该支持添加变更原因', async () => {
      const dtoWithReason: CreateDelayConfigDto = {
        ...createDto,
        reason: '客户需求变更',
      };

      mockDelayConfigService.createOrUpdate.mockResolvedValue(mockDelayConfig);

      await controller.createOrUpdate(dtoWithReason, mockRequest as any);

      expect(service.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: '客户需求变更',
        })
      );
    });
  });

  describe('remove', () => {
    it('应该成功删除延期配置', async () => {
      mockDelayConfigService.remove.mockResolvedValue(mockDelayConfig);

      const result = await controller.remove('dc-1');

      expect(result).toEqual(mockDelayConfig);
      expect(service.remove).toHaveBeenCalledWith('dc-1');
    });
  });

  describe('batchImport', () => {
    const batchDto: BatchImportDto = {
      versionId: 'version-1',
      items: [
        {
          code: 'FE001',
          stageDeadlines: [
            { stage: 'FEATURE_DEV', plannedDate: '2026-03-20' },
          ],
        },
        {
          code: 'FE002',
          stageDeadlines: [
            { stage: 'FEATURE_DEV', plannedDate: '2026-03-21' },
          ],
        },
      ],
    };

    it('应该批量导入延期配置', async () => {
      mockDelayConfigService.batchImport.mockResolvedValue({
        success: 2,
        failed: 0,
        errors: [],
      });

      const result = await controller.batchImport(batchDto);

      expect(result.success).toBe(2);
      expect(service.batchImport).toHaveBeenCalledWith(batchDto);
    });

    it('空配置数组时应该返回 0 成功', async () => {
      mockDelayConfigService.batchImport.mockResolvedValue({
        success: 0,
        failed: 0,
        errors: [],
      });

      const result = await controller.batchImport({
        versionId: 'version-1',
        items: [],
      });

      expect(result.success).toBe(0);
    });

    it('部分失败时应该返回错误信息', async () => {
      mockDelayConfigService.batchImport.mockResolvedValue({
        success: 1,
        failed: 1,
        errors: [
          { code: 'FE003', error: '需求不存在' },
        ],
      });

      const result = await controller.batchImport(batchDto);

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });
});

describe('DelayConfig Controller DTO 验证', () => {
  it('CreateDelayConfigDto 应该包含必要字段', () => {
    const dto: CreateDelayConfigDto = {
      entityId: 'req-1',
      entityType: 'requirement',
      versionId: 'version-1',
      stageDeadlines: [
        { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-03-20' },
      ],
      reason: '测试',
      operatedBy: 'user-1',
    };

    expect(dto.entityId).toBe('req-1');
    expect(dto.entityType).toBe('requirement');
    expect(dto.versionId).toBe('version-1');
    expect(dto.stageDeadlines).toHaveLength(1);
  });

  it('BatchImportDto 应该包含 versionId 和 items', () => {
    const dto: BatchImportDto = {
      versionId: 'version-1',
      items: [
        {
          code: 'FE001',
          stageDeadlines: [
            { stage: 'FEATURE_DEV', plannedDate: '2026-03-20' },
          ],
        },
      ],
    };

    expect(dto.versionId).toBe('version-1');
    expect(dto.items).toHaveLength(1);
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
