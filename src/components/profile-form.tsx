'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { updateProfile, deleteAccount } from '@/actions/user-actions'
import { authClient } from '@/lib/auth/client'
import { ROUTES } from '@/lib/constants'
import { useTranslations } from 'next-intl'

interface ProfileFormProps {
  displayName: string
  email: string
}

export function ProfileForm({ displayName, email }: ProfileFormProps) {
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = useTranslations('profile')

  function save() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === displayName) return

    const formData = new FormData()
    formData.set('display_name', trimmed)

    setSaveStatus('saving')
    startTransition(async () => {
      const result = await updateProfile(formData)
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
    startDeleting(async () => {
      const result = await deleteAccount()
      if (result.error) {
        toast.error(result.error)
        return
      }
      await authClient.deleteUser().catch(() => {})
      await authClient.signOut()
      router.push(ROUTES.HOME)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between mb-4">
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
            <Label htmlFor="display_name">{t('displayNameLabel')}</Label>
            <Input
              id="display_name"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={save}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('emailLabel')}</Label>
            <Input value={email} readOnly disabled className="opacity-60" />
          </div>
        </div>
      </section>

      <Separator />

      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-destructive mb-2">{t('dangerZone')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t('dangerDesc')}
        </p>
        <ConfirmDialog
          trigger={
            <Button variant="destructive" disabled={isDeleting}>
              <Trash2Icon className="size-4" />
              {t('deleteAccount')}
            </Button>
          }
          title={t('deleteDialogTitle')}
          description={t('deleteDialogDesc')}
          confirmLabel={t('deleteConfirmLabel')}
          variant="destructive"
          onConfirm={handleDelete}
          isPending={isDeleting}
        />
      </section>
    </div>
  )
}
