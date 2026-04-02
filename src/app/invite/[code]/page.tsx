import { neonAuth } from '@/lib/auth/server'
import { ensureUser } from '@/lib/ensure-user'
import { joinGroupByInvite } from '@/actions/member-actions'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function InvitePage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params
  const { session, user } = await neonAuth()

  if (!session || !user) {
    redirect(`/auth/sign-in?redirect=/invite/${code}`)
  }

  await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  })

  const result = await joinGroupByInvite(code)

  if (result.groupId) {
    redirect(ROUTES.GROUP(result.groupId))
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">Invalid invite link</h1>
        <p className="text-sm text-muted-foreground">
          This invite link is no longer valid. Ask a group member for a new one.
        </p>
        <Button asChild>
          <Link href={ROUTES.GROUPS}>Go to my groups</Link>
        </Button>
      </div>
    </main>
  )
}
