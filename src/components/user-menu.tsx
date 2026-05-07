'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOutIcon, UserIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/user-avatar'
import { authClient } from '@/lib/auth/client'
import { ROUTES } from '@/lib/constants'
import { useTranslations } from 'next-intl'

interface UserMenuProps {
  name: string
  avatarUrl?: string | null
}

export function UserMenu({ name, avatarUrl }: UserMenuProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('nav')

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut()
      router.push(ROUTES.HOME)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open user menu">
          <UserAvatar name={name} avatarUrl={avatarUrl} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={ROUTES.PROFILE}>
            <UserIcon className="size-4" />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOutIcon className="size-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
