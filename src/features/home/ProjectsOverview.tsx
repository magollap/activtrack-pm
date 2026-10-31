import { Link } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { ProjectSummary } from '@/features/home/loadDashboard';
import { HealthBadge } from '@/features/status/StatusUpdates';

/** Completion per project, most open work first. */
export function ProjectsOverview({ projects }: { projects: ProjectSummary[] }) {
  return (
    <section className="card">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="font-semibold">Project progress</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Share of cards in a done status</p>
      </header>
      {projects.length === 0 ? (
        <EmptyState compact icon={FolderKanban} title="No cards yet" message="Add cards to a project and its progress shows up here." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.slice(0, 8).map(({ project, total, done, overdue, latestUpdate }) => {
            const percent = Math.round((done / total) * 100);
            return (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className="block px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                    {latestUpdate && <HealthBadge health={latestUpdate.health} />}
                    {overdue > 0 && <span className="rounded-full bg-red-50 px-2 text-[11px] font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">{overdue} overdue</span>}
                    <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">{done}/{total}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
