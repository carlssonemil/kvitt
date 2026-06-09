import { sql } from '@/lib/db'
import { getConversionsFrom } from '@/lib/exchange-rates'
import type { ExpenseWithPayer, GroupMemberWithUser, GroupStats } from '@/types/database'

export interface SettlementWithUsers {
  id: string
  group_id: string
  paid_by: string
  paid_to: string
  amount: number
  currency: string
  note: string | null
  created_at: string
  paid_by_name: string
  paid_by_avatar: string | null
  paid_to_name: string
  paid_to_avatar: string | null
}

export async function getGroupExpenses(groupId: string): Promise<ExpenseWithPayer[]> {
  const rows = await sql`
    SELECT
      e.id, e.group_id, e.paid_by, e.title,
      e.amount::float AS amount,
      e.currency, e.date, e.note, e.category, e.created_by, e.created_at,
      u.display_name AS paid_by_name,
      u.avatar_url AS paid_by_avatar,
      COALESCE(
        json_agg(
          json_build_object(
            'id', es.id,
            'expense_id', es.expense_id,
            'user_id', es.user_id,
            'amount', es.amount::float,
            'user_display_name', su.display_name,
            'user_avatar', su.avatar_url
          ) ORDER BY su.display_name
        ) FILTER (WHERE es.id IS NOT NULL),
        '[]'
      ) AS splits
    FROM expenses e
    JOIN users u ON u.id = e.paid_by
    LEFT JOIN expense_splits es ON es.expense_id = e.id
    LEFT JOIN users su ON su.id = es.user_id
    WHERE e.group_id = ${groupId}
    GROUP BY e.id, u.display_name, u.avatar_url
    ORDER BY e.date DESC, e.created_at DESC
  `
  return rows as unknown as ExpenseWithPayer[]
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberWithUser[]> {
  const rows = await sql`
    SELECT gm.id, gm.group_id, gm.user_id, gm.joined_at,
           u.display_name, u.email, u.avatar_url
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${groupId}
    ORDER BY u.display_name
  `
  return rows as GroupMemberWithUser[]
}

export async function getGroupSettlements(groupId: string): Promise<SettlementWithUsers[]> {
  const rows = await sql`
    SELECT
      s.id, s.group_id, s.paid_by, s.paid_to,
      s.amount::float AS amount,
      s.currency,
      s.note, s.created_at::text,
      pb.display_name AS paid_by_name,
      pb.avatar_url AS paid_by_avatar,
      pt.display_name AS paid_to_name,
      pt.avatar_url AS paid_to_avatar
    FROM settlements s
    JOIN users pb ON pb.id = s.paid_by
    JOIN users pt ON pt.id = s.paid_to
    WHERE s.group_id = ${groupId}
    ORDER BY s.created_at DESC
  `
  return rows as SettlementWithUsers[]
}

export async function getGroupStats(groupId: string, userId: string, groupCurrency: string): Promise<GroupStats> {
  const [
    conversions,
    totalsRows,
    yourPaidRows,
    yourShareRows,
    monthlyRows,
    splitRows,
    topRows,
    categoryRows,
  ] = await Promise.all([
    getConversionsFrom(groupCurrency),

    sql`
      SELECT
        currency,
        COUNT(*)::int AS expense_count,
        COALESCE(SUM(amount), 0)::float AS total_amount,
        COALESCE(SUM(amount) FILTER (
          WHERE date >= date_trunc('month', CURRENT_DATE)
        ), 0)::float AS this_month_total,
        COALESCE(SUM(amount) FILTER (
          WHERE date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
            AND date < date_trunc('month', CURRENT_DATE)
        ), 0)::float AS last_month_total
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY currency
    ` as unknown as Promise<{ currency: string; expense_count: number; total_amount: number; this_month_total: number; last_month_total: number }[]>,

    sql`
      SELECT currency, COALESCE(SUM(amount), 0)::float AS your_paid
      FROM expenses
      WHERE group_id = ${groupId} AND paid_by = ${userId}
      GROUP BY currency
    ` as unknown as Promise<{ currency: string; your_paid: number }[]>,

    sql`
      SELECT e.currency, COALESCE(SUM(es.amount), 0)::float AS your_share
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = ${groupId} AND es.user_id = ${userId}
      GROUP BY e.currency
    ` as unknown as Promise<{ currency: string; your_share: number }[]>,

    sql`
      SELECT
        to_char(date_trunc('month', date), 'Mon YYYY') AS month,
        currency,
        SUM(amount)::float AS total
      FROM expenses
      WHERE group_id = ${groupId}
        AND date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
      GROUP BY date_trunc('month', date), currency
      ORDER BY date_trunc('month', date)
    ` as unknown as Promise<{ month: string; currency: string; total: number }[]>,

    sql`
      SELECT
        e.paid_by AS user_id,
        u.display_name AS name,
        e.currency,
        SUM(e.amount)::float AS total
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.group_id = ${groupId}
      GROUP BY e.paid_by, u.display_name, e.currency
    ` as unknown as Promise<{ user_id: string; name: string; currency: string; total: number }[]>,

    sql`
      SELECT
        title,
        currency,
        SUM(amount)::float AS total,
        COUNT(*)::int AS count
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY title, currency
    ` as unknown as Promise<{ title: string; currency: string; total: number; count: number }[]>,

    sql`
      SELECT
        category,
        currency,
        SUM(amount)::float AS total
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY category, currency
    ` as unknown as Promise<{ category: string | null; currency: string; total: number }[]>,
  ])

  // Converts an amount from fromCurrency to groupCurrency.
  // Falls back to the raw amount if rates are unavailable or the currency is unknown.
  function conv(amount: number, fromCurrency: string): number {
    if (!conversions || fromCurrency === groupCurrency) return amount
    const rate = conversions[fromCurrency]
    if (!rate) return amount
    return amount / rate
  }

  const round = (n: number) => Math.round(n * 100) / 100

  const expense_count = totalsRows.reduce((sum, r) => sum + r.expense_count, 0)
  const total_amount = round(totalsRows.reduce((sum, r) => sum + conv(r.total_amount, r.currency), 0))
  const this_month_total = round(totalsRows.reduce((sum, r) => sum + conv(r.this_month_total, r.currency), 0))
  const last_month_total = round(totalsRows.reduce((sum, r) => sum + conv(r.last_month_total, r.currency), 0))
  const your_paid = round(yourPaidRows.reduce((sum, r) => sum + conv(r.your_paid, r.currency), 0))
  const your_share = round(yourShareRows.reduce((sum, r) => sum + conv(r.your_share, r.currency), 0))

  // Monthly spending: preserve SQL month order, sum across currencies per month
  const monthlyMap = new Map<string, number>()
  const monthOrder: string[] = []
  for (const r of monthlyRows) {
    if (!monthlyMap.has(r.month)) monthOrder.push(r.month)
    monthlyMap.set(r.month, (monthlyMap.get(r.month) ?? 0) + conv(r.total, r.currency))
  }
  const monthly_spending = monthOrder.map(month => ({
    month,
    total: round(monthlyMap.get(month) ?? 0),
  }))

  // Payment split: sum per user across currencies
  const paymentMap = new Map<string, { user_id: string; name: string; total: number }>()
  for (const r of splitRows) {
    const converted = conv(r.total, r.currency)
    const existing = paymentMap.get(r.user_id)
    if (existing) {
      existing.total = round(existing.total + converted)
    } else {
      paymentMap.set(r.user_id, { user_id: r.user_id, name: r.name, total: round(converted) })
    }
  }
  const payment_split = [...paymentMap.values()].sort((a, b) => b.total - a.total)

  // Top expenses: sum per title across currencies, take top 5
  const topMap = new Map<string, { title: string; total: number; count: number }>()
  for (const r of topRows) {
    const converted = conv(r.total, r.currency)
    const existing = topMap.get(r.title)
    if (existing) {
      existing.total = round(existing.total + converted)
      existing.count += r.count
    } else {
      topMap.set(r.title, { title: r.title, total: round(converted), count: r.count })
    }
  }
  const top_expenses = [...topMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  // Category spending: sum per category across currencies
  const categoryMap = new Map<string | null, number>()
  for (const r of categoryRows) {
    categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + conv(r.total, r.currency))
  }
  const category_spending = [...categoryMap.entries()]
    .map(([category, total]) => ({ category, total: round(total) }))
    .sort((a, b) => b.total - a.total)

  return {
    total_expenses: total_amount,
    total_amount,
    expense_count,
    your_paid,
    your_share,
    this_month_total,
    last_month_total,
    monthly_spending,
    payment_split,
    top_expenses,
    category_spending,
  }
}
