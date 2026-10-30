import { Check, ChevronDown } from 'lucide-react';
import { Popover } from '@/components/Popover';
import type { ReactNode } from 'react';

export interface MenuOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface MultiSelectMenuProps {
  label: string;
  options: MenuOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelectMenu({ label, options, selected, onChange }: MultiSelectMenuProps) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover
      trigger={({ toggle: open, open: isOpen }) => (
        <button
          onClick={open}
          aria-expanded={isOpen}
          className={`btn border py-1.5 ${
            selected.length
              ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          {label}
          {selected.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-brand-contrast">{selected.length}</span>}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {() => (
        <div className="max-h-72 overflow-y-auto">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggle(option.value)}
                role="menuitemcheckbox"
                aria-checked={checked}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-brand-600 bg-brand-600 text-brand-contrast' : 'border-slate-300 dark:border-slate-600'}`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                {option.icon}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="mt-1 w-full rounded-lg border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700">
              Clear selection
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
