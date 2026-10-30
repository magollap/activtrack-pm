import { Check } from 'lucide-react';
import { formatFieldValue } from '@/lib/db/fields';
import type { CustomField, Task } from '@/lib/db/types';

/** Small chips for a card's custom field values (only fields marked "show on card"). */
export function FieldChips({ task, fields, limit = 4 }: { task: Task; fields: CustomField[]; limit?: number }) {
  const values = task.customValues ?? {};
  const chips = fields
    .filter((f) => f.showOnCard)
    .map((field) => ({ field, text: formatFieldValue(field, values[field.id]) }))
    .filter((c): c is { field: CustomField; text: string } => c.text !== null)
    .slice(0, limit);
  if (!chips.length) return null;

  return (
    <>
      {chips.map(({ field, text }) => {
        if (field.type === 'select') {
          const color = field.options.find((o) => o.id === values[field.id])?.color ?? '#64748b';
          return (
            <span
              key={field.id}
              className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${color}1f`, color }}
              title={`${field.name}: ${text}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate">{text}</span>
            </span>
          );
        }
        return (
          <span
            key={field.id}
            className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            title={`${field.name}: ${text}`}
          >
            {field.type === 'checkbox' ? (
              <><Check className="h-3 w-3 shrink-0 text-brand-600 dark:text-brand-400" /><span className="truncate">{field.name}</span></>
            ) : (
              <><span className="shrink-0 text-slate-400">{field.name}</span><span className="truncate font-medium">{text}</span></>
            )}
          </span>
        );
      })}
    </>
  );
}
