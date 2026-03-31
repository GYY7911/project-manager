import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage, IssueStatus, IssueSeverity, UserRole } from '@prisma/client';

export interface CreateIssueDto {
  code: string;
  title: string;
  description?: string;
  severity?: IssueSeverity;
  versionId: string;
  assigneeId: string;
  requirementId?: string;
  testCycleId?: string;
  dueDate?: string;
}

export interface UpdateIssueDto {
  title?: string;
  description?: string;
  severity?: IssueSeverity;
  assigneeId?: string;
  testCycleId?: string;
  dueDate?: string;
}

export interface UpdateIssueStageDto {
  stage: WorkflowStage;
  remark?: string;
  ccbApproved?: boolean;
}

@Injectable()
export class IssueService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIssueDto) {
    return this.prisma.issue.create({
      data: {
        code: dto.code,
        title: dto.title,
        description: dto.description,
        severity: dto.severity || IssueSeverity.MEDIUM,
        versionId: dto.versionId,
        assigneeId: dto.assigneeId,
        requirementId: dto.requirementId,
        testCycleId: dto.testCycleId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: IssueStatus.OPEN,
        ccbApproved: false,
      },
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
    });
  }

  async findAll(versionId?: string, testCycleId?: string) {
    const where: any = {};
    if (versionId) where.versionId = versionId;
    if (testCycleId) where.testCycleId = testCycleId;

    return this.prisma.issue.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
        testCycle: true,
        requirement: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
        testCycle: true,
        version: true,
        requirement: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
        workflowLogs: {
          include: {
            operator: {
              select: {
                id: true,
                name: true,
                employeeNo: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('问题单不存在');
    }

    return issue;
  }

  async update(id: string, dto: UpdateIssueDto) {
    await this.findOne(id);

    return this.prisma.issue.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
      },
    });
  }

  async updateStage(
    id: string,
    dto: UpdateIssueStageDto,
    userId: string,
    userRole: UserRole,
  ) {
    const issue = await this.findOne(id);

    // 组员只能修改自己负责的问题单
    if (userRole === UserRole.MEMBER && issue.assigneeId !== userId) {
      throw new ForbiddenException('您只能修改自己负责的问题单');
    }

    // 记录工作流日志
    await this.prisma.workflowLog.create({
      data: {
        entityType: 'issue',
        entityId: id,
        fromStage: issue.currentStage as WorkflowStage,
        toStage: dto.stage,
        operatedBy: userId,
        remark: dto.remark,
        issueId: id,
      },
    });

    // 更新阶段、状态和CCB标志
    const updateData: any = {
      currentStage: dto.stage,
    };

    if (dto.stage === WorkflowStage.CCB_REVIEW || dto.stage === WorkflowStage.RELEASE) {
      updateData.ccbApproved = dto.ccbApproved ?? issue.ccbApproved;
    }

    if (dto.stage === WorkflowStage.RELEASE) {
      updateData.status = IssueStatus.CLOSED;
    } else if (dto.stage === WorkflowStage.ISSUE_FIX) {
      updateData.status = IssueStatus.IN_PROGRESS;
    }

    return this.prisma.issue.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
      },
    });
  }

  async updateCcbStatus(id: string, ccbApproved: boolean) {
    await this.findOne(id);

    return this.prisma.issue.update({
      where: { id },
      data: { ccbApproved },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.issue.delete({
      where: { id },
    });
  }

  async generateCode(versionId: string): Promise<string> {
    const date = new Date();
    const dateStr =
      date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');

    const count = await this.prisma.issue.count({
      where: {
        code: {
          startsWith: `ISSUE${dateStr}`,
        },
      },
    });

    return `ISSUE${dateStr}${(count + 1).toString().padStart(3, '0')}`;
  }

  async duplicate(id: string) {
    const original = await this.findOne(id);

    // Generate new code
    const newCode = await this.generateCode(original.versionId);

    // Create duplicate with "- 副本" suffix
    return this.prisma.issue.create({
      data: {
        code: newCode,
        title: `${original.title} - 副本`,
        description: original.description,
        severity: original.severity,
        versionId: original.versionId,
        assigneeId: original.assigneeId,
        requirementId: original.requirementId,
        testCycleId: original.testCycleId,
        dueDate: original.dueDate,
        status: IssueStatus.OPEN,
        ccbApproved: false,
      },
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
    });
  }
}
