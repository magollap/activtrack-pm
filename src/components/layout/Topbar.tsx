import { matchPath, useLocation } from 'react-router-dom';
import { Menu, Sparkles } from 'lucide-react';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { UserMenu } from '@/components/layout/UserMenu';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { useQuery } from '@/hooks/useQuery';
import { getProject } from '@/lib/db/projects';
import { MOD_KEY, openAssistant } from '@/lib/commands';

function usePageTitle(): string {
  const { pathname } = useLocation();
  const projectId = matchPath('/projects/:projectId', pathname)?.params.projectId ?? '';
  const { data: project } = useQuery(() => (projectId ? getProject(projectId) : Promise.resolve(null)), `title:${projectId}`);
  if (projectId) return project?.name ?? 'Project';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/my-tasks')) return 'My tasks';
  if (pathname === '/') return 'Home';
  return 'Not found';
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const title = usePageTitle();

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:gap-3 sm:px-6">
      <button className="icon-btn -ml-2 md:hidden" onClick={onOpenMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      <GlobalSearch />
      <button
        type="button"
        onClick={() => openAssistant()}
        className="btn hidden border border-gold-300 bg-gold-50 py-1.5 text-gold-800 hover:bg-gold-100 dark:border-gold-500/40 dark:bg-gold-500/10 dark:text-gold-300 dark:hover:bg-gold-500/20 lg:inline-flex"
        title={`AI assistant (${MOD_KEY}+K)`}
      >
        <Sparkles className="h-4 w-4" /> Ask AI
        <kbd className="ml-1 rounded border border-gold-300/80 px-1 text-[10px] font-medium text-gold-700 dark:border-gold-500/40 dark:text-gold-400">{MOD_KEY} K</kbd>
      </button>
      <button type="button" className="icon-btn text-gold-600 dark:text-gold-400 lg:hidden" onClick={() => openAssistant()} aria-label="AI assistant">
        <Sparkles className="h-5 w-5" />
      </button>
      <ThemeSwitch />
      <UserMenu />
    </header>
  );
}
