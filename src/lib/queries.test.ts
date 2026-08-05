import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getGroupStats } from './queries'

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

const { state, getMultiDateConversions } = vi.hoisted(() => ({
  state: { rows: {
    totalsRows: [] as unknown[],
    yourPaidRows: [] as unknown[],
    yourShareRows: [] as unknown[],
    monthlyRows: [] as unknown[],
    splitRows: [] as unknown[],
    topRows: [] as unknown[],
    categoryRows: [] as unknown[],
  } },
  getMultiDateConversions: vi.fn(),
}))

// Routes each of getGroupStats' 7 parallel queries to its canned rows by matching a
// substring unique to that query's SQL text, so this stays correct regardless of call order.
function sqlTag(strings: TemplateStringsArray) {
  const text = strings.join('')
  if (text.includes('daily_amount')) return Promise.resolve(state.rows.totalsRows)
  if (text.includes('daily_paid')) return Promise.resolve(state.rows.yourPaidRows)
  if (text.includes('daily_share')) return Promise.resolve(state.rows.yourShareRows)
  if (text.includes('to_char')) return Promise.resolve(state.rows.monthlyRows)
  if (text.includes('paid_by AS user_id')) return Promise.resolve(state.rows.splitRows)
  if (text.includes('title_count')) return Promise.resolve(state.rows.topRows)
  if (text.includes('GROUP BY category,')) return Promise.resolve(state.rows.categoryRows)
  throw new Error(`queries.test.ts sql mock: unmatched query: ${text}`)
}

vi.mock('@/lib/db', () => ({ sql: sqlTag }))
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
