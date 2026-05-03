import { Test, TestingModule } from '@nestjs/testing';
import { IssueController } from './issue.controller';
import { IssueService } from './issue.service';
import { CreateIssueDto, UpdateIssueDto, UpdateIssueStageDto } from './issue.dto';
import { WorkflowStage, IssueStatus, IssueSeverity, UserRole } from '@prisma/client';

describe('IssueController', () => {
  let controller: IssueController;
  let service: IssueService;

  const mockIssueService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    generateCode: jest.fn(),
    update: jest.fn(),
    updateStage: jest.fn(),
    updateCcbStatus: jest.fn(),
    remove: jest.fn(),
    duplicate: jest.fn(),
  };

  const mockIssue = {
    id: 'issue-1',
    code: 'ISSUE20260322001',
    title: '登录页面无法显示',
    description: '用户反馈登录页面白屏',
    severity: IssueSeverity.HIGH,
    status: IssueStatus.OPEN,
    currentStage: WorkflowStage.ISSUE_FIX,
    ccbApproved: false,
    versionId: 'version-1',
    assigneeId: 'user-1',
    requirementId: null,
    testCycleId: 'tc-1',
    dueDate: new Date('2026-03-25'),
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: {
      id: 'user-1',
      name: '张三',
      employeeNo: 'z001',
    },
    testCycle: {
      id: 'tc-1',
      name: 'SIT1',
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
      controllers: [IssueController],
      providers: [
        {
          provide: IssueService,
          useValue: mockIssueService,
        },
      ],
    }).compile();

    controller = module.get<IssueController>(IssueController);
    service = module.get<IssueService>(IssueService);
  });

  describe('create', () => {
    const createDto: CreateIssueDto = {
      code: 'ISSUE20260322001',
      title: '登录页面无法显示',
      description: '用户反馈登录页面白屏',
      severity: IssueSeverity.HIGH,
      versionId: 'version-1',
      assigneeId: 'user-1',
      testCycleId: 'tc-1',
      dueDate: '2026-03-25',
    };

    it('应该成功创建问题单', async () => {
      mockIssueService.create.mockResolvedValue(mockIssue);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockIssue);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('创建失败时应该抛出异常', async () => {
      const error = new Error('创建失败');
      mockIssueService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toThrow('创建失败');
    });
  });

  describe('findAll', () => {
    it('应该返回所有问题单', async () => {
      mockIssueService.findAll.mockResolvedValue([mockIssue]);

      const result = await controller.findAll();

      expect(result).toEqual([mockIssue]);
      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('应该根据 versionId 过滤', async () => {
      mockIssueService.findAll.mockResolvedValue([mockIssue]);

      await controller.findAll('version-1');

      expect(service.findAll).toHaveBeenCalledWith('version-1', undefined);
    });

    it('应该根据 testCycleId 过滤', async () => {
      mockIssueService.findAll.mockResolvedValue([mockIssue]);

      await controller.findAll(undefined, 'tc-1');

      expect(service.findAll).toHaveBeenCalledWith(undefined, 'tc-1');
    });

    it('应该同时根据 versionId 和 testCycleId 过滤', async () => {
      mockIssueService.findAll.mockResolvedValue([mockIssue]);

      await controller.findAll('version-1', 'tc-1');

      expect(service.findAll).toHaveBeenCalledWith('version-1', 'tc-1');
    });
  });

  describe('generateCode', () => {
    it('应该生成问题单编码', async () => {
      mockIssueService.generateCode.mockResolvedValue('ISSUE20260322001');

      const result = await controller.generateCode('version-1');

      expect(result.code).toBe('ISSUE20260322001');
      expect(service.generateCode).toHaveBeenCalledWith('version-1');
    });
  });

  describe('findOne', () => {
    it('应该返回指定问题单', async () => {
      mockIssueService.findOne.mockResolvedValue(mockIssue);

      const result = await controller.findOne('issue-1');

      expect(result).toEqual(mockIssue);
      expect(service.findOne).toHaveBeenCalledWith('issue-1');
    });
  });

  describe('update', () => {
    const updateDto: UpdateIssueDto = {
      title: '更新后的问题标题',
    };

    it('应该成功更新问题单', async () => {
      mockIssueService.update.mockResolvedValue({
        ...mockIssue,
        title: '更新后的问题标题',
      });

      const result = await controller.update('issue-1', updateDto);

      expect(result.title).toBe('更新后的问题标题');
      expect(service.update).toHaveBeenCalledWith('issue-1', updateDto);
    });
  });

  describe('updateStage', () => {
    const updateStageDto: UpdateIssueStageDto = {
      stage: WorkflowStage.CCB_REVIEW,
      remark: '修复完成',
    };

    it('应该成功更新问题单阶段', async () => {
      mockIssueService.updateStage.mockResolvedValue({
        ...mockIssue,
        currentStage: WorkflowStage.CCB_REVIEW,
      });

      const result = await controller.updateStage('issue-1', updateStageDto, mockRequest);

      expect(result.currentStage).toBe(WorkflowStage.CCB_REVIEW);
      expect(service.updateStage).toHaveBeenCalledWith(
        'issue-1',
        updateStageDto,
        'user-1',
        UserRole.PM
      );
    });

    it('应该传递操作人 ID 和角色给服务', async () => {
      mockIssueService.updateStage.mockResolvedValue(mockIssue);

      const memberRequest = {
        user: { id: 'user-2', role: UserRole.MEMBER },
      };

      await controller.updateStage('issue-1', updateStageDto, memberRequest);

      expect(service.updateStage).toHaveBeenCalledWith(
        'issue-1',
        updateStageDto,
        'user-2',
        UserRole.MEMBER
      );
    });
  });

  describe('updateCcbStatus', () => {
    it('应该成功更新 CCB 状态', async () => {
      mockIssueService.updateCcbStatus.mockResolvedValue({
        ...mockIssue,
        ccbApproved: true,
      });

      const result = await controller.updateCcbStatus('issue-1', true);

      expect(result.ccbApproved).toBe(true);
      expect(service.updateCcbStatus).toHaveBeenCalledWith('issue-1', true);
    });

    it('应该支持设置为 false', async () => {
      mockIssueService.updateCcbStatus.mockResolvedValue({
        ...mockIssue,
        ccbApproved: false,
      });

      const result = await controller.updateCcbStatus('issue-1', false);

      expect(service.updateCcbStatus).toHaveBeenCalledWith('issue-1', false);
    });
  });

  describe('remove', () => {
    it('应该成功删除问题单', async () => {
      mockIssueService.remove.mockResolvedValue(mockIssue);

      const result = await controller.remove('issue-1');

      expect(result).toEqual(mockIssue);
      expect(service.remove).toHaveBeenCalledWith('issue-1');
    });
  });

  describe('duplicate', () => {
    it('应该成功复制问题单', async () => {
      mockIssueService.duplicate.mockResolvedValue({
        ...mockIssue,
        id: 'issue-2',
        title: '登录页面无法显示 - 副本',
      });

      const result = await controller.duplicate('issue-1');

      expect(result.title).toBe('登录页面无法显示 - 副本');
      expect(service.duplicate).toHaveBeenCalledWith('issue-1');
    });
  });
});

describe('Issue Controller DTO 验证', () => {
  it('CreateIssueDto 应该包含所有必要字段', () => {
    const dto: CreateIssueDto = {
      code: 'ISSUE001',
      title: '问题标题',
      description: '问题描述',
      severity: IssueSeverity.HIGH,
      versionId: 'version-1',
      assigneeId: 'user-1',
      requirementId: 'req-1',
      testCycleId: 'tc-1',
      dueDate: '2026-03-25',
    };

    expect(dto.code).toBe('ISSUE001');
    expect(dto.title).toBe('问题标题');
    expect(dto.versionId).toBe('version-1');
    expect(dto.assigneeId).toBe('user-1');
  });

  it('UpdateIssueDto 所有字段都应该是可选的', () => {
    const dto: UpdateIssueDto = {
      title: '新标题',
    };

    expect(dto.title).toBe('新标题');
    expect(dto.description).toBeUndefined();
  });

  it('UpdateIssueStageDto 应该包含 stage 和可选的 remark', () => {
    const dto: UpdateIssueStageDto = {
      stage: WorkflowStage.ISSUE_FIX,
      remark: '备注',
      ccbApproved: true,
    };

    expect(dto.stage).toBe(WorkflowStage.ISSUE_FIX);
    expect(dto.remark).toBe('备注');
    expect(dto.ccbApproved).toBe(true);
  });
});
