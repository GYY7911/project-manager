import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { VersionService } from './version.service';
import { CreateVersionDto, CreateOrUseVersionDto, UpdateVersionDto } from './version.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { VersionStatus } from '@prisma/client';

describe('VersionService', () => {
  let service: VersionService;
  let prisma: PrismaService;

  // Mock Prisma service
  const mockPrismaService = {
    version: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // 关联实体
    requirement: { count: jest.fn(), findMany: jest.fn() },
    issue: { count: jest.fn(), findMany: jest.fn() },
    testCycle: { count: jest.fn() },
    // 事务
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    // 重置所有 mock
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VersionService>(VersionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findByName', () => {
    it('应该根据名称查找版本并返回详细信息', async () => {
      const expectedVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.DEVELOPMENT,
        testCycles: [{ id: 'tc1', name: '转测1', order: 1 }],
        _count: {
          requirements: 5,
          issues: 3,
        },
      };

      mockPrismaService.version.findUnique.mockResolvedValue(expectedVersion);

      const result = await service.findByName('V2026.Q1');

      expect(result).toEqual(expectedVersion);
      expect(mockPrismaService.version.findUnique).toHaveBeenCalledWith({
        where: { name: 'V2026.Q1' },
        include: {
          testCycles: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              requirements: true,
              issues: true,
            },
          },
        },
      });
    });

    it('应该在版本不存在时返回 null', async () => {
      mockPrismaService.version.findUnique.mockResolvedValue(null);

      const result = await service.findByName('NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('createOrUse', () => {
    const createDto: CreateOrUseVersionDto = {
      name: 'V2026.Q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    };

    it('应该成功创建新版本并返回 isExisting: false', async () => {
      const newVersion = {
        id: 'new-version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
        status: VersionStatus.PLANNING,
      };

      mockPrismaService.version.findUnique.mockResolvedValue(null);
      mockPrismaService.version.create.mockResolvedValue(newVersion);

      const result = await service.createOrUse(createDto);

      expect(result.id).toBe('new-version-id');
      expect(result.isExisting).toBe(false);
      expect(result.message).toContain('创建成功');
    });

    it('当版本已存在且 useExisting=true 时应该返回现有版本', async () => {
      const existingVersion = {
        id: 'existing-version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.DEVELOPMENT,
        testCycles: [],
        _count: {
          requirements: 5,
          issues: 3,
        },
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);

      const result = await service.createOrUse({
        ...createDto,
        useExisting: true,
      });

      expect(result.id).toBe('existing-version-id');
      expect(result.isExisting).toBe(true);
      expect(result.message).toContain('已使用现有版本');
      // 确保没有创建新版本
      expect(mockPrismaService.version.create).not.toHaveBeenCalled();
    });

    it('当版本已存在且 useExisting=false 时应该抛出 ConflictException', async () => {
      const existingVersion = {
        id: 'existing-version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.DEVELOPMENT,
        testCycles: [],
        _count: {
          requirements: 5,
          issues: 3,
        },
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);

      await expect(service.createOrUse(createDto)).rejects.toThrow(ConflictException);

      // 确保没有创建新版本
      expect(mockPrismaService.version.create).not.toHaveBeenCalled();
    });

    it('冲突时应该返回现有版本的详细信息', async () => {
      const existingVersion = {
        id: 'existing-version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.DEVELOPMENT,
        testCycles: [],
        _count: {
          requirements: 10,
          issues: 5,
        },
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);

      try {
        await service.createOrUse(createDto);
        fail('应该抛出 ConflictException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = error.getResponse() as any;
        expect(response.existingVersion).toBeDefined();
        expect(response.existingVersion.id).toBe('existing-version-id');
        expect(response.existingVersion.requirementsCount).toBe(10);
        expect(response.existingVersion.issuesCount).toBe(5);
      }
    });
  });

  describe('create', () => {
    const createDto: CreateVersionDto = {
      name: 'V2026.Q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    };

    it('应该成功创建版本', async () => {
      const expectedVersion = {
        id: 'clx123',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
        status: VersionStatus.PLANNING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.version.findUnique.mockResolvedValue(null);
      mockPrismaService.version.create.mockResolvedValue(expectedVersion);

      const result = await service.create(createDto);

      expect(result).toEqual(expectedVersion);
      expect(mockPrismaService.version.findUnique).toHaveBeenCalledWith({
        where: { name: 'V2026.Q1' },
      });
      expect(mockPrismaService.version.create).toHaveBeenCalled();
    });

    it('应该在名称重复时抛出 ConflictException', async () => {
      const existingVersion = {
        id: 'existing-id',
        name: 'V2026.Q1',
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.version.create).not.toHaveBeenCalled();
    });

    it('应该正确处理日期时区问题（1月1日应保持为1月1日）', async () => {
      // 模拟 UTC+8 时区的日期字符串
      const dtoWithJan1: CreateVersionDto = {
        name: 'V2026.Q1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      };

      mockPrismaService.version.findUnique.mockResolvedValue(null);
      mockPrismaService.version.create.mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'new-id',
          ...data,
          status: VersionStatus.PLANNING,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      await service.create(dtoWithJan1);

      const createCall = mockPrismaService.version.create.mock.calls[0][0];
      const startDate = createCall.data.startDate;

      // 验证日期解析正确（使用本地时间验证）
      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(0); // January is 0
      expect(startDate.getDate()).toBe(1);
    });

    it('应该正确设置 startOfDay 和 endOfDay', async () => {
      mockPrismaService.version.findUnique.mockResolvedValue(null);
      mockPrismaService.version.create.mockImplementation(({ data }) => Promise.resolve(data));

      await service.create({
        name: 'Test Version',
        startDate: '2026-03-15',
        endDate: '2026-03-15',
      });

      const createCall = mockPrismaService.version.create.mock.calls[0][0];

      // 验证开始日期设置为当天开始（本地时间 00:00:00）
      expect(createCall.data.startDate.getHours()).toBe(0);
      expect(createCall.data.startDate.getMinutes()).toBe(0);
      expect(createCall.data.startDate.getSeconds()).toBe(0);

      // 验证结束日期设置为当天结束（本地时间 23:59:59.999）
      expect(createCall.data.endDate.getHours()).toBe(23);
      expect(createCall.data.endDate.getMinutes()).toBe(59);
      expect(createCall.data.endDate.getSeconds()).toBe(59);
    });
  });

  describe('findAll', () => {
    it('应该返回所有版本并按开始日期降序排序', async () => {
      const versions = [
        {
          id: '1',
          name: 'V2026.Q2',
          startDate: new Date('2026-04-01'),
          _count: {
            requirements: 3,
            issues: 2,
            testCycles: 1,
          },
        },
        {
          id: '2',
          name: 'V2026.Q1',
          startDate: new Date('2026-01-01'),
          _count: {
            requirements: 5,
            issues: 3,
            testCycles: 2,
          },
        },
      ];

      mockPrismaService.version.findMany.mockResolvedValue(versions);

      const result = await service.findAll();

      expect(result).toEqual(versions);
      expect(mockPrismaService.version.findMany).toHaveBeenCalledWith({
        orderBy: { startDate: 'desc' },
        include: {
          _count: {
            select: {
              requirements: true,
              issues: true,
              testCycles: true,
            },
          },
        },
      });
    });

    it('应该返回版本列表及其关联数据统计', async () => {
      const versions = [
        {
          id: '1',
          name: 'V2026.Q1',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-31'),
          _count: {
            requirements: 5,
            issues: 3,
            testCycles: 2,
          },
        },
      ];

      mockPrismaService.version.findMany.mockResolvedValue(versions);

      const result = await service.findAll();

      expect(result[0]._count.testCycles).toBe(2);
      expect(result[0]._count.requirements).toBe(5);
      expect(result[0]._count.issues).toBe(3);
    });

    it('应该在无版本时返回空数组', async () => {
      mockPrismaService.version.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('应该返回版本及其 testCycles', async () => {
      const version = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [
          { id: 'tc1', name: '转测1', order: 0 },
          { id: 'tc2', name: '转测2', order: 1 },
        ],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(version);

      const result = await service.findOne('version-id');

      expect(result).toEqual(version);
      expect(mockPrismaService.version.findUnique).toHaveBeenCalledWith({
        where: { id: 'version-id' },
        include: {
          testCycles: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('应该在版本不存在时抛出 NotFoundException', async () => {
      mockPrismaService.version.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateVersionDto = {
      name: 'V2026.Q1-Updated',
      status: VersionStatus.DEVELOPMENT,
    };

    it('应该成功更新版本', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };
      const updatedVersion = {
        ...existingVersion,
        ...updateDto,
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.version.update.mockResolvedValue(updatedVersion);

      const result = await service.update('version-id', updateDto);

      expect(result).toEqual(updatedVersion);
    });

    it('应该正确更新日期字段并保持时区', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.version.update.mockImplementation(({ data }) => Promise.resolve(data));

      await service.update('version-id', {
        startDate: '2026-02-15',
        endDate: '2026-04-30',
      });

      const updateCall = mockPrismaService.version.update.mock.calls[0][0];

      // 验证日期被正确解析（使用本地时间）
      expect(updateCall.data.startDate.getFullYear()).toBe(2026);
      expect(updateCall.data.startDate.getMonth()).toBe(1); // February
      expect(updateCall.data.startDate.getDate()).toBe(15);
      expect(updateCall.data.endDate.getFullYear()).toBe(2026);
      expect(updateCall.data.endDate.getMonth()).toBe(3); // April
      expect(updateCall.data.endDate.getDate()).toBe(30);
    });

    it('应该只在提供日期时才更新日期字段', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.version.update.mockResolvedValue({});

      await service.update('version-id', { name: 'New Name' });

      const updateCall = mockPrismaService.version.update.mock.calls[0][0];
      expect(updateCall.data.startDate).toBeUndefined();
      expect(updateCall.data.endDate).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('应该成功删除版本', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(0);
      mockPrismaService.version.delete.mockResolvedValue(existingVersion);

      const result = await service.remove('version-id');

      expect(result).toEqual(existingVersion);
      expect(mockPrismaService.version.delete).toHaveBeenCalledWith({
        where: { id: 'version-id' },
      });
    });

    it('应该在删除不存在的版本时抛出 NotFoundException', async () => {
      mockPrismaService.version.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.version.delete).not.toHaveBeenCalled();
    });

    it('当存在关联需求时应该抛出 BadRequestException', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(5);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(0);

      await expect(service.remove('version-id')).rejects.toThrow(BadRequestException);

      // 验证没有执行删除
      expect(mockPrismaService.version.delete).not.toHaveBeenCalled();
    });

    it('当存在关联问题单时应该抛出 BadRequestException', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.issue.count.mockResolvedValue(3);
      mockPrismaService.testCycle.count.mockResolvedValue(0);

      await expect(service.remove('version-id')).rejects.toThrow(BadRequestException);
    });

    it('当存在关联转测版本时应该抛出 BadRequestException', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(2);

      await expect(service.remove('version-id')).rejects.toThrow(BadRequestException);
    });

    it('错误响应应该包含关联数据详情', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(10);
      mockPrismaService.issue.count.mockResolvedValue(5);
      mockPrismaService.testCycle.count.mockResolvedValue(2);

      try {
        await service.remove('version-id');
        fail('应该抛出 BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse() as any;
        expect(response.details).toEqual({
          requirements: 10,
          issues: 5,
          testCycles: 2,
        });
      }
    });

    it('当无关联数据时应该成功删除', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(0);
      mockPrismaService.version.delete.mockResolvedValue(existingVersion);

      const result = await service.remove('version-id');

      expect(result).toEqual(existingVersion);
      expect(mockPrismaService.version.delete).toHaveBeenCalledWith({
        where: { id: 'version-id' },
      });
    });

    it('当 force=true 时应该级联删除所有关联数据', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(5);
      mockPrismaService.issue.count.mockResolvedValue(3);
      mockPrismaService.testCycle.count.mockResolvedValue(2);

      // Mock 获取关联 ID
      mockPrismaService.requirement.findMany.mockResolvedValue([
        { id: 'req-1' },
        { id: 'req-2' },
      ]);
      mockPrismaService.issue.findMany.mockResolvedValue([
        { id: 'issue-1' },
      ]);

      // Mock 事务
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          creditRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
          workflowLog: { deleteMany: jest.fn().mockResolvedValue({ count: 8 }) },
          issue: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          requirement: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
          testCycle: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          delayConfig: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          creditSummary: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          version: { delete: jest.fn().mockResolvedValue(existingVersion) },
        };
        return callback(mockTx);
      });

      const result = await service.remove('version-id', true);

      expect(result).toHaveProperty('deleted');
      expect(result.deleted.requirements).toBe(5);
      expect(result.deleted.issues).toBe(3);
      expect(result.deleted.testCycles).toBe(2);
      expect(result.deleted.delayConfigs).toBe(3);
      expect(result.deleted.creditSummaries).toBe(2);
    });

    it('当 force=false 且存在关联数据时应该抛出带提示的 BadRequestException', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(5);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(0);

      try {
        await service.remove('version-id', false);
        fail('应该抛出 BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse() as any;
        expect(response.details).toEqual({
          requirements: 5,
          issues: 0,
          testCycles: 0,
        });
        expect(response.hint).toContain('强制删除');
      }
    });

    it('级联删除应该使用事务确保原子性', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(1);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(0);
      mockPrismaService.requirement.findMany.mockResolvedValue([{ id: 'req-1' }]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      await service.remove('version-id', true);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('强制删除时应该删除 DelayConfig', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      // 需要有关联数据才会进入事务逻辑
      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(1); // 有 TestCycle 才会进入事务
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      let delayConfigDeleted = false;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          creditRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          workflowLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          issue: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          requirement: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          testCycle: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          delayConfig: {
            deleteMany: jest.fn().mockImplementation(() => {
              delayConfigDeleted = true;
              return Promise.resolve({ count: 5 });
            }),
          },
          creditSummary: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          version: { delete: jest.fn().mockResolvedValue(existingVersion) },
        };
        return callback(mockTx);
      });

      const result = await service.remove('version-id', true);

      expect(delayConfigDeleted).toBe(true);
      expect(result.deleted.delayConfigs).toBe(5);
    });

    it('强制删除时应该删除 CreditSummary', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      // 需要有关联数据才会进入事务逻辑
      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(0);
      mockPrismaService.issue.count.mockResolvedValue(1); // 有 Issue 才会进入事务
      mockPrismaService.testCycle.count.mockResolvedValue(0);
      mockPrismaService.requirement.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([{ id: 'issue-1' }]);

      let creditSummaryDeleted = false;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          creditRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          workflowLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          issue: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          requirement: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          testCycle: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          delayConfig: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          creditSummary: {
            deleteMany: jest.fn().mockImplementation(() => {
              creditSummaryDeleted = true;
              return Promise.resolve({ count: 10 });
            }),
          },
          version: { delete: jest.fn().mockResolvedValue(existingVersion) },
        };
        return callback(mockTx);
      });

      const result = await service.remove('version-id', true);

      expect(creditSummaryDeleted).toBe(true);
      expect(result.deleted.creditSummaries).toBe(10);
    });

    it('强制删除时应该在 Version 删除之前删除 DelayConfig 和 CreditSummary', async () => {
      const existingVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      // 需要有关联数据才会进入事务逻辑
      mockPrismaService.version.findUnique.mockResolvedValue(existingVersion);
      mockPrismaService.requirement.count.mockResolvedValue(1);
      mockPrismaService.issue.count.mockResolvedValue(0);
      mockPrismaService.testCycle.count.mockResolvedValue(0);
      mockPrismaService.requirement.findMany.mockResolvedValue([{ id: 'req-1' }]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);

      const deleteOrder: string[] = [];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          creditRecord: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('creditRecord');
              return Promise.resolve({ count: 0 });
            }),
          },
          workflowLog: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('workflowLog');
              return Promise.resolve({ count: 0 });
            }),
          },
          issue: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('issue');
              return Promise.resolve({ count: 0 });
            }),
          },
          requirement: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('requirement');
              return Promise.resolve({ count: 0 });
            }),
          },
          testCycle: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('testCycle');
              return Promise.resolve({ count: 0 });
            }),
          },
          delayConfig: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('delayConfig');
              return Promise.resolve({ count: 0 });
            }),
          },
          creditSummary: {
            deleteMany: jest.fn().mockImplementation(() => {
              deleteOrder.push('creditSummary');
              return Promise.resolve({ count: 0 });
            }),
          },
          version: {
            delete: jest.fn().mockImplementation(() => {
              deleteOrder.push('version');
              return Promise.resolve(existingVersion);
            }),
          },
        };
        return callback(mockTx);
      });

      await service.remove('version-id', true);

      // 验证删除顺序：Version 必须最后删除
      const versionIndex = deleteOrder.indexOf('version');
      const delayConfigIndex = deleteOrder.indexOf('delayConfig');
      const creditSummaryIndex = deleteOrder.indexOf('creditSummary');

      expect(versionIndex).toBeGreaterThan(delayConfigIndex);
      expect(versionIndex).toBeGreaterThan(creditSummaryIndex);
    });
  });

  describe('getCurrentVersion', () => {
    it('应该返回当前时间所在的版本', async () => {
      // 使用假定时器固定当前时间
      jest.useFakeTimers().setSystemTime(new Date('2026-02-15T12:00:00Z'));

      const currentVersion = {
        id: 'current-version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        testCycles: [],
      };

      mockPrismaService.version.findFirst.mockResolvedValue(currentVersion);

      const result = await service.getCurrentVersion();

      expect(result).toEqual(currentVersion);
      expect(mockPrismaService.version.findFirst).toHaveBeenCalledWith({
        where: {
          startDate: { lte: expect.any(Date) },
          endDate: { gte: expect.any(Date) },
        },
        include: {
          testCycles: {
            orderBy: { order: 'asc' },
          },
        },
      });

      jest.useRealTimers();
    });

    it('应该在没有当前版本时返回 null', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-01-01T12:00:00Z'));

      mockPrismaService.version.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentVersion();

      expect(result).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('getVersionBoard', () => {
    it('应该返回版本及其关联的 requirements 和 issues', async () => {
      const versionWithBoard = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [{ id: 'tc1', name: '转测1' }],
        requirements: [
          {
            id: 'req1',
            code: 'FE001',
            title: '需求1',
            assignee: { id: 'user1', name: '张三', employeeNo: 'z001' },
          },
        ],
        issues: [
          {
            id: 'issue1',
            code: 'ISS001',
            title: '问题单1',
            assignee: { id: 'user2', name: '李四', employeeNo: 'z002' },
            testCycle: { id: 'tc1', name: '转测1' },
          },
        ],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(versionWithBoard);

      const result = await service.getVersionBoard('version-id');

      expect(result).toEqual(versionWithBoard);
      expect(mockPrismaService.version.findUnique).toHaveBeenCalledWith({
        where: { id: 'version-id' },
        include: {
          testCycles: { orderBy: { order: 'asc' } },
          requirements: {
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                  employeeNo: true,
                },
              },
            },
          },
          issues: {
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
          },
        },
      });
    });

    it('应该正确包含 assignee 信息', async () => {
      const versionWithAssignee = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
        requirements: [
          {
            id: 'req1',
            assignee: {
              id: 'user-id',
              name: '测试用户',
              employeeNo: 'z00333',
            },
          },
        ],
        issues: [],
      };

      mockPrismaService.version.findUnique.mockResolvedValue(versionWithAssignee);

      const result = await service.getVersionBoard('version-id');

      expect(result.requirements[0].assignee).toEqual({
        id: 'user-id',
        name: '测试用户',
        employeeNo: 'z00333',
      });
    });

    it('应该在版本不存在时抛出 NotFoundException', async () => {
      mockPrismaService.version.findUnique.mockResolvedValue(null);

      await expect(service.getVersionBoard('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
