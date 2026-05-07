'use client'

import type { Balance } from '@/types/database'
import { Currency, formatCurrency } from '@/components/currency'
import { SettleUpDialog } from '@/components/settle-up-dialog'
import { CheckCircle2Icon } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

interface Member {
  id: string
  display_name: string
}

interface BalanceListProps {
  balances: Balance[]
  members: Member[]
  groupId: string
  groupCurrency: string
  conversions?: Record<string, number>
  currentUserId: string
}

function BalanceRow({ balance, groupId, groupCurrency, conversions, members, showSettleUp, shortenTo }: {
  balance: Balance
  groupId: string
  groupCurrency: string
  conversions?: Record<string, number>
  members: Member[]
  showSettleUp: boolean
  shortenTo?: boolean
}) {
  const t = useTranslations('balance')
  const tc = useTranslations('common')
  const ts = useTranslations('settleUp')

  const approxAmount = balance.currency !== groupCurrency && conversions
    ? Math.round((balance.amount * (conversions[balance.currency] ?? 0)) * 100) / 100
    : null

  return (
    <div className={`flex items-center justify-between rounded-lg border p-4 ${showSettleUp ? 'border-primary/30 bg-primary/5' : ''}`}>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm">
          <span className="font-medium">{balance.from_user_name}</span>
          {` ${t('owes')} `}
          <span className="font-medium">{shortenTo ? tc('you') : balance.to_user_name}</span>
        </p>
        <p className="text-base font-semibold">
          <Currency amount={balance.amount} currency={balance.currency} />
          {approxAmount !== null && approxAmount > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1.5">
              (~{formatCurrency(approxAmount)} {groupCurrency})
            </span>
          )}
        </p>
      </div>
      {showSettleUp && (
        <SettleUpDialog
          groupId={groupId}
          currency={balance.currency}
          members={members}
          defaultFromId={balance.from_user_id}
          defaultToId={balance.to_user_id}
          defaultAmount={balance.amount}
          trigger={
            <Button variant="outline" size="sm">
              {shortenTo ? t('markSettled') : ts('trigger')}
            </Button>
          }
        />
      )}
    </div>
  )
}

export function BalanceList({ balances, members, groupId, groupCurrency, conversions, currentUserId }: BalanceListProps) {
  const t = useTranslations('balance')

  if (balances.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2Icon}
        title={t('settledTitle')}
        description={t('settledDesc')}
      />
    )
  }

  const iOwe = balances.filter(b => b.from_user_id === currentUserId)
  const owedToMe = balances.filter(b => b.to_user_id === currentUserId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {iOwe.length === 0 ? (
          <EmptyState
            icon={CheckCircle2Icon}
            title={t('youDontOweTitle')}
            description={t('youDontOweDesc')}
          />
        ) : (
          iOwe.map((balance, i) => (
            <BalanceRow key={i} balance={balance} groupId={groupId} groupCurrency={groupCurrency} conversions={conversions} members={members} showSettleUp />
          ))
        )}
      </div>

      {owedToMe.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('owedToYouLabel')}</p>
          {owedToMe.map((balance, i) => (
            <BalanceRow key={i} balance={balance} groupId={groupId} groupCurrency={groupCurrency} conversions={conversions} members={members} showSettleUp shortenTo />
          ))}
        </div>
      )}
    </div>
  )
}
