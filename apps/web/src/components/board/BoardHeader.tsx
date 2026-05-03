'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, AlertCircle, RefreshCw, Settings2, Target } from 'lucide-react';
import { Version } from '@pm/shared';

interface BoardHeaderProps {
  versions: Version[];
  currentVersionId: string | null;
  onVersionChange: (versionId: string) => void;
  isPM: boolean;
  hasVersion: boolean;
  hasItems: boolean;
  onOpenRequirementDialog: () => void;
  onOpenIssueDialog: () => void;
  onOpenConfigDialog: () => void;
  onOpenGameDialog: () => void;
  onRefetch: () => void;
}

export function BoardHeader({
  versions,
  currentVersionId,
  onVersionChange,
  isPM,
  hasVersion,
  hasItems,
  onOpenRequirementDialog,
  onOpenIssueDialog,
  onOpenConfigDialog,
  onOpenGameDialog,
  onRefetch,
}: BoardHeaderProps) {
  return (
    <header className="h-16 border-b border-white/10 dark:border-white/10 border-slate-200 glass flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Select value={currentVersionId || ''} onValueChange={onVersionChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="选择版本" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isPM && hasVersion && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onOpenRequirementDialog}>
              <FileText className="h-4 w-4 mr-2" />
              新建需求
            </Button>

            <Button size="sm" variant="destructive" onClick={onOpenIssueDialog}>
              <AlertCircle className="h-4 w-4 mr-2" />
              新建问题单
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isPM && hasVersion && hasItems && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenGameDialog}
            className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/50 hover:from-violet-500/30 hover:to-purple-500/30"
          >
            <Target className="h-4 w-4 mr-2 text-violet-400" />
            更新消消乐
          </Button>
        )}
        {isPM && (
          <Button variant="outline" size="sm" onClick={onOpenConfigDialog}>
            <Settings2 className="h-4 w-4 mr-2" />
            模板配置
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={onRefetch}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
