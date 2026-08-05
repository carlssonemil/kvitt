import { sql } from '@/lib/db'
import { getMultiDateConversions } from '@/lib/exchange-rates'
import type { Balance } from '@/types/database'

type DebtRow = { group_id: string; from_user_id: string; from_user_name: string; to_user_id: string; to_user_name: string; amount: number; currency: string; date: string; expense_title: string }
type SettlementRow = { group_id: string; paid_by: string; paid_to: string; amount: number; currency: string; date: string }

export async function computeBalances(groupId: string, groupCurrency: string, excludeSettlementId?: string): Promise<Balance[]> {
  const balancesByGroup = await computeBalancesForGroups([{ id: groupId, currency: groupCurrency }], excludeSettlementId)
  return balancesByGroup.get(groupId) ?? []
}

export async function computeBalancesForGroups(groups: { id: string; currency: string }[], excludeSettlementId?: string): Promise<Map<string, Balance[]>> {
  if (groups.length === 0) return new Map()

  const groupIds = groups.map(g => g.id)

  const [debtRows, settlements] = await Promise.all([
    sql`
      SELECT
        e.group_id         AS group_id,
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
      WHERE e.group_id = ANY(${groupIds})
        AND es.user_id != e.paid_by
    `,
    sql`
      SELECT group_id, paid_by, paid_to, amount::float AS amount, currency, created_at::date::text AS date
      FROM settlements
      WHERE group_id = ANY(${groupIds})
        AND id IS DISTINCT FROM ${excludeSettlementId ?? null}
    `,
  ]) as [DebtRow[], SettlementRow[]]

  const debtRowsByGroup = new Map<string, DebtRow[]>()
  for (const row of debtRows) {
    const list = debtRowsByGroup.get(row.group_id)
    if (list) list.push(row)
    else debtRowsByGroup.set(row.group_id, [row])
  }

  const settlementsByGroup = new Map<string, SettlementRow[]>()
  for (const s of settlements) {
    const list = settlementsByGroup.get(s.group_id)
    if (list) list.push(s)
    else settlementsByGroup.set(s.group_id, [s])
  }

  const result = new Map<string, Balance[]>()
  for (const g of groups) {
    result.set(g.id, await buildBalances(
      debtRowsByGroup.get(g.id) ?? [],
      settlementsByGroup.get(g.id) ?? [],
      g.currency,
    ))
  }
  return result
}

async function buildBalances(debtRows: DebtRow[], settlements: SettlementRow[], groupCurrency: string): Promise<Balance[]> {
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

  function toGroupCurrency(amount: number, currency: string, date: string): { amount: number; conversionFailed: boolean } {
    if (currency === groupCurrency) return { amount, conversionFailed: false }
    const rate = conversionsByDate.get(date)?.[currency]
    if (!rate) {
      console.warn(`toGroupCurrency: missing rate for ${currency} -> ${groupCurrency} on ${date}, falling back to raw amount`)
      return { amount, conversionFailed: true }
    }
    return { amount: amount / rate, conversionFailed: false }
  }

  type BreakdownItem = { expense_title: string; amount: number; currency: string; convertedAmount?: number; conversionFailed?: boolean }
  type Group = {
    from_user_id: string
    from_user_name: string
    to_user_id: string
    to_user_name: string
    total: number  // in group currency
    breakdown: BreakdownItem[]
    hasConversionWarning: boolean
    offset?: number
    offsetBreakdown?: BreakdownItem[]
  }
  const groups = new Map<string, Group>()

  for (const row of debtRows) {
    const key = `${row.from_user_id}|${row.to_user_id}`
    const { amount: converted, conversionFailed } = toGroupCurrency(row.amount, row.currency, row.date)
    const breakdownItem: BreakdownItem = {
      expense_title: row.expense_title,
      amount: row.amount,
      currency: row.currency,
      convertedAmount: row.currency !== groupCurrency && !conversionFailed ? Math.round(converted * 100) / 100 : undefined,
      conversionFailed: conversionFailed || undefined,
    }
    const g = groups.get(key)
    if (g) {
      g.total = Math.round((g.total + converted) * 100) / 100
      g.breakdown.push(breakdownItem)
      if (conversionFailed) g.hasConversionWarning = true
    } else {
      groups.set(key, {
        from_user_id: row.from_user_id,
        from_user_name: row.from_user_name,
        to_user_id: row.to_user_id,
        to_user_name: row.to_user_name,
        total: converted,
        breakdown: [breakdownItem],
        hasConversionWarning: conversionFailed,
      })
    }
  }

  // Apply settlements: convert to group currency and subtract from the debtor→creditor pair
  for (const s of settlements) {
    const key = `${s.paid_by}|${s.paid_to}`
    const g = groups.get(key)
    if (g) {
      const { amount: converted, conversionFailed } = toGroupCurrency(s.amount, s.currency, s.date)
      g.total = Math.round((g.total - converted) * 100) / 100
      if (conversionFailed) g.hasConversionWarning = true
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
      g.hasConversionWarning = g.hasConversionWarning || reverse.hasConversionWarning
      groups.delete(reverseKey)
    } else {
      reverse.offset = g.total
      reverse.offsetBreakdown = g.breakdown
      reverse.total = Math.round((reverse.total - g.total) * 100) / 100
      reverse.hasConversionWarning = reverse.hasConversionWarning || g.hasConversionWarning
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
      hasConversionWarning: g.hasConversionWarning || undefined,
    })
  }

  return balances
}
