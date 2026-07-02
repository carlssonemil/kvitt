'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { getGroupStats } from '@/lib/queries'
import { revalidatePath } from 'next/cache'
import { ROUTES, SUPPORTED_CURRENCIES } from '@/lib/constants'
import type { GroupStats } from '@/types/database'
import { nanoid } from 'nanoid'

export async function createGroup(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const currency = (formData.get('currency') as string | null) || 'SEK'

  if (!name) return { error: 'Group name is required' }
  if (name.length > 100) return { error: 'Group name is too long' }
  if (!SUPPORTED_CURRENCIES.includes(currency as typeof SUPPORTED_CURRENCIES[number])) {
    return { error: 'Invalid currency' }
  }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const inviteCode = nanoid(12)

    await sql`
      WITH new_group AS (
        INSERT INTO groups (name, description, currency, created_by, invite_code)
        VALUES (${name}, ${description}, ${currency}, ${dbUser.id}, ${inviteCode})
        RETURNING id
      )
      INSERT INTO group_members (group_id, user_id)
      SELECT id, ${dbUser.id} FROM new_group
    `

    revalidatePath(ROUTES.GROUPS)
    return {}
  } catch (err) {
    console.error('createGroup error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function updateGroup(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const groupId = formData.get('group_id') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const currency = (formData.get('currency') as string) || 'SEK'

  if (!name) return { error: 'Group name is required' }
  if (name.length > 100) return { error: 'Group name is too long' }
  if (!SUPPORTED_CURRENCIES.includes(currency as typeof SUPPORTED_CURRENCIES[number])) {
    return { error: 'Invalid currency' }
  }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [group] = await sql`SELECT created_by FROM groups WHERE id = ${groupId}` as { created_by: string }[]
    if (!group) return { error: 'Group not found' }
    if (group.created_by !== dbUser.id) return { error: 'Only the group creator can update settings' }

    await sql`
      UPDATE groups SET name = ${name}, description = ${description}, currency = ${currency}
      WHERE id = ${groupId}
    `

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('updateGroup error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function deleteGroup(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const groupId = formData.get('group_id') as string

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [group] = await sql`
      SELECT created_by FROM groups WHERE id = ${groupId}
    ` as { created_by: string }[]

    if (!group) return { error: 'Group not found' }
    if (group.created_by !== dbUser.id) return { error: 'Only the group creator can delete this group' }

    await sql`DELETE FROM groups WHERE id = ${groupId}`

    revalidatePath(ROUTES.GROUPS)
    return {}
  } catch (err) {
    console.error('deleteGroup error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function hideGroup(groupId: string): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    await sql`
      UPDATE group_members SET hidden_at = now()
      WHERE group_id = ${groupId} AND user_id = ${dbUser.id}
    `

    revalidatePath(ROUTES.GROUPS)
    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('hideGroup error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function unhideGroup(groupId: string): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    await sql`
      UPDATE group_members SET hidden_at = NULL
      WHERE group_id = ${groupId} AND user_id = ${dbUser.id}
    `

    revalidatePath(ROUTES.GROUPS)
    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('unhideGroup error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function regenerateInviteCode(groupId: string): Promise<{ inviteCode?: string; error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [group] = await sql`SELECT created_by FROM groups WHERE id = ${groupId}` as { created_by: string }[]
    if (!group) return { error: 'Group not found' }
    if (group.created_by !== dbUser.id) return { error: 'Only the group creator can regenerate the invite code' }

    const inviteCode = nanoid(12)

    await sql`UPDATE groups SET invite_code = ${inviteCode} WHERE id = ${groupId}`

    revalidatePath(ROUTES.GROUP(groupId))
    return { inviteCode }
  } catch (err) {
    console.error('regenerateInviteCode error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function getGroupStatsAction(groupId: string): Promise<{ stats?: GroupStats; error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [group] = await sql`
      SELECT g.currency FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = ${groupId} AND gm.user_id = ${dbUser.id}
    ` as { currency: string }[]

    if (!group) return { error: 'Not a member of this group' }

    const stats = await getGroupStats(groupId, dbUser.id, group.currency)
    return { stats }
  } catch (err) {
    console.error('getGroupStatsAction error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
