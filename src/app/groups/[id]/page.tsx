import { neonAuth } from '@/lib/auth/server'
import { redirect, notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { getGroupExpenses, getGroupMembers, getGroupSettlements } from '@/lib/queries'
import { computeBalances } from '@/lib/balance'
import type { DbGroup } from '@/types/database'
import Link from 'next/link'
import { ArrowLeftIcon, HandCoinsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { GroupTabs } from '@/components/group-tabs'
import { CreateExpenseDialog } from '@/components/create-expense-dialog'
import { ExpenseList } from '@/components/expense-list'
import { BalanceList } from '@/components/balance-list'
import { GroupSettings } from '@/components/group-settings'
import { GroupVisibilityBanner } from '@/components/group-visibility-banner'
import { Separator } from '@/components/ui/separator'
import { GroupStatsTab } from '@/components/group-stats-view'
import { getTranslations, getLocale } from 'next-intl/server'

export default async function GroupPage({ params }: PageProps<'/groups/[id]'>) {
  const { id } = await params

  const { session, user } = await neonAuth()
  if (!session || !user) redirect('/')

  const dbUser = await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  })

  // Verify membership + fetch group
  const [group] = await sql`
    SELECT g.*, gm.hidden_at FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE g.id = ${id} AND gm.user_id = ${dbUser.id}
  ` as (DbGroup & { hidden_at: string | null })[]

  if (!group) notFound()

  // Mark any "new activity" hint as seen now that the (possibly hidden) group is being viewed
  await sql`
    UPDATE group_members SET activity_seen_at = now()
    WHERE group_id = ${id} AND user_id = ${dbUser.id} AND hidden_at IS NOT NULL
  `

  const [members, expenses, settlements, balances, t, locale] = await Promise.all([
    getGroupMembers(id),
    getGroupExpenses(id),
    getGroupSettlements(id),
    computeBalances(id, group.currency),
    getTranslations('group'),
    getLocale(),
  ])

  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'

  // Net balance in group currency for the header summary
  let myNetBalance = 0
  for (const b of balances) {
    if (b.to_user_id === dbUser.id)   myNetBalance += b.amount
    if (b.from_user_id === dbUser.id) myNetBalance -= b.amount
  }
  myNetBalance = Math.round(myNetBalance * 100) / 100

  // Suggest hiding the group once it's fully settled and has had at least some history
  const isFullySettled = !balances.some(b => b.from_user_id === dbUser.id || b.to_user_id === dbUser.id)
  const hasHistory = expenses.length > 0 && settlements.length > 0
  const suggestHide = !group.hidden_at && isFullySettled && hasHistory

  const memberList = members.map(m => ({
    id: m.user_id,
    display_name: m.display_name,
    avatar_url: m.avatar_url,
    email: m.email,
  }))

  return (
    <main className="max-w-3xl mx-auto w-full px-4 pt-4 pb-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/groups">
          <ArrowLeftIcon className="size-4" />
          {t('back')}
        </Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-bold truncate">{group.name}</h1>
        {group.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
        )}
        {(group.hidden_at || suggestHide) && (
          <GroupVisibilityBanner groupId={id} hidden={!!group.hidden_at} />
        )}
        {Math.abs(myNetBalance) > 0.005 && (() => {
          const formatted = new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: group.currency,
            maximumFractionDigits: 0,
          }).format(Math.abs(myNetBalance))
          return myNetBalance > 0 ? (
            <p className="flex items-center gap-1 text-sm font-medium text-primary mt-2">
              <HandCoinsIcon className="size-3.5" />
              {t('youAreOwed', { amount: formatted })}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-sm font-medium text-orange-600 dark:text-orange-400 mt-2">
              <HandCoinsIcon className="size-3.5" />
              {t('youOwe', { amount: formatted })}
            </p>
          )
        })()}
      </div>

      <GroupTabs counts={{
        expenses: expenses.length + settlements.length,
        balances: balances.filter(b => b.from_user_id === dbUser.id).length || undefined,
      }}>
        <TabsContent value="expenses">
          <ExpenseList
            expenses={expenses}
            settlements={settlements}
            groupId={id}
            currency={group.currency}
            currentUserId={dbUser.id}
            members={memberList}
            action={
              <CreateExpenseDialog
                groupId={id}
                currency={group.currency}
                members={memberList}
                currentUserId={dbUser.id}
                triggerClassName="rounded-full h-11 px-8 shadow-lg sm:rounded-md sm:h-8 sm:px-3 sm:shadow-none"
              />
            }
          />
        </TabsContent>

        <TabsContent value="balances">
          <BalanceList
            balances={balances}
            members={memberList}
            groupId={id}
            groupCurrency={group.currency}
            currentUserId={dbUser.id}
          />
        </TabsContent>

        <TabsContent value="stats">
          <GroupStatsTab groupId={id} currency={group.currency} />
        </TabsContent>

        <TabsContent value="settings">
          <GroupSettings
            groupId={id}
            groupName={group.name}
            groupDescription={group.description}
            groupCurrency={group.currency}
            createdBy={group.created_by}
            inviteCode={group.invite_code}
            members={memberList}
            currentUserId={dbUser.id}
            hiddenAt={group.hidden_at}
          />
        </TabsContent>
      </GroupTabs>
    </main>
  )
}
