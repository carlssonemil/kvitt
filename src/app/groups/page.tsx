import type { Metadata } from "next";
import { neonAuth } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: 'Your groups',
  robots: { index: false },
};
import { redirect } from "next/navigation";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { sql } from "@/lib/db";
import { ensureUser } from "@/lib/ensure-user";
import type { DbGroup } from "@/types/database";
import Link from "next/link";
import { GroupMemberAvatars } from "@/components/group-member-avatars";
import { Badge } from "@/components/ui/badge";

interface GroupWithMembers extends DbGroup {
  members: { display_name: string; avatar_url: string | null }[]
  your_balance: number
}

export default async function GroupsPage() {
  const { session, user } = await neonAuth();
  if (!session || !user) redirect("/");

  const dbUser = await ensureUser({
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  });

  const groups = await sql`
    SELECT
      g.*,
      json_agg(
        json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url)
        ORDER BY u.display_name
      ) AS members,
      (
        COALESCE((SELECT SUM(e.amount)::float FROM expenses e WHERE e.group_id = g.id AND e.paid_by = ${dbUser.id} AND e.currency = g.currency), 0)
        - COALESCE((SELECT SUM(es.amount)::float FROM expense_splits es JOIN expenses e ON e.id = es.expense_id WHERE e.group_id = g.id AND es.user_id = ${dbUser.id} AND e.currency = g.currency), 0)
        + COALESCE((SELECT SUM(s.amount)::float FROM settlements s WHERE s.group_id = g.id AND s.paid_to = ${dbUser.id} AND s.currency = g.currency), 0)
        - COALESCE((SELECT SUM(s.amount)::float FROM settlements s WHERE s.group_id = g.id AND s.paid_by = ${dbUser.id} AND s.currency = g.currency), 0)
      ) AS your_balance
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    JOIN users u ON u.id = gm.user_id
    WHERE g.id IN (
      SELECT group_id FROM group_members WHERE user_id = ${dbUser.id}
    )
    GROUP BY g.id
    ORDER BY g.created_at DESC
  ` as GroupWithMembers[];

  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your groups</h1>
        <CreateGroupDialog />
      </div>
      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a group to start splitting expenses."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const balance = Math.round(group.your_balance * 100) / 100;
            const formatted = new Intl.NumberFormat("sv-SE", {
              style: "currency",
              currency: group.currency,
              maximumFractionDigits: 0,
            }).format(Math.abs(balance));
            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex items-start md:items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{group.name}</span>
                  {group.description && (
                    <span className="text-sm text-muted-foreground">{group.description}</span>
                  )}
                  {balance > 0.005 && (
                    <Badge variant="outline" className="md:hidden text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 w-fit mt-1">
                      You are owed {formatted}
                    </Badge>
                  )}
                  {balance < -0.005 && (
                    <Badge variant="outline" className="md:hidden text-xs text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400 w-fit mt-1">
                      You owe {formatted}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {balance > 0.005 && (
                    <Badge variant="outline" className="hidden md:inline-flex text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
                      You are owed {formatted}
                    </Badge>
                  )}
                  {balance < -0.005 && (
                    <Badge variant="outline" className="hidden md:inline-flex text-xs text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400">
                      You owe {formatted}
                    </Badge>
                  )}
                  <GroupMemberAvatars members={group.members} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
