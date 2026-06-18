'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircleIcon } from 'lucide-react'
import { AnimatedBird } from '@/components/auth/animated-bird'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const [isAutoRetrying, setIsAutoRetrying] = useState(true)

  useEffect(() => {
    console.error(error)
  }, [error])

  useEffect(() => {
    if (!isAutoRetrying) return
    const timer = setTimeout(() => {
      setIsAutoRetrying(false)
      unstable_retry()
    }, 3000)
    return () => clearTimeout(timer)
  }, [isAutoRetrying, unstable_retry])

  if (isAutoRetrying) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <AnimatedBird className="size-10 text-primary" />
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Connecting...</h1>
          <p className="text-sm text-muted-foreground">Warming up the database, please wait.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <AlertCircleIcon className="size-10 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
      </div>
      <Button variant="outline" onClick={unstable_retry}>Try again</Button>
    </main>
  )
}
