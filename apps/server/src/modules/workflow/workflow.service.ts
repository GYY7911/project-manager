import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage } from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  // Get default stage order
  getDefaultStages(): WorkflowStage[] {
    return [
      WorkflowStage.REQUIREMENT_DESIGN,
      WorkflowStage.ALPHA_TEST_DESIGN,
      WorkflowStage.DOCUMENT_SIGN,
      WorkflowStage.FEATURE_DEV,
      WorkflowStage.ALPHA_CASE_DEV,
      WorkflowStage.SOP_UPGRADE,
      WorkflowStage.VERSION_TEST,
      WorkflowStage.ISSUE_FIX,
      WorkflowStage.CCB_REVIEW,
      WorkflowStage.RELEASE,
    ];
  }

  // Get stage display label
  getStageLabel(stage: WorkflowStage): string {
    const labels: Record<WorkflowStage, string> = {
      [WorkflowStage.REQUIREMENT_DESIGN]: '需求设计',
      [WorkflowStage.ALPHA_TEST_DESIGN]: 'Alpha测试设计',
      [WorkflowStage.DOCUMENT_SIGN]: '文档会签',
      [WorkflowStage.FEATURE_DEV]: '功能开发',
      [WorkflowStage.ALPHA_CASE_DEV]: 'Alpha用例开发',
      [WorkflowStage.SOP_UPGRADE]: '升级SOP',
      [WorkflowStage.VERSION_TEST]: '版本转测',
      [WorkflowStage.ISSUE_FIX]: '修改问题单',
      [WorkflowStage.CCB_REVIEW]: '问题单CCB',
      [WorkflowStage.RELEASE]: '版本发布',
    };
    return labels[stage];
  }

  // Validate stage transition rules
  canTransition(from: WorkflowStage, to: WorkflowStage): boolean {
    // 定义允许的转换
    const allowedTransitions: Record<WorkflowStage, WorkflowStage[]> = {
      [WorkflowStage.REQUIREMENT_DESIGN]: [
        WorkflowStage.DOCUMENT_SIGN,
        WorkflowStage.ALPHA_TEST_DESIGN,
      ],
      [WorkflowStage.ALPHA_TEST_DESIGN]: [WorkflowStage.DOCUMENT_SIGN],
      [WorkflowStage.DOCUMENT_SIGN]: [
        WorkflowStage.FEATURE_DEV,
        WorkflowStage.ALPHA_CASE_DEV,
        WorkflowStage.SOP_UPGRADE,
      ],
      [WorkflowStage.FEATURE_DEV]: [WorkflowStage.VERSION_TEST],
      [WorkflowStage.ALPHA_CASE_DEV]: [WorkflowStage.VERSION_TEST],
      [WorkflowStage.SOP_UPGRADE]: [WorkflowStage.VERSION_TEST],
      [WorkflowStage.VERSION_TEST]: [WorkflowStage.ISSUE_FIX],
      [WorkflowStage.ISSUE_FIX]: [WorkflowStage.CCB_REVIEW, WorkflowStage.VERSION_TEST],
      [WorkflowStage.CCB_REVIEW]: [WorkflowStage.RELEASE, WorkflowStage.ISSUE_FIX],
      [WorkflowStage.RELEASE]: [],
    };

    return allowedTransitions[from]?.includes(to) ?? false;
  }

  // Get workflow logs for an entity
  async getWorkflowLogs(entityType: string, entityId: string) {
    return this.prisma.workflowLog.findMany({
      where: { entityType, entityId },
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
    });
  }

  async validateAndLogTransition(
    entityType: 'requirement' | 'issue',
    entityId: string,
    currentStage: WorkflowStage,
    targetStage: WorkflowStage,
    userId: string,
    remark?: string,
    requirementId?: string,
    issueId?: string,
  ): Promise<void> {
    if (!this.canTransition(currentStage, targetStage)) {
      throw new BadRequestException(
        `Cannot transition from ${this.getStageLabel(currentStage)} to ${this.getStageLabel(targetStage)}`,
      );
    }

    await this.prisma.workflowLog.create({
      data: {
        entityType,
        entityId,
        fromStage: currentStage,
        toStage: targetStage,
        operatedBy: userId,
        remark,
        requirementId,
        issueId,
      },
    });
  }
}
