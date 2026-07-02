import { sql } from '@/lib/db'
import { getMultiDateConversions } from '@/lib/exchange-rates'
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
    totalsRows,
    yourPaidRows,
    yourShareRows,
    monthlyRows,
    splitRows,
    topRows,
    categoryRows,
  ] = await Promise.all([
    sql`
      SELECT
        currency,
        date::text AS date,
        SUM(amount)::float AS daily_amount,
        COUNT(*)::int AS daily_count
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY currency, date
    ` as unknown as Promise<{ currency: string; date: string; daily_amount: number; daily_count: number }[]>,

    sql`
      SELECT currency, date::text AS date, SUM(amount)::float AS daily_paid
      FROM expenses
      WHERE group_id = ${groupId} AND paid_by = ${userId}
      GROUP BY currency, date
    ` as unknown as Promise<{ currency: string; date: string; daily_paid: number }[]>,

    sql`
      SELECT e.currency, e.date::text AS date, SUM(es.amount)::float AS daily_share
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = ${groupId} AND es.user_id = ${userId}
      GROUP BY e.currency, e.date
    ` as unknown as Promise<{ currency: string; date: string; daily_share: number }[]>,

    sql`
      SELECT
        to_char(date_trunc('month', date), 'Mon YYYY') AS month,
        currency,
        date::text AS date,
        SUM(amount)::float AS daily_total
      FROM expenses
      WHERE group_id = ${groupId}
        AND date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
      GROUP BY date_trunc('month', date), currency, date
      ORDER BY date_trunc('month', date)
    ` as unknown as Promise<{ month: string; currency: string; date: string; daily_total: number }[]>,

    sql`
      SELECT
        e.paid_by AS user_id,
        u.display_name AS name,
        e.currency,
        e.date::text AS date,
        SUM(e.amount)::float AS daily_total
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.group_id = ${groupId}
      GROUP BY e.paid_by, u.display_name, e.currency, e.date
    ` as unknown as Promise<{ user_id: string; name: string; currency: string; date: string; daily_total: number }[]>,

    sql`
      SELECT
        title,
        currency,
        date::text AS date,
        SUM(amount)::float AS daily_total,
        COUNT(*)::int AS daily_count
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY title, currency, date
    ` as unknown as Promise<{ title: string; currency: string; date: string; daily_total: number; daily_count: number }[]>,

    sql`
      SELECT
        category,
        currency,
        date::text AS date,
        SUM(amount)::float AS daily_total
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY category, currency, date
    ` as unknown as Promise<{ category: string | null; currency: string; date: string; daily_total: number }[]>,
  ])

  // Collect unique expense dates that actually need conversion, then fetch historical rates for each.
  const allDates = new Set<string>()
  for (const r of totalsRows) if (r.currency !== groupCurrency) allDates.add(r.date)
  for (const r of yourPaidRows) if (r.currency !== groupCurrency) allDates.add(r.date)
  for (const r of yourShareRows) if (r.currency !== groupCurrency) allDates.add(r.date)
  for (const r of monthlyRows) if (r.currency !== groupCurrency) allDates.add(r.date)
  for (const r of splitRows) if (r.currency !== groupCurrency) allDates.add(r.date)
  for (const r of topRows) if (r.currency !== groupCurrency) allDates.add(r.date)
  for (const r of categoryRows) if (r.currency !== groupCurrency) allDates.add(r.date)

  const conversionsByDate = allDates.size > 0
    ? await getMultiDateConversions(groupCurrency, [...allDates])
    : new Map<string, Record<string, number>>()

  // Converts an amount from fromCurrency to groupCurrency using the rate on the expense date.
  // Falls back to the raw amount if rates are unavailable for that date.
  function conv(amount: number, fromCurrency: string, date: string): number {
    if (fromCurrency === groupCurrency) return amount
    const dateConversions = conversionsByDate.get(date)
    if (!dateConversions) return amount
    const rate = dateConversions[fromCurrency]
    if (!rate) return amount
    return amount / rate
  }

  const round = (n: number) => Math.round(n * 100) / 100

  // Date range strings for this-month / last-month filtering
  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`

  let expense_count = 0
  let total_amount = 0
  let this_month_total = 0
  let last_month_total = 0
  for (const r of totalsRows) {
    const converted = conv(r.daily_amount, r.currency, r.date)
    expense_count += r.daily_count
    total_amount += converted
    if (r.date >= thisMonthStart) {
      this_month_total += converted
    } else if (r.date >= lastMonthStart) {
      last_month_total += converted
    }
  }

  let your_paid = 0
  for (const r of yourPaidRows) {
    your_paid += conv(r.daily_paid, r.currency, r.date)
  }

  let your_share = 0
  for (const r of yourShareRows) {
    your_share += conv(r.daily_share, r.currency, r.date)
  }

  // Monthly spending: preserve SQL month order, sum across currencies per month
  const monthlyMap = new Map<string, number>()
  const monthOrder: string[] = []
  for (const r of monthlyRows) {
    if (!monthlyMap.has(r.month)) monthOrder.push(r.month)
    monthlyMap.set(r.month, (monthlyMap.get(r.month) ?? 0) + conv(r.daily_total, r.currency, r.date))
  }
  const monthly_spending = monthOrder.map(month => ({
    month,
    total: round(monthlyMap.get(month) ?? 0),
  }))

  // Payment split: sum per user across currencies
  const paymentMap = new Map<string, { user_id: string; name: string; total: number }>()
  for (const r of splitRows) {
    const converted = conv(r.daily_total, r.currency, r.date)
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
    const converted = conv(r.daily_total, r.currency, r.date)
    const existing = topMap.get(r.title)
    if (existing) {
      existing.total = round(existing.total + converted)
      existing.count += r.daily_count
    } else {
      topMap.set(r.title, { title: r.title, total: round(converted), count: r.daily_count })
    }
  }
  const top_expenses = [...topMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  // Category spending: sum per category across currencies
  const categoryMap = new Map<string | null, number>()
  for (const r of categoryRows) {
    categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + conv(r.daily_total, r.currency, r.date))
  }
  const category_spending = [...categoryMap.entries()]
    .map(([category, total]) => ({ category, total: round(total) }))
    .sort((a, b) => b.total - a.total)

  return {
    total_expenses: round(total_amount),
    total_amount: round(total_amount),
    expense_count,
    your_paid: round(your_paid),
    your_share: round(your_share),
    this_month_total: round(this_month_total),
    last_month_total: round(last_month_total),
    monthly_spending,
    payment_split,
    top_expenses,
    category_spending,
  }
}
