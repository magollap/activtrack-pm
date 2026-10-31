import { useEffect, useRef, useState } from 'react';
import type { Slice } from '@/features/reports/buildReport';

const pct = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

/** Donut with a legend listing every slice ("Minor 7 (35%)"), so identity never relies on color alone. */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No cards</p>;

  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 1.2 : 0; // surface gap between segments
  let offset = 0;
  const active = slices.find((s) => s.key === hover);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(', ')}>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-slate-100 dark:stroke-slate-800" />
          {slices.map((s) => {
            const length = (s.value / total) * c;
            const dash = Math.max(0, length - gap);
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.key ? 15 : 12}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-[stroke-width] duration-150"
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${s.label}: ${s.value} (${pct(s.value, total)}%)`}</title>
              </circle>
            );
            offset += length;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tabular-nums">{active ? active.value : total}</span>
          <span className="max-w-[6rem] truncate text-[11px] text-slate-500 dark:text-slate-400">{active ? active.label : centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li
            key={s.key}
            className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 ${hover === s.key ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{s.label}</span>
            <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">{s.value}</span>
            <span className="w-10 text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">{pct(s.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars with the value at the end, for "by person" and "by project". */
export function BarList({ slices, colorBy = 'entity' }: { slices: Slice[]; colorBy?: 'entity' | 'brand' }) {
  if (!slices.length) return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No open cards</p>;
  const max = Math.max(...slices.map((s) => s.value));
  return (
    <ul className="space-y-2.5">
      {slices.slice(0, 10).map((s) => (
        <li key={s.key} className="grid grid-cols-[minmax(0,8rem)_1fr_2rem] items-center gap-3 text-sm" title={`${s.label}: ${s.value}`}>
          <span className="truncate text-slate-700 dark:text-slate-300">{s.label}</span>
          <span className="h-3 overflow-hidden rounded-r bg-slate-100 dark:bg-slate-800">
            <span
              className={`block h-full rounded-r transition-[width] duration-500 ${colorBy === 'brand' ? 'bg-brand-500' : ''}`}
              style={{ width: `${(s.value / max) * 100}%`, backgroundColor: colorBy === 'entity' ? s.color : undefined }}
            />
          </span>
          <span className="text-right font-medium tabular-nums">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Created vs completed per day, week or month: paired bars on one axis, with a hover readout. */
export function TrendChart({ data }: { data: { label: string; created: number; completed: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so text and bars keep their size on any screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.completed]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const H = 220;
  const pad = { l: 28, r: 8, t: 10, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const band = plotW / data.length;
  const barW = Math.max(3, Math.min(18, (band - 10) / 2));
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64))));
  const point = hover !== null ? data[hover] : null;

  return (
    <div ref={box}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2550e8] dark:bg-[#5b86f0]" /> Created</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0a8c4e] dark:bg-[#ab8822]" /> Completed</span>
        <span className="ml-auto h-4 tabular-nums text-slate-500 dark:text-slate-400">
          {point ? `${point.label}: ${point.created} created, ${point.completed} completed` : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Cards created and completed per period">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * band + (band - barW * 2 - 2) / 2;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
              <rect x={pad.l + i * band} y={pad.t} width={band} height={plotH} className={hover === i ? 'fill-slate-100 dark:fill-slate-800/70' : 'fill-transparent'} />
              {d.created > 0 && <rect x={x} y={y(d.created)} width={barW} height={pad.t + plotH - y(d.created)} rx="3" className="fill-[#2550e8] dark:fill-[#5b86f0]" />}
              {d.completed > 0 && <rect x={x + barW + 2} y={y(d.completed)} width={barW} height={pad.t + plotH - y(d.completed)} rx="3" className="fill-[#0a8c4e] dark:fill-[#ab8822]" />}
              {i % labelEvery === (data.length - 1) % labelEvery && (
                <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">{d.label}</text>
              )}
              <title>{`${d.label}: ${d.created} created, ${d.completed} completed`}</title>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1" />
      </svg>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step - 1 && ticks.length < 8; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
