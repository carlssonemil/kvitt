'use client'

import { useEffect, useState } from 'react'
import './globals.css'

// Catches errors thrown in the root layout, which app/error.tsx cannot. Must
// render its own <html>/<body>, and can't rely on providers or translations.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [isAutoRetrying, setIsAutoRetrying] = useState(true)

  useEffect(() => {
    console.error(error)
  }, [error])

  useEffect(() => {
    if (!isAutoRetrying) return
    const timer = setTimeout(() => {
      setIsAutoRetrying(false)
      retry()
    }, 3000)
    return () => clearTimeout(timer)
  }, [isAutoRetrying, retry])

  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">
              {isAutoRetrying ? 'Connecting...' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAutoRetrying
                ? 'Warming up the database, please wait.'
                : 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
          {!isAutoRetrying && (
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          )}
        </main>
      </body>
    </html>
  )
}
