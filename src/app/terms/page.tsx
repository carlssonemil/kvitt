import { FadeIn } from '@/components/auth/fade-in'
import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: 'Terms of Service',
  description: 'Read the Kvitt Terms of Service.',
}

export default function TermsPage() {
  return (
    <>
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-20 flex flex-col gap-8">
      <FadeIn up delay={0.05}>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
        </div>
      </FadeIn>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <FadeIn up delay={0.1}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Acceptance</h2>
            <p className="text-muted-foreground">
              By using Kvitt, you agree to these terms. If you don&apos;t agree, please don&apos;t
              use the service.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.15}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">The service</h2>
            <p className="text-muted-foreground">
              Kvitt is a tool for tracking shared expenses. It&apos;s provided as-is, free of charge.
              We may change or discontinue it at any time.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.2}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Your account</h2>
            <p className="text-muted-foreground">
              You&apos;re responsible for keeping your account secure and for all activity under it.
              Don&apos;t use Kvitt for anything illegal or harmful to others.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.25}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Liability</h2>
            <p className="text-muted-foreground">
              Kvitt is provided without warranties of any kind. We&apos;re not liable for any damages
              arising from your use of the service, including data loss or financial disputes between
              users.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.3}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">Changes</h2>
            <p className="text-muted-foreground">
              We may update these terms occasionally. Continued use of Kvitt after changes means you
              accept the new terms.
            </p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.35}>
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
