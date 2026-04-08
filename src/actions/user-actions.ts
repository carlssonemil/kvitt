'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { revalidatePath } from 'next/cache'
import { ROUTES } from '@/lib/constants'

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const displayName = (formData.get('display_name') as string)?.trim()
  if (!displayName) return { error: 'Display name is required' }
  if (displayName.length > 100) return { error: 'Display name is too long' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    await sql`
      UPDATE users SET display_name = ${displayName} WHERE id = ${dbUser.id}
    `

    revalidatePath(ROUTES.PROFILE)
    return {}
  } catch (err) {
    console.error('updateProfile error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function deleteAccount(): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const rows = await sql`
      UPDATE users
      SET display_name = 'Deleted user',
          avatar_url = NULL,
          email = 'deleted-' || id || '@deleted.local',
          deleted_at = now()
      WHERE email = ${user.email ?? ''}
      RETURNING id
    ` as { id: string }[]

    const userId = rows[0]?.id
    if (!userId) return { error: 'Account not found' }

    // Transfer ownership of groups to the oldest remaining member
    await sql`
      UPDATE groups g
      SET created_by = (
        SELECT gm.user_id FROM group_members gm
        WHERE gm.group_id = g.id AND gm.user_id != ${userId}
        ORDER BY gm.joined_at ASC LIMIT 1
      )
      WHERE g.created_by = ${userId}
      AND EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = g.id AND gm.user_id != ${userId}
      )
    `

    // Delete groups where the user is the sole member
    await sql`
      DELETE FROM groups g
      WHERE g.created_by = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = g.id AND gm.user_id != ${userId}
      )
    `

    // Remove from all groups
    await sql`DELETE FROM group_members WHERE user_id = ${userId}`

    return {}
  } catch (err) {
    console.error('deleteAccount error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
