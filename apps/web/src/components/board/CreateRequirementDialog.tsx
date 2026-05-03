'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Assignee {
  id: string;
  name: string;
  employeeNo: string;
}

interface CreateRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  title: string;
  assigneeId: string;
  workload: string;
  dueDate: Date | undefined;
  onCodeChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onWorkloadChange: (value: string) => void;
  onDueDateChange: (date: Date | undefined) => void;
  assignees: Assignee[];
  isPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}

export function CreateRequirementDialog({
  open,
  onOpenChange,
  code,
  title,
  assigneeId,
  workload,
  dueDate,
  onCodeChange,
  onTitleChange,
  onAssigneeChange,
  onWorkloadChange,
  onDueDateChange,
  assignees,
  isPending,
  onSubmit,
  canSubmit,
}: CreateRequirementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建需求</DialogTitle>
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
              placeholder="FE20260310001"
              className="font-mono"
            />
          </div>
          <div>
            <Label>标题 *</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="需求标题"
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
            <Label>工作量 (人/天)</Label>
            <Input
              type="number"
              value={workload}
              onChange={(e) => onWorkloadChange(e.target.value)}
              placeholder="预计工作量"
            />
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
