export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0d9488" />
      <polyline
        points="12.8,19.2 22.4,46 32,25.6 41.6,46 51.2,19.2"
        fill="none"
        stroke="#fff"
        strokeWidth="6.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
