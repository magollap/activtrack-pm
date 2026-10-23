import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { addChecklistItem, deleteChecklistItem, listChecklistItems, updateChecklistItem } from '@/lib/db/checklist';

export function ChecklistSection({ taskId, editable }: { taskId: string; editable: boolean }) {
  const toast = useToast();
  const { data: items = [] } = useQuery(() => listChecklistItems(taskId), `checklist:${taskId}`);
  const [text, setText] = useState('');
  const done = items.filter((i) => i.done).length;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(error);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await run(() => addChecklistItem(taskId, text));
    setText('');
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Checklist</h3>
        {items.length > 0 && <span className="text-xs text-slate-500">{done}/{items.length}</span>}
      </div>
      {items.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => run(() => updateChecklistItem(item.id, { done: !item.done }))}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
              aria-label={`Mark "${item.text}" as ${item.done ? 'not done' : 'done'}`}
            />
            <span className={`flex-1 text-sm ${item.done ? 'text-slate-400 line-through' : ''}`}>{item.text}</span>
            {editable && <button
              onClick={() => run(() => deleteChecklistItem(item.id))}
              className="rounded p-1 text-slate-400 opacity-100 transition-opacity hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Remove "${item.text}"`}
            >
              <X className="h-3.5 w-3.5" />
            </button>}
          </li>
        ))}
      </ul>
      {!editable && items.length === 0 && <p className="text-sm text-slate-500">No checklist items.</p>}
      {editable && <form onSubmit={add} className="relative mt-2">
        <Plus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input className="input py-1.5 pl-8" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item, press Enter" maxLength={300} aria-label="New checklist item" />
      </form>}
    </section>
  );
}
