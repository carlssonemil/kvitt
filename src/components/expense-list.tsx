'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, ReceiptIcon, XIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { CategoryIcon } from '@/components/category-icon'
import { getCategoryIcon, EXPENSE_CATEGORIES } from '@/lib/categories'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { ExpenseDetail } from '@/components/expense-detail'
import { SettlementDetail } from '@/components/settlement-detail'
import type { ExpenseWithPayer } from '@/types/database'
import type { SettlementWithUsers } from '@/lib/queries'
import { Currency } from '@/components/currency'
import { isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { useTranslations, useLocale } from 'next-intl'

const PAGE_SIZE = 30
const PULL_THRESHOLD = 80

type FeedItem =
  | { kind: 'expense'; data: ExpenseWithPayer; sortKey: string }
  | { kind: 'settlement'; data: SettlementWithUsers; sortKey: string }

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
}

interface ExpenseListProps {
  expenses: ExpenseWithPayer[]
  settlements: SettlementWithUsers[]
  groupId: string
  currency: string
  currentUserId: string
  members: Member[]
  action?: React.ReactNode
}

function ExpenseRow({ expense, groupId, currentUserId, members, locale }: { expense: ExpenseWithPayer; groupId: string; currentUserId: string; members: Member[]; locale: string }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const t = useTranslations('expenseList')
  const tc = useTranslations('common')

  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'
  const dateLabel = new Date(expense.date).toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })
  const paidByName = expense.paid_by === currentUserId ? tc('you') : expense.paid_by_name

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 w-full text-left hover:bg-muted/50 transition-colors"
        >
          <CategoryIcon category={expense.category} />
          <div className="flex-1 min-w-0">
            <span className="font-medium truncate block">{expense.title}</span>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {t('paidByLabel')} {paidByName} · {dateLabel}
            </span>
          </div>
          <Currency amount={Number(expense.amount)} currency={expense.currency} className="font-semibold shrink-0" />
        </button>
      </div>
      <ExpenseDetail
        expense={expense}
        groupId={groupId}
        currentUserId={currentUserId}
        members={members}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}

function SettlementRow({ settlement, groupId, currency, currentUserId, members, locale }: { settlement: SettlementWithUsers; groupId: string; currency: string; currentUserId: string; members: Member[]; locale: string }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const t = useTranslations('expenseList')
  const tc = useTranslations('common')

  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'
  const dateLabel = new Date(settlement.created_at).toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })
  const payerName = settlement.paid_by === currentUserId ? tc('You') : settlement.paid_by_name
  const payeeName = settlement.paid_to === currentUserId ? tc('you') : settlement.paid_to_name

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 w-full text-left hover:bg-muted/50 transition-colors"
        >
          <CategoryIcon category="settlement" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">
              <span className="font-medium">{payerName}</span>
              {` ${t('paid')} `}
              <span className="font-medium">{payeeName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
          </div>
          <Currency amount={Number(settlement.amount)} currency={settlement.currency} className="font-semibold shrink-0" />
        </button>
      </div>
      <SettlementDetail
        settlement={settlement}
        groupId={groupId}
        currentUserId={currentUserId}
        currency={currency}
        members={members}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}

function getMonthKey(item: FeedItem): string {
  const dateStr = item.kind === 'expense' ? item.data.date : item.data.created_at
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string, intlLocale: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year!, month! - 1, 1)
  return d.toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' })
}

export function ExpenseList({ expenses, settlements, groupId, currency, currentUserId, members, action }: ExpenseListProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('expenseList')
  const tc = useTranslations('categories')
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'

  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'settlement'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Infinite scroll
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Pull to refresh
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullDistanceRef = useRef(0)
  const isRefreshingRef = useRef(false)
  const pullStartY = useRef(0)
  const isPullingRef = useRef(false)

  // Attach pull-to-refresh touch handlers
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        pullStartY.current = e.touches[0]!.clientY
        isPullingRef.current = true
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!isPullingRef.current) return
      const delta = e.touches[0]!.clientY - pullStartY.current
      if (delta > 0) {
        e.preventDefault()
        const d = Math.min(delta, PULL_THRESHOLD * 1.5)
        pullDistanceRef.current = d
        setPullDistance(d)
      } else {
        isPullingRef.current = false
        pullDistanceRef.current = 0
        setPullDistance(0)
      }
    }

    function onTouchEnd() {
      if (!isPullingRef.current) return
      isPullingRef.current = false
      if (pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshingRef.current) {
        isRefreshingRef.current = true
        setIsRefreshing(true)
        pullDistanceRef.current = 0
        setPullDistance(0)
        router.refresh()
        setTimeout(() => {
          isRefreshingRef.current = false
          setIsRefreshing(false)
        }, 1200)
      } else {
        pullDistanceRef.current = 0
        setPullDistance(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [router])

  // Infinite scroll sentinel observer
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayLimit(prev => prev + PAGE_SIZE)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE)
  }, [typeFilter, categoryFilter, dateRange])

  const availableCategories = React.useMemo(() => {
    const seen = new Set<string>()
    for (const e of expenses) {
      seen.add(e.category ?? 'other')
    }
    return Array.from(seen).sort()
  }, [expenses])

  const feed: FeedItem[] = [
    ...expenses.map(e => { const d = new Date(e.date).toISOString(); const ca = new Date(e.created_at).toISOString(); return { kind: 'expense' as const, data: e, sortKey: d.slice(0, 10) + ca } }),
    ...settlements.map(s => { const ca = new Date(s.created_at).toISOString(); return { kind: 'settlement' as const, data: s, sortKey: ca.slice(0, 10) + ca } }),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  if (feed.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {action && (
          <div className="fixed bottom-6 inset-x-0 flex justify-center z-20 sm:static sm:inset-x-auto sm:flex-none sm:flex sm:justify-end">
            {action}
          </div>
        )}
        <EmptyState
          icon={ReceiptIcon}
          title={t('noExpenses.title')}
          description={t('noExpenses.desc')}
        />
      </div>
    )
  }

  const filteredFeed = feed.filter(item => {
    if (typeFilter !== 'all' && item.kind !== typeFilter) return false
    if (categoryFilter !== 'all') {
      if (item.kind !== 'expense') return false
      const itemCategory = item.data.category ?? 'other'
      if (itemCategory !== categoryFilter) return false
    }
    if (dateRange?.from) {
      const itemDate = new Date(item.kind === 'expense' ? item.data.date : item.data.created_at)
      const from = startOfDay(dateRange.from)
      const to = endOfDay(dateRange.to ?? dateRange.from)
      if (!isWithinInterval(itemDate, { start: from, end: to })) return false
    }
    return true
  })

  const hasActiveFilter = typeFilter !== 'all' || categoryFilter !== 'all' || !!dateRange?.from

  const visibleFeed = filteredFeed.slice(0, displayLimit)
  const hasMore = filteredFeed.length > displayLimit

  const rows: React.ReactNode[] = []
  let lastMonth: string | null = null

  for (const item of visibleFeed) {
    const month = getMonthKey(item)
    if (month !== lastMonth) {
      rows.push(
        <p key={`month-${month}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 pb-1">
          {formatMonthLabel(month, intlLocale)}
        </p>
      )
      lastMonth = month
    }
    rows.push(
      item.kind === 'expense'
        ? <ExpenseRow key={item.data.id} expense={item.data} groupId={groupId} currentUserId={currentUserId} members={members} locale={locale} />
        : <SettlementRow key={item.data.id} settlement={item.data} groupId={groupId} currency={currency} currentUserId={currentUserId} members={members} locale={locale} />
    )
  }

  // Pull indicator height: animates to ~40px while pulling, 48px while refreshing
  const indicatorHeight = isRefreshing ? 48 : Math.min(pullDistance * 0.5, 40)

  return (
    <div className="flex flex-col gap-2 pb-20 sm:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap flex-1">
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger size="sm" className="w-full sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('typeAll')}</SelectItem>
              <SelectItem value="expense">{t('typeExpenses')}</SelectItem>
              <SelectItem value="settlement">{t('typeSettlements')}</SelectItem>
            </SelectContent>
          </Select>
          {availableCategories.length > 1 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger size="sm" className="w-full sm:w-auto">
                {categoryFilter === 'all' ? (
                  <span>{t('allCategories')}</span>
                ) : (() => {
                  const Icon = getCategoryIcon(categoryFilter)
                  return (
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5 shrink-0" />
                      {tc(categoryFilter as Parameters<typeof tc>[0])}
                    </span>
                  )
                })()}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {availableCategories.map(cat => {
                  const Icon = getCategoryIcon(cat)
                  return (
                    <SelectItem key={cat} value={cat}>
                      <Icon className="size-3.5 shrink-0" />
                      {tc(cat as Parameters<typeof tc>[0])}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto h-8 gap-1.5 font-normal justify-start sm:justify-center">
                <CalendarIcon data-icon="inline-start" />
                {dateRange?.from
                  ? dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
                    ? `${dateRange.from.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })} – ${dateRange.to.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : dateRange.from.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' })
                  : t('pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-wrap gap-1 p-3 border-b">
                {([
                  { key: 'thisWeek' as const, range: () => { const now = new Date(); return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) } } },
                  { key: 'lastWeek' as const, range: () => { const prev = subWeeks(new Date(), 1); return { from: startOfWeek(prev, { weekStartsOn: 1 }), to: endOfWeek(prev, { weekStartsOn: 1 }) } } },
                  { key: 'thisMonth' as const, range: () => { const now = new Date(); return { from: startOfMonth(now), to: endOfMonth(now) } } },
                  { key: 'lastMonth' as const, range: () => { const prev = subMonths(new Date(), 1); return { from: startOfMonth(prev), to: endOfMonth(prev) } } },
                ] as const).map(({ key, range }) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDateRange(range())}
                  >
                    {t(key)}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
          {hasActiveFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); setDateRange(undefined) }}
              className="h-8 w-full sm:w-auto"
            >
              <XIcon data-icon="inline-start" />
              {t('clearFilters')}
            </Button>
          )}
        </div>
        {action && (
          <div className="fixed bottom-6 inset-x-0 flex justify-center z-20 sm:static sm:inset-x-auto sm:flex-none sm:justify-start sm:ml-auto">
            {action}
          </div>
        )}
      </div>
      {/* Pull-to-refresh indicator */}
      <motion.div
        animate={{ height: indicatorHeight }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="flex items-center justify-center"
      >
        {(pullDistance > 10 || isRefreshing) && (
          <Spinner className="size-5 text-muted-foreground" />
        )}
      </motion.div>

      {filteredFeed.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title={t('noMatch.title')}
        />
      ) : rows}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center h-8">
        {hasMore && <Spinner className="size-4 text-muted-foreground" />}
      </div>
    </div>
  )
}
