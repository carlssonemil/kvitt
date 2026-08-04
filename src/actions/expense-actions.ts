'use server'

import { neonAuth } from '@/lib/auth/server'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { revalidatePath } from 'next/cache'
import { ROUTES, SUPPORTED_CURRENCIES } from '@/lib/constants'

export async function createExpense(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const groupId = formData.get('group_id') as string
  const title = (formData.get('title') as string)?.trim()
  const amount = parseFloat(formData.get('amount') as string)
  const currency = formData.get('currency') as string
  const paidBy = formData.get('paid_by') as string
  const date = formData.get('date') as string
  const note = (formData.get('note') as string)?.trim() || null
  const category = (formData.get('category') as string)?.trim() || null
  const splitsJson = formData.get('splits') as string

  if (!title) return { error: 'Title is required' }
  if (isNaN(amount) || amount <= 0) return { error: 'Amount must be greater than 0' }
  if (!paidBy) return { error: 'Payer is required' }
  if (!date) return { error: 'Date is required' }

  let splits: Record<string, number>
  try {
    splits = JSON.parse(splitsJson)
  } catch {
    return { error: 'Invalid split data' }
  }

  const splitEntries = Object.entries(splits).filter(([, v]) => v > 0)
  if (splitEntries.length === 0) return { error: 'At least one member must be in the split' }

  const splitTotal = splitEntries.reduce((sum, [, v]) => sum + v, 0)
  if (Math.abs(splitTotal - amount) > 0.02) {
    return { error: `Split total (${splitTotal.toFixed(2)}) must equal expense amount (${amount.toFixed(2)})` }
  }

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

    const splitUserIds = splitEntries.map(([uid]) => uid)
    if (splitUserIds.some(uid => !memberIds.includes(uid))) {
      return { error: 'Split includes users who are not members of this group' }
    }

    const [expense] = await sql`
      INSERT INTO expenses (group_id, paid_by, title, amount, currency, date, note, category, created_by)
      VALUES (${groupId}, ${paidBy}, ${title}, ${amount}, ${currency}, ${date}, ${note}, ${category}, ${dbUser.id})
      RETURNING id
    ` as { id: string }[]

    for (const [userId, splitAmount] of splitEntries) {
      await sql`
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (${expense!.id}, ${userId}, ${splitAmount})
      `
    }

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('createExpense error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function updateExpense(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const expenseId = formData.get('expense_id') as string
  const groupId = formData.get('group_id') as string
  const title = (formData.get('title') as string)?.trim()
  const amount = parseFloat(formData.get('amount') as string)
  const currency = formData.get('currency') as string
  const paidBy = formData.get('paid_by') as string
  const date = formData.get('date') as string
  const note = (formData.get('note') as string)?.trim() || null
  const category = (formData.get('category') as string)?.trim() || null
  const splitsJson = formData.get('splits') as string

  if (!title) return { error: 'Title is required' }
  if (isNaN(amount) || amount <= 0) return { error: 'Amount must be greater than 0' }
  if (!paidBy) return { error: 'Payer is required' }
  if (!date) return { error: 'Date is required' }

  let splits: Record<string, number>
  try {
    splits = JSON.parse(splitsJson)
  } catch {
    return { error: 'Invalid split data' }
  }

  const splitEntries = Object.entries(splits).filter(([, v]) => v > 0)
  if (splitEntries.length === 0) return { error: 'At least one member must be in the split' }

  const splitTotal = splitEntries.reduce((sum, [, v]) => sum + v, 0)
  if (Math.abs(splitTotal - amount) > 0.02) {
    return { error: `Split total (${splitTotal.toFixed(2)}) must equal expense amount (${amount.toFixed(2)})` }
  }

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

    const splitUserIds = splitEntries.map(([uid]) => uid)
    if (splitUserIds.some(uid => !memberIds.includes(uid))) {
      return { error: 'Split includes users who are not members of this group' }
    }

    await sql`
      UPDATE expenses
      SET title = ${title}, amount = ${amount}, currency = ${currency},
          paid_by = ${paidBy}, date = ${date}, note = ${note}, category = ${category}
      WHERE id = ${expenseId} AND group_id = ${groupId}
    `

    await sql`DELETE FROM expense_splits WHERE expense_id = ${expenseId}`

    for (const [userId, splitAmount] of splitEntries) {
      await sql`
        INSERT INTO expense_splits (expense_id, user_id, amount)
        VALUES (${expenseId}, ${userId}, ${splitAmount})
      `
    }

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('updateExpense error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

export async function deleteExpense(formData: FormData): Promise<{ error?: string }> {
  const { session, user } = await neonAuth()
  if (!session || !user) return { error: 'Not authenticated' }

  const expenseId = formData.get('expense_id') as string
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

    await sql`DELETE FROM expenses WHERE id = ${expenseId} AND group_id = ${groupId}`

    revalidatePath(ROUTES.GROUP(groupId))
    return {}
  } catch (err) {
    console.error('deleteExpense error:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
