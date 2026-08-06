import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimGuest, joinGroupByInvite, removeMember, addGuest, getGuestClaimLink } from './member-actions'

const { neonAuth, ensureUser, revalidatePath, sqlMock, transactionMock, computeBalances, state } = vi.hoisted(() => {
  return {
    neonAuth: vi.fn(),
    ensureUser: vi.fn(),
    revalidatePath: vi.fn(),
    sqlMock: vi.fn(),
    transactionMock: vi.fn(),
    computeBalances: vi.fn(),
    state: {
      membershipRows: [] as { group_id: string }[],
      inviteGroup: undefined as { id: string } | undefined,
      membershipCheckRows: [{ x: 1 }] as unknown[],
      groupCreator: undefined as { created_by: string; currency: string } | undefined,
      removedMembershipRows: [{ x: 1 }] as unknown[],
      claimTokenRow: undefined as { claim_token: string | null } | undefined,
    },
  }
})

vi.mock('@/lib/auth/server', () => ({ neonAuth }))
vi.mock('@/lib/ensure-user', () => ({ ensureUser }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/db', () => ({
  sql: Object.assign(sqlMock, { transaction: transactionMock }),
}))
vi.mock('@/lib/balance', () => ({ computeBalances }))

const CLAIM_TOKEN = 'claim-token-abc'
const GUEST_ID = 'guest-1'
const REAL_USER_ID = 'real-user-1'
const GROUP_ID = 'group-1'

function textOf(strings: TemplateStringsArray) {
  return strings.join('')
}

beforeEach(() => {
  vi.clearAllMocks()

  neonAuth.mockResolvedValue({ session: {}, user: { email: 'me@example.com', name: 'Me', image: null } })
  ensureUser.mockResolvedValue({ id: REAL_USER_ID })
  transactionMock.mockResolvedValue(undefined)
  computeBalances.mockResolvedValue([])
  state.membershipRows = [{ group_id: GROUP_ID }]

  sqlMock.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = textOf(strings)
    if (text.includes('SET claim_token = NULL') && text.includes('RETURNING id')) {
      return Promise.resolve([{ id: GUEST_ID }])
    }
    if (text.includes('SELECT group_id FROM group_members')) {
      return Promise.resolve(state.membershipRows)
    }
    if (text.includes('SELECT id FROM groups WHERE invite_code')) {
      return Promise.resolve(state.inviteGroup ? [state.inviteGroup] : [])
    }
    if (text.includes('SELECT 1 FROM group_members WHERE group_id')) {
      return Promise.resolve(state.membershipCheckRows)
    }
    if (text.includes('SELECT created_by, currency FROM groups')) {
      return Promise.resolve(state.groupCreator ? [state.groupCreator] : [])
    }
    if (text.includes('RETURNING 1')) {
      return Promise.resolve(state.removedMembershipRows)
    }
    if (text.includes('SELECT u.claim_token')) {
      return Promise.resolve(state.claimTokenRow ? [state.claimTokenRow] : [])
    }
    // claim_token restore, and every statement inside the transaction array literal
    void values
    return Promise.resolve([])
  })
})

describe('claimGuest', () => {
  it('merges the guest into the real user and scopes the membership swap to the guest\'s single group', async () => {
    const result = await claimGuest(CLAIM_TOKEN)

    expect(result).toEqual({ groupId: GROUP_ID })
    expect(transactionMock).toHaveBeenCalledTimes(1)
    const statements = transactionMock.mock.calls[0][0] as unknown[]
    expect(statements).toHaveLength(12)

    // Statements that reassign ownership match on guestId alone, trusting the "one
    // group_members row per guest" invariant rather than filtering by group_id.
    const paidByCall = sqlMock.mock.calls.find(([strings]) => textOf(strings).includes('UPDATE expenses SET paid_by'))
    expect(paidByCall?.slice(1)).toEqual([REAL_USER_ID, GUEST_ID])
    expect(textOf(paidByCall![0] as TemplateStringsArray)).not.toContain('group_id')

    const splitsDeleteCall = sqlMock.mock.calls.find(([strings]) => textOf(strings).includes('DELETE FROM expense_splits WHERE user_id'))
    expect(splitsDeleteCall?.slice(1)).toEqual([GUEST_ID])

    // The membership row itself IS scoped to the specific group, since that's the row being replaced.
    const membershipDeleteCall = sqlMock.mock.calls.find(([strings]) => textOf(strings).includes('DELETE FROM group_members'))
    expect(membershipDeleteCall?.slice(1)).toEqual([GROUP_ID, GUEST_ID])

    expect(revalidatePath).toHaveBeenCalled()
  })

  it('restores the claim token and errors out if the guest has no group_members row', async () => {
    state.membershipRows = []

    const result = await claimGuest(CLAIM_TOKEN)

    expect(result).toEqual({ error: 'Invalid or already-used claim link.' })
    expect(transactionMock).not.toHaveBeenCalled()

    const restoreCall = sqlMock.mock.calls.find(
      ([strings]) => textOf(strings).includes('SET claim_token') && !textOf(strings).includes('NULL'),
    )
    expect(restoreCall?.slice(1)).toEqual([CLAIM_TOKEN, GUEST_ID])
  })
})

describe('joinGroupByInvite', () => {
  beforeEach(() => {
    state.inviteGroup = { id: 'invited-group' }
    state.membershipCheckRows = []
  })

  it('rejects an invalid invite code', async () => {
    state.inviteGroup = undefined

    const result = await joinGroupByInvite('bad-code')

    expect(result).toEqual({ error: 'Invalid invite link.' })
  })

  it('joins the group and revalidates when not already a member', async () => {
    const result = await joinGroupByInvite('good-code')

    expect(result).toEqual({ groupId: 'invited-group' })
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('INSERT INTO group_members'))
    expect(insertCall?.slice(1)).toEqual(['invited-group', REAL_USER_ID])
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('is a no-op when already a member, but still returns the group id', async () => {
    state.membershipCheckRows = [{ x: 1 }]

    const result = await joinGroupByInvite('good-code')

    expect(result).toEqual({ groupId: 'invited-group' })
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('INSERT INTO group_members'))
    expect(insertCall).toBeUndefined()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('removeMember', () => {
  beforeEach(() => {
    state.groupCreator = { created_by: REAL_USER_ID, currency: 'SEK' }
    state.removedMembershipRows = [{ x: 1 }]
  })

  it('rejects when the group does not exist', async () => {
    state.groupCreator = undefined

    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', 'target-user')

    const result = await removeMember(fd)

    expect(result).toEqual({ error: 'Group not found' })
  })

  it('rejects when the caller is not the group creator', async () => {
    state.groupCreator = { created_by: 'someone-else', currency: 'SEK' }

    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', 'target-user')

    const result = await removeMember(fd)

    expect(result).toEqual({ error: 'Only the group creator can remove members' })
  })

  it("rejects removing the group's creator", async () => {
    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', REAL_USER_ID)

    const result = await removeMember(fd)

    expect(result).toEqual({ error: 'Cannot remove the group creator.' })
  })

  it('removes the membership and issues the guarded guest-cleanup delete', async () => {
    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', 'guest-target')

    const result = await removeMember(fd)

    expect(result).toEqual({})
    expect(computeBalances).toHaveBeenCalledWith(GROUP_ID, 'SEK')
    const guestDeleteCall = sqlMock.mock.calls.find(
      ([s]) => textOf(s).includes('NOT EXISTS (SELECT 1 FROM expenses WHERE paid_by')
    )
    expect(guestDeleteCall?.slice(1)).toEqual(Array(6).fill('guest-target'))
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('rejects removal when the member owes money in the group', async () => {
    computeBalances.mockResolvedValue([
      { from_user_id: 'target-user', to_user_id: REAL_USER_ID, amount: 42 },
    ])

    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', 'target-user')

    const result = await removeMember(fd)

    expect(result).toEqual({ error: 'This member has an outstanding balance. Settle up before removing them.' })
    expect(sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM group_members'))).toBeUndefined()
  })

  it('rejects removal when the member is owed money in the group', async () => {
    computeBalances.mockResolvedValue([
      { from_user_id: REAL_USER_ID, to_user_id: 'target-user', amount: 42 },
    ])

    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', 'target-user')

    const result = await removeMember(fd)

    expect(result).toEqual({ error: 'This member has an outstanding balance. Settle up before removing them.' })
  })

  it('returns "Not a member of this group" when the membership row was already gone', async () => {
    state.removedMembershipRows = []

    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('user_id', 'target-user')

    const result = await removeMember(fd)

    expect(result).toEqual({ error: 'Not a member of this group' })
  })
})

describe('addGuest', () => {
  beforeEach(() => {
    state.membershipCheckRows = [{ x: 1 }]
  })

  it('requires a name', async () => {
    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('name', '  ')

    const result = await addGuest(fd)

    expect(result).toEqual({ error: 'Name is required' })
  })

  it('rejects a name over 100 characters', async () => {
    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('name', 'x'.repeat(101))

    const result = await addGuest(fd)

    expect(result).toEqual({ error: 'Name is too long' })
  })

  it('rejects when the caller is not a member of the group', async () => {
    state.membershipCheckRows = []

    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('name', 'Guest')

    const result = await addGuest(fd)

    expect(result).toEqual({ error: 'Not a member of this group' })
  })

  it('creates the guest and membership, then revalidates', async () => {
    const fd = new FormData()
    fd.set('group_id', GROUP_ID)
    fd.set('name', 'Guest')

    const result = await addGuest(fd)

    expect(result).toEqual({})
    const insertCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('new_guest'))
    expect(insertCall?.[1]).toBe('Guest')
    expect(revalidatePath).toHaveBeenCalled()
  })
})

describe('getGuestClaimLink', () => {
  beforeEach(() => {
    state.membershipCheckRows = [{ x: 1 }]
    state.claimTokenRow = undefined
  })

  it('rejects when the caller is not a member of the group', async () => {
    state.membershipCheckRows = []

    const result = await getGuestClaimLink(GROUP_ID, 'member-1')

    expect(result).toEqual({ error: 'Not a member of this group' })
    const guestLookup = sqlMock.mock.calls.find(([s]) => textOf(s).includes('SELECT u.claim_token'))
    expect(guestLookup).toBeUndefined()
  })

  it('returns the same error when the member id does not resolve to a guest', async () => {
    const result = await getGuestClaimLink(GROUP_ID, 'not-a-guest')

    expect(result).toEqual({ error: 'No active claim link for this member' })
  })

  it('returns an error when the member has no active claim token', async () => {
    state.claimTokenRow = { claim_token: null }

    const result = await getGuestClaimLink(GROUP_ID, 'member-1')

    expect(result).toEqual({ error: 'No active claim link for this member' })
  })

  it('returns the active claim token', async () => {
    state.claimTokenRow = { claim_token: 'a-claim-token' }

    const result = await getGuestClaimLink(GROUP_ID, 'member-1')

    expect(result).toEqual({ claimToken: 'a-claim-token' })
  })
})
