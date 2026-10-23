import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot } from 'lucide-react';
import { format } from 'date-fns';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { StatCard } from '@/features/home/StatCard';
import { NeedsAttention } from '@/features/home/NeedsAttention';
import { MemberWorkload } from '@/features/home/MemberWorkload';
import { loadDashboard } from '@/features/home/loadDashboard';
import { useQuery } from '@/hooks/useQuery';
import { useCurrentUser } from '@/features/auth/AuthProvider';

export function HomePage() {
  const me = useCurrentUser();
  const { data, loading, error } = useQuery(loadDashboard, 'dashboard');

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{format(new Date(), 'EEEE, MMMM d')}</p>
        <h2 className="text-2xl font-semibold tracking-tight">Here is your day, {me.name.split(' ')[0]}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open tasks" value={data.openCount} icon={CircleDot} tone="brand" />
        <StatCard label="Due today" value={data.dueTodayCount} icon={CalendarClock} tone="amber" />
        <StatCard label="Overdue" value={data.overdueCount} icon={AlertTriangle} tone="red" />
        <StatCard label="Done this week" value={data.completedThisWeek} icon={CheckCircle2} tone="emerald" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><NeedsAttention items={data.attention} /></div>
        <MemberWorkload workload={data.workload} />
      </div>
    </div>
  );
}
