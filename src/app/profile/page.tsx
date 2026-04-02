import type { Metadata } from 'next'
import { neonAuth } from '@/lib/auth/server'

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false },
}
import { redirect } from 'next/navigation'
import { ensureUser } from '@/lib/ensure-user'
import { ProfileForm } from '@/components/profile-form'

export default async function ProfilePage() {
  const { session, user } = await neonAuth()
  if (!session || !user) redirect('/')

  const dbUser = await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  })

  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Profile</h1>
      <ProfileForm displayName={dbUser.display_name} email={dbUser.email} />
    </main>
  )
}
