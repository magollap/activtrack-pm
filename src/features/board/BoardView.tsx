import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { BoardColumn } from '@/features/board/BoardColumn';
import { TaskCard } from '@/features/board/TaskCard';
import { moveTask } from '@/lib/db/tasks';
import { useToast } from '@/hooks/useToast';
import type { TaskViewProps } from '@/features/projects/taskViewProps';

type Columns = Record<string, string[]>;

export function BoardView({ projectId, statuses, tasks, members, checklist, fields, editable, onOpenTask }: TaskViewProps) {
  const toast = useToast();
  const buildColumns = (): Columns =>
    Object.fromEntries(statuses.map((s) => [s.id, tasks.filter((t) => t.statusId === s.id).map((t) => t.id)]));
  const [columns, setColumns] = useState<Columns>(buildColumns);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) setColumns(buildColumns());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string, cols: Columns = columns): string | undefined =>
    id in cols ? id : Object.keys(cols).find((key) => cols[key].includes(id));

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    setColumns((cols) => {
      const from = findColumn(activeKey, cols);
      const to = findColumn(overKey, cols);
      if (!from || !to || from === to) return cols;
      const target = cols[to];
      const overIndex = target.indexOf(overKey);
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...cols,
        [from]: cols[from].filter((id) => id !== activeKey),
        [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id);
    setActiveId(null);
    const column = findColumn(activeKey);
    if (!over || !column) {
      setColumns(buildColumns());
      return;
    }
    const list = columns[column];
    const overIndex = list.indexOf(String(over.id));
    const ordered = overIndex === -1 ? list : arrayMove(list, list.indexOf(activeKey), overIndex);
    setColumns((cols) => ({ ...cols, [column]: ordered }));
    const original = taskMap.get(activeKey);
    const unchanged = original?.statusId === column && ordered.join() === buildColumns()[column]?.join();
    if (unchanged) return;
    try {
      await moveTask(activeKey, column, ordered);
    } catch (error) {
      toast.error(error);
      setColumns(buildColumns());
    }
  };

  const activeTask = activeId ? taskMap.get(activeId) : undefined;
  const activeStatus = activeTask ? statuses.find((s) => s.id === findColumn(activeTask.id)) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setActiveId(null); setColumns(buildColumns()); }}
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:snap-none sm:px-6">
        {statuses.map((status) => (
          <BoardColumn
            key={status.id}
            projectId={projectId}
            status={status}
            taskIds={columns[status.id] ?? []}
            tasks={taskMap}
            members={memberMap}
            checklist={checklist}
            fields={fields}
            editable={editable}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask && (
          <TaskCard
            task={activeTask}
            assignee={activeTask.assigneeId ? memberMap.get(activeTask.assigneeId) : undefined}
            checklist={checklist.get(activeTask.id)}
            isDone={activeStatus?.isDone ?? false}
            fields={fields}
            overlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
