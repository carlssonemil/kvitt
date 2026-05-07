import { FadeIn } from '@/components/auth/fade-in'
import { SiteFooter } from '@/components/site-footer'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('terms')
  return { title: t('title') }
}

export default async function TermsPage() {
  const t = await getTranslations('terms')

  return (
    <>
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-20 flex flex-col gap-8">
      <FadeIn up delay={0.05}>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('lastUpdated')}</p>
        </div>
      </FadeIn>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <FadeIn up delay={0.1}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">{t('acceptance')}</h2>
            <p className="text-muted-foreground">{t('acceptanceBody')}</p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.15}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">{t('theService')}</h2>
            <p className="text-muted-foreground">{t('theServiceBody')}</p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.2}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">{t('yourAccount')}</h2>
            <p className="text-muted-foreground">{t('yourAccountBody')}</p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.25}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">{t('liability')}</h2>
            <p className="text-muted-foreground">{t('liabilityBody')}</p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.3}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">{t('changes')}</h2>
            <p className="text-muted-foreground">{t('changesBody')}</p>
          </section>
        </FadeIn>

        <FadeIn up delay={0.35}>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-base">{t('contact')}</h2>
            <p className="text-muted-foreground">
              {t('contactBody')}{' '}
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
