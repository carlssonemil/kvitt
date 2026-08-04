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
      display_name = EXCLUDED.display_name,
      avatar_url   = EXCLUDED.avatar_url
    RETURNING *
  `
  return rows[0] as DbUser
}
