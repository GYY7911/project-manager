'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore, useHasHydrated } from '@/store';
import { WelcomeAnimation } from './WelcomeAnimation';
import { cn } from '@/lib/utils';

interface WelcomeDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  forceOpen?: boolean;
}

/**
 * WelcomeDialog 组件
 *
 * 职责：显示可选的欢迎提示，不再承担首次引导职责
 *
 * 显示条件：
 * 1. forceOpen 为 true 时强制显示（用于侧边栏手动触发）
 * 2. 用户已完成或跳过引导，但 hideWelcomeDialog 为 false 时显示
 *
 * 首次引导由 AppInitializer 组件统一处理，会自动跳转到 /onboard
 */
export function WelcomeDialog({
  open: controlledOpen,
  onOpenChange,
  forceOpen = false,
}: WelcomeDialogProps) {
  const router = useRouter();
  const hasHydrated = useHasHydrated();
  const { hideWelcomeDialog, setHideWelcomeDialog, onboardingStatus } = useAppStore();
  const [internalOpen, setInternalOpen] = useState(false);

  // Handle open state
  // 只在以下情况显示：
  // 1. forceOpen 为 true（手动触发）
  // 2. 用户已完成引导，且未隐藏欢迎对话框
  useEffect(() => {
    if (forceOpen) {
      setInternalOpen(true);
    } else if (hasHydrated) {
      // 只有在引导已完成/跳过，且未隐藏时才显示
      const hasCompletedOnboarding = onboardingStatus === 'completed' || onboardingStatus === 'skipped';
      setInternalOpen(!hideWelcomeDialog && hasCompletedOnboarding);
    }
  }, [hasHydrated, hideWelcomeDialog, forceOpen, onboardingStatus]);

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const handleClose = () => {
    setHideWelcomeDialog(true);
    setOpen(false);
  };

  const handleStart = () => {
    setHideWelcomeDialog(true);
    setOpen(false);
    router.push('/onboard');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          "glass border-white/20",
          "bg-white/10 backdrop-blur-xl",
          "text-white"
        )}
      >
        <DialogTitle className="sr-only">欢迎回来</DialogTitle>
        <div className="flex flex-col items-center py-6">
          {/* Animation */}
          <WelcomeAnimation />

          {/* Welcome Text */}
          <div className="mt-8 text-center">
            <h2 className="text-2xl font-bold mb-2">
              欢迎回来
            </h2>
            <p className="text-white/70">
              想要重新体验新手引导吗？
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6 w-full px-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white"
            >
              关闭
            </Button>
            <Button
              onClick={handleStart}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
            >
              重新开始
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
