import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WorkflowStage, RequirementStatus, UserRole } from '@prisma/client';
import { CreateRequirementDto, UpdateRequirementDto, UpdateStageDto } from './requirement.dto';

@Injectable()
export class RequirementService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
  ) {}

  async create(dto: CreateRequirementDto) {
    try {
      return await this.prisma.requirement.create({
        data: {
          code: dto.code,
          title: dto.title,
          description: dto.description,
          type: dto.type,
          versionId: dto.versionId,
          assigneeId: dto.assigneeId,
          workload: dto.workload,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          currentStage: WorkflowStage.REQUIREMENT_DESIGN,
          status: RequirementStatus.DRAFT,
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
    } catch (error: any) {
      console.error('Failed to create requirement:', {
        error: error.message,
        code: error.code,
        meta: error.meta,
        dto: { ...dto, workload: dto.workload, dueDate: dto.dueDate },
      });
      throw error;
    }
  }

  async findAll(versionId?: string, userRole?: UserRole) {
    const where = versionId ? { versionId } : {};

    const requirements = await this.prisma.requirement.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 组员看不到workload
    if (userRole === UserRole.MEMBER) {
      return requirements.map((r) => {
        const { workload, ...rest } = r;
        return rest;
      });
    }

    return requirements;
  }

  async findOne(id: string, userRole?: UserRole) {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
        version: true,
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

    if (!requirement) {
      throw new NotFoundException('需求不存在');
    }

    // 组员看不到workload
    if (userRole === UserRole.MEMBER) {
      const { workload, ...rest } = requirement;
      return rest;
    }

    return requirement;
  }

  async update(id: string, dto: UpdateRequirementDto) {
    await this.findOne(id);

    return this.prisma.requirement.update({
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
    dto: UpdateStageDto,
    userId: string,
    userRole: UserRole,
  ) {
    const requirement = await this.findOne(id);

    // 组员只能修改自己负责的需求
    if (userRole === UserRole.MEMBER && requirement.assigneeId !== userId) {
      throw new ForbiddenException('您只能修改自己负责的需求');
    }

    await this.workflowService.validateAndLogTransition(
      'requirement',
      id,
      requirement.currentStage,
      dto.stage,
      userId,
      dto.remark,
      id,
    );

    const status = this.getStatusByStage(dto.stage);

    return this.prisma.requirement.update({
      where: { id },
      data: {
        currentStage: dto.stage,
        status,
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

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.requirement.delete({
      where: { id },
    });
  }

  private getStatusByStage(stage: WorkflowStage): RequirementStatus {
    if (stage === WorkflowStage.RELEASE) {
      return RequirementStatus.COMPLETED;
    }
    if (stage === WorkflowStage.DOCUMENT_SIGN) {
      return RequirementStatus.IN_PROGRESS;
    }
    return RequirementStatus.IN_PROGRESS;
  }

  async generateCode(versionId: string): Promise<string> {
    const date = new Date();
    const dateStr =
      date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');

    const count = await this.prisma.requirement.count({
      where: {
        code: {
          startsWith: `FE${dateStr}`,
        },
      },
    });

    return `FE${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }

  async duplicate(id: string) {
    const original = await this.findOne(id);

    // Generate new code
    const newCode = await this.generateCode(original.versionId);

    // Cast to access workload (scalar field included by Prisma but not inferred in return type)
    const { workload, dueDate } = original as typeof original & { workload: number | null; dueDate: Date | null };

    // Create duplicate with "- 副本" suffix
    return this.prisma.requirement.create({
      data: {
        code: newCode,
        title: `${original.title} - 副本`,
        description: original.description,
        type: original.type,
        versionId: original.versionId,
        assigneeId: original.assigneeId,
        workload,
        dueDate,
        currentStage: WorkflowStage.REQUIREMENT_DESIGN,
        status: RequirementStatus.DRAFT,
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
}
