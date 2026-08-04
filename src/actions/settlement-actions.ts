'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { revalidatePath } from 'next/cache'
import { ROUTES, SUPPORTED_CURRENCIES } from '@/lib/constants'

export async function createSettlement(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const groupId = formData.get('group_id') as string
  const paidBy = formData.get('paid_by') as string
  const paidTo = formData.get('paid_to') as string
  const amount = parseFloat(formData.get('amount') as string)
  const currency = (formData.get('currency') as string)?.trim() || 'SEK'
  const note = (formData.get('note') as string)?.trim() || null

  if (!paidBy || !paidTo) return { error: 'Both parties are required' }
  if (paidBy === paidTo) return { error: 'Cannot settle with yourself' }
  if (isNaN(amount) || amount <= 0) return { error: 'Amount must be greater than 0' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${dbUser.id}
    `
    if (membership.length === 0) return { error: 'Not a member of this group' }

    if (!SUPPORTED_CURRENCIES.includes(currency as typeof SUPPORTED_CURRENCIES[number])) {
      return { error: 'Invalid currency' }
    }

    const memberIds = (await sql`
      SELECT user_id FROM group_members WHERE group_id = ${groupId}
    ` as { user_id: string }[]).map(m => m.user_id)

    if (!memberIds.includes(paidBy)) return { error: 'Payer is not a member of this group' }
    if (!memberIds.includes(paidTo)) return { error: 'Recipient is not a member of this group' }

    await sql`
      INSERT INTO settlements (group_id, paid_by, paid_to, amount, currency, note)
      VALUES (${groupId}, ${paidBy}, ${paidTo}, ${amount}, ${currency}, ${note})
    `

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('createSettlement error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function updateSettlement(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const settlementId = formData.get('settlement_id') as string
  const groupId = formData.get('group_id') as string
  const paidBy = formData.get('paid_by') as string
  const paidTo = formData.get('paid_to') as string
  const amount = parseFloat(formData.get('amount') as string)
  const currency = (formData.get('currency') as string)?.trim() || 'SEK'
  const note = (formData.get('note') as string)?.trim() || null

  if (!paidBy || !paidTo) return { error: 'Both parties are required' }
  if (paidBy === paidTo) return { error: 'Cannot settle with yourself' }
  if (isNaN(amount) || amount <= 0) return { error: 'Amount must be greater than 0' }

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${dbUser.id}
    `
    if (membership.length === 0) return { error: 'Not a member of this group' }

    if (!SUPPORTED_CURRENCIES.includes(currency as typeof SUPPORTED_CURRENCIES[number])) {
      return { error: 'Invalid currency' }
    }

    const memberIds = (await sql`
      SELECT user_id FROM group_members WHERE group_id = ${groupId}
    ` as { user_id: string }[]).map(m => m.user_id)

    if (!memberIds.includes(paidBy)) return { error: 'Payer is not a member of this group' }
    if (!memberIds.includes(paidTo)) return { error: 'Recipient is not a member of this group' }

    await sql`
      UPDATE settlements
      SET paid_by = ${paidBy}, paid_to = ${paidTo}, amount = ${amount}, currency = ${currency}, note = ${note}
      WHERE id = ${settlementId} AND group_id = ${groupId}
    `

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('updateSettlement error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function deleteSettlement(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const settlementId = formData.get('settlement_id') as string
  const groupId = formData.get('group_id') as string

  try {
    const dbUser = await ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    })

    const membership = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${dbUser.id}
    `
    if (membership.length === 0) return { error: 'Not a member of this group' }

    await sql`DELETE FROM settlements WHERE id = ${settlementId} AND group_id = ${groupId}`

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('deleteSettlement error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
