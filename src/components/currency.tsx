interface CurrencyProps {
  amount: number
  currency: string
  className?: string
}

export function formatCurrency(amount: number): string {
  const hasDecimals = amount % 1 !== 0
  return hasDecimals ? amount.toFixed(2) : amount.toFixed(0)
}

export function Currency({ amount, currency, className }: CurrencyProps) {
  return (
    <span className={className}>
      {formatCurrency(amount)} {currency}
    </span>
  )
}
