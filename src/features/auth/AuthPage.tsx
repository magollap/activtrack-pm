import { CalendarDays, KanbanSquare, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { AuthForm } from '@/features/auth/AuthForm';

const HIGHLIGHTS = [
  { icon: KanbanSquare, title: 'Boards, lists and calendars', text: 'See the same work the way that suits you.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Your own space stays yours. Shared projects are invite-only.' },
  { icon: CalendarDays, title: 'Never miss a date', text: 'Due dates, priorities and progress at a glance.' },
];

export function AuthPage({ notice }: { notice: string | null }) {
  return (
    <div className="flex min-h-[100dvh] bg-white dark:bg-slate-950">
      <aside className="relative hidden w-[44%] max-w-xl overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">Workday</span>
        </div>
        <div className="relative mt-auto">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Plan the work.<br />Share what matters.</h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-brand-100/80">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Workday</span>
          </div>
          <AuthForm notice={notice} />
        </div>
      </main>
    </div>
  );
}
