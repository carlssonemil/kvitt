'use client'

import { useEffect, useState } from 'react'
import type { GroupStats } from '@/types/database'
import { formatNumber } from '@/components/currency'
import { PaymentSplitChart, MonthlySpendingChart, CategorySpendingChart } from '@/components/group-stats-charts'
import { ReceiptIcon } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGroupStatsAction } from '@/actions/group-actions'
import { useTranslations, useLocale } from 'next-intl'

interface GroupStatsViewProps {
  stats: GroupStats
  currency: string
}

interface GroupStatsTabProps {
  groupId: string
  currency: string
}

export function GroupStatsTab({ groupId, currency }: GroupStatsTabProps) {
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGroupStatsAction(groupId).then(result => {
      if (cancelled) return
      if (result.error) setError(result.error)
      else setStats(result.stats ?? null)
    })
    return () => { cancelled = true }
  }, [groupId])

  if (error) {
    return <p className="text-sm text-destructive py-8 text-center">{error}</p>
  }

  if (!stats) {
    return <GroupStatsSkeleton />
  }

  return <GroupStatsView stats={stats} currency={currency} />
}

function GroupStatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border px-4 py-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      ))}
    </div>
  )
}

function AmountValue({ amount, currency, locale }: { amount: number; currency: string; locale: string }) {
  return (
    <span className="text-xl font-bold tabular-nums">
      {formatNumber(Math.round(amount), locale)}{' '}
      <span className="text-sm font-normal text-muted-foreground">{currency}</span>
    </span>
  )
}

export function GroupStatsView({ stats, currency }: GroupStatsViewProps) {
  const t = useTranslations('stats')
  const locale = useLocale()
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'
  const hasData = stats.expense_count > 0
  const splitTotal = stats.payment_split.reduce((sum, p) => sum + p.total, 0)

  const monthlyYears = [...new Set(stats.monthly_spending.map(m => m.year))].sort((a, b) => b - a)
  const [yearFilter, setYearFilter] = useState<string>(monthlyYears[0] !== undefined ? String(monthlyYears[0]) : 'all')
  const monthlySpending = yearFilter === 'all'
    ? stats.monthly_spending
    : stats.monthly_spending.filter(m => m.year === Number(yearFilter))
  const monthlyAverage = monthlySpending.length > 0
    ? monthlySpending.reduce((sum, m) => sum + m.total, 0) / monthlySpending.length
    : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t('totalExpenses')}</span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xl font-bold tabular-nums">{formatNumber(stats.expense_count, intlLocale)}</span>
            {hasData && stats.this_month_count > 0 && stats.monthly_spending.length > 1 && (
              <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                {t('expenseCountThisMonth', { count: stats.this_month_count })}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t('totalAmount')}</span>
          <div className="flex items-center justify-between gap-2">
            <AmountValue amount={stats.total_amount} currency={currency} locale={intlLocale} />
            {hasData && stats.this_month_total > 0 && stats.monthly_spending.length > 1 && (
              <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                {t('thisMonth', { amount: formatNumber(Math.round(stats.this_month_total), intlLocale), currency })}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t('youPaid')}</span>
          <AmountValue amount={stats.your_paid} currency={currency} locale={intlLocale} />
        </div>
        <div className="rounded-lg border px-4 py-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t('yourShare')}</span>
          <AmountValue amount={stats.your_share} currency={currency} locale={intlLocale} />
        </div>
      </div>

      {!hasData && (
        <EmptyState icon={ReceiptIcon} title={t('noExpenses')} />
      )}

      {hasData && stats.payment_split.length > 0 && splitTotal > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">{t('paymentSplit')}</p>
          <PaymentSplitChart data={stats.payment_split} currency={currency} locale={intlLocale} />
        </div>
      )}

      {hasData && stats.category_spending.length > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">{t('spendingByCategory')}</p>
          <CategorySpendingChart data={stats.category_spending} currency={currency} locale={intlLocale} />
        </div>
      )}

      {hasData && stats.monthly_spending.length > 1 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground font-medium">{t('monthlySpending')}</p>
              {monthlyAverage > 0 && (
                <span className="text-xs w-fit bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded px-1.5 py-0.5">
                  {t('monthlyAverage', { amount: formatNumber(Math.round(monthlyAverage), intlLocale), currency })}
                </span>
              )}
            </div>
            {monthlyYears.length > 1 && (
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger size="sm" className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allYears')}</SelectItem>
                  {monthlyYears.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <MonthlySpendingChart data={monthlySpending} currency={currency} locale={intlLocale} />
        </div>
      )}

      {hasData && stats.top_expenses.length > 0 && (
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground font-medium">{t('topExpenses')}</p>
          <div className="flex flex-col gap-2">
            {stats.top_expenses.map((e, i) => (
              <div key={e.title} className="flex items-center gap-3 text-xs">
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate">{e.title}</span>
                {e.count > 1 && <span className="text-muted-foreground shrink-0">{e.count}×</span>}
                <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                  {formatNumber(Math.round(e.total), intlLocale)} {currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
