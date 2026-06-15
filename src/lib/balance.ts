import { sql } from '@/lib/db'
import { getMultiDateConversions } from '@/lib/exchange-rates'
import type { Balance } from '@/types/database'

export async function computeBalances(groupId: string, groupCurrency: string): Promise<Balance[]> {
  const [debtRows, settlements] = await Promise.all([
    sql`
      SELECT
        es.user_id        AS from_user_id,
        u_from.display_name AS from_user_name,
        e.paid_by         AS to_user_id,
        u_to.display_name AS to_user_name,
        es.amount::float  AS amount,
        e.currency,
        e.date::text      AS date,
        e.title           AS expense_title
      FROM expense_splits es
      JOIN expenses e    ON e.id  = es.expense_id
      JOIN users u_from  ON u_from.id = es.user_id
      JOIN users u_to    ON u_to.id   = e.paid_by
      WHERE e.group_id = ${groupId}
        AND es.user_id != e.paid_by
    `,
    sql`
      SELECT paid_by, paid_to, amount::float AS amount, currency, created_at::date::text AS date
      FROM settlements
      WHERE group_id = ${groupId}
    `,
  ]) as [
    { from_user_id: string; from_user_name: string; to_user_id: string; to_user_name: string; amount: number; currency: string; date: string; expense_title: string }[],
    { paid_by: string; paid_to: string; amount: number; currency: string; date: string }[],
  ]

  // Collect all dates that require currency conversion
  const allDates = new Set<string>()
  for (const row of debtRows) {
    if (row.currency !== groupCurrency) allDates.add(row.date)
  }
  for (const s of settlements) {
    if (s.currency !== groupCurrency) allDates.add(s.date)
  }

  const conversionsByDate = allDates.size > 0
    ? await getMultiDateConversions(groupCurrency, [...allDates])
    : new Map<string, Record<string, number>>()

  function toGroupCurrency(amount: number, currency: string, date: string): number {
    if (currency === groupCurrency) return amount
    const rate = conversionsByDate.get(date)?.[currency]
    if (!rate) return 0
    return amount / rate
  }

  type Group = {
    from_user_id: string
    from_user_name: string
    to_user_id: string
    to_user_name: string
    total: number  // in group currency
    breakdown: { expense_title: string; amount: number; currency: string; convertedAmount?: number }[]
    offset?: number
    offsetBreakdown?: { expense_title: string; amount: number; currency: string; convertedAmount?: number }[]
  }
  const groups = new Map<string, Group>()

  for (const row of debtRows) {
    const key = `${row.from_user_id}|${row.to_user_id}`
    const converted = toGroupCurrency(row.amount, row.currency, row.date)
    const breakdownItem = {
      expense_title: row.expense_title,
      amount: row.amount,
      currency: row.currency,
      convertedAmount: row.currency !== groupCurrency ? Math.round(converted * 100) / 100 : undefined,
    }
    const g = groups.get(key)
    if (g) {
      g.total = Math.round((g.total + converted) * 100) / 100
      g.breakdown.push(breakdownItem)
    } else {
      groups.set(key, {
        from_user_id: row.from_user_id,
        from_user_name: row.from_user_name,
        to_user_id: row.to_user_id,
        to_user_name: row.to_user_name,
        total: converted,
        breakdown: [breakdownItem],
      })
    }
  }

  // Apply settlements: convert to group currency and subtract from the debtor→creditor pair
  for (const s of settlements) {
    const key = `${s.paid_by}|${s.paid_to}`
    const g = groups.get(key)
    if (g) {
      const converted = toGroupCurrency(s.amount, s.currency, s.date)
      g.total = Math.round((g.total - converted) * 100) / 100
    }
  }

  // Net out mutual debts in group currency
  for (const key of [...groups.keys()]) {
    const g = groups.get(key)
    if (!g) continue
    const reverseKey = `${g.to_user_id}|${g.from_user_id}`
    const reverse = groups.get(reverseKey)
    if (!reverse) continue
    if (g.total >= reverse.total) {
      g.offset = reverse.total
      g.offsetBreakdown = reverse.breakdown
      g.total = Math.round((g.total - reverse.total) * 100) / 100
      groups.delete(reverseKey)
    } else {
      reverse.offset = g.total
      reverse.offsetBreakdown = g.breakdown
      reverse.total = Math.round((reverse.total - g.total) * 100) / 100
      groups.delete(key)
    }
  }

  const balances: Balance[] = []
  for (const g of groups.values()) {
    const amount = Math.round(g.total * 100) / 100
    if (amount <= 0.005) continue
    balances.push({
      from_user_id: g.from_user_id,
      from_user_name: g.from_user_name,
      to_user_id: g.to_user_id,
      to_user_name: g.to_user_name,
      amount,
      currency: groupCurrency,
      breakdown: g.breakdown,
      offset: g.offset,
      offsetBreakdown: g.offsetBreakdown,
    })
  }

  return balances
}
