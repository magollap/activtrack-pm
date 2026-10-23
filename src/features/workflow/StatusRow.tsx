import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, Circle, GripVertical, Trash2 } from 'lucide-react';
import { Popover } from '@/components/Popover';
import { ColorPicker } from '@/components/ColorPicker';
import { updateStatus } from '@/lib/db/statuses';
import { useToast } from '@/hooks/useToast';
import type { Status } from '@/lib/db/types';

export function StatusRow({ status, onDelete }: { status: Status; onDelete: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(status.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });

  useEffect(() => setName(status.name), [status.name]);

  const save = async (patch: Partial<Pick<Status, 'name' | 'color' | 'isDone'>>) => {
    try {
      await updateStatus(status.id, { name: status.name, color: status.color, isDone: status.isDone, ...patch });
    } catch (error) {
      toast.error(error);
      setName(status.name);
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900 ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      <button className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing" aria-label={`Reorder ${status.name}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <Popover
        trigger={({ toggle }) => (
          <button onClick={toggle} className="h-5 w-5 rounded-full ring-offset-2 transition-transform hover:scale-110" style={{ backgroundColor: status.color }} aria-label="Change color" />
        )}
        width="w-60"
      >
        {(close) => (
          <div className="p-2">
            <ColorPicker value={status.color} onChange={(color) => { close(); save({ color }); }} />
          </div>
        )}
      </Popover>
      <input
        className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== status.name && save({ name })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Status name"
      />
      <button
        onClick={() => save({ isDone: !status.isDone })}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          status.isDone
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800'
        }`}
        title={status.isDone ? 'Tasks here count as done' : 'Mark as a done status'}
      >
        {status.isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
        Done
      </button>
      <button className="icon-btn h-8 w-8 hover:text-red-600 dark:hover:text-red-400" onClick={onDelete} aria-label={`Delete ${status.name}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
