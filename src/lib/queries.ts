import { sql } from '@/lib/db'
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

export async function getGroupStats(groupId: string, userId: string): Promise<GroupStats> {
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
    ` as unknown as Promise<{ expense_count: number; total_amount: number; this_month_total: number; last_month_total: number }[]>,

    sql`
      SELECT COALESCE(SUM(amount), 0)::float AS your_paid
      FROM expenses
      WHERE group_id = ${groupId} AND paid_by = ${userId}
    ` as unknown as Promise<{ your_paid: number }[]>,

    sql`
      SELECT COALESCE(SUM(es.amount), 0)::float AS your_share
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = ${groupId} AND es.user_id = ${userId}
    ` as unknown as Promise<{ your_share: number }[]>,

    sql`
      SELECT
        to_char(date_trunc('month', date), 'Mon YYYY') AS month,
        SUM(amount)::float AS total
      FROM expenses
      WHERE group_id = ${groupId}
        AND date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
      GROUP BY date_trunc('month', date)
      ORDER BY date_trunc('month', date)
    ` as unknown as Promise<{ month: string; total: number }[]>,

    sql`
      SELECT
        e.paid_by AS user_id,
        u.display_name AS name,
        SUM(e.amount)::float AS total
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.group_id = ${groupId}
      GROUP BY e.paid_by, u.display_name
      ORDER BY total DESC
    ` as unknown as Promise<{ user_id: string; name: string; total: number }[]>,

    sql`
      SELECT
        title,
        SUM(amount)::float AS total,
        COUNT(*)::int AS count
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY title
      ORDER BY total DESC
      LIMIT 5
    ` as unknown as Promise<{ title: string; total: number; count: number }[]>,

    sql`
      SELECT
        category,
        SUM(amount)::float AS total
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY category
      ORDER BY total DESC
    ` as unknown as Promise<{ category: string | null; total: number }[]>,
  ])

  const totals = totalsRows[0]
  return {
    total_expenses: totals?.total_amount ?? 0,
    total_amount: totals?.total_amount ?? 0,
    expense_count: totals?.expense_count ?? 0,
    your_paid: yourPaidRows[0]?.your_paid ?? 0,
    your_share: yourShareRows[0]?.your_share ?? 0,
    this_month_total: totals?.this_month_total ?? 0,
    last_month_total: totals?.last_month_total ?? 0,
    monthly_spending: monthlyRows,
    payment_split: splitRows,
    top_expenses: topRows,
    category_spending: categoryRows,
  }
}
