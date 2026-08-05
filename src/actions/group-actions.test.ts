import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createGroup, updateGroup, deleteGroup, hideGroup, unhideGroup,
  regenerateInviteCode, getGroupStatsAction, getGroupFeedAction,
} from './group-actions'

const { neonAuth, ensureUser, revalidatePath, sqlMock, getGroupStats, getGroupFeedPage, state } = vi.hoisted(() => ({
  neonAuth: vi.fn(),
  ensureUser: vi.fn(),
  revalidatePath: vi.fn(),
  sqlMock: vi.fn(),
  getGroupStats: vi.fn(),
  getGroupFeedPage: vi.fn(),
  state: {
    group: { created_by: 'user-1' } as { created_by: string } | undefined,
    groupWithCurrency: { currency: 'EUR' } as { currency: string } | undefined,
    membership: { x: 1 } as unknown,
  },
}))

vi.mock('@/lib/auth/server', () => ({ neonAuth }))
vi.mock('@/lib/ensure-user', () => ({ ensureUser }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/queries', () => ({ getGroupStats, getGroupFeedPage }))

const DB_USER = { id: 'user-1', display_name: 'Me', email: 'me@example.com' }

function textOf(strings: TemplateStringsArray) {
  return strings.join('')
}

beforeEach(() => {
  vi.clearAllMocks()
  neonAuth.mockResolvedValue({ session: {}, user: { email: 'me@example.com', name: 'Me', image: null } })
  ensureUser.mockResolvedValue(DB_USER)
  state.group = { created_by: 'user-1' }
  state.groupWithCurrency = { currency: 'EUR' }
  state.membership = { x: 1 }

  sqlMock.mockImplementation((strings: TemplateStringsArray) => {
    const text = textOf(strings)
    if (text.includes('SELECT created_by FROM groups')) {
      return Promise.resolve(state.group ? [state.group] : [])
    }
    if (text.includes('SELECT g.currency FROM groups g')) {
      return Promise.resolve(state.groupWithCurrency ? [state.groupWithCurrency] : [])
    }
    if (text.includes('SELECT 1 FROM group_members')) {
      return Promise.resolve(state.membership ? [state.membership] : [])
    }
    return Promise.resolve([])
  })
})

function groupFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const defaults = { group_id: 'group-1', name: 'Trip', description: '', currency: 'EUR' }
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value)
  return fd
}

describe('createGroup', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await createGroup(groupFormData())
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('requires a name', async () => {
    const result = await createGroup(groupFormData({ name: '  ' }))
    expect(result).toEqual({ error: 'Group name is required' })
  })

  it('rejects a name over 100 characters', async () => {
    const result = await createGroup(groupFormData({ name: 'x'.repeat(101) }))
    expect(result).toEqual({ error: 'Group name is too long' })
  })

  it('rejects an unsupported currency', async () => {
    const result = await createGroup(groupFormData({ currency: 'XXX' }))
    expect(result).toEqual({ error: 'Invalid currency' })
  })

  it('creates the group and membership, then revalidates', async () => {
    const result = await createGroup(groupFormData())

    expect(result).toEqual({})
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('INSERT INTO groups'))
    expect(insertCall?.slice(1, 4)).toEqual(['Trip', null, 'EUR'])
    expect(insertCall?.[4]).toBe('user-1')
    expect(insertCall?.[5]).toHaveLength(12)
    expect(revalidatePath).toHaveBeenCalledWith('/groups')
  })
})

describe('updateGroup', () => {
  it('requires a name', async () => {
    const result = await updateGroup(groupFormData({ name: '' }))
    expect(result).toEqual({ error: 'Group name is required' })
  })

  it('rejects an unsupported currency', async () => {
    const result = await updateGroup(groupFormData({ currency: 'XXX' }))
    expect(result).toEqual({ error: 'Invalid currency' })
  })

  it('rejects when the group does not exist', async () => {
    state.group = undefined
    const result = await updateGroup(groupFormData())
    expect(result).toEqual({ error: 'Group not found' })
  })

  it('rejects when the caller did not create the group', async () => {
    state.group = { created_by: 'someone-else' }
    const result = await updateGroup(groupFormData())
    expect(result).toEqual({ error: 'Only the group creator can update settings' })
  })

  it('updates the group and revalidates when the caller is the creator', async () => {
    const result = await updateGroup(groupFormData({ name: 'New name' }))

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE groups SET name'))
    expect(updateCall?.slice(1)).toEqual(['New name', null, 'EUR', 'group-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })
})

describe('deleteGroup', () => {
  it('rejects when the group does not exist', async () => {
    state.group = undefined
    const result = await deleteGroup(groupFormData())
    expect(result).toEqual({ error: 'Group not found' })
  })

  it('rejects when the caller did not create the group', async () => {
    state.group = { created_by: 'someone-else' }
    const result = await deleteGroup(groupFormData())
    expect(result).toEqual({ error: 'Only the group creator can delete this group' })
  })

  it('deletes the group and revalidates when the caller is the creator', async () => {
    const result = await deleteGroup(groupFormData())

    expect(result).toEqual({})
    const deleteCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM groups'))
    expect(deleteCall?.slice(1)).toEqual(['group-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups')
  })
})

describe('hideGroup / unhideGroup', () => {
  it('hideGroup sets hidden_at and revalidates both the groups list and the group page', async () => {
    const result = await hideGroup('group-1')

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('SET hidden_at = now()'))
    expect(updateCall?.slice(1)).toEqual(['group-1', 'user-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups')
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })

  it('unhideGroup clears hidden_at and revalidates both pages', async () => {
    const result = await unhideGroup('group-1')

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('SET hidden_at = NULL'))
    expect(updateCall?.slice(1)).toEqual(['group-1', 'user-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/groups')
    expect(revalidatePath).toHaveBeenCalledWith('/groups/group-1')
  })
})

describe('regenerateInviteCode', () => {
  it('rejects when the caller did not create the group', async () => {
    state.group = { created_by: 'someone-else' }
    const result = await regenerateInviteCode('group-1')
    expect(result).toEqual({ error: 'Only the group creator can regenerate the invite code' })
  })

  it('generates and persists a new invite code for the creator', async () => {
    const result = await regenerateInviteCode('group-1')

    expect(result.error).toBeUndefined()
    expect(result.inviteCode).toHaveLength(12)
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE groups SET invite_code'))
    expect(updateCall?.slice(1)).toEqual([result.inviteCode, 'group-1'])
  })
})

describe('getGroupStatsAction', () => {
  it('rejects when the caller is not a member of the group', async () => {
    state.groupWithCurrency = undefined
    const result = await getGroupStatsAction('group-1')
    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('fetches stats using the group currency', async () => {
    getGroupStats.mockResolvedValue({ total_amount: 42 })

    const result = await getGroupStatsAction('group-1')

    expect(getGroupStats).toHaveBeenCalledWith('group-1', 'user-1', 'EUR')
    expect(result).toEqual({ stats: { total_amount: 42 } })
  })
})

describe('getGroupFeedAction', () => {
  it('rejects an invalid cursor shape', async () => {
    const result = await getGroupFeedAction('group-1', { sortDate: '2024-01-01' } as never, {})
    expect(result).toEqual({ error: 'Invalid cursor' })
    expect(getGroupFeedPage).not.toHaveBeenCalled()
  })

  it('accepts a null cursor', async () => {
    getGroupFeedPage.mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
    const result = await getGroupFeedAction('group-1', null, {})
    expect(result.error).toBeUndefined()
  })

  it('rejects a filter type outside expense/settlement', async () => {
    const result = await getGroupFeedAction('group-1', null, { type: 'refund' } as never)
    expect(result).toEqual({ error: 'Invalid filter' })
  })

  it('rejects an unknown category key', async () => {
    const result = await getGroupFeedAction('group-1', null, { category: 'not-a-real-category' })
    expect(result).toEqual({ error: 'Invalid filter' })
  })

  it('accepts the "uncategorized" category', async () => {
    getGroupFeedPage.mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
    const result = await getGroupFeedAction('group-1', null, { category: 'uncategorized' })
    expect(result.error).toBeUndefined()
  })

  it('rejects a malformed date filter', async () => {
    const result = await getGroupFeedAction('group-1', null, { dateFrom: '01-01-2024' })
    expect(result).toEqual({ error: 'Invalid filter' })
  })

  it('rejects dateFrom after dateTo', async () => {
    const result = await getGroupFeedAction('group-1', null, { dateFrom: '2024-02-01', dateTo: '2024-01-01' })
    expect(result).toEqual({ error: 'Invalid filter' })
  })

  it('rejects a non-member', async () => {
    state.membership = undefined
    const result = await getGroupFeedAction('group-1', null, {})
    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('delegates to getGroupFeedPage and returns its page for valid input', async () => {
    const page = { items: [], nextCursor: null, hasMore: false }
    getGroupFeedPage.mockResolvedValue(page)

    const result = await getGroupFeedAction('group-1', null, { type: 'expense' })

    expect(getGroupFeedPage).toHaveBeenCalledWith('group-1', null, { type: 'expense' })
    expect(result).toEqual({ page })
  })
})
