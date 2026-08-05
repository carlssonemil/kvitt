import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureUser } from './ensure-user'

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))

describe('ensureUser', () => {
  beforeEach(() => {
    sqlMock.mockReset()
  })

  it('passes the given display name through when present', async () => {
    sqlMock.mockResolvedValue([{ id: 'u1', display_name: 'Alice', email: 'alice@example.com' }])

    await ensureUser({ email: 'alice@example.com', name: 'Alice', image: null })

    const values = sqlMock.mock.calls[0].slice(1)
    expect(values).toEqual(['Alice', 'alice@example.com', null])
  })

  it('falls back to the local part of the email when name is null', async () => {
    sqlMock.mockResolvedValue([{ id: 'u1', display_name: 'bob', email: 'bob@example.com' }])

    await ensureUser({ email: 'bob@example.com', name: null, image: null })

    const values = sqlMock.mock.calls[0].slice(1)
    expect(values).toEqual(['bob', 'bob@example.com', null])
  })

  it('returns the upserted row', async () => {
    const row = { id: 'u1', display_name: 'Alice', email: 'alice@example.com' }
    sqlMock.mockResolvedValue([row])

    const result = await ensureUser({ email: 'alice@example.com', name: 'Alice', image: null })

    expect(result).toBe(row)
  })
})
