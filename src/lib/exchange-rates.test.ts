import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { convertCurrency, getConversionsFrom, getMultiDateConversions } from './exchange-rates'

function jsonResponse(rates: Record<string, number>, ok = true) {
  return { ok, json: async () => ({ rates }) }
}

describe('exchange-rates', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('convertCurrency', () => {
    it('returns the amount unchanged when from and to currencies match, without calling fetch', async () => {
      const result = await convertCurrency(42, 'EUR', 'EUR')
      expect(result).toBe(42)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('converts using the cross-rate between two non-EUR currencies', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ USD: 1.1, SEK: 11 }))
      const result = await convertCurrency(10, 'USD', 'SEK')
      // 10 USD -> EUR: 10/1.1, -> SEK: *11 = 100.00
      expect(result).toBe(100)
    })

    it('returns null when the upstream response is not ok', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false))
      const result = await convertCurrency(10, 'USD', 'SEK')
      expect(result).toBeNull()
    })

    it('returns null when a requested currency is missing from the rates map', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ USD: 1.1 })) // no SEK
      const result = await convertCurrency(10, 'USD', 'SEK')
      expect(result).toBeNull()
    })

    it('returns null when fetch throws (network error or timeout)', async () => {
      fetchMock.mockRejectedValue(new Error('network error'))
      const result = await convertCurrency(10, 'USD', 'SEK')
      expect(result).toBeNull()
    })
  })

  describe('getConversionsFrom', () => {
    it('returns rates relative to the given base currency, including the base itself at 1', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ USD: 1.1, SEK: 11 }))
      const result = await getConversionsFrom('USD')
      expect(result).toEqual({
        EUR: 1 / 1.1,
        USD: 1,
        SEK: 11 / 1.1,
      })
    })

    it('returns null when rates are unavailable', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false))
      const result = await getConversionsFrom('USD')
      expect(result).toBeNull()
    })

    it('returns null when the base currency is unsupported', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ USD: 1.1 }))
      const result = await getConversionsFrom('XXX')
      expect(result).toBeNull()
    })
  })

  describe('getMultiDateConversions', () => {
    it('returns an empty map when given no dates, without calling fetch', async () => {
      const result = await getMultiDateConversions('EUR', [])
      expect(result).toEqual(new Map())
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('fetches once per unique date, deduping repeats', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ USD: 1.1 }))
      await getMultiDateConversions('EUR', ['2024-01-01', '2024-01-01', '2024-01-02'])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('maps each date to its conversion ratios relative to the base currency', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('2024-01-01')) return jsonResponse({ USD: 1.1, SEK: 11 })
        return jsonResponse({ USD: 1.2, SEK: 12 })
      })
      const result = await getMultiDateConversions('USD', ['2024-01-01', '2024-01-02'])
      expect(result.get('2024-01-01')).toEqual({ EUR: 1 / 1.1, USD: 1, SEK: 11 / 1.1 })
      expect(result.get('2024-01-02')).toEqual({ EUR: 1 / 1.2, USD: 1, SEK: 12 / 1.2 })
    })

    it('omits dates whose fetch fails, without failing the whole batch', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('2024-01-01')) return jsonResponse({}, false)
        return jsonResponse({ USD: 1.1 })
      })
      const result = await getMultiDateConversions('USD', ['2024-01-01', '2024-01-02'])
      expect(result.has('2024-01-01')).toBe(false)
      expect(result.has('2024-01-02')).toBe(true)
    })

    it('omits dates whose rates lack the base currency', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ SEK: 11 })) // no USD
      const result = await getMultiDateConversions('USD', ['2024-01-01'])
      expect(result.size).toBe(0)
    })
  })
})
