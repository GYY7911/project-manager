import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage } from '@prisma/client';
import { CreateDelayConfigDto, BatchImportDto, StageDeadlineDto } from './delay-config.dto';

@Injectable()
export class DelayConfigService {
  constructor(private prisma: PrismaService) {}

  /**
   * 记录计划变更日志
   */
  private async logChange(params: {
    entityType: 'requirement' | 'issue';
    entityId: string;
    changeType: string;
    oldValue: any;
    newValue: any;
    reason: string;
    operatedBy: string;
  }) {
    await this.prisma.planChangeLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        changeType: params.changeType,
        oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        reason: params.reason || '无',
        operatedBy: params.operatedBy,
      },
    });
  }

  async findByVersion(versionId: string) {
    return this.prisma.delayConfig.findMany({
      where: { versionId },
    });
  }

  async findByEntity(entityId: string, versionId: string) {
    return this.prisma.delayConfig.findFirst({
      where: { entityId, versionId },
    });
  }

  async createOrUpdate(dto: CreateDelayConfigDto) {
    // Verify version exists
    const version = await this.prisma.version.findUnique({
      where: { id: dto.versionId },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    // Verify entity exists
    if (dto.entityType === 'requirement') {
      const requirement = await this.prisma.requirement.findUnique({
        where: { id: dto.entityId },
      });
      if (!requirement) {
        throw new NotFoundException('需求不存在');
      }
    } else {
      const issue = await this.prisma.issue.findUnique({
        where: { id: dto.entityId },
      });
      if (!issue) {
        throw new NotFoundException('问题单不存在');
      }
    }

    // 查找现有配置
    const existing = await this.prisma.delayConfig.findFirst({
      where: {
        entityId: dto.entityId,
        versionId: dto.versionId,
      },
    });

    // 如果有操作人ID且存在旧配置，记录变更
    if (dto.operatedBy && existing) {
      const oldDeadlines = existing.stageDeadlines as unknown as StageDeadlineDto[];
      const newDeadlines = dto.stageDeadlines;

      // 比较旧值和新值
      const hasChanged = JSON.stringify(oldDeadlines) !== JSON.stringify(newDeadlines);

      if (hasChanged) {
        await this.logChange({
          entityType: dto.entityType,
          entityId: dto.entityId,
          changeType: 'deadline_change',
          oldValue: oldDeadlines,
          newValue: newDeadlines,
          reason: dto.reason || '无',
          operatedBy: dto.operatedBy,
        });
      }
    }

    if (existing) {
      return this.prisma.delayConfig.update({
        where: { id: existing.id },
        data: {
          stageDeadlines: dto.stageDeadlines as any,
        },
      });
    }

    return this.prisma.delayConfig.create({
      data: {
        entityId: dto.entityId,
        entityType: dto.entityType,
        versionId: dto.versionId,
        stageDeadlines: dto.stageDeadlines as any,
      },
    });
  }

  async remove(id: string) {
    const config = await this.prisma.delayConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('延期配置不存在');
    }

    return this.prisma.delayConfig.delete({
      where: { id },
    });
  }

  async batchImport(dto: BatchImportDto) {
    // Verify version exists
    const version = await this.prisma.version.findUnique({
      where: { id: dto.versionId },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    // Get all requirements and issues for this version
    const [requirements, issues] = await Promise.all([
      this.prisma.requirement.findMany({
        where: { versionId: dto.versionId },
        select: { id: true, code: true },
      }),
      this.prisma.issue.findMany({
        where: { versionId: dto.versionId },
        select: { id: true, code: true },
      }),
    ]);

    // 建立编码到ID的映射
    const codeToEntity = new Map<string, { id: string; type: 'requirement' | 'issue' }>();
    requirements.forEach((r) => codeToEntity.set(r.code, { id: r.id, type: 'requirement' }));
    issues.forEach((i) => codeToEntity.set(i.code, { id: i.id, type: 'issue' }));

    // 阶段名称到枚举的映射
    const stageNameToEnum: Record<string, WorkflowStage> = {
      '需求设计': WorkflowStage.REQUIREMENT_DESIGN,
      'Alpha测试设计': WorkflowStage.ALPHA_TEST_DESIGN,
      '文档会签': WorkflowStage.DOCUMENT_SIGN,
      '功能开发': WorkflowStage.FEATURE_DEV,
      'Alpha用例开发': WorkflowStage.ALPHA_CASE_DEV,
      '升级SOP': WorkflowStage.SOP_UPGRADE,
      '版本转测': WorkflowStage.VERSION_TEST,
      '修改问题单': WorkflowStage.ISSUE_FIX,
      '问题单CCB': WorkflowStage.CCB_REVIEW,
      '版本发布': WorkflowStage.RELEASE,
      // 支持直接使用枚举值
      'REQUIREMENT_DESIGN': WorkflowStage.REQUIREMENT_DESIGN,
      'ALPHA_TEST_DESIGN': WorkflowStage.ALPHA_TEST_DESIGN,
      'DOCUMENT_SIGN': WorkflowStage.DOCUMENT_SIGN,
      'FEATURE_DEV': WorkflowStage.FEATURE_DEV,
      'ALPHA_CASE_DEV': WorkflowStage.ALPHA_CASE_DEV,
      'SOP_UPGRADE': WorkflowStage.SOP_UPGRADE,
      'VERSION_TEST': WorkflowStage.VERSION_TEST,
      'ISSUE_FIX': WorkflowStage.ISSUE_FIX,
      'CCB_REVIEW': WorkflowStage.CCB_REVIEW,
      'RELEASE': WorkflowStage.RELEASE,
    };

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { code: string; error: string }[],
    };

    for (const item of dto.items) {
      const entity = codeToEntity.get(item.code);
      if (!entity) {
        results.failed++;
        results.errors.push({ code: item.code, error: '编码不存在' });
        continue;
      }

      try {
        // 转换阶段名称为枚举
        const stageDeadlines: StageDeadlineDto[] = item.stageDeadlines
          .filter((s) => s.plannedDate) // 过滤掉空日期
          .map((s) => {
            const stage = stageNameToEnum[s.stage];
            if (!stage) {
              throw new Error(`无效的阶段名称: ${s.stage}`);
            }
            return {
              stage,
              plannedDate: s.plannedDate,
            };
          });

        if (stageDeadlines.length === 0) {
          results.failed++;
          results.errors.push({ code: item.code, error: '没有有效的阶段日期配置' });
          continue;
        }

        await this.createOrUpdate({
          entityId: entity.id,
          entityType: entity.type,
          versionId: dto.versionId,
          stageDeadlines,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          code: item.code,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return results;
  }
}
