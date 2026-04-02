'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { authClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

type Step = 'email' | 'reset'

const variants = {
  enter: { opacity: 0, y: 6 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export function ForgotPasswordForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const emailValue = data.get('email') as string

    startTransition(async () => {
      setError(null)
      await authClient.forgetPassword.emailOtp({ email: emailValue })
      // Always advance regardless of error — avoids leaking whether an email is registered
      setEmail(emailValue)
      setStep('reset')
    })
  }

  function handleResetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const otp = data.get('otp') as string
    const password = data.get('password') as string

    startTransition(async () => {
      setError(null)
      const { error } = await authClient.emailOtp.resetPassword({ email, otp, password })
      if (error) {
        setError(error.message ?? 'Failed to reset password')
        return
      }
      router.push('/auth/sign-in')
    })
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'email' ? (
        <motion.form
          key="email"
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          onSubmit={handleEmailSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required disabled={isPending} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Sending code…' : 'Send reset code'}
          </Button>
          <Link
            href="/auth/sign-in"
            className="text-sm text-center text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to sign in
          </Link>
        </motion.form>
      ) : (
        <motion.form
          key="reset"
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          onSubmit={handleResetSubmit}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-muted-foreground">
            We sent a reset code to <span className="text-foreground font-medium">{email}</span>. Enter it below along with your new password.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="otp">Reset code</Label>
            <Input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              autoFocus
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Resetting…' : 'Reset password'}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setStep('email'); setError(null) }}
          >
            Back
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
