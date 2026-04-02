import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyHeader className="gap-1">
        {Icon && (
          <EmptyMedia variant="icon" className="text-primary">
            <Icon />
          </EmptyMedia>
        )}
        <EmptyTitle className={cn("text-base", !description && "text-muted-foreground")}>
          {title}
        </EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}
