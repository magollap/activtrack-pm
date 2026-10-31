import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isWeekend, startOfDay, startOfWeek } from 'date-fns';
import { ChevronRight, CircleDashed } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/hooks/useToast';
import { parseDay, toDayString } from '@/lib/dates';
import { updateTask } from '@/lib/db/tasks';
import type { TaskViewProps } from '@/features/projects/taskViewProps';
import type { Task } from '@/lib/db/types';

type Zoom = 'week' | 'month' | 'quarter';
const ZOOM: Record<Zoom, { label: string; dayWidth: number }> = {
  week: { label: 'Days', dayWidth: 44 },
  month: { label: 'Weeks', dayWidth: 18 },
  quarter: { label: 'Months', dayWidth: 7 },
};
const ROW = 40;
const LABEL_W = 260;

interface Span {
  task: Task;
  start: Date;
  end: Date;
  /** True when the card has no dates of its own and the bar is a guess (created date / one day). */
  estimated: boolean;
}

/** Start and end of a card's bar: start date (or created date) to due date (or completion, or one day). */
function spanOf(task: Task): Span {
  const start = task.startDate ? parseDay(task.startDate) : null;
  const due = task.dueDate ? parseDay(task.dueDate) : null;
  const created = startOfDay(new Date(task.createdAt));
  const done = task.completedAt ? startOfDay(new Date(task.completedAt)) : null;
  const s = start ?? (due && created > due ? due : created);
  const e = due ?? done ?? s;
  return { task, start: s <= e ? s : e, end: s <= e ? e : s, estimated: !start && !due };
}

type DragState = { taskId: string; mode: 'move' | 'start' | 'end'; originX: number; deltaDays: number; span: Span };

/** Gantt chart of a project's cards, grouped by status. Drag a bar to move it, or its edges to change start and due dates. */
export function TimelineView({ statuses, tasks, members, editable, onOpenTask }: TaskViewProps) {
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>('month');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showUndated, setShowUndated] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const dayWidth = ZOOM[zoom].dayWidth;

  const spans = useMemo(() => tasks.map(spanOf).filter((s) => showUndated || !s.estimated), [tasks, showUndated]);
  const today = startOfDay(new Date());
  const rangeStart = useMemo(() => {
    const earliest = spans.reduce((min, s) => (s.start < min ? s.start : min), addDays(today, -14));
    return startOfWeek(addDays(earliest, -3), { weekStartsOn: 1 });
  }, [spans, today]);
  const rangeEnd = useMemo(() => {
    const latest = spans.reduce((max, s) => (s.end > max ? s.end : max), addDays(today, 30));
    return addDays(latest, 10);
  }, [spans, today]);
  const days = useMemo(() => eachDayOfInterval({ start: rangeStart, end: rangeEnd }), [rangeStart, rangeEnd]);
  const x = (d: Date) => differenceInCalendarDays(d, rangeStart) * dayWidth;

  // Open on today.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, x(today) - (el.clientWidth - LABEL_W) / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const groups = statuses.map((status) => ({
    status,
    spans: spans.filter((s) => s.task.statusId === status.id).sort((a, b) => a.start.getTime() - b.start.getTime()),
  }));

  // Header ticks: every day, every Monday, or the 1st of each month.
  const ticks = days.filter((d) => (zoom === 'week' ? true : zoom === 'month' ? d.getDay() === 1 : d.getDate() === 1));

  const onPointerDown = (e: React.PointerEvent, span: Span, mode: DragState['mode']) => {
    if (!editable) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ taskId: span.task.id, mode, originX: e.clientX, deltaDays: 0, span });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const deltaDays = Math.round((e.clientX - drag.originX) / dayWidth);
    if (deltaDays !== drag.deltaDays) setDrag({ ...drag, deltaDays });
  };
  const onPointerUp = async () => {
    if (!drag) return;
    const { span, mode, deltaDays } = drag;
    setDrag(null);
    if (!deltaDays) {
      onOpenTask(span.task.id);
      return;
    }
    let start = span.start;
    let end = span.end;
    if (mode === 'move' || mode === 'start') start = addDays(start, deltaDays);
    if (mode === 'move' || mode === 'end') end = addDays(end, deltaDays);
    if (start > end) [start, end] = mode === 'start' ? [end, end] : [start, start];
    try {
      await updateTask(span.task.id, { startDate: toDayString(start), dueDate: toDayString(end) });
      toast.success(`${span.task.title}: ${format(start, 'MMM d')} – ${format(end, 'MMM d')}`);
    } catch (error) {
      toast.error(error);
    }
  };

  const preview = (span: Span) => {
    if (!drag || drag.taskId !== span.task.id) return span;
    const d = drag.deltaDays;
    const start = drag.mode === 'end' ? span.start : addDays(span.start, d);
    const end = drag.mode === 'start' ? span.end : addDays(span.end, d);
    return { ...span, start: start <= end ? start : end, end: start <= end ? end : start };
  };

  const width = days.length * dayWidth;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Timeline scale">
          {(Object.keys(ZOOM) as Zoom[]).map((z) => (
            <button
              key={z}
              role="tab"
              aria-selected={zoom === z}
              onClick={() => setZoom(z)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${zoom === z ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            >
              {ZOOM[z].label}
            </button>
          ))}
        </div>
        <button className="btn-ghost py-1 text-xs" onClick={() => { const el = scroller.current; if (el) el.scrollTo({ left: Math.max(0, x(today) - (el.clientWidth - LABEL_W) / 3), behavior: 'smooth' }); }}>
          Today
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={showUndated} onChange={(e) => setShowUndated(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
          Show cards without dates
        </label>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {editable ? 'Drag a bar to move it, or its ends to change start and due dates. Click to open.' : 'Click a bar to open the card.'}
        </span>
      </div>

      <div ref={scroller} className="card relative max-h-[70vh] overflow-auto" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
        <div style={{ width: width + LABEL_W }} className="relative">
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="sticky left-0 z-10 flex shrink-0 items-end border-r border-slate-200 bg-white px-4 pb-2 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400" style={{ width: LABEL_W, height: 44 }}>
              Card
            </div>
            <div className="relative" style={{ width, height: 44 }}>
              {ticks.map((d) => (
                <div key={d.toISOString()} className="absolute top-0 h-full border-l border-slate-100 pl-1.5 pt-1.5 dark:border-slate-800" style={{ left: x(d) }}>
                  <span className="whitespace-nowrap text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {zoom === 'week' ? format(d, 'EEE') : zoom === 'month' ? format(d, 'MMM d') : format(d, 'MMMM')}
                  </span>
                  {zoom === 'week' && <span className="block text-[11px] tabular-nums text-slate-400">{format(d, 'd')}</span>}
                </div>
              ))}
              <span className="absolute bottom-1 -translate-x-1/2 rounded bg-gold-500 px-1.5 text-[10px] font-semibold text-black" style={{ left: x(today) + dayWidth / 2 }}>Today</span>
            </div>
          </div>

          {/* Weekend shading and today line behind the rows */}
          <div className="pointer-events-none absolute bottom-0 top-[44px]" style={{ left: LABEL_W, width }} aria-hidden="true">
            {zoom !== 'quarter' && days.filter((d) => isWeekend(d)).map((d) => (
              <div key={d.toISOString()} className="absolute inset-y-0 bg-slate-50 dark:bg-slate-800/30" style={{ left: x(d), width: dayWidth }} />
            ))}
            <div className="absolute inset-y-0 z-10 w-0.5 bg-gold-500" style={{ left: x(today) + dayWidth / 2 }} />
          </div>

          {groups.map(({ status, spans: rows }) => {
            const isCollapsed = collapsed.has(status.id);
            return (
              <div key={status.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed((set) => { const next = new Set(set); if (next.has(status.id)) next.delete(status.id); else next.add(status.id); return next; })}
                  aria-expanded={!isCollapsed}
                  className="relative z-20 block border-b border-slate-100 bg-slate-50 py-2 text-left text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                  style={{ width: LABEL_W + width }}
                >
                  {/* Only the label sticks, so it stays in view however far the chart is scrolled. */}
                  <span className="sticky left-0 flex w-max items-center gap-2 px-4">
                    <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                    {status.name}
                    <span className="font-normal text-slate-500">{rows.length}</span>
                  </span>
                </button>
                {!isCollapsed && rows.map((original) => {
                  const span = preview(original);
                  const left = x(span.start);
                  const barWidth = Math.max(dayWidth, (differenceInCalendarDays(span.end, span.start) + 1) * dayWidth);
                  const assignee = span.task.assigneeId ? memberMap.get(span.task.assigneeId) : undefined;
                  const overdue = !status.isDone && span.task.dueDate && span.end < today;
                  return (
                    <div key={span.task.id} className="flex border-b border-slate-100 dark:border-slate-800/70" style={{ height: ROW }}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(span.task.id)}
                        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-white px-4 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        style={{ width: LABEL_W }}
                      >
                        <span className={`min-w-0 flex-1 truncate ${status.isDone ? 'text-slate-400 line-through' : ''}`}>{span.task.title}</span>
                        {assignee && <Avatar member={assignee} size="xs" />}
                      </button>
                      <div className="relative" style={{ width }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && onOpenTask(span.task.id)}
                          onPointerDown={(e) => onPointerDown(e, original, 'move')}
                          className={`group absolute top-2 flex h-6 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium shadow-sm ring-1 ring-inset ring-black/10 ${
                            editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                          } ${span.estimated ? 'border border-dashed border-slate-400 !bg-transparent text-slate-500 shadow-none ring-0 dark:border-slate-600 dark:text-slate-400' : 'text-white'} ${
                            drag?.taskId === span.task.id ? 'opacity-90 ring-2 ring-gold-400' : ''
                          }`}
                          style={{ left, width: barWidth, backgroundColor: status.color }}
                          title={`${span.task.title}\n${format(span.start, 'MMM d')} – ${format(span.end, 'MMM d')}${span.estimated ? ' (no dates set)' : ''}`}
                        >
                          {editable && !span.estimated && (
                            <span onPointerDown={(e) => onPointerDown(e, original, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-black/20" aria-hidden="true" />
                          )}
                          {span.estimated && <CircleDashed className="mr-1 h-3 w-3 shrink-0" />}
                          <span className="truncate">{barWidth > 60 ? span.task.title : ''}</span>
                          {overdue && <span className="ml-auto pl-1 text-[10px] font-semibold text-white/90">late</span>}
                          {editable && !span.estimated && (
                            <span onPointerDown={(e) => onPointerDown(e, original, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-black/20" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
