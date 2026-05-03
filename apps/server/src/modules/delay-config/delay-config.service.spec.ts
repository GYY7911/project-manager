import { Test, TestingModule } from '@nestjs/testing';
import { DelayConfigService } from './delay-config.service';
import { CreateDelayConfigDto, BatchImportDto } from './delay-config.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { WorkflowStage } from '@prisma/client';

describe('DelayConfigService', () => {
  let service: DelayConfigService;
  let prisma: any;

  const mockVersionId = 'version-1';
  const mockUserId = 'user-1';

  beforeEach(async () => {
    prisma = {
      delayConfig: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      version: {
        findUnique: jest.fn(),
      },
      requirement: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      issue: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      planChangeLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelayConfigService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DelayConfigService>(DelayConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByVersion', () => {
    it('应该返回指定版本的延期配置列表', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          entityId: 'req-1',
          entityType: 'requirement',
          versionId: mockVersionId,
          stageDeadlines: [{ stage: 'FEATURE_DEV', plannedDate: '2026-04-01' }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.delayConfig.findMany.mockResolvedValue(mockConfigs);

      const result = await service.findByVersion(mockVersionId);

      expect(prisma.delayConfig.findMany).toHaveBeenCalledWith({
        where: { versionId: mockVersionId },
      });
      expect(result).toEqual(mockConfigs);
    });

    it('应该返回空数组当没有配置时', async () => {
      prisma.delayConfig.findMany.mockResolvedValue([]);

      const result = await service.findByVersion(mockVersionId);

      expect(result).toEqual([]);
    });
  });

  describe('findByEntity', () => {
    it('应该返回指定实体的延期配置', async () => {
      const mockConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [{ stage: 'FEATURE_DEV', plannedDate: '2026-04-01' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.delayConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await service.findByEntity('req-1', mockVersionId);

      expect(prisma.delayConfig.findFirst).toHaveBeenCalledWith({
        where: { entityId: 'req-1', versionId: mockVersionId },
      });
      expect(result).toEqual(mockConfig);
    });

    it('应该返回null当配置不存在时', async () => {
      prisma.delayConfig.findFirst.mockResolvedValue(null);

      const result = await service.findByEntity('non-existent', mockVersionId);

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdate', () => {
    const createDto: CreateDelayConfigDto = {
      entityId: 'req-1',
      entityType: 'requirement',
      versionId: mockVersionId,
      stageDeadlines: [
        { stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-04-01' },
      ],
    };

    it('应该创建新的延期配置', async () => {
      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(null);
      prisma.delayConfig.create.mockResolvedValue({
        id: 'config-1',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createOrUpdate(createDto);

      expect(prisma.delayConfig.create).toHaveBeenCalled();
      expect(result.id).toBe('config-1');
    });

    it('应该更新已存在的延期配置', async () => {
      const existingConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [{ stage: 'FEATURE_DEV', plannedDate: '2026-03-25' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(existingConfig);
      prisma.delayConfig.update.mockResolvedValue({
        ...existingConfig,
        stageDeadlines: createDto.stageDeadlines,
      });

      const result = await service.createOrUpdate(createDto);

      expect(prisma.delayConfig.update).toHaveBeenCalledWith({
        where: { id: 'config-1' },
        data: { stageDeadlines: createDto.stageDeadlines },
      });
    });

    it('版本不存在时应该抛出异常', async () => {
      prisma.version.findUnique.mockResolvedValue(null);

      await expect(service.createOrUpdate(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('需求不存在时应该抛出异常', async () => {
      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue(null);

      await expect(service.createOrUpdate(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('问题单不存在时应该抛出异常', async () => {
      const issueDto: CreateDelayConfigDto = {
        ...createDto,
        entityType: 'issue',
        entityId: 'issue-1',
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.issue.findUnique.mockResolvedValue(null);

      await expect(service.createOrUpdate(issueDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('当有操作人且配置已存在时应该记录变更日志', async () => {
      const existingConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [{ stage: 'FEATURE_DEV', plannedDate: '2026-03-25' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dtoWithOperator: CreateDelayConfigDto = {
        ...createDto,
        reason: '需求变更',
        operatedBy: mockUserId,
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(existingConfig);
      prisma.planChangeLog.create.mockResolvedValue({ id: 'log-1' });
      prisma.delayConfig.update.mockResolvedValue({
        ...existingConfig,
        stageDeadlines: dtoWithOperator.stageDeadlines,
      });

      await service.createOrUpdate(dtoWithOperator);

      expect(prisma.planChangeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'requirement',
          entityId: 'req-1',
          changeType: 'deadline_change',
          reason: '需求变更',
          operatedBy: mockUserId,
        }),
      });
    });

    it('当配置没有变化时不应该记录变更日志', async () => {
      const existingConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [{ stage: 'FEATURE_DEV', plannedDate: '2026-04-01' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dtoWithOperator: CreateDelayConfigDto = {
        ...createDto,
        stageDeadlines: [{ stage: WorkflowStage.FEATURE_DEV, plannedDate: '2026-04-01' }],
        reason: '无变化',
        operatedBy: mockUserId,
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(existingConfig);
      prisma.delayConfig.update.mockResolvedValue(existingConfig);

      await service.createOrUpdate(dtoWithOperator);

      // 不应该调用 planChangeLog.create，因为配置没有变化
      expect(prisma.planChangeLog.create).not.toHaveBeenCalled();
    });

    it('当 oldValue 为 null 时应该正确记录日志', async () => {
      const existingConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dtoWithOperator: CreateDelayConfigDto = {
        ...createDto,
        reason: '首次设置',
        operatedBy: mockUserId,
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(existingConfig);
      prisma.planChangeLog.create.mockResolvedValue({ id: 'log-1' });
      prisma.delayConfig.update.mockResolvedValue({
        ...existingConfig,
        stageDeadlines: dtoWithOperator.stageDeadlines,
      });

      await service.createOrUpdate(dtoWithOperator);

      expect(prisma.planChangeLog.create).toHaveBeenCalled();
    });

    it('当没有提供 reason 时应该使用默认值', async () => {
      const existingConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [{ stage: 'FEATURE_DEV', plannedDate: '2026-03-25' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dtoWithoutReason: CreateDelayConfigDto = {
        ...createDto,
        // 不提供 reason
        operatedBy: mockUserId,
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(existingConfig);
      prisma.planChangeLog.create.mockResolvedValue({ id: 'log-1' });
      prisma.delayConfig.update.mockResolvedValue({
        ...existingConfig,
        stageDeadlines: dtoWithoutReason.stageDeadlines,
      });

      await service.createOrUpdate(dtoWithoutReason);

      expect(prisma.planChangeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: '无',
          }),
        })
      );
    });
  });

  describe('remove', () => {
    it('应该删除延期配置', async () => {
      const mockConfig = {
        id: 'config-1',
        entityId: 'req-1',
        entityType: 'requirement',
        versionId: mockVersionId,
        stageDeadlines: [],
      };

      prisma.delayConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.delayConfig.delete.mockResolvedValue(mockConfig);

      const result = await service.remove('config-1');

      expect(prisma.delayConfig.delete).toHaveBeenCalledWith({
        where: { id: 'config-1' },
      });
      expect(result).toEqual(mockConfig);
    });

    it('配置不存在时应该抛出异常', async () => {
      prisma.delayConfig.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('batchImport', () => {
    const batchDto: BatchImportDto = {
      versionId: mockVersionId,
      items: [
        {
          code: 'FE20260322001',
          stageDeadlines: [
            { stage: '功能开发', plannedDate: '2026-04-01' },
          ],
        },
      ],
    };

    it('应该批量导入延期配置', async () => {
      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', code: 'FE20260322001' },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(null);
      prisma.delayConfig.create.mockResolvedValue({ id: 'config-1' });

      const result = await service.batchImport(batchDto);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('版本不存在时应该抛出异常', async () => {
      prisma.version.findUnique.mockResolvedValue(null);

      await expect(service.batchImport(batchDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('编码不存在时应该记录失败', async () => {
      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findMany.mockResolvedValue([]);
      prisma.issue.findMany.mockResolvedValue([]);

      const result = await service.batchImport(batchDto);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].code).toBe('FE20260322001');
      expect(result.errors[0].error).toBe('编码不存在');
    });

    it('无效阶段名称应该记录失败', async () => {
      const invalidDto: BatchImportDto = {
        versionId: mockVersionId,
        items: [
          {
            code: 'FE20260322001',
            stageDeadlines: [
              { stage: '无效阶段', plannedDate: '2026-04-01' },
            ],
          },
        ],
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', code: 'FE20260322001' },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);

      const result = await service.batchImport(invalidDto);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('无效的阶段名称');
    });

    it('空日期应该被过滤', async () => {
      const emptyDateDto: BatchImportDto = {
        versionId: mockVersionId,
        items: [
          {
            code: 'FE20260322001',
            stageDeadlines: [
              { stage: '功能开发', plannedDate: '' },
            ],
          },
        ],
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', code: 'FE20260322001' },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);

      const result = await service.batchImport(emptyDateDto);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('没有有效的阶段日期配置');
    });

    it('应该支持枚举值作为阶段名称', async () => {
      const enumDto: BatchImportDto = {
        versionId: mockVersionId,
        items: [
          {
            code: 'FE20260322001',
            stageDeadlines: [
              { stage: 'FEATURE_DEV', plannedDate: '2026-04-01' },
            ],
          },
        ],
      };

      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', code: 'FE20260322001' },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(null);
      prisma.delayConfig.create.mockResolvedValue({ id: 'config-1' });

      const result = await service.batchImport(enumDto);

      expect(result.success).toBe(1);
    });

    it('处理非 Error 类型的异常时应该返回未知错误', async () => {
      prisma.version.findUnique.mockResolvedValue({ id: mockVersionId });
      prisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', code: 'FE20260322001' },
      ]);
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1' });
      prisma.delayConfig.findFirst.mockResolvedValue(null);
      // 模拟 create 抛出非 Error 类型的异常
      prisma.delayConfig.create.mockRejectedValue('string error');

      const result = await service.batchImport(batchDto);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('未知错误');
    });
  });
});
