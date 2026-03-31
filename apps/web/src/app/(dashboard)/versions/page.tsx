'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAppStore, isPMOrAdmin } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Plus, Edit, Trash2, TestTube, Rocket, X, ArrowRight, AlertCircle, AlertTriangle, FileText, Bug, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/lib/date';
import { AutoWelcomeDialog } from '@/components/welcome';

const statusLabels: Record<string, string> = {
  PLANNING: '计划中',
  DEVELOPMENT: '开发中',
  TESTING: '测试中',
  RELEASED: '已发布',
};

const statusColors: Record<string, string> = {
  PLANNING: 'bg-gray-500/20 text-gray-400',
  DEVELOPMENT: 'bg-blue-500/20 text-blue-400',
  TESTING: 'bg-yellow-500/20 text-yellow-400',
  RELEASED: 'bg-green-500/20 text-green-400',
};

function VersionsContent() {
  const router = useRouter();
  const { user, onboardingStatus, resetOnboarding, currentVersionId, setCurrentVersionId } = useAppStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTestCycleOpen, setIsTestCycleOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [testCycleName, setTestCycleName] = useState('');

  // 编辑状态
  const [editingVersion, setEditingVersion] = useState<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  // 删除确认状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<{ requirements: number; issues: number; testCycles: number } | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  // 欢迎提示 - 从看板跳转过来时显示
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true);
    }
  }, [searchParams]);

  // 继续引导提示
  const showOnboardingPrompt = onboardingStatus === 'in_progress';

  const handleContinueOnboarding = () => {
    router.push('/onboard');
  };

  const handleAbandonOnboarding = () => {
    resetOnboarding();
  };

  const { data: versions = [] } = useQuery({
    queryKey: ['versions'],
    queryFn: api.getVersions,
  });

  // 空状态判断 - 只有 PM 用户且版本列表为空时触发
  const isUserPM = isPMOrAdmin(user?.role);
  const hasNoVersions = versions.length === 0 && isUserPM;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) => {
      if (editingVersion) {
        return api.updateVersion(editingVersion.id, data);
      }
      return api.createVersion(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      setIsCreateOpen(false);
      setForm({ name: '', startDate: '', endDate: '' });
      setEditingVersion(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => api.deleteVersion(id, force),
    onSuccess: (_, variables) => {
      const deletedVersionId = variables.id;

      // 如果删除的是当前选中的版本，清除 currentVersionId 和看板缓存
      if (deletedVersionId === currentVersionId) {
        setCurrentVersionId(null);
        queryClient.removeQueries({ queryKey: ['board', deletedVersionId] });
        queryClient.removeQueries({ queryKey: ['delay-configs', deletedVersionId] });
      }

      queryClient.invalidateQueries({ queryKey: ['versions'] });
      setDeleteConfirmOpen(false);
      setVersionToDelete(null);
      setDeleteError(null);
      setForceDelete(false);
      if (variables.force) {
        toast.success('版本已强制删除', {
          description: '包含的所有关联数据已一并删除',
        });
      } else {
        toast.success('版本已删除');
      }
    },
    onError: (error: any) => {
      const errorData = error.response?.data;
      if (errorData?.details) {
        setDeleteError(errorData.details);
      }
    },
  });

  const createTestCycleMutation = useMutation({
    mutationFn: (name: string) =>
      api.createTestCycle({ name, versionId: selectedVersionId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      setTestCycleName('');
      setIsTestCycleOpen(false);
    },
  });

  const deleteTestCycleMutation = useMutation({
    mutationFn: api.deleteTestCycle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
  });

  const handleCreate = () => {
    createMutation.mutate(form);
  };

  const handleEditClick = (version: any) => {
    setEditingVersion({
      id: version.id,
      name: version.name,
      startDate: new Date(version.startDate).toISOString().split('T')[0],
      endDate: new Date(version.endDate).toISOString().split('T')[0],
    });
    setForm({
      name: version.name,
      startDate: new Date(version.startDate).toISOString().split('T')[0],
      endDate: new Date(version.endDate).toISOString().split('T')[0],
    });
    setIsCreateOpen(true);
  };

  const handleDeleteClick = (version: any) => {
    setVersionToDelete({ id: version.id, name: version.name });
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (versionToDelete) {
      deleteMutation.mutate({ id: versionToDelete.id, force: forceDelete });
    }
  };

  const handleCreateTestCycle = () => {
    if (testCycleName && selectedVersionId) {
      createTestCycleMutation.mutate(testCycleName);
    }
  };

  return (
    <div className="p-6">
      {/* 继续引导提示 */}
      {showOnboardingPrompt && (
        <div className="mb-6 p-4 rounded-lg glass border border-yellow-500/30 bg-yellow-500/5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <div>
                <h3 className="font-semibold">您有未完成的引导设置</h3>
                <p className="text-muted-foreground text-sm">
                  之前的引导流程未完成，是否继续完成设置？
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAbandonOnboarding}
                className="text-muted-foreground"
              >
                放弃
              </Button>
              <Button size="sm" onClick={handleContinueOnboarding}>
                继续引导
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 欢迎提示 */}
      {showWelcome && (
        <div className="mb-6 p-4 rounded-lg glass border border-primary/30 bg-primary/5 relative">
          <button
            onClick={() => setShowWelcome(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-bold text-lg">开始你的第一个版本</h3>
              <p className="text-muted-foreground text-sm">
                点击右侧「新建版本」按钮，创建你的第一个版本迭代
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">版本管理</h1>
        {isPMOrAdmin(user?.role) && (
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setEditingVersion(null);
              setForm({ name: '', startDate: '', endDate: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建版本
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader className="pb-4">
                <DialogTitle>{editingVersion ? '编辑版本' : '新建版本'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-2">
                <div className="space-y-2">
                  <Label htmlFor="version-name">版本名称</Label>
                  <Input
                    id="version-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如: V2026.Q1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>日期范围</Label>
                  <DateRangePicker
                    startDate={form.startDate ? new Date(form.startDate) : undefined}
                    endDate={form.endDate ? new Date(form.endDate) : undefined}
                    onStartDateChange={(date) => setForm({ ...form, startDate: date ? formatLocalDate(date) : '' })}
                    onEndDateChange={(date) => setForm({ ...form, endDate: date ? formatLocalDate(date) : '' })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? (editingVersion ? '保存中...' : '创建中...')
                    : (editingVersion ? '保存' : '创建')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {versions.map((version: any) => (
          <Card key={version.id} className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>{version.name}</CardTitle>
                <span className={cn('text-xs px-2 py-1 rounded-full', statusColors[version.status])}>
                  {statusLabels[version.status]}
                </span>
              </div>
              {isPMOrAdmin(user?.role) && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditClick(version)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleDeleteClick(version)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                <Dialog
                  open={isTestCycleOpen && selectedVersionId === version.id}
                  onOpenChange={(open) => {
                    setIsTestCycleOpen(open);
                    setSelectedVersionId(open ? version.id : null);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <TestTube className="h-4 w-4 mr-2" />
                      管理转测版本
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>管理转测版本 - {version.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      {/* 现有转测版本 */}
                      <div className="space-y-2">
                        <Label>当前转测版本</Label>
                        <div className="flex flex-wrap gap-2">
                          {version.testCycles?.map((tc: any) => (
                            <div
                              key={tc.id}
                              className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full"
                            >
                              <span className="text-sm">{tc.name}</span>
                              <button
                                onClick={() => deleteTestCycleMutation.mutate(tc.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 添加新转测版本 */}
                      <div className="flex gap-2">
                        <Input
                          value={testCycleName}
                          onChange={(e) => setTestCycleName(e.target.value)}
                          placeholder="转测版本名称"
                        />
                        <Button onClick={handleCreateTestCycle}>添加</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* 日期信息 */}
                <div className="flex gap-8 text-sm text-muted-foreground">
                  <div>
                    <span>开始: </span>
                    <span>{new Date(version.startDate).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
                  </div>
                  <div>
                    <span>结束: </span>
                    <span>{new Date(version.endDate).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
                  </div>
                </div>
                {/* 关联数据统计 */}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{version._count?.requirements ?? 0} 需求</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Bug className="h-4 w-4" />
                    <span>{version._count?.issues ?? 0} 问题单</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span>{version._count?.testCycles ?? 0} 转测</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => {
        setDeleteConfirmOpen(open);
        if (!open) {
          setDeleteError(null);
          setForceDelete(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {deleteError ? '删除失败' : '确认删除'}
            </DialogTitle>
            <DialogDescription>
              {deleteError
                ? `版本「${versionToDelete?.name}」存在关联数据，无法直接删除`
                : `您确定要删除版本「${versionToDelete?.name}」吗？此操作不可撤销。`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* 关联数据提示 */}
            {deleteError && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-400 font-medium mb-3">
                  以下关联数据需要处理：
                </p>
                <ul className="text-sm text-yellow-400/80 space-y-2">
                  {deleteError.requirements > 0 && (
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      需求: {deleteError.requirements} 条
                    </li>
                  )}
                  {deleteError.issues > 0 && (
                    <li className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      问题单: {deleteError.issues} 条
                    </li>
                  )}
                  {deleteError.testCycles > 0 && (
                    <li className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      转测版本: {deleteError.testCycles} 个
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* 强制删除选项 */}
            {deleteError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="force-delete"
                    checked={forceDelete}
                    onCheckedChange={(checked) => setForceDelete(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="force-delete"
                      className="text-sm font-medium text-red-400 cursor-pointer"
                    >
                      强制删除（包含所有关联数据）
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      勾选后将同时删除此版本下的所有需求、问题单、转测版本及相关数据
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 无关联数据时的提示 */}
            {!deleteError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-400">请确认版本下没有关联的需求和问题单</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="w-full sm:w-auto"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending || (deleteError !== null && !forceDelete)}
              className="w-full sm:w-auto"
            >
              {deleteMutation.isPending
                ? '删除中...'
                : forceDelete
                  ? '强制删除'
                  : '确认删除'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Welcome Dialog - triggered when no versions */}
      <AutoWelcomeDialog
        triggerCondition="empty_versions"
        shouldTrigger={hasNoVersions}
      />
    </div>
  );
}

// 包装 Suspense 的默认导出
export default function VersionsPage() {
  return (
    <Suspense fallback={<div className="p-6">加载中...</div>}>
      <VersionsContent />
    </Suspense>
  );
}
