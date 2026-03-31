'use client';

import { Badge } from '@/components/ui/badge';
import { OnboardingData } from '@/store';
import { CheckCircle2, FolderKanban, FileText, Rocket, PartyPopper } from 'lucide-react';

interface CompleteStepProps {
  data: OnboardingData;
  versionId: string | null;
}

export function CompleteStep({ data, versionId }: CompleteStepProps) {
  const summaryItems = [
    {
      icon: FolderKanban,
      label: '版本',
      value: data.version?.name || '未创建',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: FileText,
      label: '需求',
      value: `${data.requirements.length} 个`,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: Rocket,
      label: '转测版本',
      value: `${data.testCycles.length} 个`,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="space-y-6 py-2">
      {/* 成功图标和标题 */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 mb-4 relative">
          <CheckCircle2 className="h-9 w-9 text-green-500" />
          <div className="absolute -top-1 -right-1">
            <PartyPopper className="h-5 w-5 text-yellow-500 animate-bounce" />
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">设置完成！</h3>
        <p className="text-muted-foreground text-sm">
          恭喜！你已完成项目初始化，以下是创建的内容摘要
        </p>
      </div>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="p-4 rounded-xl border border-white/10 dark:border-white/10 border-slate-200 bg-white/5 dark:bg-white/5 bg-slate-50 text-center"
          >
            <div className={`h-10 w-10 rounded-full ${item.bgColor} flex items-center justify-center mx-auto mb-2`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className="font-semibold text-sm">{item.value}</p>
          </div>
        ))}
      </div>

      {/* 下一步提示 */}
      <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
        <h4 className="font-medium text-green-400 mb-3 text-sm flex items-center gap-2">
          <Rocket className="h-4 w-4" />
          接下来可以做什么？
        </h4>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>在看板上拖拽卡片来更新需求状态</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>点击侧边栏的「版本管理」查看和编辑版本</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>需要帮助时，点击侧边栏的「新手引导」重新查看</span>
          </li>
        </ul>
      </div>

      {/* 快捷提示 */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px] px-1.5">提示</Badge>
        <span>可以随时点击左侧边栏的「新手引导」按钮重新查看此引导</span>
      </div>
    </div>
  );
}
