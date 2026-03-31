'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore, isPMOrAdmin } from '@/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  WorkloadChart,
  RequirementRiskChart,
  IssueRiskChart,
  GanttChart,
  ChangeLogPanel,
  RiskBadge,
} from '@/components/analytics';

const roleLabels: Record<string, string> = {
  PM: '项目经理',
  MEMBER: '组员',
  ADMIN: '管理员',
};

const roleColors: Record<string, string> = {
  PM: 'bg-purple-500/20 text-purple-400',
  MEMBER: 'bg-gray-500/20 text-gray-400',
  ADMIN: 'bg-blue-500/20 text-blue-400',
};

type ViewTab = 'workload' | 'requirements' | 'issues' | 'gantt';
type ChartType = 'overview' | 'distribution' | 'list';

export default function UsersPage() {
  const { user, currentVersionId, setCurrentVersionId } = useAppStore();
  const [activeTab, setActiveTab] = useState<ViewTab>('workload');
  const [chartType, setChartType] = useState<ChartType>('overview');
  const [selectedGanttItem, setSelectedGanttItem] = useState<any>(null);

  // 获取版本列表
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['versions'],
    queryFn: () => api.getVersions(),
  });

  const selectedVersionId = currentVersionId || (versions.length > 0 ? versions[0].id : null);
  const canViewAnalytics = isPMOrAdmin(user?.role);

  // 获取用户列表
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getAssignees(),
  });

  // 获取分析数据
  const { data: teamOverview } = useQuery({
    queryKey: ['team-overview', selectedVersionId],
    queryFn: () => api.getTeamOverview(selectedVersionId!),
    enabled: !!selectedVersionId && canViewAnalytics,
  });

  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ['workload', selectedVersionId],
    queryFn: () => api.getWorkload(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const { data: requirementRisks, isLoading: reqRisksLoading } = useQuery({
    queryKey: ['requirement-risks', selectedVersionId],
    queryFn: () => api.getRequirementRisks(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const { data: issueRisks, isLoading: issueRisksLoading } = useQuery({
    queryKey: ['issue-risks', selectedVersionId],
    queryFn: () => api.getIssueRisks(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const { data: ganttData, isLoading: ganttLoading } = useQuery({
    queryKey: ['gantt', selectedVersionId],
    queryFn: () => api.getGanttData(selectedVersionId!),
    enabled: !!selectedVersionId && canViewAnalytics,
  });

  const isLoading = usersLoading || versionsLoading;

  // 按风险排序
  const sortedWorkload = [...(workloadData || [])].sort((a: any, b: any) => b.riskScore - a.riskScore);

  // Tab 配置
  const tabs: { key: ViewTab; label: string; icon: string }[] = [
    { key: 'workload', label: '员工负荷', icon: '👥' },
    { key: 'requirements', label: '需求风险', icon: '📋' },
    { key: 'issues', label: '问题单风险', icon: '🐛' },
    { key: 'gantt', label: '甘特图', icon: '📅' },
  ];

  // 图表类型配置
  const chartTypes: { key: ChartType; label: string; icon: string }[] = [
    { key: 'overview', label: '概览', icon: '📊' },
    { key: 'distribution', label: '分布', icon: '🥧' },
    { key: 'list', label: '详情', icon: '📋' },
  ];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header: 标题 + 版本选择器 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">用户管理与团队分析</h1>
        <select
          value={selectedVersionId || ''}
          onChange={(e) => setCurrentVersionId(e.target.value || null)}
          className="bg-muted border border-border rounded px-3 py-2 text-sm"
        >
          <option value="">选择版本</option>
          {versions.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* KPI 卡片 - 仅 PM/Admin 可见 */}
      {canViewAnalytics && teamOverview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">高风险员工</p>
                  <p className="text-2xl font-bold text-red-400">{teamOverview.highRiskCount}</p>
                </div>
                <span className="text-2xl">⚠️</span>
              </div>
              {teamOverview.highRiskMembers?.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {teamOverview.highRiskMembers.slice(0, 2).join(', ')}
                  {teamOverview.highRiskMembers.length > 2 && '...'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">已延期</p>
                  <p className="text-2xl font-bold text-orange-400">{teamOverview.delayedCount}</p>
                </div>
                <span className="text-2xl">🔴</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">今日到期</p>
                  <p className="text-2xl font-bold text-yellow-400">{teamOverview.dueTodayCount}</p>
                </div>
                <span className="text-2xl">📅</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">总负荷</p>
                  <p className="text-2xl font-bold text-blue-400">{teamOverview.totalWorkload}</p>
                </div>
                <span className="text-2xl">📈</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 左侧：维度切换 + 图表区 (3/4) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab 切换 - 仅 PM/Admin 可见分析维度 */}
          {canViewAnalytics ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setChartType('overview');
                    }}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* 图表类型切换 */}
              {activeTab !== 'gantt' && (
                <div className="flex items-center gap-2">
                  {chartTypes.map((ct) => (
                    <button
                      key={ct.key}
                      onClick={() => setChartType(ct.key)}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        chartType === ct.key
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {ct.icon} {ct.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 图表内容区 */}
              <Card className="glass min-h-[400px]">
                <CardContent className="pt-4">
                  {!selectedVersionId ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      请先选择版本
                    </div>
                  ) : activeTab === 'workload' ? (
                    <WorkloadChart
                      data={workloadData || null}
                      isLoading={workloadLoading}
                      viewType={chartType === 'list' ? 'list' : 'chart'}
                    />
                  ) : activeTab === 'requirements' ? (
                    <RequirementRiskChart
                      data={requirementRisks || null}
                      isLoading={reqRisksLoading}
                      viewType={chartType === 'list' ? 'list' : 'chart'}
                    />
                  ) : activeTab === 'issues' ? (
                    <IssueRiskChart
                      data={issueRisks || null}
                      isLoading={issueRisksLoading}
                      viewType={chartType === 'list' ? 'list' : 'chart'}
                    />
                  ) : (
                    <GanttChart
                      data={ganttData || null}
                      isLoading={ganttLoading}
                      onItemClick={(item: any) => setSelectedGanttItem(item)}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            /* Member 用户只看提示 */
            <Card className="glass min-h-[400px]">
              <CardContent className="pt-4">
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  请联系项目管理员查看分析数据
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：员工卡片列表 (1/4) */}
        <div className="lg:col-span-1">
          <Card className="glass sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {canViewAnalytics ? '团队成员' : '我的信息'}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-200px)] overflow-auto space-y-2">
              {sortedWorkload.length > 0 ? (
                sortedWorkload.map((employee: any) => (
                  <div
                    key={employee.userId}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {employee.userName?.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{employee.userName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {employee.employeeNo}
                        </div>
                      </div>
                    </div>

                    {/* 负荷统计 - 选中版本后显示 */}
                    {selectedVersionId && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5 text-xs mb-2">
                          <div className="flex justify-between p-1.5 rounded bg-blue-500/10">
                            <span className="text-muted-foreground">需求</span>
                            <span className="text-blue-400 font-medium">{employee.requirementCount}</span>
                          </div>
                          <div className="flex justify-between p-1.5 rounded bg-orange-500/10">
                            <span className="text-muted-foreground">问题</span>
                            <span className="text-orange-400 font-medium">{employee.issueCount}</span>
                          </div>
                          <div className="flex justify-between p-1.5 rounded bg-red-500/10">
                            <span className="text-muted-foreground">紧急</span>
                            <span className="text-red-400 font-medium">{employee.highPriorityIssueCount}</span>
                          </div>
                          <div className="flex justify-between p-1.5 rounded bg-yellow-500/10">
                            <span className="text-muted-foreground">延期</span>
                            <span className="text-yellow-400 font-medium">{employee.delayedCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">风险等级</span>
                          <RiskBadge level={employee.riskLevel} score={employee.riskScore} />
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  暂无员工数据
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 变更日志详情面板 */}
      {selectedGanttItem && (
        <ChangeLogPanel
          item={selectedGanttItem}
          onClose={() => setSelectedGanttItem(null)}
        />
      )}
    </div>
  );
}
