import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WorkflowStage, IssueStatus, IssueSeverity, UserRole } from '@prisma/client';
import { CreateIssueDto, UpdateIssueDto, UpdateIssueStageDto } from './issue.dto';

@Injectable()
export class IssueService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
  ) {}

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

    await this.workflowService.validateAndLogTransition(
      'issue',
      id,
      issue.currentStage as WorkflowStage,
      dto.stage,
      userId,
      dto.remark,
      undefined,
      id,
    );

    const updateData: Record<string, unknown> = {
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
