import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HomeIcon } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center gap-4">
      <p className="text-6xl font-bold text-muted-foreground/20">404</p>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/">
          <HomeIcon className="size-3.5" />
          Back to home
        </Link>
      </Button>
    </main>
  )
}
