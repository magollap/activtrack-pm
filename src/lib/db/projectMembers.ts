import { table } from '@/lib/db/tables';
import { ACCESS_LEVELS, type AccessLevel, type ProjectMember } from '@/lib/db/types';

export const listProjectMembers = (projectId?: string): Promise<ProjectMember[]> =>
  table('projectMembers').list(projectId ? { projectId } : undefined);

export const listMyMemberships = (userId: string): Promise<ProjectMember[]> => table('projectMembers').list({ userId });

export async function grantAccess(projectId: string, userId: string, access: AccessLevel): Promise<void> {
  if (!ACCESS_LEVELS.includes(access)) throw new Error('Choose an access level.');
  const [existing] = await table('projectMembers').list({ projectId, userId });
  if (existing) await table('projectMembers').update(existing.id, { access });
  else await table('projectMembers').insert({ projectId, userId, access });
}

export async function revokeAccess(membershipId: string): Promise<void> {
  await table('projectMembers').remove({ id: membershipId });
}
