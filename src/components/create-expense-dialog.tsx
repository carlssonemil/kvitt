'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { PlusIcon, CalendarIcon, CheckIcon } from 'lucide-react'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { UserAvatar } from '@/components/user-avatar'
import { createExpense } from '@/actions/expense-actions'
import { formatCurrency } from '@/components/currency'
import { SUPPORTED_CURRENCIES, type SplitType } from '@/lib/constants'

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
}

interface CreateExpenseDialogProps {
  groupId: string
  currency: string
  members: Member[]
  currentUserId: string
  triggerClassName?: string
}

function computeEqualSplits(amount: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) return {}
  const cents = Math.round(amount * 100)
  const perCents = Math.floor(cents / memberIds.length)
  const remainder = cents - perCents * memberIds.length
  const splits: Record<string, number> = {}
  memberIds.forEach((id, i) => {
    splits[id] = (perCents + (i < remainder ? 1 : 0)) / 100
  })
  return splits
}

export function CreateExpenseDialog({ groupId, currency, members, currentUserId, triggerClassName }: CreateExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [category, setCategory] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState(currency)
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [amountStr, setAmountStr] = useState('')
  const [equalSelected, setEqualSelected] = useState<Set<string>>(new Set(members.map(m => m.id)))
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [percentages, setPercentages] = useState<Record<string, string>>({})

  const amount = parseFloat(amountStr) || 0

  const equalSplits = useMemo(
    () => computeEqualSplits(amount, [...equalSelected]),
    [amount, equalSelected]
  )

  const exactTotal = Object.values(exactAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const exactRemaining = Math.round((amount - exactTotal) * 100) / 100
  const exactEmptyIds = members.map(m => m.id).filter(id => !exactAmounts[id])

  const pctTotal = Object.values(percentages).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const pctRemaining = Math.round((100 - pctTotal) * 100) / 100
  const pctEmptyIds = members.map(m => m.id).filter(id => !percentages[id])

  function distributeExactRemaining() {
    if (exactEmptyIds.length === 0 || exactRemaining <= 0) return
    const share = Math.floor((exactRemaining / exactEmptyIds.length) * 100) / 100
    const remainder = Math.round((exactRemaining - share * exactEmptyIds.length) * 100) / 100
    setExactAmounts(prev => {
      const next = { ...prev }
      exactEmptyIds.forEach((id, i) => {
        next[id] = i === 0 ? String(Math.round((share + remainder) * 100) / 100) : String(share)
      })
      return next
    })
  }

  function distributePctRemaining() {
    if (pctEmptyIds.length === 0 || pctRemaining <= 0) return
    const share = Math.floor((pctRemaining / pctEmptyIds.length) * 10) / 10
    const remainder = Math.round((pctRemaining - share * pctEmptyIds.length) * 10) / 10
    setPercentages(prev => {
      const next = { ...prev }
      pctEmptyIds.forEach((id, i) => {
        next[id] = i === 0 ? String(Math.round((share + remainder) * 10) / 10) : String(share)
      })
      return next
    })
  }

  function toggleMember(id: string) {
    setEqualSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resetForm() {
    setSplitType('equal')
    setCategory(null)
    setSelectedCurrency(currency)
    setPaidBy(currentUserId)
    setAmountStr('')
    setEqualSelected(new Set(members.map(m => m.id)))
    setExactAmounts({})
    setPercentages({})
    setSelectedDate(new Date())
  }

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next)
      if (!next) resetForm()
    }
  }

  function buildSplits(): Record<string, number> | null {
    if (splitType === 'equal') {
      if (equalSelected.size === 0) return null
      return equalSplits
    }
    if (splitType === 'exact') {
      const splits: Record<string, number> = {}
      for (const m of members) {
        const v = parseFloat(exactAmounts[m.id] ?? '0') || 0
        if (v > 0) splits[m.id] = v
      }
      return splits
    }
    // percentage
    const splits: Record<string, number> = {}
    for (const m of members) {
      const pct = parseFloat(percentages[m.id] ?? '0') || 0
      if (pct > 0) splits[m.id] = Math.round((pct / 100) * amount * 100) / 100
    }
    return splits
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const splits = buildSplits()
    if (!splits) {
      toast.error('Select at least one member for the split')
      return
    }

    const formData = new FormData(e.currentTarget)
    formData.set('group_id', groupId)
    formData.set('currency', selectedCurrency)
    formData.set('paid_by', paidBy)
    formData.set('date', format(selectedDate, 'yyyy-MM-dd'))
    formData.set('splits', JSON.stringify(splits))
    if (category) formData.set('category', category)

    startTransition(async () => {
      const result = await createExpense(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Expense added')
      setOpen(false)
      resetForm()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="xs" className={triggerClassName}>
          <PlusIcon className="size-4" />
          Add expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>Record a new expense for this group.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-title">Title</Label>
            <Input id="exp-title" name="title" required placeholder="e.g. Dinner at Luigi's" disabled={isPending} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-amount">Amount</Label>
              <Input
                id="exp-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency} disabled={isPending}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...SUPPORTED_CURRENCIES].sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy} disabled={isPending}>
                <SelectTrigger className="w-full">
                  {(() => {
                    const m = members.find(m => m.id === paidBy)
                    return m ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                        <span>{m.display_name}</span>
                      </div>
                    ) : <SelectValue />
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {[...members].sort((a, b) => a.display_name.localeCompare(b.display_name)).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal" disabled={isPending}>
                    <CalendarIcon className="size-4 mr-2 shrink-0" />
                    {format(selectedDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="exp-note" name="note" placeholder="Any details…" disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Category <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={category ?? 'none'} onValueChange={v => setCategory(v === 'none' ? null : v)} disabled={isPending}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {[...EXPENSE_CATEGORIES].sort((a, b) => a.label.localeCompare(b.label)).map(({ key, label, icon: Icon }) => (
                  <SelectItem key={key} value={key}>
                    <Icon className="size-4" />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Split</Label>
              <Select value={splitType} onValueChange={v => setSplitType(v as SplitType)} disabled={isPending}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal</SelectItem>
                  <SelectItem value="exact">Exact amounts</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {splitType === 'equal' && (
              <div className="flex flex-col gap-0.5">
                {members.map(m => {
                  const included = equalSelected.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="checkbox"
                      aria-checked={included}
                      onClick={() => toggleMember(m.id)}
                      disabled={isPending}
                      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <div className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                        included ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                      }`}>
                        {included && <CheckIcon className="size-3" />}
                      </div>
                      <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                      <span className="flex-1 text-left">{m.display_name}</span>
                      {included && (
                        <span className="text-muted-foreground tabular-nums text-xs">
                          {equalSelected.size > 0 ? Math.round(100 / equalSelected.size) : 0}%
                          {amount > 0 && ` (${formatCurrency(equalSplits[m.id] ?? 0)} ${selectedCurrency})`}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {splitType === 'exact' && (
              <div className="flex flex-col gap-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                    <span className="text-sm flex-1">{m.display_name}</span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        className="w-20"
                        value={exactAmounts[m.id] ?? ''}
                        onChange={e => setExactAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        disabled={isPending}
                      />
                      <span className="text-xs text-muted-foreground w-8">{selectedCurrency}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-end gap-2">
                  {exactEmptyIds.length > 0 && exactRemaining > 0.01 && (
                    <Button type="button" variant="outline" size="sm" onClick={distributeExactRemaining} className="h-6 rounded-full px-2.5 text-xs">
                      Split remaining
                    </Button>
                  )}
                  {Math.abs(exactRemaining) > 0.01 && (
                    <p className="text-xs text-destructive">
                      {formatCurrency(exactRemaining)} {selectedCurrency} left
                    </p>
                  )}
                </div>
              </div>
            )}

            {splitType === 'percentage' && (
              <div className="flex flex-col gap-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                    <span className="text-sm flex-1">{m.display_name}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 w-20">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={percentages[m.id] ?? ''}
                          onChange={e => setPercentages(prev => ({ ...prev, [m.id]: e.target.value }))}
                          disabled={isPending}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      {amount > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ({formatCurrency((parseFloat(percentages[m.id] ?? '0') || 0) / 100 * amount)} {selectedCurrency})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-end gap-2">
                  {pctEmptyIds.length > 0 && pctRemaining > 0.01 && (
                    <Button type="button" variant="outline" size="sm" onClick={distributePctRemaining} className="h-6 rounded-full px-2.5 text-xs">
                      Split remaining
                    </Button>
                  )}
                  {Math.abs(pctRemaining) > 0.01 && (
                    <p className="text-xs text-destructive">
                      {pctRemaining % 1 !== 0 ? pctRemaining.toFixed(1) : pctRemaining.toFixed(0)}% left
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
