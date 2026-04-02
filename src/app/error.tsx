'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircleIcon } from 'lucide-react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <AlertCircleIcon className="size-10 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
      </div>
      <Button variant="outline" onClick={reset}>Try again</Button>
    </main>
  )
}
