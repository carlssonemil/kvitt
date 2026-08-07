'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { requireGroupMember } from '@/lib/auth/require-group-member'
import { revalidatePath } from 'next/cache'
import { ROUTES, SUPPORTED_CURRENCIES } from '@/lib/constants'
import type { DbUser } from '@/types/database'
import { computeBalances } from '@/lib/balance'
import { convertCurrency } from '@/lib/exchange-rates'

async function validateSettlementAmount(params: {
  groupId: string
  groupCurrency: string
  paidBy: string
  paidTo: string
  amount: number
  currency: string
  excludeSettlementId?: string
}): Promise<string | null> {
  const { groupId, groupCurrency, paidBy, paidTo, amount, currency, excludeSettlementId } = params

  const balances = await computeBalances(groupId, groupCurrency, excludeSettlementId)
  const outstanding = balances.find(b => b.from_user_id === paidBy && b.to_user_id === paidTo)?.amount ?? 0

  let amountInGroupCurrency = amount
  if (currency !== groupCurrency) {
    const converted = await convertCurrency(amount, currency, groupCurrency)
    if (converted === null) return 'Unable to verify the exchange rate right now. Please try again.'
    amountInGroupCurrency = converted
  }

  const tolerance = currency === groupCurrency ? 0.01 : Math.max(0.01, outstanding * 0.02)
  if (amountInGroupCurrency > outstanding + tolerance) {
    return `This settlement exceeds the ${outstanding.toFixed(2)} ${groupCurrency} currently owed between these two people.`
  }
  return null
}

interface SettlementInput {
  dbUser: DbUser
  groupId: string
  paidBy: string
  paidTo: string
  amount: number
  currency: string
  note: string | null
}

async function resolveSettlementInput(
  formData: FormData,
  user: { email?: string | null; name?: string | null; image?: string | null },
  excludeSettlementId?: string
): Promise<{ error: string } | SettlementInput> {
  const groupId = formData.get('group_id') as string
  const paidBy = formData.get('paid_by') as string
  const paidTo = formData.get('paid_to') as string
  const amount = parseFloat(formData.get('amount') as string)
  const currency = (formData.get('currency') as string)?.trim() || 'SEK'
  const note = (formData.get('note') as string)?.trim() || null

  if (!paidBy || !paidTo) return { error: 'Both parties are required' }
  if (paidBy === paidTo) return { error: 'Cannot settle with yourself' }
  if (isNaN(amount) || amount <= 0) return { error: 'Amount must be greater than 0' }

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

  if (!SUPPORTED_CURRENCIES.includes(currency as typeof SUPPORTED_CURRENCIES[number])) {
    return { error: 'Invalid currency' }
  }

  const memberIds = (await sql`
    SELECT user_id FROM group_members WHERE group_id = ${groupId}
  ` as { user_id: string }[]).map(m => m.user_id)

  if (!memberIds.includes(paidBy)) return { error: 'Payer is not a member of this group' }
  if (!memberIds.includes(paidTo)) return { error: 'Recipient is not a member of this group' }

  const validationError = await validateSettlementAmount({
    groupId, groupCurrency: group.currency, paidBy, paidTo, amount, currency, excludeSettlementId,
  })
  if (validationError) return { error: validationError }

  return { dbUser, groupId, paidBy, paidTo, amount, currency, note }
}

export async function createSettlement(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  try {
    const resolved = await resolveSettlementInput(formData, user)
    if ('error' in resolved) return resolved

    const { groupId, paidBy, paidTo, amount, currency, note } = resolved

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

  try {
    const resolved = await resolveSettlementInput(formData, user, settlementId)
    if ('error' in resolved) return resolved

    const { groupId, paidBy, paidTo, amount, currency, note } = resolved

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
    const membershipResult = await requireGroupMember(groupId, user)
    if ('error' in membershipResult) return membershipResult

    await sql`DELETE FROM settlements WHERE id = ${settlementId} AND group_id = ${groupId}`

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('deleteSettlement error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
