import { table } from '@/lib/db/tables';
import { isHexColor } from '@/lib/colors';
import type { Member } from '@/lib/db/types';

export const listMembers = async (): Promise<Member[]> =>
  (await table('profiles').list()).sort((a, b) => a.name.localeCompare(b.name));

export const getMember = (id: string): Promise<Member | null> => table('profiles').find(id);

export async function updateMyProfile(id: string, input: { name: string; color: string }): Promise<Member> {
  const name = input.name.trim();
  if (!name) throw new Error('Please enter your name.');
  if (name.length > 80) throw new Error('Names can be at most 80 characters.');
  if (!isHexColor(input.color)) throw new Error('Please pick a color.');
  return table('profiles').update(id, { name, color: input.color });
}
