import { useState } from 'react';
import { ArrowDown, ArrowUp, Calendar, CheckSquare, ChevronDown, Eye, EyeOff, Hash, Link2, Pencil, Plus, Trash2, Type, X } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { COLOR_PALETTE } from '@/lib/colors';
import {
  FIELD_TYPE_META,
  createField,
  defaultOptionColor,
  deleteField,
  newOptionId,
  reorderFields,
  updateField,
  type FieldInput,
} from '@/lib/db/fields';
import { FIELD_TYPES, type CustomField, type FieldType } from '@/lib/db/types';

const FIELD_ICONS: Record<FieldType, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: ChevronDown,
  checkbox: CheckSquare,
  url: Link2,
};

const EMPTY: FieldInput = { name: '', type: 'text', options: [], showOnCard: true };

interface FieldsModalProps {
  projectId: string;
  fields: CustomField[];
  onClose: () => void;
}

/** Add, edit, reorder and remove a project's custom fields. */
export function FieldsModal({ projectId, fields, onClose }: FieldsModalProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<CustomField | 'new' | null>(fields.length ? null : 'new');
  const [deleting, setDeleting] = useState<CustomField | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(error);
    }
  };

  const move = (index: number, delta: number) => {
    const ids = fields.map((f) => f.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    void run(() => reorderFields(ids));
  };

  return (
    <Modal title="Custom fields" onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add your own fields to every card in this project, like story points, severity or a client name. Fields marked with the eye appear on the card in the board and list.
        </p>

        {fields.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {fields.map((field, index) => {
              const Icon = FIELD_ICONS[field.type];
              return (
                <li key={field.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{field.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {FIELD_TYPE_META[field.type].label}
                      {field.type === 'select' && ` · ${field.options.map((o) => o.label).join(', ')}`}
                    </p>
                  </div>
                  <button className="icon-btn h-8 w-8" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${field.name} up`}><ArrowUp className="h-4 w-4" /></button>
                  <button className="icon-btn h-8 w-8" disabled={index === fields.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${field.name} down`}><ArrowDown className="h-4 w-4" /></button>
                  <button
                    className={`icon-btn h-8 w-8 ${field.showOnCard ? 'text-brand-600 dark:text-brand-400' : ''}`}
                    onClick={() => run(() => updateField(field.id, { ...field, showOnCard: !field.showOnCard }))}
                    aria-label={field.showOnCard ? `Hide ${field.name} on cards` : `Show ${field.name} on cards`}
                    title={field.showOnCard ? 'Shown on cards' : 'Hidden on cards'}
                  >
                    {field.showOnCard ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button className="icon-btn h-8 w-8" onClick={() => setEditing(field)} aria-label={`Edit ${field.name}`}><Pencil className="h-4 w-4" /></button>
                  <button className="icon-btn h-8 w-8 hover:text-red-600" onClick={() => setDeleting(field)} aria-label={`Delete ${field.name}`}><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}

        {editing ? (
          <FieldForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? EMPTY : editing}
            isNew={editing === 'new'}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === 'new') {
                await createField(projectId, input);
                toast.success(`Added "${input.name.trim()}"`);
              } else {
                await updateField(editing.id, input);
                toast.success('Field updated');
              }
              setEditing(null);
            }}
          />
        ) : (
          <button className="btn-secondary w-full" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Add a field
          </button>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete field?"
          message={`"${deleting.name}" and its values on every card in this project will be removed.`}
          confirmLabel="Delete field"
          onConfirm={async () => { await deleteField(deleting.id); toast.success('Field deleted'); }}
          onClose={() => setDeleting(null)}
        />
      )}
    </Modal>
  );
}

function FieldForm({ initial, isNew, onSave, onCancel }: { initial: FieldInput; isNew: boolean; onSave: (input: FieldInput) => Promise<void>; onCancel: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<FieldInput>({ ...initial, options: initial.options.map((o) => ({ ...o })) });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FieldInput>) => setDraft((d) => ({ ...d, ...patch }));

  const setType = (type: FieldType) =>
    set({ type, options: type === 'select' && !draft.options.length ? [{ id: newOptionId(), label: '', color: defaultOptionColor(0) }] : draft.options });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(draft);
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="field-name">Field name</label>
          <input id="field-name" className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} autoFocus placeholder="e.g. Story points" />
        </div>
        <div>
          <label className="label" htmlFor="field-type">Type</label>
          <select id="field-type" className="input" value={draft.type} onChange={(e) => setType(e.target.value as FieldType)} disabled={!isNew}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_META[t].label} · {FIELD_TYPE_META[t].hint}</option>)}
          </select>
          {!isNew && <p className="mt-1 text-xs text-slate-500">The type can't change once a field exists.</p>}
        </div>
      </div>

      {draft.type === 'select' && (
        <div>
          <span className="label">Choices</span>
          <ul className="space-y-2">
            {draft.options.map((option, index) => (
              <li key={option.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-7 w-7 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
                  style={{ backgroundColor: option.color }}
                  onClick={() => {
                    const next = COLOR_PALETTE[(COLOR_PALETTE.findIndex((c) => c.hex === option.color) + 1) % COLOR_PALETTE.length].hex;
                    set({ options: draft.options.map((o) => (o.id === option.id ? { ...o, color: next } : o)) });
                  }}
                  aria-label={`Change color of choice ${index + 1}`}
                  title="Click to change color"
                />
                <input
                  className="input py-1.5"
                  value={option.label}
                  maxLength={60}
                  placeholder={`Choice ${index + 1}`}
                  aria-label={`Choice ${index + 1}`}
                  onChange={(e) => set({ options: draft.options.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)) })}
                />
                <button type="button" className="icon-btn h-8 w-8 shrink-0" onClick={() => set({ options: draft.options.filter((o) => o.id !== option.id) })} aria-label={`Remove choice ${index + 1}`}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost mt-2 py-1.5 text-xs"
            onClick={() => set({ options: [...draft.options, { id: newOptionId(), label: '', color: defaultOptionColor(draft.options.length) }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add choice
          </button>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.showOnCard} onChange={(e) => set({ showOnCard: e.target.checked })} className="h-4 w-4 accent-brand-600" />
        Show on cards in the board and list
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy || !draft.name.trim()}>{isNew ? 'Add field' : 'Save field'}</button>
      </div>
    </form>
  );
}
