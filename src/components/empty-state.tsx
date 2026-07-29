'use client'

import type { LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

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
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className="w-full flex-1"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
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
    </motion.div>
  )
}
