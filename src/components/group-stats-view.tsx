import type { GroupStats } from '@/types/database'
import { formatCurrency } from '@/components/currency'
import { cn } from '@/lib/utils'
import { PaymentSplitChart, MonthlySpendingChart, CategorySpendingChart } from '@/components/group-stats-charts'
import { ReceiptIcon } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

interface GroupStatsViewProps {
  stats: GroupStats
  currency: string
}

function DeltaBadge({ thisMonth, lastMonth }: { thisMonth: number; lastMonth: number }) {
  if (thisMonth === 0 && lastMonth === 0) return null
  if (lastMonth === 0) return null
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
  const up = pct >= 0
  return (
    <span className={cn('text-xs font-medium', up ? 'text-destructive' : 'text-green-600 dark:text-green-400')}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs last month
    </span>
  )
}

function AmountValue({ amount, currency }: { amount: number; currency: string }) {
  return (
    <span className="text-xl font-bold tabular-nums">
      {formatCurrency(amount)}{' '}
      <span className="text-sm font-normal text-muted-foreground">{currency}</span>
    </span>
  )
}

export function GroupStatsView({ stats, currency }: GroupStatsViewProps) {
  const hasData = stats.expense_count > 0
  const splitTotal = stats.payment_split.reduce((sum, p) => sum + p.total, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Total expenses</span>
          <span className="text-xl font-bold tabular-nums">{stats.expense_count}</span>
        </div>
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Total amount</span>
          <div className="flex items-center justify-between gap-2">
            <AmountValue amount={stats.total_amount} currency={currency} />
            {hasData && stats.this_month_total > 0 && (
              <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                {formatCurrency(stats.this_month_total)} {currency} this month
              </span>
            )}
          </div>
          {hasData && <DeltaBadge thisMonth={stats.this_month_total} lastMonth={stats.last_month_total} />}
        </div>
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">You paid</span>
          <AmountValue amount={stats.your_paid} currency={currency} />
        </div>
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Your share</span>
          <AmountValue amount={stats.your_share} currency={currency} />
        </div>
      </div>

      {!hasData && (
        <EmptyState icon={ReceiptIcon} title="No expenses yet" />
      )}

      {/* Payment split */}
      {hasData && stats.payment_split.length > 0 && splitTotal > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">Payment split</p>
          <PaymentSplitChart data={stats.payment_split} currency={currency} />
        </div>
      )}

      {/* Category spending */}
      {hasData && stats.category_spending.length > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">Spending by category</p>
          <CategorySpendingChart data={stats.category_spending} currency={currency} />
        </div>
      )}

      {/* Monthly spending */}
      {hasData && stats.monthly_spending.length > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">Monthly spending</p>
          <MonthlySpendingChart data={stats.monthly_spending} currency={currency} />
        </div>
      )}

      {/* Top expenses */}
      {hasData && stats.top_expenses.length > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">Top expenses</p>
          <div className="flex flex-col gap-2">
            {stats.top_expenses.map((e, i) => (
              <div key={e.title} className="flex items-center gap-3 text-xs">
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate">{e.title}</span>
                <span className="text-muted-foreground shrink-0">{e.count}×</span>
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                  {formatCurrency(e.total)} {currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
