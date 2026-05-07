import type { Metadata } from 'next'
import { neonAuth } from '@/lib/auth/server'

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false },
}
import { redirect } from 'next/navigation'
import { ensureUser } from '@/lib/ensure-user'
import { ProfileForm } from '@/components/profile-form'
import { getTranslations } from 'next-intl/server'

export default async function ProfilePage() {
  const { session, user } = await neonAuth()
  if (!session || !user) redirect('/')

  const [dbUser, t] = await Promise.all([
    ensureUser({
      email: user.email ?? '',
      name: user.name ?? null,
      image: user.image ?? null,
    }),
    getTranslations('profile'),
  ])

  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <ProfileForm displayName={dbUser.display_name} email={dbUser.email} />
    </main>
  )
}
