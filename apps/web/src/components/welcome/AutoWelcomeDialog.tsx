'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore, useHasHydrated } from '@/store';
import { WelcomeAnimation } from './WelcomeAnimation';
import { cn } from '@/lib/utils';
import { FolderKanban, Sparkles } from 'lucide-react';

type TriggerCondition = 'empty_versions' | 'empty_board';

interface AutoWelcomeDialogProps {
  /** 触发条件：空版本列表或空看板 */
  triggerCondition: TriggerCondition;
  /** 是否满足触发条件（由父组件判断） */
  shouldTrigger: boolean;
}

/**
 * AutoWelcomeDialog 组件
 *
 * 职责：在特定空状态下自动触发新手引导弹窗
 *
 * 触发场景：
 * 1. 看板为空（无版本）- triggerCondition: 'empty_versions'
 * 2. 版本管理为空 - triggerCondition: 'empty_versions'
 * 3. 看板有版本但无卡片 - triggerCondition: 'empty_board' (未来扩展)
 *
 * 特性：
 * - 使用与侧边栏新手引导相同的悬浮动画效果
 * - 支持"不再显示"选项，勾选后保存到 localStorage
 * - 用户可以通过设置重置此选项
 */
export function AutoWelcomeDialog({
  triggerCondition,
  shouldTrigger,
}: AutoWelcomeDialogProps) {
  const router = useRouter();
  const hasHydrated = useHasHydrated();
  const { hideWelcomeDialog, setHideWelcomeDialog, resetOnboarding } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // 等待 hydration 完成
    if (!hasHydrated) {
      return;
    }

    // 如果用户已选择不再显示，则不弹出
    if (hideWelcomeDialog) {
      setIsOpen(false);
      return;
    }

    // 只有满足条件时才显示
    if (!shouldTrigger) {
      // 条件不满足时关闭弹窗（用户可能已经创建了版本）
      setIsOpen(false);
      return;
    }

    // 延迟显示，让页面先渲染完成
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [hasHydrated, shouldTrigger, hideWelcomeDialog]);

  // 用户关闭弹窗（点击外部或X）- 检查是否勾选了"不再显示"
  const handleClose = () => {
    if (dontShowAgain) {
      setHideWelcomeDialog(true);
    }
    setIsOpen(false);
  };

  // 用户开始新手引导 - 重置状态并跳转到引导页面
  const handleStartGuide = () => {
    setHideWelcomeDialog(true);
    // 重置所有引导状态，确保从头开始
    resetOnboarding();
    setIsOpen(false);
    router.push('/onboard');
  };

  // 用户前往创建版本
  const handleGoToVersions = () => {
    if (dontShowAgain) {
      setHideWelcomeDialog(true);
    }
    setIsOpen(false);
    router.push('/versions?welcome=true');
  };

  // 根据触发条件返回不同的内容
  const getContent = () => {
    switch (triggerCondition) {
      case 'empty_versions':
        return {
          title: '欢迎使用项目管理系统',
          description: '看起来这是你第一次使用。让我们从创建第一个版本开始，开启高效的项目管理之旅！',
          primaryAction: {
            label: '开始新手引导',
            icon: Sparkles,
            onClick: handleStartGuide,
          },
          secondaryAction: {
            label: '前往创建版本',
            icon: FolderKanban,
            onClick: handleGoToVersions,
          },
        };
      case 'empty_board':
        return {
          title: '看板是空的',
          description: '你已经有了版本，接下来可以创建需求和问题单来跟踪开发进度。需要引导吗？',
          primaryAction: {
            label: '开始新手引导',
            icon: Sparkles,
            onClick: handleStartGuide,
          },
          secondaryAction: {
            label: '我自己来',
            icon: undefined,
            onClick: handleClose,
          },
        };
      default:
        return {
          title: '欢迎',
          description: '欢迎使用项目管理系统',
          primaryAction: {
            label: '开始',
            icon: Sparkles,
            onClick: handleStartGuide,
          },
          secondaryAction: {
            label: '跳过',
            icon: undefined,
            onClick: handleClose,
          },
        };
    }
  };

  const content = getContent();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose();
      }
    }}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          "glass border-white/20",
          "bg-white/10 backdrop-blur-xl",
          "text-white"
        )}
      >
        <DialogTitle className="sr-only">{content.title}</DialogTitle>
        <div className="flex flex-col items-center py-6">
          {/* Animation */}
          <WelcomeAnimation />

          {/* Welcome Text */}
          <div className="mt-8 text-center">
            <h2 className="text-2xl font-bold mb-2">
              {content.title}
            </h2>
            <p className="text-white/70 whitespace-pre-line">
              {content.description}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6 w-full px-4">
            <Button
              variant="outline"
              onClick={content.secondaryAction.onClick}
              className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white"
            >
              {content.secondaryAction.icon && (
                <content.secondaryAction.icon className="h-4 w-4 mr-2" />
              )}
              {content.secondaryAction.label}
            </Button>
            <Button
              onClick={content.primaryAction.onClick}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
            >
              <content.primaryAction.icon className="h-4 w-4 mr-2" />
              {content.primaryAction.label}
            </Button>
          </div>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 mt-4 cursor-pointer group">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              className="border-white/30 data-[state=checked]:bg-white/20 data-[state=checked]:border-white/50"
            />
            <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
              不再显示此提示
            </span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
