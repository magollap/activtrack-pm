import type { Status, Task } from '@/lib/db/types';

/** A slim bar showing how the project's cards are spread across its statuses, with the share that is done. */
export function ProjectProgress({ statuses, tasks }: { statuses: Status[]; tasks: Task[] }) {
  if (!tasks.length) return null;
  const counts = statuses.map((s) => ({ status: s, count: tasks.filter((t) => t.statusId === s.id).length }));
  const done = counts.filter((c) => c.status.isDone).reduce((sum, c) => sum + c.count, 0);
  const percent = Math.round((done / tasks.length) * 100);

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800"
        role="img"
        aria-label={counts.map((c) => `${c.status.name}: ${c.count}`).join(', ')}
      >
        {counts.filter((c) => c.count).map(({ status, count }) => (
          <div
            key={status.id}
            className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(count / tasks.length) * 100}%`, backgroundColor: status.color }}
            title={`${status.name}: ${count}`}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
        <span className="text-slate-900 dark:text-slate-100">{percent}%</span> done · {done}/{tasks.length}
      </span>
    </div>
  );
}
