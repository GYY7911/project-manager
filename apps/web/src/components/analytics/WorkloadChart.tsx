'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge, RiskLevel } from './RiskBadge';

interface WorkloadData {
  userId: string;
  userName: string;
  employeeNo: string;
  role: string;
  requirementCount: number;
  issueCount: number;
  highPriorityIssueCount: number;
  delayedCount: number;
  riskScore: number;
  riskLevel: string;
}

interface WorkloadChartProps {
  data: WorkloadData[] | null;
  isLoading: boolean;
  viewType: 'chart' | 'list';
}

export function WorkloadChart({ data, isLoading, viewType }: WorkloadChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || viewType !== 'chart') return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    const sortedData = [...data].sort((a, b) => (b.requirementCount + b.issueCount) - (a.requirementCount + a.issueCount));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: {
          color: '#fff',
        },
      },
      legend: {
        data: ['需求数', '问题单数', '高优先级问题', '延期数'],
        textStyle: {
          color: '#9ca3af',
        },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: sortedData.map(d => d.userName),
        axisLabel: {
          color: '#9ca3af',
          rotate: sortedData.length > 8 ? 30 : 0,
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#9ca3af',
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
      series: [
        {
          name: '需求数',
          type: 'bar',
          stack: 'total',
          data: sortedData.map(d => d.requirementCount),
          itemStyle: {
            color: '#3b82f6',
          },
        },
        {
          name: '问题单数',
          type: 'bar',
          stack: 'total',
          data: sortedData.map(d => d.issueCount),
          itemStyle: {
            color: '#f97316',
          },
        },
        {
          name: '高优先级问题',
          type: 'bar',
          stack: 'total',
          data: sortedData.map(d => d.highPriorityIssueCount),
          itemStyle: {
            color: '#ef4444',
          },
        },
        {
          name: '延期数',
          type: 'bar',
          data: sortedData.map(d => d.delayedCount),
          itemStyle: {
            color: '#dc2626',
          },
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.userId} className="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium">{item.userName}</h4>
                  <p className="text-sm text-muted-foreground">{item.employeeNo}</p>
                </div>
                <RiskBadge level={item.riskLevel as RiskLevel} score={item.riskScore} showScore />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">需求</span>
                  <span className="text-blue-400">{item.requirementCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">问题单</span>
                  <span className="text-orange-400">{item.issueCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">延期</span>
                  <span className="text-red-400">{item.delayedCount}</span>
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
        <CardTitle className="text-lg">员工负荷分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-80"></div>
      </CardContent>
    </Card>
  );
}
