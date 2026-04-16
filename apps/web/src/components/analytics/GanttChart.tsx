'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge, RiskLevel } from './RiskBadge';
import { ChangeLogPanel } from './ChangeLogPanel';

interface GanttData {
  id: string;
  code: string;
  title: string;
  type: 'requirement' | 'issue';
  assigneeId: string;
  assigneeName: string;
  startDate: string | null;
  endDate: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  currentStage: string;
  status: string;
  delayedDays: number;
  riskLevel: string;
  changeLogs: {
    id: string;
    changeType: string;
    oldValue: string | null;
    newValue: string | null;
    reason: string;
    createdAt: string;
    operatorName: string;
  }[];
  stageHistory: {
    stage: string;
    enteredAt: string;
    leftAt: string | null;
  }[];
}

interface GanttChartProps {
  data: GanttData[] | null;
  isLoading: boolean;
  onItemClick?: (item: any) => void;
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

const riskColors: Record<RiskLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export function GanttChart({ data, isLoading }: GanttChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedItem, setSelectedItem] = useState<GanttData | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    // 计算时间范围
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 14);

    // 准备甘特图数据
    const tasks = data.slice(0, 20).map((item, index) => {
      const start = item.plannedStartDate ? new Date(item.plannedStartDate) : (item.startDate ? new Date(item.startDate) : today);
      const end = item.plannedEndDate ? new Date(item.plannedEndDate) : (item.endDate ? new Date(item.endDate) : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));

      return {
        name: `${item.code} ${item.title}`,
        value: [
          index,
          start.getTime(),
          end.getTime(),
          item.assigneeName,
          item.type,
          item.delayedDays,
        ],
        itemStyle: {
          color: item.type === 'requirement' ? '#3b82f6' : '#ef4444',
          borderColor: riskColors[item.riskLevel as RiskLevel],
          borderWidth: item.delayedDays > 0 ? 2 : 0,
          borderType: item.delayedDays > 0 ? 'dashed' : 'solid',
        },
        rawData: item,
      };
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const item = params.data.rawData as GanttData;
          const start = new Date(params.data.value[1]).toLocaleDateString();
          const end = new Date(params.data.value[2]).toLocaleDateString();

          let html = `
            <div style="padding: 8px; max-width: 300px;">
              <div style="font-weight: bold; margin-bottom: 8px;">${item.code} ${item.title}</div>
              <div style="font-size: 12px; color: #9ca3af;">
                <div>负责人: ${item.assigneeName}</div>
                <div>阶段: ${stageLabels[item.currentStage] || item.currentStage}</div>
                <div>计划: ${start} - ${end}</div>
                ${item.delayedDays > 0 ? `<div style="color: #ef4444;">延期 ${item.delayedDays} 天</div>` : ''}
              </div>
          `;

          if (item.changeLogs.length > 0) {
            html += `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 12px; font-weight: bold;">📝 变更记录:</div>
            `;
            item.changeLogs.slice(0, 3).forEach(log => {
              const date = new Date(log.createdAt).toLocaleDateString();
              html += `<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">• ${date} ${log.operatorName}: ${log.reason}</div>`;
            });
            if (item.changeLogs.length > 3) {
              html += `<div style="font-size: 11px; color: #9ca3af;">...还有 ${item.changeLogs.length - 3} 条记录</div>`;
            }
            html += `</div>`;
          }

          html += `</div>`;
          return html;
        },
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: {
          color: '#fff',
        },
      },
      grid: {
        left: '200',
        right: '50',
        top: '50',
        bottom: '50',
      },
      xAxis: {
        type: 'time',
        position: 'top',
        min: startDate.getTime(),
        max: endDate.getTime(),
        axisLabel: {
          color: '#9ca3af',
          formatter: (value: number) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          },
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
      yAxis: {
        type: 'category',
        data: tasks.map(t => t.name),
        axisLabel: {
          color: '#9ca3af',
          width: 180,
          overflow: 'truncate',
          ellipsis: '...',
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
      series: [
        {
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const categoryIndex = api.value(0);
            const start = api.coord([api.value(1), categoryIndex]);
            const end = api.coord([api.value(2), categoryIndex]);
            const height = 20;

            const rectShape = echarts.graphic.clipRectByRect(
              {
                x: start[0],
                y: start[1] - height / 2,
                width: Math.max(end[0] - start[0], 1),
                height: height,
              },
              {
                x: params.coordSys.x,
                y: params.coordSys.y,
                width: params.coordSys.width,
                height: params.coordSys.height,
              }
            );

            return (
              rectShape && {
                type: 'rect',
                shape: rectShape,
                style: api.style(),
              }
            );
          },
          encode: {
            x: [1, 2],
            y: 0,
          },
          data: tasks,
        },
        // 今日标记线
        {
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                xAxis: today.getTime(),
                lineStyle: {
                  color: '#f59e0b',
                  type: 'dashed',
                  width: 2,
                },
                label: {
                  formatter: '今日',
                  color: '#f59e0b',
                },
              },
            ],
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    // 点击事件
    chartInstance.current.on('click', (params: any) => {
      if (params.data && params.data.rawData) {
        setSelectedItem(params.data.rawData);
      }
    });

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="h-96 bg-muted rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">甘特图 - 时间线视图</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-muted-foreground">需求</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-muted-foreground">问题单</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-yellow-500"></div>
              <span className="text-muted-foreground">今日</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={chartRef} className="h-96"></div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            点击任务条目查看详细变更记录
          </p>
        </CardContent>
      </Card>

      {selectedItem && (
        <ChangeLogPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
