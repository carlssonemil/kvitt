'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2Icon, CheckIcon, LoaderCircleIcon, CopyIcon, RefreshCwIcon, LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UserAvatar } from '@/components/user-avatar'
import { updateGroup, deleteGroup, regenerateInviteCode } from '@/actions/group-actions'
import { removeMember } from '@/actions/member-actions'
import { SUPPORTED_CURRENCIES, ROUTES } from '@/lib/constants'

interface Member {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
}

interface GroupSettingsProps {
  groupId: string
  groupName: string
  groupDescription: string | null
  groupCurrency: string
  createdBy: string
  inviteCode: string
  members: Member[]
  currentUserId: string
}

export function GroupSettings({
  groupId,
  groupName,
  groupDescription,
  groupCurrency,
  createdBy,
  inviteCode: initialInviteCode,
  members,
  currentUserId,
}: GroupSettingsProps) {
  const router = useRouter()
  const [name, setName] = useState(groupName)
  const [description, setDescription] = useState(groupDescription ?? '')
  const [currency, setCurrency] = useState(groupCurrency)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()
  const [isRemoving, setIsRemoving] = useTransition()
  const [isRegenerating, startRegenerating] = useTransition()
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopyInviteLink() {
    const url = `${window.location.origin}/invite/${inviteCode}`
    navigator.clipboard.writeText(url)
    toast.success('Invite link copied')
  }

  function handleRegenerate() {
    startRegenerating(async () => {
      const result = await regenerateInviteCode(groupId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setInviteCode(result.inviteCode!)
      toast.success('Invite link regenerated')
    })
  }

  function save(overrides?: { name?: string; description?: string; currency?: string }) {
    const formData = new FormData()
    formData.set('group_id', groupId)
    formData.set('name', overrides?.name ?? name)
    formData.set('description', overrides?.description ?? description)
    formData.set('currency', overrides?.currency ?? currency)

    setSaveStatus('saving')
    startTransition(async () => {
      const result = await updateGroup(formData)
      if (result.error) {
        setSaveStatus('idle')
        toast.error(result.error)
        return
      }
      setSaveStatus('saved')
      router.refresh()
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    })
  }

  function handleDelete() {
    const formData = new FormData()
    formData.set('group_id', groupId)

    startTransition(async () => {
      const result = await deleteGroup(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Group deleted')
      router.push(ROUTES.GROUPS)
    })
  }

  function handleRemoveMember(userId: string) {
    const formData = new FormData()
    formData.set('group_id', groupId)
    formData.set('user_id', userId)

    setIsRemoving(async () => {
      const result = await removeMember(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Member removed')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Edit group */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Group details</h2>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircleIcon className="size-3 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckIcon className="size-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-name">Name</Label>
            <Input
              id="gs-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => save()}
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-desc">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="gs-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => save()}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Select
              value={currency}
              onValueChange={val => { setCurrency(val); save({ currency: val }) }}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold mb-4">Members</h2>
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border bg-muted/30">
          <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono truncate flex-1">
            {typeof window !== 'undefined' ? `${window.location.origin}/invite/${inviteCode}` : `/invite/${inviteCode}`}
          </span>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleCopyInviteLink} aria-label="Copy invite link">
            <CopyIcon className="size-3.5" />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" disabled={isRegenerating} aria-label="Regenerate invite link">
                <RefreshCwIcon className={`size-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              </Button>
            }
            title="Regenerate invite link?"
            description="The old link will stop working. Anyone who hasn't joined yet will need the new link."
            confirmLabel="Regenerate"
            onConfirm={handleRegenerate}
            isPending={isRegenerating}
          />
        </div>
        <div className="flex flex-col gap-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={member.display_name} avatarUrl={member.avatar_url} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{member.display_name}</span>
                </div>
              </div>
              {member.id !== createdBy && (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      disabled={isRemoving}
                      aria-label={`Remove ${member.display_name}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  }
                  title="Remove member?"
                  description={`Remove ${member.display_name} from this group?`}
                  confirmLabel="Remove"
                  variant="destructive"
                  onConfirm={() => handleRemoveMember(member.id)}
                  isPending={isRemoving}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {currentUserId === createdBy && (
        <>
          <Separator />
          <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-destructive mb-2">Danger zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete this group and all its expenses. This cannot be undone.
            </p>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" disabled={isPending}>
                  <Trash2Icon className="size-4" />
                  Delete group
                </Button>
              }
              title="Delete group?"
              description="This will permanently delete the group and all its expenses and settlements. This cannot be undone."
              confirmLabel="Delete group"
              variant="destructive"
              onConfirm={handleDelete}
              isPending={isPending}
            />
          </section>
        </>
      )}
    </div>
  )
}
