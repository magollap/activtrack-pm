import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FolderX, SearchX, ListPlus, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { ProjectHeader } from '@/features/projects/ProjectHeader';
import { ViewSwitcher } from '@/features/projects/ViewSwitcher';
import { QuickAdd } from '@/features/tasks/QuickAdd';
import { TaskPanel } from '@/features/tasks/TaskPanel';
import { FilterToolbar } from '@/features/filters/FilterToolbar';
import { BoardView } from '@/features/board/BoardView';
import { ListView } from '@/features/list/ListView';
import { CalendarView } from '@/features/calendar/CalendarView';
import { useProjectData } from '@/hooks/useProjectData';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { canWrite, isGovernor } from '@/lib/db/access';
import { useProjectFilters } from '@/hooks/useProjectFilters';
import { applyFilters, countActiveFilters } from '@/lib/filters';
import { EMPTY_FILTERS, getProjectView, setProjectView, type ProjectView } from '@/lib/prefs';
import { isTyping, MOD_KEY, openAssistant, runCommand } from '@/lib/commands';
import { ProjectProgress } from '@/features/projects/ProjectProgress';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const me = useCurrentUser();
  const { data, loading, error } = useProjectData(projectId, me);
  const [filters, setFilters] = useProjectFilters(projectId);
  const [view, setView] = useState<ProjectView>(() => getProjectView(projectId));
  const [viewFor, setViewFor] = useState(projectId);
  if (viewFor !== projectId) {
    setViewFor(projectId);
    setView(getProjectView(projectId));
  }

  const visibleTasks = useMemo(
    () => (data ? applyFilters(data.tasks, filters, data.statuses) : []),
    [data, filters],
  );

  const openTaskId = searchParams.get('task');
  const openTask = (taskId: string) => setSearchParams((p) => { p.set('task', taskId); return p; });
  const closeTask = () => setSearchParams((p) => { p.delete('task'); return p; }, { replace: true });
  const changeView = (next: ProjectView) => {
    setView(next);
    setProjectView(projectId, next);
  };

  // N adds a card; B, L and C switch views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return;
      const views: Record<string, ProjectView> = { b: 'board', l: 'list', c: 'calendar' };
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        if (view === 'calendar') changeView('board');
        setTimeout(() => runCommand('quick-add'), 0);
      } else if (views[key]) {
        changeView(views[key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) {
    return (
      <EmptyState
        icon={FolderX}
        title="Project not found"
        message="It may have been deleted, or the link is wrong."
        action={<Link to="/" className="btn-primary">Go home</Link>}
      />
    );
  }

  const { project, statuses, tasks, members, checklist, access, fields } = data;
  const editable = canWrite(access);
  const viewProps = { projectId, statuses, tasks: visibleTasks, members, checklist, fields, editable, onOpenTask: openTask };
  const firstOpenStatus = statuses.find((s) => !s.isDone) ?? statuses[0];
  const filtered = countActiveFilters(filters) > 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 px-4 pb-4 pt-6 sm:px-6">
        <ProjectHeader project={project} statuses={statuses} fields={fields} taskCount={tasks.length} access={access} isGovernor={isGovernor(me)} />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ViewSwitcher view={view} onChange={changeView} />
          <FilterToolbar filters={filters} onChange={setFilters} statuses={statuses} members={members} />
        </div>
        <ProjectProgress statuses={statuses} tasks={tasks} />
        {editable && !project.archivedAt && view !== 'calendar' && firstOpenStatus && (
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <QuickAdd projectId={projectId} statusId={firstOpenStatus.id} listenForShortcut placeholder={`Add a card to ${firstOpenStatus.name}, press Enter (N)`} />
            </div>
            <button
              type="button"
              className="btn shrink-0 border border-gold-300 bg-gold-50 text-gold-800 hover:bg-gold-100 dark:border-gold-500/40 dark:bg-gold-500/10 dark:text-gold-300 dark:hover:bg-gold-500/20"
              onClick={() => openAssistant()}
              title={`Add or move cards in plain English (${MOD_KEY}+K)`}
            >
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">AI</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pb-8 sm:px-6">
        {tasks.length === 0 && view === 'list' ? (
          <EmptyState
            icon={ListPlus}
            title="No tasks yet"
            message={editable
              ? 'Type a task title in the box above and press Enter. You can keep adding tasks one after another.'
              : 'Nobody has added tasks to this project yet.'}
          />
        ) : filtered && visibleTasks.length === 0 && view !== 'calendar' ? (
          <EmptyState
            icon={SearchX}
            title="No tasks match your filters"
            message="Try removing a filter or changing your search."
            action={<button className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>}
          />
        ) : view === 'board' ? (
          <BoardView {...viewProps} />
        ) : view === 'list' ? (
          <ListView {...viewProps} />
        ) : (
          <CalendarView {...viewProps} />
        )}
      </div>

      {openTaskId && (
        <TaskPanel key={openTaskId} taskId={openTaskId} statuses={statuses} members={members} fields={fields} access={access} onClose={closeTask} />
      )}
    </div>
  );
}
