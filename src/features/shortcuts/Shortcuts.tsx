import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/Modal';
import { useTheme } from '@/hooks/useTheme';
import { isTyping, MOD_KEY, onCommand, openShortcuts } from '@/lib/commands';

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'Everywhere',
    items: [
      [[MOD_KEY, 'K'], 'Open the AI assistant'],
      [['/'], 'Search tasks and projects'],
      [['G', 'H'], 'Go to Home'],
      [['G', 'M'], 'Go to My tasks'],
      [['G', 'R'], 'Go to Reports'],
      [['T'], 'Switch light / dark theme'],
      [['?'], 'Show these shortcuts'],
    ],
  },
  {
    title: 'In a project',
    items: [
      [['N'], 'Add a new card'],
      [['B'], 'Board view'],
      [['L'], 'List view'],
      [['C'], 'Calendar view'],
      [['Esc'], 'Close the open card or dialog'],
    ],
  },
];

/** Global single-key shortcuts and the "?" help dialog. Project-level keys live in ProjectPage. */
export function Shortcuts() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();

  useEffect(() => onCommand('shortcuts', () => setOpen(true)), []);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return;
      const key = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        if (key === 'h') navigate('/');
        if (key === 'm') navigate('/my-tasks');
        if (key === 'r') navigate('/reports');
        return;
      }
      if (key === 'g') pendingG = Date.now();
      else if (e.key === '?') openShortcuts();
      else if (key === 't') toggleTheme();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, toggleTheme]);

  if (!open) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setOpen(false)} size="md">
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between py-2 text-sm">
                  <span>{label}</span>
                  <span className="flex gap-1">{keys.map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
