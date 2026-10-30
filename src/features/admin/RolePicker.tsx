import { Eye, ShieldCheck, UserCog } from 'lucide-react';
import { ROLE_META } from '@/lib/db/access';
import { ROLES, type Role } from '@/lib/db/types';

const ROLE_ICONS: Record<Role, typeof Eye> = { governor: ShieldCheck, delegate: UserCog, reporter: Eye };

export function RoleIcon({ role, className = 'h-3.5 w-3.5' }: { role: Role; className?: string }) {
  const Icon = ROLE_ICONS[role];
  return <Icon className={className} aria-hidden />;
}

export function RolePicker({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <div role="radiogroup" aria-label="Role" className="grid gap-2">
      {ROLES.map((role) => {
        const selected = role === value;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(role)}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
              selected
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-950/50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className={`mt-0.5 rounded-lg p-1.5 ${selected ? 'bg-brand-600 text-brand-contrast' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
              <RoleIcon role={role} className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-medium">{ROLE_META[role].label}</span>
              <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{ROLE_META[role].description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
