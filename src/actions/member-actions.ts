'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { revalidatePath } from 'next/cache'
import { ROUTES } from '@/lib/constants'

export async function joinGroupByInvite(inviteCode: string): Promise<{ groupId?: string; error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [group] = await sql`
      SELECT id FROM groups WHERE invite_code = ${inviteCode}
    ` as { id: string }[]

    if (!group) return { error: 'Invalid invite link.' }

    const alreadyMember = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${group.id} AND user_id = ${dbUser.id}
    `

    if (alreadyMember.length === 0) {
      await sql`
        INSERT INTO group_members (group_id, user_id)
        VALUES (${group.id}, ${dbUser.id})
      `
      revalidatePath(ROUTES.GROUP(group.id))
    }

    return { groupId: group.id }
  } catch (err) {
    console.error('joinGroupByInvite error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function removeMember(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const groupId = formData.get('group_id') as string
  const userId = formData.get('user_id') as string

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [group] = await sql`SELECT created_by FROM groups WHERE id = ${groupId}` as { created_by: string }[]
    if (!group) return { error: 'Group not found' }
    if (group.created_by !== dbUser.id) return { error: 'Only the group creator can remove members' }
    if (group.created_by === userId) return { error: 'Cannot remove the group creator.' }

    await sql`DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('removeMember error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
