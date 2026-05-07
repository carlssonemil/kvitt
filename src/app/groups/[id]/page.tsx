import { neonAuth } from '@/lib/auth/server'
import { redirect, notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { ensureUser } from '@/lib/ensure-user'
import { getGroupExpenses, getGroupMembers, getGroupSettlements, getGroupStats } from '@/lib/queries'
import { computeBalances } from '@/lib/balance'
import { getConversionsFrom } from '@/lib/exchange-rates'
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
import { Separator } from '@/components/ui/separator'
import { GroupStatsView } from '@/components/group-stats-view'
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
    SELECT g.* FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE g.id = ${id} AND gm.user_id = ${dbUser.id}
  ` as DbGroup[]

  if (!group) notFound()

  const [members, expenses, settlements, balances, stats, conversions, t, locale] = await Promise.all([
    getGroupMembers(id),
    getGroupExpenses(id),
    getGroupSettlements(id),
    computeBalances(id),
    getGroupStats(id, dbUser.id),
    getConversionsFrom(group.currency),
    getTranslations('group'),
    getLocale(),
  ])

  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US'

  // Net balance per currency for the header summary
  const netByCurrency = new Map<string, number>()
  for (const b of balances) {
    if (b.to_user_id === dbUser.id)   netByCurrency.set(b.currency, (netByCurrency.get(b.currency) ?? 0) + b.amount)
    if (b.from_user_id === dbUser.id) netByCurrency.set(b.currency, (netByCurrency.get(b.currency) ?? 0) - b.amount)
  }
  const myNetBalances = [...netByCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .filter(({ amount }) => Math.abs(amount) > 0.005)

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
        {myNetBalances.map(({ currency, amount }) => {
          const formatted = new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          }).format(Math.abs(amount))
          return amount > 0 ? (
            <p key={currency} className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400 mt-2">
              <HandCoinsIcon className="size-3.5" />
              {t('youAreOwed', { amount: formatted })}
            </p>
          ) : (
            <p key={currency} className="flex items-center gap-1 text-sm font-medium text-orange-600 dark:text-orange-400 mt-2">
              <HandCoinsIcon className="size-3.5" />
              {t('youOwe', { amount: formatted })}
            </p>
          )
        })}
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
            conversions={conversions ?? undefined}
            currentUserId={dbUser.id}
          />
        </TabsContent>

        <TabsContent value="stats">
          <GroupStatsView stats={stats} currency={group.currency} />
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
          />
        </TabsContent>
      </GroupTabs>
    </main>
  )
}
