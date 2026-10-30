import { useDroppable } from '@dnd-kit/core';
import { format, isSameMonth, isToday } from 'date-fns';
import { CalendarChip } from '@/features/calendar/CalendarChip';
import { toDayString } from '@/lib/dates';
import type { Status, Task } from '@/lib/db/types';

interface CalendarDayProps {
  day: Date;
  month: Date;
  tasks: Task[];
  statuses: Map<string, Status>;
  editable: boolean;
  onOpenTask: (taskId: string) => void;
  onOpenDay: (day: string) => void;
}

const MAX_VISIBLE = 3;

export function CalendarDay({ day, month, tasks, statuses, editable, onOpenTask, onOpenDay }: CalendarDayProps) {
  const id = toDayString(day);
  const { setNodeRef, isOver } = useDroppable({ id });
  const inMonth = isSameMonth(day, month);
  const today = isToday(day);
  const extra = tasks.length - MAX_VISIBLE;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onOpenDay(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenDay(id)}
      aria-label={`${format(day, 'EEEE, MMMM d')}, ${tasks.length} tasks. Add a task`}
      className={`group flex min-h-[72px] cursor-pointer flex-col gap-0.5 border-b border-r border-slate-200 p-1 transition-colors dark:border-slate-800 sm:min-h-[112px] sm:p-1.5 ${
        isOver ? 'bg-brand-50 dark:bg-brand-950/40' : inMonth ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40' : 'bg-slate-50/60 dark:bg-slate-900/40'
      }`}
    >
      <span
        className={`mb-0.5 inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium ${
          today ? 'bg-brand-600 text-brand-contrast' : inMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        {format(day, 'd')}
      </span>
      {tasks.slice(0, MAX_VISIBLE).map((task) => (
        <CalendarChip key={task.id} task={task} status={statuses.get(task.statusId)} editable={editable} onOpen={() => onOpenTask(task.id)} />
      ))}
      {extra > 0 && <span className="px-1 text-[11px] font-medium text-slate-500">+{extra} more</span>}
    </div>
  );
}
