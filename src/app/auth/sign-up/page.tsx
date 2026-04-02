import type { Metadata } from 'next'
import { SignUpForm } from '@/components/auth/sign-up-form'

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create a Kvitt account to start splitting expenses with friends and groups.',
}
import { FadeIn } from '@/components/auth/fade-in'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedBird } from '@/components/auth/animated-bird'
import { ExpensePreview } from '@/components/expense-preview'
import { sql } from '@/lib/db'


export default async function SignUpPage({ searchParams }: PageProps<'/auth/sign-up'>) {
  const { redirect } = await searchParams
  const redirectParam = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined

  const inviteCode = redirectParam?.match(/^\/invite\/(.+)$/)?.[1]

  let groupName: string | null = null
  if (inviteCode) {
    const [group] = await sql`SELECT name FROM groups WHERE invite_code = ${inviteCode}` as { name: string }[]
    groupName = group?.name ?? null
  }

  return (
    <div className="w-full max-w-sm md:max-w-3xl flex flex-col gap-6">
      {/* Logo + tagline above card */}
      <FadeIn className="flex flex-col items-center gap-1.5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-2xl">
          <AnimatedBird className="size-7 text-primary" />
          <span>Kvitt</span>
        </Link>
        <p className="text-sm text-muted-foreground">Shared expenses made simple</p>
      </FadeIn>

      {/* Card */}
      <FadeIn up delay={0.1}>
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            {/* Left: form */}
            <div className="p-6 md:p-8 flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold">Create an account</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Fill in the form below to get started</p>
              </div>
              <SignUpForm redirect={redirectParam} />
              <p className="text-center text-sm text-muted-foreground mt-2">
                Already have an account?{' '}
                <Link
                  href={redirectParam ? `/auth/sign-in?redirect=${encodeURIComponent(redirectParam)}` : '/auth/sign-in'}
                  className="text-foreground underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {/* Right: decorative preview panel */}
            <div className="relative hidden md:flex flex-col justify-center gap-6 bg-muted px-8 py-10 overflow-hidden border-l border-border">
              {/* Decorative blobs */}
              <div className="absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -bottom-12 -left-12 size-40 rounded-full bg-primary/10 blur-3xl" />

              {/* Headline */}
              <div className="relative flex flex-col gap-1">
                {groupName ? (
                  <>
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">You've been invited</p>
                    <p className="text-lg font-semibold text-foreground leading-snug">
                      Join <span className="text-primary">{groupName}</span> on Kvitt
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sign up to start tracking shared expenses with your group.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">How it works</p>
                    <p className="text-lg font-semibold text-foreground leading-snug">
                      Track and split expenses<br />with friends
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Add expenses, see who owes what, and settle up in seconds.
                    </p>
                  </>
                )}
              </div>

              {/* Fake expense rows */}
              <div className="relative">
                <ExpensePreview cardBg="bg-card" delayOffset={0.45} showFooter />
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Terms below card */}
      <FadeIn delay={0.15} className="text-center text-xs text-balance text-muted-foreground px-4">
        By signing up, you agree to our{' '}
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">Privacy Policy</Link>.
      </FadeIn>
    </div>
  )
}
