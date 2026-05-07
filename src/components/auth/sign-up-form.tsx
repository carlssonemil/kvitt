'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { authClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { useTranslations } from 'next-intl'

type Step = 'details' | 'verify'

const variants = {
  enter: { opacity: 0, y: 6 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export function SignUpForm({ redirect }: { redirect?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('details')
  const [email, setEmail] = useState('')
  const t = useTranslations('auth.signUp')

  function handleDetailsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = data.get('name') as string
    const emailValue = data.get('email') as string
    const password = data.get('password') as string

    startTransition(async () => {
      setError(null)
      const { error } = await authClient.signUp.email({ name, email: emailValue, password })
      if (error) {
        setError(error.message ?? 'Sign up failed')
        return
      }
      setEmail(emailValue)
      setStep('verify')
    })
  }

  function handleVerifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const otp = data.get('otp') as string

    startTransition(async () => {
      setError(null)
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp })
      if (error) {
        setError(error.message ?? 'Invalid code')
        return
      }
      router.push(redirect || '/groups')
      router.refresh()
    })
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'details' ? (
        <motion.form
          key="details"
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          onSubmit={handleDetailsSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t('nameLabel')}</Label>
            <Input id="name" name="name" type="text" autoComplete="name" required disabled={isPending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('emailLabel')}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required disabled={isPending} />
            <p className="text-xs text-muted-foreground">{t('emailHint')}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} disabled={isPending} />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? t('submitting') : t('submit')}
          </Button>
          <OAuthButtons callbackURL={redirect || '/groups'} />
        </motion.form>
      ) : (
        <motion.form
          key="verify"
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          onSubmit={handleVerifySubmit}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-muted-foreground">
            {t('verifyStep', { email })}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="otp">{t('codeLabel')}</Label>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? t('verifying') : t('verify')}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setStep('details'); setError(null) }}
          >
            {t('back')}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
