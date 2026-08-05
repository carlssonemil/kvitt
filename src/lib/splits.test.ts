import { describe, it, expect } from 'vitest'
import { computeEqualSplits } from './splits'

describe('computeEqualSplits', () => {
  it('divides evenly when the amount splits cleanly', () => {
    expect(computeEqualSplits(30, ['a', 'b', 'c'])).toEqual({ a: 10, b: 10, c: 10 })
  })

  it('distributes the remainder cent-by-cent to the first members', () => {
    // 10 / 3 = 3.33.. -> 1000 cents / 3 = 333 + 1 remainder cent
    expect(computeEqualSplits(10, ['a', 'b', 'c'])).toEqual({ a: 3.34, b: 3.33, c: 3.33 })
  })

  it('gives the full amount to a single member', () => {
    expect(computeEqualSplits(42.5, ['solo'])).toEqual({ solo: 42.5 })
  })

  it('returns an empty object for an empty member list', () => {
    expect(computeEqualSplits(100, [])).toEqual({})
  })

  it('spreads a larger remainder across as many members as needed', () => {
    // 100 / 3 = 3333.33.. cents -> 3333 + 1 remainder cent across 3 members... exercise 7 members instead
    expect(computeEqualSplits(10, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual({
      a: 1.43,
      b: 1.43,
      c: 1.43,
      d: 1.43,
      e: 1.43,
      f: 1.43,
      g: 1.42,
    })
  })
})
