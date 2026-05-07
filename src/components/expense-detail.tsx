'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2Icon, PencilIcon, CheckIcon, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Currency } from '@/components/currency'
import { UserAvatar } from '@/components/user-avatar'
import { getCategoryIcon, EXPENSE_CATEGORIES } from '@/lib/categories'
import { deleteExpense, updateExpense } from '@/actions/expense-actions'
import { SUPPORTED_CURRENCIES, type SplitType } from '@/lib/constants'
import type { ExpenseWithPayer } from '@/types/database'
import { useTranslations, useLocale } from 'next-intl'

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
}

interface ExpenseDetailProps {
  expense: ExpenseWithPayer
  groupId: string
  currentUserId: string
  members: Member[]
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function ExpenseDetail({ expense, groupId, currentUserId, members, open, onOpenChange }: ExpenseDetailProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const t = useTranslations('expense')
  const tc = useTranslations('common')
  const tcat = useTranslations('categories')
  const locale = useLocale()
  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'

  // Edit form state — initialized from expense
  const [amountStr, setAmountStr] = useState(String(expense.amount))
  const [selectedCurrency, setSelectedCurrency] = useState(expense.currency)
  const [paidBy, setPaidBy] = useState(expense.paid_by)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(expense.date))
  const [category, setCategory] = useState<string | null>(expense.category)
  const [splitType, setSplitType] = useState<SplitType>('exact')
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const split of expense.splits) {
      init[split.user_id] = String(split.amount)
    }
    return init
  })
  const [equalSelected, setEqualSelected] = useState<Set<string>>(
    () => new Set(expense.splits.map(s => s.user_id))
  )
  const [percentages, setPercentages] = useState<Record<string, string>>({})

  const amount = parseFloat(amountStr) || 0

  const equalSplits = useMemo(
    () => computeEqualSplits(amount, [...equalSelected]),
    [amount, equalSelected]
  )

  const exactTotal = Object.values(exactAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const exactRemaining = Math.round((amount - exactTotal) * 100) / 100

  const pctTotal = Object.values(percentages).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const pctRemaining = Math.round((100 - pctTotal) * 100) / 100

  function toggleMember(id: string) {
    setEqualSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function enterEdit() {
    setAmountStr(String(expense.amount))
    setSelectedCurrency(expense.currency)
    setPaidBy(expense.paid_by)
    setSelectedDate(new Date(expense.date))
    setCategory(expense.category)
    setSplitType('exact')
    const init: Record<string, string> = {}
    for (const split of expense.splits) {
      init[split.user_id] = String(split.amount)
    }
    setExactAmounts(init)
    setEqualSelected(new Set(expense.splits.map(s => s.user_id)))
    setPercentages({})
    setIsEditing(true)
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) setIsEditing(false)
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
    const splits: Record<string, number> = {}
    for (const m of members) {
      const pct = parseFloat(percentages[m.id] ?? '0') || 0
      if (pct > 0) splits[m.id] = Math.round((pct / 100) * amount * 100) / 100
    }
    return splits
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const splits = buildSplits()
    if (!splits) {
      toast.error(t('noMembersError'))
      return
    }

    const formData = new FormData(e.currentTarget)
    formData.set('expense_id', expense.id)
    formData.set('group_id', groupId)
    formData.set('currency', selectedCurrency)
    formData.set('paid_by', paidBy)
    formData.set('date', format(selectedDate, 'yyyy-MM-dd'))
    formData.set('splits', JSON.stringify(splits))
    if (category) formData.set('category', category)
    else formData.delete('category')

    startTransition(async () => {
      const result = await updateExpense(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('updatedToast'))
      setIsEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    const formData = new FormData()
    formData.set('expense_id', expense.id)
    formData.set('group_id', groupId)
    startTransition(async () => {
      const result = await deleteExpense(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('deletedToast'))
      onOpenChange(false)
      router.refresh()
    })
  }

  const categoryLabel = expense.category === 'settlement'
    ? t('settlementLabel')
    : expense.category
      ? tcat(expense.category as Parameters<typeof tcat>[0])
      : tcat('uncategorized')

  const CategoryIcon = getCategoryIcon(expense.category)
  const payerName = expense.paid_by === currentUserId ? tc('you') : expense.paid_by_name

  const title = (
    <div className="flex flex-col gap-0.5">
      <span className="text-xl font-semibold text-foreground">{expense.title}</span>
      <span className="text-sm font-normal text-muted-foreground">{t('paidBySubtitle', { name: payerName })}</span>
    </div>
  )

  if (isEditing) {
    const footer = (
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsEditing(false)} disabled={isPending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" form="expense-edit-form" className="flex-1 sm:flex-none" disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    )

    return (
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange} title={t('editTitle')} footer={footer}>
        <form id="expense-edit-form" onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-exp-title">{t('titleLabel')}</Label>
            <Input id="edit-exp-title" name="title" required defaultValue={expense.title} disabled={isPending} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-exp-amount">{t('amountLabel')}</Label>
              <Input
                id="edit-exp-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('currencyLabel')}</Label>
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
              <Label>{t('paidByLabel')}</Label>
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
              <Label>{t('dateLabel')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal" disabled={isPending}>
                    <CalendarIcon className="size-4 mr-2 shrink-0" />
                    {selectedDate.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={date => date && setSelectedDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-exp-note">
              {t('noteLabel')} <span className="text-muted-foreground font-normal">{tc('optional')}</span>
            </Label>
            <Input id="edit-exp-note" name="note" placeholder={t('notePlaceholder')} defaultValue={expense.note ?? ''} disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              {t('categoryLabel')} <span className="text-muted-foreground font-normal">{tc('optional')}</span>
            </Label>
            <Select value={category ?? 'none'} onValueChange={v => setCategory(v === 'none' ? null : v)} disabled={isPending}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noCategory')}</SelectItem>
                {[...EXPENSE_CATEGORIES].sort((a, b) => tcat(a.key).localeCompare(tcat(b.key), intlLocale)).map(({ key, icon: Icon }) => (
                  <SelectItem key={key} value={key}>
                    <Icon className="size-4" />
                    {tcat(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>{t('splitLabel')}</Label>
              <Select value={splitType} onValueChange={v => setSplitType(v as SplitType)} disabled={isPending}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">{t('splitEqual')}</SelectItem>
                  <SelectItem value="exact">{t('splitExact')}</SelectItem>
                  <SelectItem value="percentage">{t('splitPercentage')}</SelectItem>
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
                      }`} aria-hidden="true">
                        {included && <CheckIcon className="size-3" />}
                      </div>
                      <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                      <span className="flex-1 text-left">{m.display_name}</span>
                      {included && (
                        <span className="text-muted-foreground tabular-nums text-xs">
                          {equalSelected.size > 0 ? Math.round(100 / equalSelected.size) : 0}%
                          {amount > 0 && ` · ${(equalSplits[m.id] ?? 0).toFixed(2)} ${selectedCurrency}`}
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
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-28"
                      value={exactAmounts[m.id] ?? ''}
                      onChange={e => setExactAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                      disabled={isPending}
                    />
                  </div>
                ))}
                <p className={`text-xs ${Math.abs(exactRemaining) > 0.01 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {t('exactRemaining', { remaining: exactRemaining.toFixed(2), currency: selectedCurrency })}
                </p>
              </div>
            )}

            {splitType === 'percentage' && (
              <div className="flex flex-col gap-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                    <span className="text-sm flex-1">{m.display_name}</span>
                    <div className="flex items-center gap-1 w-28">
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
                  </div>
                ))}
                <p className={`text-xs ${Math.abs(pctRemaining) > 0.01 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {t('pctRemaining', { remaining: pctRemaining.toFixed(1) })}
                </p>
              </div>
            )}
          </div>
        </form>
      </ResponsiveDialog>
    )
  }

  const footer = (
    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
      <Button variant="outline" className="flex-1 sm:flex-none" onClick={enterEdit} disabled={isPending}>
        <PencilIcon className="size-4" />
        {tc('edit')}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" className="flex-1 sm:flex-none" disabled={isPending}>
            <Trash2Icon className="size-4" />
            {t('deleteConfirm')}
          </Button>
        }
        title={t('deleteTitle')}
        description={t('deleteDesc', { title: expense.title })}
        confirmLabel={t('deleteConfirm')}
        variant="destructive"
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex gap-10">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t('amountLabel')}</span>
              <Currency amount={Number(expense.amount)} currency={expense.currency} className="font-semibold" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t('categoryLabel')}</span>
              <span className="flex items-center gap-1.5">
                <CategoryIcon className="size-3.5 text-muted-foreground" />
                {categoryLabel}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t('dateLabel')}</span>
              <span>{new Date(expense.date).toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
          {expense.note && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t('noteLabel')}</span>
              <span>{expense.note}</span>
            </div>
          )}
        </div>

        {expense.splits.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t('splitBetween')}</p>
            <div className="flex flex-col gap-1.5">
              {expense.splits.map(split => (
                <div key={split.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={split.user_display_name} avatarUrl={split.user_avatar} size="xs" />
                    <span className="text-sm">
                      {split.user_id === currentUserId ? tc('you') : split.user_display_name}
                    </span>
                  </div>
                  <Currency
                    amount={Number(split.amount)}
                    currency={expense.currency}
                    className="text-sm text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
