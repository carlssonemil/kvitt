import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createExpense, updateExpense, deleteExpense } from './expense-actions'

const { neonAuth, ensureUser, revalidatePath, sqlMock, state } = vi.hoisted(() => ({
  neonAuth: vi.fn(),
  ensureUser: vi.fn(),
  revalidatePath: vi.fn(),
  sqlMock: vi.fn(),
  state: {
    memberships: [{ x: 1 }] as unknown[],
    memberIds: ['payer-1', 'user-1', 'member-2'] as string[],
  },
}))

vi.mock('@/lib/auth/server', () => ({ neonAuth }))
vi.mock('@/lib/ensure-user', () => ({ ensureUser }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))

const DB_USER = { id: 'user-1', display_name: 'Me', email: 'me@example.com' }

function textOf(strings: TemplateStringsArray) {
  return strings.join('')
}

function formData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    group_id: 'group-1',
    title: 'Dinner',
    amount: '30',
    currency: 'EUR',
    paid_by: 'payer-1',
    date: '2024-01-01',
    note: '',
    category: '',
    splits: JSON.stringify({ 'payer-1': 15, 'member-2': 15 }),
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
  state.memberships = [{ x: 1 }]
  state.memberIds = ['payer-1', 'user-1', 'member-2']

  sqlMock.mockImplementation((strings: TemplateStringsArray) => {
    const text = textOf(strings)
    if (text.includes('SELECT 1 FROM group_members')) return Promise.resolve(state.memberships)
    if (text.includes('SELECT user_id FROM group_members')) {
      return Promise.resolve(state.memberIds.map(user_id => ({ user_id })))
    }
    if (text.includes('INSERT INTO expenses')) return Promise.resolve([{ id: 'expense-1' }])
    return Promise.resolve([])
  })
})

describe('createExpense', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })

    const result = await createExpense(formData())

    expect(result).toEqual({ error: 'Not authenticated' })
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it('requires a title', async () => {
    const result = await createExpense(formData({ title: '  ' }))
    expect(result).toEqual({ error: 'Title is required' })
  })

  it('requires a positive amount', async () => {
    expect(await createExpense(formData({ amount: '0' }))).toEqual({ error: 'Amount must be greater than 0' })
    expect(await createExpense(formData({ amount: 'abc' }))).toEqual({ error: 'Amount must be greater than 0' })
  })

  it('requires a payer', async () => {
    const result = await createExpense(formData({ paid_by: '' }))
    expect(result).toEqual({ error: 'Payer is required' })
  })

  it('requires a date', async () => {
    const result = await createExpense(formData({ date: '' }))
    expect(result).toEqual({ error: 'Date is required' })
  })

  it('rejects malformed split JSON', async () => {
    const result = await createExpense(formData({ splits: '{not json' }))
    expect(result).toEqual({ error: 'Invalid split data' })
  })

  it('requires at least one member with a positive split amount', async () => {
    const result = await createExpense(formData({ splits: JSON.stringify({ 'payer-1': 0, 'member-2': -5 }) }))
    expect(result).toEqual({ error: 'At least one member must be in the split' })
  })

  it('rejects when the split total does not match the expense amount beyond tolerance', async () => {
    const result = await createExpense(formData({
      amount: '30',
      splits: JSON.stringify({ 'payer-1': 15, 'member-2': 14.9 }), // off by 0.1, > 0.02 tolerance
    }))
    expect(result).toEqual({ error: 'Split total (29.90) must equal expense amount (30.00)' })
  })

  it('accepts a split total within the 0.02 tolerance of the amount', async () => {
    const result = await createExpense(formData({
      amount: '30',
      splits: JSON.stringify({ 'payer-1': 15, 'member-2': 14.99 }), // off by 0.01
    }))
    expect(result).toEqual({})
  })

  it('rejects when the caller is not a member of the group', async () => {
    state.memberships = []
    const result = await createExpense(formData())
    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('rejects an unsupported currency', async () => {
    const result = await createExpense(formData({ currency: 'XXX' }))
    expect(result).toEqual({ error: 'Invalid currency' })
  })

  it('rejects when the payer is not a group member', async () => {
    const result = await createExpense(formData({ paid_by: 'outsider' }))
    expect(result).toEqual({ error: 'Payer is not a member of this group' })
  })

  it('rejects when a split entry is not a group member', async () => {
    const result = await createExpense(formData({
      splits: JSON.stringify({ 'payer-1': 15, outsider: 15 }),
    }))
    expect(result).toEqual({ error: 'Split includes users who are not members of this group' })
  })

  it('inserts the expense and one split row per entry, then revalidates', async () => {
    const result = await createExpense(formData({
      splits: JSON.stringify({ 'payer-1': 10, 'member-2': 20 }),
      amount: '30',
    }))

    expect(result).toEqual({})
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('INSERT INTO expenses'))
    expect(insertCall?.slice(1)).toEqual(['group-1', 'payer-1', 'Dinner', 30, 'EUR', '2024-01-01', null, null, 'user-1'])
    const splitInserts = sqlMock.mock.calls.filter(([s]) => textOf(s).includes('INSERT INTO expense_splits'))
    expect(splitInserts).toHaveLength(2)
    expect(splitInserts.map(call => call.slice(1))).toEqual([
      ['expense-1', 'payer-1', 10],
      ['expense-1', 'member-2', 20],
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })

  it('returns a generic error and does not leak DB errors when a query throws', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes('SELECT 1 FROM group_members')) return Promise.resolve(state.memberships)
      if (text.includes('SELECT user_id FROM group_members')) {
        return Promise.resolve(state.memberIds.map(user_id => ({ user_id })))
      }
      if (text.includes('INSERT INTO expenses')) return Promise.reject(new Error('connection reset'))
      return Promise.resolve([])
    })

    const result = await createExpense(formData())

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' })
  })
})

describe('updateExpense', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await updateExpense(formData({ expense_id: 'expense-1' }))
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('reuses the same validation as createExpense', async () => {
    const result = await updateExpense(formData({ expense_id: 'expense-1', title: '' }))
    expect(result).toEqual({ error: 'Title is required' })
  })

  it('scopes the update and split replacement to the given expense within the group, then revalidates', async () => {
    const result = await updateExpense(formData({ expense_id: 'expense-1' }))

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE expenses'))
    expect(updateCall?.slice(1)).toEqual(['Dinner', 30, 'EUR', 'payer-1', '2024-01-01', null, null, 'expense-1', 'group-1'])
    const deleteCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM expense_splits'))
    expect(deleteCall?.slice(1)).toEqual(['expense-1'])
    const splitInserts = sqlMock.mock.calls.filter(([s]) => textOf(s).includes('INSERT INTO expense_splits'))
    expect(splitInserts).toHaveLength(2)
    expect(splitInserts.map(call => call.slice(1))).toEqual([
      ['expense-1', 'payer-1', 15],
      ['expense-1', 'member-2', 15],
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })
})

describe('deleteExpense', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await deleteExpense(formData({ expense_id: 'expense-1' }))
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('rejects when the caller is not a member of the group', async () => {
    state.memberships = []
    const result = await deleteExpense(formData({ expense_id: 'expense-1' }))
    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('deletes the expense scoped to the group and revalidates', async () => {
    const result = await deleteExpense(formData({ expense_id: 'expense-1' }))

    expect(result).toEqual({})
    const deleteCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM expenses'))
    expect(deleteCall?.slice(1)).toEqual(['expense-1', 'group-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })
})
