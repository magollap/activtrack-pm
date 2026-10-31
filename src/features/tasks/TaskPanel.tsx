import { useEffect, useState } from 'react';
import { Copy, History, Link2, ListChecks, MessageSquare, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingState } from '@/components/QueryStates';
import { TaskDetailsTab } from '@/features/tasks/TaskDetailsTab';
import { CommentsTab } from '@/features/comments/CommentsTab';
import { HistoryTab } from '@/features/tasks/HistoryTab';
import { FieldsModal } from '@/features/fields/FieldsModal';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { deleteTask, duplicateTask, getTask } from '@/lib/db/tasks';
import { canDeleteTask, canManage, canWrite } from '@/lib/db/access';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import type { CustomField, Member, ProjectAccess, Status } from '@/lib/db/types';

interface TaskPanelProps {
  taskId: string;
  statuses: Status[];
  members: Member[];
  fields: CustomField[];
  access: ProjectAccess | null;
  onClose: () => void;
}

type Tab = 'details' | 'comments' | 'history';
const TABS: { id: Tab; label: string; icon: typeof History }[] = [
  { id: 'details', label: 'Details', icon: ListChecks },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'history', label: 'History', icon: History },
];

export function TaskPanel({ taskId, statuses, members, fields, access, onClose }: TaskPanelProps) {
  const toast = useToast();
  const me = useCurrentUser();
  const editable = canWrite(access);
  const { data: task, loading } = useQuery(() => getTask(taskId), `task:${taskId}`);
  const [tab, setTab] = useState<Tab>('details');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [managingFields, setManagingFields] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirmDelete && !managingFields && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete, managingFields]);

  const status = statuses.find((s) => s.id === task?.statusId);
  const [, setSearchParams] = useSearchParams();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error(new Error('Could not copy the link. Copy it from the address bar instead.'));
    }
  };

  const duplicate = async () => {
    if (!task) return;
    try {
      const copy = await duplicateTask(task.id);
      toast.success('Card duplicated');
      setSearchParams((p) => { p.set('task', copy.id); return p; });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Task details">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/30" onClick={onClose} />
      <aside className="relative flex h-full w-full animate-slide-left flex-col bg-white shadow-2xl dark:bg-slate-900 sm:max-w-xl">
        <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-6">
          {status && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium dark:bg-slate-800">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              {status.name}
            </span>
          )}
          {!editable && (
            <span className="rounded-full bg-info-50 px-2.5 py-1 text-xs font-medium text-info-700 dark:bg-info-950 dark:text-info-300">View only</span>
          )}
          <div className="flex-1" />
          {task && (
            <button className="icon-btn" onClick={copyLink} aria-label="Copy link to this card" title="Copy link">
              <Link2 className="h-4 w-4" />
            </button>
          )}
          {task && editable && (
            <button className="icon-btn" onClick={duplicate} aria-label="Duplicate card" title="Duplicate">
              <Copy className="h-4 w-4" />
            </button>
          )}
          {task && canDeleteTask(access, task, me) && (
            <button className="icon-btn hover:text-red-600 dark:hover:text-red-400" onClick={() => setConfirmDelete(true)} aria-label="Delete task" title="Delete task">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close panel"><X className="h-5 w-5" /></button>
        </header>

        {loading && !task ? (
          <LoadingState />
        ) : !task ? (
          <div className="p-8 text-center text-sm text-slate-500">This task no longer exists. It may have been deleted.</div>
        ) : (
          <>
            <nav className="flex gap-1 border-b border-slate-100 px-4 dark:border-slate-800 sm:px-6" role="tablist">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    tab === id
                      ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {tab === 'details' && (
                <TaskDetailsTab
                  task={task}
                  statuses={statuses}
                  members={members}
                  fields={fields}
                  editable={editable}
                  manage={canManage(access)}
                  onManageFields={canManage(access) ? () => setManagingFields(true) : undefined}
                />
              )}
              {tab === 'comments' && <CommentsTab taskId={task.id} members={members} editable={editable} manage={canManage(access)} />}
              {tab === 'history' && <HistoryTab taskId={task.id} />}
            </div>
          </>
        )}
      </aside>

      {managingFields && task && <FieldsModal projectId={task.projectId} fields={fields} onClose={() => setManagingFields(false)} />}
      {confirmDelete && task && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${task.title}" and its checklist, comments and history will be permanently deleted.`}
          confirmLabel="Delete task"
          onConfirm={async () => { await deleteTask(task.id); onClose(); toast.success('Task deleted'); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
