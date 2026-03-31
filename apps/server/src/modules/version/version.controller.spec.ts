import { Test, TestingModule } from '@nestjs/testing';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';
import { VersionStatus } from '@prisma/client';

describe('VersionController', () => {
  let controller: VersionController;
  let service: VersionService;

  const mockVersionService = {
    create: jest.fn(),
    createOrUse: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByName: jest.fn(),
    getCurrentVersion: jest.fn(),
    getVersionBoard: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
      providers: [
        {
          provide: VersionService,
          useValue: mockVersionService,
        },
      ],
    }).compile();

    controller = module.get<VersionController>(VersionController);
    service = module.get<VersionService>(VersionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('remove', () => {
    it('当 force="true" 时应该调用 service.remove(id, true)', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
        deleted: {
          requirements: 1,
          issues: 0,
          testCycles: 0,
          creditRecords: 0,
          workflowLogs: 0,
          delayConfigs: 0,
          creditSummaries: 0,
        },
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, 'true');

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, true);
    });

    it('当 force="false" 时应该调用 service.remove(id, false)', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, 'false');

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, false);
    });

    it('当 force 未提供时应该默认调用 service.remove(id, false)', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, undefined);

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, false);
    });

    it('当 force 为空字符串时应该调用 service.remove(id, false)', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, '');

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, false);
    });

    it('当 force="1" 时应该调用 service.remove(id, false)（只有 "true" 字符串才为 true）', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, '1');

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, false);
    });

    it('当 force="TRUE"（大写）时应该调用 service.remove(id, false)（大小写敏感）', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, 'TRUE');

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, false);
    });

    it('当 force="yes" 时应该调用 service.remove(id, false)', async () => {
      const versionId = 'version-id';
      const mockResponse = {
        id: versionId,
        name: 'V2026.Q1',
      };

      mockVersionService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(versionId, 'yes');

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.remove).toHaveBeenCalledWith(versionId, false);
    });
  });

  describe('checkName', () => {
    it('当版本名称存在时应该返回 exists: true 和版本信息', async () => {
      const mockVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.PLANNING,
        testCycles: [{ id: 'tc1', name: '转测1', order: 1 }],
      };

      mockVersionService.findByName.mockResolvedValue(mockVersion);

      const result = await controller.checkName('V2026.Q1');

      expect(result.exists).toBe(true);
      expect(result.version).toBeDefined();
      expect(result.version?.name).toBe('V2026.Q1');
      expect(result.version?.testCyclesCount).toBe(1);
    });

    it('当版本没有测试轮次时 testCyclesCount 应该为 0', async () => {
      const mockVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.PLANNING,
        testCycles: [],
      };

      mockVersionService.findByName.mockResolvedValue(mockVersion);

      const result = await controller.checkName('V2026.Q1');

      expect(result.exists).toBe(true);
      expect(result.version?.testCyclesCount).toBe(0);
    });

    it('当 testCycles 为 undefined 时 testCyclesCount 应该为 0', async () => {
      const mockVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.PLANNING,
        testCycles: undefined,
      };

      mockVersionService.findByName.mockResolvedValue(mockVersion);

      const result = await controller.checkName('V2026.Q1');

      expect(result.exists).toBe(true);
      expect(result.version?.testCyclesCount).toBe(0);
    });

    it('当版本名称不存在时应该返回 exists: false', async () => {
      mockVersionService.findByName.mockResolvedValue(null);

      const result = await controller.checkName('NonExistent');

      expect(result.exists).toBe(false);
      expect(result.version).toBeUndefined();
    });

    it('当名称为空字符串时应该返回 exists: false 且不调用 service', async () => {
      const result = await controller.checkName('');

      expect(result.exists).toBe(false);
      expect(mockVersionService.findByName).not.toHaveBeenCalled();
    });

    it('当名称为 null 时应该返回 exists: false', async () => {
      const result = await controller.checkName(null as any);

      expect(result.exists).toBe(false);
    });
  });

  describe('create', () => {
    it('应该调用 service.create 创建版本', async () => {
      const createDto = {
        name: 'V2026.Q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      };
      const mockResponse = {
        id: 'version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.PLANNING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockVersionService.create.mockResolvedValue(mockResponse);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('createOrUse', () => {
    it('应该调用 service.createOrUse', async () => {
      const createDto = {
        name: 'V2026.Q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        useExisting: true,
      };
      const mockResponse = {
        id: 'version-id',
        name: 'V2026.Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.PLANNING,
        isExisting: true,
        message: '已使用现有版本',
      };

      mockVersionService.createOrUse.mockResolvedValue(mockResponse);

      const result = await controller.createOrUse(createDto);

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.createOrUse).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('应该返回所有版本', async () => {
      const mockVersions = [
        { id: '1', name: 'V2026.Q1', _count: { requirements: 5, issues: 3, testCycles: 2 } },
        { id: '2', name: 'V2026.Q2', _count: { requirements: 2, issues: 1, testCycles: 1 } },
      ];

      mockVersionService.findAll.mockResolvedValue(mockVersions);

      const result = await controller.findAll();

      expect(result).toEqual(mockVersions);
      expect(mockVersionService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('应该返回指定版本', async () => {
      const mockVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockVersionService.findOne.mockResolvedValue(mockVersion);

      const result = await controller.findOne('version-id');

      expect(result).toEqual(mockVersion);
      expect(mockVersionService.findOne).toHaveBeenCalledWith('version-id');
    });
  });

  describe('update', () => {
    it('应该更新版本', async () => {
      const updateDto = { name: 'V2026.Q1-Updated' };
      const mockResponse = {
        id: 'version-id',
        name: 'V2026.Q1-Updated',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: VersionStatus.PLANNING,
      };

      mockVersionService.update.mockResolvedValue(mockResponse);

      const result = await controller.update('version-id', updateDto);

      expect(result).toEqual(mockResponse);
      expect(mockVersionService.update).toHaveBeenCalledWith('version-id', updateDto);
    });
  });

  describe('getCurrentVersion', () => {
    it('应该返回当前版本', async () => {
      const mockVersion = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
      };

      mockVersionService.getCurrentVersion.mockResolvedValue(mockVersion);

      const result = await controller.getCurrentVersion();

      expect(result).toEqual(mockVersion);
    });

    it('当没有当前版本时应该返回 null', async () => {
      mockVersionService.getCurrentVersion.mockResolvedValue(null);

      const result = await controller.getCurrentVersion();

      expect(result).toBeNull();
    });
  });

  describe('getVersionBoard', () => {
    it('应该返回版本看板数据', async () => {
      const mockBoard = {
        id: 'version-id',
        name: 'V2026.Q1',
        testCycles: [],
        requirements: [],
        issues: [],
      };

      mockVersionService.getVersionBoard.mockResolvedValue(mockBoard);

      const result = await controller.getVersionBoard('version-id');

      expect(result).toEqual(mockBoard);
      expect(mockVersionService.getVersionBoard).toHaveBeenCalledWith('version-id');
    });
  });
});
