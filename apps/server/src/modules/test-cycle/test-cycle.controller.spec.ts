import { Test, TestingModule } from '@nestjs/testing';
import { TestCycleController } from './test-cycle.controller';
import { TestCycleService } from './test-cycle.service';
import { CreateTestCycleDto } from './test-cycle.dto';
import { UserRole } from '@prisma/client';

describe('TestCycleController', () => {
  let controller: TestCycleController;
  let service: TestCycleService;

  const mockTestCycleService = {
    create: jest.fn(),
    findByVersion: jest.fn(),
    update: jest.fn(),
    reorder: jest.fn(),
    remove: jest.fn(),
  };

  const mockTestCycle = {
    id: 'tc-1',
    name: 'SIT1',
    order: 1,
    versionId: 'version-1',
    createdById: 'user-1',
    createdAt: new Date(),
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
      controllers: [TestCycleController],
      providers: [
        {
          provide: TestCycleService,
          useValue: mockTestCycleService,
        },
      ],
    }).compile();

    controller = module.get<TestCycleController>(TestCycleController);
    service = module.get<TestCycleService>(TestCycleService);
  });

  describe('create', () => {
    const createDto: CreateTestCycleDto = {
      name: 'SIT1',
      versionId: 'version-1',
    };

    it('应该成功创建转测版本', async () => {
      mockTestCycleService.create.mockResolvedValue(mockTestCycle);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockTestCycle);
      expect(service.create).toHaveBeenCalledWith(createDto, 'user-1');
    });

    it('应该使用请求中的用户 ID', async () => {
      mockTestCycleService.create.mockResolvedValue(mockTestCycle);

      const customRequest = {
        user: { id: 'user-2', role: UserRole.ADMIN },
      };

      await controller.create(createDto, customRequest);

      expect(service.create).toHaveBeenCalledWith(createDto, 'user-2');
    });
  });

  describe('findByVersion', () => {
    it('应该返回指定版本的转测版本列表', async () => {
      const testCycles = [mockTestCycle];
      mockTestCycleService.findByVersion.mockResolvedValue(testCycles);

      const result = await controller.findByVersion('version-1');

      expect(result).toEqual(testCycles);
      expect(service.findByVersion).toHaveBeenCalledWith('version-1');
    });

    it('无转测版本时应该返回空数组', async () => {
      mockTestCycleService.findByVersion.mockResolvedValue([]);

      const result = await controller.findByVersion('version-1');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('应该成功更新转测版本', async () => {
      mockTestCycleService.update.mockResolvedValue({
        ...mockTestCycle,
        name: 'UAT',
      });

      const result = await controller.update('tc-1', { name: 'UAT' });

      expect(result.name).toBe('UAT');
      expect(service.update).toHaveBeenCalledWith('tc-1', { name: 'UAT' });
    });

    it('应该支持更新顺序', async () => {
      mockTestCycleService.update.mockResolvedValue({
        ...mockTestCycle,
        order: 2,
      });

      const result = await controller.update('tc-1', { order: 2 });

      expect(result.order).toBe(2);
      expect(service.update).toHaveBeenCalledWith('tc-1', { order: 2 });
    });

    it('应该同时更新名称和顺序', async () => {
      mockTestCycleService.update.mockResolvedValue({
        ...mockTestCycle,
        name: 'UAT',
        order: 2,
      });

      const result = await controller.update('tc-1', { name: 'UAT', order: 2 });

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

      mockTestCycleService.reorder.mockResolvedValue(undefined);

      await controller.reorder(reorderData);

      expect(service.reorder).toHaveBeenCalledWith(reorderData);
    });

    it('空数组时应该不执行任何操作', async () => {
      mockTestCycleService.reorder.mockResolvedValue(undefined);

      await controller.reorder([]);

      expect(service.reorder).toHaveBeenCalledWith([]);
    });
  });

  describe('remove', () => {
    it('应该成功删除转测版本', async () => {
      mockTestCycleService.remove.mockResolvedValue(mockTestCycle);

      const result = await controller.remove('tc-1');

      expect(result).toEqual(mockTestCycle);
      expect(service.remove).toHaveBeenCalledWith('tc-1');
    });
  });
});

describe('TestCycle Controller DTO 验证', () => {
  it('CreateTestCycleDto 应该包含 name 和 versionId', () => {
    const dto: CreateTestCycleDto = {
      name: 'SIT1',
      versionId: 'version-1',
    };

    expect(dto.name).toBe('SIT1');
    expect(dto.versionId).toBe('version-1');
  });
});
