import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimGuest } from './member-actions'

const { neonAuth, ensureUser, revalidatePath, sqlMock, transactionMock, state } = vi.hoisted(() => {
  return {
    neonAuth: vi.fn(),
    ensureUser: vi.fn(),
    revalidatePath: vi.fn(),
    sqlMock: vi.fn(),
    transactionMock: vi.fn(),
    state: { membershipRows: [] as { group_id: string }[] },
  }
})

vi.mock('@/lib/auth/server', () => ({ neonAuth }))
vi.mock('@/lib/ensure-user', () => ({ ensureUser }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/db', () => ({
  sql: Object.assign(sqlMock, { transaction: transactionMock }),
}))

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
  state.membershipRows = [{ group_id: GROUP_ID }]

  sqlMock.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = textOf(strings)
    if (text.includes('SET claim_token = NULL')) {
      return Promise.resolve([{ id: GUEST_ID }])
    }
    if (text.includes('SELECT group_id FROM group_members')) {
      return Promise.resolve(state.membershipRows)
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
