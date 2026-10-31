import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Clock, Download, Gauge, PlusCircle, Printer } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { DueDate } from '@/components/DueDate';
import { PriorityBadge } from '@/components/PriorityBadge';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { BarList, Donut, TrendChart } from '@/features/reports/Charts';
import { buildReport, loadReportSource, periodRange, reportToCsv, shiftAnchor, type Period, type Row } from '@/features/reports/buildReport';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { downloadFile } from '@/lib/download';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const TILE_TONES = {
  info: 'bg-info-600 text-white dark:bg-info-900/60 dark:text-info-100 dark:ring-1 dark:ring-info-700/50',
  brand: 'bg-brand-600 text-white dark:bg-brand-900/60 dark:text-brand-100 dark:ring-1 dark:ring-brand-700/50',
  gold: 'bg-gold-400 text-slate-950 dark:bg-gold-900/60 dark:text-gold-100 dark:ring-1 dark:ring-gold-700/50',
  red: 'bg-red-600 text-white dark:bg-red-950/70 dark:text-red-100 dark:ring-1 dark:ring-red-800/60',
  slate: 'bg-slate-600 text-white dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-700',
};

function Tile({ label, value, hint, icon: Icon, tone }: { label: string; value: string | number; hint: string; icon: typeof Clock; tone: keyof typeof TILE_TONES }) {
  return (
    <div className={`rounded-xl p-4 ${TILE_TONES[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</span>
        <Icon className="h-4 w-4 opacity-80" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs opacity-80">{hint}</p>
    </div>
  );
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card break-inside-avoid p-5 ${className}`}>
      <h3 className="font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RowList({ rows, empty, showDone }: { rows: Row[]; empty: string; showDone?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.slice(0, 25).map(({ task, project, status, assignee }) => (
        <li key={task.id}>
          <Link to={`/projects/${task.projectId}?task=${task.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 print:py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status?.color }} title={status?.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{task.title}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{project?.name} · {status?.name}</span>
            </span>
            <span className="hidden sm:inline"><PriorityBadge priority={task.priority} /></span>
            {assignee && <Avatar member={assignee} size="xs" />}
            <span className="w-24 text-right text-xs text-slate-500 dark:text-slate-400">
              {showDone && task.completedAt ? format(new Date(task.completedAt), 'MMM d') : <DueDate dueDate={task.dueDate} isDone={false} />}
            </span>
          </Link>
        </li>
      ))}
      {rows.length > 25 && <li className="py-2 text-center text-xs text-slate-500">and {rows.length - 25} more in the CSV download</li>}
    </ul>
  );
}

/** Daily, weekly and monthly reports across all projects or one, with CSV download and print/PDF. */
export function ReportsPage() {
  const toast = useToast();
  const { data, loading, error } = useQuery(loadReportSource, 'reports');
  const [period, setPeriod] = useState<Period>('weekly');
  const [anchor, setAnchor] = useState(() => new Date());
  const [projectId, setProjectId] = useState<string>('');

  const report = useMemo(() => (data ? buildReport(data, period, anchor, projectId || null) : null), [data, period, anchor, projectId]);
  const scope = projectId ? data?.projects.find((p) => p.id === projectId)?.name ?? 'Project' : 'All projects';
  const isCurrent = useMemo(() => {
    const now = periodRange(period, new Date());
    return isSameDay(now.start, periodRange(period, anchor).start);
  }, [period, anchor]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data || !report) return null;

  const download = () => {
    const slug = `${period}-${format(report.range.start, 'yyyy-MM-dd')}`;
    downloadFile(`activtrack-report-${slug}.csv`, reportToCsv(report, scope), 'text/csv;charset=utf-8');
    toast.success('Report downloaded');
  };

  const periodNoun = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:space-y-4 print:p-0">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{scope} · {PERIODS.find((p) => p.id === period)?.label} report</p>
          <h2 className="text-2xl font-semibold tracking-tight">{report.range.label}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Report period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))} aria-label={`Previous ${periodNoun}`}><ChevronLeft className="h-4 w-4" /></button>
            <input
              type="date"
              className="input w-auto py-1.5"
              value={format(anchor, 'yyyy-MM-dd')}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => e.target.value && setAnchor(new Date(`${e.target.value}T12:00:00`))}
              aria-label="Report date"
            />
            <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))} disabled={isCurrent} aria-label={`Next ${periodNoun}`}><ChevronRight className="h-4 w-4" /></button>
            {!isCurrent && <button className="btn-ghost py-1.5 text-xs" onClick={() => setAnchor(new Date())}>This {periodNoun}</button>}
          </div>
          <select className="input w-auto max-w-[12rem] py-1.5" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
            <option value="">All projects</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-secondary py-1.5" onClick={download}><Download className="h-4 w-4" /> CSV</button>
          <button className="btn-primary py-1.5" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Created" value={report.created} hint={`new this ${periodNoun}`} icon={PlusCircle} tone="info" />
        <Tile label="Completed" value={report.completed} hint={`finished this ${periodNoun}`} icon={CheckCircle2} tone="brand" />
        <Tile label="Open" value={report.openAtEnd} hint={isCurrent ? 'right now' : `at end of ${periodNoun}`} icon={CircleDot} tone="slate" />
        <Tile label="Overdue" value={report.overdueAtEnd} hint={isCurrent ? 'right now' : `at end of ${periodNoun}`} icon={AlertTriangle} tone="red" />
        <Tile label="Completion" value={report.completionRate === null ? '–' : `${report.completionRate}%`} hint="of the workload" icon={Gauge} tone="gold" />
        <Tile label="Avg. cycle" value={report.avgCycleDays === null ? '–' : `${report.avgCycleDays}d`} hint="created → done" icon={Clock} tone="slate" />
      </div>

      <Panel title="Activity trend" subtitle={`Cards created and completed per ${periodNoun}, ending with this ${periodNoun}`}>
        <TrendChart data={report.trend} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3 print:grid-cols-3">
        <Panel title="Status breakdown" subtitle="Every card, by current column">
          <Donut slices={report.byStatus} centerLabel="cards" />
        </Panel>
        <Panel title="Priority breakdown" subtitle="Open cards">
          <Donut slices={report.byPriority} centerLabel="open" />
        </Panel>
        {report.byField ? (
          <Panel title={`${report.byField.field.name} breakdown`} subtitle="Every card, by custom field">
            <Donut slices={report.byField.slices} centerLabel="cards" />
          </Panel>
        ) : (
          <Panel title="Open work by project" subtitle="Open cards">
            <BarList slices={report.byProject} />
          </Panel>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-2">
        <Panel title="Open work by person" subtitle="Who is carrying the open cards">
          <BarList slices={report.byAssignee} colorBy="brand" />
        </Panel>
        <Panel title={`Overdue ${isCurrent ? 'now' : `at end of ${periodNoun}`}`} subtitle="Open cards past their due date">
          <RowList rows={report.overdueRows} empty="Nothing overdue. Nice." />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-2">
        <Panel title={`Completed this ${periodNoun}`} subtitle={`${report.completed} card${report.completed === 1 ? '' : 's'}`}>
          <RowList rows={report.completedRows} empty={`Nothing completed this ${periodNoun}.`} showDone />
        </Panel>
        <Panel title={`Created this ${periodNoun}`} subtitle={`${report.created} card${report.created === 1 ? '' : 's'}`}>
          <RowList rows={report.createdRows} empty={`Nothing created this ${periodNoun}.`} />
        </Panel>
      </div>

      <p className="hidden text-xs text-slate-500 print:block">Generated by ActivTrack on {format(new Date(), 'PPpp')}</p>
    </div>
  );
}
