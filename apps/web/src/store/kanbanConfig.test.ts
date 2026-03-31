import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowStage, KanbanTemplateConfig } from '@pm/shared';
import { generateDefaultKanbanConfig } from './index';

describe('Kanban Config Store', () => {
  describe('generateDefaultKanbanConfig', () => {
    it('生成有效的默认配置', () => {
      const config = generateDefaultKanbanConfig();

      expect(config).toBeDefined();
      expect(config.version).toBe(1);
      expect(config.columns).toBeInstanceOf(Array);
      expect(config.stageConfigs).toBeInstanceOf(Array);
      expect(config.updatedAt).toBeDefined();
    });

    it('默认配置包含所有静态阶段列', () => {
      const config = generateDefaultKanbanConfig();

      const staticStages = [
        WorkflowStage.REQUIREMENT_DESIGN,
        WorkflowStage.ALPHA_TEST_DESIGN,
        WorkflowStage.DOCUMENT_SIGN,
        WorkflowStage.FEATURE_DEV,
        WorkflowStage.ALPHA_CASE_DEV,
        WorkflowStage.SOP_UPGRADE,
      ];

      staticStages.forEach((stage) => {
        const found = config.columns.some(
          (col) => col.stages.includes(stage) && col.stages.length === 1
        );
        expect(found).toBe(true);
      });
    });

    it('默认配置包含版本转测占位列', () => {
      const config = generateDefaultKanbanConfig();

      const versionTestColumn = config.columns.find(
        (col) => col.stages.includes(WorkflowStage.VERSION_TEST)
      );

      expect(versionTestColumn).toBeDefined();
    });

    it('默认配置包含后续阶段列', () => {
      const config = generateDefaultKanbanConfig();

      const laterStages = [
        WorkflowStage.ISSUE_FIX,
        WorkflowStage.CCB_REVIEW,
        WorkflowStage.RELEASE,
      ];

      laterStages.forEach((stage) => {
        const found = config.columns.some((col) =>
          col.stages.includes(stage)
        );
        expect(found).toBe(true);
      });
    });

    it('默认配置的 stageConfigs 包含所有阶段', () => {
      const config = generateDefaultKanbanConfig();
      const allStages = Object.values(WorkflowStage);

      expect(config.stageConfigs).toHaveLength(allStages.length);

      allStages.forEach((stage) => {
        const found = config.stageConfigs.some((sc) => sc.stage === stage);
        expect(found).toBe(true);
      });
    });

    it('默认配置中所有阶段都是可见的', () => {
      const config = generateDefaultKanbanConfig();

      config.stageConfigs.forEach((sc) => {
        expect(sc.visible).toBe(true);
      });
    });

    it('默认配置中阶段没有自定义标题', () => {
      const config = generateDefaultKanbanConfig();

      config.stageConfigs.forEach((sc) => {
        expect(sc.customTitle).toBeUndefined();
      });
    });

    it('每次调用生成新的 updatedAt 时间戳', async () => {
      const config1 = generateDefaultKanbanConfig();

      // 等待一小段时间确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 10));

      const config2 = generateDefaultKanbanConfig();

      expect(config1.updatedAt).not.toBe(config2.updatedAt);
    });

    it('列的 ID 是唯一的', () => {
      const config = generateDefaultKanbanConfig();
      const ids = config.columns.map((col) => col.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});
