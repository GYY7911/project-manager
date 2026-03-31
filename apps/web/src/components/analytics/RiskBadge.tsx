'use client';

import { Badge } from '@/components/ui/badge';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
}

const riskConfig: Record<RiskLevel, { label: string; className: string; icon: string }> = {
  critical: {
    label: '严重',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: '🔴',
  },
  high: {
    label: '高',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: '🟠',
  },
  medium: {
    label: '中',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: '🟡',
  },
  low: {
    label: '低',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: '🟢',
  },
};

export function RiskBadge({ level, score, showScore = false }: RiskBadgeProps) {
  const config = riskConfig[level] || riskConfig.low;

  return (
    <Badge variant="outline" className={config.className}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
      {showScore && score !== undefined && (
        <span className="ml-1 opacity-70">({score}分)</span>
      )}
    </Badge>
  );
}
