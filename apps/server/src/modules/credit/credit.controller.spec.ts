import { Test, TestingModule } from '@nestjs/testing';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { CreditCorrectionService } from './credit-correction.service';
import { CorrectRecordDto, BatchCorrectDto, CreateCreditRuleDto } from './credit.dto';
import { CreditRuleService } from './credit-rule.service';
import { CreditSourceType, CreditRuleType, UserRole } from '@prisma/client';

describe('CreditController', () => {
  let controller: CreditController;
  let creditService: CreditService;
  let correctionService: CreditCorrectionService;
  let ruleService: CreditRuleService;

  const mockCreditService = {
    getUserRecords: jest.fn(),
    manualAdjust: jest.fn(),
    getUserSummary: jest.fn(),
    getAllSummaries: jest.fn(),
    getUserCreditDetail: jest.fn(),
    checkVersionDelayPenalty: jest.fn(),
  };

  const mockCorrectionService = {
    previewCorrection: jest.fn(),
    correctRecord: jest.fn(),
    batchCorrectRecords: jest.fn(),
    getCorrectionHistory: jest.fn(),
  };

  const mockRuleService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    initDefaultRules: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-1',
      username: 'testuser',
      role: UserRole.PM,
      name: '测试用户',
    },
  };

  const mockRule = {
    id: 'rule-1',
    ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
    name: '需求完成',
    description: '按期完成需求',
    score: 10,
    delayDays: null,
    isCustom: false,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreditRecord = {
    id: 'record-1',
    userId: 'user-1',
    score: 10,
    sourceType: CreditSourceType.REQUIREMENT,
    remark: '按期完成需求',
    versionId: 'version-1',
    createdAt: new Date(),
  };

  const mockCreditSummary = {
    id: 'summary-1',
    userId: 'user-1',
    versionId: 'version-1',
    totalScore: 100,
    requirementScore: 80,
    issueScore: 20,
    delayDeduction: 0,
    manualAdjustment: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditController],
      providers: [
        {
          provide: CreditService,
          useValue: mockCreditService,
        },
        {
          provide: CreditCorrectionService,
          useValue: mockCorrectionService,
        },
        {
          provide: CreditRuleService,
          useValue: mockRuleService,
        },
      ],
    }).compile();

    controller = module.get<CreditController>(CreditController);
    creditService = module.get<CreditService>(CreditService);
    correctionService = module.get<CreditCorrectionService>(CreditCorrectionService);
    ruleService = module.get<CreditRuleService>(CreditRuleService);
  });

  // ===== 信用规则测试 =====

  describe('createRule', () => {
    const createDto: CreateCreditRuleDto = {
      ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
      name: '需求完成',
      description: '按期完成需求',
      score: 10,
    };

    it('应该成功创建信用规则', async () => {
      mockRuleService.create.mockResolvedValue(mockRule);

      const result = await controller.createRule(createDto, mockRequest);

      expect(result).toEqual(mockRule);
      expect(ruleService.create).toHaveBeenCalledWith(createDto, 'user-1');
    });
  });

  describe('findAllRules', () => {
    it('应该返回所有信用规则', async () => {
      mockRuleService.findAll.mockResolvedValue([mockRule]);

      const result = await controller.findAllRules();

      expect(result).toEqual([mockRule]);
      expect(ruleService.findAll).toHaveBeenCalled();
    });
  });

  describe('updateRule', () => {
    it('应该成功更新信用规则', async () => {
      mockRuleService.update.mockResolvedValue({
        ...mockRule,
        score: 15,
      });

      const result = await controller.updateRule('rule-1', { score: 15 });

      expect(result.score).toBe(15);
      expect(ruleService.update).toHaveBeenCalledWith('rule-1', { score: 15 });
    });
  });

  describe('removeRule', () => {
    it('应该成功删除信用规则', async () => {
      mockRuleService.remove.mockResolvedValue(mockRule);

      const result = await controller.removeRule('rule-1');

      expect(result).toEqual(mockRule);
      expect(ruleService.remove).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('initDefaultRules', () => {
    it('应该初始化默认规则', async () => {
      mockRuleService.initDefaultRules.mockResolvedValue(undefined);

      const result = await controller.initDefaultRules(mockRequest);

      expect(result.message).toBe('默认规则初始化完成');
      expect(ruleService.initDefaultRules).toHaveBeenCalledWith('user-1');
    });
  });

  // ===== 信用记录测试 =====

  describe('getUserRecords', () => {
    it('PM 应该能查看所有人的记录', async () => {
      mockCreditService.getUserRecords.mockResolvedValue([mockCreditRecord]);

      const result = await controller.getUserRecords('version-1', 'user-2', mockRequest);

      expect(result).toEqual([mockCreditRecord]);
      expect(creditService.getUserRecords).toHaveBeenCalledWith('user-2', 'version-1');
    });

    it('PM 不指定 userId 时应该查看自己的记录', async () => {
      mockCreditService.getUserRecords.mockResolvedValue([mockCreditRecord]);

      await controller.getUserRecords('version-1', undefined, mockRequest);

      expect(creditService.getUserRecords).toHaveBeenCalledWith('user-1', 'version-1');
    });

    it('MEMBER 只能查看自己的记录', async () => {
      mockCreditService.getUserRecords.mockResolvedValue([mockCreditRecord]);

      const memberRequest = {
        user: { id: 'user-1', role: UserRole.MEMBER },
      };

      await controller.getUserRecords('version-1', 'user-2', memberRequest);

      expect(creditService.getUserRecords).toHaveBeenCalledWith('user-1', 'version-1');
    });

    it('应该支持不传 versionId', async () => {
      mockCreditService.getUserRecords.mockResolvedValue([mockCreditRecord]);

      await controller.getUserRecords(undefined, undefined, mockRequest);

      expect(creditService.getUserRecords).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('manualAdjust', () => {
    it('应该成功进行手动调整', async () => {
      mockCreditService.manualAdjust.mockResolvedValue(mockCreditRecord);

      const data = {
        userId: 'user-1',
        versionId: 'version-1',
        score: 5,
        remark: '表现优秀',
      };

      const result = await controller.manualAdjust(data, mockRequest);

      expect(result).toEqual(mockCreditRecord);
      expect(creditService.manualAdjust).toHaveBeenCalledWith(
        'user-1',
        'version-1',
        5,
        '表现优秀',
        '测试用户'
      );
    });
  });

  // ===== 信用汇总测试 =====

  describe('getUserSummary', () => {
    it('应该返回用户信用汇总', async () => {
      mockCreditService.getUserSummary.mockResolvedValue(mockCreditSummary);

      const result = await controller.getUserSummary('version-1', mockRequest);

      expect(result).toEqual(mockCreditSummary);
      expect(creditService.getUserSummary).toHaveBeenCalledWith('user-1', 'version-1');
    });
  });

  describe('getAllSummaries', () => {
    it('应该返回所有用户汇总', async () => {
      mockCreditService.getAllSummaries.mockResolvedValue([mockCreditSummary]);

      const result = await controller.getAllSummaries('version-1');

      expect(result).toEqual([mockCreditSummary]);
      expect(creditService.getAllSummaries).toHaveBeenCalledWith('version-1');
    });
  });

  // ===== 信用详情测试 =====

  describe('getUserCreditDetail', () => {
    it('应该返回用户信用详情', async () => {
      mockCreditService.getUserCreditDetail.mockResolvedValue({
        user: { id: 'user-1', name: '张三' },
        summary: mockCreditSummary,
        records: [mockCreditRecord],
        stageStats: [],
      });

      const result = await controller.getUserCreditDetail('user-1', 'version-1');

      expect(result.user.id).toBe('user-1');
      expect(creditService.getUserCreditDetail).toHaveBeenCalledWith('user-1', 'version-1');
    });
  });

  // ===== 矫正功能测试 =====

  describe('previewCorrection', () => {
    const dto: CorrectRecordDto = {
      recordId: 'record-1',
      reason: '测试',
    };

    it('应该预览矫正效果', async () => {
      mockCorrectionService.previewCorrection.mockResolvedValue({
        originalScore: 5,
        newScore: 10,
        scoreDiff: 5,
        newDelayDays: 0,
        originalDelayDays: 2,
      });

      const result = await controller.previewCorrection(dto);

      expect(result.scoreDiff).toBe(5);
      expect(correctionService.previewCorrection).toHaveBeenCalledWith(dto);
    });
  });

  describe('correctRecord', () => {
    const dto: CorrectRecordDto = {
      recordId: 'record-1',
      reason: '日期修正',
    };

    it('应该成功矫正记录', async () => {
      mockCorrectionService.correctRecord.mockResolvedValue({
        correction: {},
        scoreDiff: 5,
        message: '已补回 5 分',
      });

      const result = await controller.correctRecord(dto, mockRequest);

      expect(result.message).toBe('已补回 5 分');
      expect(correctionService.correctRecord).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('batchCorrectRecords', () => {
    const dto: BatchCorrectDto = {
      corrections: [
        { recordId: 'record-1', reason: '修正1' },
        { recordId: 'record-2', reason: '修正2' },
      ],
    };

    it('应该批量矫正记录', async () => {
      mockCorrectionService.batchCorrectRecords.mockResolvedValue({
        success: 2,
        failed: 0,
        results: [],
      });

      const result = await controller.batchCorrectRecords(dto, mockRequest);

      expect(result.success).toBe(2);
      expect(correctionService.batchCorrectRecords).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('getCorrectionHistory', () => {
    it('应该返回矫正历史', async () => {
      mockCorrectionService.getCorrectionHistory.mockResolvedValue([]);

      const result = await controller.getCorrectionHistory('record-1');

      expect(result).toEqual([]);
      expect(correctionService.getCorrectionHistory).toHaveBeenCalledWith('record-1');
    });
  });

  // ===== 版本延期率检查测试 =====

  describe('checkVersionDelayPenalty', () => {
    it('应该检查版本延期率', async () => {
      mockCreditService.checkVersionDelayPenalty.mockResolvedValue({
        totalItems: 10,
        delayedItems: 3,
        delayRate: 30,
        shouldPenalize: false,
      });

      const result = await controller.checkVersionDelayPenalty('version-1');

      expect(result.delayRate).toBe(30);
      expect(creditService.checkVersionDelayPenalty).toHaveBeenCalledWith('version-1');
    });
  });
});

describe('Credit Controller DTO 验证', () => {
  it('CreateCreditRuleDto 应该包含必要字段', () => {
    const dto: CreateCreditRuleDto = {
      ruleType: CreditRuleType.REQUIREMENT_COMPLETE,
      name: '需求完成',
      description: '按期完成需求',
      score: 10,
    };

    expect(dto.ruleType).toBe(CreditRuleType.REQUIREMENT_COMPLETE);
    expect(dto.name).toBe('需求完成');
    expect(dto.score).toBe(10);
  });

  it('CorrectRecordDto 应该包含必要字段', () => {
    const dto: CorrectRecordDto = {
      recordId: 'record-1',
      reason: '修正原因',
    };

    expect(dto.recordId).toBe('record-1');
    expect(dto.reason).toBe('修正原因');
  });

  it('BatchCorrectDto 应该包含 corrections 数组', () => {
    const dto: BatchCorrectDto = {
      corrections: [
        { recordId: 'record-1', reason: '修正1' },
      ],
    };

    expect(dto.corrections).toHaveLength(1);
  });
});
