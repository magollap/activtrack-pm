import { PartyPopper } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import type { DashboardData } from '@/features/home/loadDashboard';

export function MemberWorkload({ workload }: { workload: DashboardData['workload'] }) {
  const max = Math.max(1, ...workload.map((w) => w.open));

  return (
    <section className="card">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="font-semibold">Open tasks by member</h3>
      </header>
      {workload.length === 0 ? (
        <EmptyState
          compact
          icon={PartyPopper}
          title="No open tasks"
          message="Everything you can see is done. Nice work."
        />
      ) : (
        <ul className="space-y-4 px-5 py-4">
          {workload.map(({ member, open }) => (
            <li key={member?.id ?? 'unassigned'} className="flex items-center gap-3">
              <Avatar member={member} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{member?.name ?? 'Unassigned'}</span>
                  <span className="font-medium tabular-nums">{open}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(open / max) * 100}%`, backgroundColor: member?.color ?? '#94a3b8' }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
