'use client'

import { useLocale } from 'next-intl'

interface CurrencyProps {
  amount: number
  currency: string
  className?: string
}

export function formatNumber(amount: number, locale: string): string {
  const hasDecimals = amount % 1 !== 0
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function Currency({ amount, currency, className }: CurrencyProps) {
  const locale = useLocale()
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'
  return (
    <span className={className}>
      {formatNumber(amount, intlLocale)} {currency}
    </span>
  )
}
