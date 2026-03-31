'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Target, CheckCircle2, Sparkles, Star, ChevronDown, Plus, RotateCcw, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowStage, StageLabels } from '@pm/shared';
import { cn } from '@/lib/utils';

// 阶段顺序（用于排序）
const STAGE_ORDER: WorkflowStage[] = [
  WorkflowStage.REQUIREMENT_DESIGN,
  WorkflowStage.ALPHA_TEST_DESIGN,
  WorkflowStage.DOCUMENT_SIGN,
  WorkflowStage.FEATURE_DEV,
  WorkflowStage.ALPHA_CASE_DEV,
  WorkflowStage.SOP_UPGRADE,
  WorkflowStage.VERSION_TEST,
  WorkflowStage.ISSUE_FIX,
  WorkflowStage.CCB_REVIEW,
  WorkflowStage.RELEASE,
];

// 预设的常用阶段
const DEFAULT_FAVORITES: WorkflowStage[] = [
  WorkflowStage.DOCUMENT_SIGN,
  WorkflowStage.VERSION_TEST,
  WorkflowStage.CCB_REVIEW,
];

// localStorage key for favorites
const FAVORITES_STORAGE_KEY = 'pm-game-favorites';

interface ProgressGameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableStages: WorkflowStage[];
  onStartGame: (checkpoints: WorkflowStage[]) => void;
}

export function ProgressGameDialog({
  open,
  onOpenChange,
  availableStages,
  onStartGame,
}: ProgressGameProps) {
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<WorkflowStage[]>([]);
  const [favorites, setFavorites] = useState<WorkflowStage[]>([]);
  const [otherStagesDropdown, setOtherStagesDropdown] = useState<string>('');
  const autoSelectionDoneRef = useRef(false);

  // 按 STAGE_ORDER 排序 availableStages，排除 RELEASE（最后阶段不作为卡点）
  const validCheckpoints = STAGE_ORDER.filter(
    (stage) => availableStages.includes(stage) && stage !== WorkflowStage.RELEASE
  );

  // 加载收藏的阶段
  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WorkflowStage[];
        // 只保留有效的阶段
        setFavorites(parsed.filter((s) => validCheckpoints.includes(s)));
      } catch {
        setFavorites(DEFAULT_FAVORITES.filter((s) => validCheckpoints.includes(s)));
      }
    } else {
      setFavorites(DEFAULT_FAVORITES.filter((s) => validCheckpoints.includes(s)));
    }
  }, [validCheckpoints.join(',')]);

  // 保存收藏
  const saveFavorites = (newFavorites: WorkflowStage[]) => {
    setFavorites(newFavorites);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
  };

  // 切换收藏状态
  const toggleFavorite = (stage: WorkflowStage) => {
    if (favorites.includes(stage)) {
      saveFavorites(favorites.filter((s) => s !== stage));
    } else {
      saveFavorites([...favorites, stage]);
    }
  };

  // 常用阶段（收藏的）
  const favoriteStages = favorites
    .filter((s) => validCheckpoints.includes(s))
    .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b));

  // 其他阶段（非收藏的）
  const otherStages = validCheckpoints
    .filter((s) => !favorites.includes(s))
    .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b));

  // 对话框关闭时重置自动选择标记
  useEffect(() => {
    if (!open) {
      autoSelectionDoneRef.current = false;
    }
  }, [open]);

  // 对话框打开时，自动选中收藏的卡点（只执行一次）
  useEffect(() => {
    if (open && !autoSelectionDoneRef.current && favoriteStages.length > 0) {
      // 自动选中收藏的卡点
      setSelectedCheckpoints([...favoriteStages]);
      setOtherStagesDropdown('');
      autoSelectionDoneRef.current = true;
    }
  }, [open, favoriteStages]);

  const toggleCheckpoint = (stage: WorkflowStage) => {
    setSelectedCheckpoints((prev) =>
      prev.includes(stage)
        ? prev.filter((s) => s !== stage)
        : [...prev, stage]
    );
  };

  // 从下拉框添加阶段（仅在选择时触发，不包括点击星星）
  const addFromDropdown = (stageValue: string) => {
    if (stageValue) {
      const stage = stageValue as WorkflowStage;
      if (!selectedCheckpoints.includes(stage)) {
        setSelectedCheckpoints((prev) => [...prev, stage]);
      }
      setOtherStagesDropdown('');
    }
  };

  // 从下拉框收藏阶段
  const handleStarInDropdown = (e: React.MouseEvent, stage: WorkflowStage) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(stage);
  };

  const handleStartGame = () => {
    if (selectedCheckpoints.length > 0) {
      // 按阶段顺序排序选中的卡点
      const sortedCheckpoints = [...selectedCheckpoints].sort(
        (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
      );
      onStartGame(sortedCheckpoints);
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg mx-4 rounded-2xl border border-slate-200 dark:border-white/20 bg-white dark:bg-gradient-to-br dark:from-slate-900/95 dark:to-slate-800/95 p-6 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">更新消消乐</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">设置卡点，游戏化推进需求进度</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/20 to-transparent mb-6" />

          {/* Description */}
          <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <Sparkles className="w-4 h-4 inline mr-1 text-amber-400" />
              选择卡点后，需求需要逐一通过这些关卡。点击星星收藏常用阶段！
            </p>
          </div>

          {/* Favorite Stages (Common) */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">常用阶段</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {favoriteStages.map((stage) => {
                const isSelected = selectedCheckpoints.includes(stage);
                const order = selectedCheckpoints.indexOf(stage);
                return (
                  <motion.div
                    key={stage}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleCheckpoint(stage)}
                    className={cn(
                      'relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200 cursor-pointer',
                      isSelected
                        ? 'bg-violet-500/20 border-violet-500/50 shadow-lg shadow-violet-500/20'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    )}
                  >
                    {/* Star toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(stage);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded hover:bg-white/10"
                    >
                      <Star
                        className={cn(
                          'w-3 h-3 transition-colors',
                          favorites.includes(stage)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-500'
                        )}
                      />
                    </button>

                    {/* Selection indicator */}
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                        isSelected
                          ? 'bg-violet-500 border-violet-500'
                          : 'border-slate-500'
                      )}
                    >
                      {isSelected && order >= 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-xs font-bold text-white"
                        >
                          {order + 1}
                        </motion.span>
                      )}
                    </div>

                    <span className="text-xs text-slate-700 dark:text-slate-200 text-center leading-tight">
                      {StageLabels[stage]}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Other Stages Dropdown */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ChevronDown className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">其他阶段</h3>
            </div>
            <Select value={otherStagesDropdown} onValueChange={addFromDropdown}>
              <SelectTrigger className="w-full bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10">
                <SelectValue placeholder="选择并添加阶段..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10">
                {otherStages.map((stage) => (
                  <SelectItem
                    key={stage}
                    value={stage}
                    className="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 focus:bg-slate-100 dark:focus:bg-white/10"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{StageLabels[stage]}</span>
                      <button
                        onMouseDown={(e) => handleStarInDropdown(e, stage)}
                        className="p-1 rounded hover:bg-white/10"
                      >
                        <Star
                          className={cn(
                            'w-3 h-3 transition-colors',
                            favorites.includes(stage)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-500'
                          )}
                        />
                      </button>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Checkpoints Preview */}
          {selectedCheckpoints.length > 0 && (
            <div className="mb-6 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-wrap">
                <span className="flex-shrink-0">卡点顺序:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedCheckpoints
                    .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b))
                    .map((stage, index, arr) => (
                      <span key={stage} className="flex items-center">
                        <span className="px-2 py-0.5 rounded-md bg-violet-500/30 text-violet-700 dark:text-violet-200 text-xs flex items-center gap-1">
                          {StageLabels[stage]}
                          <button
                            onClick={() => toggleCheckpoint(stage)}
                            className="ml-1 hover:text-red-300 transition-colors"
                            title="取消选择此卡点"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                        {index < arr.length - 1 && (
                          <span className="mx-1 text-violet-500 dark:text-violet-400">→</span>
                        )}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30"
              disabled={selectedCheckpoints.length === 0}
              onClick={handleStartGame}
            >
              <Play className="w-4 h-4 mr-2" />
              开始游戏
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// 确认对话框组件
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'info';
}

function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'warning',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm mx-4 rounded-2xl border border-slate-200 dark:border-white/20 bg-white dark:bg-gradient-to-br dark:from-slate-900/95 dark:to-slate-800/95 p-6 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4",
            variant === 'warning' ? "bg-orange-500/20" : "bg-blue-500/20"
          )}>
            {variant === 'warning' ? (
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            ) : (
              <Info className="w-6 h-6 text-blue-400" />
            )}
          </div>

          {/* Content */}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-6">{description}</p>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
              onClick={() => onOpenChange(false)}
            >
              {cancelText}
            </Button>
            <Button
              className={cn(
                "flex-1 text-white shadow-lg",
                variant === 'warning'
                  ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-500/30"
                  : "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 shadow-blue-500/30"
              )}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmText}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// 游戏进行中的顶部状态栏
interface GameStatusBarProps {
  checkpoints: WorkflowStage[];
  completedCount: number;
  totalCount: number;
  historySize: number;
  wasSaved: boolean; // 是否已保存
  onExit: () => void;
  onSave: () => void; // 保存回调
  onUndo: () => boolean;
  onReset: () => void;
}

export function GameStatusBar({
  checkpoints,
  completedCount,
  totalCount,
  historySize,
  wasSaved,
  onExit,
  onSave,
  onUndo,
  onReset,
}: GameStatusBarProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  return (
    <>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-r from-violet-900/95 via-purple-900/95 to-violet-900/95 backdrop-blur-xl border-b border-violet-500/30 shadow-lg shadow-violet-500/20"
      >
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
              >
                <Target className="w-4 h-4 text-white" />
              </motion.div>
              <span className="font-bold text-white">更新消消乐</span>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-400 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-sm text-violet-200">{Math.round(progress)}%</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>{completedCount}/{totalCount}</span>
              </div>
            </div>
          </div>

          {/* Checkpoint Pills */}
          <div className="flex items-center gap-2">
            {checkpoints.map((checkpoint, index) => (
              <div
                key={checkpoint}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all bg-violet-500/30 text-violet-200 border border-violet-500/50'
                )}
              >
                {StageLabels[checkpoint]}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Undo Button */}
            <Button
              variant="outline"
              size="sm"
              disabled={historySize === 0}
              className={cn(
                "border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/50 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300",
                historySize === 0 && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                const success = onUndo();
                if (!success) {
                  console.log('No history to undo');
                }
              }}
              title={`撤销上一步 (${historySize}/30)`}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              撤销
              {historySize > 0 && (
                <span className="ml-1 text-xs opacity-70">({historySize})</span>
              )}
            </Button>

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              className="border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 hover:bg-orange-100 dark:hover:bg-orange-500/20 hover:border-orange-300 dark:hover:border-orange-500/50 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-300"
              onClick={() => setShowResetDialog(true)}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重置
            </Button>

            {/* Save Button */}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 transition-all",
                wasSaved
                  ? "bg-green-100 dark:bg-green-500/20 border-green-300 dark:border-green-500/50 text-green-600 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-500/30 hover:border-green-400 dark:hover:border-green-500/60"
                  : "bg-slate-100 dark:bg-white/5 hover:bg-green-100 dark:hover:bg-green-500/20 hover:border-green-300 dark:hover:border-green-500/50 hover:text-green-600 dark:hover:text-green-300"
              )}
              onClick={onSave}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {wasSaved ? '已保存' : '保存'}
            </Button>

            {/* Exit Button */}
            <Button
              variant="outline"
              size="sm"
              className="border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-300 dark:hover:border-red-500/50 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-300"
              onClick={() => setShowExitDialog(true)}
            >
              <X className="w-4 h-4 mr-1" />
              退出游戏
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Reset Dialog */}
      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={onReset}
        title="重置进度"
        description="这将重置所有卡片到游戏开始时的位置，清除所有推进进度和已通过的卡点。确定要继续吗？"
        confirmText="确认重置"
        variant="warning"
      />

      {/* Exit Dialog */}
      <ConfirmDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onConfirm={onExit}
        title="退出游戏"
        description={wasSaved
          ? "已保存的卡片位置将保留在看板上。"
          : "尚未保存，退出后卡片将从看板上消失。"
        }
        confirmText="确认退出"
        cancelText="继续游戏"
        variant="info"
      />
    </>
  );
}

// 庆祝粒子效果组件
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
}

interface CelebrationParticlesProps {
  active: boolean;
  originX: number;
  originY: number;
  colors?: string[];
  particleCount?: number;
  onComplete?: () => void;
}

export function CelebrationParticles({
  active,
  originX,
  originY,
  colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7', '#3b82f6'],
  particleCount = 20,
  onComplete,
}: CelebrationParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: originX,
        y: originY,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        velocity: {
          x: (Math.random() - 0.5) * 300,
          y: (Math.random() - 0.5) * 300 - 100,
        },
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [active, originX, originY, colors, particleCount, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ x: particle.x, y: particle.y, scale: 1, opacity: 1 }}
          animate={{
            x: particle.x + particle.velocity.x,
            y: particle.y + particle.velocity.y + 200,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 1, ease: 'easeOut' }}
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
  );
}

// 能量聚合动画组件
interface EnergyOrbProps {
  active: boolean;
  targetX: number;
  targetY: number;
  sources: { x: number; y: number }[];
  color?: string;
  onComplete?: () => void;
}

export function EnergyOrb({
  active,
  targetX,
  targetY,
  sources,
  color = '#a855f7',
  onComplete,
}: EnergyOrbProps) {
  useEffect(() => {
    if (active && sources.length > 0) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [active, sources.length, onComplete]);

  if (!active || sources.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* 能量线 */}
      {sources.map((source, index) => (
        <motion.div
          key={index}
          initial={{
            x: source.x,
            y: source.y,
            scale: 0,
            opacity: 0,
          }}
          animate={{
            x: targetX,
            y: targetY,
            scale: [0, 1, 0.5],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="absolute w-4 h-4 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}, transparent)`,
            boxShadow: `0 0 20px ${color}`,
          }}
        />
      ))}

      {/* 中心能量球 */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="absolute"
        style={{
          left: targetX - 30,
          top: targetY - 30,
          width: 60,
          height: 60,
          background: `radial-gradient(circle, ${color}, ${color}80, transparent)`,
          boxShadow: `0 0 40px ${color}, 0 0 80px ${color}80`,
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
