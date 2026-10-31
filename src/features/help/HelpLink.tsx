import { Link } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';

/** Small "How this works" link that opens the Help center on one section. */
export function HelpLink({ section, label = 'How this works' }: { section: string; label?: string }) {
  return (
    <Link to={`/help#${section}`} className="mr-auto inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-gold-300">
      <CircleHelp className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}
