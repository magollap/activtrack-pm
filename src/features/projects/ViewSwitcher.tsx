import { CalendarDays, Columns3, List } from 'lucide-react';
import type { ProjectView } from '@/lib/prefs';

const VIEWS: { id: ProjectView; label: string; icon: typeof List }[] = [
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export function ViewSwitcher({ view, onChange }: { view: ProjectView; onChange: (view: ProjectView) => void }) {
  return (
    <div className="inline-flex self-start rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="View">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={view === id}
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            view === id
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
