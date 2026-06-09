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
  currentUserId: string
}

function BalanceRow({ balance, groupId, groupCurrency, members, showSettleUp, shortenTo }: {
  balance: Balance
  groupId: string
  groupCurrency: string
  members: Member[]
  showSettleUp: boolean
  shortenTo?: boolean
}) {
  const t = useTranslations('balance')
  const tc = useTranslations('common')
  const ts = useTranslations('settleUp')

  const approxAmount = balance.approxAmount

  return (
    <div className={`flex items-start justify-between rounded-lg border p-4 ${showSettleUp ? 'border-primary/30 bg-primary/5' : ''}`}>
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
        {(balance.breakdown.length > 0 || balance.offset) && (
          <div className="flex flex-col gap-0.5 mt-1">
            {balance.breakdown.map((item, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {item.expense_title}
                {(balance.breakdown.length > 1 || balance.offset) && (
                  <span className="ml-1 tabular-nums">
                    · <Currency amount={item.amount} currency={balance.currency} className="inline" />
                  </span>
                )}
              </p>
            ))}
            {balance.offset && (
              <p className="text-xs text-muted-foreground">
                {t('offsetLabel', { name: balance.to_user_name })}
                <span className="ml-1 tabular-nums">
                  · −<Currency amount={balance.offset} currency={balance.currency} className="inline" />
                </span>
              </p>
            )}
          </div>
        )}
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

export function BalanceList({ balances, members, groupId, groupCurrency, currentUserId }: BalanceListProps) {
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
            <BalanceRow key={i} balance={balance} groupId={groupId} groupCurrency={groupCurrency} members={members} showSettleUp />
          ))
        )}
      </div>

      {owedToMe.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('owedToYouLabel')}</p>
          {owedToMe.map((balance, i) => (
            <BalanceRow key={i} balance={balance} groupId={groupId} groupCurrency={groupCurrency} members={members} showSettleUp shortenTo />
          ))}
        </div>
      )}
    </div>
  )
}
