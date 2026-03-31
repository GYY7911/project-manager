'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge, RiskLevel } from './RiskBadge';

interface RequirementRiskData {
  id: string;
  code: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  riskScore: number;
  riskLevel: string;
  delayedDays: number;
  dueDate: string | null;
  factors: string[];
  status: string;
  currentStage: string;
}

interface RequirementRiskChartProps {
  data: RequirementRiskData[] | null;
  isLoading: boolean;
  viewType: 'chart' | 'list';
}

const stageLabels: Record<string, string> = {
  REQUIREMENT_DESIGN: '需求设计',
  ALPHA_TEST_DESIGN: 'Alpha测试设计',
  DOCUMENT_SIGN: '文档会签',
  FEATURE_DEV: '功能开发',
  ALPHA_CASE_DEV: 'Alpha用例开发',
  SOP_UPGRADE: '升级SOP',
  VERSION_TEST: '版本转测',
  ISSUE_FIX: '修改问题单',
  CCB_REVIEW: 'CCB评审',
  RELEASE: '版本发布',
};

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  BLOCKED: '阻塞',
};

export function RequirementRiskChart({ data, isLoading, viewType }: RequirementRiskChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || viewType !== 'chart') return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    // 统计各风险等级数量
    const riskCounts = {
      critical: data.filter(d => d.riskLevel === 'critical').length,
      high: data.filter(d => d.riskLevel === 'high').length,
      medium: data.filter(d => d.riskLevel === 'medium').length,
      low: data.filter(d => d.riskLevel === 'low').length,
    };

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: {
          color: '#fff',
        },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: {
          color: '#9ca3af',
        },
      },
      series: [
        {
          name: '风险分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: 'rgba(0, 0, 0, 0.2)',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            { value: riskCounts.critical, name: '严重', itemStyle: { color: '#ef4444' } },
            { value: riskCounts.high, name: '高', itemStyle: { color: '#f97316' } },
            { value: riskCounts.medium, name: '中', itemStyle: { color: '#eab308' } },
            { value: riskCounts.low, name: '低', itemStyle: { color: '#22c55e' } },
          ],
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data, viewType]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="h-80 bg-muted rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewType === 'list') {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <Card key={item.id} className="glass">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-blue-400">{item.code}</span>
                    <RiskBadge level={item.riskLevel as RiskLevel} score={item.riskScore} showScore />
                    {item.delayedDays > 0 && (
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                        延期{item.delayedDays}天
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium mb-1">{item.title}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>负责人: {item.assigneeName}</span>
                    <span>阶段: {stageLabels[item.currentStage] || item.currentStage}</span>
                    <span>状态: {statusLabels[item.status] || item.status}</span>
                    {item.dueDate && (
                      <span>截止: {new Date(item.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                  {item.factors.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.factors.map((factor, idx) => (
                        <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                          {factor}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">需求风险分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-80"></div>
      </CardContent>
    </Card>
  );
}
