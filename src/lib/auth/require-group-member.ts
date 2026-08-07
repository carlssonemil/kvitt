import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import type { DbUser } from '@/types/database'

interface AuthUser {
  email?: string | null
  name?: string | null
  image?: string | null
}

export async function requireGroupMember(
  groupId: string,
  user: AuthUser
): Promise<{ error: string } | { dbUser: DbUser }> {
  const dbUser = await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  })

  const membership = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${dbUser.id}
  `
  if (membership.length === 0) return { error: 'Not a member of this group' }

  return { dbUser }
}
