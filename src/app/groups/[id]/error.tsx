'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircleIcon, Loader2Icon } from 'lucide-react'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants'

export default function GroupError({
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
        <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
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
        <h1 className="text-lg font-semibold">Failed to load group</h1>
        <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={unstable_retry}>Try again</Button>
        <Button variant="ghost" asChild>
          <Link href={ROUTES.GROUPS}>Back to groups</Link>
        </Button>
      </div>
    </main>
  )
}
