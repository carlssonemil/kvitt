'use client'

import { getCategoryIcon, EXPENSE_CATEGORIES } from '@/lib/categories'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslations } from 'next-intl'

type CategoryKey = 'settlement' | typeof EXPENSE_CATEGORIES[number]['key'] | 'uncategorized'

const VALID_KEYS = new Set<string>(['settlement', 'uncategorized', ...EXPENSE_CATEGORIES.map(c => c.key)])

interface CategoryIconProps {
  category: string | null
}

export function CategoryIcon({ category }: CategoryIconProps) {
  const t = useTranslations('categories')
  const Icon = getCategoryIcon(category)
  const key: CategoryKey = category && VALID_KEYS.has(category) ? (category as CategoryKey) : 'uncategorized'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-primary/10"
          tabIndex={0}
          role="img"
          aria-label={t(key)}
        >
          <Icon className="size-[18px] text-primary" aria-hidden="true" />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t(key)}</TooltipContent>
    </Tooltip>
  )
}
