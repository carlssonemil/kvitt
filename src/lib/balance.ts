import { sql } from '@/lib/db'
import type { Balance } from '@/types/database'

function simplifyDebts(
  net: Map<string, number>,
  names: Map<string, string>,
  currency: string,
): Balance[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [id, amount] of net.entries()) {
    const rounded = Math.round(amount * 100) / 100
    if (rounded > 0.005) creditors.push({ id, amount: rounded })
    else if (rounded < -0.005) debtors.push({ id, amount: -rounded })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const balances: Balance[] = []

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0]!
    const debtor = debtors[0]!
    const transfer = Math.round(Math.min(creditor.amount, debtor.amount) * 100) / 100

    balances.push({
      from_user_id: debtor.id,
      from_user_name: names.get(debtor.id) ?? debtor.id,
      to_user_id: creditor.id,
      to_user_name: names.get(creditor.id) ?? creditor.id,
      amount: transfer,
      currency,
    })

    creditor.amount = Math.round((creditor.amount - transfer) * 100) / 100
    debtor.amount = Math.round((debtor.amount - transfer) * 100) / 100

    if (creditor.amount < 0.005) creditors.shift()
    if (debtor.amount < 0.005) debtors.shift()
  }

  return balances
}

export async function computeBalances(groupId: string): Promise<Balance[]> {
  const [expenses, splits, settlements] = await Promise.all([
    sql`
      SELECT e.paid_by, e.amount::float AS amount, e.currency, u.display_name AS paid_by_name
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.group_id = ${groupId}
    `,
    sql`
      SELECT es.user_id, es.amount::float AS amount, e.currency, u.display_name AS user_name
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      JOIN users u ON u.id = es.user_id
      WHERE e.group_id = ${groupId}
    `,
    sql`
      SELECT s.paid_by, s.paid_to, s.amount::float AS amount, s.currency
      FROM settlements s
      WHERE s.group_id = ${groupId}
    `,
  ]) as [
    { paid_by: string; amount: number; currency: string; paid_by_name: string }[],
    { user_id: string; amount: number; currency: string; user_name: string }[],
    { paid_by: string; paid_to: string; amount: number; currency: string }[],
  ]

  // net per currency per user: positive = owed to them, negative = they owe
  const netByCurrency = new Map<string, Map<string, number>>()
  const names = new Map<string, string>()

  function getNet(currency: string): Map<string, number> {
    let m = netByCurrency.get(currency)
    if (!m) { m = new Map(); netByCurrency.set(currency, m) }
    return m
  }

  for (const e of expenses) {
    const m = getNet(e.currency)
    m.set(e.paid_by, (m.get(e.paid_by) ?? 0) + e.amount)
    names.set(e.paid_by, e.paid_by_name)
  }

  for (const s of splits) {
    const m = getNet(s.currency)
    m.set(s.user_id, (m.get(s.user_id) ?? 0) - s.amount)
    names.set(s.user_id, s.user_name)
  }

  for (const s of settlements) {
    const m = getNet(s.currency)
    m.set(s.paid_by, (m.get(s.paid_by) ?? 0) + s.amount)
    m.set(s.paid_to, (m.get(s.paid_to) ?? 0) - s.amount)
  }

  const balances: Balance[] = []
  for (const [currency, net] of netByCurrency.entries()) {
    balances.push(...simplifyDebts(net, names, currency))
  }
  return balances
}
