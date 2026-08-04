import { neonAuth } from '@/lib/auth/server'
import { ensureUser } from '@/lib/ensure-user'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClaimGuestButton } from '@/components/claim-guest-button'

export default async function ClaimPage({ params }: PageProps<'/invite/claim/[token]'>) {
  const { token } = await params
  const { session, user } = await neonAuth()

  if (!session || !user) {
    redirect(`/auth/sign-in?redirect=${ROUTES.CLAIM(token)}`)
  }

  await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
    emailVerified: user.emailVerified,
  })

  const [guest] = await sql`
    SELECT display_name FROM users WHERE claim_token = ${token} AND is_guest = true
  ` as { display_name: string }[]

  if (!guest) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col gap-4 text-center">
          <h1 className="text-2xl font-bold">Invalid claim link</h1>
          <p className="text-sm text-muted-foreground">
            This claim link is no longer valid. Ask whoever added you to send a new one.
          </p>
          <Button asChild>
            <Link href={ROUTES.GROUPS}>Go to my groups</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">Claim {guest.display_name}&apos;s history?</h1>
        <p className="text-sm text-muted-foreground">
          This moves all of {guest.display_name}&apos;s expenses and balances in this group onto your account. This can&apos;t be undone.
        </p>
        <ClaimGuestButton claimToken={token} />
      </div>
    </main>
  )
}
