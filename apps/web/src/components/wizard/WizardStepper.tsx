'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: number;
  name: string;
  description?: string;
  required?: boolean;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

/**
 * WizardStepper 组件 - 紧凑版
 *
 * 显示在窗口顶部，展示当前进度
 * 使用更紧凑的布局，适合悬浮窗口
 */
export function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || step.id < currentStep);

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* 步骤圆点和标签 */}
              <div
                className={cn(
                  "flex items-center gap-2",
                  isClickable && "cursor-pointer"
                )}
                onClick={() => isClickable && onStepClick?.(step.id)}
              >
                {/* 圆点 */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    !isCompleted && !isCurrent && "bg-muted/50 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    step.id + 1
                  )}
                </div>

                {/* 标签 */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent && "text-primary",
                      isCompleted && "text-green-500",
                      !isCompleted && !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {step.name}
                  </span>

                  {/* 可选标签 */}
                  {step.required === false && (
                    <span className="text-[10px] text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/30">
                      可选
                    </span>
                  )}
                </div>
              </div>

              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-3 transition-colors",
                    isCompleted ? "bg-green-500" : "bg-muted/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
