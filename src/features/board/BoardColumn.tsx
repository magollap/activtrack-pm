import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { SortableTaskCard } from '@/features/board/SortableTaskCard';
import { QuickAdd } from '@/features/tasks/QuickAdd';
import type { ChecklistCount } from '@/hooks/useProjectData';
import type { CustomField, Member, Status, Task } from '@/lib/db/types';

interface BoardColumnProps {
  projectId: string;
  status: Status;
  taskIds: string[];
  tasks: Map<string, Task>;
  members: Map<string, Member>;
  checklist: Map<string, ChecklistCount>;
  fields: CustomField[];
  timeByTask?: Map<string, number>;
  attachmentsByTask?: Map<string, number>;
  editable: boolean;
  onOpenTask: (taskId: string) => void;
}

export function BoardColumn({ projectId, status, taskIds, tasks, members, checklist, fields, timeByTask, attachmentsByTask, editable, onOpenTask }: BoardColumnProps) {
  const [adding, setAdding] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <section className="flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 sm:w-[280px]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="truncate text-sm font-semibold">{status.name}</h3>
        <span className="rounded-full bg-white px-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{taskIds.length}</span>
        {editable && (
          <button className="icon-btn ml-auto h-7 w-7" onClick={() => setAdding(true)} aria-label={`Add task to ${status.name}`} title="Add task">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </header>
      {adding && (
        <div className="px-2 pb-2">
          <QuickAdd projectId={projectId} statusId={status.id} compact autoFocus placeholder="Task title, press Enter" onCancel={() => setAdding(false)} />
        </div>
      )}
      <SortableContext id={status.id} items={taskIds} strategy={verticalListSortingStrategy} disabled={!editable}>
        <div
          ref={setNodeRef}
          className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-xl p-2 transition-colors ${isOver ? 'bg-brand-50/70 dark:bg-brand-950/30' : ''}`}
        >
          {taskIds.map((id) => {
            const task = tasks.get(id);
            if (!task) return null;
            return (
              <SortableTaskCard
                key={id}
                task={task}
                assignee={task.assigneeId ? members.get(task.assigneeId) : undefined}
                checklist={checklist.get(id)}
                isDone={status.isDone}
                fields={fields}
                minutes={timeByTask?.get(id)}
                files={attachmentsByTask?.get(id)}
                onOpen={() => onOpenTask(id)}
              />
            );
          })}
          {taskIds.length === 0 && !adding && !editable && (
            <p className="flex flex-1 items-center justify-center py-6 text-xs text-slate-400">No tasks</p>
          )}
          {taskIds.length === 0 && !adding && editable && (
            <button
              onClick={() => setAdding(true)}
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-6 text-xs text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 dark:border-slate-800 dark:hover:border-slate-700"
            >
              Drop tasks here or add one
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
