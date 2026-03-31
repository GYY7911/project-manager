'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge, RiskLevel } from './RiskBadge';

interface IssueRiskData {
  id: string;
  code: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  severity: string;
  riskScore: number;
  riskLevel: string;
  delayedDays: number;
  status: string;
  currentStage: string;
  factors: string[];
}

interface IssueRiskChartProps {
  data: IssueRiskData[] | null;
  isLoading: boolean;
  viewType: 'chart' | 'list';
}

const severityLabels: Record<string, string> = {
  CRITICAL: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const severityColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

const statusLabels: Record<string, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '进行中',
  FIXED: '已修复',
  VERIFIED: '已验证',
  CLOSED: '已关闭',
};

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

export function IssueRiskChart({ data, isLoading, viewType }: IssueRiskChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || viewType !== 'chart') return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    // 统计各严重程度数量
    const severityCounts = {
      CRITICAL: data.filter(d => d.severity === 'CRITICAL').length,
      HIGH: data.filter(d => d.severity === 'HIGH').length,
      MEDIUM: data.filter(d => d.severity === 'MEDIUM').length,
      LOW: data.filter(d => d.severity === 'LOW').length,
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
          name: '严重程度分布',
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
            { value: severityCounts.CRITICAL, name: '紧急', itemStyle: { color: severityColors.CRITICAL } },
            { value: severityCounts.HIGH, name: '高', itemStyle: { color: severityColors.HIGH } },
            { value: severityCounts.MEDIUM, name: '中', itemStyle: { color: severityColors.MEDIUM } },
            { value: severityCounts.LOW, name: '低', itemStyle: { color: severityColors.LOW } },
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
                    <span className="font-mono text-sm text-red-400">{item.code}</span>
                    <RiskBadge level={item.riskLevel as RiskLevel} score={item.riskScore} showScore />
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${severityColors[item.severity]}20`,
                        color: severityColors[item.severity],
                      }}
                    >
                      {severityLabels[item.severity] || item.severity}
                    </span>
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
        <CardTitle className="text-lg">问题单严重程度分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-80"></div>
      </CardContent>
    </Card>
  );
}
