'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="size-8" />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative flex items-center justify-center size-8 rounded-full hover:bg-muted/60 transition-colors"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <Sun
        className={`absolute size-4 text-muted-foreground transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0 ${
          isDark ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'
        }`}
      />
      <Moon
        className={`absolute size-4 text-muted-foreground transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0 ${
          isDark ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
        }`}
      />
    </button>
  )
}
