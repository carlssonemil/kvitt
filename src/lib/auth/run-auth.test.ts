import { describe, it, expect } from 'vitest'
import { runAuth } from './run-auth'

describe('runAuth', () => {
  it('returns null when the call succeeds', async () => {
    expect(await runAuth(async () => ({ error: null }))).toBeNull()
  })

  it('returns the error when the call resolves with one', async () => {
    const failure = await runAuth(async () => ({ error: { message: 'Nope', status: 400 } }))
    expect(failure).toEqual({ message: 'Nope', status: 400 })
  })

  // The Neon Auth adapter throws on any non-2xx response instead of returning { error }.
  it('converts a thrown error with a status into a failure', async () => {
    const thrown = Object.assign(new Error('Invalid email or password'), { status: 401 })
    const failure = await runAuth(async () => {
      throw thrown
    })
    expect(failure).toEqual({ message: 'Invalid email or password', status: 401 })
  })

  it('handles a thrown non-Error value', async () => {
    const failure = await runAuth(async () => {
      throw 'boom'
    })
    expect(failure).toEqual({})
  })
})
