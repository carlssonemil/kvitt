import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getGroupStats, getGroupFeedPage, getGroupFeedCategories, getGroupFeedCounts, getGroupMembers } from './queries'

type Rows = {
  totalsRows: unknown[]
  yourPaidRows: unknown[]
  yourShareRows: unknown[]
  monthlyRows: unknown[]
  splitRows: unknown[]
  topRows: unknown[]
  categoryRows: unknown[]
}

function emptyRows(): Rows {
  return {
    totalsRows: [],
    yourPaidRows: [],
    yourShareRows: [],
    monthlyRows: [],
    splitRows: [],
    topRows: [],
    categoryRows: [],
  }
}

const { state, feedState, getMultiDateConversions, queryMock } = vi.hoisted(() => ({
  state: { rows: {
    totalsRows: [] as unknown[],
    yourPaidRows: [] as unknown[],
    yourShareRows: [] as unknown[],
    monthlyRows: [] as unknown[],
    splitRows: [] as unknown[],
    topRows: [] as unknown[],
    categoryRows: [] as unknown[],
  } },
  feedState: {
    expenseRows: [] as { id: string; [key: string]: unknown }[],
    settlementRows: [] as { id: string; [key: string]: unknown }[],
    categoryRows: [] as { category: string }[],
    countsRow: { expense_count: 0, settlement_count: 0 } as { expense_count: number; settlement_count: number },
    memberRows: [] as Record<string, unknown>[],
  },
  getMultiDateConversions: vi.fn(),
  queryMock: vi.fn(),
}))

// Routes each of getGroupStats' 7 parallel queries, plus the feed-hydration and
// membership/category/count queries, to canned rows by matching a substring unique
// to that query's SQL text, so this stays correct regardless of call order.
function sqlTag(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.join('')
  if (text.includes('daily_amount')) return Promise.resolve(state.rows.totalsRows)
  if (text.includes('daily_paid')) return Promise.resolve(state.rows.yourPaidRows)
  if (text.includes('daily_share')) return Promise.resolve(state.rows.yourShareRows)
  if (text.includes('to_char')) return Promise.resolve(state.rows.monthlyRows)
  if (text.includes('paid_by AS user_id')) return Promise.resolve(state.rows.splitRows)
  if (text.includes('title_count')) return Promise.resolve(state.rows.topRows)
  if (text.includes('GROUP BY category,')) return Promise.resolve(state.rows.categoryRows)
  if (text.includes('LEFT JOIN expense_splits')) {
    const ids = values[1] as string[]
    return Promise.resolve(feedState.expenseRows.filter(r => ids.includes(r.id)))
  }
  if (text.includes('pb.avatar_url')) {
    const ids = values[1] as string[]
    return Promise.resolve(feedState.settlementRows.filter(r => ids.includes(r.id)))
  }
  if (text.includes('DISTINCT COALESCE')) return Promise.resolve(feedState.categoryRows)
  if (text.includes('AS settlement_count')) return Promise.resolve([feedState.countsRow])
  if (text.includes('u.is_guest') && text.includes('gm.joined_at')) return Promise.resolve(feedState.memberRows)
  throw new Error(`queries.test.ts sql mock: unmatched query: ${text}`)
}

vi.mock('@/lib/db', () => ({ sql: Object.assign(sqlTag, { query: queryMock }) }))
vi.mock('@/lib/exchange-rates', () => ({ getMultiDateConversions }))

function setRows(overrides: Partial<Rows>) {
  state.rows = { ...emptyRows(), ...overrides }
}

describe('getGroupStats', () => {
  beforeEach(() => {
    setRows({})
    getMultiDateConversions.mockReset()
    getMultiDateConversions.mockResolvedValue(new Map())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes totals, your_paid/your_share, and per-aggregate breakdowns for a single-currency group', async () => {
    setRows({
      totalsRows: [{ currency: 'EUR', date: '2024-01-10', daily_amount: 30, daily_count: 2 }],
      yourPaidRows: [{ currency: 'EUR', date: '2024-01-10', daily_paid: 20 }],
      yourShareRows: [{ currency: 'EUR', date: '2024-01-10', daily_share: 15 }],
      monthlyRows: [{ month: 'Jan 2024', year: 2024, currency: 'EUR', date: '2024-01-10', daily_total: 30 }],
      splitRows: [
        { user_id: 'alice', name: 'Alice', currency: 'EUR', date: '2024-01-10', daily_total: 20 },
        { user_id: 'bob', name: 'Bob', currency: 'EUR', date: '2024-01-10', daily_total: 10 },
      ],
      topRows: [{ title: 'Dinner', currency: 'EUR', date: '2024-01-10', amount: 30, title_count: 1 }],
      categoryRows: [{ category: 'food', currency: 'EUR', date: '2024-01-10', daily_total: 30 }],
    })

    const stats = await getGroupStats('g1', 'alice', 'EUR')

    expect(stats.total_amount).toBe(30)
    expect(stats.expense_count).toBe(2)
    expect(stats.your_paid).toBe(20)
    expect(stats.your_share).toBe(15)
    expect(stats.this_month_total).toBe(30)
    expect(stats.this_month_count).toBe(2)
    expect(stats.monthly_spending).toEqual([{ month: 'Jan 2024', year: 2024, total: 30 }])
    expect(stats.payment_split).toEqual([
      { user_id: 'alice', name: 'Alice', total: 20 },
      { user_id: 'bob', name: 'Bob', total: 10 },
    ])
    expect(stats.top_expenses).toEqual([{ title: 'Dinner', total: 30, date: '2024-01-10' }])
    expect(stats.category_spending).toEqual([{ category: 'food', total: 30 }])
  })

  it('converts foreign-currency rows into the group currency using the historical rate', async () => {
    getMultiDateConversions.mockResolvedValue(new Map([['2024-01-05', { USD: 0.5 }]]))
    setRows({
      totalsRows: [{ currency: 'USD', date: '2024-01-05', daily_amount: 20, daily_count: 1 }],
    })

    const stats = await getGroupStats('g1', 'alice', 'EUR')

    expect(getMultiDateConversions).toHaveBeenCalledWith('EUR', ['2024-01-05'])
    expect(stats.total_amount).toBe(40) // 20 / 0.5
  })

  it('restricts this_month_total/this_month_count to the current calendar month', async () => {
    setRows({
      totalsRows: [
        { currency: 'EUR', date: '2024-01-20', daily_amount: 10, daily_count: 1 }, // still "last" month by the time we check Feb
        { currency: 'EUR', date: '2024-02-05', daily_amount: 25, daily_count: 1 },
      ],
    })
    vi.setSystemTime(new Date('2024-02-15T12:00:00Z'))

    const stats = await getGroupStats('g1', 'alice', 'EUR')

    expect(stats.total_amount).toBe(35)
    expect(stats.expense_count).toBe(2)
    expect(stats.this_month_total).toBe(25)
    expect(stats.this_month_count).toBe(1)
  })

  it('sorts payment_split descending by total regardless of row order', async () => {
    setRows({
      splitRows: [
        { user_id: 'bob', name: 'Bob', currency: 'EUR', date: '2024-01-10', daily_total: 5 },
        { user_id: 'alice', name: 'Alice', currency: 'EUR', date: '2024-01-10', daily_total: 50 },
      ],
    })

    const stats = await getGroupStats('g1', 'alice', 'EUR')

    expect(stats.payment_split).toEqual([
      { user_id: 'alice', name: 'Alice', total: 50 },
      { user_id: 'bob', name: 'Bob', total: 5 },
    ])
  })

  it('excludes titles that occur more than once, sorts by total desc, and caps at 5', async () => {
    setRows({
      topRows: [
        { title: 'Recurring', currency: 'EUR', date: '2024-01-01', amount: 1000, title_count: 2 },
        { title: 'Recurring', currency: 'EUR', date: '2024-01-02', amount: 1000, title_count: 2 },
        { title: 'B', currency: 'EUR', date: '2024-01-01', amount: 10, title_count: 1 },
        { title: 'C', currency: 'EUR', date: '2024-01-01', amount: 50, title_count: 1 },
        { title: 'D', currency: 'EUR', date: '2024-01-01', amount: 5, title_count: 1 },
        { title: 'E', currency: 'EUR', date: '2024-01-01', amount: 40, title_count: 1 },
        { title: 'F', currency: 'EUR', date: '2024-01-01', amount: 30, title_count: 1 },
        { title: 'G', currency: 'EUR', date: '2024-01-01', amount: 20, title_count: 1 },
      ],
    })

    const stats = await getGroupStats('g1', 'alice', 'EUR')

    expect(stats.top_expenses.map(e => e.title)).toEqual(['C', 'E', 'F', 'G', 'B'])
  })

  it('sums category_spending per category across currencies, including uncategorized (null)', async () => {
    setRows({
      categoryRows: [
        { category: 'food', currency: 'EUR', date: '2024-01-01', daily_total: 10 },
        { category: 'food', currency: 'EUR', date: '2024-01-02', daily_total: 5 },
        { category: null, currency: 'EUR', date: '2024-01-01', daily_total: 20 },
      ],
    })

    const stats = await getGroupStats('g1', 'alice', 'EUR')

    expect(stats.category_spending).toEqual([
      { category: null, total: 20 },
      { category: 'food', total: 15 },
    ])
  })
})

describe('getGroupFeedPage', () => {
  beforeEach(() => {
    feedState.expenseRows = []
    feedState.settlementRows = []
    queryMock.mockReset()
  })

  function indexRow(overrides: Partial<{ id: string; kind: 'expense' | 'settlement'; sort_date: string; created_at: string }> = {}) {
    return {
      id: 'e1',
      kind: 'expense' as const,
      sort_date: '2024-01-10',
      created_at: '2024-01-10T12:00:00.000Z',
      ...overrides,
    }
  }

  it('hydrates a single-kind index page into feed items, preserving order', async () => {
    queryMock.mockResolvedValue([
      indexRow({ id: 'e1', sort_date: '2024-01-10' }),
      indexRow({ id: 'e2', sort_date: '2024-01-09' }),
    ])
    feedState.expenseRows = [
      { id: 'e1', title: 'Dinner' },
      { id: 'e2', title: 'Groceries' },
    ]

    const page = await getGroupFeedPage('g1', null, {})

    expect(page.items).toEqual([
      { kind: 'expense', data: { id: 'e1', title: 'Dinner' } },
      { kind: 'expense', data: { id: 'e2', title: 'Groceries' } },
    ])
  })

  it('merges expenses and settlements, preserving the SQL-provided chronological order', async () => {
    queryMock.mockResolvedValue([
      indexRow({ id: 'e1', kind: 'expense' }),
      indexRow({ id: 's1', kind: 'settlement' }),
    ])
    feedState.expenseRows = [{ id: 'e1', title: 'Dinner' }]
    feedState.settlementRows = [{ id: 's1', amount: 10 }]

    const page = await getGroupFeedPage('g1', null, {})

    expect(page.items.map(i => i.kind)).toEqual(['expense', 'settlement'])
    expect(page.items[1]).toEqual({ kind: 'settlement', data: { id: 's1', amount: 10 } })
  })

  it('signals hasMore and returns a cursor pointing at the last kept row when the index overflows the page', async () => {
    queryMock.mockResolvedValue([
      indexRow({ id: 'e1', sort_date: '2024-01-03', created_at: '2024-01-03T00:00:00.000Z' }),
      indexRow({ id: 'e2', sort_date: '2024-01-02', created_at: '2024-01-02T00:00:00.000Z' }),
      indexRow({ id: 'e3', sort_date: '2024-01-01', created_at: '2024-01-01T00:00:00.000Z' }), // the +1 overflow row
    ])
    feedState.expenseRows = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]

    const page = await getGroupFeedPage('g1', null, {}, 2)

    expect(page.items).toHaveLength(2)
    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toEqual({ sortDate: '2024-01-02', createdAt: '2024-01-02T00:00:00.000Z', id: 'e2' })
  })

  it('reports hasMore false and a null cursor when the index does not overflow the page', async () => {
    queryMock.mockResolvedValue([indexRow({ id: 'e1' })])
    feedState.expenseRows = [{ id: 'e1' }]

    const page = await getGroupFeedPage('g1', null, {}, 2)

    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBeNull()
  })

  it('excludes the settlement CTE when filtering to expenses only', async () => {
    queryMock.mockResolvedValue([])

    await getGroupFeedPage('g1', null, { type: 'expense' })

    const [query] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('expense_idx')
    expect(query).not.toContain('settlement_idx')
  })

  it('excludes the expense CTE when filtering to settlements only', async () => {
    queryMock.mockResolvedValue([])

    await getGroupFeedPage('g1', null, { type: 'settlement' })

    const [query] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(query).not.toContain('expense_idx')
    expect(query).toContain('settlement_idx')
  })

  it('excludes settlements when a category filter is set, even without an explicit type filter', async () => {
    queryMock.mockResolvedValue([])

    await getGroupFeedPage('g1', null, { category: 'food' })

    const [query] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(query).not.toContain('settlement_idx')
  })

  it('maps the "uncategorized" filter to a NULL check rather than a literal string match', async () => {
    queryMock.mockResolvedValue([])

    await getGroupFeedPage('g1', null, { category: 'uncategorized' })

    const [query, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('e.category IS NULL')
    expect(params).not.toContain('uncategorized')
  })

  it('bounds both expense and settlement date columns when dateFrom/dateTo are set', async () => {
    queryMock.mockResolvedValue([])

    await getGroupFeedPage('g1', null, { dateFrom: '2024-01-01', dateTo: '2024-01-31' })

    const [query, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('e.date >=')
    expect(query).toContain('e.date <=')
    expect(query).toContain('s.created_at::date >=')
    expect(query).toContain('s.created_at::date <=')
    expect(params).toEqual(['g1', '2024-01-01', '2024-01-31', '2024-01-01', '2024-01-31'])
  })

  it('encodes the cursor as a three-column row-value comparison for stable keyset pagination', async () => {
    queryMock.mockResolvedValue([])
    const cursor = { sortDate: '2024-01-05', createdAt: '2024-01-05T10:00:00.000Z', id: 'e5' }

    await getGroupFeedPage('g1', cursor, {})

    const [query, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(query).toMatch(/\(e\.date, e\.created_at, e\.id\) < \(\$\d+, \$\d+, \$\d+\)/)
    expect(query).toMatch(/\(s\.created_at::date, s\.created_at, s\.id\) < \(\$\d+, \$\d+, \$\d+\)/)
    expect(params).toContain(cursor.sortDate)
    expect(params).toContain(cursor.createdAt)
    expect(params).toContain(cursor.id)
  })

  it('returns an empty page without querying when both expenses and settlements are excluded', async () => {
    const page = await getGroupFeedPage('g1', null, { type: 'settlement', category: 'food' })

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false })
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('throws if a hydration batch is missing a row for an id returned by the index query', async () => {
    queryMock.mockResolvedValue([indexRow({ id: 'missing' })])
    feedState.expenseRows = [] // hydration will come back empty

    await expect(getGroupFeedPage('g1', null, {})).rejects.toThrow('missing from feed hydration batch')
  })
})

describe('getGroupFeedCategories', () => {
  it('returns the category column from each row', async () => {
    feedState.categoryRows = [{ category: 'food' }, { category: 'uncategorized' }]

    const result = await getGroupFeedCategories('g1')

    expect(result).toEqual(['food', 'uncategorized'])
  })
})

describe('getGroupFeedCounts', () => {
  it('returns the expense and settlement counts', async () => {
    feedState.countsRow = { expense_count: 5, settlement_count: 2 }

    const result = await getGroupFeedCounts('g1')

    expect(result).toEqual({ expenseCount: 5, settlementCount: 2 })
  })
})

describe('getGroupMembers', () => {
  it('returns the joined member rows', async () => {
    const row = { id: 'gm1', group_id: 'g1', user_id: 'u1', joined_at: '2024-01-01', display_name: 'Alice', avatar_url: null, is_guest: false }
    feedState.memberRows = [row]

    const result = await getGroupMembers('g1')

    expect(result).toEqual([row])
  })
})
