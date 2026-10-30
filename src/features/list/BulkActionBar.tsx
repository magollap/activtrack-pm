import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { updateTask, type TaskPatch } from '@/lib/db/tasks';
import { PRIORITY_META } from '@/lib/priority';
import { PRIORITIES, type Member, type Priority, type Status } from '@/lib/db/types';

interface BulkActionBarProps {
  taskIds: string[];
  statuses: Status[];
  members: Member[];
  onDone: () => void;
}

const UNASSIGN = '__none__';
const control =
  'rounded-lg border border-white/15 bg-white/10 py-1.5 pl-2.5 pr-7 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-400/60 dark:border-gold-500/30 dark:bg-gold-500/10 [&>option]:text-slate-900';

/** Floating bar for changing many selected cards at once. */
export function BulkActionBar({ taskIds, statuses, members, onDone }: BulkActionBarProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (patch: TaskPatch, label: string) => {
    setBusy(true);
    let failed = 0;
    for (const id of taskIds) {
      try {
        await updateTask(id, patch);
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    const changed = taskIds.length - failed;
    if (changed) toast.success(`${label} for ${changed} card${changed === 1 ? '' : 's'}`);
    if (failed) toast.error(new Error(`${failed} card${failed === 1 ? '' : 's'} could not be changed.`));
    onDone();
  };

  return (
    <div className="sticky top-2 z-20 flex justify-center">
      <div className="flex max-w-full animate-slide-down flex-wrap items-center gap-2 rounded-2xl bg-brand-900 px-3 py-2 text-white shadow-2xl ring-1 ring-black/10 dark:bg-black dark:ring-gold-500/40">
        <span className="px-1 text-sm font-medium">
          {busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <span className="text-gold-300 dark:text-gold-400">{taskIds.length}</span>} selected
        </span>
        <select
          className={control}
          value=""
          disabled={busy}
          aria-label="Move selected cards to status"
          onChange={(e) => {
            const status = statuses.find((s) => s.id === e.target.value);
            if (status) void run({ statusId: status.id }, `Moved to ${status.name}`);
          }}
        >
          <option value="" disabled>Move to…</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className={control}
          value=""
          disabled={busy}
          aria-label="Set priority of selected cards"
          onChange={(e) => {
            const priority = e.target.value as Priority;
            void run({ priority }, `Priority set to ${PRIORITY_META[priority].label}`);
          }}
        >
          <option value="" disabled>Priority…</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <select
          className={control}
          value=""
          disabled={busy}
          aria-label="Assign selected cards"
          onChange={(e) => {
            const value = e.target.value;
            const member = members.find((m) => m.id === value);
            void run({ assigneeId: value === UNASSIGN ? null : value }, member ? `Assigned to ${member.name}` : 'Unassigned');
          }}
        >
          <option value="" disabled>Assign…</option>
          <option value={UNASSIGN}>Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" onClick={onDone} disabled={busy} aria-label="Clear selection">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
