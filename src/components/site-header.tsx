import Link from 'next/link'
import { Bird } from 'lucide-react'
import { UserMenu } from '@/components/user-menu'
import { neonAuth } from '@/lib/auth/server'
import { ROUTES } from '@/lib/constants'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getTranslations } from 'next-intl/server'

type AuthState = Awaited<ReturnType<typeof neonAuth>>

// SiteHeader lives in the root layout, which no error.tsx can catch. neonAuth()
// throws when the auth backend is cold/unreachable or returns a non-JSON error,
// which would otherwise surface as Next's built-in "This page couldn't load".
// Retry once, then degrade to the signed-out header; pages do their own auth
// checks and are covered by their error boundaries.
async function getHeaderAuth(): Promise<AuthState> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await neonAuth()
    } catch (error) {
      console.error('SiteHeader: failed to fetch session', error)
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  return { session: null, user: null } as AuthState
}

export async function SiteHeader() {
  const { session, user } = await getHeaderAuth()
  const t = await getTranslations('nav')

  if (!session) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="max-w-4xl mx-auto w-full px-6">
          <nav className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity">
              <Bird className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
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
