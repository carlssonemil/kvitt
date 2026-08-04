import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

function ExpenseItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="size-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

export function GroupBodySkeleton() {
  return (
    <>
      {/* Tab bar */}
      <div className="border-b border-border mb-3">
        <div className="flex gap-1 pb-0">
          {['Expenses', 'Balances', 'Stats', 'Settings'].map(label => (
            <div key={label} className="relative px-3 py-2">
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Expense list skeleton */}
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <ExpenseItemSkeleton />
            {i < 4 && <Separator />}
          </div>
        ))}
      </div>
    </>
  )
}
