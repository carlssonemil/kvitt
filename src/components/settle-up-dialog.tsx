'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { HandCoinsIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSettlement } from '@/actions/settlement-actions'
import { useTranslations } from 'next-intl'

interface Member {
  id: string
  display_name: string
}

interface SettleUpDialogProps {
  groupId: string
  currency: string
  members: Member[]
  defaultFromId?: string
  defaultToId?: string
  defaultAmount?: number
  trigger?: React.ReactNode
}

export function SettleUpDialog({
  groupId,
  currency,
  members,
  defaultFromId,
  defaultToId,
  defaultAmount,
  trigger,
}: SettleUpDialogProps) {
  const [open, setOpen] = useState(false)
  const [paidBy, setPaidBy] = useState(defaultFromId ?? '')
  const [paidTo, setPaidTo] = useState(defaultToId ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const t = useTranslations('settleUp')
  const tc = useTranslations('common')

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next)
      if (next) {
        setPaidBy(defaultFromId ?? '')
        setPaidTo(defaultToId ?? '')
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('group_id', groupId)
    formData.set('paid_by', paidBy)
    formData.set('paid_to', paidTo)

    startTransition(async () => {
      const result = await createSettlement(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t('successToast'))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <HandCoinsIcon className="size-4" />
            {t('trigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('whoPaidLabel')}</Label>
            <Select value={paidBy} onValueChange={setPaidBy} disabled={isPending} required>
              <SelectTrigger>
                <SelectValue placeholder={tc('selectPerson')} />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('whoReceivedLabel')}</Label>
            <Select value={paidTo} onValueChange={setPaidTo} disabled={isPending} required>
              <SelectTrigger>
                <SelectValue placeholder={tc('selectPerson')} />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settle-amount">{t('amountLabel', { currency })}</Label>
            <Input
              id="settle-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={defaultAmount?.toFixed(2)}
              disabled={isPending}
            />
            <input type="hidden" name="currency" value={currency} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settle-note">
              {t('noteLabel')} <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="settle-note"
              name="note"
              placeholder="e.g. Cash payment"
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
