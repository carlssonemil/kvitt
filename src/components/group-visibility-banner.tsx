'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArchiveIcon, ArchiveRestoreIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hideGroup, unhideGroup } from '@/actions/group-actions'
import { useTranslations } from 'next-intl'

interface GroupVisibilityBannerProps {
  groupId: string
  hidden: boolean
}

export function GroupVisibilityBanner({ groupId, hidden }: GroupVisibilityBannerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('group')
  const ts = useTranslations('groupSettings')

  function handleToggle() {
    startTransition(async () => {
      const result = hidden ? await unhideGroup(groupId) : await hideGroup(groupId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(hidden ? ts('groupUnhidden') : ts('groupHidden'))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 mt-3">
      <p className="text-sm text-muted-foreground">{hidden ? t('hiddenNotice') : t('inactiveHintBody')}</p>
      <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={handleToggle} disabled={isPending}>
        {hidden ? <ArchiveRestoreIcon className="size-3.5" /> : <ArchiveIcon className="size-3.5" />}
        {hidden ? ts('unhideGroup') : ts('hideGroup')}
      </Button>
    </div>
  )
}
