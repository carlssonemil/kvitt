export function computeEqualSplits(amount: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) return {}
  const cents = Math.round(amount * 100)
  const perCents = Math.floor(cents / memberIds.length)
  const remainder = cents - perCents * memberIds.length
  const splits: Record<string, number> = {}
  memberIds.forEach((id, i) => {
    splits[id] = (perCents + (i < remainder ? 1 : 0)) / 100
  })
  return splits
}
