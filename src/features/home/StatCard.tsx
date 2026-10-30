import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'brand' | 'gold' | 'red' | 'info';
}

const TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400',
  gold: 'bg-gold-50 text-gold-700 dark:bg-gold-950 dark:text-gold-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  info: 'bg-info-50 text-info-600 dark:bg-info-950 dark:text-info-300',
};

export function StatCard({ label, value, icon: Icon, tone }: StatCardProps) {
  return (
    <div className="card p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
