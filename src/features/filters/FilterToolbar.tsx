import { Search, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { MultiSelectMenu } from '@/features/filters/MultiSelectMenu';
import { countActiveFilters, UNASSIGNED } from '@/lib/filters';
import { PRIORITY_META } from '@/lib/priority';
import { EMPTY_FILTERS, type DueFilter, type TaskFilters } from '@/lib/prefs';
import { PRIORITIES, type Member, type Priority, type Status } from '@/lib/db/types';

interface FilterToolbarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  statuses: Status[];
  members: Member[];
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'any', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' },
  { value: 'none', label: 'No due date' },
];

export function FilterToolbar({ filters, onChange, statuses, members }: FilterToolbarProps) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  const active = countActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input py-1.5 pl-9"
          placeholder="Filter tasks"
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          aria-label="Filter tasks by text"
        />
      </div>
      <MultiSelectMenu
        label="Status"
        selected={filters.statusIds}
        onChange={(statusIds) => set({ statusIds })}
        options={statuses.map((s) => ({
          value: s.id,
          label: s.name,
          icon: <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />,
        }))}
      />
      <MultiSelectMenu
        label="Priority"
        selected={filters.priorities}
        onChange={(values) => set({ priorities: values as Priority[] })}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_META[p].label,
          icon: <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_META[p].dot}`} />,
        }))}
      />
      <MultiSelectMenu
        label="Assignee"
        selected={filters.assigneeIds}
        onChange={(assigneeIds) => set({ assigneeIds })}
        options={[
          { value: UNASSIGNED, label: 'Unassigned', icon: <Avatar member={null} size="xs" /> },
          ...members.map((m) => ({ value: m.id, label: m.name, icon: <Avatar member={m} size="xs" /> })),
        ]}
      />
      <select
        value={filters.due}
        onChange={(e) => set({ due: e.target.value as DueFilter })}
        aria-label="Filter by due date"
        className={`rounded-lg border py-1.5 pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          filters.due !== 'any'
            ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300'
            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {DUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {active > 0 && (
        <button className="btn-ghost py-1.5 text-xs" onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
