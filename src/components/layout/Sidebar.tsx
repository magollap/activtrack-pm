import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Archive, BarChart3, ChevronRight, Home, Keyboard, ListTodo, Lock, Plus, Settings, Sparkles, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { MOD_KEY, openAssistant, openShortcuts } from '@/lib/commands';
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
  `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-sidebar-active text-sidebar-accent before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-accent'
      : 'text-sidebar-fg/80 hover:bg-sidebar-hover hover:text-sidebar-fg'
  }`;

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted';

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
      {mobileOpen && <div className="fixed inset-0 z-40 print:hidden animate-fade-in bg-slate-900/40 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col print:hidden border-r border-sidebar-border bg-sidebar text-sidebar-fg md:static md:z-auto md:w-64 md:translate-x-0 ${
          mobileOpen ? 'animate-slide-right' : 'hidden md:flex'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">Activ<span className="text-sidebar-accent">Track</span></span>
          </NavLink>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg md:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-0.5">
            <NavLink to="/" end className={linkClass} onClick={onClose}>
              <Home className="h-4 w-4" /> Home
            </NavLink>
            <NavLink to="/my-tasks" className={linkClass} onClick={onClose}>
              <ListTodo className="h-4 w-4" /> My tasks
            </NavLink>
            <NavLink to="/reports" className={linkClass} onClick={onClose}>
              <BarChart3 className="h-4 w-4" /> Reports
            </NavLink>
            <button type="button" className={`${linkClass({ isActive: false })} w-full`} onClick={() => { onClose(); openAssistant(); }}>
              <Sparkles className="h-4 w-4 text-sidebar-accent" /> AI assistant
              <kbd className="ml-auto rounded border border-sidebar-border px-1.5 text-[10px] font-medium text-sidebar-muted">{MOD_KEY} K</kbd>
            </button>
          </div>

          {personal.length > 0 && (
            <>
              <p className={`mb-1 mt-6 px-3 ${sectionLabel}`}>My space</p>
              <div className="space-y-0.5">
                {personal.map((p) => <ProjectLink key={p.id} project={p} onNavigate={onClose} />)}
              </div>
            </>
          )}

          <div className="mb-1 mt-6 flex h-7 items-center justify-between px-3">
            <span className={sectionLabel}>Shared projects</span>
            {canCreate && (
              <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg" onClick={() => setCreating(true)} aria-label="New project" title="New project">
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
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg"
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          ) : (
            active.length === 0 && (
              <p className="px-3 py-2 text-xs leading-relaxed text-sidebar-muted">
                Projects show up here once a governor gives you access.
              </p>
            )
          )}

          {archived.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-muted hover:text-sidebar-fg"
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

        <div className="space-y-0.5 border-t border-sidebar-border p-3">
          <button type="button" className={`${linkClass({ isActive: false })} hidden w-full md:flex`} onClick={openShortcuts}>
            <Keyboard className="h-4 w-4" /> Shortcuts
            <kbd className="ml-auto rounded border border-sidebar-border px-1.5 text-[10px] font-medium text-sidebar-muted">?</kbd>
          </button>
          <NavLink to="/settings" className={linkClass} onClick={onClose}>
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
        </div>
      </aside>
      {creating && <ProjectFormModal onClose={() => setCreating(false)} />}
    </>
  );
}
