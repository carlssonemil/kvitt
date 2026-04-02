'use client'

import { motion } from 'framer-motion'

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  up?: boolean
  className?: string
}

export function FadeIn({ children, delay = 0, up = false, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: up ? 14 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
