import type { Metadata } from "next";
import { neonAuth } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: 'Your groups',
  robots: { index: false },
};
import { redirect } from "next/navigation";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { Users, ChevronDownIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { sql } from "@/lib/db";
import { ensureUser } from "@/lib/ensure-user";
import type { DbGroup } from "@/types/database";
import Link from "next/link";
import { GroupMemberAvatars } from "@/components/group-member-avatars";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getTranslations, getLocale } from "next-intl/server";
import { computeBalances } from "@/lib/balance";

interface GroupWithMembers extends DbGroup {
  hidden_at: string | null
  activity_seen_at: string | null
  members: { display_name: string; avatar_url: string | null }[]
}

export default async function GroupsPage() {
  const { session, user } = await neonAuth();
  if (!session || !user) redirect("/");

  const dbUser = await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  });

  const [groups, t, locale] = await Promise.all([
    sql`
      SELECT
        g.*,
        gm_self.hidden_at,
        gm_self.activity_seen_at,
        json_agg(
          json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url)
          ORDER BY u.display_name
        ) AS members
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      JOIN users u ON u.id = gm.user_id
      JOIN group_members gm_self ON gm_self.group_id = g.id AND gm_self.user_id = ${dbUser.id}
      WHERE g.id IN (
        SELECT group_id FROM group_members WHERE user_id = ${dbUser.id}
      )
      GROUP BY g.id, gm_self.hidden_at, gm_self.activity_seen_at
      ORDER BY g.created_at DESC
    ` as unknown as Promise<GroupWithMembers[]>,
    getTranslations('groups'),
    getLocale(),
  ]);

  const activeGroups = groups.filter(g => !g.hidden_at)
  const hiddenGroups = groups.filter(g => g.hidden_at)

  // Compute net balance per group in group currency (handles all expense currencies)
  const balancesByGroup = await Promise.all(
    groups.map(g => computeBalances(g.id, g.currency))
  )
  const netBalances = balancesByGroup.map((balances, i) => {
    const userId = dbUser.id
    let net = 0
    for (const b of balances) {
      if (b.to_user_id === userId)   net += b.amount
      if (b.from_user_id === userId) net -= b.amount
    }
    return { groupId: groups[i].id, net: Math.round(net * 100) / 100 }
  })

  // For hidden groups, check whether new activity happened after the group was hidden
  const newActivityByGroup = new Map(
    await Promise.all(
      hiddenGroups.map(async g => {
        const [row] = await sql`
          SELECT GREATEST(
            COALESCE((SELECT MAX(created_at) FROM expenses WHERE group_id = ${g.id}), '-infinity'),
            COALESCE((SELECT MAX(created_at) FROM settlements WHERE group_id = ${g.id}), '-infinity')
          ) AS last_activity_at
        ` as { last_activity_at: string | null }[]
        const seenAt = g.activity_seen_at && new Date(g.activity_seen_at) > new Date(g.hidden_at!)
          ? g.activity_seen_at
          : g.hidden_at
        const hasNewActivity = !!row.last_activity_at && new Date(row.last_activity_at) > new Date(seenAt!)
        return [g.id, hasNewActivity] as const
      })
    )
  )

  const anyHiddenGroupHasNewActivity = hiddenGroups.some(g => newActivityByGroup.get(g.id))

  const intlLocale = locale === 'sv' ? 'sv-SE' : 'en-US';

  function renderGroupRow(group: GroupWithMembers, opts?: { hidden?: boolean }) {
    const balance = netBalances.find(n => n.groupId === group.id)?.net ?? 0;
    const formatted = new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: group.currency,
      maximumFractionDigits: 0,
    }).format(Math.abs(balance));
    return (
      <Link
        key={group.id}
        href={`/groups/${group.id}`}
        className={`flex items-start md:items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors ${opts?.hidden ? 'opacity-70' : ''}`}
      >
        <div className="flex flex-col gap-1">
          <span className="font-medium">{group.name}</span>
          {group.description && (
            <span className="text-sm text-muted-foreground">{group.description}</span>
          )}
          {opts?.hidden && newActivityByGroup.get(group.id) && (
            <Badge variant="outline" className="text-xs text-primary border-primary/20 bg-primary/10 w-fit mt-1">
              {t('newActivitySinceHidden')}
            </Badge>
          )}
          {balance > 0.005 && (
            <Badge variant="outline" className="md:hidden text-xs text-primary border-primary/20 bg-primary/10 w-fit mt-1">
              {t('youAreOwed', { amount: formatted })}
            </Badge>
          )}
          {balance < -0.005 && (
            <Badge variant="outline" className="md:hidden text-xs text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400 w-fit mt-1">
              {t('youOwe', { amount: formatted })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {balance > 0.005 && (
            <Badge variant="outline" className="hidden md:inline-flex text-xs text-primary border-primary/20 bg-primary/10">
              {t('youAreOwed', { amount: formatted })}
            </Badge>
          )}
          {balance < -0.005 && (
            <Badge variant="outline" className="hidden md:inline-flex text-xs text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400">
              {t('youOwe', { amount: formatted })}
            </Badge>
          )}
          <GroupMemberAvatars members={group.members} />
        </div>
      </Link>
    );
  }

  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <CreateGroupDialog />
      </div>
      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activeGroups.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('emptyActiveTitle')}
              description={t('emptyActiveBody', { hiddenLabel: t('hiddenGroups') })}
            />
          ) : (
            activeGroups.map((group) => renderGroupRow(group))
          )}

          {hiddenGroups.length > 0 && (
            <Collapsible className="mt-2">
              <div className={`flex ${activeGroups.length === 0 ? 'justify-center' : ''}`}>
                <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                  {t('hiddenGroups')}
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {hiddenGroups.length}
                  </Badge>
                  {anyHiddenGroupHasNewActivity && (
                    <span className="text-xs font-medium text-primary">
                      {t('newActivityHint')}
                    </span>
                  )}
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <div className="flex flex-col gap-3 mt-3">
                  {hiddenGroups.map((group) => renderGroupRow(group, { hidden: true }))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </main>
  );
}
