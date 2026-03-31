'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { OnboardingData } from '@/store';
import { api } from '@/lib/api';
import { Rocket, Plus, Trash2 } from 'lucide-react';

interface CreateTestCyclesStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  versionId: string | null;
}

interface TestCycleForm {
  id: string;
  name: string;
  description: string;
}

export function CreateTestCyclesStep({
  data,
  updateData,
  versionId,
}: CreateTestCyclesStepProps) {
  const queryClient = useQueryClient();
  const [testCycles, setTestCycles] = useState<Array<TestCycleForm>>(
    data.testCycles.map((tc, i) => ({
      id: `tc-${i}`,
      name: tc.name,
      description: tc.description || '',
    }))
  );
  const [isCreating, setIsCreating] = useState(false);

  const addTestCycle = () => {
    setTestCycles((prev) => [
      ...prev,
      {
        id: `tc-${Date.now()}`,
        name: `转测${prev.length + 1}`,
        description: '',
      },
    ]);
  };

  const removeTestCycle = (id: string) => {
    setTestCycles((prev) => prev.filter((tc) => tc.id !== id));
  };

  const updateTestCycle = (id: string, field: keyof TestCycleForm, value: string) => {
    setTestCycles((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc))
    );
  };

  const createTestCycles = async () => {
    if (!versionId || testCycles.length === 0) return;

    const validTestCycles = testCycles.filter((tc) => tc.name);
    if (validTestCycles.length === 0) {
      toast.warning('请至少填写一个转测版本名称');
      return;
    }

    setIsCreating(true);
    try {
      let createdCount = 0;
      for (const tc of validTestCycles) {
        await api.createTestCycle({
          versionId,
          name: tc.name,
        });
        createdCount++;
      }

      // 清除已保存的转测版本，避免完成时重复创建
      updateData({
        testCycles: [],
      });

      queryClient.invalidateQueries({ queryKey: ['board', versionId] });
      toast.success(`成功创建 ${createdCount} 个转测版本`);
    } catch (e: any) {
      console.error('Failed to create test cycles', e);
      toast.error(e.message || '创建转测版本失败');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    updateData({
      testCycles: testCycles.map((tc) => ({
        name: tc.name,
        description: tc.description || undefined,
      })),
    });
  }, [testCycles, updateData]);

  const validCount = testCycles.filter((tc) => tc.name).length;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            转测版本代表测试轮次，每个转测版本会作为看板上的一列
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addTestCycle}>
          <Plus className="h-4 w-4 mr-2" />
          添加转测
        </Button>
      </div>

      {/* 转测列表 */}
      {testCycles.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <Rocket className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无转测版本，点击上方按钮添加</p>
          <p className="text-xs mt-2">此步骤可选，可以稍后在版本管理中添加</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {testCycles.map((tc, index) => (
            <div
              key={tc.id}
              className="p-4 rounded-lg border border-white/10 dark:border-white/10 border-slate-200 bg-white/5 dark:bg-white/5 bg-slate-50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">转测 {index + 1}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTestCycle(tc.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">名称 *</Label>
                  <Input
                    value={tc.name}
                    onChange={(e) => updateTestCycle(tc.id, 'name', e.target.value)}
                    placeholder="例如：SIT1、UAT、灰度测试"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">描述（可选）</Label>
                  <Textarea
                    value={tc.description}
                    onChange={(e) => updateTestCycle(tc.id, 'description', e.target.value)}
                    placeholder="测试范围或注意事项..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 提示 */}
      <p className="text-xs text-muted-foreground">
        提示：通常一个版本会有多轮测试，比如 SIT1、SIT2、UAT 等。可以稍后在版本管理中继续添加。
      </p>

      {/* 创建按钮 */}
      {testCycles.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button onClick={createTestCycles} disabled={isCreating || !versionId || validCount === 0}>
            {isCreating ? '创建中...' : `创建 ${validCount} 个转测版本`}
          </Button>
        </div>
      )}
    </div>
  );
}
