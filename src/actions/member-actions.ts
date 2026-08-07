'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { requireGroupMember } from '@/lib/auth/require-group-member'
import { revalidatePath } from 'next/cache'
import { ROUTES } from '@/lib/constants'
import { nanoid } from 'nanoid'
import { computeBalances } from '@/lib/balance'

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

    const [group] = await sql`SELECT created_by, currency FROM groups WHERE id = ${groupId}` as { created_by: string; currency: string }[]
    if (!group) return { error: 'Group not found' }
    if (group.created_by !== dbUser.id) return { error: 'Only the group creator can remove members' }
    if (group.created_by === userId) return { error: 'Cannot remove the group creator.' }

    const balances = await computeBalances(groupId, group.currency)
    const hasOutstandingBalance = balances.some(b => b.from_user_id === userId || b.to_user_id === userId)
    if (hasOutstandingBalance) {
      return { error: 'This member has an outstanding balance. Settle up before removing them.' }
    }

    const removedMembership = await sql`
      DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} RETURNING 1
    `
    if (removedMembership.length === 0) return { error: 'Not a member of this group' }

    await sql`
      DELETE FROM users
      WHERE id = ${userId}
        AND is_guest = true
        AND NOT EXISTS (SELECT 1 FROM expenses WHERE paid_by = ${userId} OR created_by = ${userId})
        AND NOT EXISTS (SELECT 1 FROM expense_splits WHERE user_id = ${userId})
        AND NOT EXISTS (SELECT 1 FROM settlements WHERE paid_by = ${userId} OR paid_to = ${userId})
    `

    await sql`UPDATE users SET claim_token = NULL WHERE id = ${userId} AND is_guest = true`

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('removeMember error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function addGuest(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const groupId = formData.get('group_id') as string
  const name = ((formData.get('name') as string | null) ?? '').trim()

  if (!name) return { error: 'Name is required' }
  if (name.length > 100) return { error: 'Name is too long' }

  try {
    const membershipResult = await requireGroupMember(groupId, user)
    if ('error' in membershipResult) return membershipResult

    const claimToken = nanoid(12)
    const syntheticEmail = `guest+${nanoid(16)}@guests.kvitt.internal`

    await sql`
      WITH new_guest AS (
        INSERT INTO users (display_name, email, is_guest, claim_token)
        VALUES (${name}, ${syntheticEmail}, true, ${claimToken})
        RETURNING id
      )
      INSERT INTO group_members (group_id, user_id)
      SELECT ${groupId}, id FROM new_guest
    `

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('addGuest error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function getGuestClaimLink(
  groupId: string,
  memberId: string,
): Promise<{ claimToken?: string; error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const membershipResult = await requireGroupMember(groupId, user)
    if ('error' in membershipResult) return membershipResult

    const [guest] = await sql`
      SELECT u.claim_token
      FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      WHERE u.id = ${memberId} AND gm.group_id = ${groupId} AND u.is_guest = true
    ` as { claim_token: string | null }[]

    if (!guest || !guest.claim_token) return { error: 'No active claim link for this member' }

    return { claimToken: guest.claim_token }
  } catch (err) {
    console.error('getGuestClaimLink error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function claimGuest(claimToken: string): Promise<{ groupId?: string; error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  let guestId: string | undefined

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const [guest] = await sql`
      UPDATE users SET claim_token = NULL
      WHERE claim_token = ${claimToken} AND is_guest = true
      RETURNING id
    ` as { id: string }[]
    if (!guest) return { error: 'Invalid or already-used claim link.' }
    guestId = guest.id

    const [membership] = await sql`
      SELECT group_id FROM group_members WHERE user_id = ${guest.id} LIMIT 1
    ` as { group_id: string }[]
    if (!membership) {
      await sql`UPDATE users SET claim_token = ${claimToken} WHERE id = ${guestId} AND is_guest = true`
      return { error: 'Invalid or already-used claim link.' }
    }

    const groupId = membership.group_id
    const realUserId = dbUser.id

    // Every statement below matches on guestId alone (no group_id filter) — safe only
    // because a guest can hold exactly one group_members row, and every other write
    // path (expense-actions.ts, settlement-actions.ts) validates group membership
    // before referencing a user id, so guestId can never appear on a row outside groupId.
    await sql.transaction([
      sql`UPDATE expenses SET paid_by = ${realUserId} WHERE paid_by = ${guestId}`,
      sql`UPDATE expenses SET created_by = ${realUserId} WHERE created_by = ${guestId}`,
      sql`UPDATE groups SET created_by = ${realUserId} WHERE created_by = ${guestId}`,
      sql`UPDATE settlements SET paid_by = ${realUserId} WHERE paid_by = ${guestId}`,
      sql`UPDATE settlements SET paid_to = ${realUserId} WHERE paid_to = ${guestId}`,
      sql`
        DELETE FROM settlements
        WHERE group_id = ${groupId} AND paid_by = ${realUserId} AND paid_to = ${realUserId}
      `,
      sql`
        UPDATE expense_splits real_split
        SET amount = real_split.amount + guest_split.amount
        FROM expense_splits guest_split
        WHERE guest_split.user_id = ${guestId}
          AND guest_split.expense_id = real_split.expense_id
          AND real_split.user_id = ${realUserId}
      `,
      sql`
        UPDATE expense_splits SET user_id = ${realUserId}
        WHERE user_id = ${guestId}
          AND NOT EXISTS (
            SELECT 1 FROM expense_splits es2
            WHERE es2.expense_id = expense_splits.expense_id AND es2.user_id = ${realUserId}
          )
      `,
      sql`DELETE FROM expense_splits WHERE user_id = ${guestId}`,
      sql`
        INSERT INTO group_members (group_id, user_id)
        SELECT ${groupId}, ${realUserId}
        WHERE NOT EXISTS (
          SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${realUserId}
        )
      `,
      sql`DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${guestId}`,
      sql`DELETE FROM users WHERE id = ${guestId} AND is_guest = true`,
    ])

    revalidatePath(ROUTES.GROUP(groupId))
    revalidatePath(ROUTES.GROUPS)

    return { groupId }
  } catch (err) {
    console.error('claimGuest error:', err)
    if (guestId) {
      try {
        await sql`UPDATE users SET claim_token = ${claimToken} WHERE id = ${guestId} AND is_guest = true`
      } catch (restoreErr) {
        console.error('claimGuest token restore error:', restoreErr)
      }
    }
    return { error: 'Something went wrong. Please try again.' }
  }
}
