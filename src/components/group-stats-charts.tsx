"use client"

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/components/currency"
import { getCategoryIcon, EXPENSE_CATEGORIES } from "@/lib/categories"
import { useTranslations } from 'next-intl'

// ── Payment split pie chart ───────────────────────────────────────────────────

interface PaymentSplitChartProps {
  data: { user_id: string; name: string; total: number }[]
  currency: string
}

function sliceColor(index: number, total: number) {
  // Distribute opacity evenly from 1.0 down to 0.2
  const min = 0.2
  const opacity = total <= 1 ? 1 : 1 - (index / (total - 1)) * (1 - min)
  return `color-mix(in oklch, var(--primary) ${Math.round(opacity * 100)}%, transparent)`
}

export function PaymentSplitChart({ data, currency }: PaymentSplitChartProps) {
  const total = data.reduce((sum, p) => sum + p.total, 0)

  const chartConfig = Object.fromEntries(
    data.map((p, i) => [p.user_id, { label: p.name, color: sliceColor(i, data.length) }])
  ) satisfies ChartConfig

  const chartData = data.map((p, i) => ({
    ...p,
    fill: sliceColor(i, data.length),
  }))

  return (
    <div className="flex flex-col items-center gap-4">
      <ChartContainer config={chartConfig} className="h-[180px] w-[180px] shrink-0">
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const entry = payload[0]
              const name = (entry.payload as { name: string }).name
              const value = entry.value as number
              const pct = Math.round((value / total) * 100)
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs flex flex-col gap-1">
                  <p className="font-medium">{name}</p>
                  <p className="text-muted-foreground">
                    {formatCurrency(value)} {currency}{' '}
                    <span className="text-foreground font-medium">({pct}%)</span>
                  </p>
                </div>
              )
            }}
          />
          <Pie data={chartData} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80}>
            {chartData.map((entry) => (
              <Cell key={entry.user_id} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 w-full">
        {data.map((p, i) => {
          const pct = Math.round((p.total / total) * 100)
          return (
            <div key={p.user_id} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: sliceColor(i, data.length) }}
              />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
              <span className="tabular-nums font-medium w-20 text-right">
                {formatCurrency(p.total)} {currency}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Category spending pie chart ───────────────────────────────────────────────

interface CategorySpendingChartProps {
  data: { category: string | null; total: number }[]
  currency: string
}

const CATEGORY_KEYS = new Set(['settlement', 'uncategorized', ...EXPENSE_CATEGORIES.map(c => c.key)])

export function CategorySpendingChart({ data, currency }: CategorySpendingChartProps) {
  const tcat = useTranslations('categories')
  const getCatLabel = (cat: string | null) => {
    const key = cat && CATEGORY_KEYS.has(cat) ? cat : 'uncategorized'
    return tcat(key as Parameters<typeof tcat>[0])
  }

  const total = data.reduce((sum, p) => sum + p.total, 0)

  const chartConfig = Object.fromEntries(
    data.map((p, i) => [p.category ?? 'uncategorized', { label: getCatLabel(p.category), color: sliceColor(i, data.length) }])
  ) satisfies ChartConfig

  const chartData = data.map((p, i) => ({
    ...p,
    label: getCatLabel(p.category),
    fill: sliceColor(i, data.length),
  }))

  return (
    <div className="flex flex-col items-center gap-4">
      <ChartContainer config={chartConfig} className="h-[180px] w-[180px] shrink-0">
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const entry = payload[0]
              const p = entry.payload as { label: string; category: string | null; fill: string }
              const value = entry.value as number
              const pct = Math.round((value / total) * 100)
              const Icon = getCategoryIcon(p.category)
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs flex flex-col gap-1">
                  <p className="font-medium flex items-center gap-1.5">
                    <Icon className="size-3 shrink-0" style={{ color: p.fill }} />
                    {p.label}
                  </p>
                  <p className="text-muted-foreground">
                    {formatCurrency(value)} {currency}{' '}
                    <span className="text-foreground font-medium">({pct}%)</span>
                  </p>
                </div>
              )
            }}
          />
          <Pie data={chartData} dataKey="total" nameKey="label" innerRadius={50} outerRadius={80}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 w-full">
        {chartData.map((p, i) => {
          const pct = Math.round((p.total / total) * 100)
          const Icon = getCategoryIcon(p.category)
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Icon className="size-3 shrink-0" style={{ color: sliceColor(i, data.length) }} />
              <span className="flex-1 truncate">{p.label}</span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
              <span className="tabular-nums font-medium w-20 text-right">
                {formatCurrency(p.total)} {currency}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Monthly spending bar chart ────────────────────────────────────────────────

interface MonthlySpendingChartProps {
  data: { month: string; total: number }[]
  currency: string
}

const monthlyChartConfig = {
  total: { label: "Spending", color: "var(--primary)" },
} satisfies ChartConfig

export function MonthlySpendingChart({ data, currency }: MonthlySpendingChartProps) {
  return (
    <ChartContainer config={monthlyChartConfig} className="h-[180px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => `${formatCurrency(value as number)} ${currency}`}
            />
          }
        />
        <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
