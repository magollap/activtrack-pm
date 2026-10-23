import { useDraggable } from '@dnd-kit/core';
import { dueTone } from '@/lib/dates';
import type { Status, Task } from '@/lib/db/types';

interface CalendarChipProps {
  task: Task;
  status: Status | undefined;
  editable: boolean;
  onOpen: () => void;
}

export function CalendarChip({ task, status, editable, onOpen }: CalendarChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !editable });
  const isDone = status?.isDone ?? false;
  const tone = dueTone(task.dueDate, isDone);

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className={`flex w-full touch-manipulation items-center gap-1 truncate rounded-md px-1 py-0.5 text-left text-[11px] leading-tight transition-colors sm:px-1.5 sm:text-xs ${
        tone === 'overdue'
          ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
          : tone === 'today'
            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
            : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
      } ${isDragging ? 'opacity-30' : ''} ${isDone ? 'line-through opacity-60' : ''}`}
      title={task.title}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: status?.color ?? '#94a3b8' }} />
      <span className="truncate">{task.title}</span>
    </button>
  );
}
