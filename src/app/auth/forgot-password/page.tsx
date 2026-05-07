import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { FadeIn } from '@/components/auth/fade-in'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedBird } from '@/components/auth/animated-bird'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false },
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth')
  const tFp = await getTranslations('auth.forgotPassword')

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
              <h1 className="text-xl font-bold">{tFp('pageTitle')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{tFp('pageSubtitle')}</p>
            </div>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
