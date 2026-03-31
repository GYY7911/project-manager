import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from './dialog';
import { renderWithProviders, createTestQueryClient } from '@/test/utils';
import { QueryClient } from '@tanstack/react-query';

/**
 * Select 组件测试
 *
 * 注意：由于 Radix UI Select 使用 PointerEvent 和复杂的 DOM 交互，
 * 在 jsdom 环境中难以完全模拟点击行为。
 * 因此，本测试主要关注组件渲染和属性传递是否正确。
 * 完整的交互测试应在 E2E 测试中进行（如 Playwright）。
 */
describe('Select 组件', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('Select 应正确渲染 placeholder', () => {
      // Arrange & Act
      renderWithProviders(
        <Select>
          <SelectTrigger data-testid="select-trigger">
            <SelectValue placeholder="选择选项" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">选项一</SelectItem>
            <SelectItem value="2">选项二</SelectItem>
          </SelectContent>
        </Select>,
        { queryClient }
      );

      // Assert
      expect(screen.getByText('选择选项')).toBeInTheDocument();
      expect(screen.getByTestId('select-trigger')).toBeInTheDocument();
    });

    it('Select 应正确渲染默认值', () => {
      // Arrange & Act
      renderWithProviders(
        <Select defaultValue="1">
          <SelectTrigger data-testid="select-trigger">
            <SelectValue placeholder="选择选项" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">选项一</SelectItem>
            <SelectItem value="2">选项二</SelectItem>
          </SelectContent>
        </Select>,
        { queryClient }
      );

      // Assert - 默认值应该显示
      expect(screen.getByText('选项一')).toBeInTheDocument();
    });

    it('禁用状态下 Select 应有 disabled 属性', () => {
      // Arrange & Act
      renderWithProviders(
        <Select disabled>
          <SelectTrigger data-testid="select-trigger">
            <SelectValue placeholder="选择选项" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">选项一</SelectItem>
          </SelectContent>
        </Select>,
        { queryClient }
      );

      // Assert
      const trigger = screen.getByTestId('select-trigger');
      expect(trigger).toBeDisabled();
    });
  });

  describe('在 Dialog 内的渲染', () => {
    it('在 modal={false} 的 Dialog 内，Select 应正常渲染', async () => {
      // Arrange
      renderWithProviders(
        <Dialog modal={false} defaultOpen>
          <DialogContent>
            <DialogTitle>测试对话框</DialogTitle>
            <Select>
              <SelectTrigger data-testid="select-trigger">
                <SelectValue placeholder="选择选项" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">选项一</SelectItem>
                <SelectItem value="2">选项二</SelectItem>
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>,
        { queryClient }
      );

      // Assert - 对话框应该渲染
      await waitFor(() => {
        expect(screen.getByText('测试对话框')).toBeInTheDocument();
      });

      // Select 应该存在于对话框中
      expect(screen.getByTestId('select-trigger')).toBeInTheDocument();
      expect(screen.getByText('选择选项')).toBeInTheDocument();
    });

    it('在 Dialog 内，Select 带默认值应正常显示', async () => {
      // Arrange
      renderWithProviders(
        <Dialog modal={false} defaultOpen>
          <DialogContent>
            <DialogTitle>测试对话框</DialogTitle>
            <Select defaultValue="2">
              <SelectTrigger data-testid="select-trigger">
                <SelectValue placeholder="选择选项" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">选项一</SelectItem>
                <SelectItem value="2">选项二</SelectItem>
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>,
        { queryClient }
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('测试对话框')).toBeInTheDocument();
      });

      // 默认值应该显示
      expect(screen.getByText('选项二')).toBeInTheDocument();
    });
  });

  describe('边界条件测试', () => {
    it('没有选项时，Select 应正常渲染', () => {
      // Arrange & Act
      renderWithProviders(
        <Select>
          <SelectTrigger data-testid="select-trigger">
            <SelectValue placeholder="选择选项" />
          </SelectTrigger>
          <SelectContent>
            {/* 没有选项 */}
          </SelectContent>
        </Select>,
        { queryClient }
      );

      // Assert - 不应该崩溃
      expect(screen.getByTestId('select-trigger')).toBeInTheDocument();
      expect(screen.getByText('选择选项')).toBeInTheDocument();
    });
  });
});
