import { useEffect, useState } from 'react';
import { ExternalLink, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { cleanFieldValue, withFieldValue } from '@/lib/db/fields';
import { updateTask } from '@/lib/db/tasks';
import type { CustomField, FieldValue, Task } from '@/lib/db/types';

interface TaskFieldsSectionProps {
  task: Task;
  fields: CustomField[];
  editable: boolean;
  onManage?: () => void;
}

/** Editors for a card's custom fields, saved as you go. */
export function TaskFieldsSection({ task, fields, editable, onManage }: TaskFieldsSectionProps) {
  const toast = useToast();

  if (!fields.length) {
    return onManage ? (
      <button type="button" onClick={onManage} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300">
        <Settings2 className="h-3.5 w-3.5" /> Add custom fields to this project
      </button>
    ) : null;
  }

  const save = async (field: CustomField, raw: unknown) => {
    try {
      const value = cleanFieldValue(field, raw);
      const current = task.customValues?.[field.id] ?? null;
      if (value === current || (value === false && current === null)) return;
      await updateTask(task.id, { customValues: withFieldValue(task, field.id, value) });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Fields</h3>
        {onManage && (
          <button type="button" onClick={onManage} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300">
            <Settings2 className="h-3.5 w-3.5" /> Manage
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldEditor key={field.id} field={field} value={task.customValues?.[field.id] ?? null} editable={editable} onSave={(raw) => save(field, raw)} />
        ))}
      </div>
    </section>
  );
}

function FieldEditor({ field, value, editable, onSave }: { field: CustomField; value: FieldValue; editable: boolean; onSave: (raw: unknown) => void }) {
  const id = `field-${field.id}`;
  const [draft, setDraft] = useState(value === null ? '' : String(value));

  // Follow changes made elsewhere (another tab, a teammate, the AI) unless the person is typing here.
  useEffect(() => {
    if (document.activeElement?.id !== id) setDraft(value === null ? '' : String(value));
  }, [value, id]);

  if (field.type === 'checkbox') {
    return (
      <label htmlFor={id} className="flex items-center gap-2.5 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
        <input id={id} type="checkbox" checked={value === true} disabled={!editable} onChange={(e) => onSave(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        {field.name}
      </label>
    );
  }

  const selected = field.type === 'select' ? field.options.find((o) => o.id === value) : undefined;

  return (
    <div>
      <label className="label" htmlFor={id}>{field.name}</label>
      {field.type === 'select' ? (
        <div className="relative">
          {selected && <span className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: selected.color }} />}
          <select id={id} className={`input ${selected ? 'pl-8' : ''}`} value={typeof value === 'string' ? value : ''} disabled={!editable} onChange={(e) => onSave(e.target.value || null)}>
            <option value="">—</option>
            {field.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      ) : field.type === 'date' ? (
        <input id={id} type="date" className="input" value={typeof value === 'string' ? value : ''} disabled={!editable} onChange={(e) => onSave(e.target.value || null)} />
      ) : (
        <div className="relative">
          <input
            id={id}
            className={`input ${field.type === 'url' && value ? 'pr-9' : ''}`}
            type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            value={draft}
            maxLength={500}
            disabled={!editable}
            placeholder={field.type === 'url' ? 'https://' : field.type === 'number' ? '0' : ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onSave(draft.trim() === '' ? null : draft)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          {field.type === 'url' && typeof value === 'string' && (
            <a href={value} target="_blank" rel="noopener noreferrer" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-brand-600" aria-label={`Open ${field.name}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
