'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
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
import type { FeedCursor, FeedItem, FeedFilters, SettlementWithUsers } from '@/lib/queries'
import { getGroupFeedAction } from '@/actions/group-actions'
import { Currency } from '@/components/currency'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { useTranslations, useLocale } from 'next-intl'

const PULL_THRESHOLD = 80

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
}

interface ExpenseListProps {
  initialItems: FeedItem[]
  initialCursor: FeedCursor | null
  initialHasMore: boolean
  isGroupEmpty: boolean
  availableCategories: string[]
  groupId: string
  currency: string
  currentUserId: string
  members: Member[]
  action?: React.ReactNode
}

function formatDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

export function ExpenseList({ initialItems, initialCursor, initialHasMore, isGroupEmpty, availableCategories, groupId, currency, currentUserId, members, action }: ExpenseListProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('expenseList')
  const tc = useTranslations('categories')
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'
  const shouldReduceMotion = useReducedMotion()

  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'settlement'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Server-paginated feed
  const [items, setItems] = useState<FeedItem[]>(initialItems)
  const [cursor, setCursor] = useState<FeedCursor | null>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingPage1, setIsLoadingPage1] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const requestSeqRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  function buildFilters(): FeedFilters {
    const filters: FeedFilters = {}
    if (typeFilter !== 'all') filters.type = typeFilter
    if (categoryFilter !== 'all') filters.category = categoryFilter
    if (dateRange?.from) {
      filters.dateFrom = formatDateParam(dateRange.from)
      filters.dateTo = formatDateParam(dateRange.to ?? dateRange.from)
    }
    return filters
  }

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

  // Load page 1 whenever filters change, or whenever the server hands us fresh seed data
  // (initial mount, router.refresh(), or a revalidatePath()-driven re-render after a mutation).
  useEffect(() => {
    const filtersActive = typeFilter !== 'all' || categoryFilter !== 'all' || !!dateRange?.from
    if (!filtersActive) {
      setItems(initialItems)
      setCursor(initialCursor)
      setHasMore(initialHasMore)
      setIsLoadingPage1(false)
      return
    }
    const seq = ++requestSeqRef.current
    setIsLoadingPage1(true)
    getGroupFeedAction(groupId, null, buildFilters()).then(res => {
      if (seq !== requestSeqRef.current) return
      if (res.page) {
        setItems(res.page.items)
        setCursor(res.page.nextCursor)
        setHasMore(res.page.hasMore)
      }
      setIsLoadingPage1(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, categoryFilter, dateRange, initialItems, initialCursor, initialHasMore, groupId])

  // Infinite scroll sentinel observer: fetches the next page from the server on intersect
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (!hasMore || isLoadingMore || isLoadingPage1) return
        const seq = ++requestSeqRef.current
        setIsLoadingMore(true)
        getGroupFeedAction(groupId, cursor, buildFilters()).then(res => {
          if (seq !== requestSeqRef.current) return
          if (res.page) {
            const page = res.page
            setItems(prev => [...prev, ...page.items])
            setCursor(page.nextCursor)
            setHasMore(page.hasMore)
          }
          setIsLoadingMore(false)
        })
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore, isLoadingPage1, cursor, typeFilter, categoryFilter, dateRange, groupId])

  if (isGroupEmpty) {
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

  const hasActiveFilter = typeFilter !== 'all' || categoryFilter !== 'all' || !!dateRange?.from

  const rows: React.ReactNode[] = []
  let lastMonth: string | null = null

  for (const item of items) {
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
      <motion.div
        key={item.data.id}
        layout="position"
        initial={shouldReduceMotion ? false : { opacity: 0, transform: 'translateY(-6px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        exit={{ opacity: 0, transform: 'translateY(0px)', transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        {item.kind === 'expense'
          ? <ExpenseRow expense={item.data} groupId={groupId} currentUserId={currentUserId} members={members} locale={locale} />
          : <SettlementRow settlement={item.data} groupId={groupId} currency={currency} currentUserId={currentUserId} members={members} locale={locale} />}
      </motion.div>
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

      {isLoadingPage1 && items.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title={t('noMatch.title')}
        />
      ) : (
        <AnimatePresence initial={false}>
          {rows}
        </AnimatePresence>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center h-8">
        {hasMore && <Spinner className="size-4 text-muted-foreground" />}
      </div>
    </div>
  )
}
