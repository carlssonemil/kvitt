import { redirect } from "next/navigation";
import { neonAuth } from "@/lib/auth/server";
import Link from "next/link";
import { PlusIcon, ArrowRightIcon, ReceiptIcon, HandCoinsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/auth/fade-in";
import { KvittTooltip } from "@/components/kvitt-tooltip";
import { SiteFooter } from "@/components/site-footer";
import { ExpensePreview } from "@/components/expense-preview";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const { session } = await neonAuth();
  if (session) redirect("/groups");

  const t = await getTranslations('home');

  return (
    <>
      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-muted border-b border-border">
          <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28">
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

              {/* Right: expense preview */}
              <ExpensePreview />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 md:py-20">
          <FadeIn className="flex flex-col items-center text-center gap-2 mb-10">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t('howItWorks.badge')}</p>
            <h2 className="text-2xl font-bold tracking-tight">{t('howItWorks.headline')}</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-6 items-stretch">
            <FadeIn up delay={0.1} className="h-full">
              <div className="relative rounded-xl bg-card border border-border p-6 flex flex-col gap-3 h-full">
                <div className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <PlusIcon className="size-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{t('howItWorks.step1Label')}</p>
                <h3 className="font-semibold">{t('howItWorks.step1Title')}</h3>
                <p className="text-sm text-muted-foreground">{t('howItWorks.step1Body')}</p>
              </div>
            </FadeIn>
            <FadeIn up delay={0.2} className="h-full">
              <div className="relative rounded-xl bg-card border border-border p-6 flex flex-col gap-3 h-full">
                <div className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <ReceiptIcon className="size-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{t('howItWorks.step2Label')}</p>
                <h3 className="font-semibold">{t('howItWorks.step2Title')}</h3>
                <p className="text-sm text-muted-foreground">{t('howItWorks.step2Body')}</p>
              </div>
            </FadeIn>
            <FadeIn up delay={0.3} className="h-full">
              <div className="relative rounded-xl bg-card border border-border p-6 flex flex-col gap-3 h-full">
                <div className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <HandCoinsIcon className="size-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{t('howItWorks.step3Label')}</p>
                <h3 className="font-semibold">{t('howItWorks.step3Title')}</h3>
                <p className="text-sm text-muted-foreground">{t('howItWorks.step3Body')}</p>
              </div>
            </FadeIn>
          </div>
        </section>
        {/* CTA + Footer */}
        <div className="w-full bg-muted relative overflow-hidden">
          <div className="absolute inset-0 bg-black/[0.02] dark:bg-black/[0.2]" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-96 rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl" />

          {/* CTA */}
          <section className="w-full border-t border-border relative">
            <div className="relative max-w-4xl mx-auto px-6 py-16 md:py-20 flex flex-col items-center text-center gap-4">
              <FadeIn className="flex flex-col items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{t('cta.headline')}</h2>
                <p className="text-muted-foreground">{t('cta.body')}</p>
              </FadeIn>
              <FadeIn delay={0.1}>
                <Button asChild size="lg">
                  <Link href="/auth/sign-up" className="flex items-center gap-2">{t('cta.button')} <ArrowRightIcon className="size-4" /></Link>
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
