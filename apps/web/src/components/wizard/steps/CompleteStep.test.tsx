import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompleteStep } from './CompleteStep';

describe('CompleteStep', () => {
  describe('渲染测试', () => {
    it('应该显示完成标题', () => {
      render(
        <CompleteStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          versionId="version-123"
        />
      );

      expect(screen.getByText('设置完成！')).toBeInTheDocument();
    });

    it('应该显示祝贺信息', () => {
      render(
        <CompleteStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          versionId="version-123"
        />
      );

      expect(screen.getByText(/恭喜！你已完成项目初始化/)).toBeInTheDocument();
    });

    it('应该显示下一步提示', () => {
      render(
        <CompleteStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          versionId="version-123"
        />
      );

      // 组件已更新，现在显示 "接下来可以做什么？"
      expect(screen.getByText(/接下来可以做什么/)).toBeInTheDocument();
    });
  });

  describe('摘要显示', () => {
    it('应该显示版本名称', () => {
      render(
        <CompleteStep
          data={{
            version: { name: 'V1.0.0', startDate: '2026-01-01', endDate: '2026-01-31' },
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          versionId="version-123"
        />
      );

      expect(screen.getByText('V1.0.0')).toBeInTheDocument();
    });

    it('未创建版本时应该显示"未创建"', () => {
      render(
        <CompleteStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          versionId="version-123"
        />
      );

      expect(screen.getByText('未创建')).toBeInTheDocument();
    });

    it('应该显示需求/转测版本数量', () => {
      render(
        <CompleteStep
          data={{
            version: null,
            teamMemberIds: ['user-1', 'user-2', 'user-3'],
            requirements: [],
            testCycles: [],
          }}
          versionId="version-123"
        />
      );

      // 组件现在显示需求和转测版本数量，都是 0 个
      const zeroElements = screen.getAllByText('0 个');
      expect(zeroElements.length).toBeGreaterThanOrEqual(2);
    });

    it('应该显示已创建需求数量', () => {
      render(
        <CompleteStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [
              { code: 'REQ-001', title: '需求1', assigneeId: 'user-1' },
              { code: 'REQ-002', title: '需求2', assigneeId: 'user-2' },
            ],
            testCycles: [],
          }}
          versionId="version-123"
        />
      );

      expect(screen.getByText('2 个')).toBeInTheDocument();
    });
  });

  describe('完整数据展示', () => {
    it('应该正确显示所有摘要项', () => {
      render(
        <CompleteStep
          data={{
            version: { name: 'V2.0.0', startDate: '2026-02-01', endDate: '2026-02-28' },
            teamMemberIds: ['user-1'],
            requirements: [{ code: 'REQ-001', title: '需求1', assigneeId: 'user-1' }],
            testCycles: [{ name: 'SIT1' }],
          }}
          versionId="version-123"
        />
      );

      expect(screen.getByText('版本')).toBeInTheDocument();
      // 组件不再显示成员，而是显示需求、转测版本
      expect(screen.getByText('需求')).toBeInTheDocument();
      expect(screen.getByText('转测版本')).toBeInTheDocument();
    });

    it('应该显示正确的图标颜色类', () => {
      const { container } = render(
        <CompleteStep
          data={{
            version: { name: 'V1.0.0', startDate: '2026-01-01', endDate: '2026-01-31' },
            teamMemberIds: ['user-1'],
            requirements: [{ code: 'REQ-001', title: '需求1', assigneeId: 'user-1' }],
            testCycles: [{ name: 'SIT1' }],
          }}
          versionId="version-123"
        />
      );

      // 验证颜色类存在
      expect(container.querySelector('.text-blue-400')).toBeInTheDocument();
      expect(container.querySelector('.text-green-400')).toBeInTheDocument();
      expect(container.querySelector('.text-purple-400')).toBeInTheDocument();
      expect(container.querySelector('.text-orange-400')).toBeInTheDocument();
    });
  });

  describe('空数据处理', () => {
    it('空数据应该显示默认值', () => {
      render(
        <CompleteStep
          data={{
            version: null,
            teamMemberIds: [],
            requirements: [],
            testCycles: [],
          }}
          versionId={null}
        />
      );

      expect(screen.getByText('未创建')).toBeInTheDocument();
      // 需求和转测版本都是 0 个
      const zeroElements = screen.getAllByText('0 个');
      expect(zeroElements.length).toBe(2);
    });
  });

  describe('versionId 参数', () => {
    it('versionId 为 null 时应该正常渲染', () => {
      render(
        <CompleteStep
          data={{ version: null, teamMemberIds: [], requirements: [], testCycles: [] }}
          versionId={null}
        />
      );

      expect(screen.getByText('设置完成！')).toBeInTheDocument();
    });
  });
});
