import { Skeleton } from '@/components/ui/skeleton'

function GroupCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="size-7 rounded-full" />
        ))}
      </div>
    </div>
  )
}

export default function GroupsPageLoading() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </div>
    </main>
  )
}
