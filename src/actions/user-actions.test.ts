import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateProfile, deleteAccount, updateLocale } from './user-actions'

const { neonAuth, ensureUser, revalidatePath, sqlMock, cookieSet } = vi.hoisted(() => ({
  neonAuth: vi.fn(),
  ensureUser: vi.fn(),
  revalidatePath: vi.fn(),
  sqlMock: vi.fn(),
  cookieSet: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({ neonAuth }))
vi.mock('@/lib/ensure-user', () => ({ ensureUser }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ set: cookieSet }) }))

const DB_USER = { id: 'user-1', display_name: 'Me', email: 'me@example.com' }

function textOf(strings: TemplateStringsArray) {
  return strings.join('')
}

beforeEach(() => {
  vi.clearAllMocks()
  neonAuth.mockResolvedValue({ session: {}, user: { email: 'me@example.com', name: 'Me', image: null } })
  ensureUser.mockResolvedValue(DB_USER)
  sqlMock.mockImplementation(() => Promise.resolve([]))
})

describe('updateProfile', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await updateProfile(new FormData())
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('requires a display name', async () => {
    const fd = new FormData()
    fd.set('display_name', '   ')
    const result = await updateProfile(fd)
    expect(result).toEqual({ error: 'Display name is required' })
  })

  it('rejects a display name over 100 characters', async () => {
    const fd = new FormData()
    fd.set('display_name', 'x'.repeat(101))
    const result = await updateProfile(fd)
    expect(result).toEqual({ error: 'Display name is too long' })
  })

  it('updates the display name and revalidates', async () => {
    const fd = new FormData()
    fd.set('display_name', 'New Name')

    const result = await updateProfile(fd)

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE users SET display_name'))
    expect(updateCall?.slice(1)).toEqual(['New Name', 'user-1'])
    expect(revalidatePath).toHaveBeenCalledWith('/profile')
  })

  it('returns a generic error when the update throws', async () => {
    sqlMock.mockImplementation(() => Promise.reject(new Error('connection reset')))
    const fd = new FormData()
    fd.set('display_name', 'New Name')

    const result = await updateProfile(fd)

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' })
  })
})

describe('deleteAccount', () => {
  it('rejects when unauthenticated', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })
    const result = await deleteAccount()
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns an error when the anonymization update matches no row', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes("display_name = 'Deleted user'")) return Promise.resolve([])
      return Promise.resolve([])
    })

    const result = await deleteAccount()

    expect(result).toEqual({ error: 'Account not found' })
  })

  it('anonymizes the user, transfers or deletes owned groups, and removes all memberships', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes("display_name = 'Deleted user'")) return Promise.resolve([{ id: 'user-1' }])
      return Promise.resolve([])
    })

    const result = await deleteAccount()

    expect(result).toEqual({})
    const anonymizeCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes("display_name = 'Deleted user'"))
    expect(anonymizeCall?.slice(1)).toEqual(['me@example.com'])
    const transferCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('SET created_by = ('))
    expect(transferCall?.slice(1)).toEqual(['user-1', 'user-1', 'user-1'])
    const cascadeDeleteCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM groups g'))
    expect(cascadeDeleteCall?.slice(1)).toEqual(['user-1', 'user-1'])
    const membershipDeleteCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('DELETE FROM group_members WHERE user_id'))
    expect(membershipDeleteCall?.slice(1)).toEqual(['user-1'])
  })

  it('returns a generic error when a query throws', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes("display_name = 'Deleted user'")) return Promise.reject(new Error('connection reset'))
      return Promise.resolve([])
    })

    const result = await deleteAccount()

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' })
  })
})

describe('updateLocale', () => {
  it('rejects an invalid locale before touching cookies or the database', async () => {
    const result = await updateLocale('xx' as never)

    expect(result).toEqual({ error: 'Invalid locale' })
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('sets the locale cookie for a valid locale', async () => {
    const result = await updateLocale('en')

    expect(result).toEqual({})
    expect(cookieSet).toHaveBeenCalledWith('kvitt_locale', 'en', expect.objectContaining({ path: '/', sameSite: 'lax' }))
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('persists the locale to the database when authenticated', async () => {
    const result = await updateLocale('en')

    expect(result).toEqual({})
    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE users SET locale'))
    expect(updateCall?.slice(1)).toEqual(['en', 'me@example.com'])
  })

  it('does not touch the database when unauthenticated, but still sets the cookie', async () => {
    neonAuth.mockResolvedValue({ session: null, user: null })

    await updateLocale('en')

    const updateCall = sqlMock.mock.calls.find(([s]) => textOf(s).includes('UPDATE users SET locale'))
    expect(updateCall).toBeUndefined()
    expect(cookieSet).toHaveBeenCalled()
  })

  it('swallows a DB error updating locale and still succeeds (cookie is the source of truth)', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = textOf(strings)
      if (text.includes('UPDATE users SET locale')) return Promise.reject(new Error('connection reset'))
      return Promise.resolve([])
    })

    const result = await updateLocale('en')

    expect(result).toEqual({})
  })
})
