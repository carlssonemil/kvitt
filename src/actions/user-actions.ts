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
    await sql`
      UPDATE users
      SET display_name = 'Deleted user', avatar_url = NULL, deleted_at = now()
      WHERE email = ${user.email ?? ''}
    `
    return {}
  } catch (err) {
    console.error('deleteAccount error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
