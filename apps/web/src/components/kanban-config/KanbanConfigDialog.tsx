'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
  useDndContext,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, generateDefaultKanbanConfig } from '@/store';
import { WorkflowStage, StageLabels, ColumnConfig, KanbanTemplateConfig, StageConfig } from '@pm/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RotateCcw, Save, Plus, Lightbulb, Sparkles, GripVertical, Trash2, X, Pencil, Eye, EyeOff, Check, FolderOpen, Copy, Star, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface KanbanConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Saved template type for local storage
interface SavedTemplate {
  id: string;
  name: string;
  config: KanbanTemplateConfig;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Stage colors (系统阶段)
const SystemStageColors: Record<WorkflowStage, string> = {
  [WorkflowStage.REQUIREMENT_DESIGN]: 'bg-blue-500',
  [WorkflowStage.FEATURE_DEV]: 'bg-green-500',
  [WorkflowStage.ALPHA_CASE_DEV]: 'bg-teal-500',
  [WorkflowStage.ALPHA_TEST_DESIGN]: 'bg-purple-500',
  [WorkflowStage.VERSION_TEST]: 'bg-orange-500',
  [WorkflowStage.ISSUE_FIX]: 'bg-red-500',
  [WorkflowStage.RELEASE]: 'bg-pink-500',
  [WorkflowStage.CCB_REVIEW]: 'bg-indigo-500',
  [WorkflowStage.DOCUMENT_SIGN]: 'bg-slate-500',
  [WorkflowStage.SOP_UPGRADE]: 'bg-amber-500',
};

// Get stage color by config (支持自定义阶段)
const getStageColor = (stage: WorkflowStage | string, stageConfig?: StageConfig): string => {
  if (stageConfig?.color) return stageConfig.color;
  if (stage in SystemStageColors) return SystemStageColors[stage as WorkflowStage];
  return 'bg-slate-500';
};

// Utility function to move array items
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const result = [...array];
  const [removed] = result.splice(from, 1);
  result.splice(to, 0, removed);
  return result;
}

// Custom overlay that follows cursor
function DraggableOverlay({
  activeId,
  stageConfigs,
}: {
  activeId: UniqueIdentifier | null;
  stageConfigs: StageConfig[];
}) {
  const { active } = useDndContext();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [active]);

  if (!activeId) return null;

  const activeIdStr = String(activeId);

  // Column overlay
  if (activeIdStr.startsWith('col-')) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        <div className="w-60 h-40 bg-violet-500/30 rounded-xl border-2 border-dashed border-violet-400 shadow-xl flex items-center justify-center">
          <span className="text-violet-300 text-sm">移动列</span>
        </div>
      </div>,
      document.body
    );
  }

  // Stage overlay
  const stage = activeIdStr;
  const stageConfig = stageConfigs.find(sc => sc.stage === stage);
  const displayTitle = stageConfig?.customTitle || (stage in StageLabels ? StageLabels[stage as WorkflowStage] : stage) || stage;
  const colorClass = getStageColor(stage as WorkflowStage | string, stageConfig);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium shadow-xl',
          colorClass
        )}
      >
        <GripVertical className="h-4 w-4 opacity-70" />
        {displayTitle}
      </div>
    </div>,
    document.body
  );
}

// Sortable stage chip inside column
function ColumnStageChip({
  stage,
  stageConfig,
  onRemove,
  columnId,
}: {
  stage: WorkflowStage | string;
  stageConfig?: StageConfig;
  onRemove: () => void;
  columnId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage,
    data: { type: 'column-stage', columnId, stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayTitle = stageConfig?.customTitle || (stage in StageLabels ? StageLabels[stage as WorkflowStage] : stage) || stage;
  const colorClass = getStageColor(stage, stageConfig);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium group',
        colorClass,
        isDragging && 'opacity-30'
      )}
      data-stage-id={stage}
      data-column-id={columnId}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none hover:bg-white/10 rounded p-0.5"
        title="拖拽移动"
      >
        <GripVertical className="h-3 w-3 opacity-70" />
      </button>

      <span className="flex-1">{displayTitle}</span>

      <button
        onClick={onRemove}
        className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded"
        title="移除"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Column component
function ConfigColumn({
  column,
  stageConfigs,
  onRemoveColumn,
  onUpdateTitle,
  onRemoveStage,
  isDragging,
}: {
  column: ColumnConfig;
  stageConfigs: StageConfig[];
  onRemoveColumn: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onRemoveStage: (columnId: string, stage: WorkflowStage | string) => void;
  isDragging?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getDisplayTitle = (): string => {
    if (column.title) return column.title;
    if (column.stages.length === 1) {
    const sc = stageConfigs.find(s => s.stage === column.stages[0]);
    const stageKey = column.stages[0];
    return sc?.customTitle || (stageKey in StageLabels ? StageLabels[stageKey as WorkflowStage] : stageKey) || stageKey;
    }
    if (column.stages.length > 1) {
    return `合并 · ${column.stages.length} 个阶段`;
    }
    return '空列';
  };

  const handleSaveTitle = () => {
    onUpdateTitle(column.id, editTitle);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-60 min-w-[15rem] bg-slate-50 dark:bg-card/80 rounded-xl border border-slate-200 dark:border-white/10 flex flex-col transition-all duration-200 group',
        (isDragging || isSortableDragging) && 'opacity-50 scale-95'
      )}
      data-column-id={column.id}
      data-droppable-id={column.id}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-white/5 bg-slate-100 dark:bg-white/5 rounded-t-xl">
        <div className="flex items-center gap-2 flex-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-white/10 transition-colors"
            title="拖拽调整列顺序"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-7 text-xs bg-white/5"
                placeholder="列标题"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <Button size="sm" variant="secondary" onClick={handleSaveTitle} className="h-7 px-2 text-xs">
                确定
              </Button>
            </div>
          ) : (
            <span
              className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-200 hover:text-violet-500 dark:hover:text-violet-400 transition-colors flex-1 truncate"
              onClick={() => {
                setIsEditing(true);
                setEditTitle(column.title || '');
              }}
            >
              {getDisplayTitle()}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400"
          onClick={() => onRemoveColumn(column.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Stages - using SortableContext for column-internal sorting */}
      <div className="flex-1 p-3 space-y-2 min-h-[100px]">
        {column.stages.length > 0 ? (
          <SortableContext
            items={column.stages}
            strategy={verticalListSortingStrategy}
          >
            {column.stages.map((stage) => {
              const sc = stageConfigs.find(s => s.stage === stage);
              return (
                <ColumnStageChip
                  key={stage}
                  stage={stage}
                  stageConfig={sc}
                  columnId={column.id}
                  onRemove={() => onRemoveStage(column.id, stage)}
                />
              );
            })}
          </SortableContext>
        ) : (
          <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-white/10 rounded-lg text-xs text-muted-foreground">
            拖拽阶段到这里
          </div>
        )}
      </div>

      {/* Footer */}
      {column.stages.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-white/5 text-xs text-muted-foreground">
          {column.stages.length} 个阶段
          {column.stages.length > 1 && ' · 合并显示'}
        </div>
      )}
    </div>
  );
}

// Check if a stage is a dynamic placeholder (like VERSION_TEST)
const isDynamicStage = (stage: WorkflowStage | string): boolean => {
  return stage === WorkflowStage.VERSION_TEST;
};

// Stage chip for bottom palette (支持自定义阶段)
function StageChip({
  stage,
  stageConfig,
  isUnassigned,
  isHidden,
  isCustom,
  isDynamic,
  onEditTitle,
  onToggleVisibility,
  onDelete,
}: {
  stage: WorkflowStage | string;
  stageConfig?: StageConfig;
  isUnassigned?: boolean;
  isHidden?: boolean;
  isCustom?: boolean;
  isDynamic?: boolean;
  onEditTitle: (stage: WorkflowStage | string, title: string) => void;
  onToggleVisibility: (stage: WorkflowStage | string) => void;
  onDelete?: (stageId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(stageConfig?.customTitle || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage,
    data: { type: 'palette-stage', stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayTitle = stageConfig?.customTitle || (stage in StageLabels ? StageLabels[stage as WorkflowStage] : stage) || stage;

  const handleSave = () => {
    if (editValue.trim()) {
      onEditTitle(stage, editValue.trim());
    }
    setIsEditing(false);
  };

  const colorClass = getStageColor(stage, stageConfig);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium transition-all group',
        colorClass,
        isDragging && 'opacity-30',
        isHidden && 'opacity-40'
      )}
      data-stage-id={stage}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none hover:bg-white/10 rounded p-0.5 -ml-1"
        title="拖拽到列中"
      >
        <GripVertical className="h-3.5 w-3.5 opacity-70" />
      </button>

      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-6 w-24 text-xs bg-white/10 border-white/20 text-white"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <button onClick={handleSave} className="p-0.5 hover:bg-white/20 rounded">
            <Check className="h-3 w-3" />
          </button>
          <button onClick={() => setIsEditing(false)} className="p-0.5 hover:bg-white/20 rounded">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <span
            className="cursor-pointer hover:underline"
            onClick={() => {
              setEditValue(stageConfig?.customTitle || '');
              setIsEditing(true);
            }}
          >
            {displayTitle}
            {isDynamic && (
              <span className="ml-1 text-xs opacity-70">(动态)</span>
            )}
          </span>
          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => {
                setEditValue(stageConfig?.customTitle || '');
                setIsEditing(true);
              }}
              className="p-0.5 hover:bg-white/20 rounded"
            >
              <Pencil className="h-3 w-3 opacity-70" />
            </button>
            <button
              onClick={() => onToggleVisibility(stage)}
              className="p-0.5 hover:bg-white/20 rounded"
            >
              {isHidden ? <EyeOff className="h-3 w-3 opacity-70" /> : <Eye className="h-3 w-3 opacity-70" />}
            </button>
            {isCustom && onDelete && (
              <button
                onClick={() => onDelete(stage as string)}
                className="p-0.5 hover:bg-red-500/20 rounded text-red-400"
                title="删除自定义阶段"
              >
                <Trash2 className="h-3 w-3 opacity-70" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function KanbanConfigDialog({ open, onOpenChange }: KanbanConfigDialogProps) {
  const { kanbanConfig, setKanbanConfig } = useAppStore();

  const [localConfig, setLocalConfig] = useState<KanbanTemplateConfig | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [showSaveHint, setShowSaveHint] = useState(false);

  // Template management state
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('default');
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(true);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');

  // Custom stage dialog state
  const [showAddStageDialog, setShowAddStageDialog] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  // Load templates from localStorage on mount
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem('kanban-templates');
        if (stored) {
          const templates = JSON.parse(stored) as SavedTemplate[];
          setSavedTemplates(templates);

          // Load the first template's config (or the one marked as current)
          const currentTemplate = templates.find(t => t.id === currentTemplateId) || templates[0];
          if (currentTemplate) {
            setLocalConfig(JSON.parse(JSON.stringify(currentTemplate.config)));
            setCurrentTemplateId(currentTemplate.id);
          }
        } else {
          // Initialize with default template
          const defaultTemplate: SavedTemplate = {
            id: 'default',
            name: '流程1',
            config: generateDefaultKanbanConfig(),
            isDefault: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setSavedTemplates([defaultTemplate]);
          setLocalConfig(defaultTemplate.config);
          setCurrentTemplateId('default');
          localStorage.setItem('kanban-templates', JSON.stringify([defaultTemplate]));
        }
      } catch {
        const defaultTemplate: SavedTemplate = {
          id: 'default',
          name: '流程1',
          config: generateDefaultKanbanConfig(),
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSavedTemplates([defaultTemplate]);
        setLocalConfig(defaultTemplate.config);
        setCurrentTemplateId('default');
      }
      setShowSaveHint(false);
    }
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !localConfig) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const activeData = active.data.current;

    // === 1. Column reordering ===
    if (activeIdStr.startsWith('col-') && overIdStr.startsWith('col-')) {
      const oldIndex = localConfig.columns.findIndex(c => c.id === activeIdStr);
      const newIndex = localConfig.columns.findIndex(c => c.id === overIdStr);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setLocalConfig({
          ...localConfig,
          columns: arrayMove(localConfig.columns, oldIndex, newIndex),
          updatedAt: new Date().toISOString(),
        });
        setShowSaveHint(true);
      }
      return;
    }

    // === 2. Stage operations ===
    if (!activeIdStr.startsWith('col-')) {
      const stage = activeIdStr as WorkflowStage | string;
      const sourceColumnId = activeData?.columnId; // If from column, this will be set
      const isFromPalette = activeData?.type === 'palette-stage';

      // Case 2a: Stage dropped into a column from palette (COPY mode for ALL stages including VERSION_TEST)
      if (isFromPalette && overIdStr.startsWith('col-')) {
        const targetColumnId = overIdStr;
        const targetColumn = localConfig.columns.find(c => c.id === targetColumnId);

        if (targetColumn) {
          // COPY mode for ALL stages: Add stage to target column without removing from palette
          // VERSION_TEST can now be added multiple times to different columns
          const updatedColumns = localConfig.columns.map(col => {
            if (col.id === targetColumnId) {
              return { ...col, stages: [...col.stages, stage] };
            }
            return col;
          });

          setLocalConfig({
            ...localConfig,
            columns: updatedColumns,
            updatedAt: new Date().toISOString(),
          });
          setShowSaveHint(true);
        }
        return;
      }

      // Case 2b: Stage dropped into a column from another column (MOVE mode)
      if (!isFromPalette && sourceColumnId && overIdStr.startsWith('col-')) {
        const targetColumnId = overIdStr;
        const targetColumn = localConfig.columns.find(c => c.id === targetColumnId);

        if (targetColumn && sourceColumnId !== targetColumnId) {
          // MOVE mode for ALL stages (including VERSION_TEST - now allows duplicates)
          const updatedColumns = localConfig.columns.map(col => {
            if (col.id === sourceColumnId) {
              return { ...col, stages: col.stages.filter(s => s !== stage) };
            }
            if (col.id === targetColumnId) {
              return { ...col, stages: [...col.stages, stage] };
            }
            return col;
          });

          setLocalConfig({
            ...localConfig,
            columns: updatedColumns,
            updatedAt: new Date().toISOString(),
          });
          setShowSaveHint(true);
        }
        return;
      }

      // Case 2c: Stage dropped on another stage (reordering within column or moving between columns)
      if (!overIdStr.startsWith('col-')) {
        const overStage = overIdStr as WorkflowStage | string;

        // Find source and target columns using for...of for proper type narrowing
        let sourceCol: { column: ColumnConfig; index: number } | null = null;
        let targetCol: { column: ColumnConfig; index: number } | null = null;

        for (const col of localConfig.columns) {
          const stageIdx = col.stages.indexOf(stage);
          if (stageIdx !== -1) {
            sourceCol = { column: col, index: stageIdx };
          }
          const overIdx = col.stages.indexOf(overStage);
          if (overIdx !== -1) {
            targetCol = { column: col, index: overIdx };
          }
        }

        if (sourceCol && targetCol) {
          // Same column - reorder
          if (sourceCol.column.id === targetCol.column.id) {
            const newStages = arrayMove(sourceCol.column.stages, sourceCol.index, targetCol.index);
            const updatedColumns = localConfig.columns.map(col =>
              col.id === sourceCol!.column.id ? { ...col, stages: newStages } : col
            );

            setLocalConfig({
              ...localConfig,
              columns: updatedColumns,
              updatedAt: new Date().toISOString(),
            });
            setShowSaveHint(true);
          } else {
            // Different columns - move stage from source to target
            // MOVE mode for ALL stages (including VERSION_TEST - now allows duplicates)
            const updatedColumns = localConfig.columns.map(col => {
              // Remove from source
              if (col.id === sourceCol!.column.id) {
                return { ...col, stages: col.stages.filter(s => s !== stage) };
              }
              // Add to target at the position of overStage
              if (col.id === targetCol!.column.id) {
                const newStages = [...col.stages];
                const insertIdx = newStages.indexOf(overStage);
                newStages.splice(insertIdx, 0, stage);
                return { ...col, stages: newStages };
              }
              return col;
            });

            setLocalConfig({
              ...localConfig,
              columns: updatedColumns,
              updatedAt: new Date().toISOString(),
            });
            setShowSaveHint(true);
          }
        }
      }
    }
  };

  const handleSave = useCallback(() => {
    if (!localConfig) return;

    // Save to global store
    setKanbanConfig(localConfig);

    // Also update current template in localStorage
    // Using functional state update to avoid stale closure
    setSavedTemplates(prev => {
      const updated = prev.map(t =>
        t.id === currentTemplateId
          ? { ...t, config: JSON.parse(JSON.stringify(localConfig)), updatedAt: new Date().toISOString() }
          : t
      );
      localStorage.setItem('kanban-templates', JSON.stringify(updated));
      return updated;
    });

    onOpenChange(false);
  }, [localConfig, currentTemplateId, setKanbanConfig, onOpenChange]);

  const handleReset = () => {
    setLocalConfig(generateDefaultKanbanConfig());
    setShowSaveHint(true);
  };

  const handleAddColumn = useCallback(() => {
    const newColumn: ColumnConfig = {
      id: `col-${Date.now()}`,
      stages: [],
    };
    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        columns: [...prev.columns, newColumn],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleRemoveColumn = useCallback((columnId: string) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        columns: prev.columns.filter(c => c.id !== columnId),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleUpdateColumnTitle = useCallback((columnId: string, title: string) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        columns: prev.columns.map(c => c.id === columnId ? { ...c, title } : c),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleRemoveStage = useCallback((columnId: string, stage: WorkflowStage | string) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        columns: prev.columns.map(c =>
          c.id === columnId ? { ...c, stages: c.stages.filter(s => s !== stage) } : c
        ),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleUpdateStageTitle = useCallback((stage: WorkflowStage | string, customTitle: string) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        stageConfigs: prev.stageConfigs.map(sc =>
          sc.stage === stage ? { ...sc, customTitle } : sc
        ),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleToggleStageVisibility = useCallback((stage: WorkflowStage | string) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        stageConfigs: prev.stageConfigs.map(sc =>
          sc.stage === stage ? { ...sc, visible: !sc.visible } : sc
        ),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  // Add custom stage functions
  const handleAddCustomStage = useCallback((name: string) => {
    if (!name.trim()) return;

    const newStage: StageConfig = {
      stage: `custom-${Date.now()}`,
      customTitle: name.trim(),
      visible: true,
      isCustom: true,
      color: 'bg-slate-500',
    };

    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        stageConfigs: [...prev.stageConfigs, newStage],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleDeleteCustomStage = useCallback((stageId: string) => {
    const stageConfig = localConfig?.stageConfigs.find(sc => sc.stage === stageId);
    if (!stageConfig?.isCustom) return; // 系统阶段不可删除

    setLocalConfig(prev => {
      if (!prev) return prev;
      setShowSaveHint(true);
      return {
        ...prev,
        stageConfigs: prev.stageConfigs.filter(sc => sc.stage !== stageId),
        columns: prev.columns.map(col => ({
          ...col,
          stages: col.stages.filter(s => s !== stageId),
        })),
        updatedAt: new Date().toISOString(),
      };
    });
  }, [localConfig]);

  // Template management functions
  const saveTemplatesToStorage = useCallback((templates: SavedTemplate[]) => {
    localStorage.setItem('kanban-templates', JSON.stringify(templates));
    setSavedTemplates(templates);
  }, []);

  const handleCreateTemplate = useCallback(() => {
    if (!localConfig) return;
    const newTemplate: SavedTemplate = {
      id: `template-${Date.now()}`,
      name: `流程${savedTemplates.length + 1}`,
      config: JSON.parse(JSON.stringify(localConfig)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...savedTemplates, newTemplate];
    saveTemplatesToStorage(updated);
    setCurrentTemplateId(newTemplate.id);
  }, [localConfig, savedTemplates, saveTemplatesToStorage]);

  const handleLoadTemplate = useCallback((template: SavedTemplate) => {
    setLocalConfig(JSON.parse(JSON.stringify(template.config)));
    setCurrentTemplateId(template.id);
    setShowSaveHint(false);
  }, []);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    const template = savedTemplates.find(t => t.id === templateId);
    if (template?.isDefault) return; // Can't delete default template

    const updated = savedTemplates.filter(t => t.id !== templateId);
    saveTemplatesToStorage(updated);

    if (currentTemplateId === templateId) {
      const defaultTemplate = updated.find(t => t.isDefault) || updated[0];
      if (defaultTemplate) {
        handleLoadTemplate(defaultTemplate);
      }
    }
  }, [savedTemplates, currentTemplateId, saveTemplatesToStorage, handleLoadTemplate]);

  const handleRenameTemplate = useCallback((templateId: string, newName: string) => {
    const updated = savedTemplates.map(t =>
      t.id === templateId
        ? { ...t, name: newName, updatedAt: new Date().toISOString() }
        : t
    );
    saveTemplatesToStorage(updated);
    setEditingTemplateId(null);
    setEditingTemplateName('');
  }, [savedTemplates, saveTemplatesToStorage]);

  const handleUpdateCurrentTemplate = useCallback(() => {
    if (!localConfig) return;
    const updated = savedTemplates.map(t =>
      t.id === currentTemplateId
        ? { ...t, config: JSON.parse(JSON.stringify(localConfig)), updatedAt: new Date().toISOString() }
        : t
    );
    saveTemplatesToStorage(updated);
    setShowSaveHint(false);
  }, [localConfig, currentTemplateId, savedTemplates, saveTemplatesToStorage]);

  const handleDuplicateTemplate = useCallback((template: SavedTemplate) => {
    const newTemplate: SavedTemplate = {
      id: `template-${Date.now()}`,
      name: `${template.name} (副本)`,
      config: JSON.parse(JSON.stringify(template.config)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...savedTemplates, newTemplate];
    saveTemplatesToStorage(updated);
  }, [saveTemplatesToStorage]);

  if (!localConfig) return null;

  // Calculate unassigned stages (no longer a useCallback, just computed during render)
  const assignedStages = new Set(localConfig.columns.flatMap(c => c.stages));
  const unassignedStages = localConfig.stageConfigs
    .filter(sc => sc.visible && !assignedStages.has(sc.stage))
    .map(sc => sc.stage);
  const visibleConfigs = localConfig.stageConfigs.filter(sc => sc.visible);
  const hiddenConfigs = localConfig.stageConfigs.filter(sc => !sc.visible);
  const assignedCount = visibleConfigs.length - unassignedStages.length;

  // Separate system and custom stages
  const systemStages = visibleConfigs.filter(sc => !sc.isCustom);
  const customStages = visibleConfigs.filter(sc => sc.isCustom);
  const hiddenSystemStages = hiddenConfigs.filter(sc => !sc.isCustom);
  const hiddenCustomStages = hiddenConfigs.filter(sc => sc.isCustom);

  // Collect all stage IDs for SortableContext
  // Include ALL visible stages (not just unassigned) so palette stages are always draggable
  const allStageIds = [
    ...localConfig.columns.flatMap(c => c.stages),
    ...visibleConfigs.map(sc => sc.stage),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>看板布局配置</DialogTitle>
        </DialogHeader>

        {/* Header - with extra right padding to avoid close button overlap */}
        <div className="h-14 border-b flex items-center justify-between px-6 pr-14 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex-shrink-0 border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold">看板布局配置</h2>
              <p className="text-xs text-muted-foreground">拖拽调整列顺序和阶段分配</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showSaveHint && (
              <span className="text-xs text-amber-500 animate-pulse">有未保存的更改</span>
            )}
            <Button variant="outline" size="sm" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-1" />
              新增列
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>

        {/* Template management section - at top for easy access */}
        <div className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
          {/* Header */}
          <button
            onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium">流程模板</span>
              <span className="text-xs text-muted-foreground">({savedTemplates.length})</span>
            </div>
            {isTemplatesExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Templates list */}
          {isTemplatesExpanded && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                {savedTemplates.map(template => (
                  <div
                    key={template.id}
                    className={cn(
                      'group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
                      currentTemplateId === template.id
                        ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/50 text-violet-700 dark:text-violet-300'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {template.isDefault && (
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    )}

                    {editingTemplateId === template.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingTemplateName}
                          onChange={(e) => setEditingTemplateName(e.target.value)}
                          className="h-6 w-24 text-xs bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-white/20 text-slate-900 dark:text-slate-100"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameTemplate(template.id, editingTemplateName);
                            }
                            if (e.key === 'Escape') {
                              setEditingTemplateId(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRenameTemplate(template.id, editingTemplateName)}
                          className="p-0.5 hover:bg-white/20 rounded"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setEditingTemplateId(null)}
                          className="p-0.5 hover:bg-white/20 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleLoadTemplate(template)}
                          className="text-sm"
                        >
                          {template.name}
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingTemplateId(template.id);
                              setEditingTemplateName(template.name);
                            }}
                            className="p-0.5 hover:bg-white/20 rounded"
                            title="重命名"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDuplicateTemplate(template)}
                            className="p-0.5 hover:bg-white/20 rounded"
                            title="复制"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {!template.isDefault && (
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="p-0.5 hover:bg-red-500/20 rounded text-red-400"
                              title="删除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Add new template button */}
                <button
                  onClick={handleCreateTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-white/20 hover:border-slate-400 dark:hover:border-white/40 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-sm">新建模板</span>
                </button>
              </div>

              {/* Current template actions */}
              {currentTemplateId && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                  <span className="text-xs text-muted-foreground">当前：</span>
                  <span className="text-xs font-medium">
                    {savedTemplates.find(t => t.id === currentTemplateId)?.name || '未命名'}
                  </span>
                  {showSaveHint && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUpdateCurrentTemplate}
                      className="h-6 text-xs px-2"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      更新模板
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Columns area */}
          <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <SortableContext
              items={localConfig.columns.map(c => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-4 min-h-[300px]">
                {localConfig.columns.map(column => (
                  <ConfigColumn
                    key={column.id}
                    column={column}
                    stageConfigs={localConfig.stageConfigs}
                    onRemoveColumn={handleRemoveColumn}
                    onUpdateTitle={handleUpdateColumnTitle}
                    onRemoveStage={handleRemoveStage}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          {/* Bottom palette */}
          <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/80 flex-shrink-0">
            <div className="px-4 py-2 bg-slate-100 dark:bg-muted/20 border-b border-slate-100 dark:border-white/5 flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">操作：</span>
                拖拽阶段到列中（可多次拖拽) · 列内阶段可排序或移到其他列 · 点击 ✏️ 编辑 · 点击 👁 切换显示
              </p>
            </div>

            <div className="p-4 overflow-x-auto space-y-4">
              {/* 系统阶段 */}
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  系统阶段 ({systemStages.length})
                </span>
                <SortableContext items={systemStages.map(sc => sc.stage)} strategy={horizontalListSortingStrategy}>
                  <div className="flex flex-wrap gap-2">
                    {systemStages.map(sc => (
                      <StageChip
                        key={sc.stage}
                        stage={sc.stage}
                        stageConfig={sc}
                        isDynamic={isDynamicStage(sc.stage)}
                        onEditTitle={handleUpdateStageTitle}
                        onToggleVisibility={handleToggleStageVisibility}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>

              {/* 自定义阶段 */}
              <div>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 block">
                  自定义阶段 ({customStages.length})
                </span>
                <SortableContext items={customStages.map(sc => sc.stage)} strategy={horizontalListSortingStrategy}>
                  <div className="flex flex-wrap gap-2">
                    {customStages.map(sc => (
                      <StageChip
                        key={sc.stage}
                        stage={sc.stage}
                        stageConfig={sc}
                        isCustom
                        onEditTitle={handleUpdateStageTitle}
                        onToggleVisibility={handleToggleStageVisibility}
                        onDelete={handleDeleteCustomStage}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>

              {/* 新增阶段按钮 */}
              <button
                onClick={() => setShowAddStageDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-purple-400/50 hover:border-purple-400 hover:bg-purple-500/10 transition-all text-purple-600 dark:text-purple-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-sm">新增自定义阶段</span>
              </button>

              {/* 已隐藏阶段 */}
              {hiddenConfigs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-500 mb-2 block">
                    已隐藏 ({hiddenConfigs.length})
                  </span>
                  <SortableContext items={hiddenConfigs.map(sc => sc.stage)} strategy={horizontalListSortingStrategy}>
                    <div className="flex flex-wrap gap-2">
                      {hiddenConfigs.map(sc => (
                        <StageChip
                          key={sc.stage}
                          stage={sc.stage}
                          stageConfig={sc}
                          isHidden
                          isCustom={sc.isCustom}
                          onEditTitle={handleUpdateStageTitle}
                          onToggleVisibility={handleToggleStageVisibility}
                          onDelete={sc.isCustom ? handleDeleteCustomStage : undefined}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}
            </div>
          </div>

          {/* Add Custom Stage Dialog */}
          {showAddStageDialog && (
            <Dialog open={showAddStageDialog} onOpenChange={setShowAddStageDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>新增自定义阶段</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <Input
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="输入阶段名称"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newStageName.trim()) {
                        handleAddCustomStage(newStageName);
                        setShowAddStageDialog(false);
                        setNewStageName('');
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddStageDialog(false);
                        setNewStageName('');
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={() => {
                        handleAddCustomStage(newStageName);
                        setShowAddStageDialog(false);
                        setNewStageName('');
                      }}
                      disabled={!newStageName.trim()}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <DraggableOverlay activeId={activeId} stageConfigs={localConfig.stageConfigs} />
        </DndContext>
      </DialogContent>
    </Dialog>
  );
}
