import { sql } from '@/lib/db'
import { getMultiDateConversions } from '@/lib/exchange-rates'
import { FEED_PAGE_SIZE } from '@/lib/constants'
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

export interface FeedCursor {
  sortDate: string
  createdAt: string
  id: string
}

export type FeedItem =
  | { kind: 'expense'; data: ExpenseWithPayer }
  | { kind: 'settlement'; data: SettlementWithUsers }

export interface FeedFilters {
  type?: 'expense' | 'settlement'
  category?: string
  dateFrom?: string
  dateTo?: string
}

export interface FeedPage {
  items: FeedItem[]
  nextCursor: FeedCursor | null
  hasMore: boolean
}

interface FeedIndexRow {
  id: string
  kind: 'expense' | 'settlement'
  sort_date: string
  created_at: string
}

async function getExpensesByIds(groupId: string, ids: string[]): Promise<ExpenseWithPayer[]> {
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
    WHERE e.group_id = ${groupId} AND e.id = ANY(${ids})
    GROUP BY e.id, u.display_name, u.avatar_url
  `
  return rows as unknown as ExpenseWithPayer[]
}

async function getSettlementsByIds(groupId: string, ids: string[]): Promise<SettlementWithUsers[]> {
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
    WHERE s.group_id = ${groupId} AND s.id = ANY(${ids})
  `
  return rows as SettlementWithUsers[]
}

// Cursor-paginated, chronologically merged feed of expenses + settlements for a group.
// Two steps: a cheap sorted/filtered index query (id + sort keys only), then a batch
// hydration of just that page's rows. Keeps every branch bounded to LIMIT pageSize+1 —
// the top-K of a merge of two sorted streams is always a subset of (top-K of A) ∪ (top-K of B).
export async function getGroupFeedPage(
  groupId: string,
  cursor: FeedCursor | null,
  filters: FeedFilters,
  pageSize: number = FEED_PAGE_SIZE
): Promise<FeedPage> {
  const includeExpenses = filters.type !== 'settlement'
  // Settlements have no category, so a category filter structurally excludes them.
  const includeSettlements = filters.type !== 'expense' && !filters.category

  if (!includeExpenses && !includeSettlements) {
    return { items: [], nextCursor: null, hasMore: false }
  }

  const params: unknown[] = [groupId]
  const fetchLimit = pageSize + 1

  // Row-value comparison keeps keyset pagination stable even when rows share a
  // sort_date/created_at — the id is a final tiebreaker. Never drop it to a 2-tuple.
  function cursorClause(dateExpr: string, createdAtExpr: string, idExpr: string): string {
    if (!cursor) return ''
    params.push(cursor.sortDate, cursor.createdAt, cursor.id)
    const n = params.length
    return `AND (${dateExpr}, ${createdAtExpr}, ${idExpr}) < ($${n - 2}, $${n - 1}, $${n})`
  }

  function dateRangeClause(dateExpr: string): string {
    let clause = ''
    if (filters.dateFrom) {
      params.push(filters.dateFrom)
      clause += ` AND ${dateExpr} >= $${params.length}`
    }
    if (filters.dateTo) {
      params.push(filters.dateTo)
      clause += ` AND ${dateExpr} <= $${params.length}`
    }
    return clause
  }

  const ctes: { name: string; sql: string }[] = []

  if (includeExpenses) {
    let categoryClause = ''
    if (filters.category === 'uncategorized') {
      categoryClause = 'AND e.category IS NULL'
    } else if (filters.category) {
      params.push(filters.category)
      categoryClause = `AND e.category = $${params.length}`
    }
    const dateClause = dateRangeClause('e.date')
    const cursorSql = cursorClause('e.date', 'e.created_at', 'e.id')
    ctes.push({
      name: 'expense_idx',
      sql: `expense_idx AS (
        SELECT e.id, 'expense'::text AS kind, e.date::text AS sort_date, e.created_at::text AS created_at
        FROM expenses e
        WHERE e.group_id = $1 ${categoryClause} ${dateClause} ${cursorSql}
        ORDER BY e.date DESC, e.created_at DESC, e.id DESC
        LIMIT ${fetchLimit}
      )`,
    })
  }

  if (includeSettlements) {
    const dateClause = dateRangeClause('s.created_at::date')
    const cursorSql = cursorClause('s.created_at::date', 's.created_at', 's.id')
    ctes.push({
      name: 'settlement_idx',
      sql: `settlement_idx AS (
        SELECT s.id, 'settlement'::text AS kind, s.created_at::date::text AS sort_date, s.created_at::text AS created_at
        FROM settlements s
        WHERE s.group_id = $1 ${dateClause} ${cursorSql}
        ORDER BY sort_date DESC, s.created_at DESC, s.id DESC
        LIMIT ${fetchLimit}
      )`,
    })
  }

  const query = `
    WITH ${ctes.map(c => c.sql).join(',\n')}
    ${ctes.map(c => `SELECT id, kind, sort_date, created_at FROM ${c.name}`).join('\nUNION ALL\n')}
    ORDER BY sort_date DESC, created_at DESC, id DESC
    LIMIT ${fetchLimit}
  `

  const indexRows = (await sql.query(query, params)) as unknown as FeedIndexRow[]

  const hasMore = indexRows.length > pageSize
  const trimmed = indexRows.slice(0, pageSize)

  const expenseIds = trimmed.filter(r => r.kind === 'expense').map(r => r.id)
  const settlementIds = trimmed.filter(r => r.kind === 'settlement').map(r => r.id)

  const [expenseRows, settlementRows] = await Promise.all([
    expenseIds.length > 0 ? getExpensesByIds(groupId, expenseIds) : Promise.resolve([]),
    settlementIds.length > 0 ? getSettlementsByIds(groupId, settlementIds) : Promise.resolve([]),
  ])

  const expenseMap = new Map(expenseRows.map(e => [e.id, e]))
  const settlementMap = new Map(settlementRows.map(s => [s.id, s]))

  const items: FeedItem[] = trimmed.map(r => {
    if (r.kind === 'expense') {
      const data = expenseMap.get(r.id)
      if (!data) throw new Error(`Expense ${r.id} missing from feed hydration batch`)
      return { kind: 'expense' as const, data }
    }
    const data = settlementMap.get(r.id)
    if (!data) throw new Error(`Settlement ${r.id} missing from feed hydration batch`)
    return { kind: 'settlement' as const, data }
  })

  const last = trimmed[trimmed.length - 1]
  const nextCursor: FeedCursor | null = hasMore && last
    ? { sortDate: last.sort_date, createdAt: last.created_at, id: last.id }
    : null

  return { items, nextCursor, hasMore }
}

export async function getGroupFeedCategories(groupId: string): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT COALESCE(category, 'uncategorized') AS category
    FROM expenses
    WHERE group_id = ${groupId}
    ORDER BY category
  ` as { category: string }[]
  return rows.map(r => r.category)
}

export async function getGroupFeedCounts(groupId: string): Promise<{ expenseCount: number; settlementCount: number }> {
  const [row] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM expenses WHERE group_id = ${groupId}) AS expense_count,
      (SELECT COUNT(*)::int FROM settlements WHERE group_id = ${groupId}) AS settlement_count
  ` as { expense_count: number; settlement_count: number }[]
  return { expenseCount: row!.expense_count, settlementCount: row!.settlement_count }
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberWithUser[]> {
  const rows = await sql`
    SELECT gm.id, gm.group_id, gm.user_id, gm.joined_at,
           u.display_name, u.avatar_url, u.is_guest
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${groupId}
    ORDER BY u.display_name
  `
  return rows as GroupMemberWithUser[]
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
        EXTRACT(YEAR FROM date)::int AS year,
        currency,
        date::text AS date,
        SUM(amount)::float AS daily_total
      FROM expenses
      WHERE group_id = ${groupId}
      GROUP BY date_trunc('month', date), currency, date
      ORDER BY date_trunc('month', date)
    ` as unknown as Promise<{ month: string; year: number; currency: string; date: string; daily_total: number }[]>,

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
        amount::float AS amount,
        COUNT(*) OVER (PARTITION BY title)::int AS title_count
      FROM expenses
      WHERE group_id = ${groupId}
    ` as unknown as Promise<{ title: string; currency: string; date: string; amount: number; title_count: number }[]>,

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

  // Date range string for this-month filtering
  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  let expense_count = 0
  let total_amount = 0
  let this_month_total = 0
  let this_month_count = 0
  for (const r of totalsRows) {
    const converted = conv(r.daily_amount, r.currency, r.date)
    expense_count += r.daily_count
    total_amount += converted
    if (r.date >= thisMonthStart) {
      this_month_total += converted
      this_month_count += r.daily_count
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
  const monthYearMap = new Map<string, number>()
  const monthOrder: string[] = []
  for (const r of monthlyRows) {
    if (!monthlyMap.has(r.month)) {
      monthOrder.push(r.month)
      monthYearMap.set(r.month, r.year)
    }
    monthlyMap.set(r.month, (monthlyMap.get(r.month) ?? 0) + conv(r.daily_total, r.currency, r.date))
  }
  const monthly_spending = monthOrder.map(month => ({
    month,
    year: monthYearMap.get(month) ?? 0,
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

  // Top expenses: one-time expenses only (titles that occur exactly once), take top 5
  const top_expenses = topRows
    .filter(r => r.title_count === 1)
    .map(r => ({ title: r.title, total: round(conv(r.amount, r.currency, r.date)), date: r.date }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

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
    this_month_count,
    monthly_spending,
    payment_split,
    top_expenses,
    category_spending,
  }
}
