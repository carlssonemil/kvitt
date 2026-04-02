import { getCategoryIcon, getCategoryLabel } from '@/lib/categories'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface CategoryIconProps {
  category: string | null
}

export function CategoryIcon({ category }: CategoryIconProps) {
  const Icon = getCategoryIcon(category)
  const label = category === 'settlement' ? 'Settlement' : getCategoryLabel(category)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-primary/10"
          tabIndex={0}
          role="img"
          aria-label={label}
        >
          <Icon className="size-[18px] text-primary" aria-hidden="true" />
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
