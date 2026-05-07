'use client'

import { ReceiptIcon } from 'lucide-react'
import { FadeIn } from '@/components/auth/fade-in'
import { CategoryIcon } from '@/components/category-icon'
import { useTranslations } from 'next-intl'

const PREVIEW_DATA = [
  { type: 'expense' as const,    category: 'food',     title: 'Dinner',    name: 'Anna',  amount: '320 kr' },
  { type: 'expense' as const,    category: 'shopping', title: 'Groceries', name: 'you',   amount: '215 kr' },
  { type: 'expense' as const,    category: 'transport',title: 'Taxi',      name: 'Björn', amount: '180 kr' },
  { type: 'settlement' as const, category: null,       payer: 'Anna',      payee: 'Björn',amount: '180 kr' },
] as const

interface ExpensePreviewProps {
  cardBg?: string
  delayOffset?: number
  showFooter?: boolean
}

export function ExpensePreview({ cardBg = 'bg-card/50', delayOffset = 0.25, showFooter = false }: ExpensePreviewProps) {
  const t = useTranslations('home')
  const ts = useTranslations('settleUp')

  const items = PREVIEW_DATA.map(item => {
    if (item.type === 'settlement') {
      return {
        type: item.type,
        category: item.category,
        title: ts('paidSubtitle', { payer: item.payer, payee: item.payee }),
        sub: t('preview.settlement'),
        amount: item.amount,
      }
    }
    const name = item.name === 'you' ? t('preview.you') : item.name
    return {
      type: item.type,
      category: item.category,
      title: item.title,
      sub: t('preview.paidBy', { name }),
      amount: item.amount,
    }
  })

  return (
    <div className="flex flex-col gap-2">
      {items.map(({ type, category, title, sub, amount }, i) => (
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
        <FadeIn delay={delayOffset + items.length * 0.1} className="flex items-center justify-center gap-2 mt-1">
          <ReceiptIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">{t('balancesAuto')}</p>
        </FadeIn>
      )}
    </div>
  )
}
