import { useState } from 'react';
import { Pencil, Plus, Trash2, X, Zap } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { createAutomation, deleteAutomation, listAutomations, setAutomationEnabled, updateAutomation, type AutomationInput } from '@/lib/db/automations';
import { PRIORITY_META } from '@/lib/priority';
import { PRIORITIES, type Automation, type AutomationAction, type AutomationTrigger, type Member, type Status } from '@/lib/db/types';
import { describeAutomation } from '@/features/automations/describe';

interface AutomationsModalProps {
  projectId: string;
  statuses: Status[];
  members: Member[];
  onClose: () => void;
}

const ACTION_LABELS: Record<AutomationAction['type'], string> = {
  set_assignee: 'Assign to',
  set_priority: 'Set priority to',
  move_to_status: 'Move to',
  set_due_in_days: 'Set due date',
  add_checklist: 'Add checklist items',
  add_comment: 'Add a comment',
};

function defaultAction(type: AutomationAction['type'], statuses: Status[]): AutomationAction {
  switch (type) {
    case 'set_assignee': return { type, assignee: 'creator' };
    case 'set_priority': return { type, priority: 'high' };
    case 'move_to_status': return { type, statusId: statuses[0]?.id ?? '' };
    case 'set_due_in_days': return { type, days: 3 };
    case 'add_checklist': return { type, items: [''] };
    case 'add_comment': return { type, text: '' };
  }
}

/** Project automations: list, switch on/off, create, edit and delete rules. */
export function AutomationsModal({ projectId, statuses, members, onClose }: AutomationsModalProps) {
  const toast = useToast();
  const { data: rules = [], loading } = useQuery(() => listAutomations(projectId), `automations:${projectId}`);
  const [editing, setEditing] = useState<Automation | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal title="Automations" onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Rules run whenever anyone changes a card in ActivTrack, including the AI assistant and bulk edits. They act with that person's permissions.
        </p>

        {!loading && rules.length === 0 && !editing && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <Zap className="mx-auto h-6 w-6 text-gold-600 dark:text-gold-400" />
            <p className="mt-2 text-sm font-medium">No automations yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">For example: when a card moves to Review, assign it to your reviewer and make it due in 2 days.</p>
          </div>
        )}

        {rules.length > 0 && (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`${rule.enabled ? 'Turn off' : 'Turn on'} ${rule.name}`}
                  onClick={() => run(() => setAutomationEnabled(rule.id, !rule.enabled))}
                  className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${rule.enabled ? 'bg-brand-600 dark:bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${rule.enabled ? '' : 'text-slate-400'}`}>{rule.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{describeAutomation(rule, statuses, members)}</p>
                </div>
                <button className="icon-btn h-8 w-8" onClick={() => setEditing(rule)} aria-label={`Edit ${rule.name}`}><Pencil className="h-4 w-4" /></button>
                <button className="icon-btn h-8 w-8 hover:text-red-600" onClick={() => setDeleting(rule)} aria-label={`Delete ${rule.name}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <RuleForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            statuses={statuses}
            members={members}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === 'new') await createAutomation(projectId, input);
              else await updateAutomation(editing.id, input);
              toast.success(editing === 'new' ? 'Automation added' : 'Automation saved');
              setEditing(null);
            }}
          />
        ) : (
          <button className="btn-secondary w-full" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add an automation</button>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete automation?"
          message={`"${deleting.name}" will stop running. Cards it already changed stay as they are.`}
          confirmLabel="Delete"
          onConfirm={() => run(() => deleteAutomation(deleting.id), 'Automation deleted')}
          onClose={() => setDeleting(null)}
        />
      )}
    </Modal>
  );
}

function RuleForm({ initial, statuses, members, onSave, onCancel }: {
  initial: Automation | null;
  statuses: Status[];
  members: Member[];
  onSave: (input: AutomationInput) => Promise<void>;
  onCancel: () => void;
}) {
  const toast = useToast();
  const review = statuses.find((s) => /review/i.test(s.name)) ?? statuses[1] ?? statuses[0];
  const [name, setName] = useState(initial?.name ?? '');
  const [trigger, setTrigger] = useState<AutomationTrigger>(initial?.trigger ?? { type: 'status_changed', statusId: review?.id ?? '' });
  const [actions, setActions] = useState<AutomationAction[]>(initial?.actions ?? [{ type: 'set_due_in_days', days: 2 }]);
  const [busy, setBusy] = useState(false);
  const setAction = (index: number, action: AutomationAction) => setActions((all) => all.map((a, i) => (i === index ? action : a)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({ name: name.trim() || describeAutomation({ trigger, actions }, statuses, members).slice(0, 80), enabled: initial?.enabled ?? true, trigger, actions });
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-gold-300 bg-gold-50/40 p-4 dark:border-gold-500/30 dark:bg-gold-500/5">
      <div>
        <label className="label" htmlFor="rule-name">Name</label>
        <input id="rule-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Hand over to review" autoFocus />
      </div>

      <fieldset>
        <legend className="label">When</legend>
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-auto"
            value={trigger.type}
            aria-label="Trigger"
            onChange={(e) => {
              const type = e.target.value as AutomationTrigger['type'];
              setTrigger(type === 'task_created' ? { type } : type === 'status_changed' ? { type, statusId: review?.id ?? '' } : { type, priority: 'urgent' });
            }}
          >
            <option value="status_changed">a card moves to…</option>
            <option value="task_created">a card is created</option>
            <option value="priority_changed">a card's priority becomes…</option>
          </select>
          {trigger.type === 'status_changed' && (
            <select className="input w-auto" value={trigger.statusId} onChange={(e) => setTrigger({ type: 'status_changed', statusId: e.target.value })} aria-label="Status">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {trigger.type === 'priority_changed' && (
            <select className="input w-auto" value={trigger.priority} onChange={(e) => setTrigger({ type: 'priority_changed', priority: e.target.value as never })} aria-label="Priority">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label">Then</legend>
        {actions.map((action, index) => (
          <div key={index} className="flex flex-wrap items-start gap-2 rounded-lg bg-white p-2 dark:bg-slate-900">
            <select className="input w-auto" value={action.type} onChange={(e) => setAction(index, defaultAction(e.target.value as AutomationAction['type'], statuses))} aria-label={`Action ${index + 1}`}>
              {Object.entries(ACTION_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </select>
            {action.type === 'set_assignee' && (
              <select className="input w-auto" value={action.assignee ?? ''} onChange={(e) => setAction(index, { type: 'set_assignee', assignee: e.target.value || null })} aria-label="Person">
                <option value="creator">Whoever created the card</option>
                <option value="">Nobody (unassign)</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            {action.type === 'set_priority' && (
              <select className="input w-auto" value={action.priority} onChange={(e) => setAction(index, { type: 'set_priority', priority: e.target.value as never })} aria-label="Priority">
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            )}
            {action.type === 'move_to_status' && (
              <select className="input w-auto" value={action.statusId} onChange={(e) => setAction(index, { type: 'move_to_status', statusId: e.target.value })} aria-label="Move to status">
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {action.type === 'set_due_in_days' && (
              <label className="flex items-center gap-2 text-sm">
                in
                <input type="number" min={0} max={365} className="input w-20" value={action.days} onChange={(e) => setAction(index, { type: 'set_due_in_days', days: Number(e.target.value) })} aria-label="Days from now" />
                days
              </label>
            )}
            {action.type === 'add_checklist' && (
              <textarea
                className="input min-h-[60px] flex-1"
                value={action.items.join('\n')}
                onChange={(e) => setAction(index, { type: 'add_checklist', items: e.target.value.split('\n') })}
                placeholder={'One item per line\nRun tests\nUpdate docs'}
                aria-label="Checklist items"
              />
            )}
            {action.type === 'add_comment' && (
              <input className="input flex-1" value={action.text} onChange={(e) => setAction(index, { type: 'add_comment', text: e.target.value })} placeholder="e.g. Ready for review, please take a look" aria-label="Comment" maxLength={2000} />
            )}
            {actions.length > 1 && (
              <button type="button" className="icon-btn h-9 w-9" onClick={() => setActions((all) => all.filter((_, i) => i !== index))} aria-label={`Remove action ${index + 1}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {actions.length < 10 && (
          <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setActions((all) => [...all, defaultAction('set_assignee', statuses)])}>
            <Plus className="h-3.5 w-3.5" /> Add another action
          </button>
        )}
      </fieldset>

      <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{describeAutomation({ trigger, actions }, statuses, members)}</p>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{initial ? 'Save automation' : 'Add automation'}</button>
      </div>
    </form>
  );
}
