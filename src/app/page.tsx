import { redirect } from "next/navigation";
import { neonAuth } from "@/lib/auth/server";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/auth/fade-in";
import { KvittTooltip } from "@/components/kvitt-tooltip";
import { SiteFooter } from "@/components/site-footer";
import { ExpensePreview } from "@/components/expense-preview";
import { LandingFeatureTabs } from "@/components/landing-feature-tabs";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const { session } = await neonAuth();
  if (session) redirect("/groups");

  const t = await getTranslations('home');

  return (
    <>
      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-muted">
          <div className="relative max-w-4xl mx-auto px-6 pt-14 pb-16 md:pt-20 md:pb-20">
            <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              {/* Left: text + CTAs */}
              <div className="flex flex-col gap-6">
                <FadeIn className="flex flex-col gap-3">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    {t('hero.headline')}{" "}
                    <KvittTooltip />
                    .
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    {t('hero.subheadline')}
                  </p>
                </FadeIn>
                <FadeIn delay={0.1} className="flex gap-3">
                  <Button asChild size="lg">
                    <Link href="/auth/sign-up">{t('hero.getStarted')}</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/auth/sign-in">{t('hero.signIn')}</Link>
                  </Button>
                </FadeIn>
              </div>

              {/* Right: expense preview, haloed by the one glow this hero earns */}
              <div className="relative">
                <div className="absolute -inset-6 rounded-[2rem] bg-primary/15 blur-3xl" />
                <ExpensePreview />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="w-full max-w-4xl mx-auto px-6 py-16 md:py-20">
          <FadeIn className="flex flex-col items-center text-center gap-2 mb-10">
            <h2 className="text-2xl font-bold tracking-tight">{t('features.headline')}</h2>
          </FadeIn>
          <LandingFeatureTabs />
        </section>

        {/* CTA + Footer */}
        <div className="mt-auto w-full bg-muted relative overflow-hidden">
          <div className="absolute inset-0 bg-black/[0.02] dark:bg-black/[0.2]" />
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-56 w-[28rem] rounded-[3rem] bg-primary/10 dark:bg-primary/20 blur-3xl" />

          {/* CTA */}
          <section className="w-full relative">
            <div className="relative max-w-4xl mx-auto px-6 pt-8 pb-16 md:pt-12 md:pb-20 flex flex-col items-center text-center gap-4">
              <FadeIn className="flex flex-col items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{t('cta.headline')}</h2>
                <p className="text-muted-foreground">{t('cta.body')}</p>
              </FadeIn>
              <FadeIn delay={0.1}>
                <Button asChild size="lg">
                  <Link href="/auth/sign-up" className="flex items-center gap-2">{t('cta.button')} <ArrowRightIcon className="size-4" aria-hidden="true" /></Link>
                </Button>
              </FadeIn>
            </div>
          </section>

          <SiteFooter />
        </div>
      </main>
    </>
  );
}
