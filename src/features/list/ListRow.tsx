import { Avatar } from '@/components/Avatar';
import { DueDate } from '@/components/DueDate';
import { PriorityBadge } from '@/components/PriorityBadge';
import { FieldChips } from '@/components/FieldChips';
import { useToast } from '@/hooks/useToast';
import { updateTask, type TaskPatch } from '@/lib/db/tasks';
import type { CustomField, Member, Status, Task } from '@/lib/db/types';

interface ListRowProps {
  task: Task;
  statuses: Status[];
  members: Member[];
  fields: CustomField[];
  isDone: boolean;
  editable: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

const inlineSelect =
  'w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-200 focus:border-brand-500 focus:outline-none disabled:appearance-none disabled:hover:border-transparent dark:hover:border-slate-700';

export function ListRow({ task, statuses, members, fields, isDone, editable, selected, onSelect, onOpen }: ListRowProps) {
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
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-2.5 transition-colors dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_150px_170px_96px_100px] ${selected ? 'bg-brand-50/70 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
      <div className="flex min-w-0 items-center gap-3">
        {editable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-brand-600"
            aria-label={`Select "${task.title}"`}
          />
        )}
        <button onClick={onOpen} className={`truncate text-left text-sm font-medium hover:text-brand-700 dark:hover:text-brand-300 ${isDone ? 'text-slate-400 line-through' : ''}`}>
          {task.title}
        </button>
        <span className="hidden min-w-0 shrink items-center gap-1.5 overflow-hidden lg:flex"><FieldChips task={task} fields={fields} limit={2} /></span>
      </div>
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
