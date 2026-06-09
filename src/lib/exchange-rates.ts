// Fetches exchange rates from frankfurter.app (free, no API key needed).
// Live rates are cached by Next.js fetch for 1 hour.
// Historical rates are cached indefinitely (they never change).

async function getRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json() as { rates: Record<string, number> }
    // Include EUR itself (rate = 1 relative to EUR)
    return { ...data.rates, EUR: 1 }
  } catch {
    return null
  }
}

async function getRatesForDate(date: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=EUR`, {
      cache: 'force-cache',
    })
    if (!res.ok) return null
    const data = await res.json() as { rates: Record<string, number> }
    return { ...data.rates, EUR: 1 }
  } catch {
    return null
  }
}

/**
 * Converts `amount` from one currency to another using live rates.
 * Returns null if rates are unavailable or the currency pair is unsupported.
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<number | null> {
  if (from === to) return amount
  const rates = await getRates()
  if (!rates) return null
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) return null
  return Math.round((amount / fromRate) * toRate * 100) / 100
}

/**
 * Returns a map of conversion rates from `baseCurrency` to all other currencies.
 * E.g. { EUR: 0.087, USD: 0.095, ... } meaning 1 SEK = X EUR.
 * Returns null if rates are unavailable.
 */
export async function getConversionsFrom(
  baseCurrency: string,
): Promise<Record<string, number> | null> {
  const rates = await getRates()
  if (!rates) return null
  const baseRate = rates[baseCurrency]
  if (!baseRate) return null
  const result: Record<string, number> = {}
  for (const [currency, rate] of Object.entries(rates)) {
    result[currency] = rate / baseRate
  }
  return result
}

/**
 * Fetches historical conversion rates for multiple dates in parallel.
 * Returns a Map from date string (YYYY-MM-DD) to conversion ratios relative to baseCurrency.
 * Historical rates are cached indefinitely since they never change.
 */
export async function getMultiDateConversions(
  baseCurrency: string,
  dates: string[],
): Promise<Map<string, Record<string, number>>> {
  const uniqueDates = [...new Set(dates)]
  const entries = await Promise.all(
    uniqueDates.map(async (date) => {
      const rates = await getRatesForDate(date)
      if (!rates) return null
      const baseRate = rates[baseCurrency]
      if (!baseRate) return null
      const conversions: Record<string, number> = {}
      for (const [currency, rate] of Object.entries(rates)) {
        conversions[currency] = rate / baseRate
      }
      return [date, conversions] as const
    })
  )
  return new Map(entries.filter((e): e is [string, Record<string, number>] => e !== null))
}
