'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createGroup } from '@/actions/group-actions'
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/lib/constants'

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('currency', currency)

    startTransition(async () => {
      const result = await createGroup(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Group created')
      setOpen(false)
      router.refresh()
    })
  }

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next)
      if (!next) setCurrency(DEFAULT_CURRENCY)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Create group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Give your group a name. You can invite others after it&apos;s created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Weekend trip"
              autoFocus
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="description"
              name="description"
              placeholder="What's this group for?"
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
