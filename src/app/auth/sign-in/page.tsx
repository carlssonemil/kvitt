import type { Metadata } from 'next'
import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Kvitt account to manage shared expenses.',
}
import { FadeIn } from '@/components/auth/fade-in'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedBird } from '@/components/auth/animated-bird'

export default async function SignInPage({ searchParams }: PageProps<'/auth/sign-in'>) {
  const { redirect } = await searchParams
  const redirectParam = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      {/* Logo + tagline above card */}
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
              <h1 className="text-xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Sign in to your Kvitt account</p>
            </div>
            <SignInForm redirect={redirectParam} />
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15} className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href={redirectParam ? `/auth/sign-up?redirect=${encodeURIComponent(redirectParam)}` : '/auth/sign-up'}
          className="text-foreground underline underline-offset-4"
        >
          Sign up
        </Link>
      </FadeIn>
    </div>
  )
}
