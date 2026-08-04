import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GroupBodySkeleton } from '@/components/group-body-skeleton'

export default function GroupPageLoading() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 pt-4 pb-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/groups">
          <ArrowLeftIcon className="size-4" />
          Back
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <GroupBodySkeleton />
    </main>
  )
}
