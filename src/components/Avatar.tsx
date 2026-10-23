import { User } from 'lucide-react';
import type { Member } from '@/lib/db/types';

interface AvatarProps {
  member: Member | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

const SIZES = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-sm' };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ member, size = 'sm' }: AvatarProps) {
  if (!member) {
    return (
      <span className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 dark:border-slate-600`} title="Unassigned">
        <User className="h-3/5 w-3/5" />
      </span>
    );
  }
  return (
    <span
      className={`${SIZES[size]} inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: member.color }}
      title={member.name}
    >
      {initials(member.name)}
    </span>
  );
}
