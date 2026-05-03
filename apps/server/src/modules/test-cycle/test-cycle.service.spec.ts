import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TestCycleService } from './test-cycle.service';
import { CreateTestCycleDto } from './test-cycle.dto';
import { PrismaService } from '../../prisma/prisma.service';

describe('TestCycleService', () => {
  let service: TestCycleService;
  let prisma: PrismaService;

  const mockPrismaService = {
    testCycle: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockTestCycle = {
    id: 'tc-1',
    name: 'SIT1',
    order: 1,
    versionId: 'version-1',
    createdById: 'user-1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestCycleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TestCycleService>(TestCycleService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto: CreateTestCycleDto = {
      name: 'SIT1',
      versionId: 'version-1',
    };
    const userId = 'user-1';

    it('应该成功创建转测版本', async () => {
      mockPrismaService.testCycle.aggregate.mockResolvedValue({ _max: { order: null } });
      mockPrismaService.testCycle.create.mockResolvedValue(mockTestCycle);

      const result = await service.create(createDto, userId);

      expect(result).toEqual(mockTestCycle);
      expect(mockPrismaService.testCycle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'SIT1',
          versionId: 'version-1',
          order: 1,
          createdById: 'user-1',
        }),
      });
    });

    it('创建第一个转测版本时 order 应该为 1', async () => {
      mockPrismaService.testCycle.aggregate.mockResolvedValue({ _max: { order: null } });
      mockPrismaService.testCycle.create.mockResolvedValue(mockTestCycle);

      await service.create(createDto, userId);

      expect(mockPrismaService.testCycle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 1 }),
        })
      );
    });

    it('已有转测版本时 order 应该递增', async () => {
      mockPrismaService.testCycle.aggregate.mockResolvedValue({ _max: { order: 3 } });
      mockPrismaService.testCycle.create.mockResolvedValue({
        ...mockTestCycle,
        order: 4,
      });

      await service.create(createDto, userId);

      expect(mockPrismaService.testCycle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 4 }),
        })
      );
    });

    it('应该根据 versionId 计算最大 order', async () => {
      mockPrismaService.testCycle.aggregate.mockResolvedValue({ _max: { order: 5 } });
      mockPrismaService.testCycle.create.mockResolvedValue(mockTestCycle);

      await service.create(createDto, userId);

      expect(mockPrismaService.testCycle.aggregate).toHaveBeenCalledWith({
        where: { versionId: 'version-1' },
        _max: { order: true },
      });
    });
  });

  describe('findByVersion', () => {
    const mockTestCycles = [
      { ...mockTestCycle, order: 1 },
      { ...mockTestCycle, id: 'tc-2', name: 'SIT2', order: 2 },
    ];

    it('应该返回指定版本的所有转测版本', async () => {
      mockPrismaService.testCycle.findMany.mockResolvedValue(mockTestCycles);

      const result = await service.findByVersion('version-1');

      expect(result).toEqual(mockTestCycles);
      expect(mockPrismaService.testCycle.findMany).toHaveBeenCalledWith({
        where: { versionId: 'version-1' },
        orderBy: { order: 'asc' },
      });
    });

    it('应该按 order 升序排序', async () => {
      mockPrismaService.testCycle.findMany.mockResolvedValue(mockTestCycles);

      await service.findByVersion('version-1');

      expect(mockPrismaService.testCycle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { order: 'asc' },
        })
      );
    });

    it('无转测版本时应该返回空数组', async () => {
      mockPrismaService.testCycle.findMany.mockResolvedValue([]);

      const result = await service.findByVersion('version-1');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('应该成功更新转测版本名称', async () => {
      mockPrismaService.testCycle.update.mockResolvedValue({
        ...mockTestCycle,
        name: 'UAT',
      });

      const result = await service.update('tc-1', { name: 'UAT' });

      expect(result.name).toBe('UAT');
    });

    it('应该成功更新转测版本顺序', async () => {
      mockPrismaService.testCycle.update.mockResolvedValue({
        ...mockTestCycle,
        order: 2,
      });

      const result = await service.update('tc-1', { order: 2 });

      expect(result.order).toBe(2);
    });

    it('应该同时更新名称和顺序', async () => {
      mockPrismaService.testCycle.update.mockResolvedValue({
        ...mockTestCycle,
        name: 'UAT',
        order: 2,
      });

      const result = await service.update('tc-1', { name: 'UAT', order: 2 });

      expect(result.name).toBe('UAT');
      expect(result.order).toBe(2);
    });
  });

  describe('reorder', () => {
    it('应该批量更新转测版本顺序', async () => {
      const reorderData = [
        { id: 'tc-1', order: 2 },
        { id: 'tc-2', order: 1 },
      ];

      mockPrismaService.testCycle.update
        .mockResolvedValueOnce({ ...mockTestCycle, order: 2 })
        .mockResolvedValueOnce({ ...mockTestCycle, id: 'tc-2', order: 1 });

      await service.reorder(reorderData);

      expect(mockPrismaService.testCycle.update).toHaveBeenCalledTimes(2);
    });

    it('空数组时应该不执行任何更新', async () => {
      await service.reorder([]);

      expect(mockPrismaService.testCycle.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('应该成功删除转测版本', async () => {
      mockPrismaService.testCycle.findUnique.mockResolvedValue(mockTestCycle);
      mockPrismaService.testCycle.delete.mockResolvedValue(mockTestCycle);

      const result = await service.remove('tc-1');

      expect(result).toEqual(mockTestCycle);
      expect(mockPrismaService.testCycle.delete).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
      });
    });

    it('转测版本不存在时应该抛出 NotFoundException', async () => {
      mockPrismaService.testCycle.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.remove('non-existent')).rejects.toThrow('转测版本不存在');
    });

    it('删除前应该先检查转测版本是否存在', async () => {
      mockPrismaService.testCycle.findUnique.mockResolvedValue(mockTestCycle);
      mockPrismaService.testCycle.delete.mockResolvedValue(mockTestCycle);

      await service.remove('tc-1');

      expect(mockPrismaService.testCycle.findUnique).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
      });
    });
  });
});

describe('CreateTestCycleDto 验证', () => {
  it('应该包含 name 和 versionId', () => {
    const dto: CreateTestCycleDto = {
      name: 'SIT1',
      versionId: 'version-1',
    };

    expect(dto.name).toBe('SIT1');
    expect(dto.versionId).toBe('version-1');
  });
});
