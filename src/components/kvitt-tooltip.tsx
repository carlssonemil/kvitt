'use client'

import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTranslations } from 'next-intl'

export function KvittTooltip() {
  const t = useTranslations('home')
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="border-0 bg-transparent p-0 underline italic decoration-dotted underline-offset-4 cursor-pointer"
        >
          kvitt
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t('kvittTooltip')}
      </TooltipContent>
    </Tooltip>
  )
}
