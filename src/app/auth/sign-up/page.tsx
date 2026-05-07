import type { Metadata } from 'next'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { FadeIn } from '@/components/auth/fade-in'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedBird } from '@/components/auth/animated-bird'
import { ExpensePreview } from '@/components/expense-preview'
import { sql } from '@/lib/db'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create a Kvitt account to start splitting expenses with friends and groups.',
}

export default async function SignUpPage({ searchParams }: PageProps<'/auth/sign-up'>) {
  const { redirect } = await searchParams
  const redirectParam = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined

  const inviteCode = redirectParam?.match(/^\/invite\/(.+)$/)?.[1]

  let groupName: string | null = null
  if (inviteCode) {
    const [group] = await sql`SELECT name FROM groups WHERE invite_code = ${inviteCode}` as { name: string }[]
    groupName = group?.name ?? null
  }

  const t = await getTranslations('auth')
  const tSignUp = await getTranslations('auth.signUp')

  return (
    <div className="w-full max-w-sm md:max-w-3xl flex flex-col gap-6">
      <FadeIn className="flex flex-col items-center gap-1.5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-2xl">
          <AnimatedBird className="size-7 text-primary" />
          <span>Kvitt</span>
        </Link>
        <p className="text-sm text-muted-foreground">{t('tagline')}</p>
      </FadeIn>

      <FadeIn up delay={0.1}>
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            {/* Left: form */}
            <div className="p-6 md:p-8 flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold">{tSignUp('pageTitle')}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{tSignUp('pageSubtitle')}</p>
              </div>
              <SignUpForm redirect={redirectParam} />
              <p className="text-center text-sm text-muted-foreground mt-2">
                {tSignUp('alreadyHaveAccount')}{' '}
                <Link
                  href={redirectParam ? `/auth/sign-in?redirect=${encodeURIComponent(redirectParam)}` : '/auth/sign-in'}
                  className="text-foreground underline underline-offset-4"
                >
                  {tSignUp('signInLink')}
                </Link>
              </p>
            </div>

            {/* Right: decorative preview panel */}
            <div className="relative hidden md:flex flex-col justify-center gap-6 bg-muted px-8 py-10 overflow-hidden border-l border-border">
              <div className="absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -bottom-12 -left-12 size-40 rounded-full bg-primary/10 blur-3xl" />

              <div className="relative flex flex-col gap-1">
                {groupName ? (
                  <>
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">{tSignUp('invitedBadge')}</p>
                    <p className="text-lg font-semibold text-foreground leading-snug">
                      {tSignUp('invitedHeadlinePre')}{' '}
                      <span className="text-primary">{groupName}</span>{' '}
                      {tSignUp('invitedHeadlinePost')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tSignUp('invitedBody')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">{tSignUp('howItWorksBadge')}</p>
                    <p className="text-lg font-semibold text-foreground leading-snug">
                      {tSignUp('howItWorksHeadline')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tSignUp('howItWorksBody')}
                    </p>
                  </>
                )}
              </div>

              <div className="relative">
                <ExpensePreview cardBg="bg-card" delayOffset={0.45} showFooter />
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15} className="text-center text-xs text-balance text-muted-foreground px-4">
        {tSignUp('terms')}{' '}
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">{tSignUp('termsLink')}</Link>
        {' '}{tSignUp('and')}{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">{tSignUp('privacyLink')}</Link>.
      </FadeIn>
    </div>
  )
}
