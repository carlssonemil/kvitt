'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

const TABS = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'balances', label: 'Balances' },
  { value: 'stats', label: 'Stats' },
  { value: 'settings', label: 'Settings' },
] as const

type TabValue = typeof TABS[number]['value']

const VALID_TABS = new Set(TABS.map(t => t.value))

interface GroupTabsProps {
  children: React.ReactNode
  counts?: Partial<Record<string, number>>
}

export function GroupTabs({ children, counts }: GroupTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialTab = (() => {
    const t = searchParams.get('tab')
    return t && VALID_TABS.has(t as TabValue) ? t as TabValue : 'expenses'
  })()

  const [tab, setTab] = useState<string>(initialTab)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const active = wrapper.querySelector('[data-state="active"]') as HTMLElement | null
    if (!active) return
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [tab])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function check() {
      if (!el) return
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }

    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])

  function handleTabChange(value: string) {
    setTab(value)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
      <div className="border-b border-border mb-3">
        <div className="relative">
          <div
            ref={scrollRef}
            className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div ref={wrapperRef} className="relative">
              <TabsList
                variant="line"
                className="w-full justify-start [&>[data-slot=tabs-trigger]]:flex-none"
              >
                {TABS.map(t => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                    {counts?.[t.value] != null && (
                      <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1.5">
                        {counts[t.value]}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {indicator && (
                <div
                  className="absolute bottom-0 h-0.5 bg-foreground transition-all duration-200 ease-in-out"
                  style={{ left: indicator.left, width: indicator.width }}
                />
              )}
            </div>
          </div>
          <div
            className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none bg-gradient-to-l from-background to-transparent transition-opacity duration-200"
            style={{ opacity: canScrollRight ? 1 : 0 }}
          />
        </div>
      </div>
      {children}
    </Tabs>
  )
}
