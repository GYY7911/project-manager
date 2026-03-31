import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VersionStatus } from '@prisma/client';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export interface CreateVersionDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface CreateOrUseVersionDto extends CreateVersionDto {
  useExisting?: boolean; // 如果版本已存在，是否使用现有版本
}

export interface UpdateVersionDto {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: VersionStatus;
}

export interface DeleteVersionResponse {
  id: string;
  name: string;
  deleted: {
    requirements: number;
    issues: number;
    testCycles: number;
    creditRecords: number;
    workflowLogs: number;
    delayConfigs: number;
    creditSummaries: number;
  };
}

@Injectable()
export class VersionService {
  constructor(private prisma: PrismaService) {}

  /**
   * 根据名称查找版本
   */
  async findByName(name: string) {
    return this.prisma.version.findUnique({
      where: { name },
      include: {
        testCycles: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            requirements: true,
            issues: true,
          },
        },
      },
    });
  }

  /**
   * 创建版本，支持使用已存在的版本
   * @param dto 创建参数
   * @returns 版本信息和是否为已存在的版本
   */
  async createOrUse(dto: CreateOrUseVersionDto) {
    const existing = await this.prisma.version.findUnique({
      where: { name: dto.name },
      include: {
        testCycles: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            requirements: true,
            issues: true,
          },
        },
      },
    });

    if (existing) {
      // 如果用户选择使用现有版本
      if (dto.useExisting) {
        return {
          ...existing,
          isExisting: true,
          message: `已使用现有版本「${existing.name}」`,
        };
      }

      // 否则返回冲突信息，包含现有版本的详细信息
      throw new ConflictException({
        message: '版本名称已存在',
        existingVersion: {
          id: existing.id,
          name: existing.name,
          startDate: existing.startDate,
          endDate: existing.endDate,
          status: existing.status,
          testCyclesCount: existing.testCycles?.length || 0,
          requirementsCount: existing._count.requirements,
          issuesCount: existing._count.issues,
        },
      });
    }

    // 创建新版本
    const parsedStartDate = parseISO(dto.startDate);
    const parsedEndDate = parseISO(dto.endDate);

    const version = await this.prisma.version.create({
      data: {
        name: dto.name,
        startDate: startOfDay(parsedStartDate),
        endDate: endOfDay(parsedEndDate),
      },
    });

    return {
      ...version,
      isExisting: false,
      message: `版本「${version.name}」创建成功`,
    };
  }

  async create(dto: CreateVersionDto) {
    const existing = await this.prisma.version.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('版本名称已存在');
    }

    // 使用 parseISO 解析日期字符串
    const parsedStartDate = parseISO(dto.startDate);
    const parsedEndDate = parseISO(dto.endDate);

    return this.prisma.version.create({
      data: {
        name: dto.name,
        startDate: startOfDay(parsedStartDate),
        endDate: endOfDay(parsedEndDate),
      },
    });
  }

  async findAll() {
    return this.prisma.version.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: {
            requirements: true,
            issues: true,
            testCycles: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const version = await this.prisma.version.findUnique({
      where: { id },
      include: {
        testCycles: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return version;
  }

  async update(id: string, dto: UpdateVersionDto) {
    await this.findOne(id);

    const updateData: any = { ...dto };
    if (dto.startDate) {
      const parsedStartDate = parseISO(dto.startDate);
      updateData.startDate = startOfDay(parsedStartDate);
    }
    if (dto.endDate) {
      const parsedEndDate = parseISO(dto.endDate);
      updateData.endDate = endOfDay(parsedEndDate);
    }

    return this.prisma.version.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, force: boolean = false): Promise<DeleteVersionResponse | any> {
    const version = await this.findOne(id);

    // 检查关联数据
    const [requirements, issues, testCycles] = await Promise.all([
      this.prisma.requirement.count({ where: { versionId: id } }),
      this.prisma.issue.count({ where: { versionId: id } }),
      this.prisma.testCycle.count({ where: { versionId: id } }),
    ]);

    const hasRelations = requirements > 0 || issues > 0 || testCycles > 0;

    if (hasRelations && !force) {
      throw new BadRequestException({
        message: '无法删除：该版本下存在关联数据',
        details: { requirements, issues, testCycles },
        hint: '如需删除版本及其所有关联数据，请使用强制删除选项',
      });
    }

    // 无关联数据或强制删除
    if (!hasRelations) {
      return this.prisma.version.delete({
        where: { id },
      });
    }

    // 强制删除 - 级联删除所有关联数据
    // 获取需求ID和问题单ID列表
    const requirementIds = requirements > 0
      ? (await this.prisma.requirement.findMany({ where: { versionId: id }, select: { id: true } })).map(r => r.id)
      : [];
    const issueIds = issues > 0
      ? (await this.prisma.issue.findMany({ where: { versionId: id }, select: { id: true } })).map(i => i.id)
      : [];

    return this.prisma.$transaction(async (tx) => {
      let deletedWorkflowLogs = 0;
      let deletedCreditRecords = 0;

      // 1. 删除需求和工作流日志相关的 CreditRecord
      if (requirementIds.length > 0) {
        deletedCreditRecords += await tx.creditRecord.deleteMany({
          where: { requirementId: { in: requirementIds } },
        }).then(r => r.count);

        deletedWorkflowLogs += await tx.workflowLog.deleteMany({
          where: { requirementId: { in: requirementIds } },
        }).then(r => r.count);
      }

      // 2. 删除问题单和工作流日志相关的 CreditRecord
      if (issueIds.length > 0) {
        deletedCreditRecords += await tx.creditRecord.deleteMany({
          where: { issueId: { in: issueIds } },
        }).then(r => r.count);

        deletedWorkflowLogs += await tx.workflowLog.deleteMany({
          where: { issueId: { in: issueIds } },
        }).then(r => r.count);
      }

      // 3. 删除问题单
      const deletedIssues = await tx.issue.deleteMany({
        where: { versionId: id },
      }).then(r => r.count);

      // 4. 删除 CreditRecord（直接关联版本的）
      deletedCreditRecords += await tx.creditRecord.deleteMany({
        where: { versionId: id },
      }).then(r => r.count);

      // 5. 删除 Requirement
      const deletedRequirements = await tx.requirement.deleteMany({
        where: { versionId: id },
      }).then(r => r.count);

      // 6. 删除 TestCycle
      const deletedTestCycles = await tx.testCycle.deleteMany({
        where: { versionId: id },
      }).then(r => r.count);

      // 7. 删除 DelayConfig（必须在 Version 之前删除）
      const deletedDelayConfigs = await tx.delayConfig.deleteMany({
        where: { versionId: id },
      }).then(r => r.count);

      // 8. 删除 CreditSummary（必须在 Version 之前删除）
      const deletedCreditSummaries = await tx.creditSummary.deleteMany({
        where: { versionId: id },
      }).then(r => r.count);

      // 9. 删除 Version
      await tx.version.delete({
        where: { id },
      });

      return {
        id,
        name: version.name,
        deleted: {
          requirements: deletedRequirements,
          issues: deletedIssues,
          testCycles: deletedTestCycles,
          creditRecords: deletedCreditRecords,
          workflowLogs: deletedWorkflowLogs,
          delayConfigs: deletedDelayConfigs,
          creditSummaries: deletedCreditSummaries,
        },
      };
    });
  }

  async getCurrentVersion() {
    const now = new Date();
    return this.prisma.version.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        testCycles: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getVersionBoard(versionId: string) {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
      include: {
        testCycles: {
          orderBy: { order: 'asc' },
        },
        requirements: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                employeeNo: true,
              },
            },
          },
        },
        issues: {
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
        },
      },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return version;
  }
}
