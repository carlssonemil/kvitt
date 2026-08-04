'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2Icon, CheckIcon, LoaderCircleIcon, CopyIcon, RefreshCwIcon, LinkIcon, ArchiveIcon, ArchiveRestoreIcon, UserPlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/user-avatar'
import { updateGroup, deleteGroup, regenerateInviteCode, hideGroup, unhideGroup } from '@/actions/group-actions'
import { removeMember, addGuest, getGuestClaimLink } from '@/actions/member-actions'
import { SUPPORTED_CURRENCIES, ROUTES } from '@/lib/constants'
import { useTranslations } from 'next-intl'

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
  is_guest: boolean
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
  hiddenAt: string | null
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
  hiddenAt,
}: GroupSettingsProps) {
  const router = useRouter()
  const [name, setName] = useState(groupName)
  const [description, setDescription] = useState(groupDescription ?? '')
  const [currency, setCurrency] = useState(groupCurrency)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()
  const [isRemoving, setIsRemoving] = useTransition()
  const [isRegenerating, startRegenerating] = useTransition()
  const [isTogglingHidden, startTogglingHidden] = useTransition()
  const [isCopyingClaim, startCopyingClaim] = useTransition()
  const [copyingClaimId, setCopyingClaimId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [guestName, setGuestName] = useState('')
  const [isAddingGuest, startAddingGuest] = useTransition()
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const guestNameInputRef = useRef<HTMLInputElement>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = useTranslations('groupSettings')
  const tc = useTranslations('common')

  function handleCopyInviteLink() {
    const url = `${window.location.origin}/invite/${inviteCode}`
    navigator.clipboard.writeText(url)
    toast.success(t('inviteLinkCopied'))
  }

  function handleCopyClaimLink(memberId: string) {
    setCopyingClaimId(memberId)
    startCopyingClaim(async () => {
      const result = await getGuestClaimLink(groupId, memberId)
      setCopyingClaimId(null)
      if (result.error || !result.claimToken) {
        toast.error(result.error ?? t('claimLinkCopyFailed'))
        return
      }
      const url = `${window.location.origin}${ROUTES.CLAIM(result.claimToken)}`
      navigator.clipboard.writeText(url)
      toast.success(t('claimLinkCopied'))
    })
  }

  function handleRegenerate() {
    startRegenerating(async () => {
      const result = await regenerateInviteCode(groupId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setInviteCode(result.inviteCode!)
      toast.success(t('inviteLinkRegenerated'))
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
      toast.success(t('groupDeleted'))
      router.push(ROUTES.GROUPS)
    })
  }

  function handleToggleHidden() {
    startTogglingHidden(async () => {
      const result = hiddenAt ? await unhideGroup(groupId) : await hideGroup(groupId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(hiddenAt ? t('groupUnhidden') : t('groupHidden'))
      router.refresh()
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
      toast.success(t('memberRemoved'))
      router.refresh()
    })
  }

  function handleAddGuest() {
    if (!guestName.trim()) return
    const formData = new FormData()
    formData.set('group_id', groupId)
    formData.set('name', guestName)

    startAddingGuest(async () => {
      const result = await addGuest(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setGuestName('')
      guestNameInputRef.current?.focus()
      toast.success(t('guestAdded'))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{t('groupDetails')}</h2>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircleIcon className="size-3 animate-spin" /> {t('saving')}
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckIcon className="size-3" /> {t('saved')}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-name">{t('nameLabel')}</Label>
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
              {t('descriptionLabel')} <span className="text-muted-foreground font-normal">{tc('optional')}</span>
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
            <Label>{t('currencyLabel')}</Label>
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

      <section>
        <h2 className="text-sm font-semibold mb-4">{t('membersLabel')}</h2>
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border bg-muted/30">
          <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono truncate flex-1">
            {typeof window !== 'undefined' ? `${window.location.origin}/invite/${inviteCode}` : `/invite/${inviteCode}`}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleCopyInviteLink} aria-label={t('copyInviteLink')}>
                <CopyIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('copyInviteLinkTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <ConfirmDialog
              trigger={
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" disabled={isRegenerating} aria-label={t('regenerateLabel')}>
                    <RefreshCwIcon className={`size-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
              }
              title={t('regenerateTitle')}
              description={t('regenerateDesc')}
              confirmLabel={t('regenerateConfirm')}
              cancelLabel={tc('cancel')}
              onConfirm={handleRegenerate}
              isPending={isRegenerating}
            />
            <TooltipContent>{t('regenerateTooltip')}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col gap-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={member.display_name} avatarUrl={member.avatar_url} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    {member.display_name}
                    {member.is_guest && <Badge variant="secondary">{t('guestBadge')}</Badge>}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {member.is_guest && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground"
                        disabled={isCopyingClaim && copyingClaimId === member.id}
                        onClick={() => handleCopyClaimLink(member.id)}
                      >
                        {isCopyingClaim && copyingClaimId === member.id
                          ? <LoaderCircleIcon className="size-3.5 animate-spin" />
                          : <CopyIcon className="size-3.5" />}
                        {t('copyClaimLink')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('copyClaimLinkTooltip', { name: member.display_name })}
                    </TooltipContent>
                  </Tooltip>
                )}
                {member.id !== createdBy && (
                  <Tooltip>
                    <ConfirmDialog
                      trigger={
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            disabled={isRemoving}
                            aria-label={t('removeMemberAriaLabel', { name: member.display_name })}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                      }
                      title={t('removeMemberTitle')}
                      description={t('removeMemberDesc', { name: member.display_name })}
                      confirmLabel={t('removeMemberConfirm')}
                      cancelLabel={tc('cancel')}
                      variant="destructive"
                      onConfirm={() => handleRemoveMember(member.id)}
                      isPending={isRemoving}
                    />
                    <TooltipContent>{t('removeMemberAriaLabel', { name: member.display_name })}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
          <Dialog
            open={guestDialogOpen}
            onOpenChange={next => { if (!isAddingGuest) setGuestDialogOpen(next) }}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <UserPlusIcon className="size-3.5" />
                {t('addGuestTrigger')}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('addGuestDialogTitle')}</DialogTitle>
                <DialogDescription>{t('addGuestDialogDescription')}</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={e => { e.preventDefault(); handleAddGuest() }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gs-guest-name">{t('addGuestLabel')}</Label>
                  <Input
                    id="gs-guest-name"
                    ref={guestNameInputRef}
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder={t('addGuestPlaceholder')}
                    disabled={isAddingGuest}
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isAddingGuest || !guestName.trim()}>
                    {isAddingGuest
                      ? <LoaderCircleIcon className="size-3.5 animate-spin" />
                      : <UserPlusIcon className="size-3.5" />}
                    {t('addGuestButton')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-sm font-semibold mb-2">{hiddenAt ? t('unhideGroup') : t('hideGroup')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {hiddenAt ? t('unhideGroupDesc') : t('hideGroupDesc')}
        </p>
        <Button variant="outline" onClick={handleToggleHidden} disabled={isTogglingHidden}>
          {hiddenAt ? <ArchiveRestoreIcon className="size-4" /> : <ArchiveIcon className="size-4" />}
          {hiddenAt ? t('unhideGroup') : t('hideGroup')}
        </Button>
      </section>

      {currentUserId === createdBy && (
        <>
          <Separator />
          <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-destructive mb-2">{t('dangerZone')}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('deleteGroupDesc')}
            </p>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" disabled={isPending}>
                  <Trash2Icon className="size-4" />
                  {t('deleteGroupButton')}
                </Button>
              }
              title={t('deleteGroupTitle')}
              description={t('deleteGroupDesc')}
              confirmLabel={t('deleteGroupConfirm')}
              cancelLabel={tc('cancel')}
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
