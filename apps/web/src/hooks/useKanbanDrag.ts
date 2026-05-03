'use client';

import { useState } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { WorkflowStage } from '@pm/shared';

interface KanbanItem {
  id: string;
  type: 'requirement' | 'issue';
  code: string;
  title: string;
  status: string;
  currentStage: WorkflowStage;
  assignee: { id: string; name: string; employeeNo: string };
  severity?: string;
  workload?: number;
  testCycleId?: string;
}

interface KanbanColumn {
  id: string;
  title?: string;
  stage: WorkflowStage | string;
  stages?: (WorkflowStage | string)[];
  isDynamic?: boolean;
  testCycleId?: string;
}

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

interface UseKanbanDragOptions {
  kanbanData: { columns: KanbanColumn[]; items: KanbanItem[] };
  interactionMode: string;
  onUpdateRequirementStage: (data: { id: string; stage: string }) => void;
  onUpdateIssueStage: (data: { id: string; stage: string }) => void;
}

export function useKanbanDrag({
  kanbanData,
  interactionMode,
  onUpdateRequirementStage,
  onUpdateIssueStage,
}: UseKanbanDragOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isDropAllowed, setIsDropAllowed] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: interactionMode === 'drag'
        ? { distance: 8 }
        : { distance: 999999 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(null);
    setIsDropAllowed(true);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setOverId(null);
      setIsDropAllowed(true);
      return;
    }

    setOverId(over.id as string);

    const item = kanbanData.items.find((i) => i.id === active.id);
    if (!item) return;

    const targetColumn = kanbanData.columns.find((col) => col.id === over.id);
    if (!targetColumn) return;

    if (item.type === 'issue') {
      const issueFixIndex = STAGE_ORDER.indexOf(WorkflowStage.ISSUE_FIX);
      const targetStageIndex = STAGE_ORDER.indexOf(targetColumn.stage as WorkflowStage);
      setIsDropAllowed(targetStageIndex >= issueFixIndex);
    } else {
      setIsDropAllowed(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const wasDropAllowed = isDropAllowed;

    setActiveId(null);
    setOverId(null);
    setIsDropAllowed(true);

    if (!over || !wasDropAllowed) return;

    const item = kanbanData.items.find((i) => i.id === active.id);
    if (!item) return;

    const targetColumn = kanbanData.columns.find((col) => col.id === over.id);
    if (!targetColumn) return;

    if (item.type === 'requirement') {
      onUpdateRequirementStage({ id: item.id, stage: targetColumn.stage });
    } else {
      onUpdateIssueStage({ id: item.id, stage: targetColumn.stage });
    }
  };

  const activeItem = activeId
    ? kanbanData.items.find((i) => i.id === activeId) ?? null
    : null;

  return {
    sensors,
    activeId,
    overId,
    isDropAllowed,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
