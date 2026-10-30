import { ArrowRight, CalendarDays, Check, Plus, RefreshCw } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PriorityBadge } from '@/components/PriorityBadge';
import { formatDay } from '@/lib/dates';
import { PRIORITY_META } from '@/lib/priority';
import type { ResolvedAction } from '@/lib/ai/types';
import type { Member, Status } from '@/lib/db/types';

function StatusChip({ status }: { status: Status | undefined }) {
  if (!status) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
      {status.name}
    </span>
  );
}

function Change({ label, from, to }: { label: string; from: React.ReactNode; to: React.ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {from}
      <ArrowRight className="h-3 w-3 shrink-0 text-gold-600 dark:text-gold-400" aria-label="to" />
      {to}
    </span>
  );
}

const personLabel = (member: Member | null | undefined) =>
  member ? (
    <span className="inline-flex items-center gap-1"><Avatar member={member} size="xs" /> {member.name}</span>
  ) : (
    <span className="italic">Unassigned</span>
  );

interface ActionPreviewProps {
  action: ResolvedAction;
  statuses: Status[];
  members: Member[];
  checked: boolean;
  onToggle: () => void;
}

/** One proposed change, shown as a checkable row so the person approves exactly what happens. */
export function ActionPreview({ action, statuses, members, checked, onToggle }: ActionPreviewProps) {
  const isCreate = action.kind === 'create';
  return (
    <li>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
          checked
            ? 'border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/5'
            : 'border-slate-200 opacity-60 dark:border-slate-800'
        }`}
      >
        <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
            checked ? 'border-brand-600 bg-brand-600 text-brand-contrast' : 'border-slate-300 dark:border-slate-600'
          }`}
          aria-hidden="true"
        >
          {checked && <Check className="h-3.5 w-3.5" />}
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            isCreate ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-info-100 text-info-700 dark:bg-info-500/15 dark:text-info-300'
          }`}
          aria-hidden="true"
        >
          {isCreate ? <Plus className="h-4 w-4" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{isCreate ? 'New card' : 'Update card'}</span>
          <span className="block break-words text-sm font-medium text-slate-900 dark:text-slate-100">
            {isCreate ? action.title : action.task.title}
          </span>
          {isCreate ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusChip status={action.status} />
              <PriorityBadge priority={action.priority} />
              {action.assignee && <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Avatar member={action.assignee} size="xs" /> {action.assignee.name}</span>}
              {action.dueDate && <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><CalendarDays className="h-3.5 w-3.5" /> {formatDay(action.dueDate)}</span>}
            </span>
          ) : (
            <span className="flex flex-col gap-1">
              {action.changes.status && (
                <Change label="Status" from={<StatusChip status={statuses.find((s) => s.id === action.task.statusId)} />} to={<StatusChip status={action.changes.status} />} />
              )}
              {action.changes.priority && (
                <Change label="Priority" from={PRIORITY_META[action.task.priority].label} to={<PriorityBadge priority={action.changes.priority} />} />
              )}
              {action.changes.assignee !== undefined && (
                <Change label="Assignee" from={personLabel(members.find((m) => m.id === action.task.assigneeId))} to={personLabel(action.changes.assignee)} />
              )}
              {action.changes.dueDate !== undefined && (
                <Change label="Due" from={formatDay(action.task.dueDate)} to={formatDay(action.changes.dueDate)} />
              )}
            </span>
          )}
        </span>
      </label>
    </li>
  );
}
