'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { ReceiptIcon, ScaleIcon, PieChartIcon, ArrowLeftRightIcon, type LucideIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CategorySpendingChart } from '@/components/group-stats-charts'
import { CategoryIcon } from '@/components/category-icon'
import { UserAvatar } from '@/components/user-avatar'

const TAB_VALUES = ['expenses', 'balances', 'stats', 'currencies'] as const
type TabValue = typeof TAB_VALUES[number]

const TAB_ICONS: Record<TabValue, LucideIcon> = {
  expenses: ReceiptIcon,
  balances: ScaleIcon,
  stats: PieChartIcon,
  currencies: ArrowLeftRightIcon,
}

const STATS_DATA = [
  { category: 'food', total: 620 },
  { category: 'groceries', total: 430 },
  { category: 'transport', total: 180 },
]

// Split mock for the "expenses" tab: shows the split mechanic itself
// (equal/exact/percentage), not just a pre-split receipt list, since that's
// what "split any expense your way" actually claims. Static, not clickable.
const SPLIT_METHOD_KEYS = ['splitEqual', 'splitExact', 'splitPercentage'] as const
const ACTIVE_SPLIT_METHOD = 'splitEqual'

const SPLIT_MEMBERS = [
  { name: 'Anna', amount: '107 kr' },
  { name: 'you', amount: '107 kr' },
  { name: 'Björn', amount: '106 kr' },
] as const

const AUTO_CYCLE_MS = 4500

// Radix unmounts each inactive TabsContent, so it remounts fresh whenever it
// becomes active — this transition rides that remount to crossfade previews
// in on tab swap, reusing the app's one motion curve.
const PREVIEW_TRANSITION = { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const }

// The shared TabsList "line" variant forces active triggers to bg-transparent
// via `group-data-[variant=line]/tabs-list:data-active:bg-transparent` (see
// src/components/ui/tabs.tsx) so an external indicator like GroupTabs' underline
// can show selection instead. This component wants a filled highlight instead.
// Matching that exact selector chain isn't enough on its own: both rules compile
// to equal specificity, and the shared component's rule happens to land later in
// the compiled stylesheet, so it wins the tie. The trailing `!` forces this one
// to win regardless of source order. Scoped to this file only — ui/tabs.tsx itself
// is untouched, so GroupTabs and every other tab list in the app are unaffected.
const triggerClassName = 'flex h-auto w-full items-start justify-start gap-3 rounded-lg border-0 px-4 py-3 text-left whitespace-normal transition-colors group-data-[variant=line]/tabs-list:data-active:bg-foreground/5! hover:bg-foreground/5'

export function LandingFeatureTabs() {
  const t = useTranslations('home.features')
  const tHome = useTranslations('home')
  const tExpense = useTranslations('expense')
  const tBalance = useTranslations('balance')
  const tCommon = useTranslations('common')
  const ts = useTranslations('settleUp')
  const locale = useLocale()
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'
  const shouldReduceMotion = useReducedMotion()

  const [tab, setTab] = useState<TabValue>('expenses')
  const [autoCycling, setAutoCycling] = useState(true)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!autoCycling || paused || shouldReduceMotion) return
    const id = setInterval(() => {
      setTab(current => TAB_VALUES[(TAB_VALUES.indexOf(current) + 1) % TAB_VALUES.length])
    }, AUTO_CYCLE_MS)
    return () => clearInterval(id)
  }, [autoCycling, paused, shouldReduceMotion])

  function handleTabChange(value: string) {
    setTab(value as TabValue)
    setAutoCycling(false)
  }

  return (
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      orientation="vertical"
      className="w-full max-w-4xl mx-auto grid gap-8 md:grid-cols-[1fr_320px] md:gap-12 items-start"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Feature list, doubling as the tab triggers */}
      <TabsList variant="line" className="w-full h-fit flex-col items-stretch gap-2 bg-transparent p-0">
        {TAB_VALUES.map(value => {
          const Icon = TAB_ICONS[value]
          return (
            <TabsTrigger key={value} value={value} className={triggerClassName}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">{t(`items.${value}.title`)}</span>
                <span className="text-sm text-muted-foreground">{t(`items.${value}.description`)}</span>
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      {/* Fixed-height preview panel, no frame */}
      <div className="h-[340px] w-full flex items-center justify-center overflow-hidden select-none">
        <TabsContent value="expenses" className="w-full max-w-xs">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={PREVIEW_TRANSITION}
            className="rounded-lg border border-border bg-card p-4 shadow-xs flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Dinner</p>
                <p className="text-xs text-muted-foreground">{tHome('preview.paidBy', { name: 'Anna' })}</p>
              </div>
              <p className="text-base font-semibold text-foreground tabular-nums shrink-0">320 kr</p>
            </div>

            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {SPLIT_METHOD_KEYS.map(key => (
                <span
                  key={key}
                  className={
                    key === ACTIVE_SPLIT_METHOD
                      ? 'flex-1 rounded-md bg-card py-1.5 text-center text-xs font-medium text-foreground shadow-xs'
                      : 'flex-1 rounded-md py-1.5 text-center text-xs text-muted-foreground'
                  }
                >
                  {tExpense(key)}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2.5">
              {SPLIT_MEMBERS.map(({ name, amount }) => {
                const label = name === 'you' ? tHome('preview.you') : name
                return (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={label} size="sm" />
                      <span className="text-sm text-foreground truncate">{label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">{amount}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="balances" className="w-full max-w-xs">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={PREVIEW_TRANSITION}
            className="flex flex-col gap-2"
          >
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm">
                <span className="font-medium">Björn</span> {tBalance('owes')} <span className="font-medium">{tCommon('you')}</span>
              </p>
              <p className="text-base font-semibold tabular-nums">145 kr</p>
              <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Dinner <span className="tabular-nums">· 95 kr</span></p>
                <p className="text-xs text-muted-foreground">Concert tickets <span className="tabular-nums">· 50 kr</span></p>
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm">
                <span className="font-medium">{tCommon('You')}</span> {tBalance('owe')} <span className="font-medium">Anna</span>
              </p>
              <p className="text-base font-semibold tabular-nums">60 kr</p>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="stats" className="w-full flex items-center justify-center">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={PREVIEW_TRANSITION}
          >
            <CategorySpendingChart data={STATS_DATA} currency="kr" locale={intlLocale} />
          </motion.div>
        </TabsContent>

        <TabsContent value="currencies" className="w-full max-w-xs">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={PREVIEW_TRANSITION}
            className="flex flex-col gap-2"
          >
            <div className="w-full flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 border border-border shadow-xs">
              <CategoryIcon category="accommodation" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Hotel</p>
                <p className="text-xs text-muted-foreground">{tHome('preview.paidBy', { name: 'Anna' })}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground tabular-nums">90 €</p>
                <p className="text-xs text-muted-foreground/60 tabular-nums">≈ 995 kr</p>
              </div>
            </div>
            <div className="w-full flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 border border-border shadow-xs">
              <CategoryIcon category="entertainment" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Museum tickets</p>
                <p className="text-xs text-muted-foreground">{tHome('preview.paidBy', { name: tCommon('you') })}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground tabular-nums">25 £</p>
                <p className="text-xs text-muted-foreground/60 tabular-nums">≈ 340 kr</p>
              </div>
            </div>
            <div className="w-full flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 border border-border shadow-xs">
              <CategoryIcon category="settlement" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ts('paidSubtitle', { payer: 'Björn', payee: 'Anna' })}</p>
                <p className="text-xs text-muted-foreground">{tHome('preview.settlement')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-muted-foreground tabular-nums">50 $</p>
                <p className="text-xs text-muted-foreground/60 tabular-nums">≈ 550 kr</p>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </div>
    </Tabs>
  )
}
