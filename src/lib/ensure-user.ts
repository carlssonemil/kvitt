import { sql } from '@/lib/db'
import type { DbUser } from '@/types/database'

interface AuthUser {
  email: string
  name: string | null
  image: string | null
  emailVerified: boolean
}

/**
 * Syncs the Neon Auth session's identity into kvitt's own `users` row,
 * keyed by email.
 *
 * An unverified email must never create or overwrite an existing row's
 * profile here: without this check, someone who signs up with someone
 * else's email address (but never completes verification) could plant or
 * silently overwrite that person's display name/avatar via the ON CONFLICT
 * upsert below. This only guards kvitt's own profile data — whether an
 * unverified session should be usable at all is enforced by the Neon Auth
 * project's `requireEmailVerification` setting, not here.
 */
export async function ensureUser(authUser: AuthUser): Promise<DbUser> {
  const displayName = authUser.name || authUser.email.split('@')[0]

  if (!authUser.emailVerified) {
    const [existing] = await sql`SELECT * FROM users WHERE email = ${authUser.email}` as DbUser[]
    if (existing) return existing

    const inserted = await sql`
      INSERT INTO users (display_name, email, avatar_url)
      VALUES (${displayName}, ${authUser.email}, ${authUser.image})
      ON CONFLICT (email) DO NOTHING
      RETURNING *
    ` as DbUser[]
    if (inserted[0]) return inserted[0]

    const [row] = await sql`SELECT * FROM users WHERE email = ${authUser.email}` as DbUser[]
    return row
  }

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
