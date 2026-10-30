import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { StatCard } from '@/features/home/StatCard';
import { NeedsAttention } from '@/features/home/NeedsAttention';
import { MemberWorkload } from '@/features/home/MemberWorkload';
import { ProjectsOverview } from '@/features/home/ProjectsOverview';
import { loadDashboard } from '@/features/home/loadDashboard';
import { useQuery } from '@/hooks/useQuery';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { MOD_KEY, openAssistant } from '@/lib/commands';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const me = useCurrentUser();
  const { data, loading, error } = useQuery(loadDashboard, 'dashboard');

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h2 className="text-2xl font-semibold tracking-tight">{greeting()}, {me.name.split(' ')[0]}</h2>
        </div>
        <button
          type="button"
          onClick={() => openAssistant()}
          className="group flex items-center gap-3 rounded-xl border border-gold-300 bg-gradient-to-r from-gold-50 to-white px-4 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md dark:border-gold-500/30 dark:from-gold-500/10 dark:to-transparent sm:min-w-[22rem]"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-gold-600 dark:text-gold-400" />
          <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">Ask AI to add or move cards…</span>
          <kbd className="kbd">{MOD_KEY} K</kbd>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open tasks" value={data.openCount} icon={CircleDot} tone="info" />
        <StatCard label="Due today" value={data.dueTodayCount} icon={CalendarClock} tone="gold" />
        <StatCard label="Overdue" value={data.overdueCount} icon={AlertTriangle} tone="red" />
        <StatCard label="Done this week" value={data.completedThisWeek} icon={CheckCircle2} tone="brand" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><NeedsAttention items={data.attention} /></div>
        <MemberWorkload workload={data.workload} />
      </div>
      <ProjectsOverview projects={data.projects} />
    </div>
  );
}
