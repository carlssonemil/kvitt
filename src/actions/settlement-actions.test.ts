import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSettlement, updateSettlement, deleteSettlement } from './settlement-actions'

const { neonAuth, ensureUser, revalidatePath, sqlMock, computeBalances, convertCurrency, state } = vi.hoisted(() => ({
  neonAuth: vi.fn(),
  ensureUser: vi.fn(),
  revalidatePath: vi.fn(),
  sqlMock: vi.fn(),
  computeBalances: vi.fn(),
  convertCurrency: vi.fn(),
  state: {
    group: { currency: 'EUR' } as { currency: string } | undefined,
    memberIds: ['payer-1', 'payee-1'] as string[],
  },
}))

vi.mock('@/lib/auth/server', () => ({ neonAuth }))
vi.mock('@/lib/ensure-user', () => ({ ensureUser }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/balance', () => ({ computeBalances }))
vi.mock('@/lib/exchange-rates', () => ({ convertCurrency }))

const DB_USER = { id: 'user-1', display_name: 'Me', email: 'me@example.com' }

function textOf(strings: TemplateStringsArray) {
  return strings.join('')
}

function formData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    group_id: 'group-1',
    paid_by: 'payer-1',
    paid_to: 'payee-1',
    amount: '20',
    currency: 'EUR',
    note: '',
  }
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(key, value)
  }
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  neonAuth.mockResolvedValue({ session: {}, user: { email: 'me@example.com', name: 'Me', image: null } })
  ensureUser.mockResolvedValue(DB_USER)
  computeBalances.mockResolvedValue([
    { from_user_id: 'payer-1', to_user_id: 'payee-1', amount: 50, currency: 'EUR' },
  ])
  convertCurrency.mockResolvedValue(null)
  state.group = { currency: 'EUR' }
  state.memberIds = ['payer-1', 'payee-1']

  sqlMock.mockImplementation((strings: TemplateStringsArray) => {
    const text = textOf(strings)
    if (text.includes('SELECT g.currency FROM groups g')) {
      return Promise.resolve(state.group ? [state.group] : [])
    }
    if (text.includes('SELECT user_id FROM group_members')) {
      return Promise.resolve(state.memberIds.map(user_id => ({ user_id })))
    }
    return Promise.resolve([])
  })
})

describe('createSettlement', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await createSettlement(formData())
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('rejects settling with yourself', async () => {
    const result = await createSettlement(formData({ paid_to: 'payer-1' }))
    expect(result).toEqual({ error: 'Cannot settle with yourself' })
  })

  it('requires a positive amount', async () => {
    expect(await createSettlement(formData({ amount: '0' }))).toEqual({ error: 'Amount must be greater than 0' })
    expect(await createSettlement(formData({ amount: 'nope' }))).toEqual({ error: 'Amount must be greater than 0' })
  })

  it('rejects when the caller is not a member of the group', async () => {
    state.group = undefined
    const result = await createSettlement(formData())
    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('rejects an unsupported currency', async () => {
    const result = await createSettlement(formData({ currency: 'XXX' }))
    expect(result).toEqual({ error: 'Invalid currency' })
  })

  it('rejects a payer who is not a group member', async () => {
    const result = await createSettlement(formData({ paid_by: 'outsider' }))
    expect(result).toEqual({ error: 'Payer is not a member of this group' })
  })

  it('rejects a recipient who is not a group member', async () => {
    const result = await createSettlement(formData({ paid_to: 'outsider' }))
    expect(result).toEqual({ error: 'Recipient is not a member of this group' })
  })

  it('accepts a same-currency settlement within the outstanding balance plus the 0.01 tolerance', async () => {
    const result = await createSettlement(formData({ amount: '50.01', currency: 'EUR' }))
    expect(result).toEqual({})
  })

  it('rejects a same-currency settlement that exceeds the outstanding balance', async () => {
    const result = await createSettlement(formData({ amount: '50.02', currency: 'EUR' }))
    expect(result).toEqual({ error: 'This settlement exceeds the 50.00 EUR currently owed between these two people.' })
  })

  it('rejects when there is no outstanding balance between the two people at all', async () => {
    computeBalances.mockResolvedValue([])
    const result = await createSettlement(formData({ amount: '1' }))
    expect(result).toEqual({ error: 'This settlement exceeds the 0.00 EUR currently owed between these two people.' })
  })

  it('converts a foreign-currency settlement and applies the wider 2% tolerance', async () => {
    convertCurrency.mockResolvedValue(51) // 50 + max(0.01, 50*0.02)=1 tolerance -> boundary, still passes
    const result = await createSettlement(formData({ amount: '60', currency: 'USD' }))
    expect(convertCurrency).toHaveBeenCalledWith(60, 'USD', 'EUR')
    expect(result).toEqual({})
  })

  it('rejects a foreign-currency settlement that converts to more than outstanding plus the 2% tolerance', async () => {
    convertCurrency.mockResolvedValue(51.01)
    const result = await createSettlement(formData({ amount: '60', currency: 'USD' }))
    expect(result).toEqual({ error: 'This settlement exceeds the 50.00 EUR currently owed between these two people.' })
  })

  it('rejects with a currency-unavailable error instead of silently accepting the raw amount when conversion fails', async () => {
    convertCurrency.mockResolvedValue(null)
    const result = await createSettlement(formData({ amount: '10', currency: 'USD' }))
    expect(result).toEqual({ error: 'Unable to verify the exchange rate right now. Please try again.' })
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('INSERT INTO settlements'))
    expect(insertCall).toBeUndefined()
  })

  it('inserts the settlement and revalidates on success', async () => {
    const result = await createSettlement(formData({ amount: '10' }))

    expect(result).toEqual({})
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('INSERT INTO settlements'))
    expect(insertCall?.slice(1)).toEqual(['group-1', 'payer-1', 'payee-1', 10, 'EUR', null])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })

  it('returns a generic error when a query throws', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes('SELECT g.currency FROM groups g')) return Promise.resolve([state.group])
      if (text.includes('SELECT user_id FROM group_members')) {
        return Promise.resolve(state.memberIds.map(user_id => ({ user_id })))
      }
      if (text.includes('INSERT INTO settlements')) return Promise.reject(new Error('connection reset'))
      return Promise.resolve([])
    })

    const result = await createSettlement(formData({ amount: '10' }))

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' })
  })
})

describe('updateSettlement', () => {
  it("excludes its own settlement id from the outstanding-balance check", async () => {
    await updateSettlement(formData({ settlement_id: 'settlement-1', amount: '10' }))

    expect(computeBalances).toHaveBeenCalledWith('group-1', 'EUR', 'settlement-1')
  })

  it('scopes the update to the given settlement within the group, then revalidates', async () => {
    const result = await updateSettlement(formData({ settlement_id: 'settlement-1', amount: '10' }))

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE settlements'))
    expect(updateCall?.slice(1)).toEqual(['payer-1', 'payee-1', 10, 'EUR', null, 'settlement-1', 'group-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })
})

describe('deleteSettlement', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await deleteSettlement(formData({ settlement_id: 'settlement-1' }))
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('rejects when the caller is not a member of the group', async () => {
    sqlMock.mockImplementation(() => Promise.resolve([]))
    const result = await deleteSettlement(formData({ settlement_id: 'settlement-1' }))
    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('deletes the settlement scoped to the group and revalidates', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes('SELECT 1 FROM group_members')) return Promise.resolve([{ x: 1 }])
      return Promise.resolve([])
    })

    const result = await deleteSettlement(formData({ settlement_id: 'settlement-1' }))

    expect(result).toEqual({})
    const deleteCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM settlements'))
    expect(deleteCall?.slice(1)).toEqual(['settlement-1', 'group-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })
})
