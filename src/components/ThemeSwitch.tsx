import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

/** A sliding light/dark switch: sun on a green track in light mode, moon on a black-and-gold track in dark mode. */
export function ThemeSwitch({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full border p-0.5 transition-colors duration-300 ${
        dark ? 'border-gold-500/60 bg-black' : 'border-brand-200 bg-brand-50'
      } ${className}`}
    >
      <Sun className={`absolute left-2 h-3.5 w-3.5 transition-opacity duration-300 ${dark ? 'text-gold-500/50 opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      <Moon className={`absolute right-2 h-3.5 w-3.5 transition-opacity duration-300 ${dark ? 'opacity-0' : 'text-info-600/60 opacity-100'}`} aria-hidden="true" />
      <span
        className={`relative flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          dark ? 'translate-x-[1.75rem] bg-gold-500 text-black' : 'translate-x-0 bg-white text-gold-600 ring-1 ring-brand-200'
        }`}
      >
        {dark ? <Moon className="h-3.5 w-3.5" aria-hidden="true" /> : <Sun className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
    </button>
  );
}
