'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { EmployeeList } from './components/EmployeeList';
import { CreditDetailPanel } from './components/CreditDetailPanel';
import { CorrectRecordDialog } from './components/CorrectRecordDialog';

interface CreditRecord {
  id: string;
  score: number;
  sourceType: string;
  remark?: string;
  createdAt: string;
  workflowStage?: string;
  delayDays?: number | null;
  plannedDate?: string | Date | null;
  actualDate?: string | Date | null;
  isCorrected?: boolean;
  correctedAt?: string | Date | null;
  correctionRemark?: string;
  requirement?: { code: string; title: string; currentStage: string };
  issue?: { code: string; title: string; currentStage: string; severity: string };
  rule?: { name: string; score: number };
  corrections?: { id: string; reason: string; scoreDiff: number; createdAt: string; operator: { name: string } }[];
}

export default function CreditsPage() {
  const { user, currentVersionId, setCurrentVersionId } = useAppStore();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isCorrectOpen, setIsCorrectOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CreditRecord | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    userId: '',
    score: 0,
    remark: '',
  });

  const canManage = isPMOrAdmin(user?.role);

  // 获取版本列表
  const { data: versions = [] } = useQuery({
    queryKey: ['versions'],
    queryFn: api.getVersions,
  });

  // 获取信用汇总列表
  const { data: summaries = [] } = useQuery({
    queryKey: ['creditSummaries', currentVersionId],
    queryFn: () => (currentVersionId ? api.getCreditSummaries(currentVersionId) : []),
    enabled: !!currentVersionId && canManage,
  });

  // 获取信用规则
  const { data: rules = [] } = useQuery({
    queryKey: ['creditRules'],
    queryFn: api.getCreditRules,
    enabled: canManage,
  });

  // 获取选中用户的详情
  const {
    data: detailData,
    isLoading: detailLoading,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['creditDetail', selectedUserId, currentVersionId],
    queryFn: () => api.getCreditDetail(selectedUserId!, currentVersionId!),
    enabled: !!selectedUserId && !!currentVersionId && canManage,
  });

  // 手动调整
  const adjustMutation = useMutation({
    mutationFn: () =>
      api.manualAdjustCredit({
        ...adjustForm,
        versionId: currentVersionId!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditSummaries', currentVersionId] });
      setIsAdjustOpen(false);
      setAdjustForm({ userId: '', score: 0, remark: '' });
    },
  });

  // 矫正成功后刷新
  const handleCorrectSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['creditSummaries', currentVersionId] });
    refetchDetail();
  };

  // 打开矫正弹窗
  const handleCorrect = (record: CreditRecord) => {
    setSelectedRecord(record);
    setIsCorrectOpen(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">信用管理</h1>
        <div className="flex items-center gap-4">
          <Select
            value={currentVersionId || ''}
            onValueChange={setCurrentVersionId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择版本" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                手动调整
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>手动调整信用</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>选择员工</Label>
                  <Select
                    value={adjustForm.userId}
                    onValueChange={(value) =>
                      setAdjustForm({ ...adjustForm, userId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择员工" />
                    </SelectTrigger>
                    <SelectContent>
                      {summaries.map((s: any) => (
                        <SelectItem key={s.user.id} value={s.user.id}>
                          {s.user.name} ({s.user.employeeNo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>分数</Label>
                  <Input
                    type="number"
                    value={adjustForm.score}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, score: Number(e.target.value) })
                    }
                    placeholder="正数加分，负数扣分"
                  />
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Input
                    value={adjustForm.remark}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, remark: e.target.value })
                    }
                    placeholder="调整原因"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => adjustMutation.mutate()}
                  disabled={adjustMutation.isPending}
                >
                  {adjustMutation.isPending ? '提交中...' : '提交'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 信用规则 */}
      <Card className="glass mb-6">
        <CardHeader>
          <CardTitle className="text-lg">信用规则</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rules.map((rule: any) => (
              <div
                key={rule.id}
                className="p-3 rounded-lg bg-white/5 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.description}
                  </p>
                </div>
                <span
                  className={`text-lg font-bold ${
                    rule.score > 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {rule.score > 0 ? '+' : ''}
                  {rule.score}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 主内容区：左右两栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 左侧：员工列表 */}
        <div className="lg:col-span-1">
          <Card className="glass sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">员工排名</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-400px)] overflow-auto">
              <EmployeeList
                summaries={summaries}
                selectedUserId={selectedUserId}
                onSelect={setSelectedUserId}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：详情面板 */}
        <div className="lg:col-span-3">
          <CreditDetailPanel
            data={detailData}
            isLoading={detailLoading}
            canManage={canManage}
            onCorrect={handleCorrect}
            onRefresh={handleCorrectSuccess}
          />
        </div>
      </div>

      {/* 矫正弹窗 */}
      <CorrectRecordDialog
        open={isCorrectOpen}
        onOpenChange={setIsCorrectOpen}
        record={selectedRecord}
        onSuccess={handleCorrectSuccess}
      />
    </div>
  );
}
