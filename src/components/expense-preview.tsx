'use client'

import { ReceiptIcon } from 'lucide-react'
import { FadeIn } from '@/components/auth/fade-in'
import { CategoryIcon } from '@/components/category-icon'

const PREVIEW_ITEMS = [
  { type: 'expense' as const, category: 'food',          title: 'Dinner',           sub: 'paid by Anna',   amount: '320 kr' },
  { type: 'expense' as const, category: 'shopping',      title: 'Groceries',        sub: 'paid by You',    amount: '215 kr' },
  { type: 'expense' as const, category: 'transport',     title: 'Taxi',             sub: 'paid by Björn',  amount: '180 kr' },
  { type: 'settlement' as const, category: null,         title: 'Anna paid Björn',  sub: 'settlement',     amount: '180 kr' },
]

interface ExpensePreviewProps {
  cardBg?: string
  delayOffset?: number
  showFooter?: boolean
}

export function ExpensePreview({ cardBg = 'bg-card/50', delayOffset = 0.25, showFooter = false }: ExpensePreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      {PREVIEW_ITEMS.map(({ type, category, title, sub, amount }, i) => (
        <FadeIn key={title} up delay={delayOffset + i * 0.1}>
          <div className={`flex items-center gap-3 rounded-lg ${cardBg} px-3 py-2.5 border border-border shadow-xs`}>
            <CategoryIcon category={type === 'settlement' ? 'settlement' : category} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{title}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
            <span className={`text-sm font-semibold shrink-0 ${type === 'settlement' ? 'text-muted-foreground' : 'text-foreground'}`}>
              {amount}
            </span>
          </div>
        </FadeIn>
      ))}
      {showFooter && (
        <FadeIn delay={delayOffset + PREVIEW_ITEMS.length * 0.1} className="flex items-center justify-center gap-2 mt-1">
          <ReceiptIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Balances calculated automatically</p>
        </FadeIn>
      )}
    </div>
  )
}
