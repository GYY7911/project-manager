'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IssueSeverity } from '@pm/shared';

interface Assignee {
  id: string;
  name: string;
  employeeNo: string;
}

interface TestCycle {
  id: string;
  name: string;
}

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  title: string;
  assigneeId: string;
  severity: IssueSeverity;
  testCycleId: string;
  dueDate: Date | undefined;
  onCodeChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onSeverityChange: (value: IssueSeverity) => void;
  onTestCycleChange: (value: string) => void;
  onDueDateChange: (date: Date | undefined) => void;
  assignees: Assignee[];
  testCycles: TestCycle[];
  isPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}

export function CreateIssueDialog({
  open,
  onOpenChange,
  code,
  title,
  assigneeId,
  severity,
  testCycleId,
  dueDate,
  onCodeChange,
  onTitleChange,
  onAssigneeChange,
  onSeverityChange,
  onTestCycleChange,
  onDueDateChange,
  assignees,
  testCycles,
  isPending,
  onSubmit,
  canSubmit,
}: CreateIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建问题单</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label className="flex items-center gap-2">
              编码
              <span className="text-xs text-muted-foreground font-normal">
                (自动生成)
              </span>
            </Label>
            <Input
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder="ISS20260310001"
              className="font-mono"
            />
          </div>
          <div>
            <Label>标题 *</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="问题单标题"
            />
          </div>
          <div>
            <Label>负责人 *</Label>
            <Select value={assigneeId} onValueChange={onAssigneeChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择负责人" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.employeeNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>严重程度</Label>
            <Select value={severity} onValueChange={onSeverityChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={IssueSeverity.CRITICAL}>
                  致命 - 系统崩溃/数据丢失
                </SelectItem>
                <SelectItem value={IssueSeverity.HIGH}>
                  严重 - 核心功能不可用
                </SelectItem>
                <SelectItem value={IssueSeverity.MEDIUM}>
                  一般 - 功能异常有替代方案
                </SelectItem>
                <SelectItem value={IssueSeverity.LOW}>
                  轻微 - 界面/提示问题
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>转测版本</Label>
            <Select value={testCycleId} onValueChange={onTestCycleChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择转测版本（可选）" />
              </SelectTrigger>
              <SelectContent>
                {testCycles.map((tc) => (
                  <SelectItem key={tc.id} value={tc.id}>
                    {tc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>截止日期</Label>
            <DatePicker
              date={dueDate}
              onDateChange={onDueDateChange}
              placeholder="选择截止日期"
            />
          </div>
          <Button
            className="w-full"
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
          >
            {isPending ? '创建中...' : '创建'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
