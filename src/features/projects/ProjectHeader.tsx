import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Eye, Lock, MoreHorizontal, Pencil, Trash2, UserPlus, Workflow } from 'lucide-react';
import { Popover } from '@/components/Popover';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProjectFormModal } from '@/features/projects/ProjectFormModal';
import { WorkflowModal } from '@/features/workflow/WorkflowModal';
import { ProjectAccessModal } from '@/features/admin/ProjectAccessModal';
import { archiveProject, deleteProject, restoreProject } from '@/lib/db/projects';
import { useToast } from '@/hooks/useToast';
import { ACCESS_META, canManage } from '@/lib/db/access';
import type { Project, ProjectAccess, Status } from '@/lib/db/types';

interface ProjectHeaderProps {
  project: Project;
  statuses: Status[];
  taskCount: number;
  access: ProjectAccess | null;
  isGovernor: boolean;
}

type Dialog = 'edit' | 'workflow' | 'archive' | 'delete' | 'share' | null;

const menuItem = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700';

export function ProjectHeader({ project, statuses, taskCount, access, isGovernor }: ProjectHeaderProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const manage = canManage(access);
  const shareable = isGovernor && !project.isPersonal;
  const deletable = isGovernor && !project.isPersonal;

  const restore = async () => {
    try {
      await restoreProject(project.id);
      toast.success('Project restored');
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <>
      {project.archivedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="flex items-center gap-2"><Archive className="h-4 w-4" /> This project is archived.</span>
          {manage && <button className="btn-secondary py-1.5" onClick={restore}><ArchiveRestore className="h-4 w-4" /> Restore</button>}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
            <h2 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h2>
            {project.isPersonal && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
            {access && access !== 'manage' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info-50 px-2 py-0.5 text-xs font-medium text-info-700 dark:bg-info-950 dark:text-info-300" title={ACCESS_META[access].description}>
                {access === 'read' && <Eye className="h-3 w-3" />} {ACCESS_META[access].label}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
          )}
        </div>
        {manage && <div className="flex shrink-0 items-center gap-1">
          {shareable && (
            <button className="btn-secondary hidden sm:inline-flex" onClick={() => setDialog('share')}>
              <UserPlus className="h-4 w-4" /> People
            </button>
          )}
          <button className="btn-secondary hidden sm:inline-flex" onClick={() => setDialog('workflow')}>
            <Workflow className="h-4 w-4" /> Workflow
          </button>
          <Popover
            align="right"
            trigger={({ toggle }) => (
              <button className="icon-btn" onClick={toggle} aria-label="Project options"><MoreHorizontal className="h-5 w-5" /></button>
            )}
          >
            {(closeMenu) => (
              <>
                <button className={menuItem} onClick={() => { closeMenu(); setDialog('edit'); }}><Pencil className="h-4 w-4" /> Edit details</button>
                <button className={menuItem} onClick={() => { closeMenu(); setDialog('workflow'); }}><Workflow className="h-4 w-4" /> Manage workflow</button>
                {shareable && (
                  <button className={menuItem} onClick={() => { closeMenu(); setDialog('share'); }}><UserPlus className="h-4 w-4" /> Manage people</button>
                )}
                {project.isPersonal ? null : project.archivedAt ? (
                  <button className={menuItem} onClick={() => { closeMenu(); restore(); }}><ArchiveRestore className="h-4 w-4" /> Restore</button>
                ) : (
                  <button className={menuItem} onClick={() => { closeMenu(); setDialog('archive'); }}><Archive className="h-4 w-4" /> Archive</button>
                )}
                {deletable && (
                  <>
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
                    <button className={`${menuItem} text-red-600 dark:text-red-400`} onClick={() => { closeMenu(); setDialog('delete'); }}><Trash2 className="h-4 w-4" /> Delete project</button>
                  </>
                )}
              </>
            )}
          </Popover>
        </div>}
      </div>

      {dialog === 'edit' && <ProjectFormModal project={project} onClose={close} />}
      {dialog === 'share' && <ProjectAccessModal project={project} onClose={close} />}
      {dialog === 'workflow' && <WorkflowModal projectId={project.id} statuses={statuses} onClose={close} />}
      {dialog === 'archive' && (
        <ConfirmDialog
          title="Archive project?"
          message={`"${project.name}" will move to the archived list in the sidebar. You can restore it at any time.`}
          confirmLabel="Archive"
          destructive={false}
          onConfirm={async () => { await archiveProject(project.id); toast.success('Project archived'); }}
          onClose={close}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${project.name}" and its ${taskCount} task${taskCount === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete project"
          onConfirm={async () => { await deleteProject(project.id); navigate('/'); toast.success('Project deleted'); }}
          onClose={close}
        />
      )}
    </>
  );
}
