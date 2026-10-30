/** The ActivTrack mark: an activity pulse in a rounded square. Green and gold in light mode, gold and black in dark mode. */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" className="fill-brand-700 dark:fill-gold-500" />
      <polyline
        points="11,35 22,35 28,18 37,47 43,30 53,30"
        fill="none"
        className="stroke-gold-300 dark:stroke-black"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
