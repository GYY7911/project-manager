'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { WizardStepper, Step } from './WizardStepper';
import { CreateVersionStep } from './steps/CreateVersionStep';
import { CreateRequirementsStep } from './steps/CreateRequirementsStep';
import { CreateTestCyclesStep } from './steps/CreateTestCyclesStep';
import { CompleteStep } from './steps/CompleteStep';
import { Button } from '@/components/ui/button';
import { useAppStore, OnboardingData } from '@/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronLeft, ChevronRight, SkipForward, ArrowRight } from 'lucide-react';

const steps: Step[] = [
  { id: 0, name: '创建版本', required: true },
  { id: 1, name: '创建需求', required: false },
  { id: 2, name: '创建转测版本', required: false },
  { id: 3, name: '完成', required: true },
];

const initialData: OnboardingData = {
  version: null,
  teamMemberIds: [],
  requirements: [],
  testCycles: [],
};

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    setCurrentVersionId,
    setOnboardingStatus,
    onboardingStatus,
    onboardingData,
    onboardingCurrentStep,
    onboardingCreatedVersionId,
    setOnboardingData,
    setOnboardingCurrentStep,
    setOnboardingCreatedVersionId,
  } = useAppStore();

  // 从 store 恢复状态，如果没有则使用初始值
  // 注意：只有当 onboardingStatus 不是 'completed' 时才恢复状态
  // 如果状态是 'completed' 但用户进入了此页面，说明需要重新开始引导
  const shouldRestoreState = onboardingStatus !== 'completed';
  const [currentStep, setCurrentStep] = useState(shouldRestoreState ? (onboardingCurrentStep || 0) : 0);
  const [data, setData] = useState<OnboardingData>(shouldRestoreState ? (onboardingData || initialData) : initialData);
  const [createdVersionId, setCreatedVersionId] = useState<string | null>(shouldRestoreState ? onboardingCreatedVersionId : null);
  const [isVisible, setIsVisible] = useState(false);

  // 入场动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 标记引导为进行中
  // 如果状态是 'completed' 但用户进入了此页面，说明需要重新开始引导
  // 如果状态是 'skipped' 也需要重新开始
  useEffect(() => {
    if (onboardingStatus !== 'in_progress') {
      setOnboardingStatus('in_progress');
    }
  }, [onboardingStatus, setOnboardingStatus]);

  // 每次步骤变化时保存到 store
  useEffect(() => {
    setOnboardingCurrentStep(currentStep);
  }, [currentStep, setOnboardingCurrentStep]);

  // 每次数据变化时保存到 store
  useEffect(() => {
    setOnboardingData(data);
  }, [data, setOnboardingData]);

  // 保存创建的版本 ID
  useEffect(() => {
    setOnboardingCreatedVersionId(createdVersionId);
  }, [createdVersionId, setOnboardingCreatedVersionId]);

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 完成引导
  const handleComplete = async () => {
    console.log('[DEBUG] handleComplete called', {
      createdVersionId,
      requirementsCount: data.requirements.length,
      testCyclesCount: data.testCycles.length,
    });

    setOnboardingStatus('completed');
    if (createdVersionId) {
      console.log('[DEBUG] Setting currentVersionId:', createdVersionId);
      setCurrentVersionId(createdVersionId);

      // 保存所有未保存的需求
      if (data.requirements.length > 0) {
        console.log('[DEBUG] Saving requirements:', data.requirements);
        for (const req of data.requirements) {
          if (req.title && req.assigneeId) {
            try {
              // 重新生成唯一 code，避免并发导致的重复 code 问题
              const { code } = await api.generateRequirementCode(createdVersionId);
              await api.createRequirement({
                code,
                title: req.title,
                versionId: createdVersionId,
                assigneeId: req.assigneeId,
                workload: req.workload,
                dueDate: req.dueDate,
              });
            } catch (e) {
              console.error('Failed to save requirement:', req.title, e);
              // 继续尝试保存其他需求，不中断整个流程
            }
          }
        }
      }

      // 保存所有未保存的转测版本
      if (data.testCycles.length > 0) {
        console.log('[DEBUG] Saving test cycles:', data.testCycles);
        try {
          for (const tc of data.testCycles) {
            if (tc.name) {
              await api.createTestCycle({
                versionId: createdVersionId,
                name: tc.name,
              });
            }
          }
        } catch (e) {
          console.error('Failed to save test cycles on complete:', e);
        }
      }
    } else {
      console.warn('[DEBUG] No createdVersionId, skipping data save');
    }
    // 在跳转前使所有相关缓存失效
    console.log('[DEBUG] Invalidating caches and redirecting to /board');
    await queryClient.invalidateQueries({ queryKey: ['versions'] });
    await queryClient.invalidateQueries({ queryKey: ['board'] });
    router.push('/board');
  };

  // 跳过整个引导（用户主动跳过）
  const handleSkipAll = async () => {
    setOnboardingStatus('skipped');
    // 确保跳转时版本数据是最新的
    await queryClient.invalidateQueries({ queryKey: ['versions'] });
    router.push('/board');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <CreateVersionStep
            data={data}
            updateData={updateData}
            onNext={handleNext}
            onCreatedVersion={setCreatedVersionId}
          />
        );
      case 1:
        return (
          <CreateRequirementsStep
            data={data}
            updateData={updateData}
            versionId={createdVersionId}
          />
        );
      case 2:
        return (
          <CreateTestCyclesStep
            data={data}
            updateData={updateData}
            versionId={createdVersionId}
          />
        );
      case 3:
        return (
          <CompleteStep
            data={data}
            versionId={createdVersionId}
          />
        );
      default:
        return null;
    }
  };

  // 获取步骤标题和描述
  const getStepInfo = () => {
    switch (currentStep) {
      case 0:
        return {
          title: '创建第一个版本',
          description: '版本是项目管理的基础单位，所有需求和问题单都属于某个版本',
        };
      case 1:
        return {
          title: '创建需求',
          description: '添加本版本的需求，每个需求将被指派给团队成员并显示在看板上',
        };
      case 2:
        return {
          title: '创建转测版本',
          description: '转测版本代表测试轮次，每个转测版本会作为看板上的一列',
        };
      case 3:
        return {
          title: '设置完成',
          description: '恭喜！你已完成项目初始化',
        };
      default:
        return { title: '', description: '' };
    }
  };

  const stepInfo = getStepInfo();
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const currentStepRequired = steps[currentStep].required;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      />

      {/* 悬浮窗口 */}
      <div
        className={cn(
          "relative w-full max-w-3xl max-h-[88vh] flex flex-col",
          "glass border border-white/20 rounded-2xl shadow-2xl",
          "bg-background/95 backdrop-blur-xl",
          "transition-all duration-500 ease-out",
          isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        )}
      >
        {/* 窗口头部：标题 + 步骤指示器 */}
        <div className="flex-shrink-0 border-b border-white/10 dark:border-white/10 border-slate-200 px-6 py-4">
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{stepInfo.title}</h2>
                <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
              </div>
            </div>
            <button
              onClick={handleSkipAll}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              跳过引导
            </button>
          </div>

          {/* 步骤指示器 */}
          <WizardStepper steps={steps} currentStep={currentStep} />
        </div>

        {/* 步骤内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {renderStep()}
        </div>

        {/* 窗口底部：导航按钮 */}
        <div className="flex-shrink-0 border-t border-white/10 dark:border-white/10 border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧按钮 */}
            <div className="flex items-center gap-2">
              {isFirstStep ? (
                <Button
                  variant="ghost"
                  onClick={handleSkipAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  跳过引导
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="border-white/20 hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一步
                </Button>
              )}

              {isLastStep && (
                <Button
                  variant="ghost"
                  onClick={handleSkipAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  跳过
                </Button>
              )}
            </div>

            {/* 右侧按钮 */}
            <div className="flex items-center gap-3">
              {/* 跳过此步（仅非必填步骤显示） */}
              {!isFirstStep && !isLastStep && !currentStepRequired && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  跳过此步
                </Button>
              )}

              {/* 下一步 / 完成 */}
              {!isLastStep ? (
                <Button onClick={handleNext}>
                  下一步
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleComplete} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                  进入看板
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
