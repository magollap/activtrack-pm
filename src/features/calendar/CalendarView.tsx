import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarDay } from '@/features/calendar/CalendarDay';
import { DayModal } from '@/features/calendar/DayModal';
import { useToast } from '@/hooks/useToast';
import { updateTask } from '@/lib/db/tasks';
import type { TaskViewProps } from '@/features/projects/taskViewProps';
import type { Task } from '@/lib/db/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView({ projectId, statuses, tasks, editable, onOpenTask }: TaskViewProps) {
  const toast = useToast();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }),
    [month],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      map.set(task.dueDate, [...(map.get(task.dueDate) ?? []), task]);
    }
    return map;
  }, [tasks]);
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const undated = tasks.filter((t) => !t.dueDate).length;
  const dragging = draggingId ? tasks.find((t) => t.id === draggingId) : undefined;

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.dueDate === over.id) return;
    try {
      await updateTask(task.id, { dueDate: String(over.id) });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-[140px] text-lg font-semibold">{format(month, 'MMMM yyyy')}</h3>
        <button className="icon-btn" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
        <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        <button className="btn-secondary py-1.5" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button>
        {undated > 0 && <span className="ml-auto hidden text-xs text-slate-500 sm:inline">{undated} task{undated === 1 ? '' : 's'} without a due date</span>}
      </div>

      <DndContext sensors={sensors} onDragStart={({ active }) => setDraggingId(String(active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            {WEEKDAYS.map((d) => <div key={d} className="py-2"><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></div>)}
          </div>
          <div className="-mb-px -mr-px grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              return (
                <CalendarDay key={key} day={day} month={month} tasks={byDay.get(key) ?? []} statuses={statusMap} editable={editable} onOpenTask={onOpenTask} onOpenDay={setOpenDay} />
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="flex w-40 items-center gap-1.5 truncate rounded-md bg-white px-2 py-1 text-xs shadow-lg ring-1 ring-brand-300 dark:bg-slate-800 dark:ring-brand-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusMap.get(dragging.statusId)?.color }} />
              <span className="truncate">{dragging.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <p className="text-xs text-slate-500">
        {editable ? 'Drag a task to another day to reschedule it. Click a day to add a task due that day.' : 'Click a day to see everything due that day.'}
      </p>

      {openDay && (
        <DayModal projectId={projectId} day={openDay} tasks={byDay.get(openDay) ?? []} statuses={statuses} editable={editable} onOpenTask={onOpenTask} onClose={() => setOpenDay(null)} />
      )}
    </div>
  );
}
