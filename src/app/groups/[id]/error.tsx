'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants'

export default function GroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <AlertCircleIcon className="size-10 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Failed to load group</h1>
        <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>Try again</Button>
        <Button variant="ghost" asChild>
          <Link href={ROUTES.GROUPS}>Back to groups</Link>
        </Button>
      </div>
    </main>
  )
}
