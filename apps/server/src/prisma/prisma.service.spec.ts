import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  describe('onModuleInit', () => {
    it('应该调用 $connect', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('应该调用 $disconnect', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('PrismaClient 继承', () => {
    it('应该有 PrismaClient 的 user 属性', () => {
      expect(service.user).toBeDefined();
      expect(typeof service.user.findMany).toBe('function');
      expect(typeof service.user.findUnique).toBe('function');
      expect(typeof service.user.create).toBe('function');
      expect(typeof service.user.update).toBe('function');
      expect(typeof service.user.delete).toBe('function');
    });

    it('应该有 PrismaClient 的 version 属性', () => {
      expect(service.version).toBeDefined();
      expect(typeof service.version.findMany).toBe('function');
      expect(typeof service.version.findUnique).toBe('function');
    });

    it('应该有 PrismaClient 的 requirement 属性', () => {
      expect(service.requirement).toBeDefined();
      expect(typeof service.requirement.findMany).toBe('function');
      expect(typeof service.requirement.findUnique).toBe('function');
    });

    it('应该有 PrismaClient 的 issue 属性', () => {
      expect(service.issue).toBeDefined();
      expect(typeof service.issue.findMany).toBe('function');
      expect(typeof service.issue.findUnique).toBe('function');
    });

    it('应该有 PrismaClient 的 creditRecord 属性', () => {
      expect(service.creditRecord).toBeDefined();
      expect(typeof service.creditRecord.findMany).toBe('function');
    });

    it('应该有 PrismaClient 的 workflowLog 属性', () => {
      expect(service.workflowLog).toBeDefined();
      expect(typeof service.workflowLog.findMany).toBe('function');
    });

    it('应该有 PrismaClient 的 delayConfig 属性', () => {
      expect(service.delayConfig).toBeDefined();
      expect(typeof service.delayConfig.findMany).toBe('function');
    });

    it('应该有 PrismaClient 的 testCycle 属性', () => {
      expect(service.testCycle).toBeDefined();
      expect(typeof service.testCycle.findMany).toBe('function');
    });

    it('应该有 $connect 方法', () => {
      expect(typeof service.$connect).toBe('function');
    });

    it('应该有 $disconnect 方法', () => {
      expect(typeof service.$disconnect).toBe('function');
    });

    it('应该有 $transaction 方法', () => {
      expect(typeof service.$transaction).toBe('function');
    });
  });
});
