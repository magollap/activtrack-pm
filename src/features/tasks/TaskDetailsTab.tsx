import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ChecklistSection } from '@/features/tasks/ChecklistSection';
import { TaskFieldsSection } from '@/features/fields/TaskFieldsSection';
import { TimeSection } from '@/features/tasks/TimeSection';
import { AttachmentsSection } from '@/features/tasks/AttachmentsSection';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { useToast } from '@/hooks/useToast';
import { updateTask, type TaskPatch } from '@/lib/db/tasks';
import { PRIORITY_META } from '@/lib/priority';
import { dueTone } from '@/lib/dates';
import { PRIORITIES, type CustomField, type Member, type Priority, type Status, type Task } from '@/lib/db/types';

interface TaskDetailsTabProps {
  task: Task;
  statuses: Status[];
  members: Member[];
  fields: CustomField[];
  editable: boolean;
  manage?: boolean;
  onManageFields?: () => void;
}

const DUE_TONE_CLASS = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  normal: '',
};

export function TaskDetailsTab({ task, statuses, members, fields, editable, manage = false, onManageFields }: TaskDetailsTabProps) {
  const toast = useToast();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = async (patch: TaskPatch) => {
    try {
      await updateTask(task.id, patch);
      setSavedAt(Date.now());
    } catch (error) {
      toast.error(error);
    }
  };
  const titleSave = useDebouncedSave((value: string) => value.trim() && value.trim() !== task.title && save({ title: value }));
  const descriptionSave = useDebouncedSave((value: string) => value !== task.description && save({ description: value }));

  useEffect(() => {
    if (document.activeElement?.id !== 'task-title') setTitle(task.title);
    if (document.activeElement?.id !== 'task-description') setDescription(task.description);
  }, [task.title, task.description]);

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(null), 1500);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const isDone = statuses.find((s) => s.id === task.statusId)?.isDone ?? false;
  const tone = dueTone(task.dueDate, isDone);
  const datesInverted = Boolean(task.startDate && task.dueDate && task.startDate > task.dueDate);

  return (
    <fieldset disabled={!editable} className="min-w-0 space-y-6 [&_.input:disabled]:cursor-default [&_.input:disabled]:opacity-80">
      <div>
        <textarea
          id="task-title"
          value={title}
          rows={1}
          maxLength={200}
          onChange={(e) => { setTitle(e.target.value); titleSave.schedule(e.target.value); }}
          onBlur={() => { titleSave.flush(); if (!title.trim()) setTitle(task.title); }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
          className="w-full resize-none bg-transparent text-xl font-semibold leading-tight focus:outline-none"
          aria-label="Task title"
        />
        <p className={`h-4 text-xs text-emerald-600 transition-opacity dark:text-emerald-400 ${savedAt ? 'opacity-100' : 'opacity-0'}`}>
          <Check className="mr-1 inline h-3 w-3" />Saved
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="task-status">Status</label>
          <select id="task-status" className="input" value={task.statusId} onChange={(e) => save({ statusId: e.target.value })}>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="task-priority">Priority</label>
          <select id="task-priority" className="input" value={task.priority} onChange={(e) => save({ priority: e.target.value as Priority })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="task-assignee">Assignee</label>
          <select id="task-assignee" className="input" value={task.assigneeId ?? ''} onChange={(e) => save({ assigneeId: e.target.value || null })}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

        </div>
        <div>
          <label className="label" htmlFor="task-start">Start date</label>
          <input id="task-start" type="date" className="input" value={task.startDate ?? ''} onChange={(e) => save({ startDate: e.target.value || null })} />
        </div>
        <div>
          <label className="label" htmlFor="task-due">Due date</label>
          <input id="task-due" type="date" className={`input ${DUE_TONE_CLASS[tone]}`} value={task.dueDate ?? ''} onChange={(e) => save({ dueDate: e.target.value || null })} />
          {tone !== 'normal' && <p className={`mt-1 text-xs font-medium ${DUE_TONE_CLASS[tone]}`}>{tone === 'overdue' ? 'Overdue' : 'Due today'}</p>}
        </div>
        {datesInverted && <p className="text-xs text-amber-600 dark:text-amber-400 sm:col-span-2">The start date is after the due date.</p>}
      </div>

      <TaskFieldsSection task={task} fields={fields} editable={editable} manage={manage} onManage={onManageFields} />

      <div>
        <label className="label" htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          value={description}
          maxLength={10000}
          onChange={(e) => { setDescription(e.target.value); descriptionSave.schedule(e.target.value); }}
          onBlur={descriptionSave.flush}
          placeholder="Add more detail..."
          className="input min-h-[120px] resize-y"
        />
      </div>

      <ChecklistSection taskId={task.id} editable={editable} />

      <AttachmentsSection task={task} members={members} editable={editable} manage={manage} />

      <TimeSection task={task} members={members} editable={editable} manage={manage} />

      {task.completedAt && (
        <p className="text-xs text-slate-500">Completed {new Date(task.completedAt).toLocaleString()}</p>
      )}
    </fieldset>
  );
}
