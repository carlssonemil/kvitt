'use client'

import { motion } from 'framer-motion'
import { Bird } from 'lucide-react'

const tiltKeyframes = {
  rotate: [0, -5, 0, 4, 0],
  y: [0, -1, 0],
}

export function AnimatedBird({ className, idle = true }: { className?: string; idle?: boolean }) {
  return (
    <motion.div
      {...(idle && {
        animate: tiltKeyframes,
        transition: {
          duration: 2.5,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 5,
        },
      })}
      whileHover={{
        ...tiltKeyframes,
        transition: {
          duration: 2.5,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 0,
        },
      }}
      style={{ display: 'inline-flex', originX: '50%', originY: '80%' }}
    >
      <Bird className={className} strokeWidth={1.75} aria-hidden="true" />
    </motion.div>
  )
}
