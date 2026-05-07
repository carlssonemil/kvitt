import type { Metadata } from 'next'
import { SignInForm } from '@/components/auth/sign-in-form'
import { FadeIn } from '@/components/auth/fade-in'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedBird } from '@/components/auth/animated-bird'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Kvitt account to manage shared expenses.',
}

export default async function SignInPage({ searchParams }: PageProps<'/auth/sign-in'>) {
  const { redirect } = await searchParams
  const redirectParam = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined

  const t = await getTranslations('auth')
  const tSignIn = await getTranslations('auth.signIn')

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      <FadeIn className="flex flex-col items-center gap-1.5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-2xl">
          <AnimatedBird className="size-7 text-primary" />
          <span>Kvitt</span>
        </Link>
        <p className="text-sm text-muted-foreground">{t('tagline')}</p>
      </FadeIn>

      <FadeIn up delay={0.1}>
        <Card>
          <CardContent className="p-6 md:p-8 flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-bold">{tSignIn('pageTitle')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{tSignIn('pageSubtitle')}</p>
            </div>
            <SignInForm redirect={redirectParam} />
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15} className="text-center text-sm text-muted-foreground">
        {tSignIn('noAccount')}{' '}
        <Link
          href={redirectParam ? `/auth/sign-up?redirect=${encodeURIComponent(redirectParam)}` : '/auth/sign-up'}
          className="text-foreground underline underline-offset-4"
        >
          {tSignIn('signUpLink')}
        </Link>
      </FadeIn>
    </div>
  )
}
