// Fetches exchange rates from frankfurter.app (free, no API key needed).
// Rates are cached by Next.js fetch for 1 hour.

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
