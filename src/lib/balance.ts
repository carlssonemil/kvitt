import { sql } from '@/lib/db'
import type { Balance } from '@/types/database'

export async function computeBalances(groupId: string): Promise<Balance[]> {
  const [debtRows, settlements] = await Promise.all([
    sql`
      SELECT
        es.user_id        AS from_user_id,
        u_from.display_name AS from_user_name,
        e.paid_by         AS to_user_id,
        u_to.display_name AS to_user_name,
        es.amount::float  AS amount,
        e.currency,
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
    { from_user_id: string; from_user_name: string; to_user_id: string; to_user_name: string; amount: number; currency: string; expense_title: string }[],
    { paid_by: string; paid_to: string; amount: number; currency: string }[],
  ]

  // Group direct debts by (from_user_id, to_user_id, currency)
  type Group = {
    from_user_id: string
    from_user_name: string
    to_user_id: string
    to_user_name: string
    currency: string
    total: number
    breakdown: { expense_title: string; amount: number }[]
  }
  const groups = new Map<string, Group>()

  for (const row of debtRows) {
    const key = `${row.from_user_id}|${row.to_user_id}|${row.currency}`
    const g = groups.get(key)
    if (g) {
      g.total = Math.round((g.total + row.amount) * 100) / 100
      g.breakdown.push({ expense_title: row.expense_title, amount: row.amount })
    } else {
      groups.set(key, {
        from_user_id: row.from_user_id,
        from_user_name: row.from_user_name,
        to_user_id: row.to_user_id,
        to_user_name: row.to_user_name,
        currency: row.currency,
        total: row.amount,
        breakdown: [{ expense_title: row.expense_title, amount: row.amount }],
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

  const balances: Balance[] = []
  for (const g of groups.values()) {
    const amount = Math.round(g.total * 100) / 100
    if (amount > 0.005) {
      balances.push({
        from_user_id: g.from_user_id,
        from_user_name: g.from_user_name,
        to_user_id: g.to_user_id,
        to_user_name: g.to_user_name,
        amount,
        currency: g.currency,
        breakdown: g.breakdown,
      })
    }
  }

  return balances
}
