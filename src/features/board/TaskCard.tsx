import { CheckCircle2, ListChecks } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { DueDate } from '@/components/DueDate';
import { PriorityBadge } from '@/components/PriorityBadge';
import type { ChecklistCount } from '@/hooks/useProjectData';
import type { Member, Task } from '@/lib/db/types';

interface TaskCardProps {
  task: Task;
  assignee: Member | undefined;
  checklist: ChecklistCount | undefined;
  isDone: boolean;
  dragging?: boolean;
  overlay?: boolean;
  onOpen?: () => void;
}

export function TaskCard({ task, assignee, checklist, isDone, dragging, overlay, onOpen }: TaskCardProps) {
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer rounded-xl border bg-white p-3 text-left transition-all dark:bg-slate-900 ${
        overlay
          ? 'rotate-1 border-brand-300 shadow-xl dark:border-brand-700'
          : 'border-slate-200 shadow-sm hover:-translate-y-px hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:hover:border-slate-700'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        {isDone && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
        <p className={`flex-1 break-words text-sm font-medium ${isDone ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>
          {task.title}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <DueDate dueDate={task.dueDate} isDone={isDone} />
        {checklist && checklist.total > 0 && (
          <span className={`inline-flex items-center gap-1 text-xs ${checklist.done === checklist.total ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            <ListChecks className="h-3.5 w-3.5" /> {checklist.done}/{checklist.total}
          </span>
        )}
        <span className="ml-auto">
          {(assignee || task.assigneeId) && <Avatar member={assignee} size="xs" />}
        </span>
      </div>
    </div>
  );
}
