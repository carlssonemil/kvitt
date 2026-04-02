import { sql } from '@/lib/db'
import type { DbUser } from '@/types/database'

interface AuthUser {
  email: string
  name: string | null
  image: string | null
}

export async function ensureUser(authUser: AuthUser): Promise<DbUser> {
  const displayName = authUser.name || authUser.email.split('@')[0]
  const rows = await sql`
    INSERT INTO users (display_name, email, avatar_url)
    VALUES (${displayName}, ${authUser.email}, ${authUser.image})
    ON CONFLICT (email) DO UPDATE SET
      display_name = CASE WHEN users.deleted_at IS NULL THEN EXCLUDED.display_name ELSE users.display_name END,
      avatar_url   = CASE WHEN users.deleted_at IS NULL THEN EXCLUDED.avatar_url ELSE users.avatar_url END
    RETURNING *
  `
  const dbUser = rows[0] as DbUser
  if (dbUser.deleted_at) throw new Error('Account has been deleted')
  return dbUser
}
