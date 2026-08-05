import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildBalances } from './balance'

const { getMultiDateConversions } = vi.hoisted(() => ({
  getMultiDateConversions: vi.fn(),
}))

vi.mock('@/lib/exchange-rates', () => ({ getMultiDateConversions }))
vi.mock('@/lib/db', () => ({ sql: vi.fn() }))

function debt(overrides: Partial<Parameters<typeof buildBalances>[0][number]> = {}) {
  return {
    group_id: 'g1',
    from_user_id: 'alice',
    from_user_name: 'Alice',
    to_user_id: 'bob',
    to_user_name: 'Bob',
    amount: 10,
    currency: 'EUR',
    date: '2024-01-01',
    expense_title: 'Dinner',
    ...overrides,
  }
}

function settlement(overrides: Partial<Parameters<typeof buildBalances>[1][number]> = {}) {
  return {
    group_id: 'g1',
    paid_by: 'alice',
    paid_to: 'bob',
    amount: 5,
    currency: 'EUR',
    date: '2024-01-02',
    ...overrides,
  }
}

describe('buildBalances', () => {
  beforeEach(() => {
    getMultiDateConversions.mockReset()
  })

  it('produces a single balance for a single same-currency debt', async () => {
    const balances = await buildBalances([debt({ amount: 10 })], [], 'EUR')

    expect(balances).toHaveLength(1)
    expect(balances[0]).toMatchObject({
      from_user_id: 'alice',
      to_user_id: 'bob',
      amount: 10,
      currency: 'EUR',
    })
    expect(balances[0].breakdown).toEqual([
      { expense_title: 'Dinner', amount: 10, currency: 'EUR', convertedAmount: undefined, conversionFailed: undefined },
    ])
  })

  it('aggregates multiple expenses between the same debtor and creditor', async () => {
    const balances = await buildBalances(
      [
        debt({ amount: 10, expense_title: 'Dinner' }),
        debt({ amount: 15, expense_title: 'Groceries' }),
      ],
      [],
      'EUR',
    )

    expect(balances).toHaveLength(1)
    expect(balances[0].amount).toBe(25)
    expect(balances[0].breakdown).toHaveLength(2)
  })

  it('subtracts a settlement from the outstanding debt', async () => {
    const balances = await buildBalances(
      [debt({ amount: 10 })],
      [settlement({ amount: 4 })],
      'EUR',
    )

    expect(balances).toHaveLength(1)
    expect(balances[0].amount).toBe(6)
  })

  it('drops the balance once a settlement covers the full debt (and beyond)', async () => {
    const balances = await buildBalances(
      [debt({ amount: 10 })],
      [settlement({ amount: 15 })],
      'EUR',
    )

    expect(balances).toEqual([])
  })

  it('drops balances that round to <= 0.005', async () => {
    const balances = await buildBalances(
      [debt({ amount: 10 })],
      [settlement({ amount: 9.996 })],
      'EUR',
    )

    expect(balances).toEqual([])
  })

  it('converts a foreign-currency debt into the group currency using the historical rate', async () => {
    getMultiDateConversions.mockResolvedValue(new Map([['2024-01-01', { USD: 0.5 }]]))

    const balances = await buildBalances(
      [debt({ amount: 10, currency: 'USD', date: '2024-01-01' })],
      [],
      'EUR',
    )

    expect(getMultiDateConversions).toHaveBeenCalledWith('EUR', ['2024-01-01'])
    expect(balances).toHaveLength(1)
    expect(balances[0].amount).toBe(20) // 10 / 0.5
    expect(balances[0].currency).toBe('EUR')
    expect(balances[0].breakdown[0]).toMatchObject({
      amount: 10,
      currency: 'USD',
      convertedAmount: 20,
    })
    expect(balances[0].hasConversionWarning).toBeUndefined()
  })

  it('falls back to the raw amount and flags a warning when a rate is missing', async () => {
    getMultiDateConversions.mockResolvedValue(new Map()) // no rate for the date at all

    const balances = await buildBalances(
      [debt({ amount: 10, currency: 'USD', date: '2024-01-01' })],
      [],
      'EUR',
    )

    expect(balances).toHaveLength(1)
    expect(balances[0].amount).toBe(10) // raw amount, no conversion applied
    expect(balances[0].hasConversionWarning).toBe(true)
    expect(balances[0].breakdown[0]).toMatchObject({
      conversionFailed: true,
      convertedAmount: undefined,
    })
  })

  it('nets mutual debts between the same pair down to a single directional balance', async () => {
    const balances = await buildBalances(
      [
        debt({ from_user_id: 'alice', to_user_id: 'bob', amount: 30, expense_title: 'Rent' }),
        debt({ from_user_id: 'bob', to_user_id: 'alice', amount: 10, expense_title: 'Taxi' }),
      ],
      [],
      'EUR',
    )

    expect(balances).toHaveLength(1)
    expect(balances[0]).toMatchObject({
      from_user_id: 'alice',
      to_user_id: 'bob',
      amount: 20,
      offset: 10,
    })
    expect(balances[0].offsetBreakdown).toHaveLength(1)
    expect(balances[0].offsetBreakdown?.[0]).toMatchObject({ expense_title: 'Taxi' })
  })
})
