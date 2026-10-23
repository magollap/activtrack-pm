import { matchPath, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { UserMenu } from '@/components/layout/UserMenu';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/hooks/useTheme';
import { getProject } from '@/lib/db/projects';

function usePageTitle(): string {
  const { pathname } = useLocation();
  const projectId = matchPath('/projects/:projectId', pathname)?.params.projectId ?? '';
  const { data: project } = useQuery(() => (projectId ? getProject(projectId) : Promise.resolve(null)), `title:${projectId}`);
  if (projectId) return project?.name ?? 'Project';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname === '/') return 'Home';
  return 'Not found';
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const title = usePageTitle();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:gap-4 sm:px-6">
      <button className="icon-btn -ml-2 md:hidden" onClick={onOpenMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      <GlobalSearch />
      <button
        className="icon-btn"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <UserMenu />
    </header>
  );
}
