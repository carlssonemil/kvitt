import { FadeIn } from '@/components/auth/fade-in'
import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: 'Privacy Policy',
  description: 'Read the Kvitt Privacy Policy.',
}

export default function PrivacyPage() {
  return (
    <>
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-20 flex flex-col gap-8">
      <FadeIn up delay={0.05}>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
        </div>
      </FadeIn>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <FadeIn up delay={0.1}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">What we collect</h2>
            <p className="text-muted-foreground">
              We collect your name, email address, and the data you create in the app — groups,
              expenses, and settlements. We also collect basic usage data to keep the service running.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.15}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">How we use it</h2>
            <p className="text-muted-foreground">
              Your data is used solely to provide the Kvitt service. We don&apos;t sell it, share it
              with advertisers, or use it for any purpose beyond operating the app.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.2}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Data storage</h2>
            <p className="text-muted-foreground">
              Data is stored securely in the cloud. We take reasonable technical measures to protect
              it, but no system is perfectly secure.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.25}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Your rights</h2>
            <p className="text-muted-foreground">
              You can request deletion of your account and all associated data at any time by
              contacting us.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.3}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Contact</h2>
            <p className="text-muted-foreground">
              Questions?{' '}
              <a
                href="mailto:hello@emilcarlsson.se"
                className="text-foreground underline underline-offset-4"
              >
                hello@emilcarlsson.se
              </a>
            </p>
          </section>
        </FadeIn>
      </div>
    </main>
    <SiteFooter />
    </>
  )
}
