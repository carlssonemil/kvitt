'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function KvittTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline italic decoration-dotted underline-offset-4 cursor-default">kvitt</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        Swedish for "even", as in all settled up
      </TooltipContent>
    </Tooltip>
  )
}
