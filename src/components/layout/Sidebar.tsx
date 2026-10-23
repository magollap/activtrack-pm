import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Archive, ChevronRight, Home, Lock, Plus, Settings, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ProjectFormModal } from '@/features/projects/ProjectFormModal';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { canCreateProjects } from '@/lib/db/access';
import { listProjects } from '@/lib/db/projects';
import type { Project } from '@/lib/db/types';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;

function ProjectLink({ project, onNavigate }: { project: Project; onNavigate: () => void }) {
  return (
    <NavLink to={`/projects/${project.id}`} className={linkClass} onClick={onNavigate}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
      <span className="truncate">{project.name}</span>
      {project.isPersonal && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" aria-label="Private" />}
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const me = useCurrentUser();
  const canCreate = canCreateProjects(me);
  const { data: projects = [] } = useQuery(listProjects, `projects:${me.id}`);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const personal = projects.filter((p) => p.isPersonal);
  const active = projects.filter((p) => !p.archivedAt && !p.isPersonal);
  const archived = projects.filter((p) => p.archivedAt);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 animate-fade-in bg-slate-900/40 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:static md:z-auto md:w-64 md:translate-x-0 ${
          mobileOpen ? 'animate-slide-right' : 'hidden md:flex'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">Workday</span>
          </NavLink>
          <button className="icon-btn md:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavLink to="/" end className={linkClass} onClick={onClose}>
            <Home className="h-4 w-4" /> Home
          </NavLink>

          {personal.length > 0 && (
            <>
              <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">My space</p>
              <div className="space-y-0.5">
                {personal.map((p) => <ProjectLink key={p.id} project={p} onNavigate={onClose} />)}
              </div>
            </>
          )}

          <div className="mb-1 mt-6 flex h-7 items-center justify-between px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Shared projects</span>
            {canCreate && (
              <button className="icon-btn h-7 w-7" onClick={() => setCreating(true)} aria-label="New project" title="New project">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {active.map((p) => <ProjectLink key={p.id} project={p} onNavigate={onClose} />)}
          </div>
          {canCreate ? (
            <button
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          ) : (
            active.length === 0 && (
              <p className="px-3 py-2 text-xs leading-relaxed text-slate-400">
                Projects show up here once a governor gives you access.
              </p>
            )
          )}

          {archived.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                <Archive className="h-3.5 w-3.5" /> Archived ({archived.length})
              </button>
              {showArchived && (
                <div className="mt-1 space-y-0.5 opacity-75">
                  {archived.map((p) => <ProjectLink key={p.id} project={p} onNavigate={onClose} />)}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <NavLink to="/settings" className={linkClass} onClick={onClose}>
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
        </div>
      </aside>
      {creating && <ProjectFormModal onClose={() => setCreating(false)} />}
    </>
  );
}
