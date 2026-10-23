import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Search, X } from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { listProjects } from '@/lib/db/projects';
import { listTasks } from '@/lib/db/tasks';

async function loadSearchData() {
  const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
  return { projects, tasks };
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const { data } = useQuery(loadSearchData, 'global-search');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault();
        setMobileExpanded(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return { projects: [], tasks: [] };
    const projectNames = new Map(data.projects.map((p) => [p.id, p]));
    return {
      projects: data.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4),
      tasks: data.tasks
        .filter((t) => t.title.toLowerCase().includes(q))
        .slice(0, 8)
        .map((t) => ({ task: t, project: projectNames.get(t.projectId) })),
    };
  }, [query, data]);

  const go = (path: string) => {
    navigate(path);
    setQuery('');
    setOpen(false);
    setMobileExpanded(false);
  };

  const hasQuery = query.trim().length > 0;
  const empty = hasQuery && !results.projects.length && !results.tasks.length;

  return (
    <>
      <button className="icon-btn sm:hidden" onClick={() => { setMobileExpanded(true); setTimeout(() => inputRef.current?.focus(), 0); }} aria-label="Search">
        <Search className="h-5 w-5" />
      </button>
      <div className={`${mobileExpanded ? 'absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-2 bg-white px-4 dark:bg-slate-900' : 'hidden'} sm:relative sm:flex sm:h-auto sm:bg-transparent sm:px-0 sm:dark:bg-transparent`}>
        <div className="relative flex-1 sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), inputRef.current?.blur(), setMobileExpanded(false))}
            placeholder="Search tasks and projects"
            className="input pl-9 pr-8"
            aria-label="Search tasks and projects"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 px-1.5 text-[10px] text-slate-400 dark:border-slate-700 sm:block">/</kbd>
          {open && hasQuery && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 animate-scale-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {empty && <p className="px-3 py-4 text-center text-sm text-slate-500">No matches for "{query.trim()}"</p>}
              {results.projects.map((p) => (
                <button key={p.id} onMouseDown={() => go(`/projects/${p.id}`)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700">
                  <FolderKanban className="h-4 w-4 shrink-0" style={{ color: p.color }} />
                  <span className="truncate font-medium">{p.name}</span>
                </button>
              ))}
              {results.tasks.map(({ task, project }) => (
                <button key={task.id} onMouseDown={() => go(`/projects/${task.projectId}?task=${task.id}`)} className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">
                  <span className="truncate text-sm">{task.title}</span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">{project?.name ?? 'Unknown project'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {mobileExpanded && (
          <button className="icon-btn sm:hidden" onClick={() => { setMobileExpanded(false); setQuery(''); }} aria-label="Close search">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );
}
