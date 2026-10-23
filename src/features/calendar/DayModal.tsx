import { format } from 'date-fns';
import { Modal } from '@/components/Modal';
import { DueDate } from '@/components/DueDate';
import { QuickAdd } from '@/features/tasks/QuickAdd';
import { parseDay } from '@/lib/dates';
import type { Status, Task } from '@/lib/db/types';

interface DayModalProps {
  projectId: string;
  day: string;
  tasks: Task[];
  statuses: Status[];
  editable: boolean;
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}

export function DayModal({ projectId, day, tasks, statuses, editable, onOpenTask, onClose }: DayModalProps) {
  const date = parseDay(day);
  const firstOpen = statuses.find((s) => !s.isDone) ?? statuses[0];
  const statusMap = new Map(statuses.map((s) => [s.id, s]));

  return (
    <Modal title={date ? format(date, 'EEEE, MMMM d') : day} onClose={onClose} size="sm">
      {!editable ? null : firstOpen ? (
        <QuickAdd projectId={projectId} statusId={firstOpen.id} dueDate={day} autoFocus placeholder="Task due this day, press Enter" />
      ) : (
        <p className="text-sm text-slate-500">Add a status to this project before adding tasks.</p>
      )}
      <ul className="mt-4 space-y-1">
        {tasks.map((task) => {
          const status = statusMap.get(task.statusId);
          return (
            <li key={task.id}>
              <button
                onClick={() => { onClose(); onOpenTask(task.id); }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status?.color }} />
                <span className={`flex-1 truncate ${status?.isDone ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
                <DueDate dueDate={task.dueDate} isDone={status?.isDone ?? false} />
              </button>
            </li>
          );
        })}
        {tasks.length === 0 && <li className="py-2 text-center text-xs text-slate-400">Nothing due this day yet.</li>}
      </ul>
    </Modal>
  );
}
