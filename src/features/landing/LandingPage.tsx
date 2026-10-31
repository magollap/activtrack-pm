import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Columns3,
  LayoutTemplate,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Aurora } from '@/components/Aurora';
import { Logo } from '@/components/Logo';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { useTheme } from '@/hooks/useTheme';

// Light: the brand's green, blue and gold. Dark: gold on black.
const AURORA = {
  light: ['#0a8c4e', '#2550e8', '#d4a72c'],
  dark: ['#8a6a19', '#ead07a', '#b08a1f'],
};

const FEATURES = [
  { icon: Sparkles, title: 'AI assistant', text: 'Type "add a card to fix login, high priority, due Friday" or "move release notes to Done". Preview every change, then apply.' },
  { icon: BarChart3, title: 'Reports', text: 'Daily, weekly and monthly reports: work created and finished, overdue items, breakdowns by status, priority and person. Export to CSV or PDF.' },
  { icon: Columns3, title: 'Board, list and calendar', text: 'Drag cards between columns, sort and bulk-edit in the list, reschedule on the calendar.' },
  { icon: SlidersHorizontal, title: 'Custom fields', text: 'Story points, severity, budget, links: add the fields your team needs to every card.' },
  { icon: LayoutTemplate, title: 'Templates', text: 'Start from a sprint, bug tracker, campaign or launch template, or save your own.' },
  { icon: Radio, title: 'Live updates', text: 'Cards move on everyone\'s screen the moment a teammate changes them.' },
  { icon: CalendarDays, title: 'My tasks', text: 'Everything assigned to you across projects, grouped by what is due today, this week and later.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Your own space stays yours. Shared projects are invite-only, with read, write and lead access levels.' },
];

const COMMANDS = [
  'Add a card to update the pricing page, high priority, due Friday',
  'Move "Fix login bug" to Done',
  'Assign release notes to Priya and make it urgent',
];

/** Public landing page shown to signed-out visitors at "/". */
export function LandingPage() {
  const { theme } = useTheme();

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Hero: always dark (forest in light mode, black in dark mode) so the aurora glows. */}
      <section className="relative isolate overflow-hidden bg-[#06261a] text-white dark:bg-black">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-900/40 via-transparent to-[#06261a] dark:from-gold-950/30 dark:to-black" />
        <div className="absolute inset-0 -z-20 opacity-90">
          <Aurora colorStops={theme === 'dark' ? AURORA.dark : AURORA.light} blend={0.55} amplitude={1.1} speed={0.5} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[#06261a] dark:to-black" />

        <header className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">Activ<span className="text-gold-300 dark:text-gold-400">Track</span></span>
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-white/70 md:flex" aria-label="Sections">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#ai" className="hover:text-white">AI assistant</a>
            <a href="#reports" className="hover:text-white">Reports</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeSwitch />
            <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white sm:inline-flex">Sign in</Link>
            <Link to="/signup" className="btn-gold">Get started</Link>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:pb-32">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-gold-300 dark:text-gold-400" /> Now with AI skills and reports
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Plan the work.<br />
            <span className="text-gold-300 dark:text-gold-400">Track what matters.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            ActivTrack keeps projects, people and deadlines in one place. Tell the AI what to change, and see exactly how the week went with reports you can share.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/signup" className="btn-gold px-5 py-3 text-base">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-base font-medium text-white backdrop-blur-sm hover:bg-white/10">
              Sign in
            </Link>
          </div>

          <BoardPreview />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything a small team needs, nothing it doesn't.</h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">Built for teams that want to ship, not configure a tool.</p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white p-6 dark:bg-slate-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-gold-500/10 dark:text-gold-400">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="ai" className="scroll-mt-8 border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gold-700 dark:text-gold-400">AI assistant</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Say what you need. Approve what changes.</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Press Ctrl+K anywhere. The assistant turns plain English into cards and status changes, shows you a preview, and only acts when you say so, with your own permissions.
            </p>
          </div>
          <ul className="space-y-3">
            {COMMANDS.map((command) => (
              <li key={command} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-400" />
                <span className="text-sm">{command}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="reports" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-info-700 dark:text-gold-400">Reports</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Daily, weekly and monthly, in one click.</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              See what was created and finished, what is overdue, and how work splits across status, priority, people and your own fields. Download it as CSV or save it as a PDF for your stakeholders.
            </p>
            <Link to="/signup" className="btn-primary mt-8">Try it free <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <ReportPreview />
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:px-6">
          <span className="flex items-center gap-2"><Logo className="h-6 w-6" /> ActivTrack</span>
          <span>© {new Date().getFullYear()} ActivTrack</span>
        </div>
      </footer>
    </div>
  );
}

/** A small, static picture of the board, built from markup rather than a screenshot. */
function BoardPreview() {
  const columns = [
    { name: 'To do', color: '#64748b', cards: [['Grooming services', 'Medium'], ['GDPR data export', 'High']] },
    { name: 'In progress', color: '#2550e8', cards: [['Telehealth video calls', 'Urgent'], ['Clinic analytics', 'Medium']] },
    { name: 'Review', color: '#c9a227', cards: [['Vet schedule view', 'High']] },
    { name: 'Done', color: '#0a8c4e', cards: [['Stripe deposits', 'High'], ['Email reminders', 'Medium']] },
  ];
  return (
    <div className="mt-16 overflow-hidden rounded-2xl border border-white/15 bg-black/30 p-3 shadow-2xl backdrop-blur-md sm:p-4" aria-label="Example board" role="img">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {columns.map((col) => (
          <div key={col.name} className="rounded-xl bg-white/5 p-2.5">
            <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-white/85">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
              {col.name}
              <span className="text-white/45">{col.cards.length}</span>
            </p>
            <div className="space-y-2">
              {col.cards.map(([title, prio]) => (
                <div key={title} className="rounded-lg bg-white/95 p-2.5 text-slate-900 shadow-sm dark:bg-[#121211] dark:text-slate-100">
                  <p className="truncate text-xs font-medium">{title}</p>
                  <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">{prio}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportPreview() {
  const bars = [3, 5, 4, 7, 6, 8, 9];
  return (
    <div className="card p-6 shadow-sm" role="img" aria-label="Example weekly report: 12 created, 9 completed, 2 overdue">
      <div className="grid grid-cols-3 gap-3">
        {[['Created', '12'], ['Completed', '9'], ['Overdue', '2']].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-32 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-brand-500 dark:bg-gold-500" style={{ height: `${h * 10}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cards completed per day, this week</p>
    </div>
  );
}
