import { backend } from '@/lib/backend';
import type { NewUser } from '@/lib/backend/types';
import { emitChange } from '@/lib/db/events';
import type { Role } from '@/lib/db/types';

export async function adminCreateUser(user: NewUser): Promise<void> {
  await backend().adminCreateUser(user);
  emitChange('profiles');
}

export async function adminUpdateUser(userId: string, role: Role, disabled: boolean): Promise<void> {
  await backend().adminUpdateUser(userId, role, disabled);
  emitChange('profiles');
}
