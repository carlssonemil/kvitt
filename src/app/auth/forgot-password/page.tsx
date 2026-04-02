import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false },
}
import { FadeIn } from '@/components/auth/fade-in'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedBird } from '@/components/auth/animated-bird'

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      <FadeIn className="flex flex-col items-center gap-1.5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-2xl">
          <AnimatedBird className="size-7 text-primary" />
          <span>Kvitt</span>
        </Link>
        <p className="text-sm text-muted-foreground">Shared expenses made simple</p>
      </FadeIn>

      <FadeIn up delay={0.1}>
        <Card>
          <CardContent className="p-6 md:p-8 flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-bold">Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-0.5">We&apos;ll send a code to your email</p>
            </div>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
