'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTranslations } from 'next-intl'

export function KvittTooltip() {
  const t = useTranslations('home')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline italic decoration-dotted underline-offset-4 cursor-default">kvitt</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t('kvittTooltip')}
      </TooltipContent>
    </Tooltip>
  )
}
