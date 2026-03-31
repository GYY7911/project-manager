import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStage } from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  // 获取默认阶段顺序
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

  // 获取阶段显示名称
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

  // 验证阶段转换是否合法
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

  // 获取实体的工作流日志
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
}
