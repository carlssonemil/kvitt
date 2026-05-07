import Link from 'next/link'
import { Bird } from 'lucide-react'
import { UserMenu } from '@/components/user-menu'
import { neonAuth } from '@/lib/auth/server'
import { ROUTES } from '@/lib/constants'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getTranslations } from 'next-intl/server'

export async function SiteHeader() {
  const { session, user } = await neonAuth()
  const t = await getTranslations('nav')

  if (!session) {
    return (
      <header className="absolute top-0 left-0 w-full z-50">
        <div className="max-w-4xl mx-auto w-full px-6">
          <nav className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity">
              <Bird className="size-5 text-primary" strokeWidth={1.75} />
              <span>Kvitt</span>
            </Link>
            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <ThemeToggle />
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/sign-in">{t('signIn')}</Link>
              </Button>
            </div>
          </nav>
        </div>
      </header>
    )
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto w-full px-4">
        <nav className="flex items-center justify-between h-14">
          <Link
            href={session ? ROUTES.GROUPS : '/'}
            className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity"
          >
            <Bird className="size-5 text-primary" strokeWidth={1.75} />
            <span>Kvitt</span>
          </Link>

          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <ThemeToggle />
            <UserMenu name={user.name ?? user.email ?? '?'} avatarUrl={user.image} />
          </div>
        </nav>
      </div>
    </header>
  )
}
