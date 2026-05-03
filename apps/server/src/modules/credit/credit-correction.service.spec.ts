import { Test, TestingModule } from '@nestjs/testing';
import { CreditCorrectionService } from './credit-correction.service';
import { CreditRuleService } from './credit-rule.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CorrectRecordDto, BatchCorrectDto } from './credit.dto';
import { CreditSourceType } from '@prisma/client';

describe('CreditCorrectionService', () => {
  let service: CreditCorrectionService;
  let prisma: PrismaService;
  let ruleService: CreditRuleService;

  const mockCreditRecord = {
    id: 'record-1',
    userId: 'user-1',
    score: 5,
    sourceType: CreditSourceType.REQUIREMENT,
    remark: 'test',
    versionId: 'version-1',
    ruleId: 'rule-1',
    delayDays: 0,
    plannedDate: new Date('2026-03-20'),
    actualDate: new Date('2026-03-20'),
    workflowStage: 'FEATURE_DEV',
    isCorrected: false,
    correctedAt: null,
    correctedBy: null,
    correctionRemark: null,
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

  const mockPrismaService = {
    creditRecord: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditCorrection: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    creditSummary: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditRule: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrismaService)),
  };

  const mockRuleService = {
    findByDelayDays: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditCorrectionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CreditRuleService, useValue: mockRuleService },
      ],
    }).compile();

    service = module.get<CreditCorrectionService>(CreditCorrectionService);
    prisma = module.get<PrismaService>(PrismaService);
    ruleService = module.get<CreditRuleService>(CreditRuleService);
  });

  describe('previewCorrection', () => {
    it('should preview correction result', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        plannedDate: '2026-03-20',
        actualDate: '2026-03-22',
        reason: 'date correction',
      };

      const result = await service.previewCorrection(dto);

      expect(result).toHaveProperty('originalScore');
      expect(result).toHaveProperty('newScore');
      expect(result).toHaveProperty('scoreDiff');
      expect(result).toHaveProperty('newDelayDays');
    });

    it('should throw error when record not found', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(null);

      const dto: CorrectRecordDto = {
        recordId: 'non-existent',
        reason: 'test',
      };

      await expect(service.previewCorrection(dto)).rejects.toThrow();
    });

    it('should support direct score override', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 15,
        reason: 'score adjustment',
      };

      const result = await service.previewCorrection(dto);

      expect(result.newScore).toBe(15);
    });
  });

  describe('correctRecord', () => {
    it('should successfully correct a record', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({ id: 'correction-1' });
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        plannedDate: '2026-03-20',
        actualDate: '2026-03-20',
        reason: 'date correction',
      };

      const result = await service.correctRecord(dto, 'admin-1');

      expect(result).toHaveProperty('correction');
      expect(result).toHaveProperty('scoreDiff');
      expect(mockPrismaService.creditCorrection.create).toHaveBeenCalled();
    });

    it('should throw error when record not found', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(null);

      const dto: CorrectRecordDto = {
        recordId: 'non-existent',
        reason: 'test',
      };

      await expect(service.correctRecord(dto, 'admin-1')).rejects.toThrow();
    });

    it('should mark record as corrected', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        reason: 'mark only',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isCorrected: true }),
        }),
      );
    });

    it('should skip summary update when no versionId', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue({
        ...mockCreditRecord,
        versionId: null,
      });
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        reason: 'test',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditSummary.findUnique).not.toHaveBeenCalled();
    });

    it('should support score override', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: CorrectRecordDto = {
        recordId: 'record-1',
        overrideScore: 20,
        reason: 'score override',
      };

      await service.correctRecord(dto, 'admin-1');

      expect(mockPrismaService.creditRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ score: 20 }),
        }),
      );
    });
  });

  describe('batchCorrectRecords', () => {
    it('should correct all records in a single transaction', async () => {
      mockPrismaService.creditRecord.findUnique.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);
      mockPrismaService.creditSummary.findUnique.mockResolvedValue(mockCreditSummary);
      mockPrismaService.creditSummary.update.mockResolvedValue(mockCreditSummary);

      const dto: BatchCorrectDto = {
        corrections: [
          { recordId: 'record-1', reason: 'fix 1' },
          { recordId: 'record-2', reason: 'fix 2' },
        ],
      };

      const result = await service.batchCorrectRecords(dto, 'admin-1');

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should rollback entire batch on any failure', async () => {
      mockPrismaService.creditRecord.findUnique
        .mockResolvedValueOnce(mockCreditRecord)
        .mockResolvedValueOnce(null);

      mockPrismaService.creditRule.findUnique.mockResolvedValue({ id: 'rule-1', score: 10 });
      mockRuleService.findByDelayDays.mockResolvedValue(null);
      mockPrismaService.creditCorrection.create.mockResolvedValue({});
      mockPrismaService.creditRecord.update.mockResolvedValue(mockCreditRecord);

      const dto: BatchCorrectDto = {
        corrections: [
          { recordId: 'record-1', reason: 'fix 1' },
          { recordId: 'record-2', reason: 'fix 2' },
        ],
      };

      await expect(service.batchCorrectRecords(dto, 'admin-1')).rejects.toThrow();
    });
  });

  describe('getCorrectionHistory', () => {
    it('should return correction history', async () => {
      const mockHistory = [
        { id: 'correction-1', recordId: 'record-1', reason: 'fix', scoreDiff: 5, createdAt: new Date() },
      ];
      mockPrismaService.creditCorrection.findMany.mockResolvedValue(mockHistory);

      const result = await service.getCorrectionHistory('record-1');

      expect(mockPrismaService.creditCorrection.findMany).toHaveBeenCalledWith({
        where: { recordId: 'record-1' },
        include: { operator: { select: { id: true, name: true, employeeNo: true } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no history', async () => {
      mockPrismaService.creditCorrection.findMany.mockResolvedValue([]);

      const result = await service.getCorrectionHistory('record-1');

      expect(result).toEqual([]);
    });
  });
});
