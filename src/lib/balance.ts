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
      SELECT paid_by, paid_to, amount::float AS amount, currency
      FROM settlements
      WHERE group_id = ${groupId}
    `,
  ]) as [
    { from_user_id: string; from_user_name: string; to_user_id: string; to_user_name: string; amount: number; currency: string; date: string; expense_title: string }[],
    { paid_by: string; paid_to: string; amount: number; currency: string }[],
  ]

  type Group = {
    from_user_id: string
    from_user_name: string
    to_user_id: string
    to_user_name: string
    currency: string
    total: number
    breakdown: { expense_title: string; amount: number }[]
    offset?: number
    // per-date split totals, used to compute approxAmount at historical rates
    dateTotals: Map<string, number>
  }
  const groups = new Map<string, Group>()

  for (const row of debtRows) {
    const key = `${row.from_user_id}|${row.to_user_id}|${row.currency}`
    const g = groups.get(key)
    if (g) {
      g.total = Math.round((g.total + row.amount) * 100) / 100
      g.breakdown.push({ expense_title: row.expense_title, amount: row.amount })
      g.dateTotals.set(row.date, (g.dateTotals.get(row.date) ?? 0) + row.amount)
    } else {
      groups.set(key, {
        from_user_id: row.from_user_id,
        from_user_name: row.from_user_name,
        to_user_id: row.to_user_id,
        to_user_name: row.to_user_name,
        currency: row.currency,
        total: row.amount,
        breakdown: [{ expense_title: row.expense_title, amount: row.amount }],
        dateTotals: new Map([[row.date, row.amount]]),
      })
    }
  }

  // Apply settlements: paid_by paid paid_to → reduces paid_by's debt to paid_to
  for (const s of settlements) {
    const key = `${s.paid_by}|${s.paid_to}|${s.currency}`
    const g = groups.get(key)
    if (g) {
      g.total = Math.round((g.total - s.amount) * 100) / 100
    }
  }

  // Net out mutual debts: if A owes B and B owes A, reduce to a single net debt
  for (const key of [...groups.keys()]) {
    const g = groups.get(key)
    if (!g) continue
    const reverseKey = `${g.to_user_id}|${g.from_user_id}|${g.currency}`
    const reverse = groups.get(reverseKey)
    if (!reverse) continue
    if (g.total >= reverse.total) {
      g.offset = reverse.total
      g.total = Math.round((g.total - reverse.total) * 100) / 100
      groups.delete(reverseKey)
    } else {
      reverse.offset = g.total
      reverse.total = Math.round((reverse.total - g.total) * 100) / 100
      groups.delete(key)
    }
  }

  // Fetch historical rates for all unique expense dates, then compute approxAmount.
  // approxAmount = sum(splitAmount / historicalRate[date]) scaled by (total / originalTotal)
  // to account for any settlements or netting that reduced the balance.
  const allDates = new Set<string>()
  for (const g of groups.values()) {
    if (g.currency !== groupCurrency) {
      for (const date of g.dateTotals.keys()) allDates.add(date)
    }
  }

  const conversionsByDate = allDates.size > 0
    ? await getMultiDateConversions(groupCurrency, [...allDates])
    : new Map<string, Record<string, number>>()

  const balances: Balance[] = []
  for (const g of groups.values()) {
    const amount = Math.round(g.total * 100) / 100
    if (amount <= 0.005) continue

    let approxAmount: number | null = null
    if (g.currency !== groupCurrency) {
      const originalTotal = [...g.dateTotals.values()].reduce((s, v) => s + v, 0)
      let convertedSum = 0
      let ratesAvailable = true
      for (const [date, dateAmount] of g.dateTotals) {
        const conversions = conversionsByDate.get(date)
        const rate = conversions?.[g.currency]
        if (!rate) { ratesAvailable = false; break }
        convertedSum += dateAmount / rate
      }
      if (ratesAvailable && originalTotal > 0) {
        approxAmount = Math.round(convertedSum * (amount / originalTotal) * 100) / 100
      }
    }

    balances.push({
      from_user_id: g.from_user_id,
      from_user_name: g.from_user_name,
      to_user_id: g.to_user_id,
      to_user_name: g.to_user_name,
      amount,
      currency: g.currency,
      breakdown: g.breakdown,
      offset: g.offset,
      approxAmount,
    })
  }

  return balances
}
