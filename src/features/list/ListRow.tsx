import { Avatar } from '@/components/Avatar';
import { DueDate } from '@/components/DueDate';
import { PriorityBadge } from '@/components/PriorityBadge';
import { useToast } from '@/hooks/useToast';
import { updateTask, type TaskPatch } from '@/lib/db/tasks';
import type { Member, Status, Task } from '@/lib/db/types';

interface ListRowProps {
  task: Task;
  statuses: Status[];
  members: Member[];
  isDone: boolean;
  editable: boolean;
  onOpen: () => void;
}

const inlineSelect =
  'w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-200 focus:border-brand-500 focus:outline-none disabled:appearance-none disabled:hover:border-transparent dark:hover:border-slate-700';

export function ListRow({ task, statuses, members, isDone, editable, onOpen }: ListRowProps) {
  const toast = useToast();
  const assignee = members.find((m) => m.id === task.assigneeId);

  const save = async (patch: TaskPatch) => {
    try {
      await updateTask(task.id, patch);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 md:grid-cols-[minmax(0,1fr)_150px_170px_96px_100px]">
      <button onClick={onOpen} className={`truncate text-left text-sm font-medium hover:text-brand-700 dark:hover:text-brand-300 ${isDone ? 'text-slate-400 line-through' : ''}`}>
        {task.title}
      </button>
      <div className="md:order-none">
        <select className={inlineSelect} value={task.statusId} disabled={!editable} onChange={(e) => save({ statusId: e.target.value })} aria-label="Status">
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <Avatar member={assignee} size="xs" />
        <select className={inlineSelect} value={task.assigneeId ?? ''} disabled={!editable} onChange={(e) => save({ assigneeId: e.target.value || null })} aria-label="Assignee">
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end md:justify-start"><PriorityBadge priority={task.priority} /></div>
      <div className="col-span-2 text-left md:col-span-1">
        {task.dueDate ? <DueDate dueDate={task.dueDate} isDone={isDone} /> : <span className="text-xs text-slate-400">No date</span>}
      </div>
    </div>
  );
}
