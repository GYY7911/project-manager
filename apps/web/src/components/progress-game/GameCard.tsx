'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowStage } from '@pm/shared';

interface GameCardProps {
  id: string;
  code: string;
  title: string;
  type: 'requirement' | 'issue';
  assignee: { name: string };
  currentStage: WorkflowStage;
  targetColumnColor: string;
  isAtCheckpoint: boolean;
  shadowStages: WorkflowStage[]; // 影子所在的阶段列表
  isAdvancing: boolean;
  isExploding?: boolean; // 是否正在播放爆炸动画
  isReappearing?: boolean; // 是否正在播放重新出现动画（过卡点后在新位置出现）
  onAdvance: () => void;
  onPassCheckpoint: () => void;
  isShadow?: boolean; // 是否是影子卡片
  shadowPosition?: number; // 影子位置（0=主卡片，1+=影子）
  passedCheckpointLabels?: string[]; // 已通过的卡点标记
  isGameActive?: boolean; // 游戏是否活跃（退出后为 false）
}

// 列颜色映射
const COLUMN_COLORS: Record<string, string> = {
  [WorkflowStage.REQUIREMENT_DESIGN]: '#3b82f6', // blue
  [WorkflowStage.ALPHA_TEST_DESIGN]: '#8b5cf6', // violet
  [WorkflowStage.DOCUMENT_SIGN]: '#f59e0b', // amber
  [WorkflowStage.FEATURE_DEV]: '#10b981', // green
  [WorkflowStage.ALPHA_CASE_DEV]: '#06b6d4', // cyan
  [WorkflowStage.SOP_UPGRADE]: '#ec4899', // pink
  [WorkflowStage.VERSION_TEST]: '#6366f1', // indigo
  [WorkflowStage.ISSUE_FIX]: '#ef4444', // red
  [WorkflowStage.CCB_REVIEW]: '#f97316', // orange
  [WorkflowStage.RELEASE]: '#22c55e', // emerald
};

// 爆炸粒子配置
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
  rotation: number;
}

export function GameCard({
  id,
  code,
  title,
  type,
  assignee,
  currentStage,
  targetColumnColor,
  isAtCheckpoint,
  shadowStages,
  isAdvancing,
  isExploding = false,
  isReappearing = false,
  onAdvance,
  onPassCheckpoint,
  isShadow = false,
  shadowPosition = 0,
  passedCheckpointLabels = [],
  isGameActive = true,
}: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showExplosion, setShowExplosion] = useState(false);
  const [showReappear, setShowReappear] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 获取当前列颜色
  const currentColor = COLUMN_COLORS[currentStage] || '#64748b';

  // 计算透明度：
  // - 主卡片（当前列）：100% 亮度，不受影子影响
  // - 影子卡片（前一列）：50% 透明度
  const calculateOpacity = (): number => {
    if (isShadow) {
      // 影子卡片：50% 透明度
      return 0.5;
    }
    // 主卡片：始终保持100%亮度
    return 1;
  };

  const cardOpacity = calculateOpacity();

  // 爆炸动画效果
  useEffect(() => {
    if (isExploding && cardRef.current && !showExplosion) {
      setShowExplosion(true);
      const rect = cardRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // 生成爆炸粒子
      const newParticles: Particle[] = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        x: centerX,
        y: centerY,
        color: [
          '#ffd700', // gold
          '#ff6b6b', // red
          '#4ecdc4', // cyan
          '#a855f7', // purple
          currentColor,
        ][Math.floor(Math.random() * 5)],
        size: Math.random() * 12 + 6,
        velocity: {
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400 - 100,
        },
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);
    } else if (!isExploding) {
      setShowExplosion(false);
      setParticles([]);
    }
  }, [isExploding, currentColor, showExplosion]);

  // 重新出现动画效果
  useEffect(() => {
    if (isReappearing) {
      setShowReappear(true);
      // 500ms 后清除重新出现状态
      const timer = setTimeout(() => {
        setShowReappear(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isReappearing]);

  // 影子卡片样式
  const shadowStyle = isShadow
    ? {
        background: `linear-gradient(135deg, ${currentColor}10, ${currentColor}20)`,
        border: `1px dashed ${currentColor}50`,
      }
    : {};

  // 玻璃质感样式
  const glassStyle = isHovered && !isShadow && !showExplosion
    ? {
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px ${currentColor}30`,
      }
    : {};

  return (
    <>
      {/* 爆炸粒子效果 */}
      <AnimatePresence>
        {showExplosion && particles.length > 0 && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{
                  x: particle.x,
                  y: particle.y,
                  scale: 1,
                  opacity: 1,
                  rotate: 0,
                }}
                animate={{
                  x: particle.x + particle.velocity.x,
                  y: particle.y + particle.velocity.y + 200,
                  scale: 0,
                  opacity: 0,
                  rotate: particle.rotation + 720,
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{
          opacity: showExplosion ? 0 : cardOpacity,
          scale: showExplosion ? 1.5 : (showReappear ? [0, 1.1, 1] : 1),
          y: 0,
          filter: showExplosion ? 'blur(8px)' : 'blur(0px)',
          boxShadow: showReappear
            ? [
                '0 0 0px rgba(167, 139, 250, 0)',
                '0 0 30px rgba(167, 139, 250, 0.8)',
                '0 0 0px rgba(167, 139, 250, 0)',
              ]
            : undefined,
        }}
        exit={{ opacity: 0, scale: 0.8, filter: 'blur(8px)' }}
        transition={{
          duration: showExplosion ? 0.3 : (showReappear ? 0.5 : 0.2),
          times: showReappear ? [0, 0.6, 1] : undefined,
        }}
        whileHover={!isShadow && !showExplosion && !showReappear ? { scale: 1.02 } : undefined}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={cn(
          'relative p-3 rounded-xl border transition-all duration-200',
          type === 'requirement'
            ? 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20'
            : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20',
          isHovered && !isShadow && !showExplosion && 'ring-2 ring-blue-300 dark:ring-white/20',
          isShadow && 'border-dashed'
        )}
        style={{ ...glassStyle, ...shadowStyle }}
      >
        {/* 影子标记 */}
        {isShadow && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500/50 flex items-center justify-center">
            <span className="text-xs">👻</span>
          </div>
        )}

        {/* 卡片内容 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                type === 'requirement'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
              )}>
                {code}
              </span>
              {/* 卡点标记 */}
              {isAtCheckpoint && !isShadow && !showExplosion && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  🎯 卡点
                </span>
              )}
              {/* 已通过的卡点标记 */}
              {passedCheckpointLabels.length > 0 && !isShadow && (
                passedCheckpointLabels.map((label, idx) => (
                  <span key={idx} className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-green-500/20 dark:text-green-300">
                    {label}
                  </span>
                ))
              )}
              {isShadow && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                  影子
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{assignee.name}</p>
          </div>

          {/* 推进按钮 - 只在游戏活跃时显示，主卡片和影子卡片都可以推进 */}
          <AnimatePresence>
            {isGameActive && isHovered && !isAtCheckpoint && !isAdvancing && !showExplosion && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: 10 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  // 统一调用 onAdvance，不管是否在卡点
                  // 如果在卡点，点击 ">" 按钮也会推进到卡点位置
                  onAdvance();
                }}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  background: `linear-gradient(135deg, ${targetColumnColor}40, ${targetColumnColor}80)`,
                  border: `2px solid ${targetColumnColor}`,
                  boxShadow: `0 0 15px ${targetColumnColor}40`,
                }}
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* 卡点通过按钮 - 只在游戏活跃时显示，主卡片和影子卡片都可以通过 */}
          <AnimatePresence>
            {isGameActive && isHovered && isAtCheckpoint && !isAdvancing && !showExplosion && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: 10 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPassCheckpoint();
                }}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-green-500/80 hover:bg-green-500 border-2 border-green-400 shadow-lg shadow-green-500/50"
              >
                <Check className="w-4 h-4 text-white" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* 加载状态 */}
          {isAdvancing && !showExplosion && (
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-violet-100 dark:bg-violet-500/30">
              <Loader2 className="w-4 h-4 text-violet-600 dark:text-violet-300 animate-spin" />
            </div>
          )}

          {/* 爆炸状态 */}
          {showExplosion && (
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.5, 0] }}
              transition={{ duration: 0.8 }}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/50"
            >
              <span className="text-lg">💥</span>
            </motion.div>
          )}
        </div>

        {/* 影子指示器 - 显示已推进的阶段 */}
        {shadowStages.length > 0 && !isShadow && !showExplosion && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <span className="text-xs text-slate-500">推进:</span>
            <div className="flex items-center gap-0.5">
              {shadowStages.map((stage, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLUMN_COLORS[stage] || targetColumnColor }}
                  title={stage}
                />
              ))}
            </div>
            <span className="text-xs text-violet-600 dark:text-violet-300 ml-1">
              →{currentStage}
            </span>
          </div>
        )}
      </motion.div>
    </>
  );
}

// 卡点通过动画
interface CheckpointPassAnimationProps {
  active: boolean;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  onComplete: () => void;
}

export function CheckpointPassAnimation({
  active,
  originX,
  originY,
  targetX,
  targetY,
  onComplete,
}: CheckpointPassAnimationProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ x: originX, y: originY, scale: 1, opacity: 1 }}
          animate={{
            x: targetX,
            y: targetY,
            scale: [1, 1.2, 0.8, 1],
            opacity: [1, 1, 1, 0],
          }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          onAnimationComplete={() => onComplete()}
          className="fixed pointer-events-none z-50"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/50">
            <Check className="w-6 h-6 text-white" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 列庆祝效果
interface ColumnCelebrationProps {
  active: boolean;
  columnRef: HTMLElement | null;
  onComplete: () => void;
}

export function ColumnCelebration({
  active,
  columnRef,
  onComplete,
}: ColumnCelebrationProps) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    delay: number;
  }>>([]);

  if (active && columnRef && particles.length === 0) {
    const rect = columnRef.getBoundingClientRect();
    const newParticles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: rect.left + Math.random() * rect.width,
      y: rect.top + Math.random() * rect.height,
      color: ['#ffd700', '#4ecdc4', '#a855f7'][Math.floor(Math.random() * 3)],
      delay: Math.random() * 0.3,
    }));
    setParticles(newParticles);

    setTimeout(() => {
      setParticles([]);
      onComplete();
    }, 1500);
  }

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{
            x: particle.x,
            y: particle.y,
            scale: 0,
            opacity: 0,
          }}
          animate={{
            y: particle.y - 100 - Math.random() * 50,
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1,
            delay: particle.delay,
            ease: 'easeOut',
          }}
          className="absolute w-3 h-3 rounded-full"
          style={{
            backgroundColor: particle.color,
            boxShadow: `0 0 10px ${particle.color}`,
          }}
        />
      ))}
    </div>
  );
}

export { COLUMN_COLORS };
