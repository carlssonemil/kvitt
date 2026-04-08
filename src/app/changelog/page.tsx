import { FadeIn } from '@/components/auth/fade-in'
import { SiteFooter } from '@/components/site-footer'
import { changelog } from '@/data/changelog'

export const metadata = {
  title: 'Changelog',
  description: 'New updates and improvements to Kvitt.',
}

export default function ChangelogPage() {
  return (
    <>
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-20 flex flex-col gap-8">
        <FadeIn up delay={0.05}>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Changelog</h1>
            <p className="text-sm text-muted-foreground">New updates and improvements to Kvitt.</p>
          </div>
        </FadeIn>

        <FadeIn up delay={0.1}>
          <div className="flex flex-col">
            {changelog.map((entry, i) => (
              <div key={entry.date} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="size-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  {i < changelog.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                </div>
                <div className="flex flex-col gap-1 pb-8">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <h2 className="font-semibold text-sm">{entry.title}</h2>
                  {Array.isArray(entry.description) ? (
                    <ul className="list-disc list-outside pl-4 text-sm text-muted-foreground space-y-1 mt-1">
                      {entry.description.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </main>
      <SiteFooter />
    </>
  )
}
