'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2Icon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Currency } from '@/components/currency'
import { UserAvatar } from '@/components/user-avatar'
import { deleteSettlement, updateSettlement } from '@/actions/settlement-actions'
import type { SettlementWithUsers } from '@/lib/queries'

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
}

interface SettlementDetailProps {
  settlement: SettlementWithUsers
  groupId: string
  currentUserId: string
  currency: string
  members: Member[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
}

export function SettlementDetail({ settlement, groupId, currentUserId, currency, members, open, onOpenChange }: SettlementDetailProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [paidBy, setPaidBy] = useState(settlement.paid_by)
  const [paidTo, setPaidTo] = useState(settlement.paid_to)

  function enterEdit() {
    setPaidBy(settlement.paid_by)
    setPaidTo(settlement.paid_to)
    setIsEditing(true)
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) setIsEditing(false)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('settlement_id', settlement.id)
    formData.set('group_id', groupId)
    formData.set('paid_by', paidBy)
    formData.set('paid_to', paidTo)

    startTransition(async () => {
      const result = await updateSettlement(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Settlement updated')
      setIsEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    const formData = new FormData()
    formData.set('settlement_id', settlement.id)
    formData.set('group_id', groupId)
    startTransition(async () => {
      const result = await deleteSettlement(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Settlement removed')
      onOpenChange(false)
      router.refresh()
    })
  }

  if (isEditing) {
    const footer = (
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsEditing(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="settlement-edit-form" className="flex-1 sm:flex-none" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    )

    return (
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange} title="Edit settlement" footer={footer}>
        <form id="settlement-edit-form" onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Who paid</Label>
              <Select value={paidBy} onValueChange={setPaidBy} disabled={isPending} required>
                <SelectTrigger className="w-full">
                  {(() => {
                    const m = members.find(m => m.id === paidBy)
                    return m ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                        <span>{m.display_name}</span>
                      </div>
                    ) : <SelectValue placeholder="Select person" />
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Who received</Label>
              <Select value={paidTo} onValueChange={setPaidTo} disabled={isPending} required>
                <SelectTrigger className="w-full">
                  {(() => {
                    const m = members.find(m => m.id === paidTo)
                    return m ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                        <span>{m.display_name}</span>
                      </div>
                    ) : <SelectValue placeholder="Select person" />
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <UserAvatar name={m.display_name} avatarUrl={m.avatar_url} size="xs" />
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-settle-amount">Amount ({settlement.currency})</Label>
            <Input
              id="edit-settle-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={settlement.amount.toFixed(2)}
              disabled={isPending}
            />
            <input type="hidden" name="currency" value={settlement.currency} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-settle-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-settle-note"
              name="note"
              placeholder="e.g. Cash payment"
              defaultValue={settlement.note ?? ''}
              disabled={isPending}
            />
          </div>
        </form>
      </ResponsiveDialog>
    )
  }

  const footer = (
    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
      <Button variant="outline" className="flex-1 sm:flex-none" onClick={enterEdit} disabled={isPending}>
        <PencilIcon className="size-4" />
        Edit
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" className="flex-1 sm:flex-none" disabled={isPending}>
            <Trash2Icon className="size-4" />
            Remove
          </Button>
        }
        title="Remove settlement?"
        description={`This will remove the recorded settlement between ${settlement.paid_by_name} and ${settlement.paid_to_name}.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  )

  const payerName = settlement.paid_by === currentUserId ? 'You' : settlement.paid_by_name
  const payeeName = settlement.paid_to === currentUserId ? 'you' : settlement.paid_to_name

  const title = (
    <div className="flex flex-col gap-0.5">
      <span className="text-xl font-semibold text-foreground">Settlement</span>
      <span className="text-sm font-normal text-muted-foreground">{payerName} paid {payeeName}</span>
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
        {/* Metadata */}
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex gap-10">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Amount</span>
              <Currency amount={Number(settlement.amount)} currency={settlement.currency} className="font-semibold" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Date</span>
              <span>{formatDate(settlement.created_at)}</span>
            </div>
            {settlement.note && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Note</span>
                <span>{settlement.note}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
